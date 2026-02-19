# 회계장부 — 비용관리 탭 개선 (분류 테이블 구조화)

## ⚠️ 최우선 원칙

1. **⛔ 기존 CSS, 글씨체, 폰트, 전역 스타일을 절대 수정하거나 새로 추가하지 마세요.** 현재 프로젝트에 설정된 Tailwind 설정, CSS 파일, 글씨체(font-family)를 100% 그대로 사용해야 합니다.
2. **기존 회계장부의 다른 탭(회원정산, 공급업체, 매입관리, 매출현황)의 기능과 코드를 절대 수정하지 마세요.**
3. **기존 인증 방식(세션 기반), 라우팅 구조, 기술 스택(React + TanStack Query + shadcn/ui + Drizzle ORM)을 그대로 유지하세요.**
4. 작업은 단계별로 진행하고, 각 단계 완료 후 정상 동작을 확인한 뒤 다음 단계로 넘어가세요.
5. 작업 진행 상황과 결과는 항상 **한글**로 보여주세요.

> **🚫 절대 하지 말아야 할 것:**
> - 새로운 폰트(Google Fonts 등) 추가
> - 새로운 CSS 파일 생성
> - 기존 globals.css, tailwind.config 등 전역 설정 수정
> - 기존 회계장부 탭들(회원정산, 공급업체, 매입관리, 매출현황) 수정
>
> **✅ 반드시 지켜야 할 것:**
> - 현재 프로젝트의 기존 CSS, 폰트, Tailwind 설정을 그대로 사용
> - 기존 shadcn/ui 컴포넌트 활용
> - 기존 회계장부 탭들과 동일한 UI 스타일, 코드 패턴 유지

---

## 📋 작업 개요

현재 비용관리 탭의 **분류 체계를 테이블 기반으로 구조화**합니다.

**현재 문제점:**
- 대분류, 세부항목이 텍스트 문자열로만 존재 → 오타, 불일치 가능
- "물류/배송비"와 "물류배송비"가 다른 분류로 인식됨
- 분류 체계를 한눈에 관리할 수 없음

**개선 방향:**
- 대분류 → `expense_categories` 테이블로 관리 (ID 참조)
- 세부항목 → `expense_sub_categories` 테이블로 관리 (ID 참조)
- 키워드, 비용, 정기비용 등 모든 곳에서 ID로 참조 → 일관성 보장
- 관리자가 대분류/세부항목을 추가/수정/삭제 가능

---

## 1단계: 신규 분류 테이블 생성

### 1-1. expense_categories 테이블 (대분류)

```sql
CREATE TABLE expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,          -- 대분류명 (예: "물류/배송비")
  emoji VARCHAR(10) NOT NULL,                -- 이모지 (예: "🚚")
  color VARCHAR(20) NOT NULL,                -- Tailwind 색상 (예: "blue")
  default_tax_type VARCHAR(10) DEFAULT 'taxable',  -- 기본 과세 구분
  sort_order INTEGER DEFAULT 0,              -- 정렬 순서
  is_active BOOLEAN DEFAULT true,            -- 활성 여부
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 1-2. expense_sub_categories 테이블 (세부항목)

```sql
CREATE TABLE expense_sub_categories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                -- 세부항목명 (예: "택배비")
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, name)                  -- 같은 대분류 안에서 세부항목명 중복 방지
);
```

### 1-3. 초기 분류 데이터 시드

```sql
-- 대분류 8개
INSERT INTO expense_categories (name, emoji, color, default_tax_type, sort_order) VALUES
('물류/배송비', '🚚', 'blue', 'taxable', 1),
('인건비', '👤', 'violet', 'exempt', 2),
('시설/임대료', '🏢', 'amber', 'taxable', 3),
('마케팅/광고', '📢', 'pink', 'taxable', 4),
('IT/시스템', '💻', 'cyan', 'taxable', 5),
('사무/관리', '📎', 'slate', 'taxable', 6),
('금융비용', '🏦', 'emerald', 'exempt', 7),
('기타', '📝', 'gray', 'taxable', 8);

-- 세부항목 (category_id는 위 INSERT 순서에 맞춤)
-- 물류/배송비 (category_id=1)
INSERT INTO expense_sub_categories (category_id, name) VALUES
(1, '택배비'), (1, '화물운송비'), (1, '배송비'), (1, '포장재비'), (1, '도서산간추가비');

