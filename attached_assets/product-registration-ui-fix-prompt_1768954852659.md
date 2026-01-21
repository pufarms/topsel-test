# 상품등록 (공급가 계산) UI 개선 요청

## 📋 개요

"상품관리 > 상품등록(공급가 계산)" 페이지의 UI를 개선해주세요.
첨부된 이미지(21-1.PNG, 21-2.PNG)를 참고하여 문제점을 수정합니다.

---

## 🔧 개선 사항 1: 일괄 적용 영역 (21-1 참고)

### 문제점
- 입력 칸이 너무 넓어서 위아래 공간을 많이 차지함
- 한 줄에 하나씩 배치되어 세로로 길어짐

### 해결 방법

**Before (현재 - 문제)**
```
[중량(수량)]
중량: [____________________________]

[상품 원가]
원상품 기준가: [____________________________]
로스율 (%): [____________________________]
원상품 기준중량 (kg): [____________________________]

[부대비용]
박스비: [____________________________]
자재비: [____________________________]
...
```

**After (개선안 - 2줄 배치)**
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 일괄 적용 (선택한 상품에 한꺼번에 값 적용)                                                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                              │
│ 1행: 중량:[____] 원상품기준가:[______] 로스율(%):[____] 기준중량(kg):[____] 박스비:[____] 자재비:[____] 아웃박스:[____] │
│                                                                                                              │
│ 2행: 보자기:[____] 작업비:[____] 택배비:[____] Start마진율(%):[____] Driving마진율(%):[____] Top마진율(%):[____]  │
│                                                                                                              │
│                                                                              [초기화] [선택한 상품에 일괄 적용] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2줄 배치 구성

| 행 | 항목 |
|----|------|
| **1행** | 중량, 원상품 기준가, 로스율(%), 기준중량(kg), 박스비, 자재비, 아웃박스 |
| **2행** | 보자기, 작업비, 택배비, Start 마진율(%), Driving 마진율(%), Top 마진율(%) |

### CSS 스타일 가이드

```css
/* 일괄 적용 영역 컨테이너 */
.bulk-apply-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, auto));
  gap: 12px 16px;
  align-items: center;
}

/* 입력 필드 - 내용에 맞게 자동 확장 */
.bulk-input {
  min-width: 80px;
  width: auto;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
}

/* 입력값 길이에 맞춰 자동 확장 */
.bulk-input:focus {
  width: auto;
  min-width: 100px;
}

/* 라벨 */
.bulk-label {
  font-size: 13px;
  color: #374151;
  white-space: nowrap;
}

/* 섹션 제목 */
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin-right: 8px;
}
```

### React 구현 예시

```jsx
// 일괄 적용 영역 - 2줄 레이아웃
<div className="bg-gray-50 p-4 rounded-lg border">
  <h3 className="text-sm font-semibold text-gray-700 mb-3">
    일괄 적용 (선택한 상품에 한꺼번에 값 적용)
  </h3>
  
  {/* 1행: 중량 ~ 아웃박스 */}
  <div className="flex items-center gap-3 mb-3 flex-wrap">
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">중량:</span>
      <input type="number" step="0.1" className="w-16 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">원상품기준가:</span>
      <input type="number" className="w-20 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">로스율(%):</span>
      <input type="number" step="0.1" className="w-14 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">기준중량(kg):</span>
      <input type="number" step="0.1" className="w-14 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">박스비:</span>
      <input type="number" className="w-16 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">자재비:</span>
      <input type="number" className="w-16 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">아웃박스:</span>
      <input type="number" className="w-16 px-2 py-1 border rounded text-sm" />
    </label>
  </div>
  
  {/* 2행: 보자기 ~ Top마진율 */}
  <div className="flex items-center gap-3 mb-4 flex-wrap">
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">보자기:</span>
      <input type="number" className="w-16 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">작업비:</span>
      <input type="number" className="w-16 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">택배비:</span>
      <input type="number" className="w-16 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">Start마진율(%):</span>
      <input type="number" step="0.1" className="w-14 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">Driving마진율(%):</span>
      <input type="number" step="0.1" className="w-14 px-2 py-1 border rounded text-sm" />
    </label>
    <label className="flex items-center gap-1">
      <span className="text-xs whitespace-nowrap">Top마진율(%):</span>
      <input type="number" step="0.1" className="w-14 px-2 py-1 border rounded text-sm" />
    </label>
  </div>
  
  {/* 버튼 */}
  <div className="flex justify-end gap-2">
    <button className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100">
      초기화
    </button>
    <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
      선택한 상품에 일괄 적용
    </button>
  </div>
</div>
```

