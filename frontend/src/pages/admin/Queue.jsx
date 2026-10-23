import { useEffect, useState } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { AlertTriangle, Inbox, Search, UserCheck, UserX } from "lucide-react"
import { EmptyState, ErrorState } from "@/components/feedback"
import { PriorityBadge } from "@/components/tickets/PriorityBadge"
import { TicketStatusBadge } from "@/components/tickets/TicketStatusBadge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApi } from "@/hooks/use-api"
import { formatDateTime, formatHours } from "@/lib/format"
import { CATEGORIES, PRIORITIES, STATUSES } from "@/lib/tickets"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50
const ALL = "all"
const DEFAULTS = { status: "unresolved", category: ALL, priority: ALL, assigned: "any", sort: "urgency" }

const SORTS = [
  ["urgency", "Most urgent first"],
  ["oldest", "Oldest first"],
  ["newest", "Newest first"],
  ["updated", "Recently updated"],
]

/** URL params -> API query string. Status "unresolved" means Open + In Progress. */
function toApiQuery(params) {
  const api = new URLSearchParams()
  const status = params.get("status") ?? DEFAULTS.status
  if (status === "unresolved") ["Open", "In Progress"].forEach((s) => api.append("status", s))
  else if (status !== ALL) api.append("status", status)
  for (const key of ["category", "priority"]) {
    const v = params.get(key)
    if (v && v !== ALL) api.append(key, v)
  }
  for (const [key, apiKey] of [["assigned", "assigned"], ["from", "created_from"], ["to", "created_to"], ["q", "q"], ["sort", "sort"]]) {
    const v = params.get(key)
    if (v) api.append(apiKey, v)
  }
  const page = Number(params.get("page") ?? 1)
  api.append("limit", PAGE_SIZE)
  api.append("offset", (Math.max(page, 1) - 1) * PAGE_SIZE)
  return api.toString()
}

function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, text]) => (
            <SelectItem key={v} value={v}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** The count cards. `data` comes with the queue response, so there is no separate request. */
function Summary({ data }) {
  const cards = [
    ["Open", data?.by_status.Open, Inbox, "?status=Open"],
    ["Critical / High open", data && data.unresolved_by_priority.Critical + data.unresolved_by_priority.High, AlertTriangle, "?"],
    ["Unassigned", data?.unassigned_unresolved, UserX, "?assigned=unassigned"],
    ["Assigned to me", data?.assigned_to_me, UserCheck, "?assigned=me"],
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(([label, value, icon, href]) => (
        <Link key={label} to={href} className="rounded-card">
          <StatCard value={value ?? "–"} label={label} icon={icon} className="p-4 transition-shadow hover:shadow-pop" />
        </Link>
      ))}
    </div>
  )
}

