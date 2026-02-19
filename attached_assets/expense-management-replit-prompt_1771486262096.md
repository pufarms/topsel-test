# 회계장부 — 비용관리 탭 추가

## ⚠️ 최우선 원칙

1. **⛔ 기존 CSS, 글씨체, 폰트, 전역 스타일을 절대 수정하거나 새로 추가하지 마세요.** 현재 프로젝트에 설정된 Tailwind 설정, CSS 파일, 글씨체(font-family)를 100% 그대로 사용해야 합니다.
2. **기존 회계장부의 다른 탭(회원정산, 공급업체, 매입관리, 매출현황)의 기능과 코드를 절대 수정하지 마세요.** 새로운 "비용관리" 탭만 추가합니다.
3. **기존 인증 방식(세션 기반), 라우팅 구조, 기술 스택(React + TanStack Query + shadcn/ui + Drizzle ORM)을 그대로 유지하세요.**
4. **함께 첨부된 예시 파일은 디자인 방향을 보여주는 참고용입니다. 똑같이 만들 필요 없습니다.** 기존 프로젝트의 컴포넌트 구조와 코드 스타일을 유지하세요.
5. 작업은 단계별로 진행하고, 각 단계 완료 후 정상 동작을 확인한 뒤 다음 단계로 넘어가세요.
6. 작업 진행 상황과 결과는 항상 **한글**로 보여주세요.

> **🚫 절대 하지 말아야 할 것:**
> - 새로운 폰트(Google Fonts 등) 추가
> - 새로운 CSS 파일 생성
> - 기존 globals.css, tailwind.config 등 전역 설정 수정
> - 기존 회계장부 탭들(회원정산, 공급업체, 매입관리, 매출현황) 수정
>
> **✅ 반드시 지켜야 할 것:**
> - 현재 프로젝트의 기존 CSS, 폰트, Tailwind 설정을 그대로 사용
> - 기존 shadcn/ui 컴포넌트(Card, Badge, Button, Dialog, Select, Input, Textarea, Table 등) 활용
> - 기존 회계장부 탭들과 동일한 UI 스타일, 코드 패턴 유지

---

## 📋 작업 개요

현재 회계장부의 탭에 **"비용관리"** 탭을 새로 추가합니다.

```
회계장부 탭 구성:
[회원정산] [공급업체] [매입관리] [매출현황] [비용관리] ← 신규 추가
```

비용관리는 사업 운영에 필요한 경비(물류비, 인건비, 임대료, 광고비 등)를 관리합니다.
매입(상품 원가)과는 다르게, 비용은 사업 운영 경비입니다.

**핵심 기능:**
- 항목명 자동완성(Autocomplete) + 자동 분류
- 간편 등록 / 스프레드시트 일괄 등록 / 엑셀 업로드
- 정기 비용 자동 생성 (매월 고정비)
- 월간 비용 요약 + 분류별 차트

---

## 1단계: 데이터베이스 스키마

### 1-1. expenses 테이블 (비용 내역)

```sql
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  expense_date DATE NOT NULL,                    -- 비용 발생일
  item_name VARCHAR(200) NOT NULL,               -- 항목명 (예: "롯데택배 2월 정산")
  category VARCHAR(50) NOT NULL,                 -- 대분류 (자동 분류됨)
  sub_category VARCHAR(100),                     -- 세부 항목 (선택)
  amount DECIMAL(14,0) NOT NULL,                 -- 금액
  tax_type VARCHAR(10) DEFAULT 'taxable',        -- 과세 구분: taxable(과세) / exempt(면세)
  supply_amount DECIMAL(14,0),                   -- 공급가액 (과세: amount/1.1, 면세: amount)
  vat_amount DECIMAL(14,0),                      -- 부가세 (과세: amount-supply_amount, 면세: 0)
  payment_method VARCHAR(20) DEFAULT '계좌이체',  -- 결제방법
  vendor_name VARCHAR(100),                      -- 거래처명 (선택)
  memo TEXT,                                     -- 메모
  receipt_url TEXT,                               -- 증빙 파일 URL
  is_recurring BOOLEAN DEFAULT false,            -- 정기 비용 여부
  recurring_id INTEGER,                          -- 정기 비용 원본 ID (자동 생성된 건)
  created_by VARCHAR(100),                       -- 등록자
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_item ON expenses(item_name);
```

### 1-2. expense_keywords 테이블 (자동 분류 사전)

```sql
CREATE TABLE expense_keywords (
  id SERIAL PRIMARY KEY,
  keyword VARCHAR(100) NOT NULL,          -- 매칭 키워드 (예: "택배", "롯데택배")
  category VARCHAR(50) NOT NULL,          -- 자동 분류될 대분류
  sub_category VARCHAR(100),              -- 세부 항목
  match_type VARCHAR(10) DEFAULT 'contains', -- 매칭 방식: exact(완전일치) / contains(포함)
  priority INTEGER DEFAULT 10,            -- 우선순위 (높을수록 우선, 거래처명=100, 키워드=10)
  source VARCHAR(10) DEFAULT 'system',    -- 출처: system(기본) / admin(관리자 추가) / learned(학습)
  use_count INTEGER DEFAULT 0,            -- 사용 횟수 (자주 쓰는 항목 상위 노출)
  last_amount DECIMAL(14,0),              -- 마지막 등록 금액 (참고용)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_expense_keywords_keyword ON expense_keywords(keyword);
CREATE INDEX idx_expense_keywords_priority ON expense_keywords(priority DESC);
```