---

## 🔧 개선 사항 2: 상품 테이블 (21-2 참고)

### 문제점
- 모든 컬럼을 한 페이지에 억지로 맞추려다 보니 입력값이 잘려서 보임
- 숫자나 텍스트가 제대로 표시되지 않음
- 가독성이 매우 떨어짐

### 해결 방법

**핵심 원칙:**
1. **컬럼 너비**: 입력값 길이에 맞춰 자동 확장
2. **가로 스크롤**: 전체 너비가 페이지를 벗어나면 하단에 좌우 스크롤 표시
3. **세로 스크롤**: 테이블 행이 **15개 초과** 시 우측에 상하 스크롤 표시
4. **최소 너비 보장**: 각 컬럼별 최소 너비 설정하여 값이 잘리지 않도록

### CSS 스타일 가이드

```css
/* 테이블 컨테이너 - 가로/세로 스크롤 */
.table-container {
  width: 100%;
  /* 세로 스크롤: 헤더(약 40px) + 15행(약 40px × 15 = 600px) = 약 640px */
  /* 15행 초과 시 세로 스크롤 표시 */
  max-height: calc(40px + (40px * 15));  /* 헤더 + 15행 */
  overflow-x: auto;        /* 가로 스크롤 활성화 */
  overflow-y: auto;        /* 세로 스크롤 활성화 */
}

/* ⭐ 체크박스 컬럼 고정 (가로 스크롤 시에도 고정) */
.table-checkbox-header,
.table-checkbox-cell {
  position: sticky;
  left: 0;
  z-index: 10;
  background-color: #ffffff;  /* 배경색 필수 (스크롤 시 겹침 방지) */
  border-right: 2px solid #e5e7eb;  /* 구분선 */
}

.table-checkbox-header {
  background-color: #f9fafb;  /* 헤더 배경색 */
  z-index: 20;  /* 헤더는 더 위에 */
}

/* ⭐ 체크된 행 하이라이트 */
.row-selected {
  background-color: #DBEAFE !important;  /* blue-100 - 선택된 행 배경 */
}

.row-selected td {
  background-color: #DBEAFE !important;  /* 모든 셀에 적용 */
}

/* 체크된 행의 고정 체크박스 셀도 같은 색상 */
.row-selected .table-checkbox-cell {
  background-color: #DBEAFE !important;
}

/* 테이블 */
.product-table {
  width: max-content;  /* 내용에 맞게 테이블 너비 확장 */
  min-width: 100%;
  border-collapse: collapse;
  border: 1px solid #d1d5db;  /* 테이블 외곽선 */
}

/* 테이블 헤더 */
.product-table th {
  white-space: nowrap;  /* 헤더 텍스트 줄바꿈 방지 */
  padding: 8px 12px;
  background-color: #f9fafb;
  border: 1px solid #d1d5db;  /* 셀 테두리 */
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  position: sticky;
  top: 0;
}

/* 테이블 셀 - 엑셀 스타일 */
.product-table td {
  padding: 4px 8px;
  border: 1px solid #e5e7eb;  /* 연한 셀 테두리 */
  white-space: nowrap;  /* 셀 내용 줄바꿈 방지 */
  font-size: 13px;
}

/* ⭐ 입력 필드 - 엑셀 셀처럼 (테두리 없음, 배경 투명) */
.table-input {
  width: 100%;
  min-width: 60px;
  padding: 2px 4px;
  border: none;              /* 테두리 없음 */
  background: transparent;   /* 배경 투명 */
  outline: none;
  font-size: 13px;
}

/* 입력 필드 포커스 시 */
.table-input:focus {
  background-color: #ffffff;
  box-shadow: inset 0 0 0 2px #3b82f6;  /* 파란색 내부 테두리 */
}

/* 숫자 입력 필드 */
.table-input-number {
  text-align: right;
}

/* 드롭다운 - 엑셀 스타일 */
.table-select {
  width: 100%;
  padding: 2px 4px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  cursor: pointer;
}

.table-select:focus {
  background-color: #ffffff;
  box-shadow: inset 0 0 0 2px #3b82f6;
}

/* 자동계산 컬럼 (노란색) */
.auto-calc {
  background-color: #FEF9C3;
  min-width: 80px;
  text-align: right;
  padding: 4px 8px;
}

/* 빈칸 (옅은 빨간색) */
.empty-cell {
  background-color: #FEE2E2;
}
```

