"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      /**
       * Comfortable 44px hit target follows native mobile slider sizing —
       * the visible track stays slim so the toolbar reads calm, but the
       * pointer/trackpad grab area extends well beyond the thumb.
       */
      "relative flex h-11 w-full touch-none select-none items-center",
      className,
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 grow overflow-hidden rounded-full bg-stone-700/90">
      <SliderPrimitive.Range className="absolute h-full bg-violet-500" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        /** Visible 18px thumb; pseudo-halo expands the pointer hit area to ~32px without changing visuals. */
        "relative block h-[18px] w-[18px] rounded-full border border-stone-500 bg-white shadow-md transition-shadow",
        "after:absolute after:-inset-2 after:rounded-full after:content-['']",
        "hover:shadow-lg hover:ring-2 hover:ring-violet-400/30",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400",
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
