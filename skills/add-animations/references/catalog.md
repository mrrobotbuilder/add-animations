# Animation styles: when to use each, when to skip it, how to build it

SVGator's list of 31 website animation styles (svgator.com/blog/website-animation-examples-and-effects, 2026) with the common extras a portfolio or product site needs. Each entry: what it is · **use** · **skip** · **build** · **reduced motion**. "Proven" marks a recipe shipped and checked in a real build (both directions, reduced motion, 400 px); its code is in `recipes.md`, `both-ways-engine.ts`, `set-pieces.ts` or `scroll-layer.css`. The rest are researched.

Rules that apply to every entry: nothing moves on its own past 5 s without a pause control (WCAG 2.2.2); every entry has a reduced-motion path that is the finished, still state; the server renders the finished state.

## Scroll

1. **Scroll reveal, both ways** (proven) · rows rise in as they arrive and drop in from above on the way back up · **use:** every content row below the fold · **skip:** the hero if an intro lands on it; print-only pages (a row waiting below the fold prints blank) · **build:** `both-ways-engine.ts` · **reduced:** nothing registered.
2. **Scrollytelling** (SVGator 2) · a story told by scrolling: pinned sections, scrubbed timelines · **use:** one real narrative (a product walkthrough, a career, a process) · **skip:** reading pages; pinning traps visitors who only want to get past · **build:** GSAP ScrollTrigger `pin: true` + `scrub`, timelines with explicit end states · **reduced:** the steps stacked, static.
3. **Parallax** (SVGator FAQ) (proven) · background layers move slower than the page · **use:** a hero background, one depth layer · **skip:** text layers, more than two layers on phones (nausea, jank) · **build:** `scroll-layer.css` (`translate` over `scroll(root)` with an `animation-range`) · **reduced:** none.
4. **Scroll progress line** (proven) · a thin line fills as the page is read · **use:** long pages · **skip:** short pages · **build:** `scroll-layer.css`. **Trap:** on a page too short to scroll the timeline is inactive and the line sits at full width unless its rest value is `scaleX(0)` · **reduced:** hidden.
5. **Turn away on exit** (proven) · an element tips back and dims as it leaves the top, stands up again on return · **use:** a hero card or product shot · **skip:** anything the visitor must click while it is leaving · **build:** `scroll-layer.css` (`view()` timeline, `exit` range; put it on a wrapper so other transforms stay free) · **reduced:** none.
6. **Scale-in on entry** (proven) · a screenshot or media block settles from 0.94 to 1 as it enters · **use:** one big image per page · **skip:** text · **build:** `scroll-layer.css` `.shot-open` (`view()` timeline, `entry 0%` to `cover 35%`, a `clip-path` opening from the middle line plus `scale` 0.94 to 1) · **reduced:** none.
7. **Horizontal and vertical scrolling sections** (SVGator 15) · a section that scrolls sideways while the page scrolls down, or snaps · **use:** galleries, a timeline of many items · **skip:** primary content, forms, anything a keyboard user must reach · **build:** CSS `scroll-snap`, or GSAP pin with an `x` scrub · **reduced:** a plain list.
8. **Scroll-velocity ticker** (proven) · a marquee that moves only while the page scrolls, by the distance scrolled and in its direction · **use:** a stadium board, a ticker of facts already on the page · **skip:** any fact that appears nowhere else (it must be `aria-hidden`) · **build:** `set-pieces.ts` `[data-ticker-track]`: `x = wrap(-scrollY * 0.5)` on a passive scroll listener, the line duplicated once, `wrap` re-measured on resize · **reduced:** static.
9. **Scroll-linked rolling object** (proven) · a ball or wheel that travels with the scroll and turns by distance over circumference · **use:** a timeline rail · **build:** in the same scrub as the rail: `y` from 0 to the rail length, `rotation` = length / (pi x diameter) x 360 · **reduced:** at rest at the end.

## Type

10. **Expressive typography** (SVGator 4) (proven: mask rise, per-letter wave) · kinetic words, masks, per-letter staggers · **use:** one loud headline per section · **skip:** body text, long paragraphs · **build:** a clip-path mask rise (proven in the engine), GSAP SplitText, or server-rendered letter spans (`aria-hidden`) beside a visually hidden copy · **reduced:** static text.
11. **Typewriter** (proven) · a command or word types itself · **use:** a terminal-style design, a short command · **skip:** anything longer than a few words; the name itself if a rise already says "terminal" · **build:** CSS `steps(n)` on a clip or a width in `ch` units (monospace only) · **reduced:** typed.
12. **Text scramble / split-flap board** (proven) · letters cycle and land on the word · **use:** a departure-board or transfer-listing look, a 404 · **skip:** body text · **build:** GSAP ScrambleTextPlugin on an `aria-hidden` copy clipped to its cell, the real word transparent underneath. **Trap:** a scrambling value has no break points and widens a narrow page while it runs · **reduced:** the word.
13. **Punchline beat** (proven) · a joke's last words land a beat after the rest · **use:** a hero with a joke · **build:** a nested span with its own delay and a small scale slam (1.3x, `power4.in` as `cubic-bezier(0.64, 0, 0.78, 0)`); word by word from 2x for a CTA headline, which must clip its own sides (`overflow-x: clip`): in the fallback font before the web font lands, a word at 2x ran past a 400 px screen · **reduced:** present from the start.
14. **Count-up numbers** (proven) · a number counts from 0 when it arrives · **use:** stats, ratings · **skip:** prices and facts that must be read exactly while moving · **build:** the engine's `[data-count]`; keep the real number in the DOM while waiting · **reduced:** the number.

## Lines and SVG

