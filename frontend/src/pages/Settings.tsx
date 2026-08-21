import { useState } from "react";
import { User, Lock, SlidersHorizontal, LogOut, CheckCircle2, AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getByCategory } from "@/lib/pexels";
import { useAuth } from "@/lib/auth";

type Tab = "profile" | "security" | "preferences";

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
];

const Settings = () => {
  const { user, signOut } = useAuth();
  const avatar = getByCategory("portrait")[0];
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(user?.name ?? "Studio Creator");
  const [email, setEmail] = useState(user?.email ?? "you@studio.com");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const flash = (kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3200);
  };

  const saveProfile = () => {
    if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    setNameError(null);
    setSaving(true);
    // PENDING: persist via backend profile endpoint. Demo only.
    setTimeout(() => { setSaving(false); flash("success", "Profile saved."); }, 700);
  };

  const saveKey = () => {
    if (apiKey && !apiKey.startsWith("sk-or-")) {
      flash("error", "OpenRouter keys start with “sk-or-”.");
      return;
    }
    setSaving(true);
    setTimeout(() => { setSaving(false); setApiKey(""); flash("success", "API key validated format. Not stored — this demo never transmits it."); }, 700);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-400">Studio profile, security and render preferences.</p>

      {toast && (
        <div role="status" aria-live="polite" className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${toast.kind === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
          {toast.kind === "success" ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}{toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-8 flex gap-1 border-b border-white/10" role="tablist" aria-label="Settings tabs">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors ${tab === t.id ? "border-violet-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
            <t.icon className="h-4 w-4" aria-hidden="true" />{t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6" aria-live="polite">
        {tab === "profile" && (
          <>
            <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-white/10">
                    <AvatarImage src={avatar.url} alt={avatar.alt} />
                    <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-zinc-100">{name}</p>
                    <p className="text-sm text-zinc-500">{email}</p>
                    <Badge className="mt-1 border-emerald-500/30 bg-emerald-500/15 text-emerald-300">Studio plan · active</Badge>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display name</Label>
                    <Input id="name" aria-label="Display name" value={name} onChange={e => setName(e.target.value)} className="border-white/10 bg-black/40" />
                    {nameError && <p className="text-xs text-red-400" role="alert">{nameError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" aria-label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="border-white/10 bg-black/40" />
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <Button onClick={saveProfile} disabled={saving} className="gap-2 rounded-full bg-violet-600 text-white hover:bg-violet-500">
                    <span className="flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save changes</span>
                  </Button>
                  <Button variant="outline" className="rounded-full border-white/15 bg-transparent text-zinc-300 hover:bg-white/10" onClick={() => { setName(user?.name ?? "Studio Creator"); setEmail(user?.email ?? "you@studio.com"); setNameError(null); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.03]">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6">
                <div>
                  <p className="font-medium">Account</p>
                  <p className="text-sm text-zinc-500">Sign out of this studio session on this device.</p>
                </div>
                <Button variant="outline" onClick={signOut} className="gap-2 rounded-full border-red-500/30 bg-transparent text-red-300 hover:bg-red-500/10">
                  <span className="flex items-center gap-2"><LogOut className="h-4 w-4" aria-hidden="true" />Log out</span>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "security" && (
          <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="font-medium">OpenRouter API key</h2>
                <p className="mt-1 text-sm text-zinc-500">Used for AI script and scene generation. Masked, never stored or transmitted in this demo.</p>
                <div className="mt-3 flex gap-2">
                  <div className="relative flex-1">
                    <Input aria-label="OpenRouter API key" type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-…" className="border-white/10 bg-black/40 pr-10 font-mono text-sm" />
                    <button type="button" aria-label={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                      {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <Button onClick={saveKey} disabled={saving} className="rounded-full bg-violet-600 text-white hover:bg-violet-500">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Validate"}</Button>
                </div>
                <p className="mt-2 text-xs text-zinc-600">Pexels imagery needs no key here — it's handled by the saved server-side integration.</p>
              </div>
              <div className="border-t border-white/10 pt-6">
                <h2 className="font-medium">Session</h2>
                <p className="mt-1 text-sm text-zinc-500">Demo auth: frontend-only state, no passwords stored.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "preferences" && (
          <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <CardContent className="space-y-5 p-6">
              {[
                ["Default style", "Cinematic 2.39:1"],
                ["Default voice", "Documentary Calm"],
                ["Export quality", "4K"],
                ["Reduce motion in previews", "Off"],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between">
                  <p className="text-sm text-zinc-300">{label}</p>
                  <Badge variant="outline" className="border-white/10 text-zinc-300">{val}</Badge>
                </div>
              ))}
              <Button onClick={() => flash("success", "Preferences saved.")} className="rounded-full bg-violet-600 text-white hover:bg-violet-500">Save preferences</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Settings;
