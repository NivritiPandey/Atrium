# Atrium design system

## Direction

Atrium is a selective-disclosure access room, not a generic crypto dashboard. The interface borrows from architectural wayfinding: quiet margins, measured grids, one warm signal color, and imagery that suggests a room rather than a token market. The memorable element is the looking-up architectural photograph in the hero; the controls remain calm and legible around it.

## Tokens

- **Day background:** `#F0EDE6`
- **Day surface:** `#F8F6F1`
- **Day ink:** `#25221E`
- **Signal:** `#BD4328`
- **Night background:** `#121416`
- **Night surface:** `#1A1D1F`
- **Night ink:** `#F1ECE3`
- **Muted text:** `#6F6A62` day / `#AFA99F` night
- **Secondary public-state blue:** `#415B64`

## Type

- **DM Sans:** interface labels, body copy, navigation, buttons.
- **Italiana:** selective emphasis in display headings only.
- **DM Mono / system monospace:** transaction identifiers, public ledger values, small technical metadata.

## Layout and interaction

- Max content width: 1200px with responsive 20–72px gutters.
- Use a 4/8px spacing rhythm.
- Use square architectural corners (`2px`) for actions and information surfaces; circles are reserved for status marks and the theme control.
- One primary action per screen. Secondary actions are outlined or text links.
- All icons use Lucide, with accessible labels for icon-only controls.
- Use `prefers-reduced-motion` to disable non-essential movement.
- Keep status copy precise: “submitted” is not “confirmed.”
- Body text is never below 13px on desktop and remains readable on mobile.

## Imagery

Use restrained architectural/interior photography in WebP with declared dimensions and lazy loading below the fold. Images are illustrative atmosphere; they do not carry product state and never replace explanatory text.
