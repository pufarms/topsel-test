# 상품등록 ↔ 재고관리 연계 시스템

## 📋 개요

**상품등록(공급가계산)**, **상품 매핑**, **공급상품 재고 관리** 간의 완벽한 데이터 연계를 구현해주세요.

모든 상품 데이터는 **상품등록(공급가계산)**이 원천이며, 다른 기능들은 이를 참조합니다.

---

## 🔗 데이터 연계 구조

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [상품등록(공급가계산)] ─────── 원천 데이터 (Primary)                     │
│  ══════════════════════                                                 │
│  • product_code (PK) ◀─────── 모든 테이블이 이것을 참조!                 │
│  • product_name                                                         │
│  • category (대/중/소)                                                  │
│  • supply_price                                                         │
│  • mapping_status (매핑 상태)                                           │
│                                                                         │
│         ▲                                                               │
│         │ FK 참조                                                       │
│         │                                                               │
│  [상품 매핑] ──────────────────────────────────────────────────────────  │
│  ══════════                                                             │
│  • product_code (FK → 상품등록 참조!)                                   │
│  • material_code                                                        │
│  • quantity                                                             │
│         │                                                               │
│         │ 저장 시 → 상품등록에 매핑 상태 자동 반영!                       │
│         ▼                                                               │
│                                                                         │
│  [공급상품 재고 관리] ─────────────────────────────────────────────────  │
│  ══════════════════════                                                 │
│  • product_code (FK → 상품등록 참조!)                                   │
│  • current_stock                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 전체 업무 흐름

```
[상품등록(공급가계산)]
    │
    │ 상품 생성 + 공급가 계산
    │
    │ "차주 예상공급가로 전송" 클릭
    ▼
┌─────────────────────────────────────┐
│ 매핑 체크                            │
├─────────────────────────────────────┤
│ 매핑 안됨? ──→ ⚠️ 알림              │
│              "상품 매핑이 필요합니다" │
│              [상품 매핑으로 이동]     │
│                    │                │
│                    ▼                │
│              [상품 매핑]             │
│              매핑 완료 후 저장       │
│                    │                │
│                    ▼                │
│              상품등록에 매핑상태 반영 │
│              다시 상품등록으로 돌아옴 │
│                                     │
│ 매핑 완료? ──→ ✅ 전송 진행          │
└─────────────────────────────────────┘
    │
    ▼
[차주 예상공급가]  ← 여기서 반영!
    │
    ▼
[현재 공급가]
    │
    ▼
[공급상품 재고 관리]  ← ⭕ 선택 (미리 포장한 완성품 있을 때만)
```

---

## 📊 상품등록(공급가계산) 테이블 - 매핑 상태 표시

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 상품등록 (공급가 계산)                                                            │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ │ □ │ 상품코드 │ 상품명           │ 공급가  │ 매핑상태 │ 관리         │           │
│ ├───┼─────────┼─────────────────┼────────┼─────────┼─────────────┤           │
│ │ □ │ A001    │ 부사 3kg 선물세트 │ 25,000 │ 🟢 완료  │ [매핑 보기]  │           │
│ │ □ │ A002    │ 부사 5kg 가정용   │ 35,000 │ 🟢 완료  │ [매핑 보기]  │           │
│ │ □ │ B001    │ 신고 3kg 선물     │ 30,000 │ 🔴 미완료│ [매핑 하기]  │           │
│                                             ↑                                    │
│                                     상품 매핑에서 저장 시 자동 반영!              │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 매핑상태 컬럼

| 상태 | 표시 | 버튼 |
|------|------|------|
| 매핑 완료 | 🟢 완료 | [매핑 보기] |
| 매핑 미완료 | 🔴 미완료 | [매핑 하기] |

### 버튼 동작

| 버튼 | 동작 |
|------|------|
| [매핑 보기] | 상품 매핑 페이지로 이동 (해당 상품 상세 모달 열기) |
| [매핑 하기] | 상품 매핑 페이지로 이동 (해당 상품 매핑 편집 모달 열기) |

---

## 🔧 기능별 연계 로직

### 1) 상품등록(공급가계산) → 차주 예상공급가 전송

