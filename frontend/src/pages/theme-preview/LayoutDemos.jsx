import { Link } from 'react-router-dom'
import { BookOpen, CirclePlus, Inbox, LayoutDashboard, Ticket, Users } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'
import { AuthLayout } from '../../components/layout/AuthLayout'
import {
  Alert, Badge, Button, Card, Input, PriorityBadge, Select, StatCard, StatusBadge,
  Table, TBody, TD, TH, THead, TR,
} from '../../components/ui'

export function LoginDemo() {
  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your BookLeaf account"
      footer={<Link to="/theme-preview">← Back to theme preview</Link>}
    >
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <Input label="Email" type="email" autoComplete="email" placeholder="you@email.com" required />
        <Input label="Password" type="password" autoComplete="current-password" required />
        <div className="text-right">
          <a href="#" className="text-sm font-semibold">Forgot password?</a>
        </div>
        <Button type="submit" size="lg" shape="pill" className="w-full">Log in</Button>
      </form>
    </AuthLayout>
  )
}

const AUTHOR_NAV = [
  { to: '/theme-preview/author', label: 'My Books', icon: BookOpen, end: true },
  { to: '/theme-preview/author/tickets', label: 'My Tickets', icon: Ticket },
  { to: '/theme-preview/author/new', label: 'New Query', icon: CirclePlus },
]

export function AuthorShellDemo() {
  return (
    <AppShell area="author" navItems={AUTHOR_NAV} title="My Books" user={{ name: 'Sneha Kulkarni' }} onLogout={() => {}}>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard value="₹60,865" label="Total royalty earned" />
          <StatCard value="₹7,865" label="Royalty pending" />
          <StatCard value="2,290" label="Copies sold" />
        </div>
        <Card title="The Algorithm of Love" actions={<Badge variant="success" dot>Published & Live</Badge>}>
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div><dt className="text-muted">ISBN</dt><dd className="font-semibold">978-93-5XXXX-11-0</dd></div>
            <div><dt className="text-muted">MRP</dt><dd className="font-semibold">₹299</dd></div>
            <div><dt className="text-muted">Copies sold</dt><dd className="font-semibold">1,567</dd></div>
            <div><dt className="text-muted">Pending</dt><dd className="font-semibold">₹4,175</dd></div>
          </dl>
        </Card>
        <Card title="Midnight in Mysore" actions={<Badge variant="warning">In Production – Cover Design</Badge>}>
          <p className="text-muted">MRP, sales and royalties will appear once the book is live.</p>
        </Card>
        <Link to="/theme-preview" className="text-sm font-semibold">← Back to theme preview</Link>
      </div>
    </AppShell>
  )
}

const ADMIN_NAV = [
  { to: '/theme-preview/admin', label: 'Ticket Queue', icon: Inbox, end: true },
  { to: '/theme-preview/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/theme-preview/admin/authors', label: 'Authors', icon: Users },
]

export function AdminShellDemo() {
  return (
    <AppShell
      area="admin"
      navItems={ADMIN_NAV}
      title="Ticket Queue"
      user={{ name: 'Ops Admin' }}
      onLogout={() => {}}
      actions={<Button size="sm" className="hidden sm:inline-flex">Assign to me</Button>}
    >
      <div className="space-y-4">
        <Alert variant="warning" title="2 critical tickets older than 48 hours" />
        <Card padding={false}>
          <div className="flex flex-wrap gap-3 border-b border-border p-4">
            <Select className="w-44" options={[{ value: '', label: 'All statuses' }, { value: 'Open', label: 'Open' }]} aria-label="Status" />
            <Select className="w-44" options={[{ value: '', label: 'All priorities' }, { value: 'Critical', label: 'Critical' }]} aria-label="Priority" />
            <Input className="w-56" placeholder="Search subject or author" aria-label="Search" />
          </div>
          <Table>
            <THead><TR><TH>Subject</TH><TH>Category</TH><TH>Priority</TH><TH>Status</TH><TH>Age</TH></TR></THead>
            <TBody>
              <TR onClick={() => {}}>
                <TD className="font-semibold">No royalty received yet</TD><TD>Royalty & Payments</TD>
                <TD><PriorityBadge priority="Critical" /></TD><TD><StatusBadge status="Open" /></TD>
                <TD className="font-semibold text-danger-text">5d</TD>
              </TR>
              <TR onClick={() => {}}>
                <TD className="font-semibold">Book shows unavailable on Amazon</TD><TD>Distribution & Availability</TD>
                <TD><PriorityBadge priority="Medium" /></TD><TD><StatusBadge status="In Progress" /></TD><TD>1d</TD>
              </TR>
            </TBody>
          </Table>
        </Card>
        <Link to="/theme-preview" className="text-sm font-semibold">← Back to theme preview</Link>
      </div>
    </AppShell>
  )
}
