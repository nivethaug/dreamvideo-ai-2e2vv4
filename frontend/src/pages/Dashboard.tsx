import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Film, Loader2, CheckCircle2, Pencil, AlertTriangle, Clock,
  Sparkles, Play, Plus, TrendingUp, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pick } from "@/lib/pexels";
import { useAuth } from "@/lib/auth";

type ProjectStatus = "Completed" | "Generating" | "Processing" | "Draft" | "Failed";

interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  updated: string;
  duration: string;
  seed: string;
}

const STATUS_META: Record<ProjectStatus, { tone: string; icon: typeof Film; label: string }> = {
  Completed: { tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: CheckCircle2, label: "Completed" },
  Generating: { tone: "bg-violet-500/15 text-violet-300 border-violet-500/30", icon: Loader2, label: "Generating" },
  Processing: { tone: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: RefreshCw, label: "Processing" },
  Draft: { tone: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30", icon: Pencil, label: "Draft" },
  Failed: { tone: "bg-red-500/15 text-red-300 border-red-500/30", icon: AlertTriangle, label: "Failed" },
};

const SEED_PROJECTS: Project[] = [
  { id: "p1", title: "North Atlantic — cold open", status: "Completed", updated: "2 hours ago", duration: "1:20", seed: "north-atlantic" },
  { id: "p2", title: "Product launch teaser", status: "Generating", updated: "just now", duration: "0:45", seed: "launch-teaser" },
  { id: "p3", title: "City nights montage", status: "Processing", updated: "5 minutes ago", duration: "2:05", seed: "city-nights" },
  { id: "p4", title: "Studio interview cut", status: "Draft", updated: "yesterday", duration: "3:40", seed: "interview-cut" },
  { id: "p5", title: "Desert drone sequence", status: "Failed", updated: "2 days ago", duration: "—", seed: "desert-drone" },
  { id: "p6", title: "Brand film — chapter two", status: "Completed", updated: "3 days ago", duration: "1:55", seed: "brand-ch2" },
];

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Mock project store — PENDING: replace with a backend projects endpoint.
    const t = setTimeout(() => {
      if (!alive) return;
      try {
        setProjects(SEED_PROJECTS);
        setError(null);
      } catch {
        setError("Could not load your projects.");
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { alive = false; clearTimeout(t); };
  }, []);

  const metrics = useMemo(() => ([
    { label: "Videos Created", value: "24", delta: "+6 this month", icon: Film },
    { label: "In Progress", value: String(projects.filter(p => p.status === "Generating" || p.status === "Processing").length), delta: "rendering now", icon: Loader2 },
    { label: "Completed", value: String(projects.filter(p => p.status === "Completed").length), delta: "ready to export", icon: CheckCircle2 },
  ]), [projects]);

  const firstName = user?.name?.split(" ")[0] ?? "Director";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" aria-hidden="true" />
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
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
      {/* Greeting + continue creating */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-violet-400/80">{greeting}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-100 md:text-4xl">{firstName}, your studio is warm.</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">Two renders are working in the background. Pick up a draft or start something new.</p>
        </div>
        <Button asChild className="h-11 gap-2 rounded-full bg-violet-600 px-6 text-white hover:bg-violet-500">
          <Link to="/create"><span className="flex items-center gap-2"><Plus className="h-4 w-4" aria-hidden="true" />New video</span></Link>
        </Button>
      </div>

      {/* Metrics */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {metrics.map(m => (
          <Card key={m.label} className="border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-violet-950/30">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-500">{m.label}</p>
                <p className="mt-1 text-3xl font-semibold text-zinc-100">{m.value}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400"><TrendingUp className="h-3 w-3" aria-hidden="true" />{m.delta}</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-violet-600/30 to-indigo-600/20 p-3">
                <m.icon className="h-6 w-6 text-violet-300" aria-hidden="true" />
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
          <Card className="mt-4 border-dashed border-white/15 bg-white/[0.02]">
            <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="rounded-full bg-violet-600/15 p-4"><Sparkles className="h-7 w-7 text-violet-300" aria-hidden="true" /></div>
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
              const photo = pick(p.seed);
              const meta = STATUS_META[p.status];
              const Icon = meta.icon;
              return (
                <Card key={p.id} className="group overflow-hidden border-white/10 bg-white/[0.03] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-950/40">
                  <div className="relative aspect-video overflow-hidden">
                    <img src={photo.url} alt={p.title} loading="lazy" className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden="true" />
                    <Badge className={`absolute left-3 top-3 gap-1.5 border backdrop-blur ${meta.tone}`}>
                      <Icon className={`h-3 w-3 ${p.status === "Generating" ? "animate-spin" : ""}`} aria-hidden="true" />{meta.label}
                    </Badge>
                    {p.status === "Completed" && (
                      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/90 shadow-lg"><Play className="h-5 w-5 text-white" aria-hidden="true" /></span>
                      </span>
                    )}
                    <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-1.5 py-0.5 text-xs tabular-nums text-zinc-200">{p.duration}</span>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="truncate font-medium text-zinc-100">{p.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500"><Clock className="h-3 w-3" aria-hidden="true" />{p.updated}</p>
                    <Button asChild variant="outline" size="sm" className="mt-3 w-full rounded-full border-white/15 bg-transparent text-zinc-200 hover:bg-white/10">
                      <Link to="/create">{p.status === "Draft" ? "Continue editing" : "Open project"}</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-[11px] text-zinc-600">Project thumbnails: real photography from Pexels photographers.</p>
    </div>
  );
};

export default Dashboard;
