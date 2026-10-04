// Proven engine (add-animations skill). Copied from a shipped Next.js site
// (2026-10-01, GSAP 3.15 + ScrollTrigger), checked both ways at
// 1280x800, 1280x1300 and 400x800. Pair it with
// set-pieces.ts (INNER + setPieces) or delete those two lines and their uses.

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { INNER, setPieces } from "./set-pieces";

/*
 * Scroll reveals, both ways.
 * A target plays whenever it enters the band between 85% and 15% of the
 * viewport, from the side the visitor scrolls from: it rises from below on the
 * way down and drops from above on the way up. It resets only once it is fully
 * off screen, so nothing vanishes while it is looked at.
 *   [data-reveal]        a row rises (or drops) and fades in.
 *   [data-reveal-item]   a row inside a [data-reveal-group]: rows arriving
 *                        together are staggered, any [data-bar] inside fills
 *                        from empty and any [data-count] counts up from 0.
 *   [data-reveal-title]  a display heading comes out of a mask (clip-path) from
 *                        the edge it enters by: the section's one loud beat.
 *   [data-reveal-rule]   a divider draws itself, from the left going down and
 *                        from the right coming back up.
 *   [data-reveal-type]   a path types itself like a `cd`, one letter a step
 *                        (monospace fonts only), both ways.
 *   [data-reveal-slam]   a word slams in from 2x; words
 *                        arriving together land one after another.
 *   [data-rail]          a timeline: [data-rail-fill] follows the scroll
 *                        (scrubbed), [data-rail-ball] rolls on its tip, and each
 *                        [data-rail-dot] lights as the line passes it and goes
 *                        out as it passes back.
 * Inside a target that plays, set-pieces.ts's INNER effects run too (a
 * scramble, self-drawing icons, a tip and a fidget), and reset while it waits.
 * A waiting target is hidden with opacity (and a clip or a scale), never with
 * visibility: hidden, so Tab and screen readers still reach it, and a focus
 * landing inside one shows it at once. The server renders everything finished
 * and whatever is on screen when this runs is left alone, so nothing flashes and
 * a visitor without JS sees the whole page. Under prefers-reduced-motion nothing
 * is registered. Returns the cleanup.
 */
const LINE = 0.85; // arrive as the top passes 85% of the viewport going down, the bottom 15% coming up

type Side = "below" | "above";
type Kind = {
  /** How a target waits, off screen on one side or the other. */
  from: (side: Side) => gsap.TweenVars;
  /** Where it arrives: its natural, server-rendered state. */
  to: gsap.TweenVars | ((el: HTMLElement) => gsap.TweenVars);
};

const toward = (side: Side, px: number) => (side === "below" ? px : -px);