### 1-3. expense_recurring 테이블 (정기 비용 설정)

```sql
CREATE TABLE expense_recurring (
  id SERIAL PRIMARY KEY,
  item_name VARCHAR(200) NOT NULL,         -- 항목명
  category VARCHAR(50) NOT NULL,           -- 대분류
  sub_category VARCHAR(100),               -- 세부 항목
  amount DECIMAL(14,0) NOT NULL,           -- 고정 금액
  tax_type VARCHAR(10) DEFAULT 'taxable',  -- 과세 구분
  payment_method VARCHAR(20) DEFAULT '계좌이체',
  vendor_name VARCHAR(100),                -- 거래처명
  day_of_month INTEGER DEFAULT 1,          -- 매월 생성일 (1~28)
  cycle VARCHAR(10) DEFAULT 'monthly',     -- 주기: monthly(매월) / yearly(매년)
  cycle_month INTEGER,                     -- 매년인 경우 발생 월 (1~12)
  is_active BOOLEAN DEFAULT true,          -- 활성 여부
  memo TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 1-4. 초기 키워드 사전 데이터 (시드)

시스템 기본 키워드를 미리 등록합니다. 아래 데이터를 expense_keywords 테이블에 INSERT 하세요.

```sql
-- 물류/배송비
INSERT INTO expense_keywords (keyword, category, sub_category, match_type, priority, source) VALUES
('택배', '물류/배송비', '택배비', 'contains', 10, 'system'),
('롯데택배', '물류/배송비', '택배비', 'contains', 50, 'system'),
('우체국택배', '물류/배송비', '택배비', 'contains', 50, 'system'),
('CJ대한통운', '물류/배송비', '택배비', 'contains', 50, 'system'),
('한진택배', '물류/배송비', '택배비', 'contains', 50, 'system'),
('화물', '물류/배송비', '화물운송비', 'contains', 10, 'system'),
('운송', '물류/배송비', '화물운송비', 'contains', 10, 'system'),
('배송', '물류/배송비', '배송비', 'contains', 10, 'system'),
('포장', '물류/배송비', '포장재비', 'contains', 10, 'system'),
('박스', '물류/배송비', '포장재비', 'contains', 10, 'system'),
('테이프', '물류/배송비', '포장재비', 'contains', 10, 'system'),
('완충재', '물류/배송비', '포장재비', 'contains', 10, 'system'),
('도서산간', '물류/배송비', '도서산간추가비', 'contains', 10, 'system'),

-- 인건비
('급여', '인건비', '급여', 'contains', 10, 'system'),
('월급', '인건비', '급여', 'contains', 10, 'system'),
('일당', '인건비', '일용직', 'contains', 10, 'system'),
('일용', '인건비', '일용직', 'contains', 10, 'system'),
('아르바이트', '인건비', '일용직', 'contains', 10, 'system'),
('알바', '인건비', '일용직', 'contains', 10, 'system'),
('4대보험', '인건비', '4대보험', 'contains', 10, 'system'),
('국민연금', '인건비', '4대보험', 'contains', 10, 'system'),
('건강보험', '인건비', '4대보험', 'contains', 10, 'system'),
('고용보험', '인건비', '4대보험', 'contains', 10, 'system'),
('산재보험', '인건비', '4대보험', 'contains', 10, 'system'),
('퇴직', '인건비', '퇴직금', 'contains', 10, 'system'),
('상여', '인건비', '상여금', 'contains', 10, 'system'),

-- 시설/임대료
('임대', '시설/임대료', '임대료', 'contains', 10, 'system'),
('월세', '시설/임대료', '임대료', 'contains', 10, 'system'),
('관리비', '시설/임대료', '관리비', 'contains', 10, 'system'),
('전기', '시설/임대료', '전기료', 'contains', 10, 'system'),
('수도', '시설/임대료', '수도료', 'contains', 10, 'system'),
('가스', '시설/임대료', '가스비', 'contains', 10, 'system'),
('냉장', '시설/임대료', '냉장시설운영', 'contains', 10, 'system'),
('냉동', '시설/임대료', '냉장시설운영', 'contains', 10, 'system'),
('창고', '시설/임대료', '창고비', 'contains', 10, 'system'),

-- 마케팅/광고
('광고', '마케팅/광고', '온라인광고', 'contains', 10, 'system'),
('쿠팡광고', '마케팅/광고', '쿠팡광고', 'contains', 50, 'system'),
('네이버광고', '마케팅/광고', '네이버광고', 'contains', 50, 'system'),
('프로모션', '마케팅/광고', '프로모션', 'contains', 10, 'system'),
('쿠폰', '마케팅/광고', '쿠폰비용', 'contains', 10, 'system'),
('샘플', '마케팅/광고', '샘플비용', 'contains', 10, 'system'),
('이벤트', '마케팅/광고', '이벤트비용', 'contains', 10, 'system'),

