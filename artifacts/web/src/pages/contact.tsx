import { Mail, Clock, Briefcase, Scale, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { useCreateEnquiry } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";

const FAQ = [
  {
    q: "How long does identity verification (KYC) take?",
    a: "Most verifications are completed automatically within minutes. In rare cases where manual review is needed, it may take 1–3 business days.",
  },
  {
    q: "What documents do I need for KYC?",
    a: "You need a valid government-issued photo ID (passport, national ID, or driver's licence) and a selfie. No physical documents need to be mailed.",
  },
  {
    q: "Which countries are supported for payouts?",
    a: "We support 180+ countries. Popular corridors include Kenya (M-Pesa), Nigeria (bank transfer), Ghana (MTN MoMo), Uganda (MTN), Brazil (PIX), and all SEPA countries. The full list is available in your account dashboard.",
  },
  {
    q: "How long do withdrawals take?",
    a: "Mobile money payouts (M-Pesa, MTN, etc.) typically arrive within minutes. Bank transfers usually settle within 1–2 business days depending on the destination country and local banking rails.",
  },
  {
    q: "Is S-PAY safe and regulated?",
    a: "We protect your account with bank-grade AES-256 encryption at rest, TLS 1.2+ in transit, and a separate transaction PIN that authorizes every payment. Identity verification (KYC) unlocks full features, and cross-border payouts are processed through licensed payment partners that perform AML and sanctions screening.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 md:px-6 py-4 md:py-5 text-left bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-semibold text-[#1A2B4A] text-sm pr-4">{q}</span>
        {open ? <ChevronUp size={18} className="text-[#4DC9EE] flex-shrink-0" /> : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 text-sm text-gray-600 leading-relaxed bg-white border-t border-gray-50">
          {a}
        </div>
      )}
    </div>
  );
}

export default function Contact() {
  return (
    <PublicLayout active="contact">

      {/* Hero */}
      <section className="pt-16 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="max-w-4xl mx-auto px-5 md:px-6 pt-14 pb-14 md:pt-20 md:pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full mb-5 md:mb-6 border border-white/20">
            <Mail size={12} /> We're here to help
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 md:mb-5 leading-tight">
            Get in Touch
          </h1>
          <p className="text-base md:text-xl text-blue-200 max-w-xl mx-auto leading-relaxed">
            Have a question, partnership idea, or legal inquiry? Reach the right team directly.
          </p>
        </div>
      </section>

      {/* Contact cards */}
      <section className="py-12 md:py-20 px-5 md:px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              {
                icon: <Clock size={26} />,
                color: "#4DC9EE",
                title: "Customer Support",
                email: "support@spayewallet.com",
                desc: "Account issues, transaction questions, and general help. We respond within 24 hours on business days.",
                note: "Mon – Fri · 9 am – 6 pm UTC",
              },
              {
                icon: <Briefcase size={26} />,
                color: "#22C55E",
                title: "Partnerships & Business",
                email: "partnerships@spayewallet.com",
                desc: "API integrations, B2B partnerships, payment corridor discussions, and enterprise enquiries.",
                note: "We'll respond within 2 business days",
              },
              {
                icon: <Scale size={26} />,
                color: "#F59E0B",
                title: "Legal & Compliance",
                email: "legal@spayewallet.com",
                desc: "Legal notices, data privacy requests (GDPR/CCPA), compliance questions, and regulatory matters.",
                note: "Response within 5 business days",
              },
            ].map((card) => (
              <div key={card.title} className="bg-gray-50 rounded-3xl p-7 border border-gray-100 hover:shadow-md transition-shadow">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-5 shadow-sm"
                  style={{ backgroundColor: card.color }}
                >
                  {card.icon}
                </div>
                <h3 className="font-bold text-[#1A2B4A] text-lg mb-2">{card.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">{card.desc}</p>
                <a
                  href={`mailto:${card.email}`}
                  className="text-[#4DC9EE] font-semibold text-sm hover:text-[#2E8FD6] transition-colors break-all"
                >
                  {card.email}
                </a>
                <p className="text-gray-400 text-xs mt-2">{card.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 md:py-20 px-5 md:px-6 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">FAQ</span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-[#1A2B4A] mt-3 mb-4">Frequently asked questions</h2>
            <p className="text-gray-500">Quick answers to the most common questions.</p>
          </div>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6 bg-[#4DC9EE]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white mb-4">Still have questions?</h2>
          <p className="text-blue-50 mb-8">Our support team typically replies within one business day.</p>
          <button
            onClick={() => {
              const btn = document.querySelector('[aria-label="Contact support"]') as HTMLButtonElement | null;
              btn?.click();
            }}
            className="inline-flex items-center gap-2 bg-[#1A2B4A] text-white font-bold px-8 py-4 rounded-2xl hover:bg-[#0d1f38] transition-colors shadow-lg"
          >
            <Mail size={18} /> Chat with us
          </button>
        </div>
      </section>


        {/* One funnel for every enquiry — lands in Admin → Enquiries */}
        <EnquiryForm />
    </PublicLayout>
  );
}

function EnquiryForm() {
  const enquiry = useCreateEnquiry();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/.+@.+\..+/.test(form.email) || !form.message.trim()) {
      setError("Please add a valid email and a message.");
      return;
    }
    enquiry.mutate(
      { data: { ...form, source: "contact" } },
      {
        onSuccess: () => setDone(true),
        onError: () => setError("Could not send right now — please try again in a minute."),
      },
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
        {done ? (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 size={48} className="text-green-500 mx-auto" />
            <h3 className="text-xl font-black text-[#1A2B4A]">Message received</h3>
            <p className="text-sm text-gray-500">Our team will reply to {form.email} — usually within one business day.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h3 className="text-xl font-black text-[#1A2B4A]">Send us a message</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input type="email" placeholder="Email address *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <Input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            <Textarea rows={5} placeholder="How can we help? *" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" disabled={enquiry.isPending} className="bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold px-8">
              {enquiry.isPending ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
