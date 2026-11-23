# Theming Prism

Prism is an embeddable renderer, not a design system you must adopt. Its default
`host` theme inherits the surrounding font and ink. Refraction and the concept
studies are optional themes; structure is replaceable as well as appearance.

```tsx
import { Prism, ThemeScope, defineTheme, host } from '@prism-ui/react';
import { instrument, refraction } from '@prism-ui/themes';
import '@prism-ui/components';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/estimate.css'; // include the CSS for each component you use

<Prism source={reply} />                         // host, auto mode
<Prism source={reply} theme={instrument} mode="light" />
<ThemeScope theme={refraction} mode="dark">
  <Prism source={oneReply} />
  <ThemeScope theme={host} mode="light"><Prism source={anotherReply} /></ThemeScope>
</ThemeScope>
```

`theme="light" | "dark" | "auto"` remains a mode shorthand. A `theme` style object
and `createTheme({ accent: '#265b49' })` still work. `mode` wins over the shorthand.
An omitted theme/mode inherits its nearest scope; the outer default is host/auto.
`unstyled` still removes built-in component classes, not behavior or `data-*` parts.

## Definition and resolution

```ts
interface PrismTheme {
  name: string;
  extends?: PrismTheme;
  tokens?: Partial<Tokens>;
  dark?: Partial<Tokens>;
  components?: Record<string, {
    tokens?: Record<string, string>;
    slots?: Record<string, ComponentType<any>>;
    classNames?: Record<string, string>;
    styles?: Record<string, CSSProperties>;
    strings?: Record<string, string>;
  }>;
  css?: string;
  icons?: Partial<Icons>;
}
```

Use `defineTheme()` to type-check definitions and validate their names. Names must
start with a letter and contain only letters, digits, `_` or `-`. Give each distinct
definition a unique, stable name. Circular `extends` chains throw.

Resolution is ancestor theme → descendant theme → explicit Prism props. Slot and
class-name maps merge by component/part; a later class name replaces an earlier
one. Styles merge by CSS property. The explicit `components` prop remains the
highest-priority way to replace an entire registered view. It is independent of
part-level slots. Theme tokens are followed by `dark` overrides in dark mode or
auto mode with `prefers-color-scheme: dark`. An inline `theme` style object and
`style` are last in the CSS cascade, with `style` winning between those two.

Strings deliberately use a different order: **theme strings > component props
(including `labels`) > definition defaults**. An application can therefore impose
its own language even when the model supplies default English labels.

```tsx
const brand = defineTheme({
  name: 'acme',
  extends: refraction,
  tokens: { accent: '#245d48', fontDisplay: 'Acme Display, sans-serif' },
  dark: { accent: '#9bd3b5' },
  components: {
    estimate: {
      tokens: { 'radius-lg': '0px' },
      classNames: { submit: 'our-button' },
      styles: { title: { letterSpacing: '.08em' } },
      strings: { submit: 'Approve budget', sentLabel: 'Approved' },
      slots: { total: OurTotal },
    },
  },
  icons: { check: OurCheckIcon, send: OurSendIcon },
  css: `:scope .prism-estimate__header { border-bottom-width: 2px; }`,
});
```

Named CSS is emitted into `<style data-prism-theme-css="acme">` once per name in
the browser, shared by independent roots. Server rendering emits declarative
style tags without accessing the DOM; hydration consolidates them in the head.
It uses native `@scope ([data-prism-theme-name="acme"]) to
([data-prism-theme-name])`, so a parent theme's selectors cannot reach a nested
theme. Ancestor theme CSS is included in a derived theme's own scope. Write
ordinary selectors, media queries and `:scope` rules in `css`; do not include
`@import`. Use a current browser with native CSS `@scope` and `color-mix` support.
Themes are trusted application code, not model-supplied CSS.

## Semantic token contract

