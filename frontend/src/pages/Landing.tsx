import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, Wand2, Layers, Mic2, Download, ArrowRight, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHeroImages, useCinematicExamples, useTestimonialAvatars, useFeatureImages } from "@/lib/media-hooks";
import type { PexelsPhoto } from "@/lib/pexels";
import { useAuth, SignInForm, SignUpForm } from "@/lib/auth";

type AuthMode = "signin" | "signup";

const steps = [
  { icon: Wand2, title: "Describe your idea", body: "One paragraph is enough. DreamVideo drafts a full script, scene by scene." },
  { icon: Layers, title: "Shape the storyboard", body: "Reorder scenes, attach real footage from the media library, adjust pacing." },
  { icon: Mic2, title: "Choose a voice", body: "Natural narration in multiple tones — from documentary calm to high-energy." },
  { icon: Download, title: "Render & export", body: "Cinematic color, titles and sound design baked in. Export in one click." },
];

const features = [
  { title: "Cinematic by default", body: "Every render ships with film-grade color, letterboxing and title cards — not slideshow frames." },
  { title: "Real footage, not clip art", body: "The integrated media library pulls real photography and footage from Pexels with full attribution." },
  { title: "AI scene editing", body: "“Make scene three darker and slower.” Direct the edit in plain language, scene by scene." },
];

const testimonials = [
  { name: "Maya Okafor", role: "Documentary producer", quote: "We storyboard pitch reels in an afternoon. The scene-level AI direction is the part clients notice." },
  { name: "Jonas Lindqvist", role: "Indie filmmaker", quote: "It reads like an editor's tool, not a toy. The storyboard pacing suggestions are genuinely good." },
  { name: "Priya Raman", role: "Brand studio lead", quote: "Real footage in the library killed the stock-clip scavenger hunt. Attribution handled automatically." },
];

const pricing = [
  { name: "Starter", price: "$0", note: "3 renders / month", perks: ["720p exports", "Watermark-free drafts", "Media library access"] },
  { name: "Studio", price: "$29", note: "per month", perks: ["Unlimited renders", "4K exports", "Priority render queue", "All voice models"], featured: true },
  { name: "Production", price: "$99", note: "per month", perks: ["Team workspaces", "Brand kits", "API access", "Dedicated support"] },
];

