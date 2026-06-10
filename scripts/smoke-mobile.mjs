// Round 6: mobile emulation (tap flow, touch UI, rotate overlay) and
// audio-blocked hint behavior under real autoplay policy.
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// NOTE: no --autoplay-policy flag here — we WANT the real policy so the
// audio hint path is exercised.
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--window-size=900,500"],
});

const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
await page.emulate({
  viewport: { width: 844, height: 390, isMobile: true, hasTouch: true },
  userAgent: UA_MOBILE,
});

await page.goto("http://localhost:5173/", { waitUntil: "networkidle2" });
await sleep(1500);

const state0 = await page.evaluate(() => ({
  rotateShown: getComputedStyle(document.getElementById("rotate-overlay")).display,
  startPrompt: document.getElementById("start-prompt").textContent.trim(),
  audioHintVisible: !document.getElementById("audio-hint").classList.contains("hidden"),
  bgm: window.__bgm(),
}));

// tap through: title -> select -> pick Hex -> tap again -> launch
await page.touchscreen.tap(422, 195); // title screen anywhere
await sleep(700);
const selectVisible = await page.evaluate(
  () => !document.getElementById("select-screen").classList.contains("hidden"));

const hexCard = await page.evaluate(() => {
  const r = document.querySelectorAll(".pilot-card")[1].getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.touchscreen.tap(hexCard.x, hexCard.y);
await sleep(400);
const picked = await page.evaluate(() =>
  [...document.querySelectorAll(".pilot-card")].findIndex((c) => c.classList.contains("selected")));
await page.touchscreen.tap(hexCard.x, hexCard.y); // second tap launches
await sleep(1500);

const inGame = await page.evaluate(() => ({
  hudVisible: !document.getElementById("hud").classList.contains("hidden"),
  touchUiVisible: !document.getElementById("touch-ui").classList.contains("hidden"),
  audioHintVisible: !document.getElementById("audio-hint").classList.contains("hidden"),
  bgm: window.__bgm(),
}));

// hold FIRE touch button for a moment
const fireBtn = await page.evaluate(() => {
  const r = document.getElementById("tb-fire").getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.touchscreen.touchStart(fireBtn.x, fireBtn.y);
await sleep(600);
await page.screenshot({ path: "shot-mobile.png" });
await page.touchscreen.touchEnd();
const score = await page.evaluate(() => document.getElementById("score").textContent);

// portrait: rotate overlay must appear
await page.emulate({
  viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  userAgent: UA_MOBILE,
});
await sleep(600);
const rotatePortrait = await page.evaluate(
  () => getComputedStyle(document.getElementById("rotate-overlay")).display);
await page.screenshot({ path: "shot-portrait.png" });

console.log(JSON.stringify(
  { state0, selectVisible, picked, inGame, score, rotatePortrait, errors }, null, 2));
await browser.close();
