// Proven set pieces (add-animations skill), from the same build as
// both-ways-engine.ts. INNER = effects that run inside a row as it plays and
// reset while it waits; setPieces = pointer, focus and scroll pieces. The ACTS
// are that site's four icons: keep the shape, draw your own.

import gsap from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";

/*
 * The set pieces tied to the words, loaded with the engine and
 * never under prefers-reduced-motion, so the server-rendered, finished state is
 * what a reduced-motion visitor gets. Nothing here moves on its own for longer
 * than 2 s: each piece answers a row arriving, a hover, a focus or the scroll.
 */
gsap.registerPlugin(ScrambleTextPlugin);

type Inner = {
  /** Seconds into the row's own reveal. */
  at: number;
  /** While the row waits off screen. */
  reset: (el: HTMLElement) => void;
  play: (el: HTMLElement) => gsap.core.Animation;
  /** Back to the server-rendered state (the engine's cleanup). */
  clear: (el: HTMLElement) => void;
};

/* Self-drawing icons: the lines draw themselves (pathLength 1, so a
   dash of 1 is the whole line), then the drawing acts once. Under 2 s each. */
const ACTS: Record<string, (tl: gsap.core.Timeline, svg: Element, at: number) => void> = {
  // The sticks lift and strike; a ring spreads from the skin.
  drums: (tl, svg, at) => {
    const [l, r] = svg.querySelectorAll("[data-stick]");
    tl.fromTo(l, { rotation: 0 }, { rotation: -18, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out", svgOrigin: "6 5" }, at)
      .fromTo(r, { rotation: 0 }, { rotation: 18, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out", svgOrigin: "26 5" }, at + 0.1)
      .fromTo(svg.querySelector("[data-ring]"), { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.5, duration: 0.5, svgOrigin: "16 18" }, at + 0.36);
  },
  // Two friends turn to each other, then back.
  friends: (tl, svg, at) => {
    const [l, r] = svg.querySelectorAll("[data-turn]");
    tl.fromTo(l, { rotation: 0 }, { rotation: 10, duration: 0.35, yoyo: true, repeat: 1, repeatDelay: 0.2, ease: "power2.inOut", svgOrigin: "11 26" }, at)
      .fromTo(r, { rotation: 0 }, { rotation: -10, duration: 0.35, yoyo: true, repeat: 1, repeatDelay: 0.2, ease: "power2.inOut", svgOrigin: "21 26" }, at);
  },
  // The plane flies the dotted arc, ending where the server draws it.
  travelling: (tl, svg, at) => {
    tl.fromTo(svg.querySelector("[data-plane]"), { rotation: -120 }, { rotation: 0, duration: 0.9, ease: "power1.inOut", svgOrigin: "16 27" }, at);
  },
  // The dumbbell goes up twice.
  "working-out": (tl, svg, at) => {
    tl.fromTo(svg.querySelector("[data-lift]"), { y: 0 }, { y: -5, duration: 0.2, yoyo: true, repeat: 3, ease: "power1.inOut" }, at);
  },
};
/** A value flips like a stadium board and lands on its real text, `data-scramble`
    (a listing value, a 404's code). */
export const scramble = (el: HTMLElement) =>
  gsap.to(el, { duration: 1, ease: "none", scrambleText: { text: el.dataset.scramble ?? "", chars: "upperCase", revealDelay: 0.4, speed: 0.6 } });

const iconParts = (svg: Element) => [...svg.querySelectorAll("[data-draw], [data-dots], [data-stick], [data-ring], [data-turn], [data-plane], [data-lift]")];

function playIcon(svg: Element): gsap.core.Timeline {
  gsap.killTweensOf(iconParts(svg));
  const tl = gsap.timeline();
  tl.fromTo(
    svg.querySelectorAll("[data-draw]"),
    { strokeDasharray: 1, strokeDashoffset: 1 },
    { strokeDashoffset: 0, duration: 0.6, stagger: 0.04, ease: "power1.inOut", clearProps: "strokeDasharray,strokeDashoffset" },
    0,
  );
  tl.fromTo(svg.querySelectorAll("[data-dots]"), { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.2);
  const act = ACTS[(svg as SVGElement).dataset.icon ?? ""];
  if (!act) throw new Error(`pieces: no act for icon "${(svg as SVGElement).dataset.icon}"`);
  act(tl, svg, 0.65);
  return tl;
}

export const INNER: [selector: string, inner: Inner][] = [
  [
    "[data-icon]",
    {
      at: 0.1,
      reset: (svg) => {
        gsap.killTweensOf(iconParts(svg));
        gsap.set(svg.querySelectorAll("[data-draw]"), { strokeDasharray: 1, strokeDashoffset: 1 });
        gsap.set(svg.querySelectorAll("[data-dots]"), { opacity: 0 });
      },
      play: playIcon,
      clear: (svg) => {
        const parts = iconParts(svg);
        gsap.killTweensOf(parts);
        gsap.set(parts, { clearProps: "strokeDasharray,strokeDashoffset,opacity,transform" });
      },
    },
  ],
  [
    // A value flips like a stadium board. The value is aria-hidden;
    // the real one sits beside it.
    "[data-scramble]",
    {
      at: 0.1,
      reset: (el) => {
        gsap.killTweensOf(el);
        el.textContent = el.dataset.scramble ?? "";
      },
      play: scramble,
      clear: (el) => {
        gsap.killTweensOf(el);
        el.textContent = el.dataset.scramble ?? "";
      },
    },
  ],
  [
    // A ":(" tips 90 degrees into a face (its CSS rest state).
    "[data-tip]",
    {
      at: 0.5,
      reset: (el) => gsap.set(el, { rotation: 0 }),
      play: (el) => gsap.fromTo(el, { rotation: 0 }, { rotation: 90, duration: 0.5, ease: "back.out(2)" }),
      clear: (el) => {
        gsap.killTweensOf(el);
        gsap.set(el, { clearProps: "transform" });
      },
    },
  ],
  [
    // A word ("impatiently") fidgets, once.
    "[data-fidget]",
    {
      at: 0.6,
      reset: (el) => gsap.set(el, { x: 0 }),
      play: (el) => gsap.fromTo(el, { x: 0 }, { keyframes: { x: [0, -2, 2, -2, 2, -1, 0] }, duration: 0.5, ease: "none" }),
      clear: (el) => {
        gsap.killTweensOf(el);
        gsap.set(el, { clearProps: "transform" });
      },
    },
  ],
];

/**
 * The pieces that answer the pointer, the focus and the scroll rather than a
 * row arriving: a [data-wave] word waves again on hover, a [data-life] row's
 * icon replays on hover and focus, and a ticker moves by the distance scrolled. Returns
 * the cleanup.
 */
export function setPieces(root: HTMLElement): () => void {
  const off: (() => void)[] = [];
  const on = (el: EventTarget, type: string, fn: () => void, opts?: AddEventListenerOptions) => {
    el.addEventListener(type, fn, opts);
    off.push(() => el.removeEventListener(type, fn, opts));
  };

  // The first wave is CSS; the replay is added on top of it, so a
  // finished CSS animation cannot hold the letters still.
  for (const word of root.querySelectorAll<HTMLElement>("[data-wave]")) {
    const letters = [...word.children] as HTMLElement[];
    const replays: Animation[] = [];
    on(word, "pointerenter", () => {
      replays.splice(0).forEach((a) => a.cancel());
      letters.forEach((l, i) =>
        replays.push(
          l.animate([{ transform: "none" }, { transform: "translateY(-0.28em)", offset: 0.4 }, { transform: "none" }], {
            duration: 500,
            delay: i * 45,
            easing: "ease-in-out",
          }),
        ),
      );
    });
    off.push(() => replays.forEach((a) => a.cancel()));
  }

  for (const row of root.querySelectorAll<HTMLElement>("[data-life]")) {
    const svg = row.querySelector("[data-icon]");
    if (!svg) throw new Error("pieces: a [data-life] row without its icon");
    const replay = () => void playIcon(svg);
    on(row, "pointerenter", replay);
    on(row, "focusin", replay);
  }

  // The board moves only while the page scrolls, by the distance scrolled and in
  // its direction, wrapped by one copy of the line so it never runs out.
  for (const track of root.querySelectorAll<HTMLElement>("[data-ticker-track]")) {
    const copy = track.firstElementChild as HTMLElement | null;
    if (!copy) throw new Error("pieces: an empty [data-ticker-track]");
    let wrap = gsap.utils.wrap(-copy.offsetWidth, 0);
    const move = () => gsap.set(track, { x: wrap(-window.scrollY * 0.5) });
    const measure = () => {
      wrap = gsap.utils.wrap(-copy.offsetWidth, 0);
      move();
    };
    move();
    on(window, "scroll", move, { passive: true });
    on(window, "resize", measure);
    off.push(() => gsap.set(track, { clearProps: "transform" }));
  }

  return () => off.forEach((f) => f());
}
