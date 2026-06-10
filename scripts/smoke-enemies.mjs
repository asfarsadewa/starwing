// Deterministic enemy/boss visual check using the __spawn breadcrumb.
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
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

// spawn a wave of talons + mantises, wait until mid-field, capture
await page.goto("http://localhost:5173/?autostart=anvil", { waitUntil: "networkidle2" });
await sleep(2000);
await page.evaluate(() => {
  for (let i = 0; i < 4; i++) window.__spawn("drone");
  window.__spawn("mantis");
  window.__spawn("mantis");
});
await sleep(4800); // ~z -70, nice and close
await page.keyboard.down("Space"); // show off the orb weapon too
await sleep(400);
await page.screenshot({ path: "shot-enemies.png" });
await page.keyboard.up("Space");

// boss v2 clean look (plasma no longer streaks the camera)
await page.goto("http://localhost:5173/?autostart=hex&boss", { waitUntil: "networkidle2" });
await sleep(14000);
await page.screenshot({ path: "shot-boss2.png" });
await sleep(4000);
await page.screenshot({ path: "shot-boss2b.png" });

console.log("errors:", errors.length ? errors : "none");
await browser.close();
