# 팝빌 자동 발행 스케줄러 구현 전 현황 확인 보고서

**확인일시:** 2026-02-20

---

## [확인 항목 1] 팝빌 연동 코드 현황

### 1-1. `server/lib/popbill.ts` — 존재: O

```typescript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const popbill = require('popbill');

const LinkID = process.env.POPBILL_LINK_ID || '';
const SecretKey = process.env.POPBILL_SECRET_KEY || '';
const IsTest = process.env.POPBILL_IS_TEST === 'true';

popbill.config({
  LinkID: LinkID,
  SecretKey: SecretKey,
  IsTest: IsTest,
  IPRestrictOnOff: false,
  UseStaticIP: false,
  UseLocalTimeYN: true,
});

const taxinvoiceService = popbill.TaxinvoiceService();

console.log(`[팝빌] SDK 초기화 완료 (LinkID=${LinkID ? LinkID.substring(0, 2) + '**' : '(미설정)'}, IsTest=${IsTest}, ServiceURL=${taxinvoiceService.ServiceURL || ''})`);

export { taxinvoiceService, popbill };
```

**분석:**
- SDK 초기화 방식: `popbill.config({...})` 형태 — **정상**
- `IPRestrictOnOff`: `false` 로 설정됨 (Replit 환경에 적합)
- `IS_TEST` 환경변수 연동: `process.env.POPBILL_IS_TEST === 'true'` 로 연동됨 — **정상**
- `UseLocalTimeYN`: `true` 설정됨

### 1-2. 팝빌 발행 API 라우트 — 존재: O

파일: `server/routes.ts`

| 라우트 | 경로 | 라인 |
|---|---|---|
| 팝빌 발행 | `POST /api/admin/accounting/popbill-issue` | L16990 |
| 팝빌 취소 | `POST /api/admin/accounting/popbill-cancel` | L17265 |
| 팝빌 상태조회 | `GET /api/admin/accounting/popbill-status/:mgtKey` | L17313 |

**popbill-issue 라우트 주요 로직:**
- 인증/권한 확인 (관리자만)
- 필수 파라미터 검증 (targetType, targetId, targetName, invoiceType, year, month, orderIds)
- 사업자번호 필수 확인
- 중복 발행 방지 (기존 invoice_records에서 동일 월 주문 ID 중복 검사)
- 서버 측 공급가/부가세/합계 재계산 (회원: 정산내역 기반, 매입업체: 매입 내역 기반)
- `periodStartDate`, `periodEndDate` 파라미터 지원 (최근 추가)
- 팝빌 SDK `registIssue` 호출 후 invoice_records에 결과 저장

**popbill-cancel 라우트 주요 로직:**
- 팝빌 `cancelIssue` 호출 후 invoice_records 취소 처리

**popbill-status 라우트 주요 로직:**
- 팝빌 `getPopUpURL` 호출하여 세금계산서 팝업 URL 반환

### 1-3. 기존 cron job / 스케줄러 — 존재: X

- `node-cron` 또는 `cron` 패키지: **미설치**
- 스케줄러 관련 파일: **없음**
- 기존 `setInterval` 사용 사례:
  - SSE heartbeat (30초마다, L124) — 연결 유지용
  - 뱅크다 자동 동기화 (L12772) — 입금 내역 동기화용
- 등급 자동 조정: API 엔드포인트만 존재 (`/api/admin/members/grade-adjustment/run`, L17686), 자동 스케줄러는 미구현

---

## [확인 항목 2] DB 테이블 현황

### 2-1. invoice_records 테이블 컬럼

