import { useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { ErrorState, LoadingCards } from "@/components/feedback"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useApi } from "@/hooks/use-api"
import { api } from "@/services/api"

// Same limits as the API (backend/app/schemas/tickets.py), so most mistakes are caught before sending.
const SUBJECT = { min: 5, max: 150 }
const DESCRIPTION = { min: 20, max: 5000 }
const GENERAL = "general" // Radix Select can't use "" as a value
const MAX_FILE_MB = 5

function validate({ subject, description }) {
  const errors = {}
  const s = subject.trim()
  const d = description.trim()
  if (!s) errors.subject = "Add a short subject"
  else if (s.length < SUBJECT.min) errors.subject = `At least ${SUBJECT.min} characters`
  else if (s.length > SUBJECT.max) errors.subject = `At most ${SUBJECT.max} characters`
  if (!d) errors.description = "Describe your question"
  else if (d.length < DESCRIPTION.min) errors.description = `Please add a bit more detail (at least ${DESCRIPTION.min} characters)`
  else if (d.length > DESCRIPTION.max) errors.description = `At most ${DESCRIPTION.max} characters`
  return errors
}

/** API field errors ({details: [{field, message}]}) -> { subject: "...", ... } */
function fieldErrorsFrom(err) {
  const out = {}
  for (const d of err.details ?? []) if (d.field) out[d.field === "book_id" ? "book" : d.field] = d.message
  if (err.code === "INVALID_BOOK") out.book = err.message
  return out
}

export default function NewTicket() {
  const { data: books, error: booksError, loading, reload } = useApi("/books")
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [form, setForm] = useState({ book: params.get("book") ?? GENERAL, subject: "", description: "" })
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <LoadingCards count={1} label="Loading form" />
  if (booksError) return <ErrorState error={booksError} onRetry={reload} title="Couldn't load your books" />

  // Ignore a ?book= that isn't one of this author's books
  const bookValue = form.book === GENERAL || books.some((b) => b.id === form.book) ? form.book : GENERAL

  const set = (name, value) => {
    setForm((f) => ({ ...f, [name]: value }))
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }))
  }

  const onFiles = (e) => {
    const picked = Array.from(e.target.files ?? [])
    const tooBig = picked.find((f) => f.size > MAX_FILE_MB * 1024 * 1024)
    setErrors((er) => ({ ...er, files: tooBig ? `${tooBig.name} is over ${MAX_FILE_MB} MB` : undefined }))
    setFiles(tooBig ? [] : picked)
    if (tooBig) e.target.value = ""
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting) return
    const found = validate(form)
    setErrors(found)
    setFormError("")
    if (Object.keys(found).length) return

    setSubmitting(true)
    try {
      const ticket = await api.post("/tickets", {
        book_id: bookValue === GENERAL ? null : bookValue,
        subject: form.subject.trim(),
        description: form.description.trim(),
      })
      toast.success(`Query #${ticket.ticket_number} sent. We'll reply here.`)
      navigate(`/author/support/${ticket.id}`, { replace: true })
    } catch (err) {
      const fieldErrors = fieldErrorsFrom(err)
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors)
      else setFormError(err.message)
      setSubmitting(false)
    }
  }

  const descLength = form.description.trim().length

  return (
    <div className="grid gap-4">
      <Button asChild variant="link" className="w-fit text-sm">
        <Link to="/author/support">
          <ArrowLeft aria-hidden="true" /> All queries
        </Link>
      </Button>

      <Card>
        <div className="grid gap-1">
          <h2 className="text-xl">Raise a query</h2>
          <p className="text-sm text-muted-foreground">Our support team usually replies within 48 hours.</p>
        </div>

        <form className="grid gap-5" onSubmit={onSubmit} noValidate>
          {formError && (
            <Alert variant="danger">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <Select value={bookValue} onValueChange={(v) => set("book", v)} disabled={submitting}>
            <Field label="Which book is this about?" error={errors.book}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </Field>
            <SelectContent>
              <SelectItem value={GENERAL}>General / Account level</SelectItem>
              {books.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Field label="Subject" error={errors.subject} required>
            <Input
              name="subject"
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              maxLength={SUBJECT.max}
              placeholder="e.g. Royalty for last quarter not received"
              disabled={submitting}
            />
          </Field>

          <Field
            label="Describe your question"
            error={errors.description}
            helper={`${descLength} / ${DESCRIPTION.max} characters. Include dates, order numbers or links if you have them.`}
            required
          >
            <Textarea
              name="description"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={DESCRIPTION.max}
              rows={6}
              disabled={submitting}
            />
          </Field>

          <Field
            label="Attachments (optional)"
            error={errors.files}
            helper={
              files.length
                ? `Selected: ${files.map((f) => f.name).join(", ")}. File upload isn't live yet; our team will ask for these by email if needed.`
                : `Photos or PDFs up to ${MAX_FILE_MB} MB. File upload isn't live yet.`
            }
          >
            <Input type="file" multiple accept="image/*,.pdf" onChange={onFiles} disabled={submitting} />
          </Field>

          <Button type="submit" shape="pill" className="w-full sm:w-fit" disabled={submitting}>
            {submitting ? "Sending…" : "Send query"}
          </Button>
        </form>
      </Card>
    </div>
  )
}
