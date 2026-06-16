import { Layout } from "@/components/layout";
import { useStartKyc, useUpdateProfile } from "@workspace/api-client-react";
import { useGetMe, getGetMeQueryKey, useDeleteAccount } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleUser, Mail, Phone, ShieldCheck, LogOut, BadgeCheck, Wallet, Globe, HelpCircle, Link2, Trash2, Pencil, Save, X, MapPin } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function Profile() {
  const startKyc = useStartKyc();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", phoneNumber: "", country: "", businessName: "" });
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
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const deleteAccount = useDeleteAccount();

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
    deleteAccount.mutate(undefined as never, {
      onSuccess: () => {
        clearToken();
        setLocation("/");
      },
      onError: (e: any) => {
        toast({
          title: "Deletion failed",
          description: e?.message ?? "Please try again or contact support@spayewallet.com",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Layout back title="Profile">
      <div className="space-y-6">
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
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Full Name</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{user?.fullName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Account Type</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {user?.accountType === "business"
                      ? `Business${user?.businessName ? ` — ${user.businessName}` : ""} (KYB)`
                      : "Personal (KYC)"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="text-gray-400" size={18} />
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{user?.email}</p>
                  </div>
                </div>
                {user?.phoneNumber && (
                  <div className="flex items-center gap-3">
                    <Phone className="text-gray-400" size={18} />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Phone Number</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{user?.phoneNumber}</p>
                    </div>
                  </div>
                )}
                {user?.country && (
                  <div className="flex items-center gap-3">
                    <MapPin className="text-gray-400" size={18} />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Country</p>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{user?.country}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 dark:bg-gray-800/60 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="text-primary" /> Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    user?.kycStatus === 'approved' ? 'bg-green-100 text-green-600' :
                    user?.kycStatus === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
                  }`}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 capitalize">{user?.kycStatus}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Identity Verification</p>
                  </div>
                </div>
                {user?.kycStatus !== 'approved' && (
                  <Button variant="outline" size="sm" disabled={startKyc.isPending} onClick={verifyIdentity}>
                    {startKyc.isPending ? "Starting…" : "Verify Now"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 dark:bg-gray-800/60 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="text-primary" /> Account & Limits
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Account Tier</p>
                    <p className="font-bold text-[#1A2B4A]">
                      {user?.kycStatus === "approved" ? "Standard" : "Basic"}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Daily Limit</p>
                    <p className="font-bold text-[#1A2B4A]">
                      {user?.kycStatus === "approved" ? "$1,000" : "$200"}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monthly Limit</p>
                    <p className="font-bold text-[#1A2B4A]">
                      {user?.kycStatus === "approved" ? "$10,000" : "$1,000"}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status</p>
                    <p className="font-bold text-green-600">Active</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-[#4DC9EE]/8 rounded-xl border border-[#4DC9EE]/20">
                  <Globe size={18} className="text-[#4DC9EE] flex-shrink-0" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user?.kycStatus === "approved"
                      ? "Your identity is verified. You have access to full transfer limits."
                      : "Complete identity verification to unlock higher limits and all features."}
                  </p>
                </div>
                {user?.celoWalletAddress && (
                  <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FCFF52] border border-gray-200 dark:border-gray-700 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5 flex items-center gap-1"><Link2 size={11} /> Celo Wallet — Built on Celo</p>
                      <p className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">{user.celoWalletAddress}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 dark:bg-gray-800/60 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="text-primary" /> Support
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <a
              href="mailto:support@spayewallet.com"
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">Contact Support</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">support@spayewallet.com</p>
              </div>
              <BadgeCheck size={18} className="text-gray-400" />
            </a>
            <a
              href="/privacy"
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">Privacy Policy</p>
              <BadgeCheck size={18} className="text-gray-400" />
            </a>
            <a
              href="/terms"
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">Terms of Service</p>
              <BadgeCheck size={18} className="text-gray-400" />
            </a>
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full rounded-xl" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>

        {/* Account deletion — App Store 5.1.1(v) / Play account-deletion policy */}
        <button
          onClick={handleDeleteAccount}
          disabled={deleteAccount.isPending}
          className="w-full flex items-center justify-center gap-2 text-sm text-red-500 hover:text-red-700 py-2 disabled:opacity-60"
        >
          <Trash2 size={14} />
          {deleteAccount.isPending ? "Deleting…" : "Delete my account permanently"}
        </button>
      </div>
    </Layout>
  );
}