```typescript
const handleSendToNextWeek = async (selectedProducts) => {
  
  // 1️⃣ 공급가 체크 (기존)
  const noPrice = selectedProducts.filter(p => !p.supplyPrice);
  if (noPrice.length > 0) {
    showAlert({
      type: 'error',
      title: '전송 실패',
      message: `공급가가 입력되지 않은 상품이 있습니다.`,
      details: noPrice.map(p => `${p.productCode} - ${p.productName}`)
    });
    return;
  }
  
  // 2️⃣ 매핑 체크 (추가!)
  const unmapped = selectedProducts.filter(p => p.mappingStatus !== 'complete');
  
  if (unmapped.length > 0) {
    showConfirm({
      type: 'warning',
      title: '상품 매핑 필요',
      message: `상품 매핑이 필요한 상품이 ${unmapped.length}개 있습니다.\n상품 매핑 후 전송할 수 있습니다.`,
      details: unmapped.map(p => `${p.productCode} - ${p.productName}`),
      confirmText: '상품 매핑으로 이동',
      cancelText: '취소',
      onConfirm: () => {
        // 첫 번째 미매핑 상품의 매핑 페이지로 이동
        navigate('/admin/inventory/mapping', {
          state: { 
            productCode: unmapped[0].productCode,
            returnTo: '/admin/products/registration'  // 돌아올 페이지
          }
        });
      }
    });
    return;
  }
  
  // 3️⃣ 모든 조건 충족 → 전송 진행
  await sendToNextWeekSupplyPrice(selectedProducts);
  
  showAlert({
    type: 'success',
    message: `${selectedProducts.length}개 상품이 차주 예상공급가로 전송되었습니다.`
  });
};
```

---

### 2) 상품 매핑 - 상품 추가 시 (직접 입력 / 엑셀 업로드)

```typescript
const handleAddProductToMapping = async (productCode) => {
  
  // 1️⃣ 상품등록(공급가계산) 연계 체크 (필수!)
  const product = await db.productRegistrations.findUnique({
    where: { productCode }
  });
  
  if (!product) {
    // ❌ 상품등록에 없음 → 진행 불가
    showConfirm({
      type: 'warning',
      title: '등록되지 않은 상품',
      message: '등록되지 않은 상품입니다.\n상품등록 후 상품매핑과 재고등록이 가능합니다.',
      confirmText: '상품등록으로 이동',
      cancelText: '취소',
      onConfirm: () => navigate('/admin/products/registration')
    });
    return null;
  }
  
  // ✅ 상품등록에 있음 → 매핑 진행 가능
  return product;
};
```

---

### 3) 상품 매핑 - 저장 시

```typescript
const handleSaveMapping = async (productCode, materials) => {
  
  // 1. 매핑 저장
  await db.productMaterialMappings.deleteMany({
    where: { productCode }
  });
  
  await db.productMaterialMappings.createMany({
    data: materials.map(m => ({
      productCode,
      materialCode: m.materialCode,
      materialName: m.materialName,
      quantity: m.quantity
    }))
  });
  
  // 2. 상품등록(공급가계산)에 매핑 상태 자동 반영! (중요!)
  const mappingStatus = materials.length > 0 ? 'complete' : 'incomplete';
  
  await db.productRegistrations.update({
    where: { productCode },
    data: { mappingStatus }
  });
  
  // 3. 완료 알림
  showAlert({
    type: 'success',
    message: '상품 매핑이 완료되었습니다.'
  });
  
  // 4. 돌아갈 페이지가 있으면 이동
  if (state?.returnTo) {
    navigate(state.returnTo);
  }
};
```

---

### 4) 공급상품 재고 관리 - 입고 시

```typescript
const handleProductStockIn = async (productCode, quantity) => {
  
  // 1️⃣ 상품등록(공급가계산) 연계 체크 (필수!)
  const product = await db.productRegistrations.findUnique({
    where: { productCode }
  });
  
  if (!product) {
    showConfirm({
      type: 'warning',
      title: '등록되지 않은 상품',
      message: '등록되지 않은 상품입니다.\n상품등록 후 상품매핑과 재고등록이 가능합니다.',
      confirmText: '상품등록으로 이동',
      cancelText: '취소',
      onConfirm: () => navigate('/admin/products/registration')
    });
    return;
  }
  
  // 2️⃣ 상품 매핑 체크 (필수!)
  const mappings = await db.productMaterialMappings.findMany({
    where: { productCode }
  });
  
  if (mappings.length === 0) {
    showConfirm({
      type: 'warning',
      title: '상품 매핑 필요',
      message: '상품 매핑이 필요합니다.\n상품매핑 후 재고등록이 가능합니다.',
      confirmText: '상품 매핑으로 이동',
      cancelText: '취소',
      onConfirm: () => navigate('/admin/inventory/mapping', {
        state: { productCode }
      })
    });
    return;
  }
  
  // ✅ 모든 조건 충족 → 입고 진행
  await db.productStocks.upsert({
    where: { productCode },
    update: { currentStock: { increment: quantity } },
    create: { productCode, currentStock: quantity }
  });
  
  // 재고 이력 기록
  await createStockHistory({
    stockType: 'product',
    actionType: 'in',
    itemCode: productCode,
    itemName: product.productName,
    quantity: quantity,
    adminId: currentUser.id
  });
  
  showAlert({
    type: 'success',
    message: '입고가 완료되었습니다.'
  });
};
```

---

## 📊 데이터베이스 스키마

### product_registrations (상품등록 - 원천)

