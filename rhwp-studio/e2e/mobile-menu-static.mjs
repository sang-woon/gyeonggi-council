import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';

const PORT = 4321;
const ROOT = resolve(import.meta.dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

function findChrome() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Users\\USER\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return candidates.find((p) => existsSync(p));
}

function startServer() {
  const server = createServer(async (req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = join(ROOT, urlPath);
    try {
      const s = await stat(filePath);
      if (s.isFile()) {
        const data = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        res.end(data);
        return;
      }
    } catch {
      // not found
    }
    res.writeHead(404);
    res.end('Not Found');
  });
  return new Promise((res) => {
    server.listen(PORT, '127.0.0.1', () => res(server));
  });
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) throw new Error('Chrome/Edge not found');

  const server = await startServer();
  console.log(`[server] http://127.0.0.1:${PORT}/`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    defaultViewport: { width: 375, height: 667, isMobile: true, hasTouch: true },
    args: ['--no-sandbox'],
  });

  const failures = [];
  try {
    const page = await browser.newPage();
    const networkFailures = [];
    page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => {
      networkFailures.push(`${req.failure()?.errorText} ${req.url()}`);
    });
    page.on('response', (resp) => {
      if (resp.status() >= 400) networkFailures.push(`HTTP ${resp.status()} ${resp.url()}`);
    });
    page.on('console', (m) => {
      const text = m.text();
      // 404 등 리소스 로드 실패는 별도 통계로 분리 (모바일 메뉴 기능과 무관)
      if (m.type() === 'error' && !text.includes('Failed to load resource')) {
        failures.push(`console.error: ${text}`);
      }
    });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await wait(800);

    const toggleExists = await page.$('.mobile-menu-toggle');
    console.log(`toggleExists at 375px: ${!!toggleExists}`);
    if (!toggleExists) failures.push('mobile-menu-toggle NOT present at 375px viewport');

    if (toggleExists) {
      await page.click('.mobile-menu-toggle');
      await wait(150);
      const afterOpen = await page.$eval('#menu-bar', (el) => el.classList.contains('mobile-open'));
      console.log(`after click, mobile-open: ${afterOpen}`);
      if (!afterOpen) failures.push('menu-bar did not get mobile-open after click');

      await page.click('#scroll-container');
      await wait(150);
      const afterOutside = await page.$eval('#menu-bar', (el) => el.classList.contains('mobile-open'));
      console.log(`after outside click, mobile-open: ${afterOutside}`);
      if (afterOutside) failures.push('mobile-open not removed after outside click');
    }

    await page.setViewport({ width: 1280, height: 800, isMobile: false, hasTouch: false });
    await wait(400);
    const toggleAfterDesktop = await page.$('.mobile-menu-toggle');
    console.log(`toggleExists at 1280px: ${!!toggleAfterDesktop}`);
    if (toggleAfterDesktop) failures.push('mobile-menu-toggle still present after switching to desktop viewport');
  } finally {
    await browser.close();
    server.close();
  }

  if (networkFailures.length) {
    console.log('--- network failures (informational) ---');
    for (const f of networkFailures) console.log('  *', f);
  }
  if (failures.length) {
    console.error('FAIL:');
    for (const f of failures) console.error('  -', f);
    process.exit(1);
  }
  console.log('PASS: mobile menu toggle integration');
  // puppeteer-core + headless: 일부 환경에서 정상 종료가 안 잡혀 명시 종료
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
