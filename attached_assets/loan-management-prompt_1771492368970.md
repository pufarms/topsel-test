# 비용관리 — 대출 관리 기능 추가

## ⚠️ 최우선 원칙

1. **⛔ 기존 CSS, 글씨체, 폰트, 전역 스타일을 절대 수정하거나 새로 추가하지 마세요.**
2. **기존 비용관리 기능(자동완성, 정기비용, 차트, 분류 사전 관리 등)을 깨뜨리지 마세요.**
3. **기존 기술 스택(React + TanStack Query + shadcn/ui + Drizzle ORM)을 그대로 유지하세요.**
4. 작업은 단계별로 진행하고, 각 단계 완료 후 정상 동작을 확인한 뒤 다음 단계로 넘어가세요.
5. 작업 진행 상황과 결과는 항상 **한글**로 보여주세요.

---

## 📋 작업 개요

비용관리 탭에 **대출 관리** 기능을 추가합니다.

사업자 대출의 원리금 상환 시, 이자는 비용(금융비용)이고 원금 상환은 비용이 아닌 부채 감소입니다.
이 둘을 정확히 분리해야 손익분석에서 올바른 결과가 나옵니다.

```
월 상환액 1,000,000원
├─ 이자:  250,000원 → 비용 (금융비용/이자비용) → 손익에 반영
└─ 원금:  750,000원 → 부채 상환 (비용 아님) → 현금흐름에 반영
```

**핵심 기능:**
- 대출 등록 (금융기관, 대출금액, 이율, 기간, 상환방식)
- 월별 상환 등록 (원금/이자 자동 분리 또는 수동 입력)
- 대출 잔액 실시간 추적
- 이자는 비용(expenses)에 자동 등록
- 손익분석 연동 준비 (실제 가용 현금 = 영업이익 - 원금상환)

---

## 1단계: 데이터베이스 스키마

### 1-1. loans 테이블 (대출 정보)

```sql
CREATE TABLE loans (
  id SERIAL PRIMARY KEY,
  loan_name VARCHAR(200) NOT NULL,             -- 대출명 (예: "기업은행 운영자금")
  bank_name VARCHAR(100) NOT NULL,             -- 금융기관명
  loan_type VARCHAR(30) DEFAULT 'term',        -- 대출 유형: term(기간대출), credit(신용대출), mortgage(담보대출)
  loan_amount DECIMAL(14,0) NOT NULL,          -- 대출 원금 (총액)
  annual_rate DECIMAL(5,2) NOT NULL,           -- 연이율 (%, 예: 4.50)
  loan_start_date DATE NOT NULL,               -- 대출 시작일
  loan_end_date DATE,                          -- 대출 만기일
  loan_term_months INTEGER,                    -- 대출 기간 (개월)
  repayment_type VARCHAR(30) DEFAULT 'equal_payment', -- 상환방식
    -- equal_payment: 원리금균등상환 (매월 동일 금액)
    -- equal_principal: 원금균등상환 (원금 동일, 이자 감소)
    -- interest_only: 만기일시상환 (매월 이자만, 만기에 원금)
    -- custom: 자유상환 (매월 직접 입력)
  monthly_payment DECIMAL(14,0),               -- 월 상환액 (자동 계산 또는 직접 입력)
  repayment_day INTEGER DEFAULT 1,             -- 매월 상환일 (1~28)
  remaining_balance DECIMAL(14,0),             -- 현재 잔액 (상환할 때마다 갱신)
  status VARCHAR(20) DEFAULT 'active',         -- active(상환중), completed(완납), closed(조기상환)
  memo TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_loans_status ON loans(status);
```

### 1-2. loan_repayments 테이블 (상환 내역)

```sql
CREATE TABLE loan_repayments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  repayment_date DATE NOT NULL,                -- 상환일
  total_amount DECIMAL(14,0) NOT NULL,         -- 총 상환액
  principal_amount DECIMAL(14,0) NOT NULL,     -- 원금 상환분
  interest_amount DECIMAL(14,0) NOT NULL,      -- 이자분
  remaining_after DECIMAL(14,0) NOT NULL,      -- 상환 후 잔액
  expense_id INTEGER,                          -- 연결된 비용(expenses) ID (이자 비용 자동 등록)
  is_extra_payment BOOLEAN DEFAULT false,      -- 추가 상환 여부 (중도상환 등)
  memo TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_loan_repayments_loan ON loan_repayments(loan_id);
CREATE INDEX idx_loan_repayments_date ON loan_repayments(repayment_date);
```

