import { useState, useEffect } from "react";
import { X, Copy, Check, Download } from "lucide-react";
import { brandedQRDataUrl } from "@/lib/branded-qr";

interface QRModalProps {
  open: boolean;
  onClose: () => void;
  spayId: string;
  userName: string;
}

export function QRModal({ open, onClose, spayId, userName }: QRModalProps) {
  const [qrUrl, setQrUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && spayId) {
      brandedQRDataUrl(spayId, 320).then(setQrUrl).catch(() => setQrUrl(""));
    }
  }, [open, spayId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(spayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;                                   // already a branded PNG data URL
    a.download = `spay-id-${spayId}.png`;
    a.click();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-gray-100">Your S-PAY ID</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Share to receive payments</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* QR Code */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-4 rounded-xl border border-gray-100">
              {qrUrl
                ? <img src={qrUrl} alt="S-PAY ID QR Code" className="w-64 h-64" />
                : <div className="w-64 h-64 bg-gray-100 rounded-lg animate-pulse" />}
            </div>
            <button
              onClick={handleDownload}
              disabled={!qrUrl}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4DC9EE] hover:text-[#2E8FD6] transition-colors disabled:opacity-50"
            >
              <Download size={15} /> Save QR code
            </button>
          </div>

          {/* S-PAY ID Display */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your S-PAY ID</p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-700">
              <code className="flex-1 text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                {spayId}
              </code>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check size={16} className="text-green-600" />
                ) : (
                  <Copy size={16} className="text-gray-400" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Share this QR code or ID with friends, employers, or on social media so they can send you money directly.
            </p>
          </div>

          {/* Name */}
          <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-100 dark:border-blue-500/20">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Registered as</p>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mt-1">{userName}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 px-4 py-2.5 rounded-lg bg-[#4DC9EE] text-white font-semibold hover:bg-[#2E8FD6] transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Copy size={16} /> {copied ? "Copied!" : "Copy ID"}
          </button>
        </div>
      </div>
    </div>
  );
}
