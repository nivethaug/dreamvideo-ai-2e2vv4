import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth, SignInForm, SignUpForm } from "@/lib/auth";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "signin" | "signup";
}

export default function AuthModal({ open, onOpenChange, defaultMode = "signin" }: AuthModalProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError(null);
    }
  }, [open, defaultMode]);

  const handleSignIn = async () => {
    setBusy(true); setError(null);
    const res = await signIn(email, password);
    setBusy(false);
    if (res.ok) { onOpenChange(false); setPassword(""); }
    else setError(res.error || "Invalid email or password");
  };

  const handleSignUp = async () => {
    setBusy(true); setError(null);
    const res = await signUp(name, email, password);
    setBusy(false);
    if (res.ok) { onOpenChange(false); setPassword(""); }
    else setError(res.error || "Could not create account");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0b0b18]/95 backdrop-blur-xl sm:max-w-md" data-testid="auth-modal">
        <DialogHeader>
          <DialogTitle className="bg-gradient-to-r from-indigo-300 to-purple-400 bg-clip-text text-transparent">
            {mode === "signin" ? "Welcome back" : "Create your studio"}
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            {mode === "signin"
              ? "Sign in to continue crafting your videos."
              : "Sign up to start generating AI videos."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => { setMode(v as "signin" | "signup"); setError(null); }}>
          <TabsList className="grid w-full grid-cols-2 bg-white/5" data-testid="auth-modal-tabs">
            <TabsTrigger value="signin" data-testid="auth-modal-signin-tab">Sign in</TabsTrigger>
            <TabsTrigger value="signup" data-testid="auth-modal-signup-tab">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <SignInForm
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              error={error}
              onSubmit={handleSignIn}
              onSwitch={() => { setMode("signup"); setError(null); }}
            />
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <SignUpForm
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              password={password} setPassword={setPassword}
              error={error}
              onSubmit={handleSignUp}
              onSwitch={() => { setMode("signin"); setError(null); }}
            />
          </TabsContent>
        </Tabs>

        {busy && (
          <p className="text-center text-xs text-zinc-500" aria-live="polite">Please wait…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
