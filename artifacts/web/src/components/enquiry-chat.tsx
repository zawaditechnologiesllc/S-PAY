import { useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { useCreateEnquiry } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function EnquiryChat() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const create = useCreateEnquiry();
  const { toast } = useToast();

  const handleSubmit = () => {
    if (!email.trim() || !subject.trim() || !message.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }

    create.mutate(
      { data: { email: email.trim(), subject: subject.trim(), message: message.trim() } },
      {
        onSuccess: () => {
          setSubmitted(true);
          setTimeout(() => {
            setOpen(false);
            setEmail("");
            setSubject("");
            setMessage("");
            setSubmitted(false);
          }, 2000);
        },
        onError: () => toast({ title: "Could not send message", variant: "destructive" }),
      }
    );
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#4DC9EE] text-white shadow-lg hover:bg-[#2E8FD6] transition-colors flex items-center justify-center"
        aria-label="Contact support"
      >
        <MessageCircle size={24} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end md:justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />

          {/* Chat window */}
          <div className="relative w-full md:w-96 max-w-full bg-white dark:bg-gray-900 rounded-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-[#4DC9EE] to-[#2E8FD6]">
              <div>
                <h3 className="font-bold text-white">Talk to Sales</h3>
                <p className="text-xs text-white/80">We'll get back to you within 24 hours</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-white/60 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Message sent!</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">We'll be in touch soon.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Your email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full mt-2 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Subject</label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Payroll integration for our platform"
                      className="w-full mt-2 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Message</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us about your needs..."
                      rows={4}
                      className="w-full mt-2 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20 resize-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!submitted && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={create.isPending}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[#4DC9EE] text-white text-sm font-semibold hover:bg-[#2E8FD6] transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Send size={16} /> Send
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