```sql
CREATE TABLE product_registrations (
  product_code VARCHAR(50) PRIMARY KEY,
  product_name VARCHAR(200) NOT NULL,
  large_category VARCHAR(100),
  medium_category VARCHAR(100),
  small_category VARCHAR(100),
  supply_price DECIMAL(10,0),
  mapping_status VARCHAR(20) DEFAULT 'incomplete',  -- 'complete' | 'incomplete'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### product_material_mappings (상품 매핑)

```sql
CREATE TABLE product_material_mappings (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(50) NOT NULL REFERENCES product_registrations(product_code),
  material_code VARCHAR(50) NOT NULL,
  material_name VARCHAR(200) NOT NULL,
  quantity DECIMAL(10,1) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pmm_product_code ON product_material_mappings(product_code);
```

### product_stocks (공급상품 재고)

```sql
CREATE TABLE product_stocks (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(50) NOT NULL REFERENCES product_registrations(product_code),
  current_stock INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_code)
);
```

---

## 🔔 알림 메시지 정리

### 상품등록에 없는 경우

```
┌─────────────────────────────────────────────────┐
│ ⚠️ 등록되지 않은 상품                            │
│                                                 │
│ 등록되지 않은 상품입니다.                        │
│ 상품등록 후 상품매핑과 재고등록이 가능합니다.     │
│                                                 │
│                    [취소]  [상품등록으로 이동]    │
└─────────────────────────────────────────────────┘
```

### 상품 매핑 필요한 경우

```
┌─────────────────────────────────────────────────┐
│ ⚠️ 상품 매핑 필요                                │
│                                                 │
│ 상품 매핑이 필요한 상품이 3개 있습니다.          │
│ 상품 매핑 후 전송할 수 있습니다.                 │
│                                                 │
│ • A001 - 부사 3kg 선물세트                      │
│ • B001 - 신고 3kg 선물                          │
│ • C001 - 배혼합 5kg 선물                        │
│                                                 │
│                    [취소]  [상품 매핑으로 이동]   │
└─────────────────────────────────────────────────┘
```

### 재고등록 시 매핑 필요한 경우

```
┌─────────────────────────────────────────────────┐
│ ⚠️ 상품 매핑 필요                                │
│                                                 │
│ 상품 매핑이 필요합니다.                          │
│ 상품매핑 후 재고등록이 가능합니다.               │
│                                                 │
│                    [취소]  [상품 매핑으로 이동]   │
└─────────────────────────────────────────────────┘
```

### 매핑 완료

```
┌─────────────────────────────────────────────────┐
│ ✅ 상품 매핑 완료                                │
│                                                 │
│ 상품 매핑이 완료되었습니다.                      │
│                                                 │
│                                        [확인]   │
└─────────────────────────────────────────────────┘
```

---

## ✅ 체크리스트

### 상품등록(공급가계산)
- [ ] 매핑상태 컬럼 추가 (🟢완료 / 🔴미완료)
- [ ] [매핑 보기] / [매핑 하기] 버튼
- [ ] "차주 예상공급가로 전송" 시 매핑 체크
- [ ] 미매핑 상품 → 알림 + 상품 매핑으로 이동

### 상품 매핑
- [ ] 상품 추가 시 상품등록 연계 체크
- [ ] 상품등록에 없으면 → 알림 + 상품등록으로 이동
- [ ] 저장 시 상품등록에 매핑 상태 자동 반영
- [ ] returnTo 파라미터로 돌아갈 페이지 처리

### 공급상품 재고 관리
- [ ] 입고 시 상품등록 연계 체크
- [ ] 입고 시 상품 매핑 체크
- [ ] 상품등록에 없으면 → 알림 + 상품등록으로 이동
- [ ] 매핑 안됨 → 알림 + 상품 매핑으로 이동

### 데이터 연계
- [ ] product_registrations.mapping_status 필드 추가
- [ ] product_material_mappings.product_code → FK 참조
- [ ] product_stocks.product_code → FK 참조
- [ ] 매핑 저장 시 상품등록 매핑 상태 자동 업데이트

---

## ⚠️ 중요 규칙

| 항목 | 규칙 |
|------|------|
| **원천 데이터** | 상품등록(공급가계산)이 모든 상품의 원천! |
| **FK 참조** | 매핑, 재고 테이블은 상품등록을 FK로 참조 |
| **매핑 상태 반영** | 상품 매핑 저장 시 → 상품등록에 자동 반영 |
| **단계별 체크** | 각 단계 진입 시 이전 단계 충족 여부 체크 |
| **공급상품 재고** | 선택 사항 (필수 아님!) |
| **따로 놀면 안됨** | 모든 데이터는 상품등록과 완벽히 연계! |

---

## 📋 단계별 필수/선택

| 단계 | 필수 여부 | 다음 단계 조건 |
|------|:--------:|---------------|
| **상품등록(공급가계산)** | ✅ 필수 | 상품 저장 완료 |
| **상품 매핑** | ✅ 필수 | 원재료 1개 이상 매핑 |
| **차주 예상공급가 전송** | ✅ 필수 | 공급가 + 매핑 완료 |
| **공급상품 재고 등록** | ⭕ **선택** | 미리 포장한 완성품 있을 때만 |
