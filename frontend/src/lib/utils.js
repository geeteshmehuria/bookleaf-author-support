import { clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge our custom radius/shadow names so cn() can override them.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["card", "pill"],
      shadow: ["card", "pop"],
    },
  },
})

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Solid 2px keyboard-focus outline for buttons, links, checkboxes, nav items. */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"

/**
 * Shared look for text inputs, textareas and select triggers:
 * 40px, 1px input border, 8px radius. Focus = brand border + 30% halo
 * (the halo alone fails 3:1, the border carries the contrast).
 * Errors via aria-invalid.
 */
export const fieldBase =
  "w-full min-w-0 rounded-md border border-input bg-surface px-3 text-sm text-foreground transition-[color,border-color,box-shadow] outline-none placeholder:text-muted-foreground " +
  "focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-ring/30 " +
  "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30 aria-invalid:ring-2 aria-invalid:ring-destructive/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50"