### 1-3. 금융비용 세부항목 확인 및 추가

대출 이자가 자동 등록될 때 사용할 세부항목이 필요합니다. 
현재 금융비용(🏦) 대분류 아래 세부항목을 확인하고, 없으면 추가하세요.

**필요한 세부항목:**

| 세부항목명 | 용도 | is_system |
|-----------|------|-----------|
| 이자비용 | 대출 이자 자동 등록 시 사용 | true |
| 원금상환 | 원금 상환 추적용 (비용은 아니지만 현금흐름 참고) | true |
| 카드수수료 | 카드 결제 수수료 | true |
| PG수수료 | 온라인 결제 수수료 | true |
| 은행수수료 | 이체/송금 수수료 | true |

```sql
-- 금융비용 대분류의 ID를 조회
SELECT id FROM expense_categories WHERE name = '금융비용';

-- 해당 ID로 세부항목 확인 후, 없는 것만 추가
-- (이미 있는 세부항목은 스킵)
INSERT INTO expense_sub_categories (category_id, name, is_system)
SELECT id, '이자비용', true FROM expense_categories WHERE name = '금융비용'
ON CONFLICT DO NOTHING;

INSERT INTO expense_sub_categories (category_id, name, is_system)
SELECT id, '원금상환', true FROM expense_categories WHERE name = '금융비용'
ON CONFLICT DO NOTHING;

INSERT INTO expense_sub_categories (category_id, name, is_system)
SELECT id, '카드수수료', true FROM expense_categories WHERE name = '금융비용'
ON CONFLICT DO NOTHING;

INSERT INTO expense_sub_categories (category_id, name, is_system)
SELECT id, 'PG수수료', true FROM expense_categories WHERE name = '금융비용'
ON CONFLICT DO NOTHING;

INSERT INTO expense_sub_categories (category_id, name, is_system)
SELECT id, '은행수수료', true FROM expense_categories WHERE name = '금융비용'
ON CONFLICT DO NOTHING;
```

> ⚠️ 위 SQL에서 ON CONFLICT가 동작하려면 unique constraint가 필요할 수 있습니다.
> constraint가 없다면 INSERT 전에 SELECT로 존재 여부를 먼저 확인하세요.

**키워드 사전에도 추가:**

```sql
-- 대출 관련 키워드 추가 (금융비용 카테고리)
INSERT INTO expense_keywords (keyword, category_id, sub_category_id, match_type, priority, source)
SELECT '대출이자', c.id, s.id, 'contains', 50, 'system'
FROM expense_categories c
JOIN expense_sub_categories s ON s.category_id = c.id AND s.name = '이자비용'
WHERE c.name = '금융비용';

INSERT INTO expense_keywords (keyword, category_id, sub_category_id, match_type, priority, source)
SELECT '은행이자', c.id, s.id, 'contains', 50, 'system'
FROM expense_categories c
JOIN expense_sub_categories s ON s.category_id = c.id AND s.name = '이자비용'
WHERE c.name = '금융비용';

INSERT INTO expense_keywords (keyword, category_id, sub_category_id, match_type, priority, source)
SELECT '원리금', c.id, s.id, 'contains', 30, 'system'
FROM expense_categories c
JOIN expense_sub_categories s ON s.category_id = c.id AND s.name = '이자비용'
WHERE c.name = '금융비용';
```

### 1-4. Zod 스키마 업데이트

`shared/schema.ts`에 위 2개 테이블의 Drizzle 스키마, Zod 검증 스키마, TypeScript 타입을 추가하세요.

---

## 2단계: API 엔드포인트

### 2-1. 대출 관리 API

```
GET /api/admin/accounting/loans
```
- 응답: 대출 목록 (활성 → 완납 순)
- 각 대출에 `totalRepaid`(총 상환 원금), `totalInterestPaid`(총 지급 이자), `repaymentCount`(상환 횟수) 포함