-- 인건비 (category_id=2)
INSERT INTO expense_sub_categories (category_id, name) VALUES
(2, '급여'), (2, '일용직'), (2, '4대보험'), (2, '퇴직금'), (2, '상여금');

-- 시설/임대료 (category_id=3)
INSERT INTO expense_sub_categories (category_id, name) VALUES
(3, '임대료'), (3, '관리비'), (3, '전기료'), (3, '수도료'), (3, '가스비'), (3, '냉장시설운영'), (3, '창고비');

-- 마케팅/광고 (category_id=4)
INSERT INTO expense_sub_categories (category_id, name) VALUES
(4, '온라인광고'), (4, '쿠팡광고'), (4, '네이버광고'), (4, '프로모션'), (4, '쿠폰비용'), (4, '샘플비용'), (4, '이벤트비용');

-- IT/시스템 (category_id=5)
INSERT INTO expense_sub_categories (category_id, name) VALUES
(5, '서버비'), (5, '도메인비'), (5, 'API비용'), (5, '카카오알림톡'), (5, '솔루션이용료'), (5, '호스팅비');

-- 사무/관리 (category_id=6)
INSERT INTO expense_sub_categories (category_id, name) VALUES
(6, '통신비'), (6, '소모품'), (6, '차량유지비'), (6, '보험료'), (6, '세무사비'), (6, '법무비');

-- 금융비용 (category_id=7)
INSERT INTO expense_sub_categories (category_id, name) VALUES
(7, '이자비용'), (7, '수수료'), (7, 'PG수수료'), (7, '카드수수료');

-- 기타 (category_id=8)
INSERT INTO expense_sub_categories (category_id, name) VALUES
(8, '기타비용');
```

---

## 2단계: 기존 테이블 구조 변경 (텍스트 → ID 참조)

### 2-1. expenses 테이블 변경

```sql
-- 새 컬럼 추가
ALTER TABLE expenses ADD COLUMN category_id INTEGER REFERENCES expense_categories(id);
ALTER TABLE expenses ADD COLUMN sub_category_id INTEGER REFERENCES expense_sub_categories(id);

-- 기존 데이터 마이그레이션: 텍스트 category → category_id 매핑
UPDATE expenses e
SET category_id = ec.id
FROM expense_categories ec
WHERE e.category = ec.name;

-- 매핑 안 된 건은 '기타'(id=8)로
UPDATE expenses SET category_id = 8 WHERE category_id IS NULL;

-- sub_category도 마이그레이션
UPDATE expenses e
SET sub_category_id = esc.id
FROM expense_sub_categories esc
JOIN expense_categories ec ON esc.category_id = ec.id
WHERE e.category = ec.name AND e.sub_category = esc.name;

-- NOT NULL 제약 추가
ALTER TABLE expenses ALTER COLUMN category_id SET NOT NULL;

-- 기존 텍스트 컬럼은 삭제하지 말고 당분간 유지 (안전을 위해)
-- 나중에 안정화 후 제거: ALTER TABLE expenses DROP COLUMN category, DROP COLUMN sub_category;
```

### 2-2. expense_keywords 테이블 변경

```sql
-- 새 컬럼 추가
ALTER TABLE expense_keywords ADD COLUMN category_id INTEGER REFERENCES expense_categories(id);
ALTER TABLE expense_keywords ADD COLUMN sub_category_id INTEGER REFERENCES expense_sub_categories(id);

-- 기존 데이터 마이그레이션
UPDATE expense_keywords ek
SET category_id = ec.id
FROM expense_categories ec
WHERE ek.category = ec.name;

UPDATE expense_keywords ek
SET sub_category_id = esc.id
FROM expense_sub_categories esc
JOIN expense_categories ec ON esc.category_id = ec.id
WHERE ek.category = ec.name AND ek.sub_category = esc.name;

-- 매핑 안 된 건은 '기타'(id=8)로
UPDATE expense_keywords SET category_id = 8 WHERE category_id IS NULL;

