import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded border bg-background px-3 py-2 text-sm text-foreground",
        "border-blood/40 placeholder:text-muted-foreground/50",
        "focus-visible:outline-none focus-visible:border-blood-bright transition-colors",
        "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20",
        "disabled:pointer-events-none disabled:opacity-50",
        "file:text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  )
}

export { Input }
