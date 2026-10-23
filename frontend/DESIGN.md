# Design system (frontend)

The UI uses [shadcn/ui](https://ui.shadcn.com) components (JavaScript, `new-york` style) re-themed to BookLeaf Publishing's brand (coral + soft pink), adapted for dashboards: white/grey surfaces, coral only for actions, progress, active navigation and alerts.

## Where things live

| File | What it holds |
|---|---|
| `frontend/src/styles/tokens.css` | **Single source of truth.** Raw `--brand-*` colours, radius, shadows, and shadcn's semantic variables pointed at them. The only file allowed to contain hex values. |
| `frontend/src/index.css` | Maps the variables into Tailwind classes (`@theme inline`), removes Tailwind's default palette, base styles (14px body, 800 headings, keyboard focus) |
| `frontend/src/components/ui/` | shadcn components (`button.jsx`, `input.jsx`, `sidebar.jsx`, ...) plus our own `stat-card.jsx` and `field.jsx` |
| `frontend/src/components/layout/` | `AppShell`, `AuthorLayout` (calm, 720px column), `AdminLayout` (dense, full width), `LoginLayout` |
| `frontend/src/lib/utils.js` | `cn()` class helper + shared `focusRing` / `fieldBase` class strings |

Tailwind v4 has no `tailwind.config.js`; the theme lives in CSS (`@theme`).

## shadcn variable → brand token

| shadcn var | Brand token |
|---|---|
| `--background` / `--foreground` | `--brand-surface-2` / `--brand-text` |
| `--card`, `--popover` (+ `-foreground`) | `--brand-surface` (`--brand-text`) |
| `--primary` / `--primary-foreground` | `--brand-primary-action` / white |
| `--secondary` / `--secondary-foreground` | `--brand-tint` / `--brand-primary-strong` |
| `--muted` / `--muted-foreground` | `--brand-surface-3` / `--brand-text-muted` |
| `--accent` / `--accent-foreground` | `--brand-tint` / `--brand-primary-strong` (shadcn's accent is the hover background, not our red) |
| `--destructive` | `--brand-danger` |
| `--border` / `--input` / `--ring` | `--brand-border` / `--brand-border-input` / `--brand-primary` |
| `--sidebar` / `--sidebar-foreground` | `--brand-surface-3` / `--brand-text` (authors re-point `--sidebar` to white) |
| `--sidebar-primary` / `-foreground` | `--brand-primary-action` / white |
| `--sidebar-accent` / `-foreground` | `--brand-tint` / `--brand-primary-strong` |
| `--sidebar-border` / `--sidebar-ring` | `--brand-border` / `--brand-primary` |

Extra classes on top of shadcn's: `bg-brand`, `text-primary-strong`, `text-highlight`, `bg-tint`, `bg-tint-2`, `bg-surface(-2/-3)`, `text-ink`, `text-link`, `success / warning / info` with `-strong` (text) and `-soft` (background) variants, `bg-danger-soft`, `text-danger-strong`, `bg-whatsapp`, `rounded-card`, `rounded-pill`, `shadow-card`, `shadow-pop`, `font-cta`.

## Using it

```jsx
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

<Button>Save</Button>                                     // primary action, 40px, rounded (admin default)
<Button variant="secondary" shape="pill" size="lg">Log in</Button>
<Field label="Email" error={errors.email}>                // label, error text, aria-describedby/aria-invalid wired up
  <Input type="email" />
</Field>
```

## Add a new shadcn component

1. `cd frontend && npx shadcn@latest add <name>` (reads `components.json`: JS, `@/` aliases).
2. Open the new file in `src/components/ui/` and check it only uses token classes: no hex, no `dark:` classes, focus uses `focusRing` (buttons, links) or `fieldBase` (inputs).
3. Check it in the running app, at desktop width and at 360px.

## Change the brand colour

Edit two values in `tokens.css`: `--brand-primary` (decorative coral: progress, active bar, focus ring, icons) and `--brand-primary-action` (filled buttons; must give **≥ 4.5:1 with white text**). Then re-check contrast (e.g. with the WebAIM contrast checker).

> **Warning:** Tailwind's default colour palette is removed (`--color-*: initial`). Classes like `bg-gray-100` or `text-blue-600` **silently produce no style**: no error, no warning. Use the token classes above. Only `white`, `black`, `transparent` and `current` are kept.

## Accessibility decisions

- The brand coral `#E84F5F` gives only **3.67:1** with white text (AA needs 4.5:1). Filled buttons use `--brand-primary-action` `#D12A3C` (5.11:1); coral text uses `--brand-primary-strong` `#B42232` (5.53:1 on tint). `#E84F5F` is used only where 3:1 is enough (progress fill, active bar, focus ring, icons).
- `--brand-highlight` `#E14656` (4.03:1) is for **large text only** (stat numbers, highlighted heading words).
- Status text uses darker `-strong` shades that pass 4.5:1 on both white and their `-soft` backgrounds (success `#106E33`, warning `#9C5404`, info `#1D4ED8`, danger `#B42232`). Never white text on success/warning.
- Form controls use a `#767676` border (4.54:1) so the field edge is clearly visible.
- Keyboard focus: buttons, links, checkboxes and nav items get a solid 2px coral outline with a 2px gap. Inputs change their border to coral **plus** a 30% halo (the halo alone fails 3:1, so it's never used alone).
- Layouts work down to 360px with no sideways page scroll; the sidebar becomes a drawer (shadcn Sheet).
- No dark mode yet.
- Fonts: Nunito Sans (body, headings) and Jost (buttons), substitutes for the site's licensed Avenir/Futura, loaded with `display=swap`.
