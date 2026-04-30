/**
 * 읽기 전용 모드 E2E 테스트
 *
 * Vite dev server를 띄우고 Chrome으로 페이지를 로드한 뒤,
 * window 객체에 노출된 모듈로 모드를 강제 전환하여 UI 동작을 검증한다.
 *
 * 실행:
 *   node e2e/readonly-mode.test.mjs
 *
 * 환경변수:
 *   CHROME_PATH=...  (기본: Windows 표준 경로 자동 탐지)
 */
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';

// ---- 환경 ----
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const CHROME_PATH = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME_PATH) {
  console.error('Chrome/Edge 실행 파일을 찾지 못함');
  process.exit(2);
}
const VITE_PORT = 7711;
const VITE_URL = `http://localhost:${VITE_PORT}`;

// ---- 결과 누적 ----
let pass = 0;
let fail = 0;
function assert(cond, label) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL  ${label}`);
  }
}

// ---- Vite dev server 기동 ----
const vite = spawn('npx', ['vite', '--port', String(VITE_PORT), '--host', '127.0.0.1'], {
  cwd: process.cwd(),
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let viteReady = false;
const onReady = new Promise((resolve, reject) => {
  const onLog = (b) => {
    const s = b.toString();
    if (!viteReady && /(Local:|ready in)/i.test(s)) {
      viteReady = true;
      resolve();
    }
  };
  vite.stdout.on('data', onLog);
  vite.stderr.on('data', onLog);
  vite.on('exit', (code) => {
    if (!viteReady) reject(new Error(`vite exited (code=${code})`));
  });
  setTimeout(() => !viteReady && reject(new Error('vite timeout 30s')), 30000);
});

let exitCode = 1;
let browser;
try {
  await onReady;
  await wait(500); // 안정화

  console.log(`[E2E] Vite ${VITE_URL} 기동 완료, Chrome 시작`);
  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('pageerror', (e) => console.error('  [page error]', e.message));
  page.on('console', (m) => {
    const t = m.type();
    if (t === 'error' || t === 'warning') console.log(`  [console.${t}]`, m.text());
  });

  await page.goto(VITE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => !!document.getElementById('editor-area'), { timeout: 15000 });

  // main.ts가 dev 모드에서 window.__readonly / __banner 를 노출하고 사전 마운트한다.
  // mount 완료(__banner ready)까지 대기.
  await page.waitForFunction(() => !!window.__readonly && !!window.__banner, { timeout: 15000 });

  // 헬퍼: 보고서 모킹
  const mkReport = (missing, total) => ({
    totalCount: total,
    availableCount: total - missing,
    substitutedCount: 0,
    missingCount: missing,
    missingRatio: total === 0 ? 0 : missing / total,
    perFont: [
      ...Array.from({ length: total - missing }, (_, i) => ({ name: `OK${i}`, availability: 'registered' })),
      ...Array.from({ length: missing }, (_, i) => ({ name: `Miss${i}`, availability: 'missing' })),
    ],
  });

  // ── 시나리오 1: ok 레벨 (배너 미존재) ──
  console.log('\n[시나리오 1] ok 레벨 (누락 0%)');
  await page.evaluate((rep) => {
    const w = window;
    w.__readonly.applyDecision({ mode: 'edit', level: 'ok', report: rep, isMobile: false });
  }, mkReport(0, 10));
  let exists = await page.$('#rhwp-readonly-banner');
  assert(!exists, 'ok → 배너 미존재');
  let bodyMode = await page.evaluate(() => document.body.dataset.mode);
  assert(bodyMode === 'edit', 'body[data-mode=edit]');

  // ── 시나리오 2: warn 레벨 (노란 배너) ──
  console.log('\n[시나리오 2] warn 레벨 (누락 20%)');
  await page.evaluate((rep) => {
    window.__readonly.applyDecision({ mode: 'edit', level: 'warn', report: rep, isMobile: false });
  }, mkReport(2, 10));
  exists = await page.$('#rhwp-readonly-banner');
  assert(!!exists, 'warn → 배너 존재');
  let cls = await page.$eval('#rhwp-readonly-banner', (el) => el.className);
  assert(cls.includes('readonly-banner--warn'), 'warn 클래스 적용');
  bodyMode = await page.evaluate(() => document.body.dataset.mode);
  assert(bodyMode === 'edit', 'warn에서도 body[data-mode=edit]');

  // ── 시나리오 3: block 레벨 (빨간 배너 + 도구 비활성) ──
  console.log('\n[시나리오 3] block 레벨 (누락 50%)');
  await page.evaluate((rep) => {
    window.__readonly.applyDecision({ mode: 'readonly-auto', level: 'block', report: rep, isMobile: false });
  }, mkReport(5, 10));
  cls = await page.$eval('#rhwp-readonly-banner', (el) => el.className);
  assert(cls.includes('readonly-banner--block'), 'block 클래스 적용');
  bodyMode = await page.evaluate(() => document.body.dataset.mode);
  assert(bodyMode === 'readonly-auto', 'body[data-mode=readonly-auto]');

  // 도구 상자 / 서식 도구 비활성 (CSS 적용 확인)
  const toolbarPe = await page.$eval('#icon-toolbar', (el) => getComputedStyle(el).pointerEvents);
  assert(toolbarPe === 'none', 'icon-toolbar pointer-events: none');
  const stylebarPe = await page.$eval('#style-bar', (el) => getComputedStyle(el).pointerEvents);
  assert(stylebarPe === 'none', 'style-bar pointer-events: none');

  // 자세히 버튼 존재
  const detailBtn = await page.$('.readonly-banner__btn--detail');
  assert(!!detailBtn, '자세히 버튼 존재');
  const forceBtn = await page.$('.readonly-banner__btn--force');
  assert(!!forceBtn, '편집 강제 활성화 버튼 존재');

  // ── 시나리오 4: forceEditMode (강제 편집) ──
  console.log('\n[시나리오 4] forceEditMode (사용자 강제 활성화)');
  await page.evaluate(() => window.__readonly.forceEditMode());
  bodyMode = await page.evaluate(() => document.body.dataset.mode);
  assert(bodyMode === 'readonly-forced', 'body[data-mode=readonly-forced]');
  cls = await page.$eval('#rhwp-readonly-banner', (el) => el.className);
  assert(cls.includes('readonly-banner--block'), 'forced에서도 block 클래스 (시각 경고)');
  const restoreBtn = await page.$('.readonly-banner__btn--restore');
  assert(!!restoreBtn, '읽기 전용으로 복귀 버튼 존재');

  // 도구 상자 다시 활성 (CSS는 readonly-auto에서만 비활성)
  const toolbarPe2 = await page.$eval('#icon-toolbar', (el) => getComputedStyle(el).pointerEvents);
  assert(toolbarPe2 !== 'none', '강제 편집에서 icon-toolbar 활성');

  // ── 시나리오 5: clearForcedEdit (자동 결정 복귀) ──
  console.log('\n[시나리오 5] clearForcedEdit (읽기 전용 복귀)');
  await page.evaluate(() => window.__readonly.clearForcedEdit());
  bodyMode = await page.evaluate(() => document.body.dataset.mode);
  assert(bodyMode === 'readonly-auto', 'clearForcedEdit 후 body[data-mode=readonly-auto]');

  // ── 시나리오 6: 자세히 다이얼로그 ──
  console.log('\n[시나리오 6] 자세히 다이얼로그');
  await page.evaluate(() => {
    document.querySelector('.readonly-banner__btn--detail')?.click();
  });
  await wait(200);
  const dialog = await page.$('.dialog-wrap');
  assert(!!dialog, 'ModalDialog 표시');
  const dialogTitle = await page.$eval('.dialog-title', (el) => el.textContent || '');
  assert(dialogTitle.includes('폰트 가용성'), '다이얼로그 제목 "폰트 가용성"');

  console.log(`\n결과: ${pass} pass / ${fail} fail`);
  exitCode = fail === 0 ? 0 : 1;
} catch (e) {
  console.error('E2E 오류:', e.stack || e.message || e);
  exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  vite.kill();
  await wait(200);
  process.exit(exitCode);
}
