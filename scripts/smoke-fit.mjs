// Layout fit check: select/title/gameover screens must not cut off content
// on small viewports. Asserts no element extends past the viewport unless
// the screen itself is scrollable.
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--window-size=900,500"],
});
const page = await browser.newPage();

const VIEWPORTS = [
  { name: "iphone-land", width: 844, height: 390, isMobile: true, hasTouch: true },
  { name: "android-land", width: 740, height: 360, isMobile: true, hasTouch: true },
  { name: "small-desktop", width: 640, height: 480, isMobile: false, hasTouch: false },
];

for (const vp of VIEWPORTS) {
  await page.emulate({
    viewport: { width: vp.width, height: vp.height, isMobile: vp.isMobile, hasTouch: vp.hasTouch },
    userAgent: vp.isMobile ? UA_MOBILE : (await browser.userAgent()),
  });
  await page.goto("http://localhost:5173/?select", { waitUntil: "networkidle2" });
  await sleep(1200);

  const fit = await page.evaluate(() => {
    const screen = document.getElementById("select-screen");
    const ids = ["pilot-cards"];
    const els = [
      ...document.querySelectorAll("#select-screen .pilot-card"),
      document.querySelector("#select-screen .select-title"),
      document.querySelector("#select-screen .select-hint"),
    ];
    const vw = innerWidth, vh = innerHeight;
    const overflows = els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        el: el.className.split(" ")[0],
        cutRight: Math.max(0, Math.round(r.right - vw)),
        cutBottom: Math.max(0, Math.round(r.bottom - vh)),
        cutLeft: Math.min(0, Math.round(r.left)),
        cutTop: Math.min(0, Math.round(r.top)),
      };
    }).filter((o) => o.cutRight || o.cutBottom || o.cutLeft || o.cutTop);
    return {
      overflows,
      scrollable: screen.scrollHeight > screen.clientHeight,
      scrollH: screen.scrollHeight,
      clientH: screen.clientHeight,
    };
  });
  await page.screenshot({ path: `shot-fit-${vp.name}.png` });
  console.log(vp.name, JSON.stringify(fit));
}

await browser.close();
