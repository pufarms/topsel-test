# 상품등록 (공급가 계산) 저장 로직 구현 요청

## 📋 개요

"상품관리 > 상품등록(공급가 계산)" 페이지의 **저장 로직**을 구현해주세요.
모든 작업 데이터는 **자동 저장**되며, "차주 예상공급가 상품으로 전송" 버튼 클릭 시에만 다음 단계로 반영됩니다.

---

## 🗂️ 저장소 구조 (2개 분리)

```
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│  저장소 1: product_registrations    │     │  저장소 2: next_week_products        │
│  (상품등록 - 작업 중인 데이터)        │     │  (차주 예상공급가 - 전송된 데이터)    │
│                                     │     │                                     │
│  - 자동 저장됨                       │ ──→ │  - "전송" 버튼 클릭 시에만 반영       │
│  - 삭제하지 않으면 계속 보존          │     │  - 회원들이 볼 수 있음               │
│  - 관리자만 접근                     │     │                                     │
└─────────────────────────────────────┘     └─────────────────────────────────────┘
```

### 핵심 원칙

| 저장소 | 용도 | 저장 방식 |
|--------|------|----------|
| **저장소 1** (product_registrations) | 관리자 작업 공간 | **자동 저장** |
| **저장소 2** (next_week_products) | 회원 공개용 | **"전송" 버튼 클릭 시에만** |

---

## 🔄 데이터 흐름도

```
[엑셀 업로드] ──┐
               │
               ▼
[수기 등록] ───→ [상품등록(공급가 계산) 테이블] ──자동저장──→ [저장소 1: product_registrations]
               │
               │  (관리자가 작업 중...)
               │  - 값 수정 → 자동 저장
               │  - 행 추가 → 자동 저장
               │  - 선택 삭제 → 해당 데이터 삭제
               │
               ▼
        ["차주 예상공급가 상품으로 전송" 버튼 클릭]
               │
               │  (검증 통과 시에만!)
               ▼
        [저장소 2: next_week_products] ──→ 회원들이 볼 수 있음
```

---

## ✅ 동작별 저장 규칙

| 동작 | 저장소 1 (상품등록) | 저장소 2 (차주 예상공급가) |
|------|:------------------:|:------------------------:|
| **엑셀 업로드** | ✅ 즉시 자동 저장 | ❌ 반영 안 됨 |
| **수기 등록 (새 행 추가)** | ✅ 즉시 자동 저장 | ❌ 반영 안 됨 |
| **셀 값 수정** | ✅ 즉시 자동 저장 | ❌ 반영 안 됨 |
| **선택 삭제** | ✅ 해당 데이터 삭제 | ❌ 반영 안 됨 |
| **"차주 예상공급가로 전송" 클릭** | 그대로 유지 | ✅ 이때만 반영 |

---

## 💾 자동 저장 구현

### 자동 저장 시점

| 시점 | 동작 |
|------|------|
| **엑셀 업로드 완료** | 업로드된 모든 행을 DB에 즉시 저장 |
| **새 행 추가** | 새 행을 DB에 즉시 저장 |
| **셀 값 변경** | 변경된 값을 DB에 저장 (디바운스 500ms) |
| **선택 삭제** | 선택된 행을 DB에서 삭제 |

### 디바운스 적용 (셀 값 변경 시)

```javascript
// 사용자가 입력을 멈춘 후 500ms 후에 저장
const debouncedSave = useMemo(
  () => debounce((productId, field, value) => {
    saveToDatabase(productId, field, value);
  }, 500),
  []
);

// 셀 값 변경 시
const handleCellChange = (productId, field, value) => {
  // 1. 화면에 즉시 반영
  updateLocalState(productId, field, value);
  
  // 2. 자동계산 컬럼 업데이트
  recalculatePrices(productId);
  
  // 3. 500ms 후 DB 저장
  debouncedSave(productId, field, value);
};
```

### 저장 상태 표시

```jsx
// 화면 우측 하단에 작은 저장 상태 표시
<div className="fixed bottom-4 right-4 text-sm text-gray-500">
  {isSaving ? (
    <span className="flex items-center gap-1">
      <Spinner size="sm" /> 저장 중...
    </span>
  ) : (
    <span className="flex items-center gap-1">
      <CheckIcon className="w-4 h-4 text-green-500" /> 저장됨
    </span>
  )}
</div>
```

---

## 🚀 "차주 예상공급가 상품으로 전송" 로직

### 전송 프로세스