-- IT/시스템
('서버', 'IT/시스템', '서버비', 'contains', 10, 'system'),
('도메인', 'IT/시스템', '도메인비', 'contains', 10, 'system'),
('API', 'IT/시스템', 'API비용', 'contains', 10, 'system'),
('카카오', 'IT/시스템', '카카오알림톡', 'contains', 10, 'system'),
('알림톡', 'IT/시스템', '카카오알림톡', 'contains', 10, 'system'),
('솔루션', 'IT/시스템', '솔루션이용료', 'contains', 10, 'system'),
('호스팅', 'IT/시스템', '호스팅비', 'contains', 10, 'system'),
('Replit', 'IT/시스템', '서버비', 'contains', 50, 'system'),
('팝빌', 'IT/시스템', 'API비용', 'contains', 50, 'system'),

-- 사무/관리
('통신', '사무/관리', '통신비', 'contains', 10, 'system'),
('전화', '사무/관리', '통신비', 'contains', 10, 'system'),
('인터넷', '사무/관리', '통신비', 'contains', 10, 'system'),
('소모품', '사무/관리', '소모품', 'contains', 10, 'system'),
('사무용품', '사무/관리', '소모품', 'contains', 10, 'system'),
('차량', '사무/관리', '차량유지비', 'contains', 10, 'system'),
('주유', '사무/관리', '차량유지비', 'contains', 10, 'system'),
('보험', '사무/관리', '보험료', 'contains', 10, 'system'),
('세무', '사무/관리', '세무사비', 'contains', 10, 'system'),
('회계', '사무/관리', '세무사비', 'contains', 10, 'system'),
('법무', '사무/관리', '법무비', 'contains', 10, 'system'),

-- 금융비용
('이자', '금융비용', '이자비용', 'contains', 10, 'system'),
('수수료', '금융비용', '수수료', 'contains', 10, 'system'),
('PG', '금융비용', 'PG수수료', 'contains', 10, 'system'),
('카드수수료', '금융비용', '카드수수료', 'contains', 50, 'system');
```

### 1-5. Zod 스키마 업데이트

`shared/schema.ts`에 위 3개 테이블(expenses, expense_keywords, expense_recurring)의 Drizzle 스키마, Zod 검증 스키마, TypeScript 타입을 추가하세요.

---

## 2단계: API 엔드포인트

### 2-1. 비용 내역 API

```
GET /api/admin/accounting/expenses
```
- 쿼리 파라미터: `month` (YYYY-MM), `category` (분류 필터), `search` (항목명 검색)
- 응답: 비용 내역 배열 (날짜 최신순)
- 월간 합계, 분류별 합계도 함께 응답

```
POST /api/admin/accounting/expenses
```
- 요청: `{ expense_date, item_name, category, sub_category?, amount, tax_type, payment_method, vendor_name?, memo?, receipt_url? }`
- 동작:
  1. 비용 등록
  2. tax_type에 따라 supply_amount, vat_amount 자동 계산
     - 과세: supply_amount = Math.round(amount / 1.1), vat_amount = amount - supply_amount
     - 면세: supply_amount = amount, vat_amount = 0
  3. 해당 item_name에서 키워드 학습 (아래 학습 로직 참고)

```
POST /api/admin/accounting/expenses/bulk
```
- 요청: `{ items: [{expense_date, item_name, amount, ...}, ...] }`
- 스프레드시트 일괄 등록용
- 각 항목의 자동 분류 처리 포함

```
PUT /api/admin/accounting/expenses/:id
```
- 비용 수정

```
DELETE /api/admin/accounting/expenses/:id
```
- 비용 삭제

```
GET /api/admin/accounting/expenses/summary
```
- 쿼리 파라미터: `month` (YYYY-MM)
- 응답: 월간 총비용, 분류별 합계, 전월 대비 증감, 분류별 비율
- 차트 데이터용

```
GET /api/admin/accounting/expenses/trend
```
- 쿼리 파라미터: `months` (최근 N개월, 기본 6)
- 응답: 월별 총비용 + 분류별 추이 데이터
- 라인차트용

### 2-2. 자동완성 API

```
GET /api/admin/accounting/expenses/autocomplete
```
- 쿼리 파라미터: `q` (검색어, 최소 1글자)
- 동작:
  1. expense_keywords에서 keyword가 검색어를 포함하는 항목 검색
  2. 기존 expenses에서 item_name이 검색어를 포함하는 최근 항목 검색
  3. 두 결과를 합치되, priority 높은 순 → use_count 높은 순 정렬
  4. 최대 10개 반환
- 응답:
```json
[
  {
    "item_name": "롯데택배 2월 정산",
    "category": "물류/배송비",
    "sub_category": "택배비",
    "last_amount": 350000,
    "source": "history"
  },
  {
    "item_name": "롯데택배",
    "category": "물류/배송비",
    "sub_category": "택배비",
    "last_amount": null,
    "source": "keyword"
  }
]
```

### 2-3. 자동 분류 API

```
POST /api/admin/accounting/expenses/classify
```
- 요청: `{ item_name: "롯데택배 2월분" }`
- 동작: 아래 3단계 매칭 로직 실행
- 응답: `{ category: "물류/배송비", sub_category: "택배비", confidence: "high" }`

**3단계 자동 분류 매칭 로직:**

```
1순위) 거래처명 완전 매칭 (priority >= 50)
  → item_name에서 거래처명(vendor_name) 추출
  → expense_keywords에서 match_type='exact', priority >= 50인 항목 검색
  → 매칭되면 confidence: "high"

