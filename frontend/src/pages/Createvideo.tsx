import { useState, useEffect, useMemo } from "react";
import {
  Wand2, Play, Pause, Volume2, Maximize2, Paperclip, Loader2,
  Search, AlertTriangle, Film, Clock, Camera, Sparkles, Send, X, ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getByCategory, pick, type PexelsPhoto } from "@/lib/pexels";

interface Scene {
  id: string;
  photo: PexelsPhoto;
  narration: string;
  direction: string;
  seconds: number;
  mediaAttached: boolean;
}

const STYLES = ["Cinematic 2.39:1", "Documentary", "Social Vertical", "Minimal Titles"];
const MODELS = ["DreamVideo C1", "DreamVideo C1 Pro", "Storyboard-only"];
const DURATIONS = ["30s", "60s", "90s", "3min"];

const SUGGESTED_COMMANDS = [
  "Make scene 2 slower and darker",
  "Add a closing title card",
  "Rewrite narration in a warmer tone",
  "Cut scene 4 and tighten pacing",
  "Swap the opening shot for aerial footage",
];

const MEDIA_CATEGORIES = ["cinematic", "nature", "city", "ocean", "mountain", "space", "forest", "abstract", "tech", "people", "desert", "portrait"] as const;

const initialScenes = (): Scene[] => {
  const seeds = ["scene-one", "scene-two", "scene-three", "scene-four"];
  const notes = [
    ["Cold open over dark water; establish scale and silence.", "Wide, slow push-in. Desaturated grade, heavy shadows."],
    ["The city wakes — fragments of light on glass.", "Handheld feel, quick cuts, neon reflections."],
    ["A voice answers from the static: the journey begins.", "Medium close-up, shallow depth, violet rim light."],
    ["Title card. Silence. Then music.", "Cut to black, serif title, 2s hold."],
  ];
  return seeds.map((s, i) => ({
    id: s,
    photo: pick(s + i),
    narration: notes[i][0],
    direction: notes[i][1],
    seconds: [6, 8, 7, 5][i],
    mediaAttached: i === 0,
  }));
};