```javascript
const handleSendToNextWeek = async () => {
  // 1. 저장소 1에서 데이터 가져오기
  const products = await getProductRegistrations();
  
  // 2. 공급가 검증
  const invalidProducts = products.filter(p => 
    !p.startPrice || !p.drivingPrice || !p.topPrice
  );
  
  if (invalidProducts.length > 0) {
    // ⚠️ 공급가 없는 상품 발견 - 전송 중단
    showAlert({
      type: 'error',
      title: '전송 실패',
      message: `상품코드 [${invalidProducts[0].productCode}]의 공급가가 없습니다. 마진율을 입력해주세요.`,
      // 여러 개면 모두 표시
      details: invalidProducts.map(p => p.productCode)
    });
    return; // 전송 중단
  }
  
  // 3. 신규 상품 확인
  const existingCodes = await getNextWeekProductCodes();
  const newProducts = products.filter(p => !existingCodes.includes(p.productCode));
  
  if (newProducts.length > 0) {
    // ℹ️ 신규 상품 안내
    const confirmed = await showConfirm({
      type: 'info',
      title: '신규 상품 추가',
      message: `신규 상품 ${newProducts.length}개가 추가됩니다.`,
      details: newProducts.map(p => `${p.productCode} - ${p.productName}`),
      confirmText: '전송',
      cancelText: '취소'
    });
    
    if (!confirmed) return; // 취소 시 중단
  }
  
  // 4. 저장소 2에 반영
  await sendToNextWeekProducts(products);
  
  // 5. 성공 알림
  showAlert({
    type: 'success',
    title: '전송 완료',
    message: `${products.length}개 상품이 차주 예상공급가로 전송되었습니다.`
  });
  
  // 6. 저장소 1 데이터는 그대로 유지 (삭제하지 않음)
};
```

### 저장소 2 반영 로직

```javascript
const sendToNextWeekProducts = async (products) => {
  for (const product of products) {
    const existing = await findByProductCode(product.productCode);
    
    if (existing) {
      // 상품코드 존재 → 업데이트
      await updateNextWeekProduct(existing.id, {
        productName: product.productName,
        categoryLarge: product.categoryLarge,
        categoryMedium: product.categoryMedium,
        categorySmall: product.categorySmall,
        weight: product.weight,
        startPrice: product.startPrice,
        drivingPrice: product.drivingPrice,
        topPrice: product.topPrice,
        supplyStatus: 'supply',
        updatedAt: new Date()
      });
    } else {
      // 상품코드 없음 → 신규 추가
      await createNextWeekProduct({
        productCode: product.productCode,
        productName: product.productName,
        categoryLarge: product.categoryLarge,
        categoryMedium: product.categoryMedium,
        categorySmall: product.categorySmall,
        weight: product.weight,
        startPrice: product.startPrice,
        drivingPrice: product.drivingPrice,
        topPrice: product.topPrice,
        supplyStatus: 'supply',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
};
```

---

## 🔔 알림 시스템

### 알림 종류

| 상황 | 타입 | 색상 | 메시지 |
|------|------|------|--------|
| **공급가 없음** | error | 🔴 빨간색 | "상품코드 [XXX]의 공급가가 없습니다. 마진율을 입력해주세요." |
| **신규 상품 추가** | info | 🔵 파란색 | "신규 상품 N개가 추가됩니다." |
| **전송 성공** | success | 🟢 초록색 | "N개 상품이 차주 예상공급가로 전송되었습니다." |
| **자동 저장** | - | 회색 (작게) | "저장됨" (우측 하단) |

### 알림 UI 예시

```jsx
// 에러 알림 (공급가 없음)
<Alert type="error">
  <AlertTitle>전송 실패</AlertTitle>
  <AlertDescription>
    상품코드 [A001]의 공급가가 없습니다. 마진율을 입력해주세요.
  </AlertDescription>
  <AlertDetails>
    공급가 없는 상품 목록:
    - A001 (부사사과 3kg)
    - B002 (신고배 5kg)
  </AlertDetails>
</Alert>

// 확인 모달 (신규 상품)
<ConfirmModal>
  <ModalTitle>신규 상품 추가</ModalTitle>
  <ModalDescription>
    신규 상품 3개가 추가됩니다.
  </ModalDescription>
  <ModalDetails>
    - C001 (거봉포도 2kg)
    - C002 (샤인머스캣 1kg)
    - C003 (캠벨포도 4kg)
  </ModalDetails>
  <ModalActions>
    <Button variant="outline">취소</Button>
    <Button variant="primary">전송</Button>
  </ModalActions>
</ConfirmModal>

// 성공 알림
<Alert type="success">
  <AlertTitle>전송 완료</AlertTitle>
  <AlertDescription>
    15개 상품이 차주 예상공급가로 전송되었습니다.
  </AlertDescription>
</Alert>
```

---

## 🗃️ API 엔드포인트

### 자동 저장 관련

```
# 상품등록 (저장소 1)
GET    /api/product-registrations              # 목록 조회
POST   /api/product-registrations              # 새 상품 추가 (자동 저장)
PUT    /api/product-registrations/:id          # 개별 수정 (자동 저장)
PUT    /api/product-registrations/bulk         # 일괄 수정 (자동 저장)
DELETE /api/product-registrations/:id          # 삭제
DELETE /api/product-registrations/bulk         # 선택 삭제

# 엑셀 업로드 (자동 저장)
POST   /api/product-registrations/upload       # 엑셀 업로드 → 즉시 DB 저장
```