const KINDS: [selector: string, kind: Kind][] = [
  [
    "[data-reveal], [data-reveal-item]",
    {
      from: (side) => ({ opacity: 0, y: toward(side, 24) }),
      to: { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
    },
  ],
  [
    "[data-reveal-title]",
    {
      from: (side) => ({
        clipPath: side === "below" ? "inset(100% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
        y: toward(side, 48),
      }),
      // Cleared at the end: an inset of 0 would clip descenders under line-height 0.9.
      to: { clipPath: "inset(0% 0% 0% 0%)", y: 0, duration: 0.9, ease: "power3.out", clearProps: "clipPath,transform" },
    },
  ],
  [
    "[data-reveal-rule]",
    {
      from: (side) => ({ scaleX: 0, transformOrigin: side === "below" ? "left center" : "right center" }),
      to: { scaleX: 1, duration: 1.1, ease: "power2.inOut" },
    },
  ],
  [
    "[data-reveal-type]",
    {
      from: () => ({ clipPath: "inset(0% 100% 0% 0%)" }),
      to: (el) => {
        const n = el.textContent?.length ?? 1;
        return { clipPath: "inset(0% 0% 0% 0%)", duration: n * 0.05, ease: `steps(${n})`, clearProps: "clipPath" };
      },
    },
  ],
  [
    "[data-reveal-slam]",
    {
      from: () => ({ opacity: 0, scale: 2 }),
      to: { opacity: 1, scale: 1, duration: 0.45, ease: "power4.in" },
    },
  ],
];

// Where a target sits, in viewport coordinates, without our own offset: a
// waiting row is moved 24 px (a title 48), and measured there every line would
// drift by that much, so a row could be judged on screen after it has left. A
// target inside another (a typed path in a rising eyebrow) is moved by its
// parent's offset too, so every enclosing target's is subtracted.
const ANY = KINDS.map(([selector]) => selector).join(", ");
const layout = (el: Element) => {
  const r = el.getBoundingClientRect();
  let y = 0;
  for (let e: Element | null = el; e; e = e.parentElement?.closest(ANY) ?? null) y += Number(gsap.getProperty(e, "y")) || 0;
  return { top: r.top - y, bottom: r.bottom - y };
};
const onScreen = (el: Element) => {
  const l = layout(el);
  return l.bottom > 0 && l.top < window.innerHeight;
};

// Trigger lines as functions of the layout, so ScrollTrigger re-measures them on
// every refresh (resize, late images) whatever state a target is in; batch hands
// each function its target's own trigger.
const edge = (pick: (l: { top: number; bottom: number }) => number, viewport: number) => (self: ScrollTrigger) =>
  pick(layout(self.trigger as Element)) + window.scrollY - viewport * window.innerHeight;
// On a tall screen the last rows of a page never reach the line, even at full
// scroll, and would never play. Capped just short of the page's maximum scroll,
// they play at the bottom instead.
const bandStart = (self: ScrollTrigger) =>
  Math.min(edge((l) => l.top, LINE)(self), ScrollTrigger.maxScroll(window) - 1);

export function revealOnScroll(root: HTMLElement): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  gsap.registerPlugin(ScrollTrigger);

  const kindOf = new Map<HTMLElement, Kind>();
  const waiting = new Map<HTMLElement, Side>();
  const running = new Map<HTMLElement, gsap.core.Timeline>();
  const dots: HTMLElement[] = [];
  const inside = (el: HTMLElement, sel: string) => [...el.querySelectorAll<HTMLElement>(sel)];

  const hide = (el: HTMLElement, side: Side) => {
    running.get(el)?.kill();
    running.delete(el);
    gsap.set(el, kindOf.get(el)!.from(side));
    gsap.set(inside(el, "[data-bar]"), { scaleX: 0 });
    // Hidden by opacity, a row is still read out, so its count keeps the real number.
    for (const c of inside(el, "[data-count]")) c.textContent = c.dataset.count ?? "";
    for (const [sel, fx] of INNER) inside(el, sel).forEach(fx.reset);
    waiting.set(el, side);
  };

  const play = (els: HTMLElement[], side: Side | null, quick = false) => {
    const list = els.filter((el) => waiting.has(el));
    // 0.08 s apart, but a big batch (a tall screen, a fast scroll) spreads over 0.4 s at most.
    const gap = quick ? 0 : Math.min(0.08, 0.4 / Math.max(1, list.length - 1));
    list.forEach((el, i) => {
      const kind = kindOf.get(el)!;
      const from = kind.from(side ?? waiting.get(el)!);
      waiting.delete(el);
      const tl = gsap.timeline({ delay: i * gap, onComplete: () => running.delete(el) });
      const to = typeof kind.to === "function" ? kind.to(el) : kind.to;
      tl.fromTo(el, from, quick ? { ...to, duration: 0.2 } : to, 0);
      for (const bar of inside(el, "[data-bar]")) {
        tl.fromTo(bar, { scaleX: 0 }, { scaleX: Number(bar.dataset.bar), duration: 0.8, ease: "power2.out" }, 0);
      }
      for (const c of inside(el, "[data-count]")) {
        const n = { v: 0 };
        const onUpdate = () => (c.textContent = String(Math.round(n.v)));
        tl.to(n, { v: Number(c.dataset.count), duration: 0.8, ease: "power2.out", onUpdate }, 0);
      }
      for (const [sel, fx] of INNER) for (const x of inside(el, sel)) tl.add(fx.play(x), quick ? 0 : fx.at);
      running.set(el, tl);
    });
  };

  const ctx = gsap.context(() => {
    for (const [selector, kind] of KINDS) {
      for (const el of root.querySelectorAll<HTMLElement>(selector)) kindOf.set(el, kind);
    }
    const all = [...kindOf.keys()];
    // What is on screen now stays as the server drew it; the rest waits on its side.
    for (const el of all) {
      const l = layout(el);
      if (l.top >= window.innerHeight) hide(el, "below");
      else if (l.bottom <= 0) hide(el, "above");
    }
    // Batched callbacks run a moment late, so each one re-checks the target: a
    // fast scroll must not hide a row that came back, or play one already gone.
    // The zone: from the top entering at the bottom edge to the bottom leaving at the top.
    ScrollTrigger.batch(all, {
      start: edge((l) => l.top, 1),
      end: edge((l) => l.bottom, 0),
      onLeave: (els) => els.forEach((el) => onScreen(el) || hide(el as HTMLElement, "above")),
      onLeaveBack: (els) => els.forEach((el) => onScreen(el) || hide(el as HTMLElement, "below")),
    });
    // The band: the top passing 85% going down, the bottom passing 15% coming up.
    ScrollTrigger.batch(all, {
      start: bandStart,
      end: edge((l) => l.bottom, 1 - LINE),
      interval: 0.1,
      onEnter: (els) => play(els.filter(onScreen) as HTMLElement[], "below"),
      onEnterBack: (els) => play(els.filter(onScreen) as HTMLElement[], "above"),
    });

    for (const rail of root.querySelectorAll<HTMLElement>("[data-rail]")) {
      const fill = rail.querySelector<HTMLElement>("[data-rail-fill]");
      const ball = rail.querySelector<HTMLElement>("[data-rail-ball]");
      if (fill) {
        // The line tip sits at the reveal line (85% of the viewport) the whole way down.
        const tl = gsap.timeline({
          scrollTrigger: { trigger: rail, start: `top ${LINE * 100}%`, end: `bottom ${LINE * 100}%`, scrub: 0.4, invalidateOnRefresh: true },
        });
        tl.fromTo(fill, { scaleY: 0 }, { scaleY: 1, ease: "none", transformOrigin: "top center" }, 0);
        if (ball) {
          // The server draws the ball at the foot of the finished line; it starts
          // at the top and rolls: turned by the distance travelled over its
          // circumference, so it rolls rather than slides, and back on the way up.
          const run = () => fill.parentElement!.offsetHeight;
          const turn = () => (run() / (Math.PI * ball.offsetWidth)) * 360;
          tl.fromTo(ball, { y: () => -run(), rotation: 0 }, { y: 0, rotation: turn, ease: "none" }, 0);
        }
      }
      for (const dot of rail.querySelectorAll<HTMLElement>("[data-rail-dot]")) {
        // The server renders it lit; off only while it is still below the line.
        const r = dot.getBoundingClientRect();
        if (r.top + r.height / 2 > LINE * window.innerHeight) dot.dataset.railDot = "off";
        ScrollTrigger.create({
          trigger: dot,
          start: `center ${LINE * 100}%`,
          onEnter: () => (dot.dataset.railDot = "on"),
          onLeaveBack: () => (dot.dataset.railDot = "off"),
        });
        dots.push(dot);
      }
    }
  }, root);

  // Tabbing to a waiting row scrolls just far enough to show the focus, which can
  // leave it short of the line and still invisible: show it now.
  const onFocus = (e: FocusEvent) => {
    for (let el = e.target as HTMLElement | null; el && el !== root; el = el.parentElement) {
      if (waiting.has(el)) play([el], null, true);
    }
  };
  root.addEventListener("focusin", onFocus);
  const unpiece = setPieces(root);

  return () => {
    unpiece();
    root.removeEventListener("focusin", onFocus);
    for (const tl of running.values()) tl.kill();
    ctx.revert();
    // revert() undoes what the context created; hide and play run later, from
    // callbacks, so their inline styles and the counts' text are undone here.
    for (const el of kindOf.keys()) {
      gsap.set(el, { clearProps: "opacity,transform,clipPath,transformOrigin" });
      for (const bar of inside(el, "[data-bar]")) gsap.set(bar, { scaleX: Number(bar.dataset.bar) });
      for (const c of inside(el, "[data-count]")) c.textContent = c.dataset.count ?? "";
      for (const [sel, fx] of INNER) inside(el, sel).forEach(fx.clear);
    }
    for (const el of dots) el.dataset.railDot = "on";
  };
}
