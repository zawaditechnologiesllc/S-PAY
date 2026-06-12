import { useState } from "react";
import { Layout } from "@/components/layout";
import { useCreateEnquiry, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LifeBuoy, Mail, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

const FAQS = [
  { q: "How do I receive money?", a: "Tap Recharge on the dashboard. Pick where the money comes from — mobile money, bank transfer, or an exchange/wallet — and follow the steps. Your QR code and address are under 'Exchange or wallet'." },
  { q: "How do I send money?", a: "Tap Transfer: send free to any S-PAY member by phone number, or to any Celo wallet address. Transfers settle in ~5 seconds." },
  { q: "How do I cash out to M-Pesa or my bank?", a: "Tap Withdraw, choose Mobile money (M-Pesa, MTN MoMo, Airtel, GCash, Nequi) or a bank method (PIX, SEPA, UK Faster Payments, SPEI, US/Intl), enter the details and confirm." },
  { q: "Why do I need to verify my identity?", a: "Verification (government ID + selfie) unlocks your US bank account, EU IBAN and local cash-outs. Tap Verify on the dashboard banner." },
  { q: "Where does my balance live?", a: "In your own wallet on the Celo network as digital dollars (USDC/USDT) — visible on-chain anytime. S-PAY never holds your private keys." },
];

export default function Support() {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const enquiry = useCreateEnquiry();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!message.trim()) { setError("Tell us what you need help with."); return; }
    enquiry.mutate(
      { data: { name: me?.fullName, email: me?.email ?? "", subject, message, source: "app" } },
      { onSuccess: () => setDone(true), onError: () => setError("Could not send right now — try again in a minute.") },
    );
  };

  return (
    <Layout back title="Help & Support">
      <div className="max-w-xl mx-auto space-y-4 mt-2">
        <Card className="border-0 shadow-lg rounded-2xl">
          <CardContent className="p-5">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2"><LifeBuoy size={18} className="text-[#4DC9EE]" /> Quick answers</h3>
            {FAQS.map((f, i) => (
              <div key={f.q} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between py-3 text-left">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{f.q}</span>
                  {openFaq === i ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
                {openFaq === i && <p className="text-sm text-gray-600 dark:text-gray-400 pb-3 leading-relaxed">{f.a}</p>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg rounded-2xl">
          <CardContent className="p-5">
            {done ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 size={44} className="text-green-500 mx-auto" />
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Message sent</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Our team will reply to {me?.email} — usually within one business day.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Message the team</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sent from your account ({me?.email}) — we reply by email.</p>
                <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} />
                <Textarea rows={4} placeholder="How can we help? *" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} />
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <Button type="submit" disabled={enquiry.isPending} className="w-full bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold">
                  {enquiry.isPending ? "Sending…" : "Send to support"}
                </Button>
              </form>
            )}
            <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1.5"><Mail size={12} /> Prefer email? support@spayewallet.com</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
