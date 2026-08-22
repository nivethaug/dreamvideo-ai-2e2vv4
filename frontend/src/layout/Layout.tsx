import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { AuthProvider } from "@/lib/auth";

const Layout = () => (
  <div className="relative flex min-h-screen w-full flex-col bg-[#07070f] text-zinc-100">
    {/* Ambient background glows */}
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[140px]" />
      <div className="absolute bottom-0 right-[-10%] h-[420px] w-[520px] rounded-full bg-indigo-600/10 blur-[130px]" />
      <div className="absolute bottom-1/3 left-[-10%] h-[360px] w-[440px] rounded-full bg-fuchsia-600/[0.07] blur-[120px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_60%)]" />
    </div>
    <AuthProvider>
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>
    <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-zinc-600">
      DreamVideo AI — imagery by Pexels photographers
    </footer>
    </AuthProvider>
  </div>
);

export default Layout;
