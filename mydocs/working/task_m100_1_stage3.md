# Task #1 단계 3 완료보고서 — 네이티브 파일 통합

## 상태

🟢 **완료** — 코드/설정 측 모든 항목 완료. 실기기 검증은 단계 4(AAB 빌드)와 통합.

## 변경 내역

| 파일 | 변경 |
|------|------|
| `rhwp-studio/package.json` | `@capacitor/filesystem@^8.1.2`, `@capacitor/app@^8.1.0` 추가 |
| `rhwp-studio/src/core/platform.ts` (신규) | `isNativePlatform()`, `getPlatform()` |
| `rhwp-studio/src/core/native-file.ts` (신규) | URI → bytes 읽기, Documents/rhwp/에 저장, `appUrlOpen` 인텐트 리스너 |
| `rhwp-studio/src/command/commands/file.ts` | 네이티브 분기 추가: `file:open`은 `<input type="file">` (SAF), `file:save`는 `Filesystem.writeFile` |
| `rhwp-studio/src/main.ts` | `onNativeFileOpen` 등록 → 외부 인텐트로 들어온 .hwp 자동 로드 |
| `rhwp-studio/android/app/src/main/AndroidManifest.xml` | `intent-filter` 2개 추가 (MIME 타입 + path 패턴 .hwp/.hwpx) |

## 핵심 동작

### 1. 파일 열기 (Capacitor Android)

```ts
if (isNativePlatform()) {
  document.getElementById('file-input')?.click();  // SAF 호출
  return;
}
// 기존 데스크톱 경로 (File System Access API)
```

- 안드로이드 `<input type="file" accept=".hwp,.hwpx">` 클릭 → 시스템 파일 피커 (SAF) 자동 호출
- 별도 권한 요청 없이 사용자가 명시적으로 선택한 파일에만 접근 (보안 ↑)

### 2. 파일 저장 (Capacitor Android)

```ts
if (isNativePlatform()) {
  const result = await writeBytesToDocuments(saveName, bytes);
  // → /Documents/rhwp/{fileName}
  return;
}
// 기존 데스크톱 경로 (File System Access API + Blob 다운로드)
```

- `Directory.Documents` + `recursive: true` 로 `Documents/rhwp/` 디렉토리 자동 생성
- base64 인코딩으로 바이너리 안전 저장

### 3. 외부 인텐트 (.hwp 파일 탭 시 본 앱이 후보로 노출)

`AndroidManifest.xml`에 추가된 intent-filter:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="content" />
  <data android:scheme="file" />
  <data android:mimeType="application/x-hwp" />
  <!-- 외 5개 MIME -->
</intent-filter>
<intent-filter>
  <data android:pathPattern=".*\\.hwp" />
  <data android:pathPattern=".*\\.hwpx" />
  <!-- ... -->
</intent-filter>
```

JS 측:
```ts
App.addListener('appUrlOpen', async (event) => {
  if (!/\.hwpx?(\?|$)/i.test(event.url)) return;
  const opened = await readUriAsBytes(event.url);
  // eventBus.emit('open-document-bytes', ...)
});
```

- 외부 파일 매니저 / Gmail 첨부 / 메신저 등에서 `.hwp` 탭 → 본 앱이 "열기" 후보로 노출
- 본 앱 선택 시 `appUrlOpen` 이벤트로 URI 전달 → `Filesystem.readFile`로 bytes 추출 → 기존 로드 파이프라인에 연결

### 4. Capacitor 플러그인 자동 등록

```
[info] Found 2 Capacitor plugins for android:
       @capacitor/app@8.1.0
       @capacitor/filesystem@8.1.2
```

`npx cap sync android` 시 자동 감지되어 `MainActivity` 가 사용 가능.

## 검증

### 빌드
- `npm run build` 통과 — 번들 +12KB (`@capacitor/app` + `@capacitor/filesystem`)
- TypeScript 타입 검사 통과

### E2E 회귀 (기존 mobile-menu 테스트 재실행)
```
toggleExists at 375px: true
after click, mobile-open: true
after outside click, mobile-open: false
toggleExists at 1280px: false
PASS: mobile menu toggle integration
```
Stage 2 회귀 없음. (404 1건은 `fonts/Pretendard-Regular.woff2` 누락 — Stage 3과 무관)

### Capacitor 동기화
```
√ Copying web assets from dist to android\app\src\main\assets\public
√ update android in 306.58ms
```
신규 플러그인 + 변경된 AndroidManifest 모두 정상 반영.

## 보안 고려

- **불필요한 권한 추가 안 함**: SAF로 사용자가 명시 선택한 파일만 접근. `READ_EXTERNAL_STORAGE` 같은 광범위 권한 불필요 (Android 13+ 기준)
- `appUrlOpen` 핸들러에서 확장자 화이트리스트 (`.hwp`, `.hwpx`)만 처리 — 임의 URL 처리 차단
- `Filesystem.writeFile`은 앱 전용 Documents 디렉토리만 사용 (외부 침입 영향 ↓)

## 보류 / 단계 4·5에서 검증

| 항목 | 사유 |
|------|------|
| 실기기에서 .hwp 외부 인텐트 동작 | 단계 4(AAB 빌드 + 실기기 설치)에서 검증 |
| 큰 .hwp 파일(10MB+) 메모리 동작 | 동일 |
| Documents/rhwp/ 권한 동작 | 동일 |
| 한글 파일명 인코딩 | 동일 |

## 다음 단계 (단계 4 — 앱 서명 + AAB 빌드)

- **선결: Android Studio + SDK Platform 34 설치 (작업지시자)**
- 키스토어 생성 (RSA 2048, 10000일)
- `signingConfigs` + `buildTypes.release` 설정
- `gradlew bundleRelease` → AAB 산출
- 실기기 검증 (단계 1~3 통합 테스트 포함)

## 승인 요청

본 단계 3 완료보고서 승인 요청. **단계 4 진입 전에 Android Studio 설치가 선결**입니다.
