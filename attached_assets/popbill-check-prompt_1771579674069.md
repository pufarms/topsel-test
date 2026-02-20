# 팝빌 자동 발행 스케줄러 구현 전 현황 확인 요청

## 목적
현재 Replit 프로젝트에서 팝빌 세금계산서/계산서 **자동 발행 스케줄러**를 구현하기 전,
기존 코드와 DB 상태를 확인하고 결과를 보고해 주세요.
**코드 수정이나 새로운 구현은 하지 말고, 확인과 보고만 해주세요.**

---

## 확인 항목 1: 팝빌 연동 코드 현황

아래 파일들이 존재하는지 확인하고, 존재하면 전체 코드 내용을 보여주세요.

1. `server/lib/popbill.ts` (또는 `.js`)
   - SDK 초기화 방식 (`popbill.config({...})` 형태인지)
   - `IPRestrictOnOff` 설정 여부
   - `IS_TEST` 환경변수 연동 여부

2. 팝빌 발행 API 라우트 파일 (경로 확인 후 내용 보여주세요)
   - `popbill-issue` 라우트
   - `popbill-cancel` 라우트
   - `popbill-status` 라우트

3. 기존 cron job / 스케줄러가 이미 프로젝트에 있는지 확인
   - `node-cron` 또는 `cron` 패키지 사용 여부
   - 스케줄러 관련 파일이 있으면 경로와 내용 보여주세요

---

## 확인 항목 2: DB 테이블 현황

아래 SQL을 실행해서 결과를 그대로 보여주세요.

### 2-1. invoice_records 테이블 컬럼 확인
```sql
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoice_records'
ORDER BY ordinal_position;
```

### 2-2. invoice_policies 테이블 존재 여부 확인
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'invoice_policies';
```

### 2-3. 현재 invoice_records 샘플 데이터 확인 (최근 5건)
```sql
SELECT id, target_type, target_name, invoice_type, year, month,
       supply_amount, total_amount, is_auto_issued,
       popbill_mgt_key, popbill_nts_confirm_num, popbill_issue_status,
       issued_at
FROM invoice_records
ORDER BY issued_at DESC
LIMIT 5;
```

### 2-4. 전체 테이블 목록 확인 (회계 관련 테이블 파악용)
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## 확인 항목 3: 환경변수(Secrets) 등록 현황

현재 Secrets에 아래 항목들이 등록되어 있는지 확인해주세요.
(값은 보여주지 않아도 됩니다. 등록 여부와 키 이름만 확인)

| 환경변수 키 | 등록 여부 |
|---|---|
| POPBILL_LINK_ID | ? |
| POPBILL_SECRET_KEY | ? |
| POPBILL_CORP_NUM | ? |
| POPBILL_USER_ID | ? |
| POPBILL_IS_TEST | ? (현재 값이 'true'인지 'false'인지 확인) |

---

## 확인 항목 4: package.json 의존성 확인

`package.json`에서 아래 패키지 설치 여부를 확인해주세요.

- `popbill` (팝빌 SDK)
- `node-cron` 또는 `cron` (스케줄러)

```bash
cat package.json | grep -E '"popbill|node-cron|cron"'
```

---

## 확인 항목 5: Solapi 알림 연동 현황

자동 발행 완료 후 관리자에게 알림을 보내기 위해 Solapi 연동 상태를 확인합니다.

1. Solapi 관련 파일이 있는지 확인 (경로와 파일명)
2. 현재 등록된 알림 템플릿 중 세금계산서/계산서 발행 관련 템플릿이 있는지 확인
3. 아래 Secrets가 등록되어 있는지 확인
   - `SOLAPI_API_KEY`
   - `SOLAPI_API_SECRET`

---

## 보고 형식

위 5개 항목을 순서대로 확인한 후, 아래 형식으로 보고해 주세요.

```
[확인 항목 1] 팝빌 연동 코드
- popbill.ts 존재: O/X
- SDK 초기화 방식: 정상/비정상
- 발행 라우트 존재: O/X
- 기존 cron job 존재: O/X

[확인 항목 2] DB 테이블
- invoice_records 컬럼: (SQL 결과 첨부)
- invoice_policies 테이블: 존재/미존재
- 샘플 데이터: (SQL 결과 첨부)

[확인 항목 3] 환경변수
- (등록 여부 표로 정리)
- POPBILL_IS_TEST 현재 값: true/false

[확인 항목 4] package.json
- popbill 패키지: 설치됨/미설치
- node-cron 패키지: 설치됨/미설치

[확인 항목 5] Solapi
- Solapi 파일 존재: O/X
- 세금계산서 관련 템플릿: O/X
- Solapi Secrets: 등록됨/미등록
```

확인이 완료되면 결과를 보고해 주세요. 추가 구현은 결과 확인 후 별도로 진행합니다.
