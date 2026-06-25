import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

function TooltipProvider({ children, ...props }) {
  return <TooltipPrimitive.Provider {...props}>{children}</TooltipPrimitive.Provider>;
}

function Tooltip({ children, ...props }) {
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({ className, ...props }) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" className={cn("", className)} {...props} />;
}

function TooltipPositioner({ className, sideOffset = 4, ...props }) {
  return <TooltipPrimitive.Positioner data-slot="tooltip-positioner" sideOffset={sideOffset} className={cn("", className)} {...props} />;
}

function TooltipPopup({ className, children, ...props }) {
  return (
    <TooltipPrimitive.Popup
      data-slot="tooltip-popup"
      className={cn(
        "bg-foreground text-background text-xs rounded-md px-2.5 py-1.5 shadow-md z-50 max-w-56 text-center leading-relaxed",
        "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
        "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
        className
      )}
      {...props}>
      {children}
    </TooltipPrimitive.Popup>
  );
}

function TooltipPortal({ ...props }) {
  return <TooltipPrimitive.Portal data-slot="tooltip-portal" {...props} />;
}

function TooltipArrow({ className, ...props }) {
  return <TooltipPrimitive.Arrow data-slot="tooltip-arrow" className={cn("fill-foreground", className)} {...props} />;
}

function TooltipBox({ label, children, side = "top", delay = 300, className, ...props }) {
  if (!label) return children;
  return (
    <TooltipPrimitive.Root closeDelay={100} openDelay={delay} {...props}>
      <TooltipPrimitive.Trigger render={<span />}>
        <span className={cn("inline-flex", className)}>{children}</span>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={4} align="center">
          <TooltipPrimitive.Popup className="bg-foreground text-background text-xs rounded-md px-2.5 py-1.5 shadow-md z-50 max-w-56 text-center leading-relaxed data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            {label}
            <TooltipPrimitive.Arrow className="fill-foreground" />
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipPositioner,
  TooltipPopup,
  TooltipArrow,
  TooltipPortal,
  TooltipBox,
}
