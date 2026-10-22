/** Display helpers. Missing values (null / undefined) always show as "—". */

const DASH = "—"

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const count = new Intl.NumberFormat("en-IN")

/** 11970 -> "₹11,970"; 0 -> "₹0" (zero is a real value, not missing) */
export const formatINR = (n) => (n == null ? DASH : inr.format(n))

/** 1567 -> "1,567" */
export const formatCount = (n) => (n == null ? DASH : count.format(n))

/**
 * "2023-06-20" -> "20 Jun 2023".
 * Built from parts, not new Date("2023-06-20"), which is read as UTC midnight
 * and can show the previous day in some timezones.
 */
export function formatDate(iso) {
  if (!iso) return DASH
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
const STEPS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
]

/** ISO timestamp -> "5 minutes ago", "yesterday", "2 weeks ago"; under a minute -> "just now" */
export function formatRelative(isoTimestamp, now = Date.now()) {
  if (!isoTimestamp) return DASH
  const seconds = Math.round((new Date(isoTimestamp).getTime() - now) / 1000)
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return "just now"
}

/** ISO timestamp -> "23 Oct 2026, 4:05 pm" (for tooltips and message times) */
export function formatDateTime(isoTimestamp) {
  if (!isoTimestamp) return DASH
  return new Date(isoTimestamp).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
