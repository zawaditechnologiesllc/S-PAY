import { ArrowLeft, FileText } from "lucide-react";
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

export default function Terms() {
  return (
    <PublicLayout>
      {/* Hero banner */}
      <div className="pt-16 bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38]">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#4DC9EE]/20 flex items-center justify-center">
              <FileText size={20} className="text-[#4DC9EE]" />
            </div>
            <span className="text-[#A8DEFF] font-semibold text-sm uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-4xl font-black text-white mb-2">Terms of Service</h1>
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
            These Terms of Service ("Terms") govern your access to and use of the S-PAY platform, mobile application, and related services (collectively, the "Services") provided by Zawadi Technologies LLC ("S-PAY", "we", "us", or "our"). By creating an account or using the Services, you agree to be bound by these Terms. Please read them carefully.
          </p>

          <Section num="1" title="Eligibility">
            <p>To create an S-PAY account and use the Services, you must:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Be at least <strong>18 years of age</strong>.</li>
              <li>Hold a valid, government-issued photo ID (passport, national ID, or driver's licence).</li>
              <li>Reside in a country where S-PAY Services are available.</li>
              <li>Have the legal capacity to enter into a binding agreement.</li>
              <li>Not be a person or entity subject to international sanctions or on any prohibited persons list maintained by the US OFAC, United Nations, European Union, or equivalent body.</li>
            </ul>
            <p className="mt-3">By using the Services, you represent and warrant that you meet all of the above eligibility requirements.</p>
          </Section>

          <Section num="2" title="Account Registration">
            <p>When you register for an S-PAY account, you agree to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Provide accurate, current, and complete information during the registration process.</li>
              <li>Maintain and promptly update your account information to keep it accurate and complete.</li>
              <li>Keep your password and account credentials confidential and not share them with any third party.</li>
              <li>Notify us immediately at <a href="mailto:support@spayewallet.com" className="text-[#4DC9EE] font-medium hover:underline">support@spayewallet.com</a> if you become aware of any unauthorized use of your account.</li>
              <li>Accept responsibility for all activities that occur under your account, whether or not authorized by you.</li>
            </ul>
            <p className="mt-3">We reserve the right to suspend or terminate accounts that provide false, inaccurate, or misleading information.</p>
          </Section>

          <Section num="3" title="Acceptable Use">
            <p>You agree to use the Services only for lawful purposes and in accordance with these Terms. You expressly agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Use the Services for any illegal activity, including fraud, money laundering, terrorist financing, or tax evasion.</li>
              <li>Send or receive funds derived from criminal activity.</li>
              <li>Circumvent, disable, or interfere with security features of the Services.</li>
              <li>Use the Services to make payments for prohibited goods or services as defined by applicable law or our Acceptable Use Policy.</li>
              <li>Attempt to gain unauthorized access to any portion of the Services or related systems.</li>
              <li>Use automated scripts, bots, or other means to access the Services in an unauthorized manner.</li>
              <li>Engage in any conduct that restricts or inhibits anyone's use or enjoyment of the Services.</li>
            </ul>
            <p className="mt-3">Violation of this section may result in immediate account suspension, termination, and reporting to relevant law enforcement or regulatory authorities.</p>
          </Section>

          <Section num="4" title="Wallet & Transactions">
            <p>Your S-PAY wallet allows you to receive, hold, and withdraw funds. The following terms apply to all wallet activity:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Transaction limits:</strong> daily, weekly, and monthly limits apply based on your account verification level (Tier 1, 2, or 3). Limits are displayed in your account dashboard.</li>
              <li><strong>Processing times:</strong> incoming transfers are typically credited within minutes to 1 business day, depending on the originating payment method. Withdrawals are processed within 1 minute to 1 business day, depending on the payout corridor.</li>
              <li><strong>Finality:</strong> once a transaction is submitted and confirmed, it cannot be reversed or cancelled. Please verify all transaction details before submitting.</li>
              <li><strong>Errors:</strong> if you believe a transaction was processed in error, contact support within 30 days of the transaction date.</li>
              <li><strong>Dormant accounts:</strong> accounts with no activity for 12 consecutive months may be subject to dormancy procedures under applicable law.</li>
            </ul>
          </Section>

          <Section num="5" title="Fees">
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Monthly fee:</strong> S-PAY charges no monthly account maintenance fee.</li>
              <li><strong>Receiving payments:</strong> receiving funds into your virtual USD or EUR account is free of charge.</li>
              <li><strong>Withdrawal fees:</strong> a fee may apply when you withdraw funds to mobile money, a local bank account, or via other payout rails. The exact fee is disclosed to you before you confirm any withdrawal.</li>
              <li><strong>Currency conversion:</strong> when converting between currencies, an exchange rate spread may apply. The rate and any applicable fee are displayed prior to confirmation.</li>
              <li><strong>Fee changes:</strong> we reserve the right to modify our fee schedule with at least 14 days' advance notice. Continued use after notice constitutes acceptance of the updated fees.</li>
            </ul>
          </Section>

          <Section num="6" title="KYC / AML Compliance">
            <p>S-PAY is required by applicable law to implement Know Your Customer (KYC) and Anti-Money Laundering (AML) procedures. By using the Services, you agree to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Submit to identity verification, including providing government-issued ID documents and a selfie, before accessing full functionality.</li>
              <li>Provide additional documentation or information upon request for ongoing due diligence.</li>
              <li>Consent to us screening your name, identity, and associated details against sanctions lists and watchlists on an ongoing basis.</li>
            </ul>
            <p className="mt-3">We reserve the right to restrict, suspend, or terminate your account if you fail to complete KYC requirements or if our screening processes identify a potential compliance concern.</p>
          </Section>

          <Section num="7" title="Intellectual Property">
            <p>All content, trademarks, logos, graphics, and software included in or made available through the Services are the exclusive property of Zawadi Technologies LLC or its licensors and are protected by applicable intellectual property laws.</p>
            <p className="mt-3">You are granted a limited, non-exclusive, non-transferable, revocable licence to access and use the Services for personal, non-commercial purposes in accordance with these Terms. You may not copy, modify, distribute, sell, or lease any part of the Services, nor may you reverse-engineer or attempt to extract the source code of our software.</p>
          </Section>

          <Section num="8" title="Disclaimer of Warranties">
            <p>The Services are provided "as is" and "as available" without warranty of any kind. To the fullest extent permitted by law, S-PAY expressly disclaims all warranties, whether express, implied, or statutory, including warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
            <p className="mt-3">We do not warrant that the Services will be uninterrupted, error-free, or free of viruses or other harmful components. Financial market fluctuations, exchange rate movements, and third-party network issues are beyond our control.</p>
          </Section>

          <Section num="9" title="Limitation of Liability">
            <p>To the fullest extent permitted by applicable law, S-PAY and its affiliates, officers, employees, agents, and licensors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, arising out of or in connection with:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Your use of, or inability to use, the Services.</li>
              <li>Delays or failures in initiating, processing, or completing transactions.</li>
              <li>Unauthorized access to or alteration of your data.</li>
              <li>Conduct or content of any third party in connection with the Services.</li>
            </ul>
            <p className="mt-3">Our total liability to you for any claim shall not exceed the greater of (a) the fees paid by you to S-PAY in the three months preceding the event giving rise to liability, or (b) USD $100.</p>
          </Section>

          <Section num="10" title="Termination">
            <p>Either party may terminate the agreement formed by these Terms at any time:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>By you:</strong> you may close your account at any time by contacting support. Funds remaining in your wallet will be returned to you via your verified withdrawal method, subject to applicable laws and regulations.</li>
              <li><strong>By us:</strong> we may suspend or terminate your account immediately, without notice, if you have violated these Terms, engaged in fraudulent activity, or if we are required to do so by law or regulatory order.</li>
            </ul>
            <p className="mt-3">Sections 6, 7, 8, 9, and 11 of these Terms survive termination.</p>
          </Section>

          <Section num="11" title="Governing Law">
            <p>These Terms and any dispute arising out of or related to the Services shall be governed by and construed in accordance with the laws of the <strong>State of Delaware, United States of America</strong>, without regard to its conflict of law provisions.</p>
            <p className="mt-3">Any legal action or proceeding arising under these Terms shall be brought exclusively in the state or federal courts located in Delaware, and you hereby consent to the personal jurisdiction of such courts.</p>
          </Section>

          <Section num="12" title="Contact Us">
            <p>For questions, legal notices, or concerns regarding these Terms of Service, please contact our legal team:</p>
            <div className="mt-3 bg-gray-50 rounded-xl p-5 border border-gray-100 not-italic">
              <p className="font-semibold text-[#1A2B4A]">S-PAY Legal Team</p>
              <p>Zawadi Technologies LLC</p>
              <p>Email: <a href="mailto:legal@spayewallet.com" className="text-[#4DC9EE] font-medium hover:underline">legal@spayewallet.com</a></p>
            </div>
          </Section>
        </div>

        <div className="mt-14 pt-8 border-t border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <p className="text-gray-400 text-sm">© {new Date().getFullYear()} S-PAY · Zawadi Technologies LLC</p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/privacy">
              <span className="text-[#4DC9EE] font-medium hover:text-[#1A2B4A] transition-colors cursor-pointer">Privacy Policy</span>
            </Link>
            <Link href="/cookies">
              <span className="text-gray-500 hover:text-[#1A2B4A] transition-colors cursor-pointer">Cookies</span>
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