2순위) 키워드 포함 매칭 (priority >= 10)
  → item_name을 키워드 단위로 분리
  → expense_keywords에서 match_type='contains'인 항목 검색
  → 매칭되면 confidence: "medium"

3순위) 매칭 실패
  → category: null, confidence: "none"
  → 프론트에서 수동 선택 UI 표시
```

### 2-4. 키워드 학습 로직

비용 등록 시 (POST /expenses) 자동으로 키워드를 학습합니다.
**단, 기존에 매칭 가능한 키워드가 이미 있으면 새로 추가하지 않고 기존 키워드의 use_count만 올립니다.**

```
비용 등록: item_name="롯데택배 2월분" → category="물류/배송비"
    ↓
학습 처리:
  1. "롯데택배 2월분" 전체로 expense_keywords 검색 → 없음
  2. "롯데택배"로 검색 → ✅ 있음! (시스템 키워드)
  → 새 키워드 추가 안 함, 기존 "롯데택배"의 use_count +1, last_amount 업데이트
```

```
비용 등록: item_name="농협 가마니" → category="물류/배송비" (관리자가 수동 선택)
    ↓
학습 처리:
  1. "농협 가마니" 전체로 expense_keywords 검색 → 없음
  2. "농협"으로 검색 → 없음
  3. "가마니"로 검색 → 없음
  → 매칭 가능한 기존 키워드 없음 → 새 키워드 추가:
    - "농협 가마니" (priority: 50, source: "learned")
    - "농협" (priority: 15, source: "learned")
