// Both-directions motion check (Playwright). Proven 2026-09-30 to 2026-10-01 against a Next.js production build.
// Adapt before use: the intro-skip init script (sessionStorage key), the TARGETS selector,
// [data-slot]/[data-pitch] (a dealt group; delete if none), .scroll-progress/[data-starfield]/
// [data-hero-card] (the scroll layer), #contact .btn-cta (the button Tab must reach before the
// footer), .btn-cta (one filled CTA per viewport), and the routes list at the bottom.
// A case the page geometry rules out for every visitor prints "--": neither a pass nor a fail.
// Then prove it can fail: run it once against the old engine and watch it go red.
// Usage: node check.mjs [base]   ROUTES=/about,/contact sets the extra pages   (default http://localhost:4731)
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:4731";
const fails = [];
const ok = (cond, msg) => (cond ? console.log("  ok  ", msg) : (fails.push(msg), console.log("  FAIL", msg)));
const only = (name) => !process.env.ONLY || process.env.ONLY.split(",").includes(name);
const TARGETS = "[data-reveal], [data-reveal-item], [data-reveal-title], [data-reveal-rule]";

const browser = await chromium.launch();

async function open(path, viewport, { reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Skips the site's intro, if it has one: set the key it reads, or delete this line.
  await page.addInitScript(() => sessionStorage.setItem("intro:skip", "x"));
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200); // the lazy GSAP chunks register after hydration
  return { ctx, page, errors };
}

// Every reveal target and pitch card, with its box net of its own translateY.
const sample = (page) =>
  page.evaluate((sel) => {
    const vh = innerHeight;
    const one = (el) => {
      const cs = getComputedStyle(el);
      const m = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform);
      const r = el.getBoundingClientRect();
      const clip = el.style.clipPath;
      const op = Number(cs.opacity);
      const hidden = op < 0.01 || Math.abs(m.a) < 0.01 || clip.includes("100%");
      const shown = op > 0.99 && Math.abs(m.a) > 0.99 && Math.abs(m.f) < 0.5 && (clip === "" || !/[1-9]/.test(clip));
      return { top: r.top - m.f, bottom: r.bottom - m.f, op, y: m.f, vis: cs.visibility, hidden, shown };
    };
    const slots = [...document.querySelectorAll("[data-slot]")].map(one);
    const pitch = document.querySelector("[data-pitch]")?.getBoundingClientRect();
    return {
      vh,
      y: scrollY,
      max: document.documentElement.scrollHeight - vh,
      targets: [...document.querySelectorAll(sel)].map(one),
      slots,
      pitch: pitch ? { top: pitch.top, bottom: pitch.bottom } : null,
      ctas: [...document.querySelectorAll(".btn-cta")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.bottom > 0 && r.top < vh; }).length,
      overflow: document.documentElement.scrollWidth - innerWidth,
      banner: document.querySelector("[role=alert]")?.textContent?.trim() ?? "",
    };
  }, TARGETS);

const scrollTo = (page, y, ms) => page.evaluate(async ([y, ms]) => { scrollTo(0, y); await new Promise((r) => setTimeout(r, ms)); }, [y, ms]);

// Waits until no target and no pitch card is between waiting and shown (at least
// 300 ms, at most 3 s: the longest reveal is a 1.1 s rule plus a 0.4 s stagger).
// Returns whether it settled; the invariants then say what is wrong if it did not.
const settle = (page) =>
  page.evaluate(async (sel) => {
    const moving = (el) => {
      const cs = getComputedStyle(el);
      const m = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform);
      const op = Number(cs.opacity);
      const clip = el.style.clipPath;
      const hidden = op < 0.01 || Math.abs(m.a) < 0.01 || clip.includes("100%");
      const shown = op > 0.99 && Math.abs(m.a) > 0.99 && Math.abs(m.f) < 0.5 && (clip === "" || !/[1-9]/.test(clip));
      return !hidden && !shown;
    };
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 300));
    while (performance.now() - t0 < 3000) {
      // The pitch is drawn before the deal: a card still waiting while the pitch
      // is in the deal band has its deal ahead of it, so that is not settled yet.
      const p = document.querySelector("[data-pitch]")?.getBoundingClientRect();
      const inBand = p && p.top < 0.7 * innerHeight && p.bottom > 0.3 * innerHeight;
      const dealing = inBand && [...document.querySelectorAll("[data-slot]")].some((el) => Number(getComputedStyle(el).opacity) < 0.99);
      if (!dealing && ![...document.querySelectorAll(sel + ", [data-slot]")].some(moving)) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }, TARGETS);

