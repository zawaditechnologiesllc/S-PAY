import { Layout } from "@/components/layout";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleUser, Mail, Phone, ShieldCheck, LogOut, BadgeCheck, Wallet, Globe, HelpCircle } from "lucide-react";
import { clearToken } from "@/lib/auth";
import { useLocation } from "wouter";

export default function Profile() {
  const { data: user, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    clearToken();
    setLocation("/login");
  };

  return (
    <Layout title="Profile">
      <div className="space-y-6">
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <CircleUser className="text-primary" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Full Name</p>
                  <p className="font-medium text-gray-900">{user?.fullName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="text-gray-400" size={18} />
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Email</p>
                    <p className="font-medium text-gray-900">{user?.email}</p>
                  </div>
                </div>
                {user?.phoneNumber && (
                  <div className="flex items-center gap-3">
                    <Phone className="text-gray-400" size={18} />
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Phone Number</p>
                      <p className="font-medium text-gray-900">{user?.phoneNumber}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="text-primary" /> Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    user?.kycStatus === 'approved' ? 'bg-green-100 text-green-600' :
                    user?.kycStatus === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'
                  }`}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 capitalize">{user?.kycStatus}</h4>
                    <p className="text-sm text-gray-500">Identity Verification</p>
                  </div>
                </div>
                {user?.kycStatus !== 'approved' && (
                  <Button variant="outline" size="sm">Verify Now</Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 border-b pb-4">
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
                  <div className="bg-gray-50 rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 mb-1">Account Tier</p>
                    <p className="font-bold text-[#1A2B4A]">
                      {user?.kycStatus === "approved" ? "Standard" : "Basic"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 mb-1">Daily Limit</p>
                    <p className="font-bold text-[#1A2B4A]">
                      {user?.kycStatus === "approved" ? "$1,000" : "$200"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 mb-1">Monthly Limit</p>
                    <p className="font-bold text-[#1A2B4A]">
                      {user?.kycStatus === "approved" ? "$10,000" : "$1,000"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border">
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <p className="font-bold text-green-600">Active</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-[#4DC9EE]/8 rounded-xl border border-[#4DC9EE]/20">
                  <Globe size={18} className="text-[#4DC9EE] flex-shrink-0" />
                  <p className="text-sm text-gray-600">
                    {user?.kycStatus === "approved"
                      ? "Your identity is verified. You have access to full transfer limits."
                      : "Complete identity verification to unlock higher limits and all features."}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="bg-gray-50 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="text-primary" /> Support
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <a
              href="mailto:support@spayewallet.com"
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border hover:bg-gray-100 transition-colors"
            >
              <div>
                <p className="font-medium text-gray-900 text-sm">Contact Support</p>
                <p className="text-xs text-gray-500 mt-0.5">support@spayewallet.com</p>
              </div>
              <BadgeCheck size={18} className="text-gray-400" />
            </a>
            <a
              href="/privacy"
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border hover:bg-gray-100 transition-colors"
            >
              <p className="font-medium text-gray-900 text-sm">Privacy Policy</p>
              <BadgeCheck size={18} className="text-gray-400" />
            </a>
            <a
              href="/terms"
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border hover:bg-gray-100 transition-colors"
            >
              <p className="font-medium text-gray-900 text-sm">Terms of Service</p>
              <BadgeCheck size={18} className="text-gray-400" />
            </a>
          </CardContent>
        </Card>

        <Button variant="destructive" className="w-full rounded-xl" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </Layout>
  );
}