import { Layout } from "@/components/layout";
import { 
  useGetBankingAccounts, getGetBankingAccountsQueryKey,
  useGetIncomingPayments, getGetIncomingPaymentsQueryKey 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Landmark, ArrowDownToLine, Plus, Copy, CheckCircle2, CircleDollarSign } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Banking() {
  const { data: bankingData, isLoading: isLoadingAccounts } = useGetBankingAccounts({ query: { queryKey: getGetBankingAccountsQueryKey() } });
  const { data: paymentsData, isLoading: isLoadingPayments } = useGetIncomingPayments({}, { query: { queryKey: getGetIncomingPaymentsQueryKey() } });
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied to clipboard",
      description: "Account details copied successfully.",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Layout title="Banking">
      <div className="space-y-6 mt-4">
        
        {/* Virtual Accounts */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Virtual Accounts</h2>
            <Button variant="outline" size="sm" className="rounded-full text-primary border-primary">
              <Plus size={16} className="mr-1" /> Add Account
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isLoadingAccounts ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-md rounded-2xl">
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-24 mb-4" />
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))
            ) : !bankingData?.accounts || bankingData.accounts.length === 0 ? (
              <Card className="border border-dashed border-gray-200 rounded-2xl md:col-span-2 bg-gray-50/60">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#4DC9EE]/10 text-[#4DC9EE] flex items-center justify-center mx-auto">
                    <CircleDollarSign size={26} />
                  </div>
                  <h3 className="font-semibold text-gray-900">Your virtual accounts are coming</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Once verification is approved (KYC for personal, KYB for business accounts), S-PAY issues a real US account
                    (ACH routing + account number) and a European IBAN — in your name, or your company's name on business accounts.
                  </p>
                </CardContent>
              </Card>
            ) : (
              bankingData.accounts.map(account => (
                <Card key={account.id} className="border-0 shadow-md rounded-2xl overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <CircleDollarSign size={80} />
                  </div>
                  <CardContent className="p-6 relative z-10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="text-xs font-bold px-2 py-1 bg-gray-100 rounded mb-2 inline-block">
                          {account.currency} ACCOUNT
                        </div>
                        <h3 className="font-semibold text-gray-900">{account.bankName}</h3>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium capitalize
                        ${account.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {account.status}
                      </div>
                    </div>
                    
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      {account.accountNumber && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Account Number</span>
                          <div className="flex items-center gap-2 font-mono text-sm font-medium">
                            {account.accountNumber}
                            <button onClick={() => copyToClipboard(account.accountNumber!, `acc-${account.id}`)} className="text-gray-400 hover:text-primary transition-colors">
                              {copiedId === `acc-${account.id}` ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      )}
                      {account.routingNumber && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Routing Number</span>
                          <div className="flex items-center gap-2 font-mono text-sm font-medium">
                            {account.routingNumber}
                            <button onClick={() => copyToClipboard(account.routingNumber!, `rout-${account.id}`)} className="text-gray-400 hover:text-primary transition-colors">
                              {copiedId === `rout-${account.id}` ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      )}
                      {account.iban && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">IBAN</span>
                          <div className="flex items-center gap-2 font-mono text-sm font-medium">
                            {account.iban}
                            <button onClick={() => copyToClipboard(account.iban!, `iban-${account.id}`)} className="text-gray-400 hover:text-primary transition-colors">
                              {copiedId === `iban-${account.id}` ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
            <Link href="/banking/withdraw">
              <Button className="w-full h-14 rounded-xl text-md" variant="default">
                Withdraw Funds
              </Button>
            </Link>
            <Button className="w-full h-14 rounded-xl text-md bg-white text-primary hover:bg-gray-50 shadow-sm border" variant="outline">
              Receive Payments
            </Button>
        </div>

        {/* Incoming Payments */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-gray-50 border-b pb-4">
            <CardTitle className="text-md flex items-center gap-2 text-gray-800">
              <ArrowDownToLine className="text-primary" /> Incoming Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingPayments ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-2">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : paymentsData?.payments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No incoming payments yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {paymentsData?.payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-primary">
                        <Landmark size={18} />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{payment.sender}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{payment.paymentType}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(payment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 text-sm">
                        +{payment.currency} {payment.amount.toFixed(2)}
                      </div>
                      <div className={`text-[10px] font-medium capitalize mt-1
                        ${payment.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                        {payment.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}