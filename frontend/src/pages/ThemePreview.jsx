import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BookOpen, Mail } from "lucide-react"
import { contrast, readVar } from "@/lib/contrast"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/ui/stat-card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

/*
 * Dev-only styleguide (route registered only when import.meta.env.DEV).
 * Each colour lists the pairs it is actually used in and the WCAG minimum for that use:
 * 4.5 = normal text, 3 = large text (>= 24px / 18.66px bold) or UI component / focus indicator.
 */
const TEXT = 4.5
const LARGE = 3
const UI = 3

const colorGroups = [
  {
    title: "Brand",
    tokens: [
      { name: "--brand-primary", use: "Progress, active nav bar, focus ring, icons", checks: [["--brand-surface", UI], ["--brand-tint", UI]] },
      { name: "--brand-primary-action", use: "Filled button background (white text)", checks: [["--brand-white", TEXT]] },
      { name: "--brand-primary-action-hover", use: "Filled button hover (white text)", checks: [["--brand-white", TEXT]] },
      { name: "--brand-primary-strong", use: "Coral text on white / tint", checks: [["--brand-surface", TEXT], ["--brand-tint", TEXT]] },
      { name: "--brand-primary-soft", use: "Decorative only, never behind text", checks: [] },
      { name: "--brand-highlight", use: "Stat numbers, highlighted heading words (large only)", checks: [["--brand-surface", LARGE], ["--brand-tint", LARGE]] },
      { name: "--brand-tint", use: "Soft backgrounds, hover, active nav", checks: [["--brand-text", TEXT], ["--brand-text-muted", TEXT], ["--brand-primary-strong", TEXT]] },
      { name: "--brand-tint-2", use: "Soft section bands", checks: [["--brand-text", TEXT], ["--brand-primary-strong", TEXT]] },
    ],
  },
  {
    title: "Text, surfaces, borders",
    tokens: [
      { name: "--brand-text", use: "Body text, headings", checks: [["--brand-surface", TEXT], ["--brand-tint", TEXT]] },
      { name: "--brand-text-muted", use: "Secondary text, labels", checks: [["--brand-surface", TEXT], ["--brand-tint", TEXT], ["--brand-surface-3", TEXT]] },
      { name: "--brand-link", use: "Text links", checks: [["--brand-surface", TEXT]] },
      { name: "--brand-surface", use: "Cards, inputs", checks: [["--brand-text-muted", TEXT]] },
      { name: "--brand-surface-2", use: "Page background", checks: [["--brand-text-muted", TEXT]] },
      { name: "--brand-surface-3", use: "Table header, admin sidebar", checks: [["--brand-text-muted", TEXT], ["--brand-primary", UI]] },
      { name: "--brand-border", use: "Card / table dividers (decorative)", checks: [] },
      { name: "--brand-border-input", use: "Form control borders", checks: [["--brand-surface", UI]] },
    ],
  },
  {
    title: "Status",
    tokens: [
      { name: "--brand-success", use: "Icons, fills", checks: [["--brand-surface", UI]] },
      { name: "--brand-success-strong", use: "Success text", checks: [["--brand-surface", TEXT], ["--brand-success-soft", TEXT]] },
      { name: "--brand-success-soft", use: "Success background", checks: [] },
      { name: "--brand-warning", use: "Icons, fills", checks: [["--brand-surface", UI]] },
      { name: "--brand-warning-strong", use: "Warning text", checks: [["--brand-surface", TEXT], ["--brand-warning-soft", TEXT]] },
      { name: "--brand-warning-soft", use: "Warning background", checks: [] },
      { name: "--brand-danger", use: "Destructive button bg (white text), errors", checks: [["--brand-white", TEXT], ["--brand-surface", TEXT]] },
      { name: "--brand-danger-strong", use: "Danger text", checks: [["--brand-surface", TEXT], ["--brand-danger-soft", TEXT]] },
      { name: "--brand-danger-soft", use: "Danger background", checks: [] },
      { name: "--brand-info", use: "Icons, fills", checks: [["--brand-surface", UI]] },
      { name: "--brand-info-strong", use: "Info text", checks: [["--brand-surface", TEXT], ["--brand-info-soft", TEXT]] },
      { name: "--brand-info-soft", use: "Info background", checks: [] },
      { name: "--brand-whatsapp", use: "WhatsApp button: dark text only, never white", checks: [["--brand-text", TEXT]] },
    ],
  },
]

const shortName = (v) => v.replace("--brand-", "")