// Walks down and back up in half-screen steps; checks the invariants at every settled step.
async function walk(label, page) {
  const first = await sample(page);
  if (!first.targets.length) return ok(false, `${label}: no reveal targets on ${page.url()}`);
  const n = first.targets.length;
  const offScreen = (t, vh) => t.bottom <= 0 || t.top >= vh;
  const inBand = (t, vh) => t.top < 0.85 * vh && t.bottom > 0.15 * vh;
  let prev = first;
  const bad = { visibility: 0, offShown: 0, bandHidden: 0, vanished: 0, cta: 0, unsettled: 0 };
  const evidence = { down: 0, up: 0, wrongWay: 0 };
  const deal = { hiddenOff: true, replayUp: false, shownInBand: true, wasAbove: false };
  let tall = null;
  const stops = [];
  for (let y = 0; y <= first.max; y += first.vh / 2) stops.push(Math.round(y));
  if (stops.at(-1) !== first.max) stops.push(first.max);
  const pass = [...stops.slice(1).map((y) => [y, "down"]), ...stops.slice(0, -1).reverse().map((y) => [y, "up"])];
  for (const [y, dir] of pass) {
    await scrollTo(page, y, 200);
    const a = await sample(page);
    a.targets.forEach((t, i) => {
      // A target that was waiting and is now on its way in shows which side it came from.
      if (!prev.targets[i].hidden || t.op < 0.01 || t.op > 0.99 || Math.abs(t.y) < 0.5) return;
      if ((dir === "down" && t.y > 0) || (dir === "up" && t.y < 0)) evidence[dir]++;
      else evidence.wrongWay++;
    });
    if (!(await settle(page))) bad.unsettled++;
    const b = await sample(page);
    b.targets.forEach((t, i) => {
      if (t.vis === "hidden") bad.visibility++;
      if (offScreen(t, b.vh) && !t.hidden) bad.offShown++;
      if (inBand(t, b.vh) && !offScreen(t, b.vh) && !t.shown) { bad.bandHidden++; if (process.env.DEBUG) console.log("    miss", dir, y, i, JSON.stringify({ top: Math.round(t.top), bottom: Math.round(t.bottom), op: t.op, y: t.y, prevHidden: prev.targets[i].hidden })); }
      if (prev.targets[i].shown && t.hidden && !offScreen(t, b.vh)) bad.vanished++;
    });
    if (b.ctas > 1) bad.cta++;
    if (b.pitch && b.slots.length) {
      const pOff = b.pitch.bottom <= 0 || b.pitch.top >= b.vh;
      if (b.pitch.bottom <= 0) deal.wasAbove = true;
      const pBand = b.pitch.top < 0.7 * b.vh && b.pitch.bottom > 0.3 * b.vh;
      if (pOff && !b.slots.every((s) => s.op < 0.01)) deal.hiddenOff = false;
      if (pBand && !b.slots.every((s) => s.op > 0.99 && s.vis !== "hidden")) deal.shownInBand = false;
      if (dir === "up" && pBand && prev.slots.every((s) => s.op < 0.01) && b.slots.every((s) => s.op > 0.99)) deal.replayUp = true;
    }
    if (y === first.max) tall = b;
    prev = b;
  }
  ok(n === prev.targets.length, `${label}: ${n} reveal targets`);
  ok(bad.unsettled === 0, `${label}: every step settled within 3 s (${bad.unsettled} did not)`);
  ok(bad.visibility === 0, `${label}: no target ever visibility: hidden (${bad.visibility})`);
  ok(bad.offShown === 0, `${label}: every off-screen target waits (${bad.offShown} misses)`);
  ok(bad.bandHidden === 0, `${label}: every target in the band is shown after settling (${bad.bandHidden} misses)`);
  ok(bad.vanished === 0, `${label}: nothing hid while on screen (${bad.vanished})`);
  // Evidence is owed only where it can exist: rows waiting below at the start
  // owe an entry from below; rows waiting above at the deepest point owe one from above.
  const need = { down: first.targets.some((t) => t.hidden), up: !!tall && tall.targets.some((t) => t.bottom <= 0 && t.hidden) };
  ok(
    evidence.wrongWay === 0 && (!need.down || evidence.down >= 1) && (!need.up || evidence.up >= 1),
    `${label}: rows enter from below going down, above coming up (${JSON.stringify({ ...evidence, need })})`,
  );
  ok(tall && tall.targets.every((t) => t.bottom <= 0 || t.top >= tall.vh || t.shown), `${label}: at full scroll every target on screen is shown (the tall-screen cap)`);
  ok(bad.cta === 0, `${label}: at most one filled CTA in any viewport`);
  ok(prev.overflow <= 0 && prev.banner === "", `${label}: no overflow, error banner empty (${prev.overflow}, "${prev.banner}")`);
  if (first.slots.length && first.pitch) {
    ok(deal.hiddenOff && deal.shownInBand, `${label}: squad cards wait off screen and are dealt in view (${JSON.stringify(deal)})`);
    // Owed only where the pitch was ever fully above the screen (a short page
    // may never scroll that far).
    if (deal.wasAbove) ok(deal.replayUp, `${label}: the deal replays coming back up`);
    else console.log(`  --   ${label}: the pitch never leaves the screen upward here, so there is no replay from above`);
  }
}