-- NOT NULL 제약 추가
ALTER TABLE expense_keywords ALTER COLUMN category_id SET NOT NULL;
```

### 2-3. expense_recurring 테이블 변경

```sql
-- 새 컬럼 추가
ALTER TABLE expense_recurring ADD COLUMN category_id INTEGER REFERENCES expense_categories(id);
ALTER TABLE expense_recurring ADD COLUMN sub_category_id INTEGER REFERENCES expense_sub_categories(id);

-- 기존 데이터 마이그레이션
UPDATE expense_recurring er
SET category_id = ec.id
FROM expense_categories ec
WHERE er.category = ec.name;

UPDATE expense_recurring er
SET sub_category_id = esc.id
FROM expense_sub_categories esc
JOIN expense_categories ec ON esc.category_id = ec.id
WHERE er.category = ec.name AND er.sub_category = esc.name;

UPDATE expense_recurring SET category_id = 8 WHERE category_id IS NULL;
ALTER TABLE expense_recurring ALTER COLUMN category_id SET NOT NULL;
```

### 2-4. Zod 스키마 업데이트

`shared/schema.ts`에 새 테이블(expense_categories, expense_sub_categories)의 Drizzle 스키마, Zod 스키마, TypeScript 타입을 추가하세요.
기존 expenses, expense_keywords, expense_recurring 스키마에도 category_id, sub_category_id 필드를 추가하세요.

---

## 3단계: 분류 관리 API 추가

### 3-1. 대분류 API

```
GET /api/admin/accounting/expense-categories
```
- 응답: 전체 대분류 목록 (sort_order 순)
- 각 대분류에 해당하는 세부항목 목록도 함께 포함 (nested)
- 응답 예시:
```json
[
  {
    "id": 1,
    "name": "물류/배송비",
    "emoji": "🚚",
    "color": "blue",
    "defaultTaxType": "taxable",
    "sortOrder": 1,
    "subCategories": [
      { "id": 1, "name": "택배비" },
      { "id": 2, "name": "화물운송비" },
      { "id": 3, "name": "배송비" },
      { "id": 4, "name": "포장재비" },
      { "id": 5, "name": "도서산간추가비" }
    ]
  },
  ...
]
```

```
POST /api/admin/accounting/expense-categories
```
- 요청: `{ name, emoji, color, defaultTaxType?, sortOrder? }`
- 검증: 같은 name이 이미 존재하면 400 에러
- 생성 후 해당 대분류에 "기타" 세부항목 자동 추가

```
PUT /api/admin/accounting/expense-categories/:id
```
- 요청: `{ name?, emoji?, color?, defaultTaxType?, sortOrder? }`
- 수정 시 기존 expenses의 데이터에는 영향 없음 (ID 참조이므로)

```
DELETE /api/admin/accounting/expense-categories/:id
```
- 해당 대분류를 사용 중인 비용이 있으면 삭제 불가 (400 에러: "이 분류를 사용 중인 비용이 N건 있습니다")
- 사용 중인 비용이 없을 때만 삭제 가능
- CASCADE로 세부항목도 함께 삭제

### 3-2. 세부항목 API

```
POST /api/admin/accounting/expense-categories/:categoryId/sub-categories
```
- 요청: `{ name }`
- 검증: 같은 대분류 안에서 같은 name이 있으면 400 에러

```
PUT /api/admin/accounting/expense-sub-categories/:id
```
- 요청: `{ name }`

```
DELETE /api/admin/accounting/expense-sub-categories/:id
```
- 해당 세부항목을 사용 중인 비용이 있으면 삭제 불가

---

## 4단계: 기존 API 수정 (텍스트 → ID 참조)

모든 기존 비용 관련 API에서 category/sub_category 텍스트 대신 category_id/sub_category_id를 사용하도록 수정합니다.

### 4-1. 비용 내역 API 수정

**POST /api/admin/accounting/expenses**
- 요청 변경: `category` → `category_id`, `sub_category` → `sub_category_id`
- 요청 예: `{ expense_date, item_name, category_id: 1, sub_category_id: 3, amount, tax_type, ... }`
- category_id가 유효한 expense_categories.id인지 서버 검증
- sub_category_id가 해당 category_id의 세부항목인지 검증

**GET /api/admin/accounting/expenses**
- 응답에 category_id, sub_category_id와 함께 대분류명, 이모지, 색상, 세부항목명도 JOIN하여 포함
- category 필터: `?category=1` (ID로 필터)

**GET /api/admin/accounting/expenses/summary**
- 분류별 합계를 category_id 기준으로 집계
- 응답에 대분류명, 이모지, 색상 포함

### 4-2. 자동완성 API 수정

**GET /api/admin/accounting/expenses/autocomplete**
- 응답에 category_id, sub_category_id 포함 (텍스트명도 함께)
- 응답 예시:
```json
[
  {
    "item_name": "롯데택배 2월 정산",
    "category_id": 1,
    "category_name": "물류/배송비",
    "category_emoji": "🚚",
    "sub_category_id": 1,
    "sub_category_name": "택배비",
    "last_amount": 350000,
    "source": "history"
  }
]
```

### 4-3. 자동 분류 API 수정

**POST /api/admin/accounting/expenses/classify**
- 응답 변경:
```json
{
  "category_id": 1,
  "category_name": "물류/배송비",
  "category_emoji": "🚚",
  "sub_category_id": 1,
  "sub_category_name": "택배비",
  "confidence": "high"
}
```

### 4-4. 키워드 API 수정

**POST /api/admin/accounting/expenses/keywords**
- 요청 변경: `category` → `category_id`, `sub_category` → `sub_category_id`
- 요청 예: `{ keyword, category_id: 1, sub_category_id: 3, match_type? }`

**GET /api/admin/accounting/expenses/keywords**
- 응답에 category_id, sub_category_id와 함께 대분류명, 이모지, 세부항목명 JOIN

### 4-5. 정기 비용 API 수정

**POST /api/admin/accounting/expenses/recurring**
- 요청 변경: `category` → `category_id`, `sub_category` → `sub_category_id`

### 4-6. 키워드 학습 로직 수정

학습 시 category, sub_category 텍스트 대신 category_id, sub_category_id를 저장합니다.
중복 방지 로직에서도 category_id로 비교합니다.

```
학습 시 중복 방지 로직:
  partialMatch.category_id === category_id  (텍스트 비교 대신 ID 비교)
