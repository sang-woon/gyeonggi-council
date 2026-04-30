# Android Vitals 임계 알림 설정 가이드

Play Console > Android Vitals의 핵심 지표(크래시·ANR·시작 시간)를 모니터링하고 임계치 초과 시 자동 알림을 받기 위한 설정 가이드.

## 1. Play Console 내장 알림 (Free, 즉시 사용)

### 1-1. 설정 위치

```
Play Console > 사용자 (User) > 프로필 (Profile) > 이메일 환경설정 (Email preferences)
```

### 1-2. 권장 활성 알림

| 알림 카테고리 | 활성 | 사유 |
|------------|------|------|
| 정책 위반 통지 | ✅ | 즉시 대응 필요 |
| 검토 거절 통지 | ✅ | 즉시 항소 |
| 출시 상태 변경 | ✅ | 단계적 출시 진행 추적 |
| **Bad behavior 임계치 초과** | ✅ | 크래시·ANR 임계 도달 시 |
| 심각도 높은 충돌 (Critical Crash) | ✅ | 다수 사용자 영향 시 |
| 사용자 의견 (4점 이하 신규 리뷰) | ✅ | 일 1회 요약 |
| 일반 마케팅 | ❌ | 잡음 차단 |

### 1-3. 한계

- Play Console 내장 알림은 **이메일만 지원** (Slack, 푸시 푸시 미지원)
- 임계치 직접 커스터마이즈 불가 (Google 기본값 고정)
- 일별 다이제스트 — 즉시 알림 아님

## 2. Play Developer API 기반 자동 모니터링 (커스텀)

Play Console 내장으로 부족한 경우, Play Developer API로 Vitals 데이터를 폴링하여 커스텀 알림 구축.

### 2-1. 사전 준비

#### Service Account 생성 (한 번만)

```
1. https://console.cloud.google.com 접속 (wooni0103@gg.go.kr 계정)
2. 새 프로젝트 생성: "rhwp-monitoring"
3. IAM 및 관리자 > 서비스 계정 > 만들기
   - 이름: play-vitals-monitor
   - 역할: 권한 부여 안 함 (Play Console에서 별도 부여)
4. 키 추가 > JSON 키 생성 → 다운로드
5. Play Console > 설정 > API 액세스 > 서비스 계정 연결
   - 권한: "재정 데이터 보기" + "통계 보기"
```

JSON 키는 **반드시 git ignore** + 클라우드 KMS 백업.

### 2-2. Node.js 모니터링 스크립트

`scripts/vitals-monitor.mjs`로 별도 작성 (cron으로 일 1회 실행 권장).

```javascript
// 의사코드 - 실 구현 시 googleapis 패키지 필요
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account.json',
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const playconsole = google.playdeveloperreporting({
  version: 'v1beta1',
  auth: await auth.getClient(),
});

const PACKAGE = 'apps/kr.go.gg.council.hwp';
const THRESHOLDS = {
  crashRate: 0.0109,  // Bad behavior 1.09%
  anrRate:   0.0047,  // Bad behavior 0.47%
};

// 최근 7일 크래시율 조회
const { data } = await playconsole.vitals.crashrate.query({
  name: PACKAGE,
  requestBody: {
    timelineSpec: {
      aggregationPeriod: 'DAILY',
      startTime: { year: 2026, month: 4, day: 23 },  // 오늘 - 7일
      endTime:   { year: 2026, month: 4, day: 30 },
    },
    metrics: ['userPerceivedCrashRate7dUserWeighted'],
  },
});

// 임계치 초과 검사 + 알림
for (const row of data.rows) {
  const ratio = row.metrics[0].decimalValue.value;
  if (ratio > THRESHOLDS.crashRate) {
    sendAlert({
      severity: 'critical',
      message: `크래시율 ${(ratio*100).toFixed(2)}% — 임계치 ${THRESHOLDS.crashRate*100}% 초과`,
      date: row.startTime,
    });
  }
}
```

### 2-3. 알림 채널 옵션

| 채널 | 장점 | 설정 난이도 |
|------|------|-----------|
| **이메일 SMTP** | 단순, 모두 받음 | 낮음 (nodemailer) |
| **Slack Webhook** | 채팅 기반, 다수 인원 | 낮음 (curl POST) |
| **공공기관 메신저** | 경기도청 내부 망 | 기관별 다름 |
| **공공기관 SMS** | 즉시성 | 정부 통합 SMS API |

### 2-4. Cron 설정 (Linux/macOS)

