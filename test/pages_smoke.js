// Live GitHub Pages smoke test (loads the deployed site with headless Edge)
// Usage: node test/pages_smoke.js [url]
const path = require('path');
const puppeteer = require('C:/Users/sango/.dsh/profiles/desktop/node_modules/puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.argv[2] || 'https://prqingyu.github.io/2632-5408-606-219-CLACULATOR/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });

  console.log('loading', URL);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(2200);
  const info = await page.evaluate(() => ({
    title: document.title,
    badge: document.querySelector('#modeBadge').textContent,
    expr: document.querySelector('#expression').innerText,
    sources: document.querySelector('#sourcesLine').innerText.replace(/\n/g, ' ')
  }));
  console.log('page info:', info);

  // generate for a target
  await page.evaluate(() => {
    const el = document.querySelector('#targetInput');
    el.value = '2026';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#generateBtn');
  await sleep(2000);
  const gen = await page.evaluate(() => ({
    target: document.querySelector('#targetInput').value,
    badge: document.querySelector('#modeBadge').textContent,
    expr: document.querySelector('#expression').innerText
  }));
  console.log('generated:', gen);

  await page.screenshot({ path: path.resolve(__dirname, 'shot-pages.png'), fullPage: false });
  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
