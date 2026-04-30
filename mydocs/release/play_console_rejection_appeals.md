# Play Console 거절 시 항소문 템플릿

본 앱이 Play Console 검토에서 거절될 경우 사용할 항소문 템플릿. 거절 사유별로 사전 작성하여, 거절 메일 수신 즉시 24시간 내 항소.

## 항소 절차

1. 거절 메일 확인 → 사유 코드(예: 4.7, MIN-API, etc.) 식별
2. 아래 해당 템플릿 복사 → 영문 번역 (필요 시 deepl·papago)
3. Play Console > 검토 결과 > **이의 신청** 또는 메일 회신
4. 24시간 내 회신 권장 (Google 응답 시간 단축)

## A. "Wrapped Website" / "Webview-only" 거절 (정책 4.5)

이 정책은 단순히 웹사이트를 WebView로 감싼 앱을 거부하는 정책. 본 앱은 다음을 어필.

```
Subject: Appeal — App ID kr.go.gg.council.hwp Policy 4.5 Review

Hello Google Play Review Team,

We received a rejection citing the "wrapped website" policy. We respectfully
request reconsideration with the following clarifications:

1. THIS APP DOES NOT WRAP A WEBSITE.
   The app contains a fully self-contained HWP document parser implemented in
   Rust and compiled to WebAssembly. All document parsing, rendering, and file
   I/O occurs ON THE USER'S DEVICE. There is no external website or server
   that the app loads or proxies. The WebAssembly binary (4.1MB) is bundled
   inside the APK/AAB.

2. THE APP PROVIDES MEANINGFUL NATIVE FUNCTIONALITY.
   - Native Android intent filters for .hwp / .hwpx file association (when
     users tap an HWP file in any file manager or messenger, this app appears
     in the chooser)
   - Native file picker via Storage Access Framework (Capacitor Filesystem)
   - Native saving to Documents/rhwp/ folder
   - Capacitor 8 plugin integration for file access

3. THE APP HAS NO INTERNET COMMUNICATION.
   The INTERNET permission is declared only because Android WebView component
   requires it for system reasons (per Android documentation), but the app
   makes no network requests. We can demonstrate this with packet captures.

4. THE APP IS PUBLISHED BY A KOREAN GOVERNMENT INSTITUTION.
   Gyeonggi-do Provincial Council (경기도의회) — D-U-N-S registration
   completed under wooni0103@gg.go.kr account. The app serves a legitimate
   public-sector accessibility need: enabling citizens to view HWP documents
   (the de facto Korean government document format) without requiring the
   proprietary Hancom Office software.

5. SOURCE CODE IS PUBLIC.
   The underlying engine is open-source (https://github.com/edwardkim/rhwp,
   MIT License). Independent verification of our claims is possible.

We ask that the review team look at the actual implementation, particularly
the rust source under src/ and the Capacitor configuration in
rhwp-studio/capacitor.config.ts.

Thank you for your reconsideration.

Best regards,
Gyeonggi-do Provincial Council IT Department
ggc.it.portal@gmail.com
```

## B. "Excessive Permissions" 거절 (정책 9.1)

본 앱은 INTERNET만 사용. 거절 시 매우 드물지만 대응:

```
Subject: Appeal — App ID kr.go.gg.council.hwp Permission Justification

Hello Review Team,

The app requests only the INTERNET permission, which is implicitly required
by Android's WebView component (used by Capacitor 8 to render the HWP viewer
UI). Despite holding this permission, the app makes ZERO network requests at
runtime — all HWP parsing and rendering happens on-device using a bundled
WebAssembly binary.

For permissions inspection:
- AndroidManifest.xml: only <uses-permission android:name="android.permission.INTERNET"/>
- Storage access: handled exclusively via Storage Access Framework (no
  READ_EXTERNAL_STORAGE or MANAGE_EXTERNAL_STORAGE)
- File saving: Documents/rhwp/ via Capacitor Filesystem (DOCUMENTS directory,
  user-scoped)

If the team wishes to verify no external traffic, we can provide a tcpdump
capture showing zero outbound packets while loading and rendering an HWP
document.

Thank you,
Gyeonggi-do Provincial Council
```

## C. "Privacy Policy URL Invalid" 거절

GitHub Pages 배포가 늦어졌거나 URL 오타로 인한 거절.

```
We've identified the issue: our privacy policy is hosted on GitHub Pages and
the deployment workflow finished after our initial submission. The URL is
now live and verified:

  https://sang-woon.github.io/gyeonggi-council/privacy.html

Please re-verify the URL. We have updated our app submission accordingly.

Best regards,
Gyeonggi-do Provincial Council
```

## D. "Government App Verification" 추가 요청

D-U-N-S 등록 완료 후에도 추가 인증을 요구할 경우:

```
We confirm that this application is published officially by the Gyeonggi-do
Provincial Council (경기도의회), a legislative body of Gyeonggi-do (Province),
Republic of Korea.

Verification documents:
1. D-U-N-S Number: [발급된 번호]
2. Publishing email: wooni0103@gg.go.kr (gg.go.kr is the official domain
   for Gyeonggi Province government, regulated by 경기도청)
3. Contact email: ggc.it.portal@gmail.com

If additional verification is required, we can:
- Provide an official letter (공문) from Gyeonggi-do Provincial Council
- Set up a screen-share verification call with our IT department
- Provide additional gg.go.kr email confirmations

Please advise the preferred verification method.
```

## E. "Target API Level Too Low" 거절

본 앱은 `targetSdkVersion 36` (최신). 발생 가능성 낮음. 만약 발생 시:

```
Our build configuration is correct:
- compileSdkVersion 36
- targetSdkVersion 36
- minSdkVersion 24 (Android 7.0+)

The AAB metadata may have been misread. Please re-verify using the
APK Analyzer / Play Console technical details panel.

If a specific API level is now required, we will rebuild promptly.
```

## F. 일반 권장 사항

- **빠른 응답**: 거절 후 48시간 내 회신 시 대부분 빠르게 처리
- **구체적 증거**: 코드 라인, AndroidManifest 발췌, 스크린샷 첨부 권장
- **공손한 톤**: "respectfully request", "thank you for your reconsideration"
- **재제출 vs 항소**: 명확한 정책 위반이면 수정 후 재제출, 정책 적용 오류면 항소
- **에스컬레이션**: 항소 2회 거절 시 Google Play Console > 도움말 > 정책 위반 신청 → 수동 검토 요청

## G. 한국 측 추가 채널

거절이 지속될 경우:
- **Google Korea**: support@google.com (한국 운영팀)
- **한국정부 공공기관 채널**: 행정안전부 정부3.0 추진단 협조 가능 (gg.go.kr 명의로 정식 협조 요청)
- **API Console > 비즈니스 인증**: 정부 기관 인증 별도 신청 가능
