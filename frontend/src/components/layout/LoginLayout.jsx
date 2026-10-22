import { Logo } from "@/components/logo"
import { Card } from "@/components/ui/card"

/** Login frame: tint background with a CSS-only grid + centred 420px white card. */
function LoginLayout({ title, subtitle, children, footer }) {
  return (
    <main className="bg-grid flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-[420px] gap-0 p-6 shadow-pop sm:p-10">
        <Logo className="mb-8 justify-center" />
        {title && <h1 className="text-center text-2xl">{title}</h1>}
        {subtitle && <p className="mt-2 text-center text-lg font-light text-muted-foreground">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </Card>
    </main>
  )
}

export { LoginLayout }
