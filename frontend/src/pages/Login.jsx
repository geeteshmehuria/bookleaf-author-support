import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/auth"
import { destinationAfterLogin } from "@/lib/roles"
import { FullPageLoader } from "@/components/auth/FullPageLoader"
import { LoginLayout } from "@/components/layout/LoginLayout"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = "Enter your email"
  else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address"
  if (!password) errors.password = "Enter your password"
  return errors
}

/**
 * One login page for everyone. The API's response says whether the user is an
 * author or an admin, and we send them to the right area. The URL never decides the role.
 */
export default function Login() {
  const { user, status, login } = useAuth()
  const location = useLocation()

  const [form, setForm] = useState({ email: "", password: "" })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)

  // The free server sleeps when idle and the first request can take ~1 minute.
  // After 5 seconds, tell the user instead of leaving them guessing.
  useEffect(() => {
    if (!submitting) return setSlow(false)
    const t = setTimeout(() => setSlow(true), 5000)
    return () => clearTimeout(t)
  }, [submitting])

  if (status === "loading") return <FullPageLoader />
  // Already logged in (or just logged in): go to their area.
  if (user) return <Navigate to={destinationAfterLogin(user, location.state?.from)} replace />

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    if (errors[name]) setErrors((errs) => ({ ...errs, [name]: undefined }))
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
      await login(form.email.trim(), form.password)
      // success: `user` is now set and the <Navigate> above redirects
    } catch (err) {
      setFormError(err.message)
      setForm((f) => ({ ...f, password: "" }))
      setSubmitting(false)
    }
  }

  return (
    <LoginLayout title="Welcome to BookLeaf" subtitle="Sign in to your author or team account">
      <form className="grid gap-5" onSubmit={onSubmit} noValidate>
        {formError && (
          <Alert variant="danger">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={onChange}
            disabled={submitting}
            autoFocus
          />
        </Field>
        <Field label="Password" error={errors.password}>
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            value={form.password}
            onChange={onChange}
            disabled={submitting}
          />
        </Field>
        <Button type="submit" size="lg" shape="pill" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
        {slow && (
          <p className="text-center text-sm text-muted-foreground" role="status">
            The server is waking up. This can take up to a minute the first time.
          </p>
        )}
      </form>
    </LoginLayout>
  )
}