export default function Queue() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  // Refreshes every 10 s (slower while nothing changes) so new tickets and author replies appear
  // on their own. The response also carries the summary counts: one request per refresh.
  const { data, error, loading, reload } = useApi(`/admin/tickets?${toApiQuery(params)}`, { pollMs: 10000 })

  const get = (key) => params.get(key) ?? DEFAULTS[key] ?? ""
  const setParam = (key, value) => {
    // Start from the live URL, not `params`: React Router applies URL changes as a
    // low-priority update, so `params` can still hold filters that were just cleared.
    const next = new URLSearchParams(window.location.search)
    if (!value || value === DEFAULTS[key]) next.delete(key)
    else next.set(key, value)
    next.delete("page") // any filter change goes back to page 1
    setParams(next, { replace: true })
  }

  // Search waits until typing pauses, so we don't call the API on every key.
  const [search, setSearch] = useState(params.get("q") ?? "")
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== search.trim()) setParam("q", search.trim())
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const goToPage = (n) => {
    const next = new URLSearchParams(window.location.search)
    if (n <= 1) next.delete("page")
    else next.set("page", n)
    setParams(next)
  }

  const hasFilters = [...params.keys()].some((k) => k !== "page")
  const page = Number(params.get("page") ?? 1)
  const openTicket = (id) => navigate(`/admin/tickets/${id}`, { state: { from: location.search } })

  return (
    <div className="grid gap-5">
      <Summary data={data?.summary} />

      <Card className="gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="q" className="text-xs text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Subject, author, email or #number"
                className="pl-9"
              />
            </div>
          </div>
          <FilterSelect
            id="f-status"
            label="Status"
            value={get("status")}
            onChange={(v) => setParam("status", v)}
            options={[["unresolved", "Unresolved"], [ALL, "All statuses"], ...STATUSES.map((s) => [s, s])]}
          />
          <FilterSelect
            id="f-priority"
            label="Priority"
            value={get("priority")}
            onChange={(v) => setParam("priority", v)}
            options={[[ALL, "Any priority"], ...PRIORITIES.map((p) => [p, p])]}
          />
          <FilterSelect
            id="f-category"
            label="Category"
            value={get("category")}
            onChange={(v) => setParam("category", v)}
            options={[[ALL, "Any category"], ...CATEGORIES.map((c) => [c, c])]}
          />
          <FilterSelect
            id="f-assigned"
            label="Assigned"
            value={get("assigned")}
            onChange={(v) => setParam("assigned", v)}
            options={[["any", "Anyone"], ["me", "Me"], ["unassigned", "Unassigned"]]}
          />
          <div className="grid gap-1">
            <Label htmlFor="f-from" className="text-xs text-muted-foreground">
              Raised from
            </Label>
            <Input id="f-from" type="date" value={get("from")} max={get("to") || undefined} onChange={(e) => setParam("from", e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="f-to" className="text-xs text-muted-foreground">
              Raised to
            </Label>
            <Input id="f-to" type="date" value={get("to")} min={get("from") || undefined} onChange={(e) => setParam("to", e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="w-52">
            <FilterSelect id="f-sort" label="Sort" value={get("sort")} onChange={(v) => setParam("sort", v)} options={SORTS} />
          </div>
          {hasFilters && (
            <Button
              variant="link"
              className="text-sm"
              onClick={() => {
                setSearch("")
                setParams({}, { replace: true })
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {error ? (
        <ErrorState error={error} onRetry={reload} title="Couldn't load the queue" />
      ) : loading && !data ? (
        <Card className="gap-3 p-4" aria-busy="true" aria-label="Loading tickets">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </Card>
      ) : data.items.length === 0 ? (
        <EmptyState icon={Inbox} title={hasFilters ? "No tickets match these filters" : "No unresolved tickets"}>
          {hasFilters ? "Try clearing some filters." : "All caught up."}
        </EmptyState>
      ) : (
        <Card className={cn("gap-0 overflow-hidden p-0", loading && "opacity-60")}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead title="How long the author has been waiting for us">Waiting</TableHead>
                  <TableHead>Assignee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((t) => (
                  <TableRow
                    key={t.id}
                    onClick={() => openTicket(t.id)}
                    className={cn("cursor-pointer", t.overdue && "bg-danger-soft/50")}
                  >
                    <TableCell className="text-muted-foreground">{t.ticket_number}</TableCell>
                    <TableCell className="max-w-[340px]">
                      <Link
                        to={`/admin/tickets/${t.id}`}
                        state={{ from: location.search }}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-semibold hover:underline"
                      >
                        {t.subject}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.author.name} · {t.book ? t.book.title : "General"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.category}
                      {t.classified_by !== "ai" && (
                        <span className="block text-xs text-muted-foreground">
                          {t.classified_by === "rules" ? "Keyword rules (AI unavailable)" : "Classifying…"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell title={`Raised ${formatDateTime(t.created_at)}`}>
                      {t.waiting_on === "author" ? (
                        <span className="text-xs text-muted-foreground">On author</span>
                      ) : t.status === "Open" || t.status === "In Progress" ? (
                        <span className={cn("inline-flex items-center gap-1 text-sm", t.overdue && "font-bold text-danger-strong")}>
                          {t.overdue && <AlertTriangle aria-hidden="true" className="size-4" />}
                          {formatHours(t.waiting_hours)}
                          {t.overdue && <span className="sr-only">(overdue)</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{t.assignee?.name ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + data.items.length} of {data.total}
              {" · "}red rows have waited over 48 h for a reply
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page * PAGE_SIZE >= data.total} onClick={() => goToPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
