// All-routes motion audit (Playwright). Proven 2026-10-01 against a Next.js production build.
// Adapt: ROUTES (every route, a detail page per kind, one 404), the intro-skip init script, TARGETS,
// .scroll-progress. It samples the page width every 50 ms from the first script on (a piece that
// widens the page only while it runs is missed by a check that reads once per position), Tabs the
// whole page from a fresh load (focus on screen, opaque, a painted ring of 2 px or more), checks
// reduced motion is still and complete, and times long tasks during a fast wheel scroll.
// Usage: node audit.mjs [base]. ONLY=routes,reduced,longtasks,shots runs a part. Every line ends as ok,
// FAIL or N/A (not measurable). N/A is never a pass.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:4817";
const fails = [];
const nm = [];
const ok = (cond, msg) => (cond ? console.log("  ok  ", msg) : (fails.push(msg), console.log("  FAIL", msg)));
const na = (msg) => (nm.push(msg), console.log("  N/A ", msg));
const only = (name) => !process.env.ONLY || process.env.ONLY.split(",").includes(name);

const ROUTES = process.env.ROUTES?.split(",") ?? ["/", "/about", "/contact", "/no-such-page"];
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1280, height: 1300 },
  { width: 400, height: 800 },
].filter((v) => !process.env.VP || process.env.VP.split(",").includes(`${v.width}x${v.height}`)); // VP=400x800 runs one size
const TARGETS = "[data-reveal], [data-reveal-item], [data-reveal-title], [data-reveal-rule]";
const SHOTS = new URL("./shots/", import.meta.url);
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();

async function open(path, viewport, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // SLOW_FONTS=1: the web fonts arrive 2 s late, as on a slow connection. The
  // fallback font is wider, so a word that fits can stick out until they land.
  if (process.env.SLOW_FONTS) await page.route(/\.woff2$/, async (r) => (await new Promise((f) => setTimeout(f, 2000)), r.continue()));
  await page.addInitScript(() => {
    sessionStorage.setItem("intro:skip", "x"); // the key the site's intro reads to skip; delete if none
    // Widest the page ever gets, sampled every 50 ms from the first script on,
    // so a piece that widens the page only while it runs is caught.
    window.__over = { max: 0, at: "" };
    setInterval(() => {
      const d = document.documentElement;
      if (!d) return;
      const o = d.scrollWidth - innerWidth;
      if (o > window.__over.max) window.__over = { max: o, at: `scrollY ${Math.round(scrollY)}` };
    }, 50);
  });
  // Load, then idle within 15 s. If idle never comes, name the requests still
  // open rather than crash: twice a run died here while another browser run
  // shared the machine, and 12 lone loads went idle in under a second.
  const open = new Map();
  page.on("request", (r) => open.set(r, Date.now()));
  page.on("requestfinished", (r) => open.delete(r));
  page.on("requestfailed", (r) => open.delete(r));
  const res = await page.goto(base + path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() =>
    na(`${path}: never network-idle; still open: ${[...open].map(([r, t]) => `${r.url().replace(base, "")} ${Date.now() - t} ms`).join(", ")}`),
  );
  await page.waitForTimeout(1200); // the lazy GSAP chunks register after hydration
  return { ctx, page, errors, status: res?.status() };
}

const state = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector(".scroll-progress");
    const cs = bar ? getComputedStyle(bar) : null;
    return {
      max: document.documentElement.scrollHeight - innerHeight,
      over: window.__over,
      banner: document.querySelector("[role=alert]")?.textContent?.trim() ?? "",
      bar: cs ? { display: cs.display, a: new DOMMatrix(cs.transform === "none" ? undefined : cs.transform).a } : null,
      hiddenVis: [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).visibility === "hidden" && e.closest("main")).length,
    };
  });

