import { Link, useRoute, useLocation } from "wouter";
import {
  Wallet, Landmark, CreditCard, Briefcase,
  CircleUser, Bell, HelpCircle, LogOut, Settings, LayoutDashboard,
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

export function Layout({ children, title }: { children: React.ReactNode; title?: string }) {
  const [, setLocation] = useLocation();

  const handleSignOut = () => {
    clearToken();
    setLocation("/login");
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col md:flex-row pb-16 md:pb-0">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-[#1A2B4A] fixed h-full z-10">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/dashboard">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                <img src={spayLogo} alt="S-PAY" className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="font-black text-white text-lg tracking-tight leading-none block">S-PAY</span>
                <span className="text-[10px] text-[#A8DEFF] font-medium">Digital Wallet</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 pb-2 pt-1">Main</p>
          <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <NavLink href="/wallet" icon={<Wallet size={18} />} label="Wallet" />
          <NavLink href="/banking" icon={<Landmark size={18} />} label="Banking" />
          <NavLink href="/card" icon={<CreditCard size={18} />} label="Card" />
          <NavLink href="/jobs" icon={<Briefcase size={18} />} label="Remote Jobs" />

          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 pb-2 pt-5">Account</p>
          <NavLink href="/profile" icon={<CircleUser size={18} />} label="Profile" />
          <NavLink href="/profile" icon={<Settings size={18} />} label="Settings" />
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
          <a
            href="mailto:support@spayewallet.com"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm cursor-pointer"
          >
            <HelpCircle size={18} />
            <span>Help &amp; Support</span>
          </a>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm"
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64 relative min-h-screen">
        {/* Gradient header bg */}
        <div className="absolute top-0 left-0 right-0 h-56 bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] z-0 rounded-b-3xl" />

        <div className="relative z-10 p-4 md:p-8 max-w-5xl mx-auto space-y-6">
          {/* Top bar */}
          <header className="flex justify-between items-center pt-2">
            <h1 className="text-2xl font-bold text-white">{title ?? "Dashboard"}</h1>
            <div className="flex items-center gap-2">
              <button className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                <Bell size={19} />
              </button>
              <Link href="/profile">
                <button className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                  <CircleUser size={19} />
                </button>
              </Link>
            </div>
          </header>

          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center px-1 py-2 z-50">
        <MobileNavLink href="/dashboard" icon={<LayoutDashboard size={22} />} label="Home" />
        <MobileNavLink href="/wallet" icon={<Wallet size={22} />} label="Wallet" />
        <MobileNavLink href="/banking" icon={<Landmark size={22} />} label="Banking" />
        <MobileNavLink href="/jobs" icon={<Briefcase size={22} />} label="Jobs" />
        <MobileNavLink href="/profile" icon={<CircleUser size={22} />} label="Profile" />
      </nav>
    </div>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const [active] = useRoute(href);
  return (
    <Link href={href}>
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors text-sm ${
          active
            ? "bg-[#4DC9EE]/20 text-[#4DC9EE] font-semibold"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        {icon}
        <span>{label}</span>
      </div>
    </Link>
  );
}

function MobileNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const [active] = useRoute(href);
  return (
    <Link href={href}>
      <div
        className={`flex flex-col items-center gap-0.5 px-3 py-1 cursor-pointer transition-colors ${
          active ? "text-[#4DC9EE]" : "text-gray-400"
        }`}
      >
        {icon}
        <span className="text-[9px] font-semibold">{label}</span>
      </div>
    </Link>
  );
}