All values are CSS strings. Camel-case keys become `--prism-kebab-case` variables;
numbered scales include a hyphen (`space4` → `--prism-space-4`, `text2xl` →
`--prism-text-2xl`). `ThemeTokens` is a compatibility type alias for `Tokens`, not
the previous Refraction token bag.

| Role | `Tokens` keys | Host defaults |
| --- | --- | --- |
| Surfaces | `bg`, `surface`, `surfaceRaised` | transparent, 3% current ink, Canvas |
| Ink | `text`, `textMuted`, `textSubtle` | currentColor, 65% and 50% current ink |
| Rules | `border`, `borderStrong` | 15% and 30% current ink |
| Interaction | `accent`, `accentText`, `onAccent`, `focus` | inherited `--prism-accent` or neutral #525252; white on accent |
| Status | `positive`, `warning`, `danger`, `info` | sober green, amber, red, blue |
| Fonts | `fontBody`, `fontDisplay`, `fontMono`, `fontNumeric` | inherit except system monospace |
| Type | `textXs`, `textSm`, `textBase`, `textLg`, `textXl`, `text2xl`, `text3xl` | .75, .875, 1, 1.125, 1.375, 2, 2.75rem |
| Weights | `weightRegular`, `weightMedium`, `weightSemibold`, `weightBold` | 400, 500, 600, 700 |
| Corners | `radiusSm`, `radiusMd`, `radiusLg`, `radiusPill` | 4, 8, 12, 999px |
| Spacing | `space1`…`space8` | .25, .5, .75, 1, 1.25, 1.5, 2, 2.5rem |
| Elevation | `elevation1`, `elevation2`, `elevation3` | subtle current-ink shadows |
| Motion | `motionFast`, `motionBase`, `motionSlow`, `motionEase`, `motionSpring` | 150, 250, 420ms and easing curves |

Soft fills are `color-mix()` expressions at their point of use, not separate
semantic tokens. Refraction's former paper/ink/fill/spectrum, soft-color, font-sans,
shadow and duration token names no longer exist. Migrate to the semantic roles
above. Density changes the spacing scale; reduced motion and `animate={false}`
disable the motion scale and component entry transitions.

Host does **not** redeclare `--prism-accent`, so an application's inherited value
works with no JavaScript configuration:

```css
.our-chat { font-family: Acme, sans-serif; color: #264c40; --prism-accent: #235d47; }
```

### Component tokens

`components.estimate.tokens['radius-lg']` becomes `--prism-estimate-radius-lg`.
Component tokens default to semantic variables, never Refraction-specific names.
Estimate exposes component overrides for every semantic token it consumes, e.g.
`--prism-estimate-surface`, `--prism-estimate-text`, `--prism-estimate-border`,
`--prism-estimate-text-base`, `--prism-estimate-font-numeric`,
`--prism-estimate-space-4`, `--prism-estimate-elevation-1`, and
`--prism-estimate-motion-fast`. `--prism-estimate-stepper-width` controls key width.
Instrument adds its own `display`, `display-border`, `signal` and `key-shadow`
component tokens. Code highlighting uses `--prism-codeblock-token-keyword`,
`-string`, `-number`, etc.; chart series use `--prism-chart-1`…`-8`.
Layout-specific component variables (columns, progress, animation offsets) remain
component-local. For arbitrary structural or layout changes use slots or `css`.

## CSS-variable adapters

```tsx
import { defineTheme, fromCssVars, shadcn } from '@prism-ui/react';

const native = defineTheme({ name: 'native', tokens: fromCssVars({
  bg: '--app-background', text: '--app-foreground', accent: '--app-primary',
  radiusLg: '--app-radius', fontBody: '--app-font',
}) });
<Prism theme={shadcn} source={reply} />
```

`fromCssVars()` returns a token map; bare custom-property names become `var(...)`.
Full CSS expressions pass through unchanged. The `shadcn` preset maps modern
shadcn/Tailwind color variables (`--primary`, `--background`, `--foreground`,
`--muted`, `--muted-foreground`, `--card`, `--border`, `--input`, `--ring`,
`--destructive`) and `--radius`. For older HSL-channel-only variables use explicit
values such as `accent: 'hsl(var(--primary))'` in the adapter map.

