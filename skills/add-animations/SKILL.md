---
name: add-animations
description: Give a whole website a motion pass - reveals that replay when scrolling both down and up, a scroll layer (parallax, progress, elements that turn as they leave), set pieces tied to the page's own words, page transitions and feedback on every control - without breaking accessibility, performance or the design system. Starts by reading the site and its copy, asks the owner the few questions that change the build, picks styles from a catalog of 40 animation styles with when to use and when to skip each, builds in layers from cheapest to richest, and proves it with a both-directions browser check and an all-routes audit. Use when the user says "add animations", "animate my site", "make the website full of animations", "make it feel alive", "scroll animations both ways", "animations when I scroll up too", "motion pass", or shares an animation inspiration list and wants it applied. For one component's animation, a list of opportunities only, an audit of existing motion, or naming an effect, use a narrower skill if one is installed.
---

# Add animations to a website

A build skill for a whole site's motion. It reads the site, turns its words into motion, asks the owner the questions that change the build, builds in layers, and proves every layer in a real browser. It comes from a real build (a Next.js 16 portfolio, four stages, 2026-09-30 to 2026-10-01) and the traps that build hit; every recipe in `references/` shipped and was checked both ways, under reduced motion and at 400 px.

## The stance

- **Motion follows the visitor.** Every scroll, hover, click and key press gets an answer, in both directions. Nothing moves on its own for more than 5 seconds unless there is a pause control (WCAG 2.2.2). "Never a boring second" means never a dead input, not constant ambient motion: reading time stays still. If the owner wants endless ambient motion, offer the price: a remembered Motion on/off switch.
- **Motion says something the words already say.** Every set piece is tied to one line of copy (a football rolls down a football timeline; a terminal command types itself). Generic motion (everything fades up) is the floor, not the goal.
- **The finished page is the default.** The server renders every element in its final state; script only hides what is off screen when it runs. No-JS visitors, crawlers, printers and reduced-motion visitors get the complete page.
- **Cheapest tool that works.** CSS before GSAP, native (scroll-driven animations, View Transitions) before libraries, one lazy chunk before an eager one.

## Workflow

### 1. Read the site (never skip)

- Stack and existing motion: `grep -rn "gsap\|framer-motion\|motion/react\|lenis\|@keyframes\|animation-timeline\|ViewTransition" src`. Reuse what is there; do not add a second animation library.
- Design rules: flat or not, the colour tokens, what may glow or gradient. Motion must not smuggle in a style the design system forbids.
- Accessibility rules already in the project (reduced motion, focus rings, one CTA per viewport, error banners).
- **The copy, section by section.** Read every heading and line the visitor sees; the set pieces come from here.
- Look at the site once, cheaply: a few viewport screenshots at 640 px wide down the main page.
- **Measure Lighthouse on the main page before touching anything** (three first-visit runs, as they come out). This is the baseline every later stage is judged against; see step 7.

### 2. Map the words to motion

Write a table: section, its one message, the one motion that says it, the style from `references/catalog.md`, the trigger (load, scroll-in both ways, scroll position, hover, click). Keep one loud beat per section (usually its title); everything else is quiet. Reject a motion that says nothing about its line.

### 3. Ask the owner (one AskUserQuestion, up to four questions)

1. **Idle motion:** follow the visitor (recommended) or a Motion switch that allows endless ambient loops.
2. **Set pieces:** the groups from step 2, multi-select, all recommended.
3. **Git:** if the tree holds someone else's uncommitted work, commit it first as its own commit.
4. **Sessions:** a big site is staged (one layer per session, a plan plus a run guide) because a long session re-sends its whole context every turn. The build this skill came from used four: reveals and scroll layer; set pieces; transitions, entrances and feedback; audit and ship.

State the assumption for "both directions" in the message rather than asking: a target replays whenever it enters the viewport's band, from the side the visitor scrolls from, and resets only once fully off screen; motion tied to scroll position runs backwards on the way up.

### 4. Build in layers, cheapest first

