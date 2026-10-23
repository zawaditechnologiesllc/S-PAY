import { useLocation } from "wouter";
import { useResendVerification, useStartKyc, type ScoreImprovementAction } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Runs an S-PAY Score improvement action: "kyc" opens the provider's hosted
 * verification, "email" re-sends the confirmation link, "link" navigates.
 */
export function useScoreAction() {
  const [, setLocation] = useLocation();
  const startKyc = useStartKyc();
  const resend = useResendVerification();
  const { toast } = useToast();

  const run = (action: ScoreImprovementAction | null) => {
    if (!action) return;
    if (action.kind === "link" && action.href) {
      setLocation(action.href);
    } else if (action.kind === "kyc") {
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
    } else if (action.kind === "email") {
      resend.mutate(undefined, {
        onSuccess: (r) => toast({ title: "Confirmation email", description: (r as { message?: string })?.message ?? "Sent — check your inbox." }),
        onError: () => toast({ title: "Could not send", description: "Please try again.", variant: "destructive" }),
      });
    }
  };

  return { run, pending: startKyc.isPending || resend.isPending };
}
