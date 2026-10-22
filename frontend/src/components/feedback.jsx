import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/** Placeholder cards while data loads. */
export function LoadingCards({ count = 2, label = "Loading" }) {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="gap-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-16 w-full" />
        </Card>
      ))}
    </div>
  )
}

/** A failed request, with a way to try again. */
export function ErrorState({ error, onRetry, title = "Couldn't load this page" }) {
  return (
    <Alert variant="danger">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{error?.message ?? "Something went wrong."}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

/** Nothing to show yet. */
export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <Card className="items-center gap-3 py-10 text-center">
      {Icon && <Icon aria-hidden="true" className="size-10 text-brand" />}
      <h2 className="text-lg">{title}</h2>
      {children && <p className="max-w-sm text-muted-foreground">{children}</p>}
      {action}
    </Card>
  )
}