const Landing = () => {
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const { user, signIn, signUp, signOut } = useAuth();

  const hero = useHeroImages();
  const examples = useCinematicExamples();
  const avatars = useTestimonialAvatars();
  const featureImgs = useFeatureImages();

  const [heroReady, setHeroReady] = useState(false);
  useEffect(() => setHeroReady(Boolean(hero)), [hero]);

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setFormError(null);
    if (!email.includes("@") || password.length < 8) {
      setFormError("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    if (authMode === "signup" && name.trim().length < 2) {
      setFormError("Tell us your name to create the studio account.");
      return;
    }
    setBusy(true);
    const res =
      authMode === "signin"
        ? await signIn(email, password)
        : await signUp(name, email, password);
    setBusy(false);
    if (!res.ok) setFormError(res.error || "Something went wrong. Please try again.");
    else window.location.assign("/dashboard");
  };

  const avatarFor = (i: number): PexelsPhoto | undefined => avatars[i % Math.max(avatars.length, 1)];

  return (
    <div className="min-h-screen bg-[#07070f]">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_-10%,rgba(99,102,241,0.25),transparent)]" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs tracking-wide text-indigo-200">
              <Star className="h-3 w-3" aria-hidden="true" /> Cinematic AI video studio
            </span>
            <h1 className="mt-5 font-serif text-4xl leading-tight text-zinc-50 md:text-6xl">
              Turn your ideas<br />into <span className="grad-text italic">videos</span>.
            </h1>
            <p className="mt-5 max-w-md text-zinc-400">
              DreamVideo AI writes the script, builds the storyboard from real footage, and renders a finished cut — while you stay in the director's chair.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="lg" className="glow-cta bg-indigo-500 hover:bg-indigo-400" onClick={() => setAuthMode("signup")}>
                    <span className="flex items-center gap-2"><Wand2 className="h-4 w-4" aria-hidden="true" /> Start creating</span>
                  </Button>
                </DialogTrigger>
                <DialogContent role="dialog" aria-label="Studio account">
                  <DialogHeader>
                    <DialogTitle>{authMode === "signin" ? "Sign in to DreamVideo" : "Create your studio"}</DialogTitle>
                  </DialogHeader>
                  {user ? (
                    <div className="space-y-4" aria-live="polite">
                      <p className="text-sm text-zinc-400">Signed in as {user.email}. You're ready to create.</p>
                      <div className="flex gap-2">
                        <Button asChild><Link to="/dashboard">Open dashboard</Link></Button>
                        <Button variant="outline" onClick={signOut}>Sign out</Button>
                      </div>
                    </div>
                  ) : authMode === "signin" ? (
                    <SignInForm
                      email={email} setEmail={setEmail} password={password} setPassword={setPassword}
                      error={formError} onSubmit={submit}
                      onSwitch={() => { setAuthMode("signup"); setFormError(null); }}
                    />
                  ) : (
                    <SignUpForm
                      name={name} setName={setName} email={email} setEmail={setEmail} password={password} setPassword={setPassword}
                      error={formError} onSubmit={submit}
                      onSwitch={() => { setAuthMode("signin"); setFormError(null); }}
                    />
                  )}
                </DialogContent>
              </Dialog>
              <Button asChild size="lg" variant="outline" className="border-white/15 bg-white/5 hover:bg-white/10">
                <Link to="/create"><span className="flex items-center gap-2"><Play className="h-4 w-4" aria-hidden="true" /> Watch a demo cut</span></Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-zinc-500">Demo auth only — no password is stored or transmitted.</p>
          </div>

          {/* Studio product preview */}
          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 shadow-2xl backdrop-blur-xl transition-transform duration-500 hover:scale-[1.01] motion-reduce:transition-none">
              <div className="overflow-hidden rounded-xl">
                {heroReady && hero && hero.length > 0 ? (
                  <img src={hero[0].url} alt={`Preview frame — photo by ${hero[0].photographer} on Pexels`} className="aspect-video w-full object-cover" />
                ) : (
                  <div className="aspect-video w-full animate-pulse bg-gradient-to-br from-indigo-900/40 to-zinc-900" aria-label="Loading preview imagery" />
                )}
              </div>
              <div className="mt-3 flex items-center gap-2 px-1">
                <span className="h-2 w-2 rounded-full bg-red-400" aria-hidden="true" />
                <div className="h-1 flex-1 rounded bg-white/10"><div className="h-1 w-1/3 rounded bg-indigo-400" /></div>
                <span className="text-[10px] text-zinc-500">00:04 / 00:24</span>
              </div>
              <div className="mt-3 flex gap-2 overflow-hidden px-1">
                {(hero ?? []).slice(1, 5).map((p, i) => (
                  <img key={p.url} src={p.thumb} alt={`Storyboard frame ${i + 1} — ${p.photographer}`} className="h-12 w-20 flex-1 rounded object-cover opacity-80" />
                ))}
              </div>
            </div>
            {hero && hero[0] && (
              <p className="mt-3 text-right text-[10px] text-zinc-600">Photo — {hero[0].photographer} / Pexels</p>
            )}
          </div>
        </div>
      </section>

      {/* FOUR-STEP WORKFLOW */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-serif text-3xl text-zinc-100">From paragraph to premiere</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Card key={s.title} className="glass-card border-white/10">
              <CardContent className="space-y-3 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                  <s.icon className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <p className="text-xs tracking-widest text-indigo-300">STEP {i + 1}</p>
                <h3 className="font-medium text-zinc-100">{s.title}</h3>
                <p className="text-sm text-zinc-400">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-y border-white/5 bg-[#0a0a16]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-serif text-3xl text-zinc-100">Built like an edit suite</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <Card key={f.title} className="overflow-hidden border-white/10 bg-white/[0.02]">
                <div className="h-40 overflow-hidden">
                  {featureImgs[i] ? (
                    <img src={featureImgs[i].url} alt={`Feature illustration — ${featureImgs[i].photographer} / Pexels`} className="h-full w-full object-cover opacity-70 transition-transform duration-500 hover:scale-105 motion-reduce:transition-none" />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-zinc-800/60" aria-label="Loading feature imagery" />
                  )}
                </div>
                <CardContent className="space-y-2 p-6">
                  <h3 className="font-medium text-zinc-100">{f.title}</h3>
                  <p className="text-sm text-zinc-400">{f.body}</p>
                  {featureImgs[i] && <p className="pt-2 text-[10px] text-zinc-600">Photo — {featureImgs[i].photographer} / Pexels</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CINEMATIC EXAMPLES */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl text-zinc-100">Made with DreamVideo</h2>
          <span className="text-xs text-zinc-500">Frames from the Pexels library</span>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {examples.map((p, i) => (
            <button key={p.url} aria-label={`Preview example video ${i + 1} by ${p.photographer}`} className="group relative overflow-hidden rounded-xl border border-white/10 text-left transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10">
              <img src={p.url} alt={`${p.alt} — ${p.photographer} / Pexels`} className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-10 w-10 text-white" aria-hidden="true" />
              </span>
              <span className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 px-3 py-2 text-xs text-zinc-200">
                {["Nightfall — city nocturne", "Tide — coastal meditation", "Ascent — alpine drone film"][i % 3]}
              </span>
            </button>
          ))}
        </div>
        {examples.length === 0 && <p className="mt-8 text-sm text-zinc-500" aria-live="polite">Loading examples from the media library…</p>}
      </section>

      {/* TESTIMONIALS */}
      <section className="border-y border-white/5 bg-[#0a0a16]">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-serif text-3xl text-zinc-100">Filmmakers, not marketers</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => {
              const a = avatarFor(i);
              return (
                <Card key={t.name} className="relative overflow-hidden border-white/10 bg-white/[0.02]">
                  {a && <img src={a.thumb} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-10" />}
                  <CardContent className="relative space-y-4 p-6">
                    <p className="text-sm italic leading-relaxed text-zinc-300">“{t.quote}”</p>
                    <div className="flex items-center gap-3">
                      {a ? (
                        <img src={a.thumb} alt={`${t.name} portrait — ${a.photographer} / Pexels`} className="h-10 w-10 rounded-full border border-white/20 object-cover" />
                      ) : (
                        <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-700" aria-label="Loading portrait" />
                      )}
                      <div>
                        <p className="text-sm text-zinc-100">{t.name}</p>
                        <p className="text-xs text-zinc-500">{t.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-serif text-3xl text-zinc-100">Pricing, briefly</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pricing.map((p) => (
            <Card key={p.name} className={`border-white/10 transition-all duration-300 hover:scale-[1.02] motion-reduce:transition-none ${p.featured ? "border-indigo-400/40 bg-indigo-500/10" : "bg-white/[0.02]"}`}>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium text-zinc-100">{p.name}</h3>
                  {p.featured && <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-200">POPULAR</span>}
                </div>
                <p><span className="text-3xl font-serif text-zinc-50">{p.price}</span> <span className="text-xs text-zinc-500">{p.note}</span></p>
                <ul className="space-y-2 text-sm text-zinc-400">
                  {p.perks.map((k) => (
                    <li key={k} className="flex items-center gap-2"><Check className="h-4 w-4 text-indigo-400" aria-hidden="true" /> {k}</li>
                  ))}
                </ul>
                <Button className={`w-full ${p.featured ? "bg-indigo-500 hover:bg-indigo-400" : "border-white/15 bg-white/5 hover:bg-white/10"}`} variant={p.featured ? "default" : "outline"}>Choose {p.name}</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-white/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_120%,rgba(139,92,246,0.2),transparent)]" aria-hidden="true" />
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="font-serif text-4xl text-zinc-50">Your first cut is one paragraph away.</h2>
          <p className="mt-4 text-zinc-400">Open the studio, describe the film in your head, and direct from there.</p>
          <Button asChild size="lg" className="mt-8 bg-indigo-500 hover:bg-indigo-400">
            <Link to="/create"><span className="flex items-center gap-2">Open the studio <ArrowRight className="h-4 w-4" aria-hidden="true" /></span></Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Landing;
