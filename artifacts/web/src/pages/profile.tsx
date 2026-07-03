import { Layout } from "@/components/layout";
import { useStartKyc, useUpdateProfile, useGetKycStatus, getGetKycStatusQueryKey } from "@workspace/api-client-react";
import { useGetMe, getGetMeQueryKey, useDeleteAccount } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme";
import {
  CircleUser, ShieldCheck, LogOut, Wallet, HelpCircle, Trash2, Pencil, Save, X,
  QrCode, Copy, Check, ChevronRight, Lock, Landmark, CreditCard, Building2,
  Mail, FileText, BookOpen, Palette, Bell,
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QRModal } from "@/components/qr-modal";

/**
 * Profile — Payd-style grouped settings: Account, Security, Preferences, Tools,
 * Support, then the "safe section" (sign out + delete) clearly separated at the
 * bottom. Every row maps to a real page/action; nothing decorative.
 */

export default function Profile() {
  const startKyc = useStartKyc();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", phoneNumber: "", country: "", businessName: "" });
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: kyc } = useGetKycStatus({ query: { queryKey: getGetKycStatusQueryKey() } });
  const inFlight = kyc?.verification?.status === "started" && kyc.verification.verificationUrl ? kyc.verification : null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const deleteAccount = useDeleteAccount();
  const [qrOpen, setQrOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const verifyIdentity = () => {
    startKyc.mutate(undefined, {
      onSuccess: (r) => {
        const data = r as { verificationUrl?: string; message?: string };
        if (data.verificationUrl) window.location.href = data.verificationUrl;
        else toast({ title: "Identity verification", description: data.message ?? "You're all set." });
      },
      onError: (err) => toast({
        title: "Identity verification",
        description: (err as { data?: { message?: string } })?.data?.message ?? "Verification is activating soon.",
      }),
    });
  };

  const copySpayId = () => {
    if (!user?.spayId) return;
    navigator.clipboard.writeText(user.spayId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const startEdit = () => {
    setForm({
      fullName: user?.fullName ?? "",
      phoneNumber: user?.phoneNumber ?? "",
      country: user?.country ?? "",
      businessName: user?.businessName ?? "",
    });
    setEditing(true);
  };

  const handleSave = () => {
    const data: Record<string, string | null> = {
      fullName: form.fullName.trim(),
      phoneNumber: form.phoneNumber.trim() || null,
      country: form.country.trim() || null,
    };
    if (user?.accountType === "business") data.businessName = form.businessName.trim();
    updateProfile.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setEditing(false);
        toast({ title: "Profile updated", description: "Your details have been saved." });
      },
      onError: (err) => toast({
        title: "Couldn't save",
        description: (err as { data?: { message?: string } })?.data?.message ?? "Please check your details and try again.",
        variant: "destructive",
      }),
    });
  };

  const handleLogout = () => {
    clearToken();
    setLocation("/login");
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      "This permanently deletes your account, wallet link, and transaction history. This cannot be undone.\n\nDelete your account forever?"
    );
    if (!confirmed) return;
    // Deletion is a money-grade action: when a transaction PIN exists the API
    // requires it, and it refuses while the wallet still holds funds.
    let pin: string | undefined;
    if (user?.hasPin) {
      pin = window.prompt("Enter your transaction PIN to confirm deletion:") ?? undefined;
      if (!pin) return;
    }
    deleteAccount.mutate({ data: pin ? { pin } : {} } as never, {
      onSuccess: () => {
        clearToken();
        setLocation("/");
      },
      onError: (e: unknown) => {
        const data = (e as { data?: { message?: string } })?.data;
        toast({
          title: "Deletion not completed",
          description: data?.message ?? (e as Error)?.message ?? "Please try again or contact support@spayewallet.com",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Layout back title="Profile">
      <div className="space-y-6">

        {/* ── Account ── */}
        <SectionLabel>Account</SectionLabel>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 dark:bg-gray-800/60 border-b pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CircleUser className="text-primary" /> Personal Information
              </CardTitle>
              {!isLoading && !editing && (
                <Button variant="ghost" size="sm" className="text-primary" onClick={startEdit}>
                  <Pencil size={15} className="mr-1.5" /> Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ) : editing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName" className="text-sm text-gray-500 dark:text-gray-400">Full Name</Label>
                  <Input id="fullName" value={form.fullName} maxLength={120}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Your full name" className="mt-1" />
                </div>
                {user?.accountType === "business" && (
                  <div>
                    <Label htmlFor="businessName" className="text-sm text-gray-500 dark:text-gray-400">Business Name</Label>
                    <Input id="businessName" value={form.businessName} maxLength={120}
                      onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                      placeholder="Registered business name" className="mt-1" />
                  </div>
                )}
                <div>
                  <Label htmlFor="phoneNumber" className="text-sm text-gray-500 dark:text-gray-400">Phone Number</Label>
                  <Input id="phoneNumber" type="tel" value={form.phoneNumber} maxLength={32}
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                    placeholder="+254 700 000 000" className="mt-1" />
                  <p className="text-xs text-gray-400 mt-1">Others can send you money using this number.</p>
                </div>
                <div>
                  <Label htmlFor="country" className="text-sm text-gray-500 dark:text-gray-400">Country</Label>
                  <Input id="country" value={form.country} maxLength={56}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                    placeholder="e.g. Kenya" className="mt-1" />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button onClick={handleSave} disabled={updateProfile.isPending || !form.fullName.trim()} className="flex-1">
                    <Save size={16} className="mr-1.5" /> {updateProfile.isPending ? "Saving…" : "Save changes"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)} disabled={updateProfile.isPending}>
                    <X size={16} className="mr-1.5" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <InfoRow label="Full Name" value={user?.fullName ?? "—"} />
                <InfoRow
                  label="Account Type"
                  value={user?.accountType === "business"
                    ? `Business${user?.businessName ? ` — ${user.businessName}` : ""} (KYB)`
                    : "Personal (KYC)"}
                />
                <InfoRow label="Email" value={user?.email ?? "—"} />
                {user?.phoneNumber && <InfoRow label="Phone Number" value={user.phoneNumber} />}
                {user?.country && <InfoRow label="Country" value={user.country} />}
                {user?.spayId && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Your S-PAY ID</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono font-medium text-gray-900 dark:text-gray-100 break-all">{user.spayId}</code>
                      <button onClick={copySpayId} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" aria-label="Copy S-PAY ID">
                        {copiedId ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-gray-400" />}
                      </button>
                      <button onClick={() => setQrOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                        <QrCode size={13} /> Show QR
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Share this so anyone can pay you — no bank details needed.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Account Tier · Daily limit</p>
                    <p className="font-bold text-sm text-[#1A2B4A] dark:text-gray-100">
                      {user?.kycStatus === "approved" ? "Standard · $1,000" : "Basic · $200"}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 border">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Monthly limit</p>
                    <p className="font-bold text-sm text-[#1A2B4A] dark:text-gray-100">
                      {user?.kycStatus === "approved" ? "$10,000" : "$1,000"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Security ── */}
        <SectionLabel>Security</SectionLabel>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-2">
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  user?.kycStatus === 'approved' ? 'bg-green-100 text-green-600' :
                  user?.kycStatus === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
                }`}>
                  <ShieldCheck size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">Identity verification</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user?.kycStatus ?? "…"}</p>
                </div>
              </div>
              {user?.kycStatus !== 'approved' && (
                inFlight ? (
                  <Button variant="outline" size="sm" onClick={() => { window.location.href = inFlight.verificationUrl!; }}>
                    Resume verification
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled={startKyc.isPending} onClick={verifyIdentity}>
                    {startKyc.isPending ? "Starting…" : "Verify Now"}
                  </Button>
                )
              )}
            </div>
            <NavRow href="/security" icon={<Lock size={18} />} title="Transaction PIN & password"
              subtitle={user?.hasPin ? "PIN set — required on every send & withdrawal" : "Set your PIN to unlock sending"} />
          </CardContent>
        </Card>

        {/* ── Preferences ── */}
        <SectionLabel>Preferences</SectionLabel>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-2">
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center flex-shrink-0">
                  <Palette size={18} />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">Appearance</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Light or dark theme</p>
                </div>
              </div>
              <ThemeToggle className="!bg-gray-100 dark:!bg-gray-800 !text-gray-600 dark:!text-gray-300" />
            </div>
            <NavRow href="/support" icon={<Bell size={18} />} title="Notifications" subtitle="In-app alerts for money in & out" />
          </CardContent>
        </Card>

        {/* ── Tools ── */}
        <SectionLabel>Tools</SectionLabel>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-2">
            <NavRow href="/banking" icon={<Landmark size={18} />} title="Bank accounts" subtitle="Your US ACH & EU IBAN details" />
            <NavRow href="/card" icon={<CreditCard size={18} />} title="Virtual card" subtitle="Spend your balance online" />
            {user?.accountType === "business" && (
              <NavRow href="/payroll" icon={<Building2 size={18} />} title="Payroll console" subtitle="Pay your team · API keys · batches" />
            )}
            <button onClick={() => setQrOpen(true)} className="w-full">
              <RowShell icon={<QrCode size={18} />} title="My payment QR" subtitle="Show, save or share it to get paid" />
            </button>
          </CardContent>
        </Card>

        {/* ── Support ── */}
        <SectionLabel>Support</SectionLabel>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-2">
            <NavRow href="/support" icon={<HelpCircle size={18} />} title="Help & support" subtitle="Chat with us in the app" />
            <a href="mailto:support@spayewallet.com" className="block">
              <RowShell icon={<Mail size={18} />} title="Email support" subtitle="support@spayewallet.com" />
            </a>
            <NavRow href="/how-it-works" icon={<BookOpen size={18} />} title="How S-PAY works" subtitle="Deposits, sends, cash-outs & fees" />
            <NavRow href="/privacy" icon={<FileText size={18} />} title="Privacy policy" subtitle="" />
            <NavRow href="/terms" icon={<FileText size={18} />} title="Terms of service" subtitle="" />
          </CardContent>
        </Card>

        {/* ── Safe section: sign out & delete, clearly separated ── */}
        <div className="pt-2 space-y-3">
          <Button variant="destructive" className="w-full rounded-xl" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>

          {/* Account deletion — App Store 5.1.1(v) / Play account-deletion policy.
              Server-enforced: PIN required when set; refused while funds remain. */}
          <button
            onClick={handleDeleteAccount}
            disabled={deleteAccount.isPending}
            className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-700 py-2 disabled:opacity-60"
          >
            <Trash2 size={14} />
            {deleteAccount.isPending ? "Deleting…" : "Delete my account permanently"}
          </button>
        </div>
      </div>

      {user?.spayId && (
        <QRModal open={qrOpen} onClose={() => setQrOpen(false)} spayId={user.spayId} userName={user.fullName ?? ""} />
      )}
    </Layout>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 px-1 -mb-3">{children}</p>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className="font-medium text-gray-900 dark:text-gray-100 break-words">{value}</p>
    </div>
  );
}

function RowShell({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left w-full">
      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>}
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </div>
  );
}

function NavRow({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={href} className="block">
      <RowShell icon={icon} title={title} subtitle={subtitle} />
    </Link>
  );
}
