import { ArrowLeft, Cookie } from "lucide-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/public-layout";

interface SectionProps { num: string; title: string; children: React.ReactNode; }
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

export default function Cookies() {
  return (
    <PublicLayout>
      {/* Hero banner */}
      <div className="pt-16 bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38]">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#4DC9EE]/20 flex items-center justify-center">
              <Cookie size={20} className="text-[#4DC9EE]" />
            </div>
            <span className="text-[#A8DEFF] font-semibold text-sm uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2">Cookie Policy</h1>
          <p className="text-blue-300 text-sm">
            Effective date: <span className="text-white font-medium">June 1, 2024</span>
            &nbsp;·&nbsp; Company: <span className="text-white font-medium">S-PAY (Zawadi Technologies LLC)</span>
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-14">
        <Link href="/">
          <div className="inline-flex items-center gap-2 text-[#4DC9EE] text-sm font-semibold mb-10 hover:text-[#1A2B4A] transition-colors cursor-pointer">
            <ArrowLeft size={16} /> Back to home
          </div>
        </Link>

        <div className="prose prose-gray max-w-none">
          <p className="text-gray-500 text-base leading-relaxed mb-10">
            This Cookie Policy explains how S-PAY (Zawadi Technologies LLC) uses cookies and similar tracking technologies when you visit our website or use our mobile application. By continuing to use our Services, you agree to the use of cookies as described in this policy.
          </p>

          <Section num="1" title="What Are Cookies">
            <p>Cookies are small text files placed on your device when you visit a website. They allow the site to remember your preferences, keep you logged in, and perform security checks. Cookies do not contain your personal financial data.</p>
            <p>Similar technologies — such as local storage and session storage — serve the same purposes in web and mobile applications and are covered by this policy.</p>
          </Section>

          <Section num="2" title="Cookies We Use">
            <p>We use only the minimum set of cookies necessary to operate the Services securely. We do <strong>not</strong> use advertising cookies or tracking pixels.</p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 text-[#1A2B4A] font-semibold border border-gray-200">Type</th>
                    <th className="text-left px-4 py-3 text-[#1A2B4A] font-semibold border border-gray-200">Purpose</th>
                    <th className="text-left px-4 py-3 text-[#1A2B4A] font-semibold border border-gray-200">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Session cookies", "Keep you logged in during a single browsing session. Deleted when you close your browser.", "Session"],
                    ["Preference cookies", "Remember your language and display preferences so you don't have to reset them on every visit.", "1 year"],
                    ["Security cookies", "Detect and prevent fraudulent sign-in attempts and protect against cross-site request forgery (CSRF).", "Session"],
                    ["Analytics cookies", "Aggregate, anonymous data about page views and feature usage to help us improve the product. No personal data is shared.", "30 days"],
                  ].map(([type, purpose, duration]) => (
                    <tr key={type as string} className="border border-gray-200">
                      <td className="px-4 py-3 font-medium text-[#1A2B4A]">{type}</td>
                      <td className="px-4 py-3 text-gray-600">{purpose}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section num="3" title="Third-Party Cookies">
            <p>We integrate with the following third-party services that may set their own cookies:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Stripe:</strong> our payment processor may set functional cookies when you interact with payment forms. These cookies are strictly necessary to process payments and are governed by <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#4DC9EE] font-medium hover:underline">Stripe's Privacy Policy</a>.</li>
              <li><strong>Google OAuth:</strong> if you choose to sign in with Google, Google may set its own authentication cookies. These are governed by <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#4DC9EE] font-medium hover:underline">Google's Privacy Policy</a>.</li>
            </ul>
            <p className="mt-3">We do not integrate with any advertising networks, social media tracking pixels, or data brokers.</p>
          </Section>

          <Section num="4" title="How to Control Cookies">
            <p>You can control and manage cookies through your browser settings. Note that disabling certain cookies may affect the functionality of the Services (for example, you may not be able to stay logged in).</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data.</li>
              <li><strong>Firefox:</strong> Options → Privacy & Security → Cookies and Site Data.</li>
              <li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data.</li>
              <li><strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and site data.</li>
            </ul>
            <p className="mt-3">For mobile applications, you can clear app data and cached storage through your device's Settings app.</p>
          </Section>

          <Section num="5" title="Changes to This Policy">
            <p>We may update this Cookie Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of material changes by posting the updated policy on our website with a new effective date. Continued use of the Services after the effective date constitutes your acceptance of the updated policy.</p>
          </Section>

          <Section num="6" title="Contact Us">
            <p>If you have questions about our use of cookies or this Cookie Policy, please contact our Privacy team:</p>
            <div className="mt-3 bg-gray-50 rounded-xl p-5 border border-gray-100">
              <p className="font-semibold text-[#1A2B4A]">S-PAY Privacy Team</p>
              <p>Zawadi Technologies LLC</p>
              <p>Email: <a href="mailto:privacy@spayewallet.com" className="text-[#4DC9EE] font-medium hover:underline">privacy@spayewallet.com</a></p>
            </div>
          </Section>
        </div>

        <div className="mt-14 pt-8 border-t border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <p className="text-gray-400 text-sm">© {new Date().getFullYear()} S-PAY · Zawadi Technologies LLC</p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/privacy">
              <span className="text-[#4DC9EE] font-medium hover:text-[#1A2B4A] transition-colors cursor-pointer">Privacy Policy</span>
            </Link>
            <Link href="/terms">
              <span className="text-gray-500 hover:text-[#1A2B4A] transition-colors cursor-pointer">Terms</span>
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
