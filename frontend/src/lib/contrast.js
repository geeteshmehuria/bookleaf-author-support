// WCAG 2.x contrast helpers. Colours are read at runtime from CSS variables,
// so no colour values live in components.

/** Resolved value of a CSS custom property on :root, e.g. "--brand-primary". */
export function readVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function toRgb(color) {
  const hex = color.replace("#", "")
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6)
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16))
}

function luminance(color) {
  const [r, g, b] = toRgb(color).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