for (const [name, viewport] of [["1280x800", { width: 1280, height: 800 }], ["1280x1300", { width: 1280, height: 1300 }], ["400x800", { width: 400, height: 800 }]]) {
  if (!only("home " + name)) continue;
  console.log(`home ${name}`);
  const { ctx, page, errors } = await open("/", viewport);
  const layer = await page.evaluate(() => {
    const bar = document.querySelector(".scroll-progress");
    return { display: bar ? getComputedStyle(bar).display : "missing" };
  });
  ok(layer.display === "block", `${name}: progress line present (${layer.display})`);
  await walk(`home ${name}`, page);
  // The scroll layer at three positions: top, one screen down, the bottom.
  const at = async (y) => {
    await scrollTo(page, y, 250);
    return page.evaluate(() => {
      const bar = document.querySelector(".scroll-progress");
      const stars = document.querySelector("[data-starfield]");
      const card = document.querySelector("[data-hero-card]");
      const t = getComputedStyle(stars).translate;
      return {
        y: scrollY,
        max: document.documentElement.scrollHeight - innerHeight,
        vh: innerHeight,
        bar: new DOMMatrix(getComputedStyle(bar).transform).a,
        stars: t === "none" ? 0 : Number(t.split(" ")[1]?.replace("px", "") ?? 0),
        card: getComputedStyle(card).transform,
        cardOp: Number(getComputedStyle(card).opacity),
        cardBottom: card.getBoundingClientRect().bottom + scrollY,
      };
    });
  };
  // At rest the view timeline reports the identity matrix, not "none".
  const rest = (t) => t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)";
  const top = await at(0);
  ok(Math.abs(top.bar) < 0.01 && Math.abs(top.stars) < 1 && rest(top.card) && top.cardOp === 1, `${name}: at the top the line is empty, the stars and the card at rest (${JSON.stringify(top)})`);
  const mid = await at(Math.round(top.vh / 2));
  ok(Math.abs(mid.stars - mid.y / 2) < 2, `${name}: stars drift at half speed (${mid.stars} for ${mid.y})`);
  ok(Math.abs(mid.bar - mid.y / mid.max) < 0.02, `${name}: progress line tracks the scroll (${mid.bar.toFixed(3)} vs ${(mid.y / mid.max).toFixed(3)})`);
  const past = await at(Math.round(top.cardBottom - top.vh * 0.2));
  ok(past.card !== "none" && past.cardOp < 1, `${name}: the hero card turns away as it leaves (${past.card.slice(0, 30)}, ${past.cardOp})`);
  const end = await at(top.max);
  ok(Math.abs(end.bar - 1) < 0.01, `${name}: progress line full at the bottom (${end.bar})`);
  const back = await at(0);
  ok(rest(back.card) && back.cardOp === 1 && Math.abs(back.bar) < 0.01, `${name}: back at the top, all at rest again (${back.card}, ${back.cardOp}, ${back.bar})`);
  ok(errors.length === 0, `${name}: no page errors ${errors.join(" | ")}`);
  await ctx.close();
}