const Createvideo = () => {
  const [idea, setIdea] = useState("A 60-second cinematic teaser about a lighthouse keeper who receives a signal from deep space.");
  const [style, setStyle] = useState(STYLES[0]);
  const [model, setModel] = useState(MODELS[0]);
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [tab, setTab] = useState<"script" | "scenes" | "voice">("scenes");
  const [playing, setPlaying] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [command, setCommand] = useState("");
  const [mediaQuery, setMediaQuery] = useState("");
  const [mediaCategory, setMediaCategory] = useState<string>("cinematic");
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [results, setResults] = useState<PexelsPhoto[]>([]);
  const [preview, setPreview] = useState<{ photo: PexelsPhoto; sceneId: string } | null>(null);

  // Mock live-search over the verified catalog. PENDING: backend proxy for real
  // runtime Pexels search; on API error we surface an honest error, never fake results.
  useEffect(() => {
    let alive = true;
    setMediaLoading(true);
    setMediaError(null);
    const t = setTimeout(() => {
      if (!alive) return;
      let found = getByCategory(mediaCategory as never);
      if (mediaQuery.trim()) {
        const q = mediaQuery.trim().toLowerCase();
        const filtered = found.filter(p => (p.alt ?? "").toLowerCase().includes(q) || p.photographer.toLowerCase().includes(q));
        // catalog fallback across all categories when the active one has no match
        if (filtered.length === 0) {
          const all = MEDIA_CATEGORIES.flatMap(c => getByCategory(c));
          found = all.filter(p => (p.alt ?? "").toLowerCase().includes(q));
        } else found = filtered;
      }
      if (found.length === 0 && mediaQuery.trim()) setMediaError(`No results for “${mediaQuery}”. Try another term or category.`);
      setResults(found);
      setMediaLoading(false);
    }, 450);
    return () => { alive = false; clearTimeout(t); };
  }, [mediaQuery, mediaCategory]);

  const totalTime = useMemo(() => scenes.reduce((a, s) => a + s.seconds, 0), [scenes]);

  const attachToScene = (photo: PexelsPhoto, sceneId: string) => {
    setScenes(prev => prev.map(s => (s.id === sceneId ? { ...s, photo, mediaAttached: true } : s)));
    setPreview(null);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-violet-400/80">Create / Edit</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Untitled teaser</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full border-white/15 bg-transparent text-zinc-200 hover:bg-white/10">Save draft</Button>
          <Button className="gap-2 rounded-full bg-violet-600 text-white hover:bg-violet-500" onClick={() => setPlaying(false)}>
            <span className="flex items-center gap-2"><Wand2 className="h-4 w-4" aria-hidden="true" />Generate video</span>
          </Button>
        </div>
      </div>

      {/* Idea + selectors */}
      <Card className="mt-6 border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="idea">Your idea</Label>
            <textarea
              id="idea"
              aria-label="Your video idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-zinc-100 outline-none transition-colors focus:border-violet-500/50"
            />
          </div>
          <div className="grid grid-cols-3 gap-3 md:w-[420px]">
            <div className="space-y-1.5">
              <Label htmlFor="style">Style</Label>
              <select id="style" aria-label="Style" value={style} onChange={e => setStyle(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200">
                {STYLES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <select id="model" aria-label="Model" value={model} onChange={e => setModel(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200">
                {MODELS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dur">Duration</Label>
              <select id="dur" aria-label="Duration" value={duration} onChange={e => setDuration(e.target.value)} className="h-10 w-full rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200">
                {DURATIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Canvas + Edit with AI */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <Card className="overflow-hidden border-white/10 bg-black">
            <div className="relative aspect-video">
              <img src={scenes[0].photo.url} alt="Video canvas preview frame" className="h-full w-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4">
                <button aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(p => !p)} className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600/90 text-white transition-transform hover:scale-105 motion-reduce:transition-none">
                  {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
                </button>
                <div className="h-1.5 flex-1 rounded-full bg-white/20"><div className="h-full w-1/3 rounded-full bg-violet-500" /></div>
                <span className="text-xs tabular-nums text-zinc-300">0:20 / 0:45</span>
                <button aria-label="Mute" className="p-2 text-zinc-300 hover:text-white"><Volume2 className="h-4 w-4" aria-hidden="true" /></button>
                <button aria-label="Fullscreen" className="p-2 text-zinc-300 hover:text-white"><Maximize2 className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </div>
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
                  {(scenes.map(s => s.narration).join(" ") && <p className="whitespace-pre-line rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm leading-relaxed text-zinc-300">{scenes.map(s => s.narration).join(" ")}</p>)}
                  <p className="text-xs text-zinc-500">PENDING: AI script regeneration will be wired to a backend endpoint.</p>
                </div>
              )}
              {tab === "scenes" && (
                <div className="flex gap-4 overflow-x-auto pb-3">
                  {scenes.map((s, idx) => (
                    <div key={s.id} className="w-56 shrink-0">
                      <button className="group relative block w-full overflow-hidden rounded-xl border border-white/10" aria-label={`Preview scene ${idx + 1}`} onClick={() => setPreview({ photo: s.photo, sceneId: s.id })}>
                        <img src={s.photo.url} alt={`Scene ${idx + 1}`} loading="lazy" className="aspect-video w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
                        {s.mediaAttached && <Badge className="absolute right-2 top-2 gap-1 border-emerald-500/30 bg-emerald-500/20 text-emerald-300"><Paperclip className="h-3 w-3" aria-hidden="true" />Media</Badge>}
                        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums text-zinc-200"><Clock className="mr-1 inline h-3 w-3" aria-hidden="true" />{s.seconds}s</span>
                      </button>
                      <p className="mt-2 line-clamp-2 text-xs text-zinc-300">{s.narration}</p>
                      <p className="mt-1 line-clamp-1 text-[11px] italic text-zinc-500">{s.direction}</p>
                    </div>
                  ))}
                </div>
              )}
              {tab === "voice" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Documentary Calm", "Studio Warm", "High Energy"].map(v => (
                    <Card key={v} className="border-white/10 bg-white/[0.03] transition-all duration-300 hover:shadow-lg hover:shadow-violet-950/30">
                      <CardContent className="p-4">
                        <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-violet-400" aria-hidden="true" />{v}</p>
                        <p className="mt-1 text-xs text-zinc-500">Preview unavailable until generation is wired.</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Media library */}
          <Card className="mt-8 border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold"><Film className="h-4 w-4 text-violet-400" aria-hidden="true" />Pexels media library</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden="true" />
                  <Input aria-label="Search media" placeholder="Search footage…" value={mediaQuery} onChange={e => setMediaQuery(e.target.value)} className="rounded-full border-white/10 bg-black/40 pl-9 text-sm" />
                </div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {MEDIA_CATEGORIES.map(c => (
                  <button key={c} onClick={() => setMediaCategory(c)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs capitalize transition-colors ${mediaCategory === c && !mediaQuery ? "border-violet-500/50 bg-violet-600/20 text-violet-200" : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}>
                    {c}
                  </button>
                ))}
              </div>

              {mediaLoading ? (
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
                  {results.map((p, i) => (
                    <button key={p.url + i} className="group overflow-hidden rounded-xl border border-white/10 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-950/40" onClick={() => setPreview({ photo: p, sceneId: scenes[0].id })}>
                      <img src={p.url} alt={p.alt} loading="lazy" className="aspect-video w-full object-cover" />
                      <div className="flex items-center justify-between p-2">
                        <span className="truncate text-[11px] text-zinc-400"><Camera className="mr-1 inline h-3 w-3" aria-hidden="true" />{p.photographer}</span>
                        <Badge variant="outline" className="border-white/10 text-[10px] text-zinc-300">Scene</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-zinc-600">Photos from Pexels. PENDING: live video thumbnails + durations via backend proxy.</p>
            </CardContent>
          </Card>
        </div>

        {/* Edit with AI panel */}
        <Card className="h-fit border-violet-500/20 bg-gradient-to-b from-violet-950/30 to-indigo-950/20 backdrop-blur-xl lg:sticky lg:top-24">
          <CardContent className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold"><Wand2 className="h-4 w-4 text-violet-400" aria-hidden="true" />Edit with AI</h2>
            <div className="space-y-2">
              {SUGGESTED_COMMANDS.map(c => (
                <button key={c} onClick={() => setCommand(c)} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-left text-xs text-zinc-300 transition-colors hover:border-violet-500/40 hover:text-zinc-100">
                  “{c}”
                </button>
              ))}
            </div>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); }}>
              <Input aria-label="AI edit command" value={command} onChange={e => setCommand(e.target.value)} placeholder="Tell the AI what to change…" className="border-white/10 bg-black/40 text-sm" />
              <Button type="submit" aria-label="Send command" className="shrink-0 bg-violet-600 text-white hover:bg-violet-500"><Send className="h-4 w-4" aria-hidden="true" /></Button>
            </form>
            <p className="text-[11px] text-zinc-500">PENDING: AI editing is UI-only — no command is executed yet (no fake success states).</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview dialog */}
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent role="dialog" aria-label="Media preview" className="max-w-2xl border-white/10 bg-[#0b0b18]">
          {preview && (
            <>
              <DialogHeader className="flex-row items-center justify-between">
                <DialogTitle className="text-sm">{preview.photo.alt}</DialogTitle>
                <button aria-label="Close preview" onClick={() => setPreview(null)} className="rounded-full p-1.5 hover:bg-white/10"><X className="h-4 w-4" aria-hidden="true" /></button>
              </DialogHeader>
              <img src={preview.photo.url} alt={preview.photo.alt} className="w-full rounded-lg" />
              <p className="text-xs text-zinc-500">Photo by {preview.photo.photographer} · Pexels</p>
              <div className="flex items-center gap-2">
                <Label htmlFor="attach-scene" className="text-xs">Attach to</Label>
                <select id="attach-scene" aria-label="Attach to scene" value={preview.sceneId} onChange={e => setPreview({ ...preview, sceneId: e.target.value })} className="h-9 flex-1 rounded-md border border-white/10 bg-black/40 px-2 text-xs text-zinc-200">
                  {scenes.map((s, i) => <option key={s.id} value={s.id}>Scene {i + 1}</option>)}
                </select>
                <Button onClick={() => attachToScene(preview.photo, preview.sceneId)} className="bg-violet-600 text-white hover:bg-violet-500">Use in Scene</Button>
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
