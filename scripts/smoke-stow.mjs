// Fighter-mode stowage check: clean jet silhouette vs deployed gerwalk, per ship.
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

for (const pilot of ["hex", "vega"]) {
  await page.goto(`http://localhost:5173/?autostart=${pilot}`, { waitUntil: "networkidle2" });
  await sleep(2000);
  await page.screenshot({ path: `shot-jet-${pilot}.png` }); // fighter: legs must be hidden
  await tap("KeyF");
  await sleep(1300);
  await page.screenshot({ path: `shot-gw-${pilot}.png` });  // gerwalk: full stance
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