| column_name | data_type | column_default | is_nullable |
|---|---|---|---|
| id | integer | nextval('invoice_records_id_seq'::regclass) | NO |
| target_type | character varying | | NO |
| target_id | character varying | | NO |
| target_name | character varying | | NO |
| business_number | character varying | | YES |
| invoice_type | character varying | | NO |
| year | integer | | NO |
| month | integer | | NO |
| order_ids | jsonb | '[]'::jsonb | YES |
| order_count | integer | 0 | NO |
| supply_amount | integer | 0 | NO |
| vat_amount | integer | 0 | NO |
| total_amount | integer | 0 | NO |
| is_auto_issued | boolean | false | NO |
| memo | text | | YES |
| issued_at | timestamp without time zone | now() | NO |
| issued_by | character varying | | YES |
| created_at | timestamp without time zone | now() | NO |
| original_supply_amount | integer | | YES |
| original_vat_amount | integer | | YES |
| original_total_amount | integer | | YES |
| is_manually_adjusted | boolean | false | NO |
| popbill_mgt_key | character varying | | YES |
| popbill_nts_confirm_num | character varying | | YES |
| popbill_issue_status | character varying | 'none'::character varying | YES |
| cancelled_at | timestamp without time zone | | YES |
| cancel_reason | text | | YES |
| period_start_date | character varying | | YES |
| period_end_date | character varying | | YES |

**총 28개 컬럼**

**자동 발행 관련 필드:**
- `is_auto_issued` (boolean, default: false) — 자동 발행 여부 플래그 존재하나, 현재 모두 수동 발행(false)
- `popbill_issue_status` — 'none', 'issued', 'cancelled' 상태값

### 2-2. invoice_policies 테이블 — **미존재**

```
결과: 0건 (테이블 없음)
```

### 2-3. 현재 invoice_records 샘플 데이터 (최근 5건)

| id | target_type | target_name | invoice_type | year | month | supply_amount | total_amount | is_auto_issued | popbill_mgt_key | popbill_nts_confirm_num | popbill_issue_status | issued_at |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | member | 탑셀01 | exempt | 2026 | 2 | 344,610 | 344,610 | false | 202602EX49582381 | 202602208888888800000007 | issued | 2026-02-20 01:06:24 |

**총 1건만 존재** (테스트 발행 1건)

### 2-4. 전체 테이블 목록 (회계 관련 테이블 중심)

총 64개 테이블 중 회계/정산 관련:

| 테이블명 | 용도 |
|---|---|
| `invoice_records` | 세금계산서/계산서 발행 이력 |
| `settlement_history` | 주문 정산 이력 |
| `deposit_history` | 예치금 변동 이력 |
| `pointer_history` | 포인터 변동 이력 |
| `direct_sales` | 회원 직접매출 |
| `purchases` | 매입 내역 |
| `vendor_payments` | 매입업체 결제 내역 |
| `expenses` | 경비 관리 |
| `expense_categories` | 경비 카테고리 |
| `expense_keywords` | 경비 자동분류 키워드 |
| `expense_recurring` | 고정 경비 |
| `loans` | 대출 관리 |
| `loan_repayments` | 대출 상환 |
| `bankda_transactions` | 뱅크다 입금 내역 |

**참고:** `invoice_policies` 테이블은 존재하지 않으므로, 자동 발행 스케줄러에서 정책(발행일, 대상 설정 등)을 관리하려면 신규 생성 필요

---

## [확인 항목 3] 환경변수(Secrets) 등록 현황

| 환경변수 키 | 등록 여부 | 비고 |
|---|---|---|
| POPBILL_LINK_ID | **등록됨** (Secret) | |
| POPBILL_SECRET_KEY | **등록됨** (Secret) | |
| POPBILL_CORP_NUM | **등록됨** (Secret) | |
| POPBILL_USER_ID | **등록됨** (Secret) | |
| POPBILL_IS_TEST | **등록됨** (Secret + 환경변수) | 현재 값: **`true`** (테스트 모드) |

**참고:** POPBILL_IS_TEST가 `true`로 설정되어 있어 **테스트 환경**에서 동작 중. 운영 전환 시 `false`로 변경 필요.

---

## [확인 항목 4] package.json 의존성 확인

| 패키지 | 설치 여부 | 버전 |
|---|---|---|
| `popbill` | **설치됨** | ^1.63.0 |
| `node-cron` | **미설치** | - |
| `cron` | **미설치** | - |

