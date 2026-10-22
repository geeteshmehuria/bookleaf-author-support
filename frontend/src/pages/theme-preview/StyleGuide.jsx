import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Sparkles } from 'lucide-react'
import {
  Alert, Badge, Button, buttonClass, Card, Checkbox, Input, PriorityBadge, Select, StatCard,
  StatusBadge, Table, TableEmpty, TBody, TD, TH, THead, TR, Textarea, useToast,
} from '../../components/ui'

const COLOR_GROUPS = [
  ['Brand', ['primary', 'primary-strong', 'primary-hover', 'primary-ink', 'primary-soft', 'accent', 'tint', 'tint-2']],
  ['Text', ['text', 'text-muted', 'link']],
  ['Surfaces & borders', ['surface', 'surface-2', 'surface-3', 'border', 'border-strong']],
  ['Semantic', ['success', 'success-text', 'success-bg', 'warning', 'warning-text', 'warning-bg',
    'danger', 'danger-text', 'danger-bg', 'info', 'info-text', 'info-bg']],
]

// Ratios measured with the WCAG 2.x formula (see README "Design system").
const CONTRAST = [
  ['White on primary-strong (buttons)', '4.66', true],
  ['White on primary-hover', '5.11', true],
  ['primary-ink on white (coral text)', '6.27', true],
  ['primary-ink on tint (badges, active nav)', '5.30', true],
  ['text-muted on white / tint', '6.48 / 5.49', true],
  ['accent on white (32px bold stats, large text)', '4.03', true],
  ['border-strong on white (input outline, 3:1 rule)', '4.54', true],
  ['White on primary (#E84F5F) — not used for text', '3.67', false],
  ['primary on tint — not used for text', '3.11', false],
  ['White on primary-soft — decoration only', '3.01', false],
]

const TYPE_SCALE = [
  ['text-4xl', '40px', 'font-extrabold'],
  ['text-3xl', '32px', 'font-extrabold'],
  ['text-2xl', '24px', 'font-extrabold'],
  ['text-xl', '20px', 'font-extrabold'],
  ['text-lg', '18px', 'font-semibold'],
  ['text-base', '16px', 'font-normal'],
  ['text-sm', '14px (app body)', 'font-normal'],
  ['text-xs', '12px', 'font-normal'],
]

function Section({ title, children }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl">{title}</h2>
      {children}
    </section>
  )
}

