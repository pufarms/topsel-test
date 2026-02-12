# 회계장부 — 매출 현황 탭 구현

## 작업 개요

회계장부의 [매출 현황] 탭(현재 placeholder)을 완전히 구현합니다.
매출 현황은 **사이트 매출(자동 연동) + 직접 매출(수기 입력) + 세금계산서(포인터 제외)** 3개 영역으로 구성됩니다.

⚠️ 중요 원칙:
- 기존 회계장부의 다른 탭(회원정산, 공급업체, 매입, 매입정산)은 수정하지 마세요.
- 기존 테이블(orders, pending_orders, settlement_history, members, direct_sales)을 활용합니다.
- direct_sales 테이블은 이미 DB에 생성되어 있습니다.
- 작업 진행 상황과 결과는 항상 한글로 보여주세요.

---

## 화면 구조

매출 현황 탭은 3개 서브 섹션으로 구성됩니다:

```
[매출 현황] 탭
├─ 월별 매출 요약 (세금계산서 기준) ← 상단
├─ 일별 매출 상세 ← 중단
└─ 직접 매출 관리 ← 하단
```

---

## [1단계] 백엔드 API 구현

### 1-1. 통합 매출 현황 API

```
GET /api/admin/accounting/sales
```

쿼리 파라미터: startDate, endDate

응답:
```json
{
  "siteSales": {
    "total": 8456000,
    "count": 127
  },
  "directSales": {
    "total": 800000,
    "count": 3
  },
  "totalSales": 9256000
}
```

로직:
- 사이트 매출: orders 테이블에서 status IN ('shipping', 'delivered', 'completed')이고 해당 기간에 속하는 주문의 총 금액
- 직접 매출: direct_sales 테이블에서 해당 기간 합계
- 총 매출 = 사이트 매출 + 직접 매출

### 1-2. 일별 매출 집계 API

```
GET /api/admin/accounting/sales/daily
```

쿼리 파라미터: startDate, endDate

응답:
```json
{
  "daily": [
    {
      "date": "2026-02-11",
      "siteSales": 768000,
      "directSales": 300000,
      "total": 1068000,
      "changeRate": 12.3
    },
    ...
  ]
}
```

로직:
- 사이트 매출은 orders의 createdAt(또는 배송확정일) 기준으로 일별 집계
- 직접 매출은 direct_sales의 sale_date 기준으로 일별 집계
- changeRate = 전일 대비 변화율 (%)
- 일별 데이터를 UNION하여 날짜별로 합산

### 1-3. 회원별 월간 세금계산서 발행액 API (핵심!)

```
GET /api/admin/accounting/sales/monthly-by-member
```

쿼리 파라미터: year, month (예: 2026, 2)

응답:
```json
{
  "year": 2026,
  "month": 2,
  "closingStatus": "open",
  "deadline": "2026-03-10",
  "members": [
    {
      "memberId": 1,
      "memberName": "프레시마트",
      "businessName": "프레시마트",
      "businessNumber": "123-45-67890",
      "representative": "김영수",
      "orderCount": 38,
      "totalOrderAmount": 2536000,
      "pointerUsed": 336000,
      "taxInvoiceAmount": 2200000,
      "supplyAmount": 2000000,
      "vatAmount": 200000
    },
    ...
  ],
  "totals": {
    "totalOrderAmount": 8456000,
    "pointerUsed": 643000,
    "taxInvoiceAmount": 7813000,
    "supplyAmount": 7102728,
    "vatAmount": 710272
  }
}
```

⚠️ **핵심 로직 — 포인터 제외:**

```
세금계산서 발행액(taxInvoiceAmount) = 총 주문금액 - 포인터 사용액
공급가액(supplyAmount) = 세금계산서 발행액 ÷ 1.1 (소수점 이하 반올림)
부가세(vatAmount) = 세금계산서 발행액 - 공급가액
```

SQL 참고:
```sql
-- settlement_history 테이블에서 예치금/포인터 구분하여 집계
-- type='pointer' → 포인터 차감, type='deposit' → 예치금 차감
-- 세금계산서 대상 = 예치금 차감분만 (포인터 제외)

SELECT
  m.id AS member_id,
  m.name AS member_name,
  m."businessName",
  m."businessNumber",
  COUNT(DISTINCT o.id) AS order_count,
  SUM(sh.amount) AS total_order_amount,
  SUM(CASE WHEN sh.type = 'pointer' THEN sh.amount ELSE 0 END) AS pointer_used,
  SUM(CASE WHEN sh.type = 'deposit' THEN sh.amount ELSE 0 END) AS tax_invoice_amount
FROM settlement_history sh
JOIN orders o ON o.id = sh."orderId"
JOIN members m ON m.id = o."memberId"
WHERE o.status IN ('shipping', 'delivered', 'completed')
  AND sh."createdAt" >= '해당 월 1일'
  AND sh."createdAt" < '다음 월 1일'
GROUP BY m.id, m.name, m."businessName", m."businessNumber"
ORDER BY tax_invoice_amount DESC;
```

