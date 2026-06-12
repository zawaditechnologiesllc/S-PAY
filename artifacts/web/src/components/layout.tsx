import { Link, useRoute, useLocation } from "wouter";
import {
  Wallet, Landmark, CreditCard, Briefcase,
  CircleUser, QrCode, HelpCircle, LogOut, LayoutDashboard,
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import { BackButton } from "@/components/back-button";
import { NotificationsBell } from "@/components/notifications-bell";
import { ThemeToggle } from "@/components/theme";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

export function Layout({ children, title, back }: { children: React.ReactNode; title?: string; back?: boolean }) {
  const [, setLocation] = useLocation();

  const handleSignOut = () => {
    clearToken();
    setLocation("/login");
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-950 flex flex-col md:flex-row pb-16 md:pb-0 overflow-x-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-[#1A2B4A] fixed h-full z-10">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10">
          <Link href="/dashboard">
            <div className="flex items-center gap-3 cursor-pointer">
              <img src={spayLogo} alt="S-PAY" className="w-9 h-9 rounded-[22%] flex-shrink-0" />
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
          <NavLink href="/wallet" icon={<Wallet size={18} />} label="History" />
          <NavLink href="/banking" icon={<Landmark size={18} />} label="Banking" />
          <NavLink href="/card" icon={<CreditCard size={18} />} label="Card" />
          <NavLink href="/jobs" icon={<Briefcase size={18} />} label="Remote Jobs" />

          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 pb-2 pt-5">Account</p>
          <NavLink href="/profile" icon={<CircleUser size={18} />} label="Profile & Settings" />
        </nav>

        {/* Bottom actions */}
        <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
          <Link href="/how-it-works">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-colors text-sm cursor-pointer">
              <HelpCircle size={18} />
              <span>How it works</span>
            </div>
          </Link>
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
          {/* Top bar — brand on mobile (sidebar carries it on desktop), page title on desktop */}
          <header className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-3 min-w-0 md:hidden">
              <img src={spayLogo} alt="S-PAY" className="w-10 h-10 rounded-[22%] flex-shrink-0 shadow-md ring-2 ring-white/30" />
              <div className="min-w-0">
                <span className="font-black text-white text-lg tracking-tight leading-none block">S-PAY</span>
                <span className="text-[10px] text-[#A8DEFF] font-semibold tracking-wide uppercase">Digital Wallet · {title ?? "Dashboard"}</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3 min-w-0">
              {back && <BackButton />}
              <h1 className="text-xl md:text-2xl font-bold text-white truncate">{title ?? "Dashboard"}</h1>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <NotificationsBell />
              {/* My QR — one tap from anywhere to get paid (WeChat/Alipay pattern) */}
              <Link href="/deposit?m=crypto">
                <button className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors" aria-label="My QR code">
                  <QrCode size={19} />
                </button>
              </Link>
              <Link href="/profile">
                <button className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                  <CircleUser size={19} />
                </button>
              </Link>
            </div>
          </header>
          {back && <div className="md:hidden -mt-2"><BackButton /></div>}

          {children}
        </div>
      </main>

      {/* Mobile bottom nav — mirrors the native app tabs (profile lives in the header avatar) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex justify-around items-center px-1 h-16 z-50 safe-area-pb">
        <MobileNavLink href="/dashboard" icon={<LayoutDashboard size={22} />} label="Home" />
        <MobileNavLink href="/wallet" icon={<Wallet size={22} />} label="History" />
        <MobileNavLink href="/banking" icon={<Landmark size={22} />} label="Banking" />
        <MobileNavLink href="/card" icon={<CreditCard size={22} />} label="Card" />
        <MobileNavLink href="/jobs" icon={<Briefcase size={22} />} label="Jobs" />
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
        className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[52px] cursor-pointer transition-colors ${
          active ? "text-[#4DC9EE]" : "text-gray-400"
        }`}
      >
        {icon}
        <span className="text-[10px] font-semibold">{label}</span>
      </div>
    </Link>
  );
}