function Swatch({ name, use, checks }) {
  const [vals, setVals] = useState(null)

  useEffect(() => {
    const own = readVar(name)
    const white = readVar("--brand-white")
    const tint = readVar("--brand-tint")
    setVals({
      own,
      white: contrast(own, white),
      tint: contrast(own, tint),
      checks: checks.map(([other, min]) => ({ other, min, ratio: contrast(own, readVar(other)) })),
    })
  }, [name, checks])

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="h-16 border-b border-border" style={{ background: `var(${name})` }} />
      <div className="grid gap-1.5 p-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <code className="font-bold text-foreground">{shortName(name)}</code>
          <code className="text-muted-foreground uppercase">{vals?.own}</code>
        </div>
        <p className="text-muted-foreground">{use}</p>
        {vals && (
          <p className="text-muted-foreground">
            vs white {vals.white.toFixed(2)} · vs tint {vals.tint.toFixed(2)}
          </p>
        )}
        {vals?.checks.map((c) => {
          const pass = c.ratio >= c.min
          return (
            <div key={c.other} className="flex items-center justify-between gap-2">
              <span>
                with {shortName(c.other)}: <strong>{c.ratio.toFixed(2)}</strong> (needs {c.min})
              </span>
              <Badge variant={pass ? "success" : "danger"}>{pass ? "PASS" : "FAIL"}</Badge>
            </div>
          )
        })}
        {checks.length === 0 && <span className="text-muted-foreground italic">Decorative / background, no text on it alone</span>}
      </div>
    </div>
  )
}

function Section({ title, children, className }) {
  return (
    <section className={cn("grid gap-4", className)}>
      <h2 className="border-b border-border pb-2 text-xl">{title}</h2>
      {children}
    </section>
  )
}

function StateLabel({ children }) {
  return <span className="text-xs font-semibold text-muted-foreground uppercase">{children}</span>
}

const typeScale = [
  ["12", "text-xs"],
  ["14", "text-sm"],
  ["16", "text-base"],
  ["18", "text-lg"],
  ["20", "text-xl"],
  ["24", "text-2xl"],
  ["32", "text-[32px]"],
  ["40", "text-[40px]"],
]

const variants = ["default", "secondary", "ghost", "destructive", "link"]
const sizes = ["sm", "default", "lg"]
const shapes = ["rounded", "pill"]

// Static look-alikes of :hover / :focus-visible so every state is visible at once.
const hoverLook = {
  default: "bg-primary-action-hover",
  secondary: "bg-tint",
  ghost: "bg-accent text-accent-foreground",
  destructive: "bg-primary-action-hover",
  link: "underline",
}
const focusLook = "outline-2 outline-solid outline-offset-2 outline-ring"
const fieldFocusLook = "border-brand ring-2 ring-ring/30"
const fieldHoverLook = "border-foreground"

