import { Layout } from "@/components/layout";
import {
  useGetCardDetails, getGetCardDetailsQueryKey,
  useGetCardTransactions, getGetCardTransactionsQueryKey,
  useGetSpendingSummary, getGetSpendingSummaryQueryKey,
  useJoinCardWaitlist, useIssueCard, useGetMe, getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, ShoppingCart, ShieldCheck, Zap, Globe, CheckCircle, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const CARD_PERKS = [
  { icon: <Zap size={15} />, text: "Pay subscriptions, shop online — anywhere Visa is accepted" },
  { icon: <Globe size={15} />, text: "No foreign transaction fees, spend straight from your wallet" },
  { icon: <ShieldCheck size={15} />, text: "Freeze instantly, real-time spend notifications" },
];

export default function CardPage() {
  const { data: cardDetails, isLoading: isLoadingDetails, refetch: refetchCard } = useGetCardDetails({ query: { queryKey: getGetCardDetailsQueryKey() } });
  const { data: txData, isLoading: isLoadingTx } = useGetCardTransactions({}, { query: { queryKey: getGetCardTransactionsQueryKey() } });
  const { data: spendData, isLoading: isLoadingSpend } = useGetSpendingSummary({}, { query: { queryKey: getGetSpendingSummaryQueryKey() } });
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

  const joinWaitlist = useJoinCardWaitlist();
  const issueCard = useIssueCard();
  const { toast } = useToast();

  const handleJoinWaitlist = () => {
    joinWaitlist.mutate(undefined, {
      onSuccess: (data) => {
        toast({ title: "You're on the list!", description: data.message });
        refetchCard();
      },
      onError: () => toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" }),
    });
  };

  const handleCreateCard = () => {
    issueCard.mutate(undefined as never, {
      onSuccess: () => {
        toast({ title: "Card created 🎉", description: "Your S-PAY virtual card is ready to use." });
        refetchCard();
      },
      onError: (e: any) => {
        toast({ title: "Card not created", description: e?.message ?? "Please try again.", variant: "destructive" });
      },
    });
  };

  const status = cardDetails?.cardStatus;
  const isComingSoon = status === "coming_soon" || cardDetails?.isComingSoon;
  const isNotIssued = status === "not_issued";
  const hasCard = Boolean(cardDetails?.hasCard && cardDetails.cards && cardDetails.cards.length > 0);
  const card = cardDetails?.cards?.[0];
  const kycApproved = me?.kycStatus === "approved";
  const cardholderName = (cardDetails?.cardholderName || me?.fullName || "").toUpperCase();

  return (
    <Layout title="Virtual Card">
      <div className="space-y-6 mt-4">

        {/* ── Card display area: coming_soon | not_issued | active ── */}
        {isLoadingDetails ? (
          <Skeleton className="w-full h-56 rounded-2xl" />
        ) : isComingSoon ? (
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-[#1A2B4A] to-[#2E8FD6] text-white text-center">
            <CardContent className="p-10 space-y-6">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm">
                <CreditCard size={40} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Global Virtual Cards</h2>
                <p className="text-blue-200 max-w-sm mx-auto">Spend your wallet balance anywhere Visa or Mastercard is accepted. Coming very soon.</p>
              </div>
              {cardDetails?.onWaitlist ? (
                <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-5 py-2.5 text-sm font-semibold">
                  <CheckCircle size={16} className="text-[#A8DEFF]" /> You're on the waitlist — we'll notify you at launch
                </div>
              ) : (
                <Button
                  onClick={handleJoinWaitlist}
                  disabled={joinWaitlist.isPending}
                  className="bg-white text-[#1A2B4A] hover:bg-[#A8DEFF] font-semibold px-8 py-6 rounded-xl text-md"
                >
                  {joinWaitlist.isPending ? "Joining..." : "Join the Waitlist"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : isNotIssued ? (
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-gradient-to-br from-[#1A2B4A] to-[#2E8FD6] text-white text-center">
            <CardContent className="p-10 space-y-6">
              <div className="w-20 h-20 bg-[#4DC9EE]/30 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm">
                <Sparkles size={36} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">Your virtual card is ready to create</h2>
                <p className="text-blue-200 max-w-sm mx-auto">
                  The S-PAY card program is live. Create your virtual Visa in one tap and start spending your balance worldwide.
                </p>
              </div>
              {kycApproved ? (
                <div className="space-y-2">
                  <Button
                    onClick={handleCreateCard}
                    disabled={issueCard.isPending}
                    className="bg-[#4DC9EE] text-white hover:bg-white hover:text-[#1A2B4A] font-bold px-8 py-6 rounded-xl text-md shadow-lg"
                  >
                    {issueCard.isPending ? "Creating your card..." : "Create My Virtual Card"}
                  </Button>
                  {typeof cardDetails?.issuanceFee === "number" && cardDetails.issuanceFee > 0 && (
                    <p className="text-blue-200 text-xs">
                      One-time creation fee: ${cardDetails.issuanceFee.toFixed(2)} — deducted from your wallet balance.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-300/40 rounded-full px-5 py-2.5 text-sm font-semibold text-amber-100">
                    <ShieldCheck size={16} /> Identity verification required first
                  </div>
                  <div>
                    <Link href="/profile">
                      <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white hover:text-[#1A2B4A] rounded-xl">
                        Complete KYC to unlock your card
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : hasCard && card ? (
          <div className="relative w-full max-w-sm mx-auto aspect-[1.586/1] bg-gradient-to-tr from-[#1A2B4A] to-[#2E8FD6] rounded-2xl shadow-xl overflow-hidden p-6 text-white flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="font-bold tracking-widest text-lg opacity-90">S-PAY</div>
              <div className="flex items-center gap-2">
                {status === "locked" && (
                  <span className="text-[10px] font-bold bg-amber-400/30 border border-amber-300/40 px-2 py-0.5 rounded-full uppercase">Frozen</span>
                )}
                <span className="text-xs font-semibold uppercase opacity-80">{card.network}</span>
              </div>
            </div>
            <div>
              <div className="font-mono text-xl tracking-widest mb-3 opacity-90 flex gap-4">
                <span>••••</span> <span>••••</span> <span>••••</span> <span>{card.last4}</span>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] opacity-60 uppercase mb-1">Cardholder</div>
                  <div className="font-medium text-sm">{cardholderName || "S-PAY MEMBER"}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] opacity-60 uppercase mb-1">Expires</div>
                  <div className="font-medium font-mono">
                    {String(card.expiryMonth).padStart(2, "0")}/{String(card.expiryYear).slice(-2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── What you get (visible until a card is active) ── */}
        {!isLoadingDetails && !hasCard && (
          <Card className="border border-gray-100 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-5 space-y-3">
              {CARD_PERKS.map((p) => (
                <div key={p.text} className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="w-7 h-7 rounded-lg bg-[#4DC9EE]/10 text-[#4DC9EE] flex items-center justify-center flex-shrink-0">{p.icon}</span>
                  {p.text}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Spending & activity (only meaningful once a card exists) ── */}
        {hasCard && (
          <>
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
                  <div className="text-center py-6 text-gray-500 text-sm">No spending yet — your first purchases will show up here.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Total Spent</span>
                      <span className="text-sm font-bold text-gray-900">${spendData.totalSpent.toFixed(2)}</span>
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded-full flex overflow-hidden">
                      {spendData.categories.map((cat, i) => (
                        <div key={i} style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || "#4DC9EE" }} className="h-full" />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-y-3 mt-4">
                      {spendData.categories.map((cat, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || "#4DC9EE" }} />
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
          </>
        )}

      </div>
    </Layout>
  );
}
