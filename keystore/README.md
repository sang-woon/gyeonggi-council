# 서명 키스토어 디렉토리

이 폴더는 **`.gitignore`로 완전 제외**됩니다. 키스토어 파일과 비밀번호는 절대 저장소에 커밋하지 마세요.

## 파일 규칙

| 파일 | 용도 | 비고 |
|------|------|------|
| `release.keystore` | 프로덕션 서명 키 | **분실/유출 시 재발급 불가능** — 클라우드 KMS 백업 필수 |
| `keystore.properties` | 빌드 시 비밀번호 주입 | 또는 환경변수 사용 가능 |
| `keystore.properties.example` | 템플릿 (커밋 OK, 실제 값 없음) | |

## 키스토어 생성 (작업지시자 / 기관 정보보안팀 작업)

### 1) 생성

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias gyeonggi-council \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype PKCS12
```

프롬프트에 입력:
- 이름/조직: `경기도의회 / Gyeonggi Council`
- 시/도: `Gyeonggi-do / Suwon`
- 국가: `KR`
- 비밀번호: **충분히 긴 랜덤 비밀번호** (16자+, 특수문자 포함)

### 2) `keystore.properties` 작성

```properties
storeFile=../../../keystore/release.keystore
storePassword=<여기에 비밀번호>
keyAlias=gyeonggi-council
keyPassword=<여기에 비밀번호>
```

또는 환경변수:
```bash
export ANDROID_KEYSTORE_PATH=../../../keystore/release.keystore
export ANDROID_STORE_PASSWORD=<...>
export ANDROID_KEY_ALIAS=gyeonggi-council
export ANDROID_KEY_PASSWORD=<...>
```

### 3) 백업 (필수!)

키스토어 분실 = **앱을 다시 발행 불가**. Play Store는 동일 키로 서명된 업데이트만 받음.

권장 백업 위치:
- 기관 정보보안팀의 클라우드 KMS (예: AWS KMS, Azure Key Vault, NCP KMS)
- 기관 정보보안팀이 관리하는 오프라인 보안 저장소
- 비밀번호는 별도 password manager에 보관 (서로 다른 위치)

### 4) Play App Signing (선택, 권장)

Play Console에서 "Play App Signing" 활성화 시:
- 업로드 키와 앱 서명 키 분리 (분실 시 업로드 키만 재발급 가능)
- `release.keystore` = "업로드 키"로 사용
- 실제 사용자에게 배포되는 서명은 Google이 관리

자세한 절차: https://support.google.com/googleplay/android-developer/answer/9842756

## 검증

```bash
# 키스토어 정보 확인
keytool -list -v -keystore release.keystore -alias gyeonggi-council

# 빌드된 AAB 서명 확인
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose app-release.aab
```

## 위험 / 운영 메모

- **개발용 keystore와 프로덕션 keystore 분리** 권장. 본 폴더는 프로덕션용.
- 비밀번호 `keystore.properties`는 절대 커밋 금지 (`.gitignore`에 등록되어 있음).
- CI/CD에서 빌드 시 환경변수로 주입 (GitHub Actions Secrets, Jenkins Credentials 등).
- 인증서 만료 (validity 10000일 = 약 27년) 전에 갱신 필요. 만료 시 새 키 등록은 Play Console에서 별도 절차.