### 컬럼별 최소 너비 설정

| 컬럼 | 최소 너비 | 비고 |
|------|----------|------|
| 체크박스 | 40px | 고정 |
| 대분류/중분류/소분류 | 80px | 드롭다운 |
| 중량 | 60px | 숫자 |
| 상품코드 | 100px | 텍스트 |
| 상품명 | 120px | 텍스트, 길면 확장 |
| 원상품 | 100px | 텍스트 |
| 원상품 기준가 | 90px | 숫자 |
| 로스율 | 60px | 숫자 |
| 원상품 기준중량 | 80px | 숫자 |
| 개별단가 (자동) | 90px | 숫자, 노란색 |
| 박스비~택배비 | 70px | 숫자 |
| 상품 총원가 (자동) | 100px | 숫자, 노란색 |
| 마진율 | 70px | 숫자 |
| 공급가 (자동) | 90px | 숫자, 노란색 |
| 마진 (자동) | 80px | 숫자, 노란색 |

### React 구현 예시

```jsx
// 테이블 컨테이너 - 가로/세로 스크롤 지원
// 세로: 헤더 + 15행까지 표시, 초과 시 스크롤
<div className="w-full overflow-x-auto overflow-y-auto border rounded-lg" 
     style={{ maxHeight: 'calc(40px + (40px * 15))' }}>
  <table className="w-max min-w-full border-collapse">
    <thead className="bg-gray-50">
      <tr>
        {/* ⭐ 체크박스 헤더 - 고정 */}
        <th className="w-10 px-2 py-2 text-center sticky left-0 z-20 bg-gray-50 border-r-2 border-gray-200">
          <input type="checkbox" onChange={handleSelectAll} />
        </th>
        <th className="min-w-[80px] px-3 py-2 text-sm font-semibold whitespace-nowrap">대분류</th>
        <th className="min-w-[80px] px-3 py-2 text-sm font-semibold whitespace-nowrap">중분류</th>
        <th className="min-w-[80px] px-3 py-2 text-sm font-semibold whitespace-nowrap">소분류</th>
        <th className="min-w-[60px] px-3 py-2 text-sm font-semibold whitespace-nowrap">중량</th>
        <th className="min-w-[100px] px-3 py-2 text-sm font-semibold whitespace-nowrap">상품코드</th>
        <th className="min-w-[120px] px-3 py-2 text-sm font-semibold whitespace-nowrap">상품명</th>
        <th className="min-w-[100px] px-3 py-2 text-sm font-semibold whitespace-nowrap">원상품</th>
        <th className="min-w-[90px] px-3 py-2 text-sm font-semibold whitespace-nowrap">원상품 기준가</th>
        <th className="min-w-[60px] px-3 py-2 text-sm font-semibold whitespace-nowrap">로스율%</th>
        <th className="min-w-[80px] px-3 py-2 text-sm font-semibold whitespace-nowrap">기준중량</th>
        <th className="min-w-[90px] px-3 py-2 text-sm font-semibold whitespace-nowrap bg-yellow-100">개별단가</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">박스비</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">자재비</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">아웃박스</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">보자기</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">작업비</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">택배비</th>
        <th className="min-w-[100px] px-3 py-2 text-sm font-semibold whitespace-nowrap bg-yellow-100">총원가</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">S마진율</th>
        <th className="min-w-[90px] px-3 py-2 text-sm font-semibold whitespace-nowrap bg-yellow-100">S공급가</th>
        <th className="min-w-[80px] px-3 py-2 text-sm font-semibold whitespace-nowrap bg-yellow-100">S마진</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">D마진율</th>
        <th className="min-w-[90px] px-3 py-2 text-sm font-semibold whitespace-nowrap bg-yellow-100">D공급가</th>
        <th className="min-w-[80px] px-3 py-2 text-sm font-semibold whitespace-nowrap bg-yellow-100">D마진</th>
        <th className="min-w-[70px] px-3 py-2 text-sm font-semibold whitespace-nowrap">T마진율</th>
        <th className="min-w-[90px] px-3 py-2 text-sm font-semibold whitespace-nowrap bg-yellow-100">T공급가</th>
        <th className="min-w-[80px] px-3 py-2 text-sm font-semibold whitespace-nowrap bg-yellow-100">T마진</th>
      </tr>
    </thead>
    <tbody>
      {products.map((product, index) => (
        // ⭐ 체크된 행은 파란색 하이라이트
        <tr 
          key={index} 
          className={`hover:bg-gray-50 ${selectedRows.includes(index) ? 'bg-blue-100' : ''}`}
        >
          {/* ⭐ 체크박스 셀 - 고정 */}
          <td className={`px-2 py-1 text-center sticky left-0 z-10 border-r-2 border-gray-200 
                         ${selectedRows.includes(index) ? 'bg-blue-100' : 'bg-white'}`}>
            <input 
              type="checkbox" 
              checked={selectedRows.includes(index)}
              onChange={() => handleRowSelect(index)}
            />
          </td>
          <td className="px-2 py-1">
            <select className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-sm focus:ring-2 focus:ring-inset focus:ring-blue-500">
              <option>과일</option>
            </select>
          </td>
          {/* ... 나머지 컬럼들 */}
          
          {/* 자동계산 컬럼 예시 */}
          <td className="px-2 py-1 bg-yellow-100 text-right whitespace-nowrap text-sm">
            {product.unitPrice?.toLocaleString() || '-'}
          </td>
          
          {/* 입력 셀 예시 - 엑셀 스타일 (테두리 없음) */}
          <td className={`px-2 py-1 ${!product.boxCost ? 'bg-red-100' : ''}`}>
            <input 
              type="number" 
              value={product.boxCost || ''} 
              className="w-full px-1 py-0.5 border-none bg-transparent outline-none text-sm text-right focus:ring-2 focus:ring-inset focus:ring-blue-500"
            />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

{/* ⭐ 행 선택 상태 관리 예시 */}
const [selectedRows, setSelectedRows] = useState([]);

const handleRowSelect = (index) => {
  setSelectedRows(prev => 
    prev.includes(index) 
      ? prev.filter(i => i !== index)  // 해제
      : [...prev, index]                // 선택
  );
};

const handleSelectAll = (e) => {
  if (e.target.checked) {
    setSelectedRows(products.map((_, i) => i));  // 전체 선택
  } else {
    setSelectedRows([]);  // 전체 해제
  }
};
```