## Parts, slots, strings and icons

`defineComponent({ name, component, parts: [...], strings: {...} })` declares the
public surface. Default string-valued schema props are included automatically.
`usePart(component, part)` supplies stable classes, overrides and `data-prism` /
`data-part`; `useSlot(component, part, Default)` resolves the actual renderer.
`useStrings(component, optionalFallback)` resolves labels using the order above.

`PrismPart` is the convenience renderer: it renders `as` normally, or dispatches
to the matching theme/explicit slot. It forwards `as`, DOM props, children and
refs to custom slots. `slotProps` supplies headless model data only to a custom
slot and never leaks it onto the default DOM element.

```tsx
function OurTotal({ as, estimate, children, ...domProps }) {
  return <aside {...domProps}>
    <strong>{estimate.totalLabel}</strong>
    <output>{estimate.finalTotalText}</output>
  </aside>;
}
<PrismPart as="div" {...usePart('estimate', 'total')} slotProps={{ estimate }} />
```

Preserve accessibility attributes, event handlers and refs when replacing parts.
Replacement containers should render `children` unless intentionally redesigning
their subtree. A slot that redesigns a subtree owns that subtree's accessibility.
Estimate's `item` slot receives `row`; its `total` slot receives the exported
`EstimateModel` (including values, formatted text, rows, handlers and part props).
Instrument demonstrates both: it removes the optional row's quantity control,
turns its checkbox into a switch, adds a physical chassis, and replaces the entire
total with SVG segmented numerals while retaining a live text announcement.

Theme component keys match `data-prism`, not always directive syntax: `codeblock`
for code, `datatable` for `ui:dataTable`, `runbook` for both runbooks and steps.
`frame` provides shared fallback slots and labels for component frames.

`Icon` reads the central theme icon map. `Icons` includes check, chevron, copy,
plus, minus, close, undo, redo, send, ask, device/preview controls, status icons and
view primitive icons. Overrides are SVG-compatible React components. Plot SVGs,
segmented numerals and user-authored SVG content are not interface icons.

## Phase-one reference and checks

### H. Adaptive containers

Pick, Num/Calc, Ask, Chart, DataTable and Table must adapt to their container,
not the viewport. Reuse an enclosing query container where available; otherwise
set `container-type: inline-size` on the component root. Use container queries
for width-dependent layouts, retaining media queries for hover and reduced motion.
Support containers from approximately 280px through 760px and wider. Verify host
at 280px, 320px and 760px in light and dark modes, plus Refraction light and dark;
390px is an optional additional check. Narrow layouts should reduce detail and
chrome without removing keyboard access, actions or accessible expansion state.

`@prism-ui/themes` exports `refraction` and `instrument` (also per-theme subpaths).
Host and the shadcn adapter are exported from React. Instrument currently themes
**Estimate only** and intentionally has no dark reskin; Print and Objects are
future themes rather than misleading placeholders. Font files are application
assets: load the named families yourself or use their system fallbacks.

Run the playground and open `/themes.html` for the same Estimate under host,
Refraction and Instrument. The page uses a custom host font/color; each Estimate
has an independent store. Its dark toggle demonstrates Refraction's dark tokens
and the host's inherited colors without forcing a dark hardware material.

`packages/components/test/theme-contract.test.tsx` iterates registry example
fixtures, checks every rendered part against its declaration, then replaces each
observed part individually with a marker slot. Conditional parts require fixtures
that render their state. `estimate-theme.test.tsx` exhaustively covers every
declared Estimate part, including empty. The best-effort strings check scans JSX
prose and literal accessibility labels; it is not a proof about arbitrary computed
messages or application-supplied text. Additional tests cover merge precedence,
nesting, SSR output, stylesheet deduplication, icons, localization, sent/edit
behavior and the structural Instrument slots.
