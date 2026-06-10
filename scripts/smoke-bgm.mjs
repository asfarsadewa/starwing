// Probe level BGM state during gameplay.
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
page.on("response", (res) => {
  if (res.url().includes("bgm")) {
    console.log("fetch:", res.status(), res.url(), res.headers()["content-type"] ?? "");
  }
});

const tap = async (key) => {
  await page.keyboard.down(key);
  await sleep(120);
  await page.keyboard.up(key);
};

await page.goto("http://localhost:5173/", { waitUntil: "networkidle2" });
await sleep(800);
await tap("Enter"); // -> select (unlock)
await sleep(1200);
console.log("select:", JSON.stringify(await page.evaluate(() => window.__bgm())));
await tap("Enter"); // -> game
await sleep(4000);
console.log("game t+4s:", JSON.stringify(await page.evaluate(() => window.__bgm())));
await sleep(6000);
console.log("game t+10s:", JSON.stringify(await page.evaluate(() => window.__bgm())));

// also try decoding both files through WebAudio to test the codec itself
const decode = await page.evaluate(async () => {
  const out = {};
  for (const f of ["title-bgm", "level-bgm"]) {
    try {
      const buf = await fetch(`/audio/${f}.mp3`).then((r) => r.arrayBuffer());
      const ctx = new OfflineAudioContext(2, 44100, 44100);
      const decoded = await ctx.decodeAudioData(buf.slice(0));
      out[f] = { ok: true, seconds: decoded.duration, bytes: buf.byteLength };
    } catch (e) {
      out[f] = { ok: false, err: String(e) };
    }
  }
  return out;
});
console.log("decode:", JSON.stringify(decode, null, 2));

await browser.close();