**참고:** 스케줄러 구현 시 `node-cron` 패키지 설치 필요하거나, 기존 `setInterval` 방식(뱅크다 동기화에서 사용 중) 활용 가능

---

## [확인 항목 5] Solapi 알림 연동 현황

### 5-1. Solapi 관련 파일 — 존재: O

| 파일 경로 | 설명 |
|---|---|
| `server/services/solapi.ts` | Solapi SDK 기반 알림톡/브랜드톡/SMS 발송 서비스 (593줄) |

**주요 기능:**
- `sendAlimTalk()` — 알림톡 단일 발송
- `sendAlimtalkBulk()` — 알림톡 대량 발송
- `sendBrandtalk()` — 브랜드톡 발송 (SDK)
- `sendBrandTalkDirect()` — 브랜드톡 직접 발송 (REST API)
- `sendSMS()` — SMS 발송
- `getTemplateDetail()` — 알림톡 템플릿 상세 조회
- `getBrandTemplates()` — 브랜드 템플릿 목록 조회

### 5-2. 세금계산서/계산서 발행 관련 알림 템플릿 — **X (없음)**

- `alimtalk_templates` DB 테이블: **데이터 0건** (기존 18개 템플릿 전체 삭제 후 재심사 대기 중)
- `server/services/solapi.ts` 코드 내 세금계산서/계산서/invoice 관련 로직: **없음**
- 알림톡 관리 페이지(`client/src/pages/admin/kakao-notifications/`)에도 세금계산서 관련 템플릿: **없음**

### 5-3. Solapi Secrets 등록 현황

| 환경변수 키 | 등록 여부 |
|---|---|
| SOLAPI_API_KEY | **등록됨** (Secret) |
| SOLAPI_API_SECRET | **등록됨** (Secret) |

**참고:** SOLAPI_SENDER, KAKAO_PFID 환경변수도 사용 중 (solapi.ts에서 참조)

---

## 종합 요약

```
[확인 항목 1] 팝빌 연동 코드
- popbill.ts 존재: O
- SDK 초기화 방식: 정상 (popbill.config, IPRestrictOnOff=false)
- 발행 라우트 존재: O (issue/cancel/status 3개)
- 기존 cron job 존재: X (setInterval만 뱅크다용으로 사용 중)

[확인 항목 2] DB 테이블
- invoice_records 컬럼: 28개 (is_auto_issued 필드 존재, period 필드 최근 추가)
- invoice_policies 테이블: 미존재 (신규 생성 필요)
- 샘플 데이터: 1건 (테스트 발행, exempt, 탑셀01)

[확인 항목 3] 환경변수
- POPBILL_LINK_ID: 등록됨
- POPBILL_SECRET_KEY: 등록됨
- POPBILL_CORP_NUM: 등록됨
- POPBILL_USER_ID: 등록됨
- POPBILL_IS_TEST 현재 값: true (테스트 모드)

[확인 항목 4] package.json
- popbill 패키지: 설치됨 (^1.63.0)
- node-cron 패키지: 미설치

[확인 항목 5] Solapi
- Solapi 파일 존재: O (server/services/solapi.ts)
- 세금계산서 관련 템플릿: X (전체 삭제 후 재심사 대기 중)
- Solapi Secrets: 등록됨 (API_KEY, API_SECRET)
```

---

## 자동 발행 스케줄러 구현 시 필요 사항 (참고)

1. **스케줄러 패키지**: `node-cron` 설치 필요 또는 `setInterval` 방식 활용
2. **invoice_policies 테이블**: 자동 발행 정책 관리용 테이블 신규 생성 필요
3. **알림 템플릿**: 세금계산서 발행 완료 알림용 알림톡 템플릿 등록 필요 (솔라피 심사 대기 중)
4. **테스트 → 운영 전환**: `POPBILL_IS_TEST`를 `false`로 변경 필요
5. **기존 popbill-issue 로직 재사용**: 현재 수동 발행 API의 금액 계산/발행 로직을 스케줄러에서 호출 가능하도록 서비스 레이어 분리 검토
