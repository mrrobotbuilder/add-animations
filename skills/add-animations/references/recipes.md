# Proven recipes (CSS and small components)

Each recipe below shipped on a Next.js 16 / React 19.2 site (2026-10-01) and was checked in the browser both ways, under reduced motion and at 400 px. Names in `[data-*]` are that site's; rename freely. Every recipe's reduced-motion path is "the rule is inside `@media (prefers-reduced-motion: no-preference)`, so the element simply sits in its finished state".

## First-paint entrance (every page's first rows)

No script, no flash, no hidden HTML: a no-JS visitor and a crawler get the finished page.

```tsx
// enter.ts: spread onto a row. Never on a scroll-reveal target: the engine owns those.
export const enter = (i: number) => ({ "data-enter": "", style: { "--i": i } as React.CSSProperties });
```

```css
@media screen and (prefers-reduced-motion: no-preference) {
  [data-enter] {
    animation: rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards; /* backwards ONLY */
    animation-delay: calc(var(--i, 0) * 90ms);
  }
}
@keyframes rise { from { opacity: 0; transform: translateY(16px); } }
```

- **`backwards`, never `forwards` or `both`**, when anything else (GSAP, a hover) will later touch the same property: a CSS animation's fill beats inline styles, so a `forwards` fill freezes the element and GSAP's replay does nothing visible.
- `screen` in the media query: printing never catches a row mid-rise.
- **Held under an intro overlay:** give `<html>` an attribute before first paint (an inline script) and swap the animation name while it is set, with a failsafe delay; when the attribute goes the name changes back and the entrance starts from the top instead of jumping to its end:
  ```css
  html[data-intro] [data-enter] { animation-name: hold; animation-delay: 20s; }
  @keyframes hold { from { opacity: 0; } }
  ```

## Typing a command (monospace only)

```css
[data-cmd] { display: inline-block; animation: type 480ms steps(6, end) 400ms both; } /* 6 letters, 6 steps */
@keyframes type { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0); } }
```

Rows that are the command's "output" wait for it: `animation-delay: calc(var(--i) * 90ms + 900ms * min(var(--i), 1))`. As a scroll kind (types both ways) the engine's `[data-reveal-type]` computes `steps(n)` from the element's own text length.

## Slam (a punchline, a CTA headline, a 404)

```css
[data-slam] { display: inline-block; animation: slam 0.4s cubic-bezier(0.64, 0, 0.78, 0) 1.5s both; } /* power4.in */
@keyframes slam { from { opacity: 0; transform: scale(1.3); } }
```

Word by word: one span per word, `animation-delay: calc(200ms + var(--w) * 120ms)`. **A word at 2x widens a narrow page while it lands** (measured: 14 px at 400 px): give the headline `overflow-x: clip`. As a scroll kind: the engine's `[data-reveal-slam]`.

## Wave once, and again on hover

Letters are `aria-hidden` spans beside the real word in an `sr-only` span. The first wave is CSS; the hover replay is `element.animate` added on top (a finished CSS animation cannot then hold the letters still). See `set-pieces.ts` → `[data-wave]`.

## Keys that dip under the pointer

```css
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  [data-key] { transition: translate 0.12s ease-out; }
  [data-key]:hover { translate: 0 0.06em; }
}
```

## Split-flap / scramble

GSAP `ScrambleTextPlugin` (free since 3.13) on an `aria-hidden` copy; the real value stays in the flow, `color: transparent`, for layout and screen readers, and the board sits on top **clipped to its cell**. A scrambling value has no break points: unclipped it pushed a 400 px page 33 px wide while it ran. `set-pieces.ts` → `scramble`, `[data-scramble]`.

## Self-drawing line icons

`pathLength="1"` on each stroke, then `strokeDasharray: 1, strokeDashoffset: 1 → 0`, then one small act (under 2 s in total), replayed on the row's `pointerenter` and `focusin`. **Trap:** `vector-effect: non-scaling-stroke` makes dashes run in screen pixels and ignore `pathLength` (measured: the lines broke into short dashes at offset 0.5); for those, draw with a `clip-path: circle()` growing from a centre point instead. A replay on focus needs a focusable row: add the tab stop only where the row is worth one.

## Rolling ball on a scrubbed rail

In the same scrub timeline as the rail fill: `y` from `-railLength` to 0 and `rotation` to `railLength / (π × diameter) × 360`, both `ease: "none"`, as function values with `invalidateOnRefresh: true`. The server draws the ball at the foot of the finished line (the reduced-motion state). `both-ways-engine.ts` → `[data-rail-ball]`.

## Scroll-velocity ticker

Moves only while the page scrolls, by the distance scrolled and in its direction: `gsap.set(track, { x: wrap(-scrollY * 0.5) })` on a passive `scroll` listener, `wrap = gsap.utils.wrap(-copyWidth, 0)` re-measured on resize, the line duplicated once. `aria-hidden`, so it may only repeat facts already on the page. `set-pieces.ts` → `[data-ticker-track]`.