// Walks down in half-screen steps and back up, 450 ms per step, so the 50 ms
// sampler sees every reveal and set piece mid-flight in both directions.
async function walk(page) {
  const { max } = await state(page);
  const vh = page.viewportSize().height;
  for (let y = 0; y <= max + vh / 2; y += vh / 2) {
    await page.evaluate((y) => scrollTo(0, y), Math.min(y, max));
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);
  for (let y = max; y >= -vh / 2; y -= vh / 2) {
    await page.evaluate((y) => scrollTo(0, y), Math.max(y, 0));
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);
}

// Tab from a fresh load to the end of the page (or 150 presses). Each focus
// must be on screen, fully opaque and wearing a painted ring of 2 px or more.
async function tabThrough(page) {
  const bad = [];
  const seen = new Set();
  let count = 0;
  let wrapped = false;
  for (let i = 0; i < 250; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(450); // the focus reveal is 0.2 s, the squad cards' fade 0.2 s
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      let op = 1;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      const cs = getComputedStyle(el);
      // A real identity per element: two identical cards in one row must not look like a wrap.
      const key = (el.__tabId ??= window.__tabN = (window.__tabN ?? 0) + 1);
      return {
        key,
        what: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40),
        onScreen: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
        op,
        ring: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2,
      };
    });
    if (!f) continue;
    if (seen.has(f.key)) {
      wrapped = true;
      break;
    }
    seen.add(f.key);
    count++;
    if (!f.onScreen || f.op < 0.99 || !f.ring) bad.push(`${f.what} (on screen ${f.onScreen}, opacity ${f.op.toFixed(2)}, ring ${f.ring})`);
  }
  return { count, wrapped, bad };
}