15. **Line animation** (SVGator 7) (proven) · thin-line illustrations that move · **use:** icons beside lines of copy, diagrams · **build:** SVG with strokes, GSAP or CSS · **reduced:** drawn.
16. **Self-drawing** (SVGator 8) (proven) · strokes draw themselves · **use:** icons, a pitch or tactics board, a signature · **build:** `pathLength="1"` with `stroke-dasharray: 1` and `stroke-dashoffset` 1 to 0, or DrawSVGPlugin. **Trap (confirmed):** `vector-effect: non-scaling-stroke` dashes run in screen pixels and ignore `pathLength`, so those lines broke into short dashes; a `clip-path: circle()` growing from the centre draws them instead · **reduced:** drawn.
17. **Morphing** (SVGator 9) · a shape turns into another · **use:** icon state changes (menu to close, play to pause), a logo intro · **skip:** text, anything read mid-morph · **build:** MorphSVGPlugin · **reduced:** end shape.
18. **Animated logo** (SVGator 10) · the mark animates once, and on hover · **use:** the header mark, a loader that is really needed · **skip:** looping logos · **build:** SVG + GSAP timeline, once · **reduced:** static mark.
19. **Animated icons** (SVGator 11) (proven) · an icon acts once when it arrives or is hovered (a drum hit, a plane crossing, a dumbbell lift) · **use:** icons that illustrate a line of copy · **build:** self-drawing plus one action, replayed on hover and focus of its row, under 2 s · **reduced:** drawn, still.
20. **Character animation** (SVGator 13) · a mascot that moves · **use:** only when the brand has a mascot · **skip:** invented characters, AI faces · **reduced:** a still pose.
21. **Doodles** (SVGator 21) · hand-drawn playful marks · **use:** playful brands · **skip:** flat or terminal systems.

## Depth

22. **Faux 3D** (SVGator 14) (proven: pointer tilt, the flip on arrival, the hero card turning away) · perspective tilt, card flips, layered depth · **use:** cards and products (pointer tilt on fine pointers only, a flip on arrival) · **build:** CSS `perspective` + `rotateX/Y`, `backface-visibility` · **reduced:** flat and still.
23. **Real-time rendering** (SVGator 1) · WebGL or three.js scenes · **use:** product configurators, immersive brand sites with a budget · **skip:** content sites, backgrounds, phones on battery · **reduced:** a still render.
24. **AR and VR motion** (SVGator 3) · immersive device experiences · **skip:** ordinary websites.
25. **Isometric** (SVGator 19) · 2D art at 120-degree axes · **use:** spatial products, systems diagrams · **skip:** flat systems without a reason.

## Surfaces

26. **Ambient background motion** (SVGator 6) · particles, stars, slow gradients · **use:** a hero sky, bounded to 5 s after it is first seen, or tied to scroll (parallax) · **skip:** endless loops without a pause control · **build:** canvas that stops its loop after 5 s and only runs while on screen · **reduced:** drawn once.
27. **Background animations** (SVGator 20) · patterns that shift behind a section · as 26.
28. **Animated gradients** (SVGator 18) · colour flows · **use:** brand-colour SaaS heroes · **skip:** flat systems, text.
29. **Liquid motion** (SVGator 17) · blobby morphs and ripples · **skip:** crisp systems; use only if the brand is fluid.
30. **Glassmorphic, neumorphic, claymorphic** (SVGator 27 to 29) · material styles more than motion · **use:** only when the design system is that material.
31. **Mixed media** (SVGator 16) · photos plus vector collage · **use:** editorial, Gen-Z brands · **skip:** terminal or product-UI systems.

## Navigation and feedback

32. **Page transitions** (SVGator 22) (proven) · a slide and fade between routes, direction by nav order, the header still · **use:** multi-page sites · **build:** React `<ViewTransition>` with `Link` `transitionTypes` (Next.js App Router, no config), or `document.startViewTransition`; `::view-transition { pointer-events: none }`, the header named and not animated. The back button starts no transition (measured) · **reduced:** durations 0.
33. **Shared-element morph** (proven) · the card you clicked becomes the page's card · **use:** a grid into a detail page · **build:** the same `ViewTransition` `name` on both · **measured:** a source inside a `<dialog>` top layer does pair in Chromium (the group animates 250 ms); a name must be unique on screen.
34. **Hero entrance** (SVGator 23) (proven) · the first screen's rows rise in one after another · **use:** every page's first rows · **build:** CSS keyframes staggered by `--i`, from first paint, `backwards` fill only, `@media screen`, held under an intro overlay · **reduced:** static.
35. **Microinteractions** (SVGator 12) (proven) · a button dips when pressed, copy draws a tick, a link underlines from the left · **use:** every control · **build:** CSS transitions under 200 ms · **reduced:** state change without movement.
36. **Hover effects** (SVGator 26) · reveal on hover · **use:** extra detail, pointer tilt, sheen · **skip:** the only way to see content (touch has no hover) · **build:** `@media (hover: hover) and (pointer: fine)` · **reduced:** static highlight.
37. **Celebration** (proven) · confetti or a burst after a success · **use:** once, after the done state is on screen · **skip:** before a request succeeded, on errors · **build:** `recipes.md` (origin measured before the request, a fixed clipped layer that ignores the pointer, its own try/catch) · **reduced:** none.

## Waiting

38. **Loading animations** (SVGator 25) · progress for real waits · **use:** waits longer than about a second · **skip:** fake loaders on static sites.
39. **Skeleton screens** (SVGator 24) · grey shapes where content will be · **use:** async data · **skip:** static pages.

## Formats

40. **Flipbooks and stop-motion** (SVGator 30, 31) · page-turn catalogs, frame-by-frame sequences (`steps()` over a sprite) · **use:** catalogs, a deliberately nostalgic brand · **skip:** heavy frame assets on a content site.
