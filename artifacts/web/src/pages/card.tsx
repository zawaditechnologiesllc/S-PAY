import { Layout } from "@/components/layout";
import { 
  useGetCardDetails, getGetCardDetailsQueryKey,
  useGetCardTransactions, getGetCardTransactionsQueryKey,
  useGetSpendingSummary, getGetSpendingSummaryQueryKey,
  useJoinCardWaitlist
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ShoppingCart, ScanEye, SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CardPage() {
  const { data: cardDetails, isLoading: isLoadingDetails, refetch: refetchCard } = useGetCardDetails({ query: { queryKey: getGetCardDetailsQueryKey() } });
  const { data: txData, isLoading: isLoadingTx } = useGetCardTransactions({}, { query: { queryKey: getGetCardTransactionsQueryKey() } });
  const { data: spendData, isLoading: isLoadingSpend } = useGetSpendingSummary({}, { query: { queryKey: getGetSpendingSummaryQueryKey() } });
  
  const joinWaitlist = useJoinCardWaitlist();
  const { toast } = useToast();

  const handleJoinWaitlist = () => {
    joinWaitlist.mutate(undefined, {
      onSuccess: () => {
        toast({ title: "Joined Waitlist", description: "We'll notify you when cards are available." });
        refetchCard();
      }
    });
  };

  const isComingSoon = cardDetails?.isComingSoon || cardDetails?.cardStatus === 'coming_soon';

  return (
    <Layout title="Virtual Card">
      <div className="space-y-6 mt-4">
        
        {/* Card Display Area */}
        {isLoadingDetails ? (
          <Skeleton className="w-full h-56 rounded-2xl" />
        ) : isComingSoon ? (
           <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-center">
            <CardContent className="p-10 space-y-6">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm">
                <CreditCard size={40} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Global Virtual Cards</h2>
                <p className="text-indigo-100 max-w-sm mx-auto">Spend your stablecoin balance anywhere Visa or Mastercard is accepted. Coming very soon.</p>
              </div>
              <Button 
                onClick={handleJoinWaitlist} 
                disabled={joinWaitlist.isPending}
                className="bg-white text-indigo-600 hover:bg-indigo-50 font-semibold px-8 py-6 rounded-xl text-md"
              >
                {joinWaitlist.isPending ? "Joining..." : "Join the Waitlist"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="relative w-full max-w-sm mx-auto aspect-[1.586/1] bg-gradient-to-tr from-gray-900 to-gray-800 rounded-2xl shadow-xl overflow-hidden p-6 text-white flex flex-col justify-between">
             {/* SIMULATED ACTIVE CARD STATE (Fallback if active) */}
             <div className="flex justify-between items-start">
                <div className="font-bold tracking-widest text-lg opacity-80">S-PAY</div>
                <div className="w-10 h-6 bg-yellow-200/20 rounded flex items-center justify-center backdrop-blur-sm">
                  <div className="w-6 h-4 bg-yellow-300/40 rounded-sm"></div>
                </div>
             </div>
             <div>
               <div className="font-mono text-xl tracking-widest mb-2 opacity-90 flex gap-4">
                 <span>••••</span> <span>••••</span> <span>••••</span> <span>{cardDetails?.cards?.[0]?.last4 || '4242'}</span>
               </div>
               <div className="flex justify-between items-end">
                 <div>
                   <div className="text-[10px] opacity-60 uppercase mb-1">Cardholder</div>
                   <div className="font-medium">JOHN DOE</div>
                 </div>
                 <div className="text-right">
                   <div className="text-[10px] opacity-60 uppercase mb-1">Expires</div>
                   <div className="font-medium font-mono">{cardDetails?.cards?.[0]?.expiryMonth || '12'}/{cardDetails?.cards?.[0]?.expiryYear || '28'}</div>
                 </div>
               </div>
             </div>
          </div>
        )}

        {/* Quick Actions (Only if active) */}
        {!isComingSoon && !isLoadingDetails && (
           <div className="grid grid-cols-2 gap-4">
             <Button variant="outline" className="h-12 rounded-xl bg-white"><ScanEye className="mr-2" size={18} /> Show Details</Button>
             <Button variant="outline" className="h-12 rounded-xl bg-white"><SlidersHorizontal className="mr-2" size={18} /> Manage Card</Button>
           </div>
        )}

        {/* Spending Summary */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-gray-50 border-b pb-4">
            <CardTitle className="text-md flex items-center gap-2 text-gray-800">
              <ShoppingCart size={18} className="text-primary" /> Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isLoadingSpend ? (
              <div className="space-y-4">
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-3/4" />
              </div>
            ) : !spendData?.categories || spendData.categories.length === 0 ? (
               <div className="text-center py-6 text-gray-500 text-sm">No spending data available</div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Total Spent</span>
                  <span className="text-sm font-bold text-gray-900">${spendData.totalSpent.toFixed(2)}</span>
                </div>
                
                {/* Progress bar graph */}
                <div className="h-3 w-full bg-gray-100 rounded-full flex overflow-hidden">
                  {spendData.categories.map((cat, i) => (
                    <div key={i} style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || '#4DC9EE' }} className="h-full" />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-y-3 mt-4">
                  {spendData.categories.map((cat, i) => (
                     <div key={i} className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#4DC9EE' }} />
                       <div className="text-xs">
                         <span className="text-gray-600 block">{cat.category}</span>
                         <span className="font-semibold text-gray-900">{cat.percentage}%</span>
                       </div>
                     </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Card Transactions */}
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-gray-50 border-b pb-4">
            <CardTitle className="text-md text-gray-800">Recent Card Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
             {isLoadingTx ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-2">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : txData?.transactions.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No card transactions yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {txData?.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                        {tx.merchantLogo ? (
                          <img src={tx.merchantLogo} alt={tx.merchantName} className="w-full h-full object-cover" />
                        ) : (
                          <ShoppingCart size={18} className="text-gray-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{tx.merchantName}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-500">{tx.category}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 text-sm">
                        -${tx.amount.toFixed(2)}
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