```

**학습 시 중복 방지 로직 (상세):**

```
function learnKeyword(itemName, category, subCategory, amount) {
  // 1단계: item_name 전체가 이미 키워드로 존재하는지 확인
  const exactMatch = findKeyword(itemName, 'exact');
  if (exactMatch) {
    // 이미 존재 → use_count +1, last_amount 업데이트만
    updateKeywordUsage(exactMatch.id, amount);
    return;
  }

  // 2단계: item_name의 각 단어가 기존 키워드에 포함되는지 확인
  const words = itemName.split(' ');
  for (const word of words) {
    const partialMatch = findKeyword(word, 'contains');
    if (partialMatch && partialMatch.category === category) {
      // 같은 분류의 기존 키워드가 매칭됨 → use_count만 업데이트
      updateKeywordUsage(partialMatch.id, amount);
      return;
    }
  }

  // 3단계: 유사 키워드 검색 (포함 관계 체크)
  //   "택배비"를 추가하려는데 "택배"가 이미 있으면 → 추가하지 않음
  const allKeywordsInCategory = findKeywordsByCategory(category);
  for (const kw of allKeywordsInCategory) {
    if (itemName.includes(kw.keyword) || kw.keyword.includes(itemName)) {
      // 포함 관계 → use_count만 업데이트
      updateKeywordUsage(kw.id, amount);
      return;
    }
  }

  // 4단계: 완전히 새로운 항목 → 키워드 추가
  insertKeyword(itemName, category, subCategory, 50, 'learned', amount);
  // 개별 단어도 추가 (2글자 이상만)
  for (const word of words) {
    if (word.length >= 2 && !findKeyword(word, 'contains')) {
      insertKeyword(word, category, subCategory, 15, 'learned', null);
    }
  }
}
```

### 2-5. 키워드 사전 관리 API

```
GET /api/admin/accounting/expenses/keywords
```
- 쿼리 파라미터: `category` (분류 필터), `search` (키워드 검색)
- 응답: 키워드 목록 (priority 높은 순 → use_count 높은 순)

```
POST /api/admin/accounting/expenses/keywords
```
- 요청: `{ keyword, category, sub_category?, match_type? }`
- 검증: 같은 keyword가 이미 존재하면 400 에러 ("이미 등록된 키워드입니다")
- source: "admin"으로 설정, priority: 50

```
PUT /api/admin/accounting/expenses/keywords/:id
```
- 수정 가능 범위:
  - source가 "system": category, sub_category만 수정 가능
  - source가 "admin" 또는 "learned": 모든 필드 수정 가능

```
DELETE /api/admin/accounting/expenses/keywords/:id
```
- source가 "system"이면 삭제 불가 (400 에러)
- source가 "admin" 또는 "learned"만 삭제 가능

```
GET /api/admin/accounting/expenses/keywords/similar
```
- 쿼리 파라미터: `q` (검색어, 최소 2글자)
- 동작: 포함 관계에 있는 기존 키워드를 검색
  - 입력값이 기존 키워드를 포함하는 경우 (예: "택배비" → "택배" 포함)
  - 기존 키워드가 입력값을 포함하는 경우 (예: "택" → "택배"에 포함됨)
  - 완전 동일한 경우
- 응답:
```json
{
  "similar": [
    {
      "id": 1,
      "keyword": "택배",
      "category": "물류/배송비",
      "source": "system",
      "useCount": 12,
      "relation": "input_contains_keyword"
    }
  ],
  "exactMatch": false
}
```
- `relation` 값: "exact"(완전동일), "input_contains_keyword"(입력이 기존 포함), "keyword_contains_input"(기존이 입력 포함)

### 2-6. 정기 비용 API

```
GET /api/admin/accounting/expenses/recurring
```
- 응답: 등록된 정기 비용 목록

```
POST /api/admin/accounting/expenses/recurring
```
- 요청: `{ item_name, category, amount, tax_type, payment_method, vendor_name?, day_of_month, cycle, cycle_month?, memo? }`

```
PUT /api/admin/accounting/expenses/recurring/:id
```
- 정기 비용 수정

```
DELETE /api/admin/accounting/expenses/recurring/:id
```
- 정기 비용 삭제 (이미 생성된 비용 내역은 유지)

```
PATCH /api/admin/accounting/expenses/recurring/:id/toggle
```
- 활성/비활성 토글

```
POST /api/admin/accounting/expenses/recurring/generate
```
- 특정 월의 정기 비용 일괄 생성 (수동 실행)
- 요청: `{ month: "2026-02" }`
- 동작: expense_recurring에서 is_active=true인 항목을 expenses에 자동 생성
- 이미 해당 월에 같은 recurring_id로 생성된 건이 있으면 스킵 (중복 방지)

### 2-6. 엑셀 업로드/다운로드

```
POST /api/admin/accounting/expenses/upload
```
- 엑셀 파일 업로드 → 파싱 → 자동 분류 적용 → 일괄 등록
- 각 행마다 자동 분류 실행, 실패 시 "기타"로 분류

```
GET /api/admin/accounting/expenses/download
```
- 쿼리 파라미터: `month` (YYYY-MM)
- 해당 월 비용 내역을 엑셀로 다운로드

```
GET /api/admin/accounting/expenses/template
```
- 비용 업로드용 엑셀 템플릿 다운로드

---

## 3단계: 비용 분류 체계

### 대분류 8개 (category)

| 대분류 | 이모지 | 색상 | 면세 여부 |
|--------|--------|------|----------|
| 물류/배송비 | 🚚 | blue | 과세 |
| 인건비 | 👤 | violet | 혼합 (급여=면세, 기타=과세) |
| 시설/임대료 | 🏢 | amber | 과세 |
| 마케팅/광고 | 📢 | pink | 과세 |
| IT/시스템 | 💻 | cyan | 과세 |
| 사무/관리 | 📎 | slate | 과세 |
| 금융비용 | 🏦 | emerald | 면세 (이자, 수수료) |
| 기타 | 📝 | gray | 과세 |

### 세부 항목 (sub_category)

세부 항목은 자동 분류에서 참고용으로 사용되며, 관리자가 새로운 세부 항목을 추가할 수 있습니다.
expense_keywords 테이블의 sub_category 값으로 관리됩니다.

---

## 4단계: 프론트엔드 UI

> ⚠️ UI 구현 시 기존 프로젝트의 CSS, 글씨체, shadcn/ui 컴포넌트를 그대로 사용하세요. 기존 회계장부 다른 탭과 동일한 스타일을 유지하세요.

### 4-1. 탭 추가

기존 회계장부 탭 바에 "비용관리" 탭을 추가합니다.

### 4-2. 비용관리 탭 전체 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  비용관리                                    2026년 2월 ◀ ▶ │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  [월간 비용 요약 카드 — 가로 1줄]                            │
│  총비용 | 물류배송 | 인건비 | 시설임대 | 마케팅 | IT | 사무 | 금융 │
│                                                            │
│  [등록 모드 버튼]                                            │
│  [💰간편등록] [📊스프레드시트] [📥엑셀업로드] [🔄정기비용관리]   │
│                                                            │
│  [분류 필터 탭]                                              │
│  전체|🚚물류|👤인건|🏢시설|📢마케팅|💻IT|📎사무|🏦금융|📝기타  │
│                                                            │
│  [비용 내역 테이블]                                          │
│  날짜 | 분류 | 항목명 | 금액 | 공급가 | 부가세 | 결제 | 증빙 | 액션│
│                                                            │
│  [하단: 분류별 비율 도넛차트 + 월별 추이 라인차트]             │
└──────────────────────────────────────────────────────────┘
```

### 4-3. 월간 비용 요약 카드

- 총비용 카드(강조) + 분류별 카드 8개 (가로 스크롤 가능)
- 각 카드: 이모지 + 분류명 + 금액 + 전월 대비 증감(▲▼%)
- 카드 클릭 시 해당 분류로 필터 적용

### 4-4. 간편 등록 모드 (기본)

"💰 간편등록" 버튼 클릭 시 등록 영역이 펼쳐짐:

```
┌─────────────────────────────────────────────────────┐
│  💰 비용 간편 등록                                     │
├─────────────────────────────────────────────────────┤
│                                                       │
│  날짜: [2026-02-16]  ← 오늘 날짜 자동 입력 (변경 가능)  │
│                                                       │
│  항목명: [롯___________________________]              │
│          ┌──────────────────────────────┐            │
│          │ 🚚 롯데택배 2월 정산  (350,000원) │ ← 최근이력 │
│          │ 🚚 롯데택배 도서산간              │            │
│          │ 🏢 롯데마트 창고 임대             │            │
│          └──────────────────────────────┘            │
│          → 자동 분류: 🚚 물류/배송비 ✅ [변경]          │
│                                                       │
│  금액: [350,000] 원     과세: [과세 ▼]                 │
│  공급가: 318,182원  부가세: 31,818원  ← 자동 계산       │
│                                                       │
│  결제방법: [계좌이체 ▼]    거래처: [롯데택배______]      │
│                                                       │
│  메모: [선택입력_________________________]             │
│  증빙: [📎 파일첨부] (선택)                             │
│                                                       │
│                   [등록] [+ 연속 등록]                  │
└─────────────────────────────────────────────────────┘
```

