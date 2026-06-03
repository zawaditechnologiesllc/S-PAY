import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const SpinnerIcon = Loader2Icon as React.ComponentType<{ className?: string; role?: string; "aria-label"?: string }>

function Spinner({ className }: { className?: string }) {
  return (
    <SpinnerIcon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
    />
  )
}

export { Spinner }
