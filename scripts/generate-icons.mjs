/**
 * Android adaptive icon + Play Store 자산 자동 생성
 *
 * 입력:
 *   design/icon-source.svg     — 1024×1024 풀 아이콘 (Play Store)
 *   design/icon-foreground.svg — 108×108 adaptive foreground
 *
 * 출력:
 *   rhwp-studio/android/app/src/main/res/mipmap-{m,h,xh,xxh,xxxh}dpi/
 *     ic_launcher.png             (legacy 풀 아이콘 — adaptive 미지원 디바이스 대비)
 *     ic_launcher_round.png       (legacy 둥근 아이콘)
 *     ic_launcher_foreground.png  (adaptive foreground)
 *   rhwp-studio/android/app/src/main/res/values/ic_launcher_background.xml (색상)
 *   mydocs/release/icons/play-store-icon.png    (512×512)
 *   mydocs/release/icons/play-store-icon-1024.png  (1024×1024 백업)
 *   mydocs/release/icons/feature-graphic.png    (1024×500)
 *
 * 실행: node scripts/generate-icons.mjs
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// rhwp-studio/node_modules에 sharp가 있으므로 그곳에서 동적 import
const sharpUrl = pathToFileURL(resolve(ROOT, 'rhwp-studio/node_modules/sharp/lib/index.js')).href;
const sharp = (await import(sharpUrl)).default;

const sources = {
  full: resolve(ROOT, 'design/icon-source.svg'),
  foreground: resolve(ROOT, 'design/icon-foreground.svg'),
};

const ANDROID_RES = resolve(ROOT, 'rhwp-studio/android/app/src/main/res');
const PLAY_OUT = resolve(ROOT, 'mydocs/release/icons');

// Android adaptive icon: foreground 108dp = 432px @ xxxhdpi
// legacy launcher: 48dp = 192px @ xxxhdpi
const DENSITIES = [
  { name: 'mdpi',    legacy: 48,  foreground: 108 },
  { name: 'hdpi',    legacy: 72,  foreground: 162 },
  { name: 'xhdpi',   legacy: 96,  foreground: 216 },
  { name: 'xxhdpi',  legacy: 144, foreground: 324 },
  { name: 'xxxhdpi', legacy: 192, foreground: 432 },
];

async function ensureDir(p) {
  await mkdir(p, { recursive: true });
}

async function svgToPng(svgPath, outPath, size) {
  const buf = await readFile(svgPath);
  await sharp(buf, { density: 384 })  // SVG 해상도 — 큰 값으로 안티에일리어싱
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  생성: ${outPath} (${size}×${size})`);
}

async function svgToPngWithBackground(svgPath, outPath, size, bg = '#1e3a8a') {
  const buf = await readFile(svgPath);
  await sharp(buf, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background: bg })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  생성: ${outPath} (${size}×${size}, bg=${bg})`);
}

async function generateRound(svgPath, outPath, size) {
  const buf = await readFile(svgPath);
  // 둥근 아이콘: 사각 SVG를 원형으로 마스크
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`,
  );
  await sharp(buf, { density: 384 })
    .resize(size, size)
    .composite([{ input: circle, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  생성: ${outPath} (${size}×${size}, round)`);
}

async function generateFeatureGraphic(svgPath, outPath) {
  // 1024×500 — 좌측에 아이콘 + 우측에 텍스트
  const width = 1024;
  const height = 500;
  const iconSize = 320;
  const iconBuf = await sharp(await readFile(svgPath), { density: 384 })
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();

  // 배경 SVG (텍스트 크기·여백 보정)
  const bgSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1e40af"/>
          <stop offset="100%" stop-color="#0c2461"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      <text x="500" y="180"
            font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif"
            font-size="48"
            font-weight="800"
            fill="#ffffff">경기도의회</text>
      <text x="500" y="240"
            font-family="Malgun Gothic, Apple SD Gothic Neo, sans-serif"
            font-size="48"
            font-weight="800"
            fill="#ffffff">HWP 뷰어</text>
      <text x="500" y="300"
            font-family="Malgun Gothic, sans-serif"
            font-size="26"
            font-weight="500"
            fill="#cbd5e1">한컴오피스 없이 .hwp 파일 보기</text>
      <text x="500" y="360"
            font-family="Malgun Gothic, sans-serif"
            font-size="22"
            font-weight="400"
            fill="#94a3b8">오프라인 · 로컬 처리 · 광고 없음</text>
    </svg>
  `);

  await sharp(bgSvg)
    .composite([{ input: iconBuf, top: (height - iconSize) / 2, left: 90 }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  생성: ${outPath} (${width}×${height}, feature graphic)`);
}

async function main() {
  console.log('===== Android adaptive icon 생성 =====\n');
  for (const d of DENSITIES) {
    const dir = resolve(ANDROID_RES, `mipmap-${d.name}`);
    await ensureDir(dir);

    // Adaptive foreground (배경 투명)
    await svgToPng(sources.foreground, resolve(dir, 'ic_launcher_foreground.png'), d.foreground);

    // Legacy 사각 아이콘 (Android 8.0 이전, 풀 아이콘)
    await svgToPngWithBackground(sources.full, resolve(dir, 'ic_launcher.png'), d.legacy, '#1e3a8a');

    // Legacy 둥근 아이콘
    await generateRound(sources.full, resolve(dir, 'ic_launcher_round.png'), d.legacy);
  }

  console.log('\n===== Play Store 자산 생성 =====\n');
  await ensureDir(PLAY_OUT);
  await svgToPngWithBackground(sources.full, resolve(PLAY_OUT, 'play-store-icon.png'), 512, '#1e3a8a');
  await svgToPngWithBackground(sources.full, resolve(PLAY_OUT, 'play-store-icon-1024.png'), 1024, '#1e3a8a');
  await generateFeatureGraphic(sources.full, resolve(PLAY_OUT, 'feature-graphic.png'));

  // ic_launcher_background.xml 색상으로 단순화 (vector → values/colors.xml + drawable 변경)
  const valuesDir = resolve(ANDROID_RES, 'values');
  await ensureDir(valuesDir);
  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#1e3a8a</color>
</resources>
`;
  await writeFile(resolve(valuesDir, 'ic_launcher_background.xml'), colorsXml);
  console.log(`  생성: ${resolve(valuesDir, 'ic_launcher_background.xml')}`);

  console.log('\n완료. 다음 명령으로 APK 재빌드:');
  console.log('  cd rhwp-studio/android && ./gradlew :app:assembleDebug');
}

main().catch((e) => {
  console.error('icon 생성 실패:', e);
  process.exit(1);
});
