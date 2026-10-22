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