```

---

## 5단계: 프론트엔드 UI 수정

> ⚠️ UI 변경 시 기존 프로젝트의 CSS, 글씨체, shadcn/ui 컴포넌트를 그대로 사용하세요.

### 5-1. 분류 데이터 로딩

페이지 로딩 시 `GET /api/admin/accounting/expense-categories`를 호출하여 전체 분류 체계를 가져옵니다. 이 데이터를 React 상태 또는 TanStack Query 캐시에 저장하고, 모든 분류 관련 UI에서 공유합니다.

### 5-2. 간편 등록 폼 수정

**분류 선택 UI 변경 (수동 선택 시):**

자동 분류 실패 시 나타나는 분류 선택 드롭다운을 **2단계 연동 셀렉트**로 변경:

```
대분류: [🚚 물류/배송비 ▼]     세부항목: [택배비 ▼]
```

1. 대분류 Select: expense_categories에서 가져온 목록 (이모지 + name 표시)
2. 대분류 선택 시 → 해당 대분류의 세부항목 목록이 세부항목 Select에 자동 로딩
3. 세부항목 Select: 선택한 대분류의 sub_categories 목록
4. 대분류 변경 시 세부항목 Select 초기화

**과세구분 자동 설정:**
- 대분류 선택 시 해당 대분류의 default_tax_type 값으로 과세구분 자동 설정
- 예: "인건비" 선택 → 자동으로 "면세" 설정 / "물류/배송비" 선택 → 자동으로 "과세" 설정
- 관리자가 수동으로 변경 가능

### 5-3. 자동완성 선택 시

자동완성 항목 선택 시 category_id, sub_category_id로 분류를 설정합니다. 대분류의 이모지와 이름을 표시합니다.

### 5-4. 분류 필터 탭 수정

분류 필터 탭을 하드코딩 대신 expense_categories 데이터에서 동적 생성:

```
[전체] [🚚물류/배송비 N] [👤인건비 N] [🏢시설/임대료 N] ... (DB에서 가져온 순서)
```

대분류를 추가하면 탭에 자동으로 나타남.

### 5-5. 요약 카드 수정

월간 비용 요약 카드도 expense_categories에서 동적 생성:

```
[총비용 카드] [🚚물류 N원] [👤인건 N원] [🏢시설 N원] ... (DB에서 가져온 순서)
```

### 5-6. 키워드 사전 관리 수정

**키워드 목록 테이블:**
- 대분류, 세부항목 컬럼에 expense_categories, expense_sub_categories의 name을 표시

**키워드 추가/수정 다이얼로그:**
- 대분류: 텍스트 입력 대신 → Select 드롭다운 (expense_categories 목록)
- 세부항목: 텍스트 입력 대신 → Select 드롭다운 (선택한 대분류의 sub_categories 목록)
- 이렇게 하면 오타 불가능, 일관성 보장

```
┌─────────────────────────────────────────┐
│  키워드 추가                              │
├─────────────────────────────────────────┤
│                                           │
│  키워드: [택배비______________]            │
│                                           │
│  ┌─────────────────────────────────┐     │
│  │ ⚠️ 유사 키워드가 이미 있습니다:    │     │
│  │  "택배" → 🚚 물류/배송비          │     │
│  │  (시스템, 사용 12회)              │     │
│  └─────────────────────────────────┘     │
│                                           │
│  대분류: [🚚 물류/배송비  ▼]  ← DB Select │
│                                           │
│  세부항목: [택배비  ▼]      ← 연동 Select  │
│                                           │
│  매칭 방식: ◉ 포함  ○ 완전일치            │
│                                           │
│              [취소]  [그래도 추가]         │
└─────────────────────────────────────────┘
```

### 5-7. 분류 체계 관리 UI (신규)

"⚙️ 분류 사전 관리" 다이얼로그에 **"분류 관리" 탭**을 추가합니다.
기존 "키워드" 탭 옆에 "분류 관리" 탭을 배치합니다.

```
┌──────────────────────────────────────────────────────────┐
│  ⚙️ 분류 사전 관리                                         │
│                                                            │
│  [키워드]  [분류 관리]  ← 2개 탭                            │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─ 🚚 물류/배송비 ──────────────────────────────────┐   │
│  │  세부항목: 택배비 | 화물운송비 | 배송비 | 포장재비      │   │
│  │  │ 도서산간추가비                                    │   │
│  │  [+ 세부항목 추가]                        [✏️ 수정]  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ 👤 인건비 ────────────────────────────────────────┐   │
│  │  세부항목: 급여 | 일용직 | 4대보험 | 퇴직금 | 상여금    │   │
│  │  [+ 세부항목 추가]                        [✏️ 수정]  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ┌─ 🏢 시설/임대료 ──────────────────────────────────┐   │
│  │  세부항목: 임대료 | 관리비 | 전기료 | 수도료 | 가스비   │   │
│  │  │ 냉장시설운영 | 창고비                              │   │
│  │  [+ 세부항목 추가]                        [✏️ 수정]  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│  ... (나머지 대분류)                                        │
│                                                            │
│  [+ 대분류 추가]                                           │
└──────────────────────────────────────────────────────────┘
```

**대분류 추가/수정 다이얼로그:**

```
┌─────────────────────────────────────┐
│  대분류 추가                          │
├─────────────────────────────────────┤
│                                       │
│  분류명: [________________]           │
│  이모지: [🚚]  (이모지 선택/입력)      │
│  색상: [blue ▼]                       │
│  기본 과세구분: [과세 ▼]              │
│                                       │
│              [취소]  [추가]           │
└─────────────────────────────────────┘
```

**세부항목 추가:**
- 해당 대분류 카드 내 "[+ 세부항목 추가]" 클릭 → 인라인 입력 또는 작은 다이얼로그
- 세부항목명 입력 → 추가
- 같은 대분류 안에서 중복 이름 체크

**삭제 안전장치:**
- 대분류 삭제 시: "이 분류를 사용 중인 비용이 N건, 키워드가 N건 있습니다. 삭제하시겠습니까?" 확인
  - 사용 중인 건이 있으면 삭제 불가 (먼저 다른 분류로 이동 필요)
- 세부항목 삭제 시: 같은 로직

### 5-8. 스프레드시트 모드 수정

분류 컬럼의 드롭다운을 expense_categories에서 동적 생성.
세부항목도 선택한 대분류에 따라 연동.

### 5-9. 정기 비용 관리 수정

정기 비용 추가/수정 시 분류 선택을 2단계 연동 Select로 변경.

### 5-10. 차트 수정

도넛차트, 라인차트의 분류별 데이터를 expense_categories에서 가져온 이모지+이름+색상으로 표시.

---

## 6단계: 자동완성 + 자동 분류 (기존 유지)

자동완성과 자동 분류 로직은 기존과 동일하되, 텍스트 대신 ID를 사용합니다.

### 자동완성 동작 (변경 없음)
1. 항목명 input에 1글자 이상 입력 시 → GET /autocomplete?q=입력값
2. 드롭다운 표시 (이모지 + 항목명 + 최근 금액)
3. ▲▼ 방향키 이동, Enter 선택, Esc 닫기
4. 선택 시 category_id, sub_category_id 자동 채움

### 키워드 학습 중복 방지 (기존 유지, ID 비교로 변경)

```
학습 시 비교:
  partialMatch.category_id === category_id  (텍스트 비교 → ID 비교)
