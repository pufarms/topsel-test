# 회계장부 — 공급업체 관리 수정 (외주업체 + 직접 공급업체 분리)

## 작업 개요

현재 회계장부의 [공급업체 관리] 탭은 기존 외주업체(vendors)만 연동하고 있습니다.
이를 **외주업체 자동 연동 + 직접 공급업체 등록/수정** 두 가지 출처를 통합 관리하도록 수정합니다.

**핵심 개념:**
```
외주업체: 사이트에서 주문받은 상품을 대신 출고해주는 업체 (배분/출고 관리)
          → 기존 외주업체 관리 메뉴에서 등록 → 회계장부에 자동 연동 (읽기 전용)

공급업체: 원재료(원물/반재료/부자재 등)를 매입하는 업체 (매입/정산 관리)
          → 회계장부에서 직접 등록/수정/삭제 가능

한 업체가 외주 + 공급을 겸할 수 있음 → linked_vendor_id로 연결하여 통합 표시
```

⚠️ 중요 원칙:
- 기존 vendors 테이블과 외주업체 관리 기능은 절대 수정하지 마세요.
- 기존 회계장부의 다른 탭(회원정산, 매출현황)은 수정하지 마세요.
- 매입 관리, 매입 정산 탭은 공급업체 통합 참조 방식에 맞게 수정합니다.
- 작업 진행 상황과 결과는 항상 한글로 보여주세요.

---

## [1단계] DB 스키마 변경

### 1-1. vendors 테이블에 회계 필드 추가 (기존 필드 수정 없음)

⚠️ vendors 테이블에 이미 supply_type, business_number, address 필드가 있다면 이 단계는 건너뛰세요. 먼저 확인하세요.

```sql
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS supply_type TEXT[] DEFAULT '{}';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS business_number VARCHAR(20);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address TEXT;
```

### 1-2. suppliers 테이블 신규 생성

schema.ts에 suppliers 테이블을 추가하세요:

```typescript
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  representative: varchar("representative", { length: 50 }),
  businessNumber: varchar("business_number", { length: 20 }),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 100 }),
  address: text("address"),
  supplyType: text("supply_type").array().notNull().default([]),  // ['raw','semi','subsidiary','etc']
  supplyItems: text("supply_items"),         // 취급 품목 자유 텍스트
  paymentMethod: varchar("payment_method", { length: 20 }),  // transfer, cash, bill
  bankName: varchar("bank_name", { length: 50 }),
  accountNumber: varchar("account_number", { length: 50 }),
  accountHolder: varchar("account_holder", { length: 50 }),
  memo: text("memo"),
  isActive: boolean("is_active").notNull().default(true),
  linkedVendorId: integer("linked_vendor_id").references(() => vendors.id),  // 외주업체 연결
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

⚠️ 반드시 `vendors` 테이블 정의 뒤에 위치하세요 (참조 관계 때문).

### 1-3. purchases 테이블 수정

현재 purchases 테이블에 supplier_id 컬럼을 추가하고, vendor_id를 nullable로 변경:

```typescript
// purchases 테이블 수정
// vendor_id: nullable로 변경 (기존 .notNull() 제거)
// supplier_id: 추가
supplierId: integer("supplier_id").references(() => suppliers.id),
// vendor_id 또는 supplier_id 중 하나는 반드시 있어야 함 (API에서 검증)
```

⚠️ vendor_id를 nullable로 변경할 때 기존 데이터에 영향 없는지 확인하세요. 기존 매입 데이터는 모두 vendor_id가 있으므로 문제없습니다.

### 1-4. vendor_payments 테이블 수정

현재 vendor_payments 테이블에도 supplier_id 컬럼을 추가:

```typescript
// vendor_payments 테이블 수정
// vendor_id: nullable로 변경
// supplier_id: 추가
supplierId: integer("supplier_id").references(() => suppliers.id),
```

### 1-5. DB 스키마 적용

```bash
npx drizzle-kit push
```

---

## [2단계] 백엔드 API 구현

### 2-1. 직접 공급업체 CRUD

```
POST /api/admin/accounting/suppliers
```
body:
```json
{
  "name": "대구농산",          // 필수
  "representative": "이정수",
  "businessNumber": "123-45-67890",
  "phone": "010-3456-7890",
  "email": "daegu@farm.com",
  "address": "대구시 달성군...",
  "supplyType": ["raw"],       // 필수, 배열: raw/semi/subsidiary/etc
  "supplyItems": "사과, 배, 복숭아",
  "paymentMethod": "transfer",
  "bankName": "농협",
  "accountNumber": "123-4567-8901-23",
  "accountHolder": "이정수",
  "memo": "",
  "linkedVendorId": null       // 외주업체 연결 시 vendors.id, 없으면 null
}
```

validation:
- name: 필수, 1자 이상
- supplyType: 필수, 1개 이상 선택
- linkedVendorId: null 또는 유효한 vendors.id (이미 다른 supplier에 연결된 vendor는 불가)

```
PUT /api/admin/accounting/suppliers/:id
```
- 위와 동일한 body, 해당 supplier의 모든 필드 수정 가능

```
DELETE /api/admin/accounting/suppliers/:id
```
- 거래이력(purchases 또는 vendor_payments에 supplier_id 참조)이 있으면 → is_active = false로 비활성화
- 거래이력 없으면 → 실제 삭제

### 2-2. 외주업체 회계 설정

```
PUT /api/admin/accounting/vendors/:id/settings
```
body:
```json
{
  "supplyType": ["raw"],
  "businessNumber": "123-45-67890",
  "address": "경북 안동시..."
}
```
- supply_type, business_number, address만 수정 가능
- 기존 외주업체의 다른 필드(name, phone 등)는 수정하지 않음

### 2-3. 통합 공급업체 목록 API (핵심!)

```
GET /api/admin/accounting/vendors
```

쿼리 파라미터: search (업체명), supplyType (필터), source (all/vendor/supplier)

**로직:**
1. suppliers 테이블에서 is_active=true인 업체 조회
2. vendors 테이블에서 isActive=true이고, suppliers에 linked_vendor_id로 연결되지 않은 업체 조회
3. 두 결과를 UNION하여 통합 목록 생성
4. 각 업체의 외상잔액 계산 포함

**응답 형태:**
```json
{
  "vendors": [
    {
      "id": "vendor-1",          // "vendor-{id}" 또는 "supplier-{id}" 형식
      "source": "vendor",        // "vendor" | "supplier" | "both"
      "vendorId": 1,             // vendors.id (외주업체인 경우)
      "supplierId": null,        // suppliers.id (직접 등록인 경우)
      "name": "행복농장",
      "representative": "김철수",
      "phone": "010-1234-5678",
      "businessNumber": "123-45-67890",
      "supplyType": ["raw"],
      "supplyItems": "사과, 배",
      "bankName": "농협",
      "accountNumber": "123-4567-8901-23",
      "accountHolder": "김철수",
      "outstandingBalance": 1230000,  // 외상잔액
      "isEditable": false              // vendor=false, supplier=true
    },
    {
      "id": "supplier-5",
      "source": "supplier",
      "vendorId": null,
      "supplierId": 5,
      "name": "대구농산",
      "representative": "이정수",
      "phone": "010-3456-7890",
      "businessNumber": "456-78-90123",
      "supplyType": ["raw"],
      "supplyItems": "사과, 배, 복숭아",
      "bankName": "농협",
      "accountNumber": "456-7890-1234-56",
      "accountHolder": "이정수",
      "outstandingBalance": 890000,
      "isEditable": true
    },
    {
      "id": "supplier-7",
      "source": "both",           // 외주 + 공급 겸업
      "vendorId": 3,              // 연결된 vendor
      "supplierId": 7,
      "name": "한라과수원",
      "representative": "박한라",
      "outstandingBalance": 450000,
      "isEditable": true           // supplier 부분은 수정 가능
    }
  ],
  "totalOutstanding": 3630000
}
```

**source 판단 로직:**
- vendors에만 있음 → source: "vendor"
- suppliers에만 있음 (linkedVendorId=null) → source: "supplier"
- suppliers에 있고 linkedVendorId가 설정됨 → source: "both"

**외상잔액 계산 (linked_vendor_id 통합):**
```
source="vendor": SUM(purchases where vendor_id=X) + SUM(사이트 매입 where vendorId=X) - SUM(vendor_payments where vendor_id=X)
source="supplier": SUM(purchases where supplier_id=X) - SUM(vendor_payments where supplier_id=X)
source="both": vendor의 매입+사이트매입 + supplier의 매입 - vendor의 입금 - supplier의 입금 (모두 합산)
```

### 2-4. 매입 등록용 드롭다운 API

```
GET /api/admin/accounting/vendors/dropdown
```

응답:
```json
{
  "items": [
    { "value": "vendor-1", "label": "행복농장 (외주)", "vendorId": 1, "supplierId": null, "supplyType": ["raw"] },
    { "value": "supplier-5", "label": "대구농산", "vendorId": null, "supplierId": 5, "supplyType": ["raw"] },
    { "value": "supplier-7", "label": "한라과수원 (외주+공급)", "vendorId": 3, "supplierId": 7, "supplyType": ["raw"] }
  ]
}
```

- 매입 등록 시 이 드롭다운에서 업체 선택
- 선택한 업체의 vendorId 또는 supplierId를 purchases에 저장

---

## [3단계] 프론트엔드 — 공급업체 관리 탭 수정

### 3-1. VendorManagementTab.tsx 수정

현재 파일을 수정하여 두 가지 출처를 통합 표시합니다.

**목록 화면:**
- 상단: [+ 공급업체 등록] 버튼 추가
- 필터: 업체명 검색 + 공급유형 필터 + 출처 필터 (전체/외주연동/직접등록)
- 테이블 컬럼: 출처 배지, 업체명, 대표자, 연락처, 공급유형, 외상잔액, 액션
- 출처 배지:
  - 🔗외주 (파란색 배지): source="vendor"
  - ✏️직접 (초록색 배지): source="supplier"
  - 🔗+✏️ (보라색 배지): source="both"
- 액션 버튼:
  - source="vendor" → [설정] (회계 추가 정보만)
  - source="supplier" 또는 "both" → [수정] (모든 정보)
- 외상잔액 클릭 → 매입 정산 탭으로 이동
- 하단: 총 외상 잔액 합계

### 3-2. 공급업체 등록 모달 (직접 등록)

[+ 공급업체 등록] 클릭 시 모달:

**입력 필드:**
| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| 업체명 | text | ✅ | 공급업체 이름 |
| 대표자명 | text | | 대표자 |
| 사업자번호 | text | | 000-00-00000 형식 |
| 연락처 | text | | 전화번호 |
| 이메일 | text | | 이메일 |
| 주소 | text | | 주소 |
| 공급 유형 | multi-checkbox | ✅ | 원물/반재료/부자재/기타 (1개 이상) |
| 취급 품목 | text | | 자유 텍스트 |
| 결제 방식 | select | | 계좌이체/현금/어음 |
| 은행명 | text | | 입금 은행 |
| 계좌번호 | text | | 입금 계좌 |
| 예금주 | text | | 예금주 |
| 외주업체 연결 | checkbox + select | | 기존 외주업체와 동일 업체인 경우 연결 |
| 메모 | textarea | | 특이사항 |

**외주업체 연결 섹션:**
- [☑️ 기존 외주업체와 동일한 업체입니다] 체크박스
- 체크하면 → 외주업체 선택 드롭다운 표시 (이미 연결된 외주업체는 목록에서 제외)
- 연결하면 장부에서 하나의 업체로 통합 표시됨을 안내

### 3-3. 외주업체 회계 설정 모달

source="vendor"인 업체의 [설정] 클릭 시:
- 기본 정보 표시 (읽기 전용, 회색 배경)
- 회계 추가 정보 입력: 공급 유형, 사업자번호, 주소
- "기본 정보 수정은 [외주업체 관리]에서 합니다" 안내

### 3-4. 직접 공급업체 수정 모달

source="supplier" 또는 "both"인 업체의 [수정] 클릭 시:
- 등록 모달과 동일한 필드, 기존 값 채워서 표시
- source="both"인 경우: 외주업체 연결 표시 (이미 연결됨, 해제 가능)

### 3-5. 삭제 처리

- 직접 공급업체만 삭제 가능 (외주업체는 삭제 불가)
- 거래이력 있으면 확인 대화상자: "거래이력이 있어 비활성화됩니다"
- 거래이력 없으면: "이 업체를 삭제하시겠습니까?"

---

## [4단계] 매입 관리 탭 수정

### 4-1. 매입 등록 시 공급업체 선택

현재 매입 등록에서 업체 선택 드롭다운을 **통합 목록**으로 변경:

- GET /api/admin/accounting/vendors/dropdown API 호출
- 드롭다운 항목: "업체명 (외주)" 또는 "업체명" 형태
- 선택 시:
  - vendorId가 있으면 → purchases.vendor_id에 저장
  - supplierId가 있으면 → purchases.supplier_id에 저장
  - 둘 다 있으면(both) → purchases.supplier_id에 저장 (직접 매입이므로)

### 4-2. 매입 목록에서 업체명 표시

기존에 vendor_id로 업체명을 가져오던 부분을 수정:
- vendor_id가 있으면 → vendors 테이블에서 이름 조회
- supplier_id가 있으면 → suppliers 테이블에서 이름 조회

---

## [5단계] 매입 정산 탭 수정

### 5-1. 업체별 외상 현황

통합 공급업체 목록 기준으로 외상 현황 표시:
- 외주업체: 사이트 매입(자동) + 직접 매입(수기) - 입금 합계
- 직접 공급업체: 직접 매입(수기) - 입금 합계
- 겸업 업체: 모든 경로의 매입 합산 - 모든 경로의 입금 합산

### 5-2. 입금 등록 시 업체 참조

입금 등록 시:
- 외주업체(vendor) 대상 입금 → vendor_payments.vendor_id 저장
- 직접 공급업체(supplier) 대상 입금 → vendor_payments.supplier_id 저장
- 겸업(both) 대상 입금 → vendor_payments.supplier_id 저장

### 5-3. 거래 내역 표시

업체 클릭 시 거래 내역:
- 겸업 업체의 경우 vendor_id와 supplier_id 양쪽의 매입/입금을 모두 합쳐서 시간순 표시

---

## [6단계] 검증

구현 완료 후 아래 항목을 확인하세요:

1. ✅ suppliers 테이블 정상 생성
2. ✅ 공급업체 관리 탭에서 외주업체 자동 연동 (읽기 전용)
3. ✅ [+ 공급업체 등록] → 직접 공급업체 등록 정상
4. ✅ 직접 공급업체 수정/삭제(비활성화) 정상
5. ✅ 외주업체 [설정] → 회계 정보(공급유형, 사업자번호) 저장 정상
6. ✅ 외주업체 연결 (linked_vendor_id) → 통합 표시 정상
7. ✅ 매입 등록 시 통합 드롭다운에서 업체 선택 정상
8. ✅ vendor_id 또는 supplier_id가 purchases에 정상 저장
9. ✅ 매입 정산에서 외상잔액 정상 계산 (통합)
10. ✅ 겸업 업체(both)의 거래내역이 하나로 합쳐져 표시
11. ✅ 기존 매입 데이터(vendor_id만 있는 건) 정상 표시
12. ✅ 기존 외주업체 관리 기능 영향 없음

결과를 한글로 보고해 주세요.
