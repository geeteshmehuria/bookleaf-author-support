import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner } from "sonner"

// Light theme only (no dark mode yet). Typed toasts use *-strong text on soft backgrounds.
const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "font-sans !rounded-md !shadow-pop",
          title: "!font-bold",
          description: "!text-current",
          success: "!bg-success-soft !text-success-strong !border-success/40",
          warning: "!bg-warning-soft !text-warning-strong !border-warning/40",
          error: "!bg-danger-soft !text-danger-strong !border-destructive/40",
          info: "!bg-info-soft !text-info-strong !border-info/40",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)"
        }
      }
      {...props}
    />
  );
}

export { Toaster }
