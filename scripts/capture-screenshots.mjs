/**
 * Play Store 스크린샷 자동 캡처
 *
 * 캡처 시나리오:
 *   1. 새 문서 (빈 문서 표시)
 *   2. 샘플 HWP 로드
 *   3. 다른 샘플 HWP 로드
 *   4. 메뉴/도구 상자 보이는 일반 화면
 *
 * 출력 사이즈 (Play Console 권장):
 *   - 폰: 1080×1920 portrait (3장 이상 필수, 최대 8장)
 *   - 7인치 태블릿: 1080×1920 portrait
 *   - 10인치 태블릿: 1920×1200 landscape
 *
 * 실행:
 *   node scripts/capture-screenshots.mjs
 *
 * 환경변수:
 *   CHROME_PATH=...  (기본 자동 탐지)
 *   SCREENSHOT_DIR=mydocs/release/screenshots
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const STUDIO = resolve(ROOT, 'rhwp-studio');

// puppeteer-core를 rhwp-studio/node_modules에서 동적 import
const pupUrl = pathToFileURL(resolve(STUDIO, 'node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js')).href;
const puppeteer = (await import(pupUrl)).default;

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

const SCREENSHOT_DIR = process.env.SCREENSHOT_DIR
  ? resolve(ROOT, process.env.SCREENSHOT_DIR)
  : resolve(ROOT, 'mydocs/release/screenshots');
const VITE_PORT = 7715;
const VITE_URL = `http://localhost:${VITE_PORT}`;

// 캡처할 디바이스 프리셋 (vp = 뷰포트, dpr × vp = 출력 픽셀 사이즈)
// Play Store 요구: 320~3840px, 16:9 권장, 폰은 1080×1920 권장
const PRESETS = [
  // 폰: vp 480×853 (모바일 UI 트리거, <768px) × DPR 2.25 = 1080×1919
  { name: 'phone',     width: 480,  height: 853, devicePixelRatio: 2.25 },
  // 7인치 태블릿: vp 800×1280 (태블릿 UI) × DPR 1.35 = 1080×1728
  { name: 'tablet-7',  width: 800,  height: 1280, devicePixelRatio: 1.35 },
  // 10인치 태블릿 가로: vp 1280×800 × DPR 1.5 = 1920×1200
  { name: 'tablet-10', width: 1280, height: 800,  devicePixelRatio: 1.5 },
];

// 시나리오 (각 프리셋마다 모두 캡처)
const SCENARIOS = [
  { id: '01-empty',       desc: '시작 화면 (빈 문서 안내)', sample: null },
  { id: '02-sample-hwp',  desc: '샘플 HWP 표시',           sample: 'samples/2010-01-06.hwp' },
  { id: '03-toolbar',     desc: '도구 상자 + 서식 표시',    sample: 'samples/2022년 국립국어원 업무계획.hwp' },
];

async function ensureDir(p) { await mkdir(p, { recursive: true }); }

console.log(`[screenshot] 출력 폴더: ${SCREENSHOT_DIR}`);
await ensureDir(SCREENSHOT_DIR);

// Vite dev server 기동
console.log(`[screenshot] Vite dev server 기동 중...`);
const vite = spawn('npx', ['vite', '--port', String(VITE_PORT), '--host', '127.0.0.1'], {
  cwd: STUDIO,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let viteReady = false;
const onReady = new Promise((res, rej) => {
  const onLog = (b) => {
    const s = b.toString();
    if (!viteReady && /(Local:|ready in)/i.test(s)) { viteReady = true; res(); }
  };
  vite.stdout.on('data', onLog);
  vite.stderr.on('data', onLog);
  vite.on('exit', (code) => !viteReady && rej(new Error(`vite exited (code=${code})`)));
  setTimeout(() => !viteReady && rej(new Error('vite timeout 30s')), 30000);
});

let exitCode = 1;
let browser;
try {
  await onReady;
  await wait(500);
  console.log(`[screenshot] Vite ${VITE_URL} 기동 완료, Chrome 시작`);

  for (const preset of PRESETS) {
    console.log(`\n=== 디바이스: ${preset.name} (${preset.width}×${preset.height}) ===`);
    const presetDir = resolve(SCREENSHOT_DIR, preset.name);
    await ensureDir(presetDir);

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--window-size=${preset.width},${preset.height}`],
    });

    for (const sc of SCENARIOS) {
      const page = await browser.newPage();
      await page.setViewport({ width: preset.width, height: preset.height, deviceScaleFactor: preset.devicePixelRatio });

      page.on('pageerror', (e) => console.error('  [page error]', e.message));

      try {
        await page.goto(VITE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.waitForFunction(() => !!document.getElementById('editor-area'), { timeout: 15000 });
        await wait(800);

        if (sc.sample) {
          const samplePath = resolve(ROOT, sc.sample);
          if (!existsSync(samplePath)) {
            console.warn(`  [skip] 샘플 없음: ${sc.sample}`);
            await page.close();
            continue;
          }
          const buf = await readFile(samplePath);
          const arr = Array.from(buf);
          // hwp파일을 WASM에 로드 (window.__wasm 활용)
          await page.waitForFunction(() => !!window.__wasm, { timeout: 15000 });
          await page.evaluate(async (bytes, name) => {
            // WasmBridge.loadDocument는 Uint8Array를 받는다
            const u8 = new Uint8Array(bytes);
            const docInfo = window.__wasm.loadDocument(u8, name);
            // canvasView가 있으면 reload
            window.__canvasView?.loadDocument?.();
            return docInfo;
          }, arr, sc.sample.split('/').pop());
          await wait(2500);  // 폰트 로드 + 렌더 안정화
        }

        const out = resolve(presetDir, `${sc.id}.png`);
        await page.screenshot({ path: out, fullPage: false });
        console.log(`  생성: ${out}`);
      } catch (e) {
        console.error(`  [실패] ${sc.id}: ${e.message}`);
      } finally {
        await page.close();
      }
    }

    await browser.close();
    browser = null;
  }

  console.log(`\n완료. 출력 폴더: ${SCREENSHOT_DIR}`);
  console.log('Play Console 업로드 시 권장:');
  console.log('  - 폰 스크린샷: phone/ 의 PNG 3~8장');
  console.log('  - 7인치 태블릿: tablet-7/ 의 PNG 1~8장 (선택)');
  console.log('  - 10인치 태블릿: tablet-10/ 의 PNG 1~8장 (선택)');
  exitCode = 0;
} catch (e) {
  console.error('스크린샷 캡처 오류:', e.stack || e.message || e);
} finally {
  if (browser) await browser.close().catch(() => {});
  vite.kill();
  await wait(200);
  process.exit(exitCode);
}