⚠️ settlement_history 테이블의 실제 컬럼명을 먼저 확인하세요. type, amount, orderId, createdAt 등의 실제 컬럼명이 다를 수 있습니다. 반드시 기존 DB 스키마(schema.ts)를 확인한 후 쿼리를 작성하세요.

마감 상태(closingStatus) 판단:
- 해당 월이 현재 월: "open" (진행중)
- 해당 월이 지난 달이고 현재 날짜가 10일 이전: "warning" (발행 기한 임박)
- 해당 월이 지난 달이고 현재 날짜가 10일 이후: "overdue" (기한 초과)
- 그 외 과거 월: "closed" (마감 완료)

### 1-4. 특정 회원 월간 주문 상세 API

```
GET /api/admin/accounting/sales/member/:memberId/monthly-detail
```

쿼리 파라미터: year, month

응답:
```json
{
  "member": {
    "id": 1,
    "name": "프레시마트",
    "businessName": "프레시마트",
    "businessNumber": "123-45-67890",
    "representative": "김영수",
    "phone": "010-1234-5678"
  },
  "orders": [
    {
      "orderId": 101,
      "orderNumber": "ORD-20260203-01",
      "orderDate": "2026-02-03",
      "items": [
        { "productName": "사과10kg", "quantity": 5, "unitPrice": 40000, "amount": 200000 },
        { "productName": "배7.5kg", "quantity": 3, "unitPrice": 42000, "amount": 126000 }
      ],
      "orderTotal": 326000,
      "pointerUsed": 26000,
      "depositUsed": 300000
    },
    ...
  ],
  "summary": {
    "totalOrderAmount": 2536000,
    "pointerUsed": 336000,
    "taxInvoiceAmount": 2200000,
    "supplyAmount": 2000000,
    "vatAmount": 200000
  }
}
```

### 1-5. 세금계산서용 엑셀 다운로드 API

```
GET /api/admin/accounting/sales/tax-invoice-export
```

쿼리 파라미터: year, month

엑셀 컬럼:
| 공급받는자(상호) | 사업자번호 | 대표자 | 주문건수 | 총주문액 | 포인터사용 | 발행대상액 | 공급가액 | 부가세 |

xlsx 파일로 다운로드. SheetJS(xlsx) 라이브러리 사용.

### 1-6. 직접 매출 CRUD API

direct_sales 테이블은 이미 존재합니다. API만 추가:

```
GET /api/admin/direct-sales?startDate=&endDate=
POST /api/admin/direct-sales  (body: { saleDate, clientName, description, amount, memo })
PUT /api/admin/direct-sales/:id  (body: { saleDate, clientName, description, amount, memo })
DELETE /api/admin/direct-sales/:id
```

POST 시 validation:
- saleDate: 필수, 날짜 형식
- clientName: 필수, 1자 이상
- description: 필수, 1자 이상
- amount: 필수, 1 이상 정수

⚠️ 인증: 기존 admin 체크 패턴을 따르세요:
```typescript
const userId = req.session?.userId;
if (!userId) return res.status(401).json({ error: "인증 필요" });
const user = await storage.getUser(userId);
if (!user || user.role !== "admin") return res.status(403).json({ error: "권한 없음" });
```

---

## [2단계] 프론트엔드 — SalesOverviewTab.tsx 구현

현재 placeholder인 SalesOverviewTab.tsx를 교체합니다.

### 2-1. 탭 내부 3개 섹션 구조

```tsx
function SalesOverviewTab() {
  return (
    <div>
      {/* 섹션 1: 월별 매출 요약 (세금계산서 기준) */}
      <MonthlySalesSummary />
      
      {/* 섹션 2: 일별 매출 상세 */}
      <DailySalesDetail />
      
      {/* 섹션 3: 직접 매출 관리 */}
      <DirectSalesManagement />
    </div>
  );
}
```

### 2-2. 섹션 1: 월별 매출 요약 (세금계산서 기준)

**UI 구성:**
- 상단: 월 선택 드롭다운 + 마감 상태 배지
  - 🟢 마감 완료 (closed)
  - 🟡 진행중 (open)
  - 🔴 발행 기한 임박/초과 (warning/overdue)