---

## 📝 구현 체크리스트

### 일괄 적용 영역
- [ ] 입력 필드를 2줄로 compact하게 배치
- [ ] 섹션별 그룹핑 (중량, 상품원가, 부대비용, 등급별 마진율)
- [ ] 입력값 길이에 맞춰 입력 칸 자동 확장
- [ ] 초기화 버튼 추가
- [ ] 전체 높이 줄이기

### 상품 테이블
- [ ] 테이블 컨테이너에 `overflow-x: auto` 적용 (가로 스크롤)
- [ ] 테이블 컨테이너에 `overflow-y: auto` + `max-height` 적용 (세로 스크롤, **15행 초과 시**)
- [ ] **체크박스 컬럼 고정** (`position: sticky; left: 0`) - 가로 스크롤 시에도 항상 보임
- [ ] **체크된 행 하이라이트** - 파란색 배경 (`bg-blue-100`)으로 선택 행 식별
- [ ] **엑셀 스타일 셀** - 입력 필드 테두리 없음, 셀 테두리로 구분
- [ ] 테이블 너비를 `width: max-content`로 설정 (내용에 맞게 확장)
- [ ] 각 컬럼별 최소 너비 설정 (`min-width`)
- [ ] 셀 내용 줄바꿈 방지 (`white-space: nowrap`)
- [ ] 입력값이 잘리지 않도록 충분한 너비 확보
- [ ] 자동계산 컬럼 노란색 배경 유지
- [ ] 빈칸 옅은 빨간색 배경 유지

---

## ⚠️ 중요 규칙

| 규칙 | 설명 |
|------|------|
| **입력값 보존** | 입력된 값이 절대 잘려서 보이면 안 됨 |
| **가로 스크롤** | 페이지 너비 초과 시 하단에 스크롤바 표시 |
| **세로 스크롤** | 테이블 행이 **15개 초과** 시 우측에 스크롤바 표시 |
| **체크박스 컬럼 고정** | 가로 스크롤 시에도 맨 앞 체크박스 컬럼은 **항상 고정** |
| **선택 행 하이라이트** | 체크된 행은 **파란색 배경**으로 명확히 식별 |
| **엑셀 스타일 셀** | 입력 필드에 **별도 테두리 없음**, 셀 테두리(연한 선)로만 구분 |
| **자동 확장** | 입력값 길이에 따라 칸 너비 자동 조절 |
| **compact 레이아웃** | 일괄 적용 영역은 세로 공간 최소화 |
