// Real-time smoke test: drives the game in headless Chrome, captures console
// errors, 404 URLs, and verifies the boss can be damaged while chasing it.
// Usage: node scripts/smoke.mjs
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = "http://localhost:5173";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--window-size=1280,800", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1280, height: 800 },
});

const page = await browser.newPage();
const errors = [];
const notFound = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(String(err)));
page.on("response", (res) => {
  if (res.status() === 404) notFound.push(res.url());
});

await page.goto(`${BASE}/?autostart=anvil&boss`, { waitUntil: "networkidle2" });

// boss arrives ~6s in (warning 3.2s + entrance); wait until in position
await new Promise((r) => setTimeout(r, 14000));

// chase the boss horizontally while holding fire for 12s:
// mirror its weave by tapping left/right based on its screen-x via reticle math
await page.keyboard.down("Space");
const chase = setInterval(async () => {
  try {
    const dir = await page.evaluate(() => window.__bossDir ?? 0);
    await page.keyboard.up("ArrowLeft");
    await page.keyboard.up("ArrowRight");
    if (dir < -0.5) await page.keyboard.down("ArrowLeft");
    if (dir > 0.5) await page.keyboard.down("ArrowRight");
  } catch {}
}, 120);

await new Promise((r) => setTimeout(r, 12000));
clearInterval(chase);
await page.keyboard.up("Space");
await page.screenshot({ path: "shot-boss-fire.png" });

const hudState = await page.evaluate(() => ({
  bossBarVisible: !document.getElementById("boss-hud").classList.contains("hidden"),
  bossFillWidth: document.getElementById("boss-fill").style.width,
  score: document.getElementById("score").textContent,
  shield: document.getElementById("shield-fill").style.width,
  zone: document.getElementById("zone-label").textContent,
  warningHidden: document.getElementById("boss-warning").classList.contains("hidden"),
}));

console.log("HUD:", JSON.stringify(hudState, null, 2));
console.log("404s:", notFound.length ? notFound : "none");
console.log("Console errors:", errors.length ? errors.filter(e => !e.includes("404")) : "none");

await browser.close();
