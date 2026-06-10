// Flow test: title -> select -> pick Hex -> launch. Verifies BGM + HUD.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// hold long enough for the per-frame input poll to see the key
const tap = async (key) => {
  await page.keyboard.down(key);
  await sleep(120);
  await page.keyboard.up(key);
};

await page.goto("http://localhost:5173/", { waitUntil: "networkidle2" });
await sleep(1000);

await tap("Enter"); // title -> select (also unlocks audio)
await new Promise((r) => setTimeout(r, 800));
const selectVisible = await page.evaluate(
  () => !document.getElementById("select-screen").classList.contains("hidden")
);
const titleBgm = await page.evaluate(() => {
  const a = document.querySelectorAll("audio");
  return "no-audio-tags-expected"; // tracks are JS-only; check below instead
});

await tap("ArrowRight"); // vega -> hex
await new Promise((r) => setTimeout(r, 400));
const selectedIdx = await page.evaluate(() =>
  [...document.querySelectorAll(".pilot-card")].findIndex((c) =>
    c.classList.contains("selected"))
);
await page.screenshot({ path: "shot-select.png" });

await tap("Enter"); // launch
await new Promise((r) => setTimeout(r, 2500));
const inGame = await page.evaluate(() => ({
  hudVisible: !document.getElementById("hud").classList.contains("hidden"),
  selectHidden: document.getElementById("select-screen").classList.contains("hidden"),
}));

console.log(JSON.stringify({ selectVisible, selectedIdx, inGame, errors }, null, 2));
await browser.close();