1. **First-paint entrances** (CSS keyframes staggered by `--i`; no script, no flash): `references/recipes.md`. Held under any intro overlay by an attribute on `<html>`, with a failsafe delay.
2. **The reveal engine, both ways** (GSAP ScrollTrigger): `references/both-ways-engine.ts`. Kinds: rows (rise or drop 24 px), titles (out of a clip-path mask from the entering edge), rules (draw from the left going down, from the right coming up), group items (stagger, bars fill, numbers count up), typed paths (`steps(n)` from the text length), slammed words. A new kind is one entry in `KINDS`.
3. **The scroll layer** (native CSS scroll-driven animations): `references/scroll-layer.css`. A progress line, parallax at half speed, an element turning away as it leaves, a media block scaling in.
4. **Set pieces**, one per line of copy: `references/set-pieces.ts` (effects that run inside a row as it plays, and pointer, focus and scroll pieces) and `references/recipes.md` (typing, slam, wave, keys, scramble, self-drawing icons, a rolling ball, a scroll ticker, a card flip). GSAP plugins (SplitText, ScrambleText, DrawSVG, MorphSVG, MotionPath, Flip) are all in the free `gsap` package since 3.13.
5. **Page transitions:** `references/recipes.md` (React `<ViewTransition>` in the Next.js App Router, read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`; elsewhere `document.startViewTransition`). Direction from the nav order, the header held still, durations 0 under reduced motion.
6. **Feedback on controls** (CSS): `references/recipes.md`. A key-press dip on the main button, a tick drawn on copy, underlines from the left, a shake on a replay link, a burst after a success.

Load animation code lazily (`import()` after hydration) and never under reduced motion: check `matchMedia("(prefers-reduced-motion: reduce)")` before the import, not only inside it.

### 5. Hard rules (each one cost a real bug)

Reveals and the engine:
- **Hide waiting elements with opacity, never `visibility: hidden`** (so never GSAP `autoAlpha` for reveals). `visibility: hidden` removes an element from the Tab order and the accessibility tree: a keyboard user tabbing down the page skipped every link still waiting below the fold and landed in the footer. Add a `focusin` listener that shows a waiting element at once.
- **Measure trigger lines from the layout, minus your own offset, and minus every enclosing target's offset.** ScrollTrigger measures an element where it currently is: a row waiting 24 px low shifts its lines by 24 px, so it was judged on screen after it had left and never replayed; a typed path inside a rising eyebrow carried its parent's 24 px and was left hidden on screen at 400 px.
- **Batched callbacks arrive late** (`ScrollTrigger.batch`, `interval`): re-check that the element is still on screen before playing or hiding it.
- **Cap a batch's total stagger** (0.08 s apart, 0.4 s at most): a tall screen or a fast scroll brings a dozen rows at once.
- **On a tall screen the last rows never reach an 85% line:** cap the start just short of the maximum scroll. Test at 1280x1300.
- **A CSS animation's `forwards` (or `both`) fill beats inline styles:** a CSS entrance that GSAP later replays must use `backwards` only, or GSAP's replay does nothing visible.
- **A CSS `transition` on the property GSAP animates fights it** (the value lags); expect it in checks, or remove the transition during GSAP control.
- **Keep the hero out of scroll reveals** when an intro measures it; exclude anything another animation lands on.

Text and set pieces:
- **Text effects keep the real text for screen readers:** a visually hidden copy plus an `aria-hidden` animated copy. Never scramble or type the only copy of a word.
- **Anything that scales up or scrambles can widen the page while it runs** (a scrambled value has no break points: +33 px at 400 px; a word slamming from 2x: +14 px). Clip it to its cell or its line (`overflow-x: clip`), and sample the page width every 50 ms through the motion: a check that reads once per scroll position misses it. **Sample it again with the web fonts delayed** (route `*.woff2` 2 s late, the audit's `SLOW_FONTS=1`): the fallback font is wider, and a load-time slam that fit in the real font ran 6 px past a 400 px screen on a slow connection. It showed up as one intermittent failure in a long run and reproduced every time once the fonts were delayed. **The same run found a bigger one: a fallback sized for the wrong width.** next/font scales its fallback (Arial) to the web font's *default* width; headlines that run a variable font condensed (`font-variation-settings: "wdth" 75`) were up to twice as wide in the fallback, bold, and Home's name ran 151 px off a phone screen until the font landed. Measure the fallback against the real face in the browser (same text, same weight, both families), then give the headlines their own fallback face listed after the real one: for a condensed monospace, a system monospace at 100% (Courier New, Menlo, Roboto Mono, DejaVu Sans Mono all advance 0.6 em) matched letter for letter. Naming next/font's face in your own CSS needs a guard that reads the built CSS and fails if the name changes.
- **`vector-effect: non-scaling-stroke` ignores `pathLength`**: its dashes run in screen pixels, so a stroke-dash draw breaks into short dashes. Use a `clip-path` wipe for those lines.
- **Nothing with text inside a filtered or scaling ancestor at load:** Chrome can size that text as the ancestor's whole box and make it the LCP element (a 126x22 px label was charged 45,161 px²). Ask Chrome for its LCP candidates (a `largest-contentful-paint` observer, `buffered: true`) before theorising.

Scroll layer:
- **`animation-timeline` goes after the `animation` shorthand**, which resets it. At rest a `view()` animation reports the identity matrix, not `none`.
- **A scroll timeline on a page too short to scroll is inactive and applies nothing:** the progress line sat at full width on the 404. Give the element its rest value (`transform: scaleX(0)`) and the keyframes an explicit `to`.
- **Use the separate `translate`, `rotate` and `scale` properties** when a scroll animation and an entrance animate the same element: they compose instead of overriding.
- **Never hide something with a scroll-linked opacity that someone must click** unless it is still fully usable when faded.

Transitions and feedback:
- **A navigation without a type slides nothing, and the browser's back button starts no view transition at all** (measured). Do not promise a back animation.
- **The header must be named and not animated** (old image `display: none`, new one `animation: none`), and `::view-transition { pointer-events: none }`, or the header slides with the page and clicks die during the transition.
- **A keyed crossfade inside a page needs `default="none"` and no `enter` class**, or a type-less arrival on the page fades it in on its own.
- **Nothing decorative between a successful request and its done state:** measure where the burst starts before the request, commit "Sent", then run the burst in its own try/catch that reports to the error banner and never takes "Sent" back.

Everything:
- **Grep `src` for `infinite` and `repeat: -1` before calling it done.** Each hit either stops within 5 s, answers the visitor, or is the one documented exemption (a full-screen intro that waits on a click with Skip beside it).
- **Every animation has a reduced-motion path, and that path is the finished, still state.** CSS motion lives inside `@media (prefers-reduced-motion: no-preference)` (scroll-driven rules also inside `@supports (animation-timeline: scroll())`); list every `animation`/`transition` outside such a block and justify each (a colour fade is fine; movement is not).
- **Animate `transform`, `translate`, `rotate`, `scale`, `opacity`, `clip-path` and SVG strokes only.**

### 6. Prove it (in the browser, both directions, every route)

Two scripts, both Playwright, both run against a **production build** (`next build` then `next start` on a port nobody else uses; a dev server that has run for hours can serve stale or broken workers):

- `references/check-template.mjs` walks the main page down and back up in half-screen steps and, at every settled step (polled, bounded at 3 s), asserts: no target is ever `visibility: hidden`; every target fully off screen waits and every target inside the band is shown; nothing hid while on screen; targets enter from below going down and from above coming up (evidence owed only where it can exist); at full scroll every on-screen target is shown; the scroll layer tracks the scroll and rests at the top; Tab reaches the key button **before anything in the footer**; reduced motion is complete and still; at most one filled CTA per viewport.
- `references/audit-template.mjs` covers **every route** (each page kind, a detail page, a 404) at 1280x800, 1280x1300 and 400x800: the page width sampled every 50 ms through load and a walk down and up (and once more at 400 px with `SLOW_FONTS=1`); Tab through the whole page from a fresh load, each focus on screen, opaque and wearing a painted ring of at least 2 px; the progress line empty at rest; reduced motion with nothing running and every target complete; no error banner, no page errors; long tasks during a fast wheel scroll (1x and 4x CPU).

Rules for the checks themselves:
- **Every verdict has three states plus one:** ok, FAIL, N/A (could not measure: never a pass) and `--` (the page geometry rules the case out for every visitor, such as a section that can never leave the screen upward). Print `--` with the measurement that rules it out.
- **Time animations with values sampled every frame in the page, never with screenshots:** a capture stalls the page's clock by an unknown amount.
- **A Tab walk counts against the page's own list of focusable elements** (rendered `a[href]`, buttons, fields, `[tabindex]` not -1) and identifies each element by an id it stamps on it, never by its markup: a key built from the first 120 characters of HTML collided on two identical cards in one row, so the walk "wrapped" after 11 of Home's 30 elements and passed.
- **Never let one page load crash a long run:** wait for `load`, then for network idle with a bound, and on a timeout print the requests still open as N/A. Twice a run died on `networkidle` while another browser run shared the machine, and 12 lone loads of the same route were idle in under a second.
- **Start a keyboard walk from a fresh load or a known element:** after `blur()` Chrome keeps its sequential-focus start point on the blurred element.
- **Allow for float in timing asserts:** CSS computes `5 * 90ms` as 449.99999999999994 ms.
- **Prove each check can fail:** copy the files aside, put the old engine (or the unfixed rule) back, rebuild, watch the check go red where it should, restore by copy. A check that has never failed proves nothing.

Last, look: one downscaled viewport screenshot per route and width, mid-scroll, tiled into a few contact sheets.

### 7. Performance (measure before, between and after)

- Lighthouse on the main page and one detail page before the pass, then after **every** stage, three first-visit runs each with mobile defaults, reported as they come out. The build this skill came from skipped the between-stage runs and found a 30-point drop only two stages later.
- When a score drops, bisect before fixing: build each earlier commit in a scratch worktree (`git worktree add --detach <short temp path> <sha>`, one `npm ci` serves every commit whose lockfile matches) and run it alternately with the current build on the same machine, so machine noise hits both.
- Long tasks during a fast scroll: a buffered `longtask` observer, the load's own tasks left out, at 1x and 4x CPU. CSS scroll timelines run on the compositor; GSAP scrubs and scroll listeners run on the main thread.

## Tool choice

| Need | Use |
|---|---|
| Hover, press, focus feedback; first-paint entrances | CSS transitions and keyframes |
| Motion tied to scroll position (progress, parallax, turn-away, scale-in) | CSS scroll-driven animations (`scroll()`, `view()`), progressive |
| Triggered sequences, both-ways reveals, staggered batches, scrubbed timelines, pinning | GSAP + ScrollTrigger |
| Split or scrambled text, drawn or morphed SVG, motion along a path, layout flips | GSAP SplitText, ScrambleText, DrawSVG, MorphSVG, MotionPath, Flip (free) |
| One-off replays on hover (a wave, a burst) | `element.animate` (Web Animations API) |
| Route changes | View Transitions (React `<ViewTransition>` in Next.js) |
| Smooth scrolling | Lenis, only if the project already wants it; it must pause when a modal locks scroll |
| React component state (enter, exit, layout) in a project already on it | Motion (framer-motion) |
| Real-time 3D | three.js or R3F, only with a real reason and budget; never for a background |

## References

- `references/catalog.md`: 40 styles (SVGator's 31 plus the common extras), each with what it is, when to use it, when to skip it, how to build it and its reduced-motion path; "proven" marks the ones shipped and checked.
- `references/both-ways-engine.ts`: the reveal engine (TypeScript, GSAP), with its kinds table.
- `references/set-pieces.ts`: effects inside a playing row (`INNER`) and pointer, focus and scroll pieces (`setPieces`).
- `references/scroll-layer.css`: the scroll layer (native CSS).
- `references/recipes.md`: entrances, typing, slams, wave, keys, scramble, icons, rolling ball, ticker, card flip, page transitions, the shared-card morph, tab crossfade, the success burst, control feedback.
- `references/check-template.mjs`: the both-directions check for the main page.
- `references/audit-template.mjs`: the all-routes audit.
