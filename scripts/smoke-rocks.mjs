// Asteroid visibility check using the __spawn breadcrumb: a far-field pass
// (do rocks read at distance?) and a close pass (texture/rim detail).
import puppeteer from "puppeteer-core";

const CHROME =
  process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--window-size=1280,800", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:5173/?autostart=anvil", { waitUntil: "networkidle2" });
await sleep(2000);
await page.evaluate(() => {
  for (let i = 0; i < 8; i++) window.__spawn("rock");
});
await sleep(2400); // ~z -180: rocks should already read against the nebula
await page.screenshot({ path: "shot-rocks-far.png" });
await sleep(2600); // ~z -70: facets, tint variety, rim glow
await page.screenshot({ path: "shot-rocks-near.png" });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