if (only("routes")) {
  for (const v of VIEWPORTS) {
    for (const path of ROUTES) {
      const name = `${path} ${v.width}x${v.height}`;
      console.log(name);
      const is404 = path === "/no-such-page";
      // Keyboard first, on a fresh load, so the sequential focus start is the top.
      if (!process.env.SKIP_TAB) {
        const { ctx, page, errors, status } = await open(path, v);
        ok(is404 ? status === 404 : status === 200, `${name}: status ${status}`);
        // Everything a keyboard user should reach: focusable and rendered.
        const want = await page.evaluate(() => [...document.querySelectorAll("a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex=\"-1\"])")].filter((e) => e.checkVisibility() && !e.closest("[inert]")).length);
        const t = await tabThrough(page);
        if (t.count === 0 || !t.wrapped) na(`${name}: Tab reached ${t.count} elements and never came back to the first`);
        else ok(t.bad.length === 0 && t.count === want, `${name}: Tab reaches ${t.count} of ${want} focusable elements and wraps, each on screen, opaque, ringed ${t.bad.join(" | ")}`);
        ok(errors.length === 0, `${name}: no page errors while tabbing ${errors.join(" | ")}`);
        await ctx.close();
      }
      if (!process.env.SKIP_WALK) {
        const { ctx, page, errors } = await open(path, v);
        const s0 = await state(page);
        if (!s0.bar) na(`${name}: no progress line`);
        else ok(s0.bar.display === "none" || Math.abs(s0.bar.a) < 0.01, `${name}: progress line empty at the top (scaleX ${s0.bar.a.toFixed(3)}, page scrolls ${s0.max} px)`);
        await walk(page);
        const s = await state(page);
        ok(s.over.max <= 0.5, `${name}: never wider than the screen through load and a walk down and up (max ${s.over.max.toFixed(1)} px ${s.over.at})`);
        ok(s.hiddenVis === 0, `${name}: nothing in main is visibility: hidden (${s.hiddenVis})`);
        ok(s.banner === "", `${name}: error banner empty ${s.banner}`);
        ok(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
        if (only("shots")) {
          await page.evaluate((y) => scrollTo(0, y), Math.round(s.max * 0.4));
          await page.waitForTimeout(1600);
          const file = `${path === "/" ? "home" : path.slice(1).replace(/\//g, "-")}-${v.width}x${v.height}.png`;
          await page.screenshot({ path: fileURLToPath(new URL(file, SHOTS)) });
        }
        await ctx.close();
      }
    }
  }
}

if (only("reduced")) {
  for (const v of VIEWPORTS.filter((v) => v.height === 800)) {
    for (const path of ROUTES) {
      const name = `reduced ${path} ${v.width}x${v.height}`;
      const { ctx, page, errors } = await open(path, v, { reduced: true });
      const check = () =>
        page.evaluate((sel) => {
          const running = document
            .getAnimations()
            .filter((a) => a.playState === "running" && (a.effect?.getComputedTiming().duration ?? 0) > 0)
            .map((a) => (a.animationName || a.constructor.name) + ":" + (a.effect?.target?.className?.toString?.().slice(0, 30) ?? ""));
          const waiting = [...document.querySelectorAll(sel)].filter((el) => {
            const cs = getComputedStyle(el);
            const m = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform);
            return Number(cs.opacity) < 0.99 || Math.abs(m.f) > 0.5 || Math.abs(m.a - 1) > 0.01;
          }).length;
          const bar = document.querySelector(".scroll-progress");
          return { running, waiting, targets: document.querySelectorAll(sel).length, bar: bar ? getComputedStyle(bar).display : "none" };
        }, TARGETS);
      const a = await check();
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(800);
      const b = await check();
      ok(a.running.length === 0 && b.running.length === 0, `${name}: nothing animating at load or after a scroll ${[...a.running, ...b.running].join(" ")}`);
      ok(a.waiting === 0 && b.waiting === 0, `${name}: all ${a.targets} reveal targets complete (${a.waiting}, ${b.waiting} not)`);
      ok(a.bar === "none", `${name}: no progress line`);
      ok(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
      await ctx.close();
    }
  }
}

// Long tasks while the page is flung down and back up by the wheel (Lenis
// smooths it, as for a visitor), with the load's own tasks left out.
if (only("longtasks")) {
  // Each 800 px tall size at full speed; the phone width at 4x CPU too.
  for (const [v, rate] of VIEWPORTS.filter((v) => v.height === 800).flatMap((v) => (v.width < 600 ? [[v, 1], [v, 4]] : [[v, 1]]))) {
    const name = `long tasks, fast scroll, Home ${v.width}x${v.height}, CPU ${rate}x`;
    const { ctx, page, errors } = await open("/", v);
    await page.evaluate(() => {
      window.__lt = [];
      new PerformanceObserver((l) => window.__lt.push(...l.getEntries().map((e) => ({ t: e.startTime, d: e.duration })))).observe({ type: "longtask", buffered: true });
    });
    await page.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const t0 = await page.evaluate(() => performance.now());
    await page.mouse.move(v.width / 2, v.height / 2);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const steps = Math.ceil(max / 300) + 4;
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(1500);
    const bottom = await page.evaluate(() => scrollY);
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(1500);
    const t1 = await page.evaluate(() => performance.now());
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const lt = (await page.evaluate(() => window.__lt)).filter((e) => e.t >= t0 && e.t <= t1);
    if (bottom < max * 0.9) na(`${name}: the wheel reached only ${Math.round(bottom)} of ${max} px`);
    const worst = lt.reduce((m, e) => Math.max(m, e.d), 0);
    const total = lt.reduce((s, e) => s + e.d, 0);
    console.log(`  ..   ${name}: ${lt.length} long tasks, longest ${worst.toFixed(0)} ms, total ${total.toFixed(0)} ms over ${((t1 - t0) / 1000).toFixed(1)} s`);
    ok(worst <= 100, `${name}: no long task over 100 ms during the scroll (longest ${worst.toFixed(0)} ms)`);
    ok(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
    await ctx.close();
  }
}

await browser.close();
console.log(`\n${fails.length} failed, ${nm.length} not measurable`);
if (fails.length || nm.length) process.exitCode = 1;