```
POST /api/admin/accounting/loans
```
- 요청:
```json
{
  "loan_name": "기업은행 운영자금",
  "bank_name": "기업은행",
  "loan_type": "term",
  "loan_amount": 30000000,
  "annual_rate": 4.50,
  "loan_start_date": "2025-06-01",
  "loan_end_date": "2028-05-31",
  "loan_term_months": 36,
  "repayment_type": "equal_payment",
  "repayment_day": 5,
  "memo": ""
}
```
- 동작:
  1. 대출 정보 저장
  2. remaining_balance = loan_amount (초기 잔액 = 대출 원금)
  3. repayment_type에 따라 monthly_payment 자동 계산:
     - **원리금균등**: `M = P × r(1+r)^n / ((1+r)^n - 1)` (P=원금, r=월이율, n=개월수)
     - **원금균등**: 첫 달 기준 `원금/n + 잔액×월이율`
     - **만기일시**: `대출원금 × 월이율` (이자만)
     - **자유상환**: 관리자가 직접 입력한 monthly_payment 사용

```
PUT /api/admin/accounting/loans/:id
```
- 대출 정보 수정 (이율 변경, 메모 등)
- 이미 상환 내역이 있으면 대출 원금은 수정 불가

```
DELETE /api/admin/accounting/loans/:id
```
- 상환 내역이 있으면 삭제 불가 (400 에러: "상환 내역이 있는 대출은 삭제할 수 없습니다")
- 상환 내역이 없으면 삭제 가능

```
PATCH /api/admin/accounting/loans/:id/close
```
- 대출 조기 상환/종결 처리
- status → "closed" 또는 "completed"
- remaining_balance → 0 (완납 시)

### 2-2. 상환 내역 API

```
GET /api/admin/accounting/loans/:id/repayments
```
- 특정 대출의 상환 내역 (날짜순)

```
POST /api/admin/accounting/loans/:id/repayments
```
- 요청:
```json
{
  "repayment_date": "2026-02-05",
  "total_amount": 1000000,
  "principal_amount": 750000,
  "interest_amount": 250000,
  "is_extra_payment": false,
  "memo": ""
}
```
- **동작 (핵심):**
  1. loan_repayments에 상환 내역 추가
  2. remaining_after = 현재 remaining_balance - principal_amount
  3. loans.remaining_balance 갱신 (remaining_after 값으로)
  4. **이자를 expenses에 자동 등록:**
     - expense_date = repayment_date
     - item_name = "{대출명} 이자" (예: "기업은행 운영자금 이자")
     - categoryId = 금융비용의 ID
     - subCategoryId = 이자비용의 ID
     - amount = interest_amount
     - tax_type = "exempt" (이자는 면세)
     - payment_method = "계좌이체"
     - memo = "대출 상환 자동 등록"
  5. expense_id에 생성된 비용 ID 저장 (연결)
  6. remaining_balance가 0 이하가 되면 loans.status → "completed"

```
DELETE /api/admin/accounting/loans/:id/repayments/:repaymentId
```
- 상환 내역 삭제
- 동작:
  1. 해당 상환의 principal_amount를 loans.remaining_balance에 다시 더함
  2. 연결된 expense_id가 있으면 해당 비용(expenses)도 함께 삭제
  3. 상환 레코드 삭제
  4. 삭제 후 남은 상환 내역의 remaining_after 값을 재계산

### 2-3. 원금/이자 자동 계산 API

```
POST /api/admin/accounting/loans/:id/calculate
```
- 요청: `{ repayment_date: "2026-02-05" }` (선택, 기본값 오늘)
- 동작: 해당 대출의 상환방식에 따라 이번 달 원금/이자 자동 계산
- 응답:
```json
{
  "total_amount": 1000000,
  "principal_amount": 750000,
  "interest_amount": 250000,
  "remaining_after": 24250000,
  "calculation_method": "원리금균등상환"
}
```

**계산 로직:**

```
원리금균등상환:
  월이율 r = 연이율 / 12 / 100
  이자 = 현재잔액 × r
  원금 = 월상환액 - 이자
  (월상환액은 대출 등록 시 계산된 고정값)

원금균등상환:
  원금 = 대출원금 / 총개월수 (고정)
  이자 = 현재잔액 × 월이율
  합계 = 원금 + 이자 (매월 감소)

만기일시상환:
  원금 = 0 (만기까지 0)
  이자 = 대출원금 × 월이율
  합계 = 이자

자유상환:
  자동 계산 불가 → 이자만 계산: 현재잔액 × 월이율
  원금은 관리자가 직접 입력
```

### 2-4. 대출 요약 API (손익분석 연동용)