```

### 유사 키워드 경고 (기존 유지)
키워드 추가 시 포함 관계 경고 기능은 그대로 유지.

---

## 7단계: 손익분석 연동 준비

기존과 동일:
```
매출총이익  = 매출(매출현황) - 매입(매입관리)
영업이익    = 매출총이익 - 비용(비용관리)

GET /api/admin/accounting/expenses/summary?month=YYYY-MM
  → totalExpense, byCategory 배열 (category_id, category_name, emoji, color, amount)
```

---

## 검증 체크리스트

### DB/마이그레이션 검증
1. ✅ expense_categories 테이블이 생성되고 8개 대분류가 등록되었는가?
2. ✅ expense_sub_categories 테이블이 생성되고 세부항목이 등록되었는가?
3. ✅ expenses, expense_keywords, expense_recurring의 기존 데이터가 category_id로 정상 마이그레이션되었는가?
4. ✅ 마이그레이션 후 기존 비용 목록이 정상 표시되는가?

### 분류 관리 API 검증
5. ✅ GET /expense-categories가 대분류 + 세부항목 nested로 응답하는가?
6. ✅ 대분류 추가/수정/삭제가 정상 동작하는가?
7. ✅ 세부항목 추가/수정/삭제가 정상 동작하는가?
8. ✅ 사용 중인 대분류/세부항목 삭제 시 차단되는가?
9. ✅ 같은 이름 중복 등록이 차단되는가?

### 기존 비용 기능 검증
10. ✅ 비용 등록 시 category_id, sub_category_id로 저장되는가?
11. ✅ 자동완성이 정상 동작하고 category_id를 반환하는가?
12. ✅ 자동 분류가 category_id를 반환하는가?
13. ✅ 키워드 학습이 category_id로 저장되는가?
14. ✅ 키워드 중복 방지가 category_id 기준으로 동작하는가?
15. ✅ 정기 비용이 category_id로 저장되고 생성되는가?

### UI 검증
16. ✅ 분류 선택이 2단계 연동 Select(대분류 → 세부항목)로 동작하는가?
17. ✅ 대분류 선택 시 과세구분이 자동 설정되는가?
18. ✅ 분류 필터 탭이 DB에서 동적 생성되는가?
19. ✅ 요약 카드가 DB에서 동적 생성되는가?
20. ✅ "분류 관리" 탭에서 대분류 카드 + 세부항목이 표시되는가?
21. ✅ 대분류 추가/수정이 동작하는가?
22. ✅ 세부항목 추가/삭제가 동작하는가?
23. ✅ 키워드 추가 시 대분류/세부항목이 Select 드롭다운으로 선택되는가?
24. ✅ 차트가 DB 분류 데이터로 정상 표시되는가?

### 기존 기능 보존 검증
25. ✅ 기존 회계장부 탭들(회원정산, 공급업체, 매입관리, 매출현황)이 정상 동작하는가?
26. ✅ **기존 CSS, 글씨체, 폰트가 변경 없이 100% 유지되는가?**
27. ✅ 기존 비용 데이터가 마이그레이션 후 정상 표시되는가?

결과를 한글로 보고해 주세요.
