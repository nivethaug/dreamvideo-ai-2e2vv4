import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Wand2, Paperclip, Loader2,
  Search, AlertTriangle, Film, Clock, Camera, Sparkles, Send, X, ImageOff,
  Download, CheckCircle2, RefreshCw, ChevronDown, Layers, Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { api } from "@/services/database";

interface MediaItem { id: number; url: string; preview: string; duration: number; attribution: string; pexels_url: string }
interface ModelInfo { id: string; name: string; context_length: number | null; duration_min: number; duration_max: number }
interface SceneRec {
  id: number; position: number; heading: string; duration: number;
  visual_prompt: string; voiceover: string; search_query: string;
  media_url: string | null; media_attribution: string | null;
}
interface JobInfo { id: number; status: string; provider_url: string | null; error: string | null; expires_at: string | null }

const STYLES = ["Cinematic 2.39:1", "Documentary", "Social Vertical", "Minimal Titles"];

const SUGGESTED_COMMANDS = [
  "Make this scene slower and darker",
  "Rewrite narration in a warmer tone",
  "Make the visual more energetic",
  "Tighten the search query to aerial footage",
];

const MAX_COMMAND = 300;

const DEFAULT_MODEL = "openai/gpt-4o-mini";

const urlExpired = (iso: string | null): boolean => !!iso && new Date(iso).getTime() < Date.now();

const providerOf = (id: string) => {
  const p = id.includes("/") ? id.split("/")[0] : "other";
  return p.charAt(0).toUpperCase() + p.slice(1);
};

