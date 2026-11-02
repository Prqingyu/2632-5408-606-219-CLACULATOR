// Headless screenshot / smoke test for the GUI
const path = require('path');
const url = require('url');
const puppeteer = require('C:/Users/sango/.dsh/profiles/desktop/node_modules/puppeteer-core');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PAGE = url.pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1080, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text()); });
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

  await page.goto(PAGE, { waitUntil: 'load' });
  await sleep(1600); // auto-demo generation on load

  const read = () => page.evaluate(() => ({
    badge: document.querySelector('#modeBadge').textContent,
    label: document.querySelector('#exprLabel').innerText,
    expr: document.querySelector('#expression').innerText,
    meta: document.querySelector('#resultMeta').textContent,
    used: document.querySelector('#used').innerText.replace(/\n/g, ' | '),
    history: document.querySelector('#history').innerText.replace(/\n/g, ' | ')
  }));

  console.log('=== initial ===');
  console.log(await read());
  await page.screenshot({ path: path.resolve(__dirname, 'shot-home.png'), fullPage: true });

  // 换目标：2026 -> 用搜索命中
  async function go(target) {
    await page.evaluate((t) => {
      const el = document.querySelector('#targetInput');
      el.value = t;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, target);
    await page.click('#generateBtn');
    await sleep(1700);
    console.log('=== ' + target + ' ===');
    console.log(await read());
  }

  await go('2026');
  await page.screenshot({ path: path.resolve(__dirname, 'shot-2026.png'), fullPage: true });

  await go('314159');
  await page.screenshot({ path: path.resolve(__dirname, 'shot-fallback.png'), fullPage: true });

  // 换一个
  await page.evaluate(() => {
    const el = document.querySelector('#targetInput');
    el.value = '2025';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#generateBtn');
  await sleep(1500);
  const before = await page.evaluate(() => document.querySelector('#expression').innerText);
  await page.click('#nextBtn');
  await sleep(300);
  const after = await page.evaluate(() => document.querySelector('#expression').innerText);
  console.log('=== next candidate ===');
  console.log({ before, after, changed: before !== after });

  // 手机布局
  await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 });
  await sleep(400);
  await page.screenshot({ path: path.resolve(__dirname, 'shot-mobile.png'), fullPage: true });

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
