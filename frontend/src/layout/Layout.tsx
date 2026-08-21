import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { AuthProvider } from "@/lib/auth";

const Layout = () => (
  <div className="flex min-h-screen w-full flex-col bg-[#07070f] text-zinc-100">
    <AuthProvider>
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>
    <footer className="border-t border-white/10 py-6 text-center text-xs text-zinc-500">
      DreamVideo AI — imagery by Pexels photographers
    </footer>
    </AuthProvider>
  </div>
);

export default Layout;