- 매출 요약 카드: 총 매출, 사이트 매출, 직접 매출
- **회원별 세금계산서 발행액 테이블** (핵심):
  - 컬럼: 회원명(업체명), 사업자번호, 주문건수, 총주문액, 포인터사용, 발행대상액, 공급가액, 부가세
  - 합계 행
  - ⚠️ 안내 문구: "포인터 사용분은 세금계산서 발행 대상에서 제외됩니다."
- 하단: [📥 세금계산서용 엑셀 다운로드] 버튼
- **회원명 클릭 → 월간 주문 상세 모달**

**API 호출:**
- GET /api/admin/accounting/sales/monthly-by-member?year=2026&month=2
- GET /api/admin/accounting/sales?startDate=2026-02-01&endDate=2026-02-28

### 2-3. 회원 클릭 시 — 월간 주문 상세 모달

**UI 구성:**
```
[모달]
프레시마트 — 2026년 2월 공급 내역

사업자번호: 123-45-67890
대표자: 김영수  |  연락처: 010-1234-5678

[주문 상세 테이블]
날짜 | 주문번호 | 상품명 | 수량 | 단가 | 금액 | 포인터 | 예치금

합계: 2,536,000원
포인터 사용: -336,000원
세금계산서 발행액: 2,200,000원
공급가액: 2,000,000원  |  부가세: 200,000원

[📥 공급 내역 엑셀 다운로드]
```

**API 호출:**
- GET /api/admin/accounting/sales/member/:memberId/monthly-detail?year=2026&month=2

### 2-4. 섹션 2: 일별 매출 상세

**UI 구성:**
- 기간 필터: 시작일 ~ 종료일 (기본: 이번 달)
- 구분 필터: 전체 / 사이트 매출 / 직접 매출
- 일별 테이블:
  - 컬럼: 날짜, 사이트 매출, 직접 매출, 합계, 일 변화(%)
  - 합계 행

**API 호출:**
- GET /api/admin/accounting/sales/daily?startDate=&endDate=

### 2-5. 섹션 3: 직접 매출 관리

**UI 구성:**
- [+ 직접 매출 등록] 버튼
- 직접 매출 목록 테이블:
  - 컬럼: 체크박스, 날짜, 거래처명, 내용, 금액, 메모
  - 수정/삭제 가능
- 등록/수정 모달:
  - 매출일 (date, 기본: 오늘)
  - 거래처명 (text, 필수)
  - 내용 (text, 필수)
  - 금액 (number, 필수)
  - 메모 (text, 선택)

**API 호출:**
- GET /api/admin/direct-sales?startDate=&endDate=
- POST /api/admin/direct-sales
- PUT /api/admin/direct-sales/:id
- DELETE /api/admin/direct-sales/:id

---

## [3단계] 데이터 연동 확인

### 3-1. settlement_history 테이블 확인 (중요!)

⚠️ 반드시 settlement_history (또는 유사한 정산 이력 테이블)의 **실제 스키마**를 먼저 확인하세요:
- 테이블명이 다를 수 있음 (settlementHistory, settlement_history 등)
- type 컬럼의 실제 값 확인 ('pointer', 'deposit' 또는 다른 값일 수 있음)
- orderId 컬럼명 확인 (orderId, order_id 등)
- amount가 양수인지, 차감액이 음수인지 부호 확인

```typescript
// schema.ts에서 확인할 것:
// 1. settlement_history 테이블의 컬럼 목록
// 2. type enum 값 확인
// 3. amount 부호 규칙 확인
// 4. orders 테이블의 status enum 값 확인 ('shipping', 'delivered', 'completed' 등)
```

### 3-2. 사이트 매출 기준

기존 orders 테이블에서:
- status IN ('shipping', 'delivered', 'completed') 인 주문만 매출로 인정
- 주문 금액 = orders 테이블의 totalAmount (또는 order_items 합계)
- ⚠️ orders 테이블의 실제 금액 필드명을 확인하세요 (totalAmount, total, amount 등)

---

## [4단계] 검증

구현 완료 후 아래 항목을 확인하세요:

1. 매출 현황 탭 클릭 시 3개 섹션 정상 표시
2. 월 선택 드롭다운으로 월 변경 가능
3. 마감 상태 배지 정상 표시 (현재 월 = 🟡, 지난 달 = 🟢 또는 🔴)
4. 회원별 세금계산서 테이블에 포인터 사용분이 정확히 차감됨
5. 회원명 클릭 시 월간 주문 상세 모달 표시
6. 세금계산서용 엑셀 다운로드 동작
7. 일별 매출 테이블에서 사이트/직접 매출 구분 표시
8. 직접 매출 등록/수정/삭제 정상 동작
9. 직접 매출 등록 시 일별 매출 + 총 매출에 즉시 반영
10. 기존 4개 탭(회원정산, 공급업체, 매입, 매입정산) 정상 동작 확인

결과를 한글로 보고해 주세요.
