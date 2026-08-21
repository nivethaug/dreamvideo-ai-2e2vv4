import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Clapperboard, LayoutDashboard, Sparkles, Settings as SettingsIcon, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home", icon: Clapperboard, end: true },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/create", label: "Create Video", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#07070f]/85 backdrop-blur-xl">
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
                  "flex h-11 items-center rounded-lg px-4 text-sm font-medium transition-colors duration-200",
                  isActive ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                )
              }
            >
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/create"
            className="hidden h-11 items-center rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-5 text-sm font-semibold text-white shadow-lg shadow-purple-950/50 transition-transform duration-200 hover:scale-[1.03] motion-reduce:transition-none md:flex"
          >
            <span>Start Creating</span>
          </Link>
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
        </div>
      )}
    </header>
  );
}
