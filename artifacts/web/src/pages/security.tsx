import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetMe, getGetMeQueryKey, useSetTransactionPin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, ShieldCheck, KeyRound } from "lucide-react";

/** Transaction PIN setup & change — the second factor on every money action. */
export default function Security() {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const setPin = useSetTransactionPin();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasPin = me?.hasPin ?? false;

  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPinValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4,6}$/.test(pin)) { setError("PIN must be 4–6 digits."); return; }
    if (pin !== confirm) { setError("The two PINs don't match."); return; }
    if (hasPin && !/^\d{4,6}$/.test(currentPin)) { setError("Enter your current PIN to change it."); return; }
    setPin.mutate(
      { data: { pin, ...(hasPin ? { currentPin } : {}) } },
      {
        onSuccess: (r) => {
          toast({ title: hasPin ? "PIN updated" : "PIN set", description: (r as { message?: string })?.message });
          setCurrentPin(""); setPinValue(""); setConfirm("");
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: (err) => setError((err as { data?: { message?: string } })?.data?.message ?? "Could not save your PIN — try again."),
      },
    );
  };

  return (
    <Layout back title="Security">
      <div className="max-w-md mx-auto space-y-4 mt-2">
        <Card className="border-0 shadow-lg rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-xl bg-[#4DC9EE]/10 text-[#2E8FD6] flex items-center justify-center">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-gray-100">Transaction PIN</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {hasPin ? "Required for every send and withdrawal." : "Set a PIN to start sending money."}
                </p>
              </div>
            </div>

            {hasPin && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 dark:bg-green-950/40 rounded-lg px-3 py-2 mb-4">
                <ShieldCheck size={14} /> A PIN is active on your account.
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              {hasPin && (
                <div className="space-y-1.5">
                  <Label htmlFor="cur-pin">Current PIN</Label>
                  <Input id="cur-pin" type="password" inputMode="numeric" autoComplete="off" placeholder="••••"
                    value={currentPin} onChange={(e) => setCurrentPin(digits(e.target.value))} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="new-pin">{hasPin ? "New PIN" : "Choose a PIN"} (4–6 digits)</Label>
                <Input id="new-pin" type="password" inputMode="numeric" autoComplete="off" placeholder="••••"
                  value={pin} onChange={(e) => setPinValue(digits(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pin">Confirm PIN</Label>
                <Input id="confirm-pin" type="password" inputMode="numeric" autoComplete="off" placeholder="••••"
                  value={confirm} onChange={(e) => setConfirm(digits(e.target.value))} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <Button type="submit" disabled={setPin.isPending} className="w-full bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold">
                <KeyRound size={15} className="mr-1.5" /> {setPin.isPending ? "Saving…" : hasPin ? "Update PIN" : "Set PIN"}
              </Button>
            </form>

            <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
              Never share your PIN. S-PAY staff will never ask for it. After 5 wrong attempts it locks for 15 minutes.
              If you forget it, you can reset it here while signed in.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