const Createvideo = () => {
  const location = useLocation() as { state?: { projectId?: number } };
  const [projectId, setProjectId] = useState<number | null>(location.state?.projectId ?? null);
  const [title, setTitle] = useState("Untitled teaser");
  const [idea, setIdea] = useState("A cinematic teaser about a lighthouse keeper who receives a signal from deep space.");
  const [style, setStyle] = useState(STYLES[0]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(8);
  const [tab, setTab] = useState<"script" | "scenes" | "voice">("scenes");
  const [scenes, setScenes] = useState<SceneRec[]>([]);
  const [command, setCommand] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [results, setResults] = useState<MediaItem[]>([]);
  const [preview, setPreview] = useState<{ item: MediaItem; sceneId: number } | null>(null);
  const [scriptBusy, setScriptBusy] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [job, setJob] = useState<JobInfo | null>(null);
  const [jobBusy, setJobBusy] = useState(false);
  const [editState, setEditState] = useState<{ sceneId: number; phase: "editing"; original: SceneRec } | { sceneId: number; phase: "updated"; original: SceneRec } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSceneId, setEditSceneId] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const selectedModel = models.find(m => m.id === model);
  // Platform supports 5–10 seconds; clamp any model range into that window
  const durMin = Math.max(5, selectedModel?.duration_min ?? 5);
  const durMax = Math.min(10, Math.max(durMin, selectedModel?.duration_max ?? 10));

  // clamp duration whenever model range changes
  useEffect(() => {
    setDuration(d => Math.max(durMin, Math.min(durMax, d)));
  }, [durMin, durMax]);

  // close custom model dropdown on outside click
  useEffect(() => {
    if (!modelOpen) return;
    const onDown = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) setModelOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [modelOpen]);

  // real model discovery (requires saved OpenRouter key)
  useEffect(() => {
    let alive = true;
    (async () => {
      setModelsLoading(true);
      const res = await api.get<{ models: ModelInfo[]; note?: string }>("/api/v1/videos/models");
      if (!alive) return;
      setModelsLoading(false);
      if (res.success && res.data?.models?.length) {
        setModels(res.data.models);
        setModelsError(res.data.note || null);
      } else {
        setModels([]);
        setModelsError(res.error || "No models available. Save your OpenRouter key in Settings first.");
      }
    })();
    return () => { alive = false; };
  }, []);

  // open project from dashboard
  useEffect(() => {
    const pid = location.state?.projectId;
    if (!pid) return;
    (async () => {
      const res = await api.get<Record<string, unknown>>(`/api/v1/videos/projects/${pid}`);
      if (res.success && res.data) {
        const p = res.data as unknown as { id: number; title: string; idea: string; model: string | null; duration: number | null; scenes: SceneRec[]; jobs: JobInfo[] };
        setProjectId(p.id);
        setTitle(p.title);
        setIdea(p.idea);
        if (p.model) setModel(p.model);
        if (p.duration) setDuration(p.duration);
        setScenes(p.scenes ?? []);
        const last = p.jobs?.[0];
        if (last) {
          setJob(last);
          if (last.status === "Queued" || last.status === "Processing") startPolling(last.id);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        if (!(res.data.videos ?? []).length) setMediaError(`No results for “${q}”. Try another term.`);
      } else {
        setResults([]);
        setMediaError(res.error || "Pexels search failed.");
      }
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [mediaQuery]);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

  const totalTime = useMemo(() => scenes.reduce((a, s) => a + s.duration, 0), [scenes]);

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

  const generateScript = async () => {
    setScriptBusy(true);
    setScriptError(null);
    const res = await api.post<Record<string, unknown>>("/api/v1/videos/generate-script", { idea, model, duration });
    setScriptBusy(false);
    if (!res.success || !res.data) {
      setScriptError(res.error || "Script generation failed. Check your OpenRouter key in Settings.");
      return;
    }
    const p = res.data as unknown as { id: number; title: string; scenes: SceneRec[] };
    setProjectId(p.id);
    setTitle(p.title);
    setScenes(p.scenes ?? []);
    setJob(null);
    setTab("scenes");
  };

  const attachMedia = async (item: MediaItem, sceneId: number) => {
    // optimistic update, then persist
    setScenes(prev => prev.map(s => (s.id === sceneId ? { ...s, media_url: item.url, media_attribution: item.attribution } : s)));
    setPreview(null);
    const res = await api.put(`/api/v1/videos/scenes/${sceneId}`, { media_url: item.url, media_attribution: item.attribution });
    if (!res.success) setScriptError(res.error || "Could not attach media to the scene.");
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sceneId = editSceneId ?? scenes[0]?.id;
    const instr = command.trim();
    if (!sceneId || instr.length < 3) {
      setEditError("Pick a scene and describe the change.");
      return;
    }
    const original = scenes.find(s => s.id === sceneId)!;
    setEditError(null);
    setEditState({ sceneId, phase: "editing", original });
    const res = await api.post<{ updated: SceneRec }>(`/api/v1/videos/scenes/${sceneId}/edit`, { instruction: instr });
    if (!res.success || !res.data?.updated) {
      setEditState(null);
      setEditError(res.error || "AI edit failed.");
      return;
    }
    const updated = res.data.updated;
    setScenes(prev => prev.map(s => (s.id === sceneId ? { ...s, ...updated } : s)));
    setEditState({ sceneId, phase: "updated", original });
    setCommand("");
    setTimeout(() => setEditState(null), 6000);
  };

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
    if (!projectId) {
      setScriptError("Generate the script first — there's no project to render yet.");
      return;
    }
    setJobBusy(true);
    setScriptError(null);
    const res = await api.post<JobInfo>("/api/v1/videos", { project_id: projectId, model, duration });
    if (!res.success || !res.data) {
      setJobBusy(false);
      setScriptError(res.error || "Could not submit the video job.");
      return;
    }
    setJob(res.data);
    startPolling(res.data.id);
  };

  const editing = editState?.phase === "editing";
  const canvasScene = scenes.find(s => s.media_url) ?? scenes[0];
  const videoLive = job?.status === "Completed" && job.provider_url && !urlExpired(job.expires_at);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-8 md:px-8 md:py-10" data-testid="create-page">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-400/80">Create / Edit</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={scriptBusy} onClick={generateScript} className="gap-2 rounded-full border-white/15 bg-transparent text-zinc-200 hover:bg-white/10" data-testid="create-generate-script-button">
            <span className="flex items-center gap-2">{scriptBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}{scenes.length ? "Regenerate script" : "Generate script"}</span>
          </Button>
          <Button className="gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/40 hover:from-violet-500 hover:to-indigo-500" onClick={generateVideo} disabled={jobBusy || !projectId} data-testid="create-generate-video-button">
            <span className="flex items-center gap-2">{jobBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}{job && job.status === "Completed" ? "Regenerate video" : "Generate video"}</span>
          </Button>
        </div>
      </div>

      {scriptError && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{scriptError}{!models.length && " — "}
            {!models.length && <Link className="underline" to="/settings">go to Settings to connect your OpenRouter key</Link>}
          </span>
        </div>
      )}

      {/* Idea + Model/Style cards + Duration */}
      <Card className="mt-6 border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <CardContent className="space-y-6 p-5 md:p-6">
          <div className="space-y-2">
            <Label htmlFor="idea" className="text-sm font-medium text-zinc-300">Your idea</Label>
            <textarea
              id="idea"
              aria-label="Your video idea"
              data-testid="create-idea-input"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={3}
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
                    {modelsLoading ? "Loading models…" : selectedModel ? selectedModel.name : model}
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
              <p className="text-[10px] text-zinc-600">Visual treatment applied across all scenes.</p>
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
        </CardContent>
      </Card>

      {/* Main two-column layout: creation (left) + Edit with AI (right, sticky) */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,65fr)_minmax(300px,35fr)]">
        {/* LEFT — creation */}
        <div className="min-w-0">
          {/* Canvas */}
          <Card className="overflow-hidden border-white/10 bg-black shadow-xl shadow-black/30">
            <div className="relative aspect-video" data-testid="create-canvas">
              {videoLive ? (
                <video src={job!.provider_url!} controls playsInline className="h-full w-full bg-black" aria-label="Generated video preview" />
              ) : canvasScene?.media_url ? (
                <video src={canvasScene.media_url} muted loop autoPlay playsInline className="h-full w-full object-cover opacity-80" aria-label="Scene media preview" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#0b0b18] text-zinc-500">
                  {jobBusy ? <><Loader2 className="h-8 w-8 animate-spin text-violet-400" aria-hidden="true" /><p className="text-sm">{job?.status ?? "Queued"}…</p></>
                    : job?.status === "Failed" ? <><AlertTriangle className="h-8 w-8 text-red-400" aria-hidden="true" /><p className="max-w-md px-6 text-center text-sm">{job.error}</p></>
                    : <><Film className="h-8 w-8" aria-hidden="true" /><p className="text-sm">Generate a script, attach media, then render.</p></>}
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
            {jobBusy && (
              <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3 text-sm text-zinc-300" aria-live="polite" data-testid="create-job-status">
                <Loader2 className="h-4 w-4 animate-spin text-violet-400" aria-hidden="true" />
                Job #{job?.id} — {job?.status}
              </div>
            )}
          </Card>

          {/* Tabs */}
          <div className="mt-6" role="tablist" aria-label="Editor tabs">
            <div className="flex gap-1 border-b border-white/10">
              {(["script", "scenes", "voice"] as const).map(t => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm capitalize transition-colors ${tab === t ? "border-violet-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="pt-5" aria-live="polite">
              {tab === "script" && (
                <div className="space-y-4">
                  {scenes.length === 0 ? (
                    <p className="text-sm text-zinc-500">No script yet — enter an idea and click “Generate script”.</p>
                  ) : (
                    <div className="space-y-3">
                      {scenes.map((s, i) => (
                        <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:border-violet-500/20">
                          <p className="text-xs font-medium uppercase tracking-wider text-violet-400/80">Scene {i + 1} · {s.heading}</p>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{s.voiceover}</p>
                          <p className="mt-1 text-xs italic text-zinc-500">{s.visual_prompt}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {tab === "scenes" && (
                scenes.length === 0 ? (
                  <p className="text-sm text-zinc-500">No scenes yet — generate the script first.</p>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-3">
                    {scenes.map((s, idx) => (
                      <div key={s.id} className="w-56 shrink-0">
                        <button className="group relative block w-full overflow-hidden rounded-xl border border-white/10 transition-shadow hover:shadow-lg hover:shadow-violet-950/40" aria-label={`Scene ${idx + 1} media`} onClick={() => setMediaQuery(s.search_query || s.heading)}>
                          {s.media_url ? (
                            <video src={s.media_url} muted playsInline className="aspect-video w-full object-cover opacity-90" />
                          ) : (
                            <div className="flex aspect-video w-full items-center justify-center bg-[#12101d] text-zinc-600"><ImageOff className="h-5 w-5" aria-hidden="true" /></div>
                          )}
                          {s.media_url && <Badge className="absolute right-2 top-2 gap-1 border-emerald-500/30 bg-emerald-500/20 text-emerald-300"><Paperclip className="h-3 w-3" aria-hidden="true" />Media</Badge>}
                          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-200"><Clock className="mr-1 inline h-3 w-3" aria-hidden="true" />{s.duration}s</span>
                        </button>
                        <p className="mt-2 line-clamp-2 text-xs text-zinc-300">{s.voiceover}</p>
                        <p className="mt-1 line-clamp-1 text-[11px] italic text-zinc-500">{s.visual_prompt}</p>
                        <button onClick={() => setEditSceneId(s.id)} className={`mt-2 w-full rounded-full border px-2 py-1 text-[11px] transition-colors ${editSceneId === s.id ? "border-violet-500/60 bg-violet-600/20 text-violet-200" : "border-white/10 text-zinc-400 hover:border-violet-500/30 hover:text-zinc-200"}`} aria-pressed={editSceneId === s.id}>
                          {editSceneId === s.id ? "Selected for AI edit" : `Select for AI edit`}
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
              {tab === "voice" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Documentary Calm", "Studio Warm", "High Energy"].map(v => (
                    <Card key={v} className="border-white/10 bg-white/[0.03] transition-all duration-300 hover:shadow-lg hover:shadow-violet-950/30">
                      <CardContent className="p-4">
                        <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-violet-400" aria-hidden="true" />{v}</p>
                        <p className="mt-1 text-xs text-zinc-500">Voiceover text is generated per scene by OpenRouter; TTS playback requires a voice provider.</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Media library */}
          <Card className="mt-8 border-white/10 bg-white/[0.03] backdrop-blur-xl" data-testid="create-media-section">
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
                    <button key={item.id} className="group overflow-hidden rounded-xl border border-white/10 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-950/40" onClick={() => setPreview({ item, sceneId: editSceneId ?? scenes[0]?.id ?? 0 })}>
                      <img src={item.preview} alt={item.attribution} loading="lazy" className="aspect-video w-full object-cover" />
                      <div className="flex items-center justify-between p-2">
                        <span className="truncate text-[11px] text-zinc-400"><Camera className="mr-1 inline h-3 w-3" aria-hidden="true" />{item.attribution}</span>
                        <Badge variant="outline" className="border-white/10 text-[10px] text-zinc-300">{item.duration}s</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-zinc-600">Stock videos from Pexels — search, preview and attach to scenes. Attribution kept automatically.</p>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Edit with AI (sticky, premium) */}
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden border-violet-500/20 bg-gradient-to-b from-violet-950/30 via-[#0d0b1a] to-indigo-950/20 shadow-xl shadow-violet-950/20 backdrop-blur-xl" data-testid="create-edit-panel">
            <div className="flex items-center gap-2.5 border-b border-violet-500/20 bg-violet-600/10 px-5 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-950/50">
                <Wand2 className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Edit with AI</h2>
                <p className="text-[11px] text-zinc-500">Refine any scene with natural language</p>
              </div>
            </div>
            <CardContent className="space-y-5 p-5">
              {/* Scene selector */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-scene" className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Scene</Label>
                <div className="relative">
                  <select id="edit-scene" aria-label="Scene to edit" data-testid="create-edit-scene-select" value={editSceneId ?? scenes[0]?.id ?? ""} onChange={e => setEditSceneId(Number(e.target.value))} className="h-10 w-full appearance-none rounded-xl border border-white/10 bg-black/40 px-3 pr-9 text-xs text-zinc-200 outline-none transition-colors hover:border-violet-500/40 focus:border-violet-500/60 disabled:opacity-50" disabled={scenes.length === 0}>
                    {scenes.length === 0 && <option value="">No scenes yet</option>}
                    {scenes.map((s, i) => <option key={s.id} value={s.id}>Scene {i + 1} — {s.heading.slice(0, 28)}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                </div>
                {scenes.length === 0 && <p className="text-[11px] text-zinc-500">Generate the script to enable AI editing.</p>}
              </div>

              {/* Quick actions — 2 columns */}
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Quick actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {SUGGESTED_COMMANDS.map(c => (
                    <button key={c} onClick={() => setCommand(c)} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-left text-[11px] leading-snug text-zinc-300 transition-all hover:border-violet-500/40 hover:bg-violet-600/10 hover:text-zinc-100">
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instruction + Apply */}
              <form className="space-y-2" onSubmit={submitEdit}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-command" className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Instruction</Label>
                  <span className={`text-[10px] tabular-nums ${command.length > MAX_COMMAND - 40 ? "text-amber-400" : "text-zinc-600"}`} aria-live="polite">{command.length}/{MAX_COMMAND}</span>
                </div>
                <textarea
                  id="edit-command"
                  aria-label="AI edit instruction"
                  data-testid="create-edit-command-input"
                  value={command}
                  onChange={e => setCommand(e.target.value.slice(0, MAX_COMMAND))}
                  maxLength={MAX_COMMAND}
                  rows={3}
                  placeholder="Describe the change, e.g. “make the ending more hopeful”…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/40 p-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
                />
                <Button type="submit" disabled={editing || scenes.length === 0} data-testid="create-edit-submit" className="w-full gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/40 hover:from-violet-500 hover:to-indigo-500">
                  {editing ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Applying…</> : <><Send className="h-4 w-4" aria-hidden="true" />Apply AI edits</>}
                </Button>
              </form>

              {editError && <p className="text-xs text-red-400" role="alert">{editError}</p>}
              {editState && (
                <div className="space-y-2 rounded-xl border border-violet-500/30 bg-black/40 p-3.5 text-xs" aria-live="polite" data-testid="create-edit-status">
                  {editState.phase === "editing" ? (
                    <p className="flex items-center gap-2 text-violet-300"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Editing via OpenRouter…</p>
                  ) : (
                    <p className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Scene updated</p>
                  )}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Original</p>
                    <p className="line-clamp-2 text-zinc-400">{editState.original.voiceover}</p>
                    {editState.phase === "updated" && scenes.find(s => s.id === editState.sceneId) && (
                      <>
                        <p className="mt-2 text-[10px] uppercase tracking-wider text-emerald-500/70">Updated</p>
                        <p className="line-clamp-2 text-zinc-100">{scenes.find(s => s.id === editState.sceneId)!.voiceover}</p>
                      </>
                    )}
                  </div>
                </div>
              )}
              {job?.status === "Completed" && (
                <p className="text-[11px] text-zinc-500 flex items-center gap-1.5"><RefreshCw className="h-3 w-3" aria-hidden="true" />Use “Regenerate video” to re-render after edits.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent role="dialog" aria-label="Media preview" className="max-w-2xl border-white/10 bg-[#0b0b18]">
          {preview && (
            <>
              <DialogHeader className="flex-row items-center justify-between">
                <DialogTitle className="text-sm">Pexels stock video · {preview.item.duration}s</DialogTitle>
                <button aria-label="Close preview" onClick={() => setPreview(null)} className="rounded-full p-1.5 hover:bg-white/10"><X className="h-4 w-4" aria-hidden="true" /></button>
              </DialogHeader>
              <video src={preview.item.url} poster={preview.item.preview} controls playsInline className="w-full rounded-lg bg-black" aria-label="Stock video preview" />
              <p className="text-xs text-zinc-500">{preview.item.attribution} · <a href={preview.item.pexels_url} target="_blank" rel="noreferrer" className="underline hover:text-zinc-300">View on Pexels</a></p>
              <div className="flex items-center gap-2">
                <Label htmlFor="attach-scene" className="text-xs">Attach to</Label>
                <select id="attach-scene" aria-label="Attach to scene" value={preview.sceneId} onChange={e => setPreview({ ...preview, sceneId: Number(e.target.value) })} className="h-9 flex-1 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200">
                  {scenes.map((s, i) => <option key={s.id} value={s.id}>Scene {i + 1}</option>)}
                </select>
                <Button onClick={() => attachMedia(preview.item, preview.sceneId)} disabled={!preview.sceneId} data-testid="create-attach-media-button" className="bg-violet-600 text-white hover:bg-violet-500">Use in Scene</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <p className="sr-only">Total storyboard duration {totalTime} seconds</p>
    </div>
  );
};

export default Createvideo;