```
GET /api/admin/accounting/loans/summary?month=2026-02
```
- 응답:
```json
{
  "activeLoans": 2,
  "totalRemainingBalance": 45000000,
  "monthlyRepayment": {
    "total": 1500000,
    "principal": 1100000,
    "interest": 400000
  },
  "loans": [
    {
      "id": 1,
      "loan_name": "기업은행 운영자금",
      "bank_name": "기업은행",
      "remaining_balance": 24250000,
      "monthly_principal": 750000,
      "monthly_interest": 250000,
      "progress_percent": 19.2
    },
    {
      "id": 2,
      "loan_name": "농협 시설자금",
      "bank_name": "농협",
      "remaining_balance": 20750000,
      "monthly_principal": 350000,
      "monthly_interest": 150000,
      "progress_percent": 17.0
    }
  ]
}
```

이 API는 나중에 손익분석 탭에서 호출합니다:
```
영업이익 1,750,000원 - 원금상환 1,100,000원 = 실제 가용 현금 650,000원
```

---

## 3단계: 프론트엔드 UI

> ⚠️ 기존 비용관리 UI를 수정하지 말고, 새로운 영역을 추가하세요.

### 3-1. 대출 관리 버튼 추가

비용관리 탭 상단 버튼 영역에 **"🏦 대출관리"** 버튼을 추가합니다.

```
기존: [💰간편등록] [📊스프레드시트] [📥엑셀업로드] [🔄정기비용] [⚙️분류사전]
변경: [💰간편등록] [📊스프레드시트] [📥엑셀업로드] [🔄정기비용] [🏦대출관리] [⚙️분류사전]
```

### 3-2. 대출 관리 다이얼로그

"🏦 대출관리" 클릭 시 큰 다이얼로그 (Dialog 또는 Sheet):

```
┌──────────────────────────────────────────────────────────────────┐
│  🏦 대출 관리                                               [✕]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  [대출 현황 요약 카드]                                              │
│  활성 대출 2건 | 총 잔액 45,000,000원 | 이달 상환 1,500,000원       │
│                                                                    │
│  [대출 목록 테이블]                                                 │
│  ┌──────────┬──────┬──────────┬──────┬────────┬──────┬──────┐   │
│  │ 대출명     │ 금융기관│ 대출금액  │ 이율  │ 잔액     │ 상환방식│ 액션 │   │
│  ├──────────┼──────┼──────────┼──────┼────────┼──────┼──────┤   │
│  │기업은행    │기업은행│30,000,000│4.50% │24,250K │원리금균등│▶✏️🗑│   │
│  │ ▌████░░░░░░░░░░░ 19.2% 상환                              │   │
│  ├──────────┼──────┼──────────┼──────┼────────┼──────┼──────┤   │
│  │농협 시설  │ 농협  │25,000,000│3.80% │20,750K │원금균등 │▶✏️🗑│   │
│  │ ▌████░░░░░░░░░░░ 17.0% 상환                              │   │
│  └──────────┴──────┴──────────┴──────┴────────┴──────┴──────┘   │
│                                                                    │
│  [+ 대출 등록]                                                     │
│                                                                    │
│  ══════════════════════════════════════════════════════════════   │
│                                                                    │
│  (대출 행의 ▶ 클릭 시 아래에 상환 내역 펼침)                         │
│                                                                    │
│  ── 기업은행 운영자금 상환 내역 ──                                   │
│                                                                    │
│  ┌──────────┬────────┬────────┬────────┬────────┬──────┐        │
│  │ 상환일     │ 총 상환액│ 원금    │ 이자    │ 상환후잔액│ 액션  │        │
│  ├──────────┼────────┼────────┼────────┼────────┼──────┤        │
│  │ 2026-02-05│1,000,000│ 750,000│ 250,000│24,250K │  🗑  │        │
│  │ 2026-01-05│1,000,000│ 742,000│ 258,000│25,000K │  🗑  │        │
│  │ 2025-12-05│1,000,000│ 735,000│ 265,000│25,742K │  🗑  │        │
│  │ ...       │         │        │        │        │      │        │
│  └──────────┴────────┴────────┴────────┴────────┴──────┘        │
│                                                                    │
│  [+ 상환 등록]  [+ 추가 상환(중도상환)]                               │
└──────────────────────────────────────────────────────────────────┘
```

### 3-3. 대출 등록 다이얼로그

