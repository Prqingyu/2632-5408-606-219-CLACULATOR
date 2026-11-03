// Smoke test for the packaged EXE: connect to WebView2 via CDP and verify the app.
// Usage: start dist\2632计算器.exe with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333
//        node test/exe_smoke.js
const puppeteer = require('C:/Users/sango/.dsh/profiles/desktop/node_modules/puppeteer-core');
const path = require('path');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
  const pages = await browser.pages();
  console.log('pages:', pages.map((p) => p.url()));
  const page = pages.find((p) => p.url().includes('app.local')) || pages[0];
  await page.waitForSelector('#expression');
  await sleep(1200);
  const info = await page.evaluate(() => ({
    title: document.title,
    badge: document.querySelector('#modeBadge').textContent,
    target: document.querySelector('#targetInput').value,
    expr: document.querySelector('#expression').innerText,
    meta: document.querySelector('#resultMeta').textContent,
    sources: document.querySelector('#sourcesLine').innerText.replace(/\n/g, ' ')
  }));
  console.log('app info:', info);
  await page.screenshot({ path: path.resolve(__dirname, 'shot-desktop.png') });

  // 随机按钮
  await page.click('#randomBtn');
  await sleep(2200);
  const random = await page.evaluate(() => ({
    target: document.querySelector('#targetInput').value,
    badge: document.querySelector('#modeBadge').textContent,
    expr: document.querySelector('#expression').innerText
  }));
  console.log('random:', random);

  await browser.disconnect();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