if (only("keyboard")) {
  console.log("keyboard 1280x800");
  const { ctx, page, errors } = await open("/", { width: 1280, height: 800 });
  let reached = false;
  let footerFirst = false;
  const unseen = [];
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press("Tab");
    // The quick reveal is 0.2 s; the squad cards' own CSS opacity transition adds 0.2 s.
    await page.waitForTimeout(500);
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      let op = 1;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      return {
        what: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40),
        onScreen: r.bottom > 0 && r.top < innerHeight,
        op,
        contactCta: !!el.closest("#contact") && el.classList.contains("btn-cta"),
        footer: !!el.closest("body > footer"),
      };
    });
    if (!f) continue;
    if (!f.onScreen || f.op < 0.99) unseen.push(`${f.what} (on screen ${f.onScreen}, opacity ${f.op.toFixed(2)})`);
    if (f.footer && !reached) footerFirst = true;
    reached ||= f.contactCta;
  }
  if (!reached) console.log("  (Tab never reached the key CTA within 80 presses)");
  ok(reached && !footerFirst, "Tab from the top of Home reaches the key CTA before the footer (" + (footerFirst ? "skipped it" : "in order") + ")");
  ok(unseen.length === 0, `every focused element is on screen and fully visible ${unseen.join(" | ")}`);
  ok(errors.length === 0, `keyboard: no page errors ${errors.join(" | ")}`);
  await ctx.close();
}

if (only("reduced")) {
  console.log("reduced motion 1280x800");
  const { ctx, page, errors } = await open("/", { width: 1280, height: 800 }, { reduced: true });
  const s0 = await sample(page);
  await scrollTo(page, s0.max, 600);
  const s1 = await sample(page);
  await scrollTo(page, Math.round(s0.vh * 0.6), 600);
  const s2 = await sample(page);
  const still = await page.evaluate(() => ({
    bar: getComputedStyle(document.querySelector(".scroll-progress")).display,
    stars: getComputedStyle(document.querySelector("[data-starfield]")).translate,
    card: getComputedStyle(document.querySelector("[data-hero-card]")).transform,
  }));
  ok(s0.targets.length > 0 && [s0, s1, s2].every((s) => s.targets.every((t) => t.shown)), "reduced: every target shown, at the top, the bottom and on the way back");
  ok([s0, s1, s2].every((s) => s.slots.every((x) => x.op === 1)), "reduced: squad cards in place throughout");
  ok(still.bar === "none" && still.stars === "none" && still.card === "none", `reduced: no progress line, no drift, no card turn (${JSON.stringify(still)})`);
  ok(errors.length === 0, "reduced: no page errors");
  await ctx.close();
}

for (const route of process.env.ROUTES?.split(",") ?? ["/about", "/contact"]) {
  if (!only("pages")) continue;
  console.log(`page ${route}`);
  const { ctx, page, errors } = await open(route, { width: 1280, height: 800 });
  const s = await sample(page);
  if (s.slots.length) ok(s.slots.every((x) => x.op > 0.99), `${route}: the deal ran at load (${s.slots.map((x) => x.op).join(",")})`);
  if (s.targets.length) await walk(route, page);
  else ok(s.slots.length > 0, `${route}: has reveal targets or a dealt group`);
  ok(errors.length === 0, `${route}: no page errors ${errors.join(" | ")}`);
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL PASS");
process.exitCode = fails.length ? 1 : 0;
