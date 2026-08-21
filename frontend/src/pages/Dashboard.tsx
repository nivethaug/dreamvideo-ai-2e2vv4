import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { getApiUrl } from "@/lib/api-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Film, Loader2, CheckCircle2, Pencil, AlertTriangle, Clock,
  Sparkles, Play, Plus, TrendingUp, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/services/database";
import { useAuth } from "@/lib/auth";

type ProjectStatus = "Completed" | "Generating" | "Processing" | "Draft" | "Failed";

interface Scene { id: number; heading: string; media_url: string | null; visual_prompt: string }
interface Job { id: number; status: string; error: string | null }
interface Project {
  id: number;
  title: string;
  status: ProjectStatus;
  idea: string;
  model: string | null;
  duration: number | null;
  updated_at: string | null;
  created_at: string | null;
  scenes: Scene[];
  jobs: Job[];
  latest_video_url: string | null;
}

const STATUS_META: Record<ProjectStatus, { tone: string; icon: typeof Film; label: string }> = {
  Completed: { tone: "bg-emerald-500/15 text-emerald-700 border-emerald-200", icon: CheckCircle2, label: "Completed" },
  Generating: { tone: "bg-violet-500/15 text-violet-700 border-violet-500/30", icon: Loader2, label: "Generating" },
  Processing: { tone: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: RefreshCw, label: "Processing" },
  Draft: { tone: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", icon: Pencil, label: "Draft" },
  Failed: { tone: "bg-red-500/15 text-red-600 border-red-200", icon: AlertTriangle, label: "Failed" },
};

const rel = (iso: string | null): string => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? "1 hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#14121f"/><text x="50%" y="50%" fill="#6b6a86" font-family="sans-serif" font-size="20" text-anchor="middle">No scene media</text></svg>`
);

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{ jobId: number; title: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ projects: Project[] }>("/api/v1/videos/projects");
    setLoading(false);
    if (res.success && res.data) {
      setProjects(res.data.projects ?? []);
      setError(null);
    } else {
      setError(res.error || "Could not load your projects.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => ([
    { label: "Videos Created", value: String(projects.length), delta: `${projects.filter(p => p.status === "Completed").length} exported`, icon: Film },
    { label: "In Progress", value: String(projects.filter(p => p.status === "Generating" || p.status === "Processing").length), delta: "rendering now", icon: Loader2 },
    { label: "Completed", value: String(projects.filter(p => p.status === "Completed").length), delta: "ready to export", icon: CheckCircle2 },
  ]), [projects]);

  const firstName = user?.name?.split(" ")[0] ?? "Director";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const activeCount = projects.filter(p => p.status === "Generating" || p.status === "Processing").length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" aria-hidden="true" />
          <p className="text-sm">Loading your studio…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
        <AlertTriangle className="h-10 w-10 text-red-400" aria-hidden="true" />
        <h1 className="text-xl font-semibold">{error}</h1>
        <Button onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12" data-testid="dashboard-page">
      {/* Greeting + continue creating */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-violet-600/80">{greeting}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-100 md:text-4xl">{firstName}, your studio is warm.</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            {activeCount > 0
              ? `${activeCount} ${activeCount === 1 ? "render is" : "renders are"} working in the background. Pick up a draft or start something new.`
              : "Pick up a draft or start something new."}
          </p>
        </div>
        <Button asChild className="h-11 gap-2 rounded-full bg-violet-600 px-6 text-white hover:bg-violet-500" data-testid="dashboard-new-video-button">
          <Link to="/create"><span className="flex items-center gap-2"><Plus className="h-4 w-4" aria-hidden="true" />New video</span></Link>
        </Button>
      </div>

      {/* Metrics */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map((m, i) => (
          <Card key={m.label} data-testid={["dashboard-kpi-created", "dashboard-kpi-progress", "dashboard-kpi-completed"][i]} className="border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-violet-950/30">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-500">{m.label}</p>
                <p className="mt-1 text-3xl font-semibold text-zinc-100">{m.value}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400"><TrendingUp className="h-3 w-3" aria-hidden="true" />{m.delta}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-600/20 p-3">
                <m.icon className="h-6 w-6 text-violet-700" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gallery */}
      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Your projects</h2>
          <span className="text-xs text-zinc-500">{projects.length} total</span>
        </div>

        {projects.length === 0 ? (
          <Card className="mt-4 border-dashed border-white/15 bg-white/[0.02]" data-testid="dashboard-empty-state">
            <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="rounded-full bg-violet-600/15 p-4"><Sparkles className="h-7 w-7 text-violet-700" aria-hidden="true" /></div>
              <div>
                <h3 className="text-lg font-semibold">No videos yet</h3>
                <p className="mt-1 max-w-sm text-sm text-zinc-400">Describe an idea and DreamVideo will storyboard, narrate and render it.</p>
              </div>
              <Button asChild className="mt-2 rounded-full bg-violet-600 text-white hover:bg-violet-500">
                <Link to="/create"><span className="flex items-center gap-2"><Play className="h-4 w-4" aria-hidden="true" />Create your first video</span></Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-live="polite">
            {projects.map(p => {
              const thumb = p.scenes.find(s => s.media_url)?.media_url || PLACEHOLDER;
              const meta = STATUS_META[p.status] ?? STATUS_META.Draft;
              const Icon = meta.icon;
              return (
                <Card key={p.id} data-testid={`dashboard-project-card-${p.id}`} className="group overflow-hidden border-white/10 bg-white/[0.03] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-950/40">
                  <div className="relative aspect-video overflow-hidden">
                    <img src={thumb} alt={p.title} loading="lazy" className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden="true" />
                    <Badge className={`absolute left-3 top-3 gap-1.5 border backdrop-blur ${meta.tone}`}>
                      <Icon className={`h-3 w-3 ${p.status === "Generating" || p.status === "Processing" ? "animate-spin" : ""}`} aria-hidden="true" />{meta.label}
                    </Badge>
                    {p.status === "Completed" && p.latest_video_url && (
                      <button
                        type="button"
                        aria-label={`Play ${p.title}`}
                        data-testid={`dashboard-play-button-${p.id}`}
                        onClick={() => {
                          const job = p.jobs?.find(j => j.status === "Completed") ?? p.jobs?.[0];
                          if (job) setPlaying({ jobId: job.id, title: p.title });
                        }}
                        className="absolute inset-0 flex items-center justify-center bg-transparent opacity-0 transition-opacity duration-300 focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/90 shadow-lg"><Play className="h-5 w-5 text-white" aria-hidden="true" /></span>
                      </button>
                    )}
                    <span className="absolute bottom-3 right-3 rounded-md bg-black/70 px-1.5 py-0.5 text-xs tabular-nums text-white">{p.duration ? `0:${String(p.duration).padStart(2, "0")}` : "—"}</span>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="truncate font-medium text-zinc-100">{p.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500"><Clock className="h-3 w-3" aria-hidden="true" />{rel(p.updated_at ?? p.created_at)}</p>
                    {p.status === "Failed" && p.jobs?.[0]?.error && <p className="mt-1 line-clamp-2 text-[11px] text-red-400/80">{p.jobs[0].error}</p>}
                    {p.status === "Draft" && (
                      <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-full border-white/15 bg-transparent text-zinc-200 hover:bg-white/10">
                        <Link to="/create" state={{ projectId: p.id }}>Continue editing</Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!playing} onOpenChange={open => !open && setPlaying(null)}>
        <DialogContent className="max-w-3xl border-white/10 bg-zinc-950" data-testid="dashboard-video-dialog">
          <DialogHeader>
            <DialogTitle className="truncate">{playing?.title}</DialogTitle>
          </DialogHeader>
          {playing && (
            <video
              src={getApiUrl(`/api/v1/videos/jobs/${playing.jobId}/stream?token=${encodeURIComponent(localStorage.getItem("auth_token") ?? "")}`)}
              controls
              autoPlay
              playsInline
              className="aspect-video w-full rounded-lg bg-black"
              aria-label={`Video player for ${playing.title}`}
              data-testid="dashboard-video-player"
            />
          )}
        </DialogContent>
      </Dialog>

      <p className="mt-10 text-center text-[11px] text-zinc-400">Project media: real stock footage from Pexels via your saved integration.</p>
    </div>
  );
};

export default Dashboard;
