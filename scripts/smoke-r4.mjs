// Round 4 visual check: new enemies in the field, boss v2, BGM state on select.
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

const tap = async (key) => {
  await page.keyboard.down(key);
  await sleep(120);
  await page.keyboard.up(key);
};

// --- 1) BGM on select screen ---
await page.goto("http://localhost:5173/", { waitUntil: "networkidle2" });
await sleep(800);
await tap("Enter"); // title -> select, unlocks audio
await sleep(1500);
const bgm = await page.evaluate(() => ({
  selectVisible: !document.getElementById("select-screen").classList.contains("hidden"),
  ...window.__bgm(),
}));

// --- 2) field enemies (talons ~immediately, mantis after 25s) ---
await page.goto("http://localhost:5173/?autostart=vega", { waitUntil: "networkidle2" });
await sleep(9000);
await page.screenshot({ path: "shot-talons.png" });
await sleep(22000);
await page.screenshot({ path: "shot-mantis.png" });

// --- 3) boss v2 (forced early) ---
await page.goto("http://localhost:5173/?autostart=hex&boss", { waitUntil: "networkidle2" });
await sleep(15000); // warning + entrance
await page.screenshot({ path: "shot-boss2.png" });

console.log(JSON.stringify({ bgm, errors }, null, 2));
await browser.close();
