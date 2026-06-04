import { useState } from "react";
import { Link } from "wouter";
import { Globe, Twitter, Linkedin, Instagram, Menu, X } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

interface PublicNavProps {
  active?: string;
}

export function PublicNav({ active }: PublicNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = (name: string) =>
    `transition-colors ${
      active === name
        ? "text-[#4DC9EE] font-semibold"
        : "text-gray-600 hover:text-[#4DC9EE]"
    }`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: logo + wordmark */}
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <img
              src={spayLogo}
              alt="S-PAY"
              className="w-8 h-8 rounded-[22%] flex-shrink-0 shadow-sm"
            />
            <span className="font-bold text-[#1A2B4A] text-lg tracking-tight">
              S-PAY
            </span>
          </div>
        </Link>

        {/* Center: nav links (desktop) */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <a href="/#features" className={linkClass("features")}>
            Features
          </a>
          <Link href="/jobs">
            <span className={`cursor-pointer ${linkClass("jobs")}`}>Jobs</span>
          </Link>
          <Link href="/about">
            <span className={`cursor-pointer ${linkClass("about")}`}>About</span>
          </Link>
          <Link href="/contact">
            <span className={`cursor-pointer ${linkClass("contact")}`}>
              Contact
            </span>
          </Link>
        </div>

        {/* Right: auth buttons */}
        <div className="flex items-center gap-3">
          <Link href="/login">
            <button className="hidden sm:block text-sm font-medium text-gray-700 hover:text-[#1A2B4A] transition-colors px-4 py-2 border border-gray-200 rounded-full hover:border-gray-300">
              Sign in
            </button>
          </Link>
          <Link href="/register">
            <button className="text-sm font-semibold bg-[#4DC9EE] text-white px-5 py-2.5 rounded-full hover:bg-[#2E8FD6] transition-colors shadow-sm">
              Get Started
            </button>
          </Link>
          {/* Mobile hamburger */}
          <button
            className="md:hidden ml-1 p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 shadow-lg">
          <div className="max-w-6xl mx-auto px-6 py-2 flex flex-col">
            <a
              href="/#features"
              className="py-3.5 text-base font-medium text-gray-800 hover:text-[#4DC9EE] transition-colors border-b border-gray-100 active:bg-gray-50"
              onClick={() => setMobileOpen(false)}
            >
              Features
            </a>
            <Link href="/jobs">
              <span
                className="block py-3.5 text-base font-medium text-gray-800 hover:text-[#4DC9EE] transition-colors border-b border-gray-100 cursor-pointer active:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                Jobs
              </span>
            </Link>
            <Link href="/about">
              <span
                className="block py-3.5 text-base font-medium text-gray-800 hover:text-[#4DC9EE] transition-colors border-b border-gray-100 cursor-pointer active:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                About
              </span>
            </Link>
            <Link href="/contact">
              <span
                className="block py-3.5 text-base font-medium text-gray-800 hover:text-[#4DC9EE] transition-colors border-b border-gray-100 cursor-pointer active:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                Contact
              </span>
            </Link>
            <Link href="/login">
              <span
                className="block py-3.5 text-base font-medium text-[#4DC9EE] font-semibold cursor-pointer active:bg-gray-50"
                onClick={() => setMobileOpen(false)}
              >
                Sign in →
              </span>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#1A2B4A] py-12 md:py-16 px-5 md:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mb-10 md:mb-12">
          {/* Brand col */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <img
                src={spayLogo}
                alt="S-PAY"
                className="w-8 h-8 rounded-[22%] flex-shrink-0 shadow-sm"
              />
              <span className="font-bold text-white text-base">S-PAY</span>
            </div>
            <p className="text-blue-300 text-sm leading-relaxed mb-6">
              Digital money super app for remote workers worldwide. Get paid globally, spend locally.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-blue-300 hover:text-[#4DC9EE] hover:bg-white/20 transition-colors"
                aria-label="Twitter"
              >
                <Twitter size={14} />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-blue-300 hover:text-[#4DC9EE] hover:bg-white/20 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin size={14} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-blue-300 hover:text-[#4DC9EE] hover:bg-white/20 transition-colors"
                aria-label="Instagram"
              >
                <Instagram size={14} />
              </a>
            </div>
          </div>

          {/* Product col */}
          <div>
            <h5 className="text-white font-semibold mb-5">Product</h5>
            <ul className="space-y-3">
              <li>
                <a
                  href="/#features"
                  className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors"
                >
                  Digital Wallet
                </a>
              </li>
              <li>
                <a
                  href="/#features"
                  className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors"
                >
                  Virtual Banking
                </a>
              </li>
              <li>
                <a
                  href="/#features"
                  className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors"
                >
                  S-PAY Card
                </a>
              </li>
              <li>
                <Link href="/jobs">
                  <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">
                    Remote Jobs
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Company col */}
          <div>
            <h5 className="text-white font-semibold mb-5">Company</h5>
            <ul className="space-y-3">
              <li>
                <Link href="/about">
                  <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">
                    About Us
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/careers">
                  <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">
                    Careers
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/blog">
                  <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">
                    Blog
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/contact">
                  <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">
                    Contact
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal col */}
          <div>
            <h5 className="text-white font-semibold mb-5">Legal</h5>
            <ul className="space-y-3">
              <li>
                <Link href="/privacy">
                  <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">
                    Privacy Policy
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/terms">
                  <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">
                    Terms of Service
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/cookies">
                  <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">
                    Cookie Policy
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 md:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4 text-center md:text-left">
          <p className="text-blue-400 text-xs md:text-sm">
            © {year} S-PAY · Zawadi Technologies LLC · All rights reserved
          </p>
          <div className="flex items-center gap-1.5 text-blue-400 text-xs">
            <Globe size={12} className="flex-shrink-0" />
            <span>For remote workers in Africa, Southeast Asia &amp; Latin America</span>
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
  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNav active={active} />
      {children}
      <PublicFooter />
    </div>
  );
}
