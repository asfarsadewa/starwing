// Final round: Macross gerwalk pose for all three ships + gunpod fire.
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

for (const pilot of ["vega", "hex", "anvil"]) {
  await page.goto(`http://localhost:5173/?autostart=${pilot}`, { waitUntil: "networkidle2" });
  await sleep(1500);
  await tap("KeyF");
  await sleep(1300); // staged transform completes
  await page.screenshot({ path: `shot-gw-${pilot}.png` }); // clean pose, no fire
}

console.log("errors:", errors.length ? errors : "none");
await browser.close();