### 전송 관련

```
# 차주 예상공급가로 전송
POST   /api/product-registrations/send-to-next-week
       
       Request Body:
       {
         productIds: number[]  // 전송할 상품 ID 목록 (선택적, 없으면 전체)
       }
       
       Response (성공):
       {
         success: true,
         message: "15개 상품이 전송되었습니다.",
         data: {
           total: 15,
           updated: 10,
           created: 5
         }
       }
       
       Response (실패 - 공급가 없음):
       {
         success: false,
         error: "MISSING_PRICE",
         message: "공급가가 없는 상품이 있습니다.",
         data: {
           invalidProducts: [
             { productCode: "A001", productName: "부사사과 3kg" },
             { productCode: "B002", productName: "신고배 5kg" }
           ]
         }
       }

# 신규 상품 확인 (전송 전 미리 확인용)
POST   /api/product-registrations/check-new-products
       
       Response:
       {
         newProducts: [
           { productCode: "C001", productName: "거봉포도 2kg" }
         ],
         existingProducts: [
           { productCode: "A001", productName: "부사사과 3kg" }
         ]
       }
```

---

## 📝 구현 체크리스트

### 자동 저장
- [ ] 엑셀 업로드 시 즉시 DB 저장
- [ ] 새 행 추가 시 즉시 DB 저장
- [ ] 셀 값 변경 시 디바운스(500ms) 후 DB 저장
- [ ] 선택 삭제 시 DB에서 삭제
- [ ] 저장 상태 표시 (우측 하단 "저장됨")

### 전송 로직
- [ ] 공급가 검증 (Start/Driving/Top 모두 필수)
- [ ] 공급가 없으면 에러 알림 + 전송 중단
- [ ] 신규 상품 확인 + 안내 알림
- [ ] 저장소 2 반영 (업데이트/신규 추가)
- [ ] 전송 성공 알림
- [ ] 전송 후 저장소 1 데이터 유지 (삭제 안 함)

### 알림
- [ ] 에러 알림 (빨간색) - 공급가 없음
- [ ] 정보 알림 (파란색) - 신규 상품 안내
- [ ] 성공 알림 (초록색) - 전송 완료
- [ ] 저장 상태 표시 (회색, 작게)

---

## ⚠️ 중요 규칙 요약

| 규칙 | 설명 |
|------|------|
| **자동 저장** | 삭제하지 않은 모든 데이터는 항상 자동 저장됨 |
| **저장소 분리** | 저장소 1(작업용)과 저장소 2(공개용)는 완전히 분리 |
| **전송 조건** | Start/Driving/Top 공급가 모두 있어야 전송 가능 |
| **전송 실패 시** | 알림 표시 후 전송 중단, 관리자가 수정해야 함 |
| **신규 상품** | 전송 전 안내 알림 표시 |
| **전송 후 저장소 1** | 데이터 그대로 유지 (삭제하지 않음) |
| **브라우저 닫아도** | 다음 접속 시 저장소 1에서 데이터 복원 |

---

## 📌 시나리오 테스트

### 시나리오 1: 작업만 하고 전송 안 함
```
1. 관리자가 엑셀 업로드 → 저장소 1에 자동 저장 ✅
2. 관리자가 값 수정 → 저장소 1에 자동 저장 ✅
3. 브라우저 닫음
4. 다음 날 다시 접속 → 저장소 1에서 데이터 불러옴 (작업 내용 유지!) ✅
5. 저장소 2(차주 예상공급가)에는 아무것도 없음 ✅
```

### 시나리오 2: 공급가 없이 전송 시도
```
1. 관리자가 10개 상품 등록
2. 그 중 3개 상품에 마진율 미입력 (공급가 계산 안 됨)
3. "차주 예상공급가로 전송" 클릭
4. ⚠️ 알림: "상품코드 [A001]의 공급가가 없습니다. 마진율을 입력해주세요." ✅
5. 전송 중단됨, 관리자가 수정해야 함 ✅
```

### 시나리오 3: 신규 상품 포함 전송
```
1. 저장소 2에 기존 상품 5개 있음
2. 저장소 1에서 8개 상품 작업 (기존 5개 + 신규 3개)
3. "차주 예상공급가로 전송" 클릭
4. ℹ️ 알림: "신규 상품 3개가 추가됩니다." ✅
5. 확인 후 전송
6. ✅ 알림: "8개 상품이 차주 예상공급가로 전송되었습니다." ✅
```

### 시나리오 4: 일부 삭제 후 전송
```
1. 저장소 1에 10개 상품 있음
2. 관리자가 3개 선택 삭제 → 저장소 1에서 3개 삭제됨 (7개 남음) ✅
3. "차주 예상공급가로 전송" 클릭 → 7개만 저장소 2에 반영 ✅
```
