# Task #1 단계 4 완료보고서 — 앱 서명 + AAB 빌드 (단계 4a)

## 상태

🟢 **단계 4a (자율 가능 부분) 완료**
🟡 **단계 4b** (실제 keystore 생성·AAB 빌드)는 작업지시자/기관 측 작업으로 분리

## 단계 4a 완료 항목 (자율 진행)

### 1. `build.gradle` 서명 설정

`rhwp-studio/android/app/build.gradle` 갱신:

- `keystore/keystore.properties` 또는 환경변수에서 서명 정보 읽기 (CI 호환)
- `signingConfigs.release` 정의 (V1 비활성, V2 활성 — Play App Signing 권장)
- `buildTypes.release`:
  - `minifyEnabled = true` (코드 축소)
  - `shrinkResources = true` (미사용 리소스 제거)
  - `proguardFiles` = optimize 프로파일
  - 서명 비밀번호 설정된 경우에만 release signing 사용 (CI/로컬 양쪽 호환)
- `bundle { language/density/abi.enableSplit }` — Play Store 디바이스별 분할 APK
- `versionCode 1`, `versionName "1.0.0"`

### 2. ProGuard 규칙 (`proguard-rules.pro`)

- Capacitor 클래스 보존 (`com.getcapacitor.**`)
- `@CapacitorPlugin` / `@PluginMethod` 어노테이션 보존
- Cordova 플러그인 보존
- AndroidX 보존
- WebView JavaScript 인터페이스 보존
- 디버그 정보 보존 (크래시 분석용)

### 3. 빌드 스크립트 (`scripts/build-android-release.sh`)

4단계 자동화:
1. WASM 빌드 (`wasm-pack build --target web`)
2. 웹 빌드 (`npm run build`)
3. Capacitor 동기화 (`npx cap sync android`)
4. AAB 빌드 (`./gradlew bundleRelease`)

각 단계마다 산출물 검증 + 환경변수/툴 미설치 시 명확한 에러 메시지.

### 4. 키스토어 운영 가이드 (`keystore/README.md`)

- `keytool` 생성 명령 (RSA 2048, 10000일)
- `keystore.properties` 또는 환경변수 옵션
- **백업 필수성** 강조 (분실 시 앱 재발행 불가)
- Play App Signing 권장 (업로드 키/서명 키 분리)
- 검증 명령 (`keytool -list`, `apksigner verify`)

### 5. `.gitignore` 보강

`/keystore/*.keystore`, `/keystore/*.jks`, `/keystore/keystore.properties`, `/keystore/.passwords.local` 모두 제외.

### 6. 단계 5 프리뷰 문서

| 문서 | 위치 |
|------|------|
| Play Store 등록 정보 (한국어) | `mydocs/release/play_store_listing_ko.md` |
| 개인정보 처리방침 (한국어) | `mydocs/release/privacy_policy_ko.md` |
| 데이터 안전 섹션 입력 가이드 | `mydocs/release/data_safety.md` |

## 단계 4b — 작업지시자 측 작업 (가이드)

### 선결 조건 (모두 완료 시 4b 진입 가능)

- [ ] **Android Studio 설치** (https://developer.android.com/studio)
- [ ] SDK Manager에서 다음 다운로드:
  - Android SDK Platform 34 (Android 14)
  - Android SDK Build-Tools 34.0.0
  - Android Emulator (선택, Pixel 6 이미지)
- [ ] `ANDROID_HOME` 환경변수 설정
- [ ] (실기기 검증 시) USB 디버깅 켜진 안드로이드 폰 + ADB 인식

### 4b 작업 절차

#### a. 키스토어 생성 (정보보안팀과 협의)

```bash
cd D:\01_coding\gyeonggi-council\keystore
keytool -genkey -v -keystore release.keystore \
  -alias gyeonggi-council -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

생성 후:
- `keystore.properties` 작성 (`keystore.properties.example` 참고)
- 키스토어 파일을 **클라우드 KMS / 정보보안 저장소에 백업**
- 비밀번호는 **별도 password manager**에 보관

#### b. AAB 빌드

```bash
cd D:\01_coding\gyeonggi-council
bash scripts/build-android-release.sh
```

산출물: `rhwp-studio/android/app/build/outputs/bundle/release/app-release.aab`

#### c. 서명 검증

```bash
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose \
  rhwp-studio/android/app/build/outputs/bundle/release/app-release.aab
```

#### d. 실기기 디바이스 검증

```bash
# AAB → APK 변환 + 디바이스 설치
bundletool build-apks --bundle=app-release.aab --output=app-release.apks \
  --ks=keystore/release.keystore --ks-key-alias=gyeonggi-council
bundletool install-apks --apks=app-release.apks
```

검증 항목:
- [ ] 앱 정상 실행, UI 표시 (단계 1 검증)
- [ ] 햄버거 메뉴 동작 (단계 2)
- [ ] 안드로이드 파일 매니저에서 .hwp 탭 → 본 앱이 후보로 노출 (단계 3 인텐트 필터)
- [ ] 본 앱 내에서 .hwp 파일 열기 → 정상 렌더링
- [ ] HWP → SVG/HWP 저장 → Documents/rhwp/ 에 정상 저장
- [ ] 큰 파일(10MB+) 메모리 OOM 없음

## 변경 파일 요약

| 파일 | 변경 |
|------|------|
| `rhwp-studio/android/app/build.gradle` | signingConfigs, minifyEnabled, bundle splits, versionName 1.0.0 |
| `rhwp-studio/android/app/proguard-rules.pro` | Capacitor/Cordova/AndroidX 보존 규칙 |
| `keystore/README.md` (신규) | 키스토어 운영 가이드 |
| `keystore/keystore.properties.example` (신규) | 템플릿 |
| `scripts/build-android-release.sh` (신규) | 4단계 자동 빌드 |
| `.gitignore` | keystore 디렉토리 제외 강화 |
| `mydocs/release/play_store_listing_ko.md` (신규) | 등록 정보 한국어 |
| `mydocs/release/privacy_policy_ko.md` (신규) | 개인정보 처리방침 |
| `mydocs/release/data_safety.md` (신규) | 데이터 안전 입력 가이드 |

## 다음 단계

### 단계 4b (작업지시자 작업)
1. Android Studio 설치
2. 키스토어 생성·백업
3. `bash scripts/build-android-release.sh` 실행
4. 실기기 검증

### 단계 5 (Play Console 작업)
1. 앱 아이콘 / 기능 그래픽 / 스크린샷 제작
2. 개인정보처리방침 호스팅 URL 결정 (경기도의회 홈페이지 또는 GitHub Pages)
3. Play Console 앱 생성 → 메타데이터 입력 → AAB 업로드
4. 내부 테스트 → 비공개 테스트 → 공개 트랙 순차 진행

## 승인 요청

본 단계 4a 완료보고서 승인 + 단계 4b·5 작업 합의 요청.
