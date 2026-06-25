import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-[88px] w-full rounded-lg border border-[#D4DDE8] bg-white px-3 py-2.5 text-sm text-[#121B2B] transition-colors outline-none placeholder:text-[#94A3B8] focus-visible:border-[#EFAF1A] focus-visible:ring-2 focus-visible:ring-[#EFAF1A]/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props} />
  );
}

export { Textarea }
