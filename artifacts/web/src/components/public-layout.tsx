import { useState } from "react";
import { useGetSiteContent, getGetSiteContentQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Globe, Mail, Menu, X, ArrowRight } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

interface PublicNavProps {
  active?: string;
}

export function PublicNav({ active }: PublicNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = (name: string) =>
    `transition-colors text-sm font-medium ${
      active === name
        ? "text-[#4DC9EE] font-semibold"
        : "text-gray-600 hover:text-[#4DC9EE]"
    }`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">

        {/* Logo + wordmark — always visible */}
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer select-none">
            <img src={spayLogo} alt="S-PAY" className="w-8 h-8 rounded-[22%] flex-shrink-0 shadow-sm" />
            <span className="font-black text-[#1A2B4A] text-lg tracking-tight">S-PAY</span>
          </div>
        </Link>

        {/* Desktop center nav links */}
        <div className="hidden md:flex items-center gap-7">
          <a href="/#features" className={linkClass("features")}>Features</a>
          <a href="/#business" className={linkClass("business")}>For Business</a>
          <Link href="/jobs"><span className={`cursor-pointer ${linkClass("jobs")}`}>Jobs</span></Link>
          <Link href="/about"><span className={`cursor-pointer ${linkClass("about")}`}>About</span></Link>
          <Link href="/how-it-works"><span className={`cursor-pointer ${linkClass("how-it-works")}`}>How it works</span></Link>
          <Link href="/contact"><span className={`cursor-pointer ${linkClass("contact")}`}>Contact</span></Link>
        </div>

        {/* Desktop auth buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/login">
            <button className="text-sm font-medium text-gray-700 hover:text-[#1A2B4A] px-4 py-2 border border-gray-200 rounded-full hover:border-gray-300 transition-colors">
              Sign in
            </button>
          </Link>
          <Link href="/register">
            <button className="text-sm font-semibold bg-[#4DC9EE] text-white px-5 py-2.5 rounded-full hover:bg-[#2E8FD6] transition-colors shadow-sm flex items-center gap-1.5">
              Get Started <ArrowRight size={14} />
            </button>
          </Link>
        </div>

        {/* Mobile: hamburger only */}
        <button
          className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 shadow-xl">
          <div className="px-5 py-3 flex flex-col">
            {[
              { label: "Features", href: "/#features", internal: false },
              { label: "For Business", href: "/#business", internal: false },
              { label: "Jobs", href: "/jobs", internal: true },
              { label: "About", href: "/about", internal: true },
              { label: "How it works", href: "/how-it-works", internal: true },
              { label: "Contact", href: "/contact", internal: true },
            ].map((item) =>
              item.internal ? (
                <Link key={item.label} href={item.href}>
                  <span
                    className="block py-3.5 text-[15px] font-medium text-gray-800 border-b border-gray-100 cursor-pointer"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </span>
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="block py-3.5 text-[15px] font-medium text-gray-800 border-b border-gray-100"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </a>
              )
            )}

            {/* Auth buttons at the bottom of the dropdown */}
            <div className="pt-4 pb-2 flex flex-col gap-3">
              <Link href="/login">
                <button
                  className="w-full py-3 rounded-xl border border-gray-200 text-[15px] font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign in
                </button>
              </Link>
              <Link href="/register">
                <button
                  className="w-full py-3 rounded-xl bg-[#4DC9EE] text-white text-[15px] font-bold hover:bg-[#2E8FD6] transition-colors flex items-center justify-center gap-2 shadow-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  Get Started — it's free <ArrowRight size={15} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0d1f38] py-14 md:py-20 px-5 md:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-10 mb-12 md:mb-16">

          {/* Brand col — spans 2 columns on md */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <img src={spayLogo} alt="S-PAY" className="w-9 h-9 rounded-[22%] flex-shrink-0" />
              <span className="font-black text-white text-lg tracking-tight">S-PAY</span>
            </div>
            <p className="text-blue-300 text-sm leading-relaxed mb-2 max-w-xs">
              The money super app for remote workers. Get a real US &amp; EU bank account, digital wallet, and local cash-outs — all in one place.
            </p>
            <p className="text-blue-400 text-xs mb-3">By Zawadi Technologies LLC</p>
            <p className="text-blue-400 text-xs mb-3">Zawadi Technologies LLC is a registered Money Services Business</p>
            {/* Built on Celo — same declaration MiniPay makes */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3.5 py-1.5 mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FCFF52] flex-shrink-0" />
              <span className="text-white text-xs font-semibold tracking-wide">Built on Celo</span>
            </div>
            <a
              href="mailto:support@spayewallet.com"
              className="inline-flex items-center gap-2 text-blue-300 hover:text-white transition-colors text-sm"
            >
              <Mail size={14} /> support@spayewallet.com
            </a>
          </div>

          {/* Product col */}
          <div>
            <h5 className="text-white font-bold mb-5 text-sm uppercase tracking-wider">Product</h5>
            <ul className="space-y-3.5">
              <li><a href="/#wallet" className="text-blue-300 text-sm hover:text-white transition-colors">Digital Wallet</a></li>
              <li><a href="/#banking" className="text-blue-300 text-sm hover:text-white transition-colors">Virtual Banking</a></li>
              <li><a href="/#card" className="text-blue-300 text-sm hover:text-white transition-colors">S-PAY Card</a></li>
              <li><a href="/#business" className="text-blue-300 text-sm hover:text-white transition-colors">S-PAY for Business</a></li>
              <li><Link href="/jobs"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">Remote Jobs</span></Link></li>
              <li><a href="/#markets" className="text-blue-300 text-sm hover:text-white transition-colors">Cash-Out Markets</a></li>
            </ul>
          </div>

          {/* Company col */}
          <div>
            <h5 className="text-white font-bold mb-5 text-sm uppercase tracking-wider">Company</h5>
            <ul className="space-y-3.5">
              <li><Link href="/about"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">About Us</span></Link></li>
              <li><Link href="/how-it-works"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">How It Works</span></Link></li>
              <li><Link href="/careers"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">Careers</span></Link></li>
              <li><Link href="/blog"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">Blog</span></Link></li>
              <li><Link href="/contact"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">Contact</span></Link></li>
            </ul>
          </div>

          {/* Legal col */}
          <div>
            <h5 className="text-white font-bold mb-5 text-sm uppercase tracking-wider">Legal</h5>
            <ul className="space-y-3.5">
              <li><Link href="/privacy"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">Privacy Policy</span></Link></li>
              <li><Link href="/terms"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">Terms of Service</span></Link></li>
              <li><Link href="/cookies"><span className="text-blue-300 text-sm hover:text-white transition-colors cursor-pointer">Cookie Policy</span></Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p className="text-blue-400 text-xs">
            © {year} S-PAY · Zawadi Technologies LLC · Built on Celo · All rights reserved
          </p>
          <div className="flex items-center gap-2 text-blue-400 text-xs">
            <Globe size={12} className="flex-shrink-0" />
            <span>Serving remote workers across Africa, Southeast Asia &amp; Latin America</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const { data: site } = useGetSiteContent({ query: { queryKey: getGetSiteContentQueryKey(), staleTime: 60_000 } });
  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <PublicNav active={active} />
      {children}
      <PublicFooter />
    </div>
  );
}
