import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

interface SectionProps {
  num: string;
  title: string;
  children: React.ReactNode;
}

function Section({ num, title, children }: SectionProps) {
  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-[#1A2B4A] mb-3 flex items-baseline gap-2">
        <span className="text-[#4DC9EE] font-black">{num}.</span> {title}
      </h2>
      <div className="text-gray-600 leading-relaxed space-y-3 pl-6">{children}</div>
    </div>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-[#4DC9EE] overflow-hidden flex-shrink-0">
                <img src={spayLogo} alt="S-PAY" className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-[#1A2B4A] text-lg tracking-tight">S-PAY</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="text-sm font-medium text-gray-700 hover:text-[#1A2B4A] transition-colors px-4 py-2">
                Sign in
              </button>
            </Link>
            <Link href="/register">
              <button className="text-sm font-semibold bg-[#4DC9EE] text-white px-5 py-2.5 rounded-full hover:bg-[#1A2B4A] transition-colors">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero banner */}
      <div className="pt-16 bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38]">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#4DC9EE]/20 flex items-center justify-center">
              <Shield size={20} className="text-[#4DC9EE]" />
            </div>
            <span className="text-[#A8DEFF] font-semibold text-sm uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2">Privacy Policy</h1>
          <p className="text-blue-300 text-sm">
            Effective date: <span className="text-white font-medium">June 1, 2024</span>
            &nbsp;·&nbsp; Company: <span className="text-white font-medium">S-PAY (Zawadi Technologies LLC)</span>
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14">

        {/* Back link */}
        <Link href="/">
          <div className="inline-flex items-center gap-2 text-[#4DC9EE] text-sm font-semibold mb-10 hover:text-[#1A2B4A] transition-colors cursor-pointer">
            <ArrowLeft size={16} /> Back to home
          </div>
        </Link>

        <div className="prose prose-gray max-w-none">
          <p className="text-gray-500 text-base leading-relaxed mb-10">
            This Privacy Policy describes how S-PAY (Zawadi Technologies LLC, "S-PAY", "we", "us", or "our") collects, uses, and shares information about you when you use our website, mobile application, and related services (collectively, the "Services"). By using our Services, you agree to the practices described in this policy.
          </p>

          <Section num="1" title="Information We Collect">
            <p>We collect information you provide directly to us and information generated through your use of our Services, including:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Identity information:</strong> full name, date of birth, nationality, and government-issued ID documents submitted during identity verification (KYC).</li>
              <li><strong>Contact information:</strong> email address, phone number, and mailing address.</li>
              <li><strong>Financial information:</strong> bank account details, mobile money account identifiers, and transaction history within our platform.</li>
              <li><strong>KYC documentation:</strong> passport scans, national ID images, selfies, and proof-of-address documents required for regulatory compliance.</li>
              <li><strong>Transaction data:</strong> amounts, timestamps, sender/recipient details, and payment method for every transaction you initiate or receive.</li>
              <li><strong>Device and usage information:</strong> IP address, browser type and version, operating system, device identifiers, pages visited, and actions taken within the Services.</li>
              <li><strong>Communications:</strong> messages you send to our support team and responses we provide.</li>
            </ul>
          </Section>

          <Section num="2" title="How We Use Information">
            <p>We use the information we collect for the following purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Service delivery:</strong> to create and manage your account, process transactions, and provide customer support.</li>
              <li><strong>Identity verification:</strong> to verify your identity and comply with Know Your Customer (KYC) requirements under applicable law.</li>
              <li><strong>Fraud prevention and security:</strong> to detect, investigate, and prevent fraudulent transactions, unauthorized access, and other illegal activities.</li>
              <li><strong>Regulatory compliance:</strong> to fulfill obligations under anti-money laundering (AML), sanctions screening, and other financial regulations.</li>
              <li><strong>Product improvement:</strong> to analyze usage patterns, conduct research, and develop new features and services.</li>
              <li><strong>Communications:</strong> to send transactional notifications, security alerts, and — with your consent — marketing updates.</li>
            </ul>
          </Section>

          <Section num="3" title="Data Sharing">
            <p>We do not sell your personal information to third parties. We share your data only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Payment processors and banking partners:</strong> to execute the transfers and withdrawals you request (e.g., mobile money operators, correspondent banks).</li>
              <li><strong>KYC / identity verification providers:</strong> third-party services that assist us in verifying your identity and screening against sanctions lists.</li>
              <li><strong>Legal and regulatory authorities:</strong> when required by applicable law, court order, or government request, including financial intelligence units.</li>
              <li><strong>Business transfers:</strong> in the event of a merger, acquisition, or sale of all or a portion of our assets, your data may be transferred to the successor entity.</li>
              <li><strong>Service providers:</strong> companies that help us operate the Services (cloud hosting, analytics, fraud detection) under strict data processing agreements.</li>
            </ul>
          </Section>

          <Section num="4" title="Data Security">
            <p>We take the security of your information seriously and implement appropriate technical and organizational measures, including:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>AES-256 encryption for all data stored at rest.</li>
              <li>TLS 1.2+ encryption for all data transmitted in transit.</li>
              <li>Role-based access controls limiting employee access to personal data.</li>
              <li>Regular security audits, penetration testing, and vulnerability assessments.</li>
              <li>Multi-factor authentication options for your account.</li>
            </ul>
            <p className="mt-3">No method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.</p>
          </Section>

          <Section num="5" title="Your Rights">
            <p>Depending on your jurisdiction, you may have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Access:</strong> request a copy of the personal data we hold about you.</li>
              <li><strong>Correction:</strong> request correction of inaccurate or incomplete information.</li>
              <li><strong>Deletion:</strong> request deletion of your personal data, subject to our legal retention obligations.</li>
              <li><strong>Portability:</strong> request your data in a structured, machine-readable format.</li>
              <li><strong>Objection:</strong> object to or restrict certain types of processing, including direct marketing.</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at <a href="mailto:privacy@spayewallet.com" className="text-[#4DC9EE] font-medium hover:underline">privacy@spayewallet.com</a>. We will respond within 30 days.</p>
          </Section>

          <Section num="6" title="Cookies">
            <p>We use cookies and similar tracking technologies solely for functional purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Session cookies:</strong> to keep you logged in during your session.</li>
              <li><strong>Preference cookies:</strong> to remember your language and display preferences.</li>
              <li><strong>Security cookies:</strong> to detect and prevent fraudulent sign-in attempts.</li>
            </ul>
            <p className="mt-3">We do not use advertising or tracking cookies. We do not share browsing data with ad networks.</p>
          </Section>

          <Section num="7" title="Children's Privacy">
            <p>Our Services are intended for adults only. You must be at least <strong>18 years of age</strong> to create an S-PAY account. We do not knowingly collect personal information from anyone under 18. If we become aware that a minor has provided us with personal data, we will promptly delete it. If you believe a minor has used our Services, contact us immediately at <a href="mailto:privacy@spayewallet.com" className="text-[#4DC9EE] font-medium hover:underline">privacy@spayewallet.com</a>.</p>
          </Section>

          <Section num="8" title="Contact Us">
            <p>If you have questions, concerns, or requests regarding this Privacy Policy or how we handle your personal data, please contact our Privacy team:</p>
            <div className="mt-3 bg-gray-50 rounded-xl p-5 border border-gray-100 not-italic">
              <p className="font-semibold text-[#1A2B4A]">S-PAY Privacy Team</p>
              <p>Zawadi Technologies LLC</p>
              <p>Email: <a href="mailto:privacy@spayewallet.com" className="text-[#4DC9EE] font-medium hover:underline">privacy@spayewallet.com</a></p>
            </div>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-14 pt-8 border-t border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <p className="text-gray-400 text-sm">© 2026 S-PAY · Zawadi Technologies LLC</p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/terms">
              <span className="text-[#4DC9EE] font-medium hover:text-[#1A2B4A] transition-colors cursor-pointer">Terms of Service</span>
            </Link>
            <Link href="/">
              <span className="text-gray-500 hover:text-[#1A2B4A] transition-colors cursor-pointer">Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
