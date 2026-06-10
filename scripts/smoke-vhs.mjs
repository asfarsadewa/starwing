// VHS retro mode: before/after capture + toggle + persistence check.
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

await page.goto("http://localhost:5173/?autostart=vega", { waitUntil: "networkidle2" });
await page.evaluate(() => localStorage.setItem("starwing-retro", "0"));
await sleep(4500);
await page.screenshot({ path: "shot-clean.png" });

await tap("KeyV"); // VHS on
await sleep(1200);
await page.screenshot({ path: "shot-vhs.png" });
await sleep(700);
await page.screenshot({ path: "shot-vhs2.png" }); // different glitch frame

const state = await page.evaluate(() => ({
  retroBody: document.body.classList.contains("retro"),
  retroBadge: !document.getElementById("retro-status").classList.contains("hidden"),
  persisted: localStorage.getItem("starwing-retro"),
}));
await tap("KeyV"); // off again
await sleep(400);
const off = await page.evaluate(() => ({
  retroBody: document.body.classList.contains("retro"),
  persisted: localStorage.getItem("starwing-retro"),
}));

console.log(JSON.stringify({ state, off, errors }, null, 2));
await browser.close();