```
┌────────────────────────────────────────────┐
│  대출 등록                                   │
├────────────────────────────────────────────┤
│                                              │
│  대출명: [기업은행 운영자금_______]            │
│                                              │
│  금융기관: [기업은행______________]            │
│                                              │
│  대출 유형: [기간대출 ▼]                      │
│  (기간대출 / 신용대출 / 담보대출)              │
│                                              │
│  대출 금액: [30,000,000] 원                  │
│                                              │
│  연이율: [4.50] %                            │
│                                              │
│  대출 시작일: [2025-06-01]                    │
│  대출 만기일: [2028-05-31]                    │
│  대출 기간:   36개월 ← 자동 계산              │
│                                              │
│  상환 방식: [원리금균등상환 ▼]                 │
│  ┌──────────────────────────────────┐      │
│  │ ◉ 원리금균등 — 매월 동일 금액 상환  │      │
│  │ ○ 원금균등 — 원금 동일, 이자 감소   │      │
│  │ ○ 만기일시 — 매월 이자만, 만기 원금  │      │
│  │ ○ 자유상환 — 매월 직접 입력         │      │
│  └──────────────────────────────────┘      │
│                                              │
│  매월 상환일: [5] 일                          │
│                                              │
│  ── 자동 계산 결과 ──                         │
│  월 상환액: 약 893,000원                      │
│  총 이자: 약 2,148,000원                      │
│  총 상환액: 약 32,148,000원                   │
│                                              │
│  메모: [________________________________]    │
│                                              │
│                [취소]  [등록]                  │
└────────────────────────────────────────────┘
```

**자동 계산:**
- 대출금액, 이율, 기간을 입력하면 실시간으로 월 상환액, 총 이자, 총 상환액이 계산되어 표시
- 상환 방식 변경 시 재계산

### 3-4. 상환 등록 다이얼로그

```
┌────────────────────────────────────────────┐
│  상환 등록 — 기업은행 운영자금                 │
├────────────────────────────────────────────┤
│                                              │
│  현재 잔액: 25,000,000원                      │
│                                              │
│  상환일: [2026-02-05]                         │
│                                              │
│  [자동 계산] [직접 입력] ← 모드 토글           │
│                                              │
│  ── 자동 계산 모드 ──                         │
│  총 상환액:  1,000,000원                      │
│  ├─ 원금:    750,000원                       │
│  └─ 이자:    250,000원                       │
│  상환 후 잔액: 24,250,000원                   │
│  (상환 방식: 원리금균등상환 기준)               │
│                                              │
│  ── 또는 직접 입력 모드 ──                    │
│  총 상환액: [1,000,000] 원                    │
│  원금:      [750,000] 원                     │
│  이자:      [250,000] 원  ← 총액-원금 자동계산 │
│  상환 후 잔액: 24,250,000원 ← 자동 계산       │
│                                              │
│  ☐ 추가 상환 (중도상환)                       │
│                                              │
│  메모: [________________________________]    │
│                                              │
│  ℹ️ 이자 250,000원은 비용(금융비용/이자비용)에  │
│     자동으로 등록됩니다.                       │
│                                              │
│                [취소]  [상환 등록]              │
└────────────────────────────────────────────┘
```

**동작:**
- "자동 계산" 모드: calculate API를 호출하여 원금/이자 자동 분리 → 관리자는 확인만 하고 등록
- "직접 입력" 모드: 총 상환액과 원금을 직접 입력 → 이자는 자동 계산 (총액 - 원금)
- 추가 상환 체크: 정기 상환 외 추가 원금 상환 (is_extra_payment = true)
- 하단 안내: "이자 OOO원은 비용에 자동 등록됩니다" 표시

### 3-5. 대출 현황 요약 카드

대출 관리 다이얼로그 상단에 요약 카드:

```
[활성 대출 2건] [총 잔액 45,000,000원] [이달 상환 1,500,000원] [이달 이자 400,000원]
```

- 이달 상환/이자: 해당 월의 상환 내역 합계
- 상환 예정이 있는데 아직 등록하지 않았으면 "미상환" 배지 표시

### 3-6. 진행률 바

각 대출 행 하단에 진행률 바:
- 상환된 비율 = (대출원금 - 잔액) / 대출원금 × 100
- 색상: 초록 (진행률), 회색 (남은 부분)
- 예: `▌████████░░░░░░░ 19.2% 상환`

### 3-7. 정기 비용 연동

대출 등록 시, 해당 대출의 이자를 정기 비용(expense_recurring)으로 자동 등록하는 **옵션**을 제공합니다.

```
☐ 이자를 정기 비용으로 자동 등록
  → 매월 [5]일에 금융비용/이자비용으로 자동 생성
  → 금액: 약 250,000원 (첫 달 기준, 매월 재계산 필요)
```