export default function StyleGuide() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 md:px-8">
      <header className="space-y-2">
        <Badge>Dev only</Badge>
        <h1 className="text-3xl">BookLeaf design system</h1>
        <p className="text-muted">
          Tokens live in <code>src/styles/tokens.css</code>. Components in <code>src/components/ui</code>.
        </p>
        <nav className="flex flex-wrap gap-2 pt-2">
          <Link to="login" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Login layout</Link>
          <Link to="author" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Author shell</Link>
          <Link to="admin" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Admin shell</Link>
        </nav>
      </header>

      <Section title="Colors">
        {COLOR_GROUPS.map(([group, names]) => (
          <div key={group}>
            <h3 className="mb-2 text-sm text-muted">{group}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {names.map((n) => (
                <div key={n} className="overflow-hidden rounded-input border border-border bg-surface">
                  <div className="h-14" style={{ background: `var(--${n})` }} />
                  <p className="px-2 py-1.5 text-xs font-semibold">--{n}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Contrast checks (WCAG AA)">
        <Card padding={false}>
          <Table>
            <THead><TR><TH>Pair</TH><TH>Ratio</TH><TH>Result</TH></TR></THead>
            <TBody>
              {CONTRAST.map(([pair, ratio, ok]) => (
                <TR key={pair}>
                  <TD>{pair}</TD>
                  <TD>{ratio}:1</TD>
                  <TD><Badge variant={ok ? 'success' : 'danger'}>{ok ? 'Pass' : 'Fail – avoided'}</Badge></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </Section>

      <Section title="Typography">
        <Card className="space-y-3">
          {TYPE_SCALE.map(([cls, size, weight]) => (
            <div key={cls} className="flex items-baseline gap-4 border-b border-border pb-3 last:border-0">
              <span className="w-32 shrink-0 text-xs text-muted">{cls} · {size}</span>
              <span className={`${cls} ${weight} truncate`}>Royalties are paid within 45 days</span>
            </div>
          ))}
          <p className="pt-2 text-lg font-light text-muted">
            Weight 300 (Nunito Sans Light) — only for login/marketing text at 18px+.
          </p>
          <p className="font-cta text-base font-medium">Jost 500 — buttons and CTAs</p>
        </Card>
      </Section>

      <Section title="Radius & shadow">
        <div className="flex flex-wrap gap-4">
          {[['rounded-sm', '6px'], ['rounded-input', '8px'], ['rounded-card', '15px'], ['rounded-pill', 'pill']].map(([r, v]) => (
            <div key={r} className={`flex h-20 w-32 items-center justify-center border border-border-strong bg-surface text-xs ${r}`}>
              {r} · {v}
            </div>
          ))}
          <div className="flex h-20 w-32 items-center justify-center rounded-card bg-surface text-xs shadow-card">shadow-card</div>
          <div className="flex h-20 w-32 items-center justify-center rounded-card bg-surface text-xs shadow-pop">shadow-pop</div>
        </div>
      </Section>

      <Section title="Buttons">
        <Card className="space-y-5">
          {['primary', 'secondary', 'ghost', 'danger'].map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-20 text-xs text-muted">{v}</span>
              <Button variant={v} size="sm">Small</Button>
              <Button variant={v}>Medium</Button>
              <Button variant={v} shape="pill">Pill</Button>
              <Button variant={v} disabled>Disabled</Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-20 text-xs text-muted">states</span>
            <Button size="lg" shape="pill">Log in (lg, CTA only)</Button>
            <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500) }}>
              {loading ? 'Sending…' : 'Click for loading'}
            </Button>
            <Button><Plus className="size-4" aria-hidden="true" />With icon</Button>
          </div>
          <p className="text-xs text-muted">Press Tab to see the focus ring on every control.</p>
        </Card>
      </Section>

      <Section title="Form controls">
        <Card className="grid gap-5 md:grid-cols-2">
          <Input label="Email" type="email" placeholder="priya.sharma@email.com" required />
          <Input label="With hint" hint="We never share your email." placeholder="Type here" />
          <Input label="Error state" defaultValue="not-an-email" error="Enter a valid email address." />
          <Input label="Disabled" defaultValue="AUTH001" disabled />
          <Select
            label="Which book is this about?"
            options={[
              { value: '', label: 'General / Account Level' },
              { value: 'BK001', label: 'Whispers of the Ganges' },
              { value: 'BK002', label: 'The Saffron Diaries' },
            ]}
          />
          <Select label="Select with error" placeholder="Choose a category" error="Pick a category." />
          <Textarea
            className="md:col-span-2"
            label="Describe your issue"
            hint="Include dates, amounts or order numbers if you have them."
            placeholder="I haven't received my royalty for Q3…"
          />
          <div className="flex flex-wrap gap-6 md:col-span-2">
            <Checkbox label="Only show unresolved" defaultChecked />
            <Checkbox label="Assigned to me" />
            <Checkbox label="Disabled" disabled />
          </div>
        </Card>
      </Section>

      <Section title="Badges">
        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {['brand', 'neutral', 'success', 'warning', 'danger', 'info', 'solid'].map((v) => (
              <Badge key={v} variant={v}>{v}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Open', 'In Progress', 'Resolved', 'Closed'].map((s) => <StatusBadge key={s} status={s} />)}
          </div>
          <div className="flex flex-wrap gap-2">
            {['Critical', 'High', 'Medium', 'Low', null].map((p) => <PriorityBadge key={String(p)} priority={p} />)}
          </div>
        </Card>
      </Section>

      <Section title="Stat cards">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard value="₹11,970" label="Total royalty earned" />
          <StatCard value="₹3,570" label="Royalty pending" hint="Last payout: 15 Oct 2025" />
          <StatCard value="342" label="Copies sold" />
          <StatCard value="₹0" label="Paid so far" hint="No payout yet" />
        </div>
      </Section>

      <Section title="Table">
        <Card padding={false} title="Ticket queue">
          <Table>
            <THead>
              <TR><TH>Subject</TH><TH>Author</TH><TH>Priority</TH><TH>Status</TH><TH>Age</TH></TR>
            </THead>
            <TBody>
              <TR onClick={() => {}}>
                <TD className="font-semibold">Haven't received royalty for 6 months</TD>
                <TD>Ananya Reddy</TD><TD><PriorityBadge priority="Critical" /></TD>
                <TD><StatusBadge status="Open" /></TD><TD className="font-semibold text-danger-text">5d</TD>
              </TR>
              <TR onClick={() => {}} selected>
                <TD className="font-semibold">Wrong ISBN on Amazon (selected row)</TD>
                <TD>Rohit Kapoor</TD><TD><PriorityBadge priority="High" /></TD>
                <TD><StatusBadge status="In Progress" /></TD><TD>2d</TD>
              </TR>
              <TR onClick={() => {}}>
                <TD className="font-semibold">Can I update my author bio?</TD>
                <TD>Meera Nair</TD><TD><PriorityBadge priority="Low" /></TD>
                <TD><StatusBadge status="Resolved" /></TD><TD>1d</TD>
              </TR>
            </TBody>
          </Table>
        </Card>
        <Card padding={false}>
          <Table>
            <THead><TR><TH>Subject</TH><TH>Status</TH></TR></THead>
            <TBody><TableEmpty colSpan={2}>No tickets yet. New queries will appear here.</TableEmpty></TBody>
          </Table>
        </Card>
      </Section>

      <Section title="Alerts & toasts">
        <div className="space-y-3">
          <Alert variant="info" title="Royalties are calculated quarterly">Paid within 45 days of the quarter ending.</Alert>
          <Alert variant="success" title="Reply sent">The author will see it on their ticket.</Alert>
          <Alert variant="warning" title="AI unavailable">Write the reply manually — the ticket was still created.</Alert>
          <Alert variant="danger" title="Could not save" onClose={() => {}}>Check your connection and try again.</Alert>
        </div>
        <div className="flex flex-wrap gap-2">
          {['info', 'success', 'warning', 'danger'].map((v) => (
            <Button key={v} variant="secondary" size="sm" onClick={() => toast({ variant: v, title: `${v} toast`, description: 'Disappears after 4 seconds.' })}>
              Show {v} toast
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Card">
        <Card title="AI-drafted reply" actions={<Button variant="ghost" size="sm"><Sparkles className="size-4" aria-hidden="true" />Regenerate</Button>}>
          <p className="text-muted">Card: white, 15px radius, shadow-card, 24px padding. Optional title and actions.</p>
        </Card>
      </Section>
    </div>
  )
}