## Card flip on arrival

```css
@media screen and (prefers-reduced-motion: no-preference) {
  [data-flip-in] [data-part="flip"] { animation: flip-in 1s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards; }
}
@keyframes flip-in { from { transform: perspective(900px) rotateY(180deg); } to { transform: perspective(900px) rotateY(0); } }
```

Render the card with its back face (`backface-visibility: hidden` on both faces) so the first half shows the back.

## Page transitions (React `<ViewTransition>`, Next.js App Router)

Read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` first. No config needed in Next 16.

```tsx
// PageTransition.tsx: in each page, never the layout (a layout never enters or exits).
const slide = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };
export const PageTransition = ({ children }) => (
  <ViewTransition enter={slide} exit={slide} default="none">{children}</ViewTransition>
);
```

```tsx
// Header.tsx: the type comes from the nav order.
const here = nav.findIndex(({ href }) => (href === "/" ? pathname === "/" : pathname.startsWith(href)));
const slide = (to: number) => (here < 0 || to === here ? undefined : [to > here ? "nav-forward" : "nav-back"]);
<Link href={href} transitionTypes={slide(i)}>…</Link>
```

```css
body > header { view-transition-name: site-header; }
::view-transition { pointer-events: none; }                  /* clicks go through */
::view-transition-group(site-header) { animation: none; z-index: 100; }
::view-transition-old(site-header) { display: none; }         /* the new header shows at once */
::view-transition-new(site-header) { animation: none; }
::view-transition-old(.nav-forward), ::view-transition-old(.nav-back) {
  animation: 150ms ease-in both vt-fade reverse, 400ms ease-in-out both vt-slide reverse;
}
::view-transition-new(.nav-forward), ::view-transition-new(.nav-back) {
  animation: 210ms ease-out 150ms both vt-fade, 400ms ease-in-out both vt-slide;
}
::view-transition-old(.nav-forward), ::view-transition-new(.nav-back) { --slide: -60px; }
::view-transition-new(.nav-forward), ::view-transition-old(.nav-back) { --slide: 60px; }
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) {
    animation-duration: 0s !important; animation-delay: 0s !important;
  }
}
@keyframes vt-fade { from { opacity: 0; } }
@keyframes vt-slide { from { translate: var(--slide); } }
```

What the build measured: a navigation without a type slides nothing, and **the back button starts no transition at all**; a page under no nav item has no position, so its header links do not slide; React cancels the root snapshot when only boundaries change, so the footer and background stay live under the slide.

**Shared-element morph:** the same `name` on both ends (`<ViewTransition name={`card-${slug}`} share="morph">`). It **does** pair out of a `<dialog>` top layer in Chromium (measured: the group animates 250 ms). A name must be unique on screen.

**Tab crossfade inside a page:** `startTransition(() => setTab(t))` and a keyed `<ViewTransition name="tabs" share="auto" default="none">` with **no `enter` class**, or a type-less arrival on the page fades the panel in on its own.

## Celebration after a success

```ts
// Measure the origin BEFORE the request, so nothing runs between the 2xx and the done state.
const r = button.current?.getBoundingClientRect();
// …request… if (res.ok) return setState("sent");
useEffect(() => {
  if (state !== "sent" || !at || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { burst(at.x, at.y); } catch (err) { reportError(err); } // never takes "Sent" back
}, [state]);
```

`burst` appends a `position: fixed; inset: 0; overflow: hidden; pointer-events: none` layer (it can neither widen the page nor catch a click), animates 18 pieces with `element.animate`, removes the layer on `Promise.allSettled` of their `finished` promises (a navigation that cancels them still clears it), and removes it at once if building the pieces throws.

## Feedback on controls

```css
.btn-cta:not(:disabled):active { translate: 0 1px; }                       /* key-press dip */
.btn-cta:not(:disabled):is(:hover, :focus-visible)::after { opacity: 1; }  /* block cursor drawn in the right padding: nothing moves */
.nav-link::after { content: ""; position: absolute; inset-inline: 0; bottom: 12px; height: 1px; background: currentColor; transform: scaleX(0); transform-origin: left; }
.nav-link:is(:hover, :focus-visible, [aria-current="page"])::after { transform: none; } /* the state works without motion */
@media (prefers-reduced-motion: no-preference) {
  .nav-link::after { transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1); }         /* only the movement is gated */
  .copy-tick path { stroke-dasharray: 1; animation: tick-draw 0.35s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
  [data-replay]:is(:hover, :focus-visible) { animation: shake 0.5s linear; }                /* once per hover */
}
@keyframes tick-draw { from { stroke-dashoffset: 1; } }
```

Copy: a tick with `pathLength="1"` drawn beside "Copied". Space held on a `<button>` also matches `:active`, so the dip works from the keyboard.