이 옵션을 선택하면:
- expense_recurring에 정기 비용 추가 (item_name: "{대출명} 이자", categoryId: 금융비용)
- 단, 상환 등록 시 이자가 expenses에 자동 등록되므로 **중복 주의**
- 권장: 상환 등록을 통해 이자를 등록하는 방식 사용 (정기비용은 사용하지 않음)
- UI에 안내 문구: "상환 등록 시 이자가 자동으로 비용에 등록되므로, 정기 비용은 별도로 등록하지 않아도 됩니다."

---

## 4단계: 비용관리 비용 내역 테이블 연동

### 4-1. 대출 이자 자동 등록 건 표시

expenses 테이블에 대출 상환으로 자동 등록된 이자 비용은 비용 내역 테이블에서 구분 표시합니다:

- 항목명 옆에 "🏦" 아이콘 표시 (대출 자동 등록 건)
- 이 비용을 직접 수정/삭제하면 경고: "이 비용은 대출 상환에서 자동 등록되었습니다. 삭제하면 상환 내역과 불일치가 발생할 수 있습니다."

### 4-2. 비용 등록 시 대출 이자 중복 방지

비용 간편 등록 또는 스프레드시트에서 직접 대출 이자를 등록하려 할 때:
- 키워드 자동완성에서 "OO은행 이자" 등을 입력하면, 해당 대출의 상환 등록을 통해 등록하도록 안내
- 강제 차단은 하지 않음 (관리자 재량)

---

## 5단계: 손익분석 연동 준비

대출 관리가 완성되면, 향후 손익분석 탭에서 아래와 같이 활용됩니다:

```
매출총이익    = 매출 - 매입
영업이익      = 매출총이익 - 비용 (이자 포함)
──────────────────────────
실제 가용 현금 = 영업이익 - 원금상환
──────────────────────────
대출 현황      잔액 합계, 월 상환 예정액
```

**필요한 API (이미 구현됨):**
- `GET /api/admin/accounting/loans/summary?month=YYYY-MM`
  - totalRemainingBalance (총 대출 잔액)
  - monthlyRepayment.principal (이달 원금 상환)
  - monthlyRepayment.interest (이달 이자 — expenses에도 있음)

---

## 검증 체크리스트

### DB
1. ✅ loans 테이블이 생성되었는가?
2. ✅ loan_repayments 테이블이 생성되었는가?

### 대출 관리
3. ✅ 대출 등록 시 상환방식에 따라 월 상환액이 자동 계산되는가?
4. ✅ 대출 금액/이율/기간 변경 시 실시간 재계산되는가?
5. ✅ 대출 목록에 잔액, 진행률 바가 표시되는가?
6. ✅ 대출 수정/삭제가 동작하는가? (상환 있으면 삭제 불가)

### 상환 관리
7. ✅ 자동 계산 모드에서 원금/이자가 올바르게 분리되는가?
8. ✅ 직접 입력 모드에서 총액-원금=이자 자동 계산이 되는가?
9. ✅ 상환 등록 시 loans.remaining_balance가 정확히 갱신되는가?
10. ✅ **상환 등록 시 이자가 expenses에 자동 등록되는가?** (핵심!)
11. ✅ 자동 등록된 비용의 분류가 금융비용/이자비용인가?
12. ✅ 상환 삭제 시 잔액 복구 + 연결된 비용 삭제가 동작하는가?
13. ✅ 잔액이 0이 되면 status가 completed로 변경되는가?
14. ✅ 추가 상환(중도상환)이 정상 동작하는가?

### UI
15. ✅ 대출 관리 다이얼로그가 정상 표시되는가?
16. ✅ 대출 행 클릭 시 상환 내역이 펼쳐지는가?
17. ✅ 진행률 바가 정확한 비율로 표시되는가?
18. ✅ 요약 카드(활성 대출, 총 잔액, 이달 상환)가 표시되는가?

### 연동
19. ✅ 비용 내역에 대출 이자 자동 등록 건이 🏦 표시로 구분되는가?
20. ✅ loans/summary API가 정상 응답하는가? (손익분석 연동 준비)

### 기존 기능 보존
21. ✅ 기존 비용관리 기능(자동완성, 정기비용, 차트 등)이 정상인가?
22. ✅ **기존 CSS, 글씨체가 변경 없이 유지되는가?**

결과를 한글로 보고해 주세요.
