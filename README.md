# /add-animations

A Claude Code skill that gives a **whole website** a motion pass, and proves in a real browser that it didn't break anything.

Most "add animations" prompts give you everything fading up, once, going down. This skill reads your site and its **copy** first, ties each set piece to a line the page already says, makes reveals replay **in both scroll directions**, and checks accessibility, reduced motion and performance before calling it done.

## What you get

- **Reveals that work both ways:** rows rise in going down and drop in from above coming back up. They reset only once fully off screen, so nothing vanishes while someone is looking at it.
- **A scroll layer in native CSS** (scroll-driven animations, off the main thread): a progress line, parallax, an element that turns away as it leaves, media that scales in.
- **Set pieces tied to your words:** typing, slams, scramble or split-flap boards, self-drawing icons, a ball rolling down a timeline, a scroll-velocity ticker, a card flip.
- **Page transitions** with View Transitions (React `<ViewTransition>` in Next.js, `document.startViewTransition` elsewhere), plus feedback on every control.
- **A catalog of 40 animation styles** (`references/catalog.md`), each with when to use it, when to skip it, how to build it and its reduced-motion path.
- **Two Playwright checks:** a walk down and back up the main page, and an audit of every route at three viewport sizes. Together they cover page width sampled through the motion, the Tab order and focus rings, reduced motion, and long tasks during a fast scroll.

## The stance

- Motion follows the visitor. Nothing moves on its own for more than 5 seconds without a pause control (WCAG 2.2.2).
- Motion says something the words already say.
- The server renders the finished page. Visitors without JavaScript or with reduced motion, crawlers and printers all get the complete page.
- The cheapest tool that works: CSS, then native APIs, then GSAP.

## Install

**Claude Code plugin:**

```
/plugin marketplace add mrrobotbuilder/add-animations
/plugin install add-animations@add-animations
```

**skills CLI:**

```
npx skills add mrrobotbuilder/add-animations
```

**By hand:** copy `skills/add-animations/` to `~/.claude/skills/add-animations/`.

## Use

Open Claude Code in your site's repo and say "add animations", "animate my site" or "scroll animations both ways", or run `/add-animations` (`/add-animations:add-animations` when installed as a plugin). It reads the site, asks up to four questions that change the build, then builds in layers. On a big site it splits the work into one session per layer.

**Best fit:** a Next.js / React site. The recipes and checks were built on Next.js 16, React 19.2 and GSAP 3.15. The catalog, the stance and the hard rules apply to any stack.

**The checks need** Playwright (`npm i -D playwright`) and a production build of your site. The templates are starting points: adapt the selectors, the routes and the intro-skip key named in their header comments.

## Credits

The style catalog builds on SVGator's list of 31 website animation styles: [svgator.com/blog/website-animation-examples-and-effects](https://www.svgator.com/blog/website-animation-examples-and-effects). The when-to-use and when-to-skip guidance, the recipes and the checks come from a real four-stage build of a portfolio site, and every hard rule in `SKILL.md` cost a real bug.

## License

MIT