**자동완성 동작 (핵심):**

1. 항목명 input에 포커스 + 1글자 이상 입력 시 → GET /autocomplete?q=입력값 호출
2. 응답을 드롭다운 목록으로 표시 (input 바로 아래)
3. 각 항목: 분류 이모지 + 항목명 + (최근 금액) 표시
4. **키보드 조작**: ▲▼ 방향키로 항목 이동, Enter로 선택, Esc로 닫기
5. **마우스**: 클릭으로 선택
6. 항목 선택 시:
   - item_name 자동 채움
   - category, sub_category 자동 채움 → "자동 분류: 🚚 물류/배송비 ✅" 표시
   - last_amount가 있으면 금액 필드에 참고값으로 표시 (직접 수정 가능)
   - 커서가 금액 필드로 자동 이동
7. 드롭다운에 없는 새 항목:
   - 그냥 입력 계속 → POST /classify 호출하여 분류 시도
   - 분류 실패 시 → 분류 select 드롭다운이 나타남 (수동 선택)
   - 수동 선택 시 → 키워드 학습됨 (다음부터 자동)

**"+ 연속 등록" 버튼:**
- 등록 후 폼을 초기화하지 않고, 금액/메모만 비우고 날짜/항목명 유지
- 같은 날짜에 여러 건 빠르게 입력 가능

**금액 입력:**
- 숫자만 입력 가능, 자동 콤마 포맷 (예: 350000 → 350,000)
- 과세/면세 선택에 따라 공급가/부가세 실시간 자동 계산

**결제방법 드롭다운:**
- 계좌이체, 카드, 현금, 자동이체, 기타

### 4-5. 스프레드시트 모드 (일괄 입력)

"📊 스프레드시트" 버튼 클릭 시 테이블 형태의 입력 UI:

```
┌──────────┬─────────────────────┬──────────┬──────────┬────────┬────────┐
│  날짜     │  항목명 (자동완성)    │  금액     │ 분류(자동) │ 과세    │ 결제방법 │
├──────────┼─────────────────────┼──────────┼──────────┼────────┼────────┤
│ 02-16    │ 롯데택배 2월분       │ 350,000  │ 🚚물류    │ 과세    │ 계좌이체 │
│ 02-16    │ 직원 급여 2월        │3,500,000 │ 👤인건비  │ 면세    │ 계좌이체 │
│ 02-16    │ 창고 월세            │ 800,000  │ 🏢시설   │ 과세    │ 자동이체 │
│ 02-16    │ 쿠팡 광고비          │ 150,000  │ 📢마케팅  │ 과세    │ 카드    │
│ + 행 추가 │                     │          │          │        │        │
├──────────┴─────────────────────┴──────────┴──────────┴────────┴────────┤
│                                      합계: 4,800,000원  [일괄 등록]     │
└───────────────────────────────────────────────────────────────────────┘
```

- 각 행의 항목명 셀에서도 자동완성이 동작해야 함
- Tab 키로 다음 셀 이동, Enter로 다음 행
- 분류는 항목명 입력/선택 시 자동 채움
- "+ 행 추가" 클릭 또는 마지막 행에서 Tab으로 자동 행 추가
- 하단에 합계 자동 계산 + "일괄 등록" 버튼

### 4-6. 엑셀 업로드

"📥 엑셀업로드" 클릭 시:

1. 템플릿 다운로드 링크 제공
2. 파일 드래그앤드롭 또는 클릭 업로드
3. 업로드 후 미리보기 테이블 표시 (자동 분류 결과 포함)
4. 분류 실패 항목은 노란 하이라이트 + 수동 선택
5. "전체 등록" 버튼으로 일괄 저장

### 4-7. 정기 비용 관리

"🔄 정기비용관리" 클릭 시 다이얼로그 또는 패널:

```
┌─────────────────────────────────────────────────────┐
│  🔄 정기 비용 관리                                     │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ☑️ 🏢 창고 월세      800,000원  매월 1일   계좌이체   │
│  ☑️ 👤 직원 급여    3,500,000원  매월 25일  계좌이체   │
│  ☑️ 💻 서버 운영비     50,000원  매월 1일   카드      │
│  ☑️ 💻 도메인 갱신     30,000원  매년 3월   카드      │
│  ☐  👤 4대보험        420,000원  매월 10일  계좌이체   │
│                                                       │
│  [+ 정기 비용 추가]                                    │
│                                                       │
│  ────────────────────────────────────────────        │
│  이번 달 정기 비용:  미생성 3건 / 생성완료 2건           │
│  [이번 달 정기 비용 일괄 생성]                           │
└─────────────────────────────────────────────────────┘
```

- 체크박스: 활성/비활성 토글
- 각 항목 클릭 시 수정/삭제 가능
- 하단: 해당 월 정기 비용 생성 상태 표시 + 일괄 생성 버튼
- 금액 변동 시 해당 항목만 수정하면 다음 달부터 반영

### 4-8. 키워드 사전 관리