```cron
# /etc/cron.d/vitals-monitor
# 매일 오전 9시 모니터링
0 9 * * 1-5 wooni cd /opt/rhwp-monitoring && node scripts/vitals-monitor.mjs >> /var/log/vitals.log 2>&1
```

Windows는 작업 스케줄러:
```
schtasks /create /tn "Play Vitals Monitor" /tr "node D:\rhwp-monitoring\scripts\vitals-monitor.mjs" /sc daily /st 09:00
```

## 3. 외부 모니터링 서비스 도입 (장기)

### 3-1. Firebase Crashlytics (권장 도입 시기: v1.1.0 이후)

```
장점:
- 실시간 크래시 스택 트레이스
- 사용자 영향도 분석
- Slack/이메일 알림 통합

단점:
- 분석 SDK 추가 → 개인정보 처리방침 갱신 필요
- 데이터 안전 양식 재제출
- 사용자 옵트인 동의 화면 필요
- Google 계정으로 사용자 데이터 전송 (Firebase Analytics 의존)
```

도입 결정 시 행정안전부 정부 앱 가이드라인 검토 필수.

### 3-2. Sentry (대안)

```
장점:
- 오픈소스 / 셀프호스팅 가능 (행정안전부 보안 정책 부합)
- WebAssembly 스택 트레이스 지원
- 개인 식별 정보 자동 마스킹 옵션

단점:
- SDK 통합 작업 필요
- 셀프호스팅 시 인프라 운영 부담
```

### 3-3. 행정안전부 정부 통합 모니터링 (있는 경우)

경기도청 또는 행정안전부 운영 통합 모니터링 대시보드와 연동 가능 시 우선 권장. 별도 과제로 진행.

## 4. 권장 단계 (Phase별)

### Phase 1: 출시 직후 ~ 1개월

```
✅ Play Console 내장 이메일 알림 (즉시 활성)
✅ 일 1회 수동 Play Console Vitals 확인
❌ 외부 모니터링 도구 도입 (개인정보 영향 평가 미완료)
```

### Phase 2: 1~3개월

```
✅ Play Developer API 기반 일일 자동 폴링
✅ Slack 또는 이메일 임계치 알림
❌ 사용자 행동 분석 SDK (Firebase) 도입 보류
```

### Phase 3: 3개월 이후

```
✅ 사용자 50K+ 도달 시 Sentry/Crashlytics 도입 검토
✅ 개인정보 처리방침 갱신 + 동의 화면 추가
✅ 행정안전부 가이드라인 검토
```

## 5. 즉시 실행 가능한 체크리스트 (V1.0.0 출시 직후)

- [ ] Play Console > 이메일 환경설정 → 권장 알림 7개 활성화
- [ ] 매일 오전 9시 Vitals 확인 알람 설정 (개인 캘린더)
- [ ] 사용자 의견 답변 SLA 정의 (★1~2 24시간 / ★3 48시간)
- [ ] 단계적 출시 비율 5% → 20% → 50% → 100% 일정 캘린더 등록
- [ ] 비상 대응 연락망 정리 (정보화담당 + IT 부서장 + 작업지시자)
- [ ] **Phase 2 자동화 도입 일정** (출시 + 1개월 시점 검토)

## 6. 임계치 정의표 (참고)

본 앱 기준 권장 임계치:

| 지표 | Google Bad behavior | 본 앱 자체 알림 (조기 경보) |
|------|-------------------|--------------------------|
| 사용자 인지 크래시율 | 1.09% | **0.5%** |
| ANR률 | 0.47% | **0.2%** |
| 슬로우 콜드 스타트 | - | **5초 초과 빈도 > 5%** |
| 평균 평점 | - | **4.0 미만 시 경보** |
| 일일 신규 ★1~2 | - | **3건 초과 시 경보** |

조기 경보 임계치 도달 → 즉시 분석 + Phase 1 대응. Bad behavior 임계치 도달 → 단계적 출시 일시 중단 + 핫픽스 빌드.

## 7. 비상 연락망 (작성 필요)

| 역할 | 담당자 | 연락처 |
|------|-------|-------|
| 시스템 관리 | (작업지시자) | wooni0103@gg.go.kr |
| 정보화담당 | (담당자) | ggc.it.portal@gmail.com |
| IT 부서장 | (담당자) | (내부망) |
| 정보보안팀 | (담당자) | (내부망) |
| Google Play 정책 문의 | Google Korea | support@google.com |

위 표는 출시 전 실제 담당자로 채워야 함. 이메일 회신 SLA 합의 권장 (예: 1시간 이내 회신).
