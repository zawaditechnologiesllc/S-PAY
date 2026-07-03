import { Check } from "lucide-react";

/**
 * FlowStepper — the Payd-style guided progress bar that sits at the top of every
 * money flow (deposit, send, withdraw, payout). It always shows the user where
 * they are and where they're going: completed steps collapse to a check, the
 * current step is highlighted with its label, and upcoming steps stay visible
 * so the destination is never a surprise.
 *
 * Usage:
 *   <FlowStepper steps={["Method", "Details", "Review", "Done"]} current={1} />
 */
export function FlowStepper({ steps, current }: { steps: readonly string[]; current: number }) {
  const clamped = Math.max(0, Math.min(current, steps.length - 1));
  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center w-full">
        {steps.map((label, i) => {
          const done = i < clamped;
          const active = i === clamped;
          return (
            <li key={label} className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}>
              <div className="flex flex-col items-center gap-1 min-w-0">
                <span
                  aria-current={active ? "step" : undefined}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors ${
                    done
                      ? "bg-[#4DC9EE] text-white"
                      : active
                        ? "bg-[#1A2B4A] text-white ring-4 ring-[#4DC9EE]/25"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                  }`}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={`text-[10px] font-semibold leading-tight text-center whitespace-nowrap ${
                    active ? "text-[#1A2B4A] dark:text-gray-100" : done ? "text-[#4DC9EE]" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" aria-hidden>
                  <div
                    className="h-full bg-[#4DC9EE] transition-all duration-300"
                    style={{ width: done ? "100%" : "0%" }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
