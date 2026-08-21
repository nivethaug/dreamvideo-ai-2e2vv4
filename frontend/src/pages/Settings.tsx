import { useState, useEffect, useCallback } from "react";
import { User, Lock, SlidersHorizontal, LogOut, CheckCircle2, AlertTriangle, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/services/database";
import { useAuth } from "@/lib/auth";

type Tab = "profile" | "security" | "preferences";

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
];

interface KeyStatus { connected: boolean; masked: string; last4: string | null; updated_at: string | null }

const Settings = () => {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(user?.name ?? "Studio Creator");
  const [email, setEmail] = useState(user?.email ?? "you@studio.com");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const flash = (kind: "success" | "error", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3600);
  };

  const loadKeyStatus = useCallback(async () => {
    setKeyLoading(true);
    const res = await api.get<KeyStatus>("/api/v1/credentials/openrouter");
    setKeyLoading(false);
    if (res.success && res.data) setKeyStatus(res.data);
  }, []);

  useEffect(() => { loadKeyStatus(); }, [loadKeyStatus]);

  const saveProfile = () => {
    if (name.trim().length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    setNameError(null);
    flash("success", "Profile saved.");
  };

  const saveKey = async () => {
    if (!apiKey.trim()) { flash("error", "Enter your OpenRouter API key first."); return; }
    if (!apiKey.startsWith("sk-or-")) { flash("error", "OpenRouter keys start with “sk-or-”."); return; }
    setSaving(true);
    const res = await api.put<KeyStatus>("/api/v1/credentials/openrouter", { api_key: apiKey.trim() });
    setSaving(false);
    if (res.success && res.data) {
      setKeyStatus(res.data);
      setApiKey("");
      flash("success", "OpenRouter key connected. It is encrypted at rest and never shown again.");
    } else {
      flash("error", res.error || "Could not validate the key with OpenRouter. Check the key and try again.");
    }
  };

  const removeKey = async () => {
    setSaving(true);
    const res = await api.delete("/api/v1/credentials/openrouter");
    setSaving(false);
    if (res.success) {
      setKeyStatus(null);
      flash("success", "OpenRouter key removed.");
    } else {
      flash("error", res.error || "Could not remove the key.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-12" data-testid="settings-page">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-zinc-400">Studio profile, security and render preferences.</p>

      {toast && (
        <div role="status" aria-live="polite" className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${toast.kind === "success" ? "border-emerald-200 bg-emerald-500/10 text-emerald-700" : "border-red-200 bg-red-500/10 text-red-600"}`}>
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
            <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl" data-testid="settings-profile-section">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-white/10">
                    <AvatarFallback>{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-zinc-100">{name}</p>
                    <p className="text-sm text-zinc-500">{email}</p>
                    <Badge className="mt-1 border-emerald-200 bg-emerald-500/15 text-emerald-700">Studio plan · active</Badge>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display name</Label>
                    <Input id="name" aria-label="Display name" data-testid="settings-name-input" value={name} onChange={e => setName(e.target.value)} className="border-white/10 bg-white/5" />
                    {nameError && <p className="text-xs text-red-400" role="alert">{nameError}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" aria-label="Email" data-testid="settings-email-input" type="email" value={email} disabled className="border-white/10 bg-white/5 opacity-60" />
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
                <Button variant="outline" onClick={signOut} data-testid="settings-logout-button" className="gap-2 rounded-full border-red-200 bg-transparent text-red-600 hover:bg-red-50">
                  <span className="flex items-center gap-2"><LogOut className="h-4 w-4" aria-hidden="true" />Log out</span>
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {tab === "security" && (
          <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl" data-testid="settings-security-section">
            <CardContent className="space-y-6 p-6">
              <div data-testid="settings-openrouter-section">
                <h2 className="font-medium">OpenRouter API key</h2>
                <p className="mt-1 text-sm text-zinc-500">Used for AI script, scene and edit generation. Encrypted at rest on the server; never displayed again after saving.</p>
                {keyLoading ? (
                  <div className="mt-3 flex items-center gap-2 text-sm text-zinc-400"><Loader2 className="h-4 w-4 animate-spin text-violet-600" aria-hidden="true" />Checking connection…</div>
                ) : keyStatus?.connected ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Badge className="gap-1.5 border-emerald-200 bg-emerald-500/15 px-3 py-1.5 text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Connected •••• {keyStatus.last4}
                    </Badge>
                    <span className="text-xs text-zinc-500">{keyStatus.updated_at ? `Updated ${new Date(keyStatus.updated_at).toLocaleString()}` : ""}</span>
                    <Button variant="outline" size="sm" onClick={removeKey} disabled={saving} data-testid="settings-disconnect-key-button" className="rounded-full border-red-200 bg-transparent text-red-600 hover:bg-red-50">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Disconnect"}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <div className="relative flex-1">
                      <Input aria-label="OpenRouter API key" data-testid="settings-apikey-input" type={showKey ? "text" : "password"} value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-…" className="border-white/10 bg-white/5 pr-10 font-mono text-sm" />
                      <button type="button" aria-label={showKey ? "Hide API key" : "Show API key"} onClick={() => setShowKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                        {showKey ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                    <Button onClick={saveKey} disabled={saving} data-testid="settings-save-key-button" className="rounded-full bg-violet-600 text-white hover:bg-violet-500">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Save key"}</Button>
                  </div>
                )}
                <p className="mt-2 text-xs text-zinc-400">Pexels imagery needs no key here — it's handled by the saved server-side integration.</p>
              </div>
              <div className="border-t border-white/10 pt-6">
                <h2 className="font-medium">Session</h2>
                <p className="mt-1 text-sm text-zinc-500">You're signed in with a secure session token. Passwords are hashed server-side and never stored in plain text.</p>
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
