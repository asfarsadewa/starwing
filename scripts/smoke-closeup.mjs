// Close-range look at the new enemy models just before they reach the player.
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
await page.goto("http://localhost:5173/?autostart=anvil", { waitUntil: "networkidle2" });
await sleep(2000);
await page.evaluate(() => {
  window.__spawn("drone");
  window.__spawn("drone");
  window.__spawn("mantis");
});
// anvil base speed 46 u/s, spawn z=-320: at ~6.2s they're ~z=-35 (close + big)
await sleep(6200);
await page.screenshot({ path: "shot-closeup.png" });
await browser.close();
console.log("done");
