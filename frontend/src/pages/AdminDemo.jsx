import { useLocation } from "react-router-dom"
import { AlertTriangle, Inbox, Timer } from "lucide-react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/context/auth"
import { adminNav } from "./demo-nav"

const priorityVariant = { Critical: "danger", High: "warning", Medium: "info", Low: "neutral" }
const statusVariant = { Open: "default", "In Progress": "warning", Resolved: "success", Closed: "neutral" }

const tickets = [
  { no: 12, subject: "Royalty for October not received", author: "Priya Sharma", category: "Royalty & Payments", priority: "Critical", status: "Open" },
  { no: 11, subject: "Book not visible on Flipkart", author: "Rohit Kapoor", category: "Distribution & Availability", priority: "High", status: "In Progress" },
  { no: 10, subject: "Cover colours look faded", author: "Farhan Sheikh", category: "Printing & Quality", priority: "Medium", status: "Open" },
  { no: 9, subject: "When will typesetting finish?", author: "Ananya Rao", category: "Book Status & Production Updates", priority: "Low", status: "Resolved" },
]

/** Placeholder admin queue to show the shell. Real data comes in a later phase. */
export default function AdminDemo() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const current = adminNav.find((n) => n.to === pathname)

  return (
    <AdminLayout
      title={current?.label ?? "Admin panel"}
      navItems={adminNav}
      user={user}
      onLogout={logout}
      actions={<Button size="sm" className="hidden sm:inline-flex">Export</Button>}
    >
      {pathname !== "/admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Coming soon</CardTitle>
            <CardDescription>This page is a placeholder in the design demo.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-5">
          <Alert variant="warning">
            <AlertTitle>1 critical ticket is unassigned</AlertTitle>
            <AlertDescription>Royalty tickets should get a first reply within 24 hours.</AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard value="24" label="Open tickets" icon={Inbox} />
            <StatCard value="3" label="Critical" icon={AlertTriangle} />
            <StatCard value="5h" label="Avg. first reply" icon={Timer} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input aria-label="Search tickets" placeholder="Search tickets…" className="sm:max-w-xs" />
            <Select defaultValue="all">
              <SelectTrigger aria-label="Filter by status" className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.no}>
                  <TableCell className="text-muted-foreground">{t.no}</TableCell>
                  <TableCell className="font-semibold">{t.subject}</TableCell>
                  <TableCell>{t.author}</TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell><Badge variant={priorityVariant[t.priority]}>{t.priority}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant[t.status]}>{t.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminLayout>
  )
}