비용관리 탭 상단 우측에 **"⚙️ 분류 사전 관리"** 버튼을 배치합니다.
클릭 시 다이얼로그로 키워드 사전을 조회/추가/수정/삭제할 수 있습니다.

```
┌──────────────────────────────────────────────────────────┐
│  ⚙️ 분류 사전 관리                                         │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  [분류 필터] 전체|🚚물류|👤인건|🏢시설|📢마케팅|💻IT|📎사무|🏦금융│
│                                                            │
│  🔍 키워드 검색: [________________]                         │
│                                                            │
│  ┌──────────┬──────────┬──────────┬──────┬──────┬──────┐ │
│  │  키워드    │  대분류    │  세부항목  │ 출처  │ 사용수 │ 액션  │ │
│  ├──────────┼──────────┼──────────┼──────┼──────┼──────┤ │
│  │ 롯데택배   │ 🚚물류/배송│ 택배비    │ 시스템 │  12   │      │ │
│  │ CJ대한통운 │ 🚚물류/배송│ 택배비    │ 시스템 │   8   │      │ │
│  │ 농협 가마니│ 🚚물류/배송│ 포장재비  │ 학습  │   3   │ ✏️🗑 │ │
│  │ 급여      │ 👤인건비   │ 급여     │ 시스템 │  15   │      │ │
│  │ 쿠팡광고   │ 📢마케팅   │ 쿠팡광고  │ 시스템 │   6   │      │ │
│  │ 네이버블로그│ 📢마케팅   │ 온라인광고 │ 학습  │   2   │ ✏️🗑 │ │
│  │ ...       │          │          │      │      │      │ │
│  └──────────┴──────────┴──────────┴──────┴──────┴──────┘ │
│                                                            │
│  [+ 키워드 추가]                                            │
│                                                            │
│  ── 출처 안내 ──                                            │
│  시스템: 기본 제공 키워드 (수정/삭제 불가, 분류 변경만 가능)     │
│  학습: 비용 등록 시 자동 학습된 키워드 (수정/삭제 가능)         │
│  관리자: 관리자가 직접 추가한 키워드 (수정/삭제 가능)           │
└──────────────────────────────────────────────────────────┘
```

**키워드 추가 다이얼로그:**

```
┌─────────────────────────────────────────┐
│  키워드 추가                              │
├─────────────────────────────────────────┤
│                                           │
│  키워드: [택배비______________]            │
│  (예: "네이버블로그", "GS25 납품" 등)      │
│                                           │
│  ┌─────────────────────────────────┐     │
│  │ ⚠️ 유사 키워드가 이미 있습니다:    │     │
│  │                                   │     │
│  │  "택배" → 🚚 물류/배송비           │     │
│  │   (시스템, 사용 12회)              │     │
│  │  "택배"가 "택배비"에 포함됩니다     │     │
│  │                                   │     │
│  │  기존 키워드로 충분할 수 있습니다.  │     │
│  └─────────────────────────────────┘     │
│                                           │
│  대분류: [📢 마케팅/광고  ▼]              │
│                                           │
│  세부항목: [온라인광고_________]           │
│  (비워두면 대분류만 적용)                  │
│                                           │
│  매칭 방식: ◉ 포함 (키워드가 항목명에      │
│               포함되면 매칭)               │
│             ○ 완전일치 (정확히 일치        │
│               할 때만 매칭)               │
│                                           │
│              [취소]  [그래도 추가]         │
└─────────────────────────────────────────┘
```

**유사 키워드 경고 동작:**

1. 키워드 input에 2글자 이상 입력 시, 실시간으로 유사 키워드를 검색
2. 유사 판정 기준:
   - **포함 관계**: 입력한 키워드가 기존 키워드를 포함하거나, 기존 키워드가 입력한 키워드를 포함
     - 예: "택배비" 입력 → "택배"가 포함됨 → 경고
     - 예: "택" 입력 → "택배"에 포함됨 → 경고
   - **완전 동일**: 같은 키워드가 이미 존재
     - 예: "택배" 입력 → "택배" 이미 있음 → "이미 등록된 키워드입니다" 에러 (등록 차단)
3. 유사 키워드가 발견되면:
   - 노란색 경고 박스로 유사 키워드 목록 표시 (키워드명, 분류, 출처, 사용수)
   - 어떤 관계인지 설명 ("OO가 OO에 포함됩니다")
   - "기존 키워드로 충분할 수 있습니다" 안내
   - 등록 버튼 텍스트를 "그래도 추가"로 변경 (등록은 가능하지만 한 번 더 확인)
4. 완전 동일한 키워드면 등록 자체를 차단 (서버에서도 400 에러)
5. 유사 키워드가 없으면 경고 없이 일반 "추가" 버튼 표시

**유사 키워드 검색 API:**

```
GET /api/admin/accounting/expenses/keywords/similar?q=택배비
```
- 응답: 포함 관계에 있는 기존 키워드 목록
- 프론트에서 키워드 input의 onChange 또는 debounce(300ms)로 호출

**키워드 수정:**
- 학습/관리자 출처 키워드만 수정/삭제 가능
- 시스템 키워드는 분류(대분류, 세부항목) 변경만 가능, 키워드 자체나 삭제는 불가
- 수정 시 같은 다이얼로그를 재활용

