// Visual check: spawn an explosion billboard directly and screenshot mid-burn.
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--window-size=1280,800", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:5173/?autostart=vega", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 2500)); // let atlas texture load

await page.evaluate(() => {
  window.__fx.spawn({ x: -4, y: 2, z: -25 }, 8);
  window.__fx.spawn({ x: 5, y: -1, z: -35 }, 10);
});
await new Promise((r) => setTimeout(r, 250)); // ~frame 5, peak fireball
await page.screenshot({ path: "shot-fx.png" });
console.log("errors:", errors.length ? errors : "none");
await browser.close();
