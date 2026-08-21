import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/services/database";
import {
  Wand2, Loader2, Search, AlertTriangle, Film, Clock, Camera,
  ChevronDown, Layers, Palette, Download, X, ImageOff,
} from "lucide-react";

interface ModelInfo {
  id: string;
  name: string;
  context_length?: number | null;
  pricing?: Record<string, string> | null;
  duration_min?: number;
  duration_max?: number;
}

interface MediaItem {
  id: number;
  preview: string;
  url: string;
  attribution: string;
  duration: number;
  pexels_url: string;
}

interface JobInfo {
  id: number;
  status: "Queued" | "Processing" | "Completed" | "Failed";
  provider_url?: string | null;
  error?: string | null;
  expires_at?: string | null;
}

const DEFAULT_MODEL = "google/veo-3.1";
const STYLES = ["Cinematic", "Documentary", "Vibrant", "Noir", "Minimal"];

const providerOf = (id: string) => {
  const p = id.split("/")[0] ?? "other";
  return p.charAt(0).toUpperCase() + p.slice(1);
};

const urlExpired = (iso?: string | null) => {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
};

const Createvideo = () => {
  const [idea, setIdea] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [style, setStyle] = useState(STYLES[0]);
  const [duration, setDuration] = useState(8);
  const [durMin, setDurMin] = useState(5);
  const [durMax, setDurMax] = useState(10);

  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const [mediaQuery, setMediaQuery] = useState("");
  const [results, setResults] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);

  const [projectId, setProjectId] = useState<number | null>(null);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [jobBusy, setJobBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // close model dropdown on outside click / Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModelOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, []);

  // fetch video models
  useEffect(() => {
    (async () => {
      const res = await api.get<{ models: ModelInfo[]; note?: string | null }>("/api/v1/videos/models");
      setModelsLoading(false);
      if (res.success && res.data) {
        setModels(res.data.models ?? []);
        if (res.data.models?.length) {
          const first = res.data.models[0];
          setModel(first.id);
          setDurMin(Math.max(5, first.duration_min ?? 5));
          setDurMax(Math.min(10, Math.max(5, first.duration_max ?? 10)));
        }
        if (res.data.note) setModelsError(res.data.note);
      } else {
        setModelsError(res.error || "Could not load models. Check your OpenRouter key in Settings.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // clamp duration into model range
  useEffect(() => {
    if (duration < durMin) setDuration(durMin);
    if (duration > durMax) setDuration(durMax);
  }, [durMin, durMax, duration]);

  // real Pexels video search (debounced, server proxy)
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const q = mediaQuery.trim();
      if (!q) { setResults([]); setMediaError(null); setMediaLoading(false); return; }
      setMediaLoading(true);
      setMediaError(null);
      const res = await api.get<{ videos: MediaItem[] }>("/api/media/search", { q, per_page: 12 });
      if (!alive) return;
      setMediaLoading(false);
      if (res.success && res.data) {
        setResults(res.data.videos ?? []);
        if (!(res.data.videos ?? []).length) setMediaError(`No results for "${q}". Try another term.`);
      } else {
        setResults([]);
        setMediaError(res.error || "Pexels search failed.");
      }
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [mediaQuery]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  // model dropdown grouping (searchable, provider-grouped)
  const modelGroups = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    const list = models.filter(m =>
      !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    );
    const groups = new Map<string, ModelInfo[]>();
    for (const m of list) {
      const g = providerOf(m.id);
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(m);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [models, modelSearch]);

  const startPolling = (jobId: number) => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(async () => {
      const res = await api.get<JobInfo>(`/api/v1/videos/jobs/${jobId}`);
      if (res.success && res.data) {
        setJob(res.data);
        if (res.data.status === "Completed" || res.data.status === "Failed") {
          if (pollRef.current) window.clearInterval(pollRef.current);
          setJobBusy(false);
        }
      }
    }, 3000);
  };

  const generateVideo = async () => {
    if (!idea.trim()) {
      setError("Describe your idea first.");
      return;
    }
    setJobBusy(true);
    setError(null);
    try {
      let pid = projectId;
      if (!pid) {
        const p = await api.post<{ id: number }>("/api/v1/videos/projects", {
          title: idea.trim().slice(0, 60),
          idea: idea.trim(),
        });
        if (!p.success || !p.data?.id) {
          setError(p.error || "Could not create the project.");
          return;
        }
        pid = p.data.id;
        setProjectId(pid);
      }
      const res = await api.post<JobInfo>("/api/v1/videos", { project_id: pid, model, duration });
      if (!res.success || !res.data) {
        setError(res.error || "Could not submit the video job.");
        return;
      }
      setJob(res.data);
      startPolling(res.data.id);
    } finally {
      setJobBusy(false);
    }
  };

  const videoLive = job?.status === "Completed" && job.provider_url && !urlExpired(job.expires_at);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8 md:py-10" data-testid="create-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-400/80">Create</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Create a video</h1>
        </div>
        <Button
          className="gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/40 hover:from-violet-500 hover:to-indigo-500"
          onClick={generateVideo}
          disabled={jobBusy}
          data-testid="create-generate-video-button"
        >
          <span className="flex items-center gap-2">
            {jobBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
            {job?.status === "Completed" ? "Regenerate video" : "Generate video"}
          </span>
        </Button>
      </div>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}{!models.length && " — "}
            {!models.length && <Link className="underline" to="/settings">go to Settings to connect your OpenRouter key</Link>}
          </span>
        </div>
      )}

      {/* Two-column: creation (left) + video preview (right) */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,65fr)_minmax(320px,35fr)]">
        {/* LEFT — creation controls */}
        <div className="min-w-0">
          <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <CardContent className="space-y-6 p-5 md:p-6">
              <div className="space-y-2">
                <Label htmlFor="idea" className="text-sm font-medium text-zinc-300">Your idea</Label>
                <textarea
                  id="idea"
                  aria-label="Your video idea"
                  data-testid="create-idea-input"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  rows={4}
                  placeholder="Describe the video you want, e.g. “a cinematic drone shot over Tokyo at night, neon reflections in the rain”…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3.5 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                />
              </div>

              {/* Model + Style — equal side-by-side dropdown cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Model card with custom dropdown */}
                <div className="space-y-2" ref={modelMenuRef} data-testid="create-model-card">
                  <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
                    <Layers className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />Model
                  </Label>
                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={modelOpen}
                      aria-label="Select model"
                      data-testid="create-model-select"
                      onClick={() => { setModelOpen(o => !o); setModelSearch(""); }}
                      disabled={modelsLoading}
                      className={`flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-black/40 px-3.5 text-left text-sm transition-colors disabled:opacity-60 ${modelOpen ? "border-violet-500/60 ring-1 ring-violet-500/30" : "border-white/10 hover:border-violet-500/40"}`}
                    >
                      <span className="truncate text-zinc-100">
                        {modelsLoading ? "Loading models…" : models.find(m => m.id === model)?.name ?? model}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${modelOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>
                    {modelOpen && (
                      <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0d0b1a] shadow-2xl shadow-black/60" role="listbox" aria-label="Model list" data-testid="create-model-menu">
                        <div className="border-b border-white/10 p-2.5">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                            <input
                              aria-label="Search models"
                              data-testid="create-model-search"
                              value={modelSearch}
                              onChange={(e) => setModelSearch(e.target.value)}
                              placeholder="Search models…"
                              className="h-9 w-full rounded-lg border border-white/10 bg-black/50 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-violet-500/50"
                            />
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto py-1.5">
                          {modelGroups.length === 0 ? (
                            <p className="px-4 py-6 text-center text-xs text-zinc-500">No matching models.</p>
                          ) : modelGroups.map(([provider, list]) => (
                            <div key={provider}>
                              <p className="sticky top-0 bg-[#0d0b1a] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-violet-400/70">{provider}</p>
                              {list.map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  role="option"
                                  aria-selected={m.id === model}
                                  onClick={() => { setModel(m.id); setModelOpen(false); }}
                                  className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-xs transition-colors ${m.id === model ? "bg-violet-600/20 text-violet-100" : "text-zinc-300 hover:bg-white/5"}`}
                                >
                                  <span className="truncate">{m.name}</span>
                                  {m.id === model && <Badge className="shrink-0 border-violet-500/40 bg-violet-600/30 text-[9px] text-violet-200">Selected</Badge>}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {modelsError && <p className="text-[10px] leading-snug text-amber-400">{modelsError}</p>}
                </div>

                {/* Style card */}
                <div className="space-y-2" data-testid="create-style-card">
                  <Label htmlFor="style" className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
                    <Palette className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />Style
                  </Label>
                  <div className="relative">
                    <select
                      id="style"
                      aria-label="Style"
                      data-testid="create-style-select"
                      value={style}
                      onChange={e => setStyle(e.target.value)}
                      className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3.5 pr-9 text-sm text-zinc-100 outline-none transition-colors hover:border-violet-500/40 focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
                    >
                      {STYLES.map(s => <option key={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                  </div>
                  <p className="text-[10px] text-zinc-600">Visual treatment applied to the video.</p>
                </div>
              </div>

              {/* Duration */}
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Label htmlFor="dur" className="text-xs font-medium uppercase tracking-wider text-zinc-400">Duration</Label>
                  <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-200" data-testid="create-duration-value">{duration}s</span>
                </div>
                <Slider
                  id="dur"
                  aria-label="Video duration in seconds"
                  data-testid="create-duration-slider"
                  min={durMin}
                  max={durMax}
                  step={1}
                  value={[duration]}
                  onValueChange={(v) => setDuration(v[0] ?? duration)}
                  className="py-1 [&_[data-slot=slider-range]]:bg-gradient-to-r [&_[data-slot=slider-range]]:from-indigo-500 [&_[data-slot=slider-range]]:to-purple-600"
                />
                <div className="mt-1 flex justify-between text-[10px] text-zinc-500" aria-hidden="true">
                  <span>{durMin}s</span><span>{durMax}s</span>
                </div>
              </div>

              {/* Primary CTA (also in header on desktop scrolling) */}
              <Button
                onClick={generateVideo}
                disabled={jobBusy}
                data-testid="create-generate-video-button-main"
                className="w-full gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-5 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 hover:from-violet-500 hover:to-indigo-500"
              >
                {jobBusy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Generating…</> : <><Wand2 className="h-4 w-4" aria-hidden="true" />Generate Video</>}
              </Button>
            </CardContent>
          </Card>

          {/* Media library */}
          <Card className="mt-6 border-white/10 bg-white/[0.03] backdrop-blur-xl" data-testid="create-media-section">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold"><Film className="h-4 w-4 text-violet-400" aria-hidden="true" />Pexels media library</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                  <Input aria-label="Search media" data-testid="create-media-search" placeholder="Search stock footage…" value={mediaQuery} onChange={e => setMediaQuery(e.target.value)} className="rounded-full border-white/10 bg-black/40 pl-9 text-sm" />
                </div>
              </div>

              {mediaQuery.trim() === "" ? (
                <p className="py-10 text-center text-sm text-zinc-500" aria-live="polite">Type to search real stock videos from Pexels.</p>
              ) : mediaLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-400" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" aria-hidden="true" />Searching Pexels…
                </div>
              ) : mediaError ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center" role="alert">
                  {mediaError.startsWith("No results") ? <ImageOff className="h-6 w-6 text-zinc-500" aria-hidden="true" /> : <AlertTriangle className="h-6 w-6 text-amber-400" aria-hidden="true" />}
                  <p className="text-sm text-zinc-400">{mediaError}</p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-live="polite">
                  {results.map(item => (
                    <button key={item.id} className="group overflow-hidden rounded-xl border border-white/10 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-950/40" onClick={() => setPreview(item)} aria-label={`Preview ${item.attribution} video`}>
                      <img src={item.preview} alt={item.attribution} loading="lazy" className="aspect-video w-full object-cover" />
                      <div className="flex items-center justify-between p-2">
                        <span className="truncate text-[11px] text-zinc-400"><Camera className="mr-1 inline h-3 w-3" aria-hidden="true" />{item.attribution}</span>
                        <Badge variant="outline" className="border-white/10 text-[10px] text-zinc-300">{item.duration}s</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-zinc-600">Stock videos from Pexels — search and preview reference footage.</p>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — video preview (sticky) */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden border-white/10 bg-black shadow-xl shadow-black/30" data-testid="create-video-panel">
            <div className="relative aspect-video" data-testid="create-canvas">
              {videoLive ? (
                <video src={job!.provider_url!} controls playsInline className="h-full w-full bg-black" aria-label="Generated video preview" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0b0b18] text-zinc-500">
                  {jobBusy ? <><Loader2 className="h-8 w-8 animate-spin text-violet-400" aria-hidden="true" /><p className="text-sm">{job?.status ?? "Queued"}…</p></>
                    : job?.status === "Failed" ? <><AlertTriangle className="h-8 w-8 text-red-400" aria-hidden="true" /><p className="max-w-md px-6 text-center text-sm">{job.error}</p></>
                    : <><Film className="h-8 w-8" aria-hidden="true" /><p className="text-sm">Your generated video will appear here.</p></>}
                </div>
              )}
              {job?.status === "Completed" && job.provider_url && urlExpired(job.expires_at) && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-zinc-200" role="alert">
                  Video link expired. Please generate the video again.
                </div>
              )}
              {videoLive && (
                <a href={job!.provider_url!} target="_blank" rel="noreferrer" className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500" data-testid="create-download-button">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />Download
                </a>
              )}
            </div>
            {(jobBusy || job) && (
              <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3 text-sm text-zinc-300" aria-live="polite" data-testid="create-job-status">
                {jobBusy && <Loader2 className="h-4 w-4 animate-spin text-violet-400" aria-hidden="true" />}
                {jobBusy ? `Job #${job?.id ?? "—"} — ${job?.status ?? "Queued"}` : job?.status === "Completed" ? "Completed" : job?.status}
                {jobBusy && <Clock className="ml-auto h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />}
              </div>
            )}
            <div className="border-t border-white/10 px-4 py-3 text-[11px] text-zinc-500">
              {models.find(m => m.id === model)?.name ?? model} · {duration}s · {style}
            </div>
          </Card>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent role="dialog" aria-label="Media preview" className="max-w-2xl border-white/10 bg-[#0b0b18]">
          {preview && (
            <>
              <DialogHeader className="flex-row items-center justify-between">
                <DialogTitle className="text-sm">Pexels stock video · {preview.duration}s</DialogTitle>
                <button aria-label="Close preview" onClick={() => setPreview(null)} className="rounded-full p-1.5 hover:bg-white/10"><X className="h-4 w-4" aria-hidden="true" /></button>
              </DialogHeader>
              <video src={preview.url} poster={preview.preview} controls playsInline className="w-full rounded-lg bg-black" aria-label="Stock video preview" />
              <p className="text-xs text-zinc-500">{preview.attribution} · <a href={preview.pexels_url} target="_blank" rel="noreferrer" className="underline hover:text-zinc-300">View on Pexels</a></p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Createvideo;
