// Round 5: gerwalk transform pose, refined weapon VFX, busier opening.
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

// busier opening: V wing should be visible within ~5s
await sleep(5200);
await page.keyboard.down("Space");
await sleep(500);
await page.screenshot({ path: "shot-opening.png" }); // weapon VFX + early wave
await page.keyboard.up("Space");

// transform to gerwalk and hold fire — pose + foot jets + tighter fov
await tap("KeyF");
await sleep(900); // transform completes
const mode = await page.evaluate(() => document.getElementById("mode-label").textContent);
await page.keyboard.down("Space");
await sleep(400);
await page.screenshot({ path: "shot-gerwalk.png" });
await page.keyboard.up("Space");

// transform back
await tap("KeyF");
await sleep(900);
const mode2 = await page.evaluate(() => document.getElementById("mode-label").textContent);

console.log(JSON.stringify({ mode, mode2, errors }, null, 2));
await browser.close();
