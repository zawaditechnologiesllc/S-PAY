import { Link, useRoute } from "wouter";
import { Wallet, Landmark, CreditCard, Briefcase, CircleUser, Bell } from "lucide-react";

export function Layout({ children, title }: { children: React.ReactNode, title?: string }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col md:flex-row pb-16 md:pb-0">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r fixed h-full z-10">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary tracking-tight">S-PAY</h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavLink href="/dashboard" icon={<Wallet size={20} />} label="Wallet" />
          <NavLink href="/banking" icon={<Landmark size={20} />} label="Banking" />
          <NavLink href="/card" icon={<CreditCard size={20} />} label="Card" />
          <NavLink href="/jobs" icon={<Briefcase size={20} />} label="Jobs" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 relative min-h-screen">
        {/* Blue Gradient Header Background */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-br from-[#4DC9EE] to-[#2E8FD6] z-0 rounded-b-3xl"></div>
        
        <div className="relative z-10 p-4 md:p-8 max-w-5xl mx-auto space-y-6">
          {/* Header Row */}
          <header className="flex justify-between items-center mb-6 pt-2">
            <h1 className="text-2xl font-semibold text-white">{title || "Dashboard"}</h1>
            <div className="flex items-center gap-3">
              <button className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                <Bell size={20} />
              </button>
              <Link href="/profile">
                <button className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
                  <CircleUser size={20} />
                </button>
              </Link>
            </div>
          </header>

          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 z-50 safe-area-bottom">
        <MobileNavLink href="/dashboard" icon={<Wallet size={24} />} label="Wallet" />
        <MobileNavLink href="/banking" icon={<Landmark size={24} />} label="Banking" />
        <MobileNavLink href="/card" icon={<CreditCard size={24} />} label="Card" />
        <MobileNavLink href="/jobs" icon={<Briefcase size={24} />} label="Jobs" />
      </nav>
    </div>
  );
}

function NavLink({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  const [active] = useRoute(href);
  return (
    <Link href={href}>
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors ${
        active ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
      }`}>
        {icon}
        <span>{label}</span>
      </div>
    </Link>
  );
}

function MobileNavLink({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  const [active] = useRoute(href);
  return (
    <Link href={href}>
      <div className={`flex flex-col items-center gap-1 cursor-pointer ${
        active ? 'text-primary' : 'text-gray-400'
      }`}>
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
    </Link>
  );
}