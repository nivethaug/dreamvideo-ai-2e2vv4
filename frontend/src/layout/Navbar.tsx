import { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { Clapperboard, LayoutDashboard, Sparkles, Settings as SettingsIcon, Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth";

const links = [
  { to: "/", label: "Home", icon: Clapperboard, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/create", label: "Create Video", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (user?.name || user?.email || "U")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#07070f]/80 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" aria-hidden="true" />
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main navigation">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 shadow-lg shadow-purple-900/40">
            <Clapperboard className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-100">
            DreamVideo <span className="bg-gradient-to-r from-indigo-300 to-purple-400 bg-clip-text text-transparent">AI</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors duration-200",
                  isActive ? "bg-violet-500/15 text-violet-100 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                )
              }
            >
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1 pr-3 text-sm font-medium text-zinc-100 transition-colors hover:bg-white/10"
                  data-testid="navbar-profile-menu"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-700 text-xs font-semibold text-white">
                      {initials || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[120px] truncate sm:inline">{user.name || user.email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-white/10 bg-[#0b0b18]/95 backdrop-blur-xl">
                <DropdownMenuLabel className="truncate text-xs text-zinc-500">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 text-zinc-200" data-testid="navbar-profile-settings">
                  <UserIcon className="h-4 w-4" aria-hidden="true" /> Profile & Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/dashboard")} className="gap-2 text-zinc-200" data-testid="navbar-profile-dashboard">
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-red-400" data-testid="navbar-logout-button">
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="ghost"
                className="hidden h-11 text-sm text-zinc-300 hover:bg-white/5 hover:text-white md:flex"
                onClick={() => setAuthOpen(true)}
                data-testid="navbar-login-button"
              >
                Log in
              </Button>
              <Link
                to="/create"
                className="hidden h-11 items-center rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-5 text-sm font-semibold text-white shadow-lg shadow-purple-950/50 transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none md:flex"
              >
                <span>Start Creating</span>
              </Link>
            </>
          )}
          <button
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/5 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-white/10 px-4 pb-4 pt-2 md:hidden">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-100"
                )
              }
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </span>
            </NavLink>
          ))}
          {!isAuthenticated && (
            <button
              onClick={() => { setOpen(false); setAuthOpen(true); }}
              className="mt-2 flex h-12 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-zinc-300 hover:bg-white/5"
              data-testid="navbar-mobile-login-button"
            >
              Log in / Sign up
            </button>
          )}
        </div>
      )}

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </header>
  );
}
