import { Link, useRoute, useLocation } from "wouter";
import {
  LayoutDashboard, Users, ArrowLeftRight, LogOut,
  Shield, Bell, ChevronRight,
} from "lucide-react";
import { clearToken } from "@/lib/auth";

const NAV = [
  { href: "/admin", icon: <LayoutDashboard size={18} />, label: "Dashboard" },
  { href: "/admin/users", icon: <Users size={18} />, label: "Users" },
  { href: "/admin/transactions", icon: <ArrowLeftRight size={18} />, label: "Transactions" },
];

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const [active] = useRoute(href === "/admin" ? "/admin" : `${href}*`);
  return (
    <Link href={href}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all font-medium text-sm ${
        active
          ? "bg-[#4DC9EE] text-white shadow-md shadow-[#4DC9EE]/30"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      }`}>
        {icon}
        {label}
        {active && <ChevronRight size={14} className="ml-auto" />}
      </div>
    </Link>
  );
}

export function AdminLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  const [, setLocation] = useLocation();
  const handleLogout = () => { clearToken(); setLocation("/login"); };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col fixed top-0 bottom-0 left-0 z-40 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="font-bold text-[#1A2B4A]">S-PAY</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <Shield size={12} className="text-[#4DC9EE]" />
            <span className="text-xs font-semibold text-[#4DC9EE] uppercase tracking-wider">Admin Console</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV.map((n) => <NavItem key={n.href} {...n} />)}
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-1">
          <Link href="/dashboard">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer text-gray-500 hover:bg-gray-100 hover:text-gray-900 text-sm font-medium transition-all">
              <LayoutDashboard size={16} /> User Dashboard
            </div>
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 text-sm font-medium transition-all">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-60 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-30 shadow-sm">
          <h1 className="text-lg font-bold text-gray-900">{title || "Admin"}</h1>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors relative">
              <Bell size={16} />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">3</span>
            </button>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
              <div className="w-6 h-6 bg-[#1A2B4A] rounded-full flex items-center justify-center">
                <Shield size={12} className="text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Admin</span>
            </div>
          </div>
        </header>
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}