export default function ThemePreview() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Logo />
          <Badge variant="neutral" uppercase>Theme preview · dev only</Badge>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-4 py-8">
        <Section title="Colour tokens">
          {colorGroups.map((g) => (
            <div key={g.title} className="grid gap-3">
              <h3 className="text-base">{g.title}</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {g.tokens.map((t) => (
                  <Swatch key={t.name} {...t} />
                ))}
              </div>
            </div>
          ))}
        </Section>

        <Section title="Type scale">
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              ["font-sans", "Nunito Sans (body)"],
              ["font-cta", "Jost (buttons / CTA)"],
            ].map(([font, label]) => (
              <Card key={font} className="gap-3 overflow-hidden">
                <CardTitle>{label}</CardTitle>
                {typeScale.map(([px, cls]) => (
                  <div key={px} className="flex items-baseline gap-3">
                    <code className="w-10 shrink-0 text-xs text-muted-foreground">{px}px</code>
                    <span className={cn(font, cls, "truncate")}>Every story deserves a reader</span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">
                  Weights: <span className="font-normal">400</span> · <span className="font-semibold">600</span> ·{" "}
                  <span className="font-extrabold">800</span> · <span className="text-lg font-light">300 (≥18px, login only)</span>
                </p>
                <h3 className="text-2xl">
                  Heading with <span className="text-highlight">highlight</span>
                </h3>
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Buttons: variant × size × shape">
          {shapes.map((shape) => (
            <div key={shape} className="grid gap-3">
              <h3 className="text-base">shape=&quot;{shape}&quot;</h3>
              <div className="-m-1 overflow-x-auto p-1">
                <div className="grid min-w-max gap-3">
                  {variants.map((v) => (
                    <div key={v} className="flex items-center gap-3">
                      <code className="w-24 text-xs text-muted-foreground">{v}</code>
                      {sizes.map((s) => (
                        <Button key={s} variant={v} size={s} shape={shape}>
                          {s === "lg" ? "Start writing" : `Button ${s}`}
                        </Button>
                      ))}
                      <Button variant={v} shape={shape} size="icon" aria-label="Email">
                        <Mail />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <h3 className="text-base">States (hover / focus simulated)</h3>
          <div className="-m-1 overflow-x-auto p-1">
            <div className="grid min-w-max grid-cols-[6rem_repeat(4,minmax(8rem,auto))] items-center gap-3">
              <span />
              <StateLabel>Default</StateLabel>
              <StateLabel>Hover</StateLabel>
              <StateLabel>Focus</StateLabel>
              <StateLabel>Disabled</StateLabel>
              {variants.map((v) => (
                <div key={v} className="contents">
                  <code className="text-xs text-muted-foreground">{v}</code>
                  <Button variant={v}>Save</Button>
                  <Button variant={v} className={hoverLook[v]}>Save</Button>
                  <Button variant={v} className={focusLook}>Save</Button>
                  <Button variant={v} disabled>Save</Button>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Form controls">
          <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            <div className="grid content-start gap-1.5"><StateLabel>Default</StateLabel><Input placeholder="Book title" /></div>
            <div className="grid content-start gap-1.5"><StateLabel>Hover</StateLabel><Input placeholder="Book title" className={fieldHoverLook} /></div>
            <div className="grid content-start gap-1.5"><StateLabel>Focus</StateLabel><Input placeholder="Book title" className={fieldFocusLook} /></div>
            <div className="grid content-start gap-1.5"><StateLabel>Disabled</StateLabel><Input placeholder="Book title" disabled /></div>
            <div className="grid content-start gap-1.5"><StateLabel>Error</StateLabel><Input defaultValue="not-an-email" aria-invalid /></div>

            <div className="grid content-start gap-1.5"><StateLabel>Textarea</StateLabel><Textarea placeholder="Describe your issue" /></div>
            <div className="grid content-start gap-1.5"><StateLabel>Focus</StateLabel><Textarea placeholder="Describe your issue" className={fieldFocusLook} /></div>
            <div className="grid content-start gap-1.5"><StateLabel>Disabled</StateLabel><Textarea placeholder="Describe your issue" disabled /></div>
            <div className="grid content-start gap-1.5"><StateLabel>Error</StateLabel><Textarea aria-invalid defaultValue="Too short" /></div>
            <div className="grid content-start gap-1.5">
              <StateLabel>Select</StateLabel>
              <Select defaultValue="royalty">
                <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="royalty">Royalty & Payments</SelectItem>
                  <SelectItem value="isbn">ISBN & Metadata Issues</SelectItem>
                  <SelectItem value="printing">Printing & Quality</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid content-start gap-1.5">
              <StateLabel>Select focus</StateLabel>
              <Select defaultValue="royalty">
                <SelectTrigger aria-label="Category (focus)" className={fieldFocusLook}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="royalty">Royalty & Payments</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-1.5">
              <StateLabel>Select disabled</StateLabel>
              <Select defaultValue="royalty" disabled>
                <SelectTrigger aria-label="Category (disabled)"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="royalty">Royalty & Payments</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-1.5">
              <StateLabel>Select error</StateLabel>
              <Select>
                <SelectTrigger aria-label="Category (error)" aria-invalid><SelectValue placeholder="Pick one" /></SelectTrigger>
                <SelectContent><SelectItem value="royalty">Royalty & Payments</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="grid content-start gap-3">
              <StateLabel>Checkbox</StateLabel>
              <div className="flex items-center gap-2"><Checkbox id="cb1" /><Label htmlFor="cb1">Default</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="cb2" defaultChecked /><Label htmlFor="cb2">Checked</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="cb3" className={focusLook} /><Label htmlFor="cb3">Focus</Label></div>
            </div>
            <div className="grid content-start gap-3">
              <StateLabel>Checkbox</StateLabel>
              <div className="flex items-center gap-2"><Checkbox id="cb4" disabled /><Label htmlFor="cb4">Disabled</Label></div>
              <div className="flex items-center gap-2"><Checkbox id="cb5" aria-invalid /><Label htmlFor="cb5">Error</Label></div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" helper="We'll send ticket updates here." required>
              <Input type="email" placeholder="you@example.com" />
            </Field>
            <Field label="ISBN" error="ISBN must be 13 digits.">
              <Input defaultValue="978-93-5" />
            </Field>
          </div>
        </Section>

        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            {["default", "neutral", "outline", "success", "warning", "info", "danger"].map((v) => (
              <Badge key={v} variant={v}>{v}</Badge>
            ))}
            <Badge uppercase>Uppercase</Badge>
          </div>
        </Section>

        <Section title="Table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Copies sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell className="font-semibold">Whispers of the Ganges</TableCell><TableCell><Badge variant="success">Published & Live</Badge></TableCell><TableCell className="text-right">342</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">The Saffron Diaries</TableCell><TableCell><Badge variant="success">Published & Live</Badge></TableCell><TableCell className="text-right">189</TableCell></TableRow>
              <TableRow><TableCell className="font-semibold">Midnight in Mysore</TableCell><TableCell><Badge variant="warning">In Production</Badge></TableCell><TableCell className="text-right">0</TableCell></TableRow>
            </TableBody>
          </Table>
        </Section>

        <div className="grid gap-12 lg:grid-cols-2">
          <Section title="Accordion">
            <Accordion type="single" collapsible defaultValue="a">
              <AccordionItem value="a">
                <AccordionTrigger>When are royalties paid?</AccordionTrigger>
                <AccordionContent>Every quarter, for all confirmed sales.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="b">
                <AccordionTrigger>Can I change my cover after publishing?</AccordionTrigger>
                <AccordionContent>Yes. Raise a “Printing & Quality” query.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="c" disabled>
                <AccordionTrigger>Disabled item</AccordionTrigger>
                <AccordionContent>Hidden.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </Section>

          <Section title="Progress">
            <Progress value={7} max={21} label="Day 7 / 21" />
            <Progress value={21} max={21} label="Day 21 / 21" />
            <Progress value={30} aria-label="Upload progress" />
          </Section>
        </div>

        <Section title="Stat cards & card">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard value="1,203" label="Copies sold" icon={BookOpen} />
            <StatCard value="₹57,744" label="Royalty earned" />
            <StatCard value="24" label="Open tickets" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Cards use rounded-card (15px), shadow-card and 24px padding.</CardDescription>
            </CardHeader>
            <CardContent>Content goes here.</CardContent>
          </Card>
        </Section>

        <Section title="Alerts & toasts">
          <div className="grid gap-3 sm:grid-cols-2">
            <Alert variant="success"><AlertTitle>Royalty paid</AlertTitle><AlertDescription>₹3,570 was sent to your bank.</AlertDescription></Alert>
            <Alert variant="warning"><AlertTitle>Payout delayed</AlertTitle><AlertDescription>Bank details need checking.</AlertDescription></Alert>
            <Alert variant="danger"><AlertTitle>Upload failed</AlertTitle><AlertDescription>The file is larger than 10 MB.</AlertDescription></Alert>
            <Alert variant="info"><AlertTitle>New feature</AlertTitle><AlertDescription>You can now track printing status.</AlertDescription></Alert>
            <Alert><AlertTitle>Default</AlertTitle><AlertDescription>Neutral message on a card.</AlertDescription></Alert>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => toast.success("Ticket submitted", { description: "We'll reply within 24 hours." })}>Success toast</Button>
            <Button variant="secondary" onClick={() => toast.warning("Draft not saved", { description: "Check your connection." })}>Warning toast</Button>
            <Button variant="secondary" onClick={() => toast.error("Something went wrong", { description: "Please try again." })}>Danger toast</Button>
            <Button variant="secondary" onClick={() => toast.info("Heads up", { description: "Royalties are paid quarterly." })}>Info toast</Button>
            <Button variant="secondary" onClick={() => toast("Saved", { description: "Default toast." })}>Default toast</Button>
          </div>
        </Section>

        <Section title="Shells">
          <p className="text-muted-foreground">Live pages in frames: 1100px desktop (scrolls sideways if needed) and a 360px phone.</p>
          {[
            ["/author", "Author shell"],
            ["/admin", "Admin shell"],
          ].map(([src, label]) => (
            <div key={src} className="grid gap-3">
              <h3 className="text-base">{label}</h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <iframe title={`${label} desktop`} src={src} className="block h-[520px] w-[1100px] bg-surface" />
              </div>
              <iframe title={`${label} mobile`} src={src} className="h-[560px] w-[360px] max-w-full rounded-md border border-border bg-surface" />
            </div>
          ))}
        </Section>
      </main>
    </div>
  )
}