**동작 규칙:**
- 키워드는 중복 등록 불가 (같은 키워드가 이미 있으면 에러)
- 삭제 시 확인 다이얼로그 표시
- 분류 필터로 특정 분류의 키워드만 조회 가능
- 사용수(use_count) 기준 정렬 가능 (자주 쓰는 키워드 확인용)

### 4-8. 비용 내역 테이블

| 컬럼 | 내용 |
|------|------|
| 날짜 | expense_date |
| 분류 | 이모지 + 대분류명 (배지 형태) |
| 항목명 | item_name |
| 금액 | amount (콤마 포맷) |
| 공급가 | supply_amount |
| 부가세 | vat_amount |
| 결제방법 | payment_method (배지) |
| 증빙 | 첨부 여부 아이콘 (📎) |
| 정기 | 정기비용 표시 (🔄) |
| 액션 | 수정, 삭제 버튼 |

- 날짜 최신순 정렬
- 정기 비용으로 생성된 건은 🔄 아이콘 표시
- 행 클릭 시 수정 다이얼로그

### 4-9. 하단 차트

**좌측: 분류별 비율 도넛차트**
- 8개 분류별 비율 표시
- 중앙에 총비용 표시
- 각 조각에 분류명 + 비율(%) + 금액

**우측: 월별 추이 라인차트**
- 최근 6개월 총비용 추이
- 분류별 스택 바 차트 또는 라인 (토글 가능)

차트는 기존 프로젝트에서 사용 중인 차트 라이브러리(recharts 등)를 그대로 사용하세요.

---

## 5단계: 손익분석 연동 준비

비용관리가 완성되면, 향후 손익분석 탭에서 아래와 같이 사용됩니다:

```
매출총이익  = 매출(매출현황) - 매입(매입관리)
영업이익    = 매출총이익 - 비용(비용관리)

비용관리 API에서 제공해야 할 집계:
- GET /api/admin/accounting/expenses/summary?month=YYYY-MM
  → totalExpense, byCategory 객체
```

이 API가 손익분석 탭에서 호출될 수 있도록 설계하세요.

---

## 검증 체크리스트

### DB/API 검증
1. ✅ expenses 테이블이 생성되고 CRUD가 정상 동작하는가?
2. ✅ expense_keywords 테이블에 초기 키워드 사전이 등록되었는가?
3. ✅ expense_recurring 테이블이 생성되었는가?
4. ✅ 자동완성 API가 1글자 이상 입력 시 응답하는가?
5. ✅ 자동 분류 API가 3단계(거래처→키워드→실패) 로직으로 동작하는가?
6. ✅ 키워드 학습 시 기존에 매칭 가능한 키워드가 있으면 새로 추가하지 않고 use_count만 올리는가?
7. ✅ 키워드 학습 시 포함 관계 키워드가 있으면 중복 추가를 방지하는가?
8. ✅ 유사 키워드 검색 API(/keywords/similar)가 포함 관계를 정확히 찾는가?
9. ✅ 과세/면세에 따라 공급가/부가세가 자동 계산되는가?
10. ✅ 정기 비용 생성 시 중복 방지가 동작하는가?

### UI 검증
9. ✅ 회계장부 탭에 "비용관리" 탭이 정상 추가되었는가?
10. ✅ 항목명 입력 시 자동완성 드롭다운이 나타나는가?
11. ✅ 방향키(▲▼) + Enter로 자동완성 항목을 선택할 수 있는가?
12. ✅ 항목 선택 시 분류가 자동으로 채워지는가?
13. ✅ 드롭다운에 없는 새 항목 입력 시 수동 분류 UI가 나타나는가?
14. ✅ 수동 분류 선택 후 다음 입력 시 해당 키워드가 자동완성에 나타나는가? (학습 확인)
15. ✅ 스프레드시트 모드에서도 자동완성이 동작하는가?
16. ✅ 정기 비용 등록/수정/삭제/토글이 정상 동작하는가?
17. ✅ 정기 비용 일괄 생성이 중복 없이 동작하는가?
18. ✅ "⚙️ 분류 사전 관리" 다이얼로그에서 키워드 목록이 표시되는가?
19. ✅ 키워드 추가/수정/삭제가 정상 동작하는가?
20. ✅ 시스템 키워드는 삭제 불가, 분류 변경만 가능한가?
21. ✅ 학습/관리자 키워드는 수정/삭제가 가능한가?
22. ✅ 키워드 추가 시 유사 키워드가 있으면 경고 박스가 표시되는가?
23. ✅ 완전 동일 키워드는 등록이 차단되는가?
24. ✅ 유사 키워드 경고 시 "그래도 추가" 버튼으로 등록 가능한가?
25. ✅ 월간 요약 카드에 분류별 금액이 표시되는가?
26. ✅ 도넛차트 + 라인차트가 정상 렌더링되는가?
27. ✅ 엑셀 업로드/다운로드가 동작하는가?

### 기존 기능 보존 검증
20. ✅ 기존 회계장부 탭들(회원정산, 공급업체, 매입관리, 매출현황)이 정상 동작하는가?
21. ✅ **기존 CSS, 글씨체, 폰트가 변경 없이 100% 유지되는가?**
22. ✅ 기존 데이터에 영향이 없는가?

결과를 한글로 보고해 주세요.
