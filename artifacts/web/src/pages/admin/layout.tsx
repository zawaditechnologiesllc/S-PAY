import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import {
  LayoutDashboard, Users, ArrowLeftRight, LogOut,
  Shield, Bell, ChevronRight, Settings, Menu, X, Briefcase, Inbox, Banknote,
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.webp";

const NAV = [
  { href: "/admin", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
  { href: "/admin/users", icon: <Users size={18} />, label: "Users & KYC" },
  { href: "/admin/transactions", icon: <ArrowLeftRight size={18} />, label: "Transactions" },
  { href: "/admin/payroll", icon: <Banknote size={18} />, label: "Payroll" },
  { href: "/admin/jobs", icon: <Briefcase size={18} />, label: "Job Listings" },
  { href: "/admin/enquiries", icon: <Inbox size={18} />, label: "Enquiries" },
  { href: "/admin/settings", icon: <Settings size={18} />, label: "Settings" },
];

function NavItem({ href, icon, label, onClick }: { href: string; icon: React.ReactNode; label: string; onClick?: () => void }) {
  const [active] = useRoute(href === "/admin" ? "/admin" : `${href}*`);
  return (
    <Link href={href} onClick={onClick}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all font-medium text-sm ${
        active
          ? "bg-[#4DC9EE]/20 text-[#4DC9EE] font-semibold"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}>
        {icon}
        {label}
        {active && <ChevronRight size={14} className="ml-auto" />}
      </div>
    </Link>
  );
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const [, setLocation] = useLocation();
  const handleLogout = () => { clearToken(); setLocation("/login"); };

  return (
    <div className="flex flex-col h-full bg-[#1A2B4A]">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <Link href="/admin" onClick={onClose}>
          <div className="flex items-center gap-3 cursor-pointer">
            <img src={spayLogo} alt="S-PAY" className="w-9 h-9 rounded-[22%] flex-shrink-0" />
            <div>
              <span className="font-black text-white text-base tracking-tight leading-none block">S-PAY</span>
              <span className="text-[10px] text-[#4DC9EE] font-semibold uppercase tracking-widest">Admin Console</span>
            </div>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white md:hidden p-1">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-3 pb-2 pt-1">Management</p>
        {NAV.map((n) => <NavItem key={n.href} {...n} onClick={onClose} />)}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        <Link href="/dashboard" onClick={onClose}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-white/60 hover:bg-white/10 hover:text-white text-sm font-medium transition-colors">
            <LayoutDashboard size={16} /> User Dashboard
          </div>
        </Link>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:bg-red-500/10 hover:text-red-400 text-sm font-medium transition-colors">
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}

export function AdminLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800/60 flex">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar — always visible */}
      <aside className="hidden md:flex w-64 flex-col fixed top-0 bottom-0 left-0 z-40 shadow-xl">
        <Sidebar />
      </aside>

      {/* Mobile sidebar — slide in */}
      <aside className={`fixed top-0 bottom-0 left-0 w-72 z-40 flex flex-col shadow-xl transition-transform duration-300 md:hidden ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-base md:text-lg font-bold text-gray-900 dark:text-gray-100">{title || "Admin"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-200 transition-colors relative">
              <Bell size={16} />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-full px-3 py-1.5">
              <div className="w-6 h-6 bg-[#1A2B4A] rounded-full flex items-center justify-center">
                <Shield size={12} className="text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Admin</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
