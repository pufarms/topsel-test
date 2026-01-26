# 🚨 REPLIT 필수 준수 사항

## ⚠️ 모든 페이지 작업 시 반드시 따라야 할 규칙

---

## 📋 작업 시작 전 체크리스트

모든 페이지 작업을 시작하기 전에 **반드시** 다음을 확인하세요:

- [ ] `design-system-responsive.json` 파일을 열어서 내용을 확인했는가?
- [ ] `design-system-global.css` 파일을 `<head>` 섹션에 링크했는가?
- [ ] 이 페이지가 어떤 section_pattern을 따를지 결정했는가?
- [ ] Mobile-first 접근 방식으로 시작할 준비가 되었는가?

---

## 🎨 색상 사용 규칙

### ✅ 허용됨
```css
/* CSS Variables 사용 */
color: var(--primary);
background-color: var(--navy);
border-color: var(--accent-green);
```

### ❌ 금지됨
```css
/* 임의의 색상 코드 사용 금지 */
color: #1234AB;  /* ❌ 디자인 시스템에 없는 색상 */
background-color: #FFAABB;  /* ❌ 임의 생성 금지 */
```

**사용 가능한 색상만**:
- Brand: `--primary`, `--navy`, `--accent-orange`, `--accent-cyan`, `--accent-green`, `--badge-purple`
- Neutral: `--white`, `--gray-50`, `--gray-100`, `--gray-400`, `--gray-600`, `--gray-900`
- Semantic: `--success`, `--warning`, `--error`

---

## 📐 타이포그래피 규칙

### ✅ 허용됨
```html
<!-- 정의된 클래스 사용 -->
<h1 class="h1-hero">메인 제목</h1>
<h2 class="h2-section">섹션 제목</h2>
<h3 class="h3-card">카드 제목</h3>
<p class="body-text">본문 텍스트</p>
<span class="stat-number">99%</span>
```

### ❌ 금지됨
```html
<!-- 인라인 스타일로 임의 크기 설정 금지 -->
<h1 style="font-size: 72px;">제목</h1>  ❌
<p style="font-size: 18px;">텍스트</p>  ❌
```

**정의된 타이포그래피 클래스만 사용**:
- `.h1-hero` → 32px (mobile) ~ 56px (desktop)
- `.h2-section` → 24px (mobile) ~ 36px (desktop)
- `.h3-card` → 18px (mobile) ~ 22px (desktop)
- `.stat-number` → 32px (mobile) ~ 48px (desktop)
- `.body-text` → 14px (mobile) ~ 16px (desktop)

---

## 🔲 섹션 배경 교차 규칙 (필수!)

### ✅ 올바른 순서
```html
<header class="section-light">헤더</header>
<section class="section-dark">히어로 (Navy)</section>
<section class="section-light">기능 카드 (White)</section>
<section class="section-dark">콘텐츠+이미지 (Navy)</section>
<section class="section-light">통계 (White)</section>
<section class="section-dark">추천사 (Navy)</section>
<footer class="section-dark">푸터 (Navy)</footer>
```

### ❌ 잘못된 순서
```html
<section class="section-dark">섹션1 (Navy)</section>
<section class="section-dark">섹션2 (Navy)</section>  ❌ 연속 금지!
```

**규칙**: White ↔ Navy 반드시 교차! 같은 배경이 연속되면 안 됨.

---

## 📱 반응형 브레이크포인트

### 필수 테스트 크기
```css
/* 작은 순서대로 */
xs:  375px   /* iPhone SE - 가장 작은 모바일 */
sm:  640px   /* 큰 모바일 */
md:  768px   /* 태블릿 */
lg:  1024px  /* 데스크톱 */
xl:  1280px  /* 큰 데스크톱 */
```

### ✅ Mobile-First 접근
```css
/* 기본 (모바일) */
.card {
  padding: 20px;
  font-size: 14px;
}

/* 태블릿 이상 */
@media (min-width: 768px) {
  .card {
    padding: 24px;
    font-size: 16px;
  }
}

/* 데스크톱 이상 */
@media (min-width: 1024px) {
  .card {
    padding: 30px;
  }
}
```

### ❌ Desktop-First (금지)
```css
/* ❌ max-width 사용 금지 */
@media (max-width: 768px) {
  /* 이런 방식 금지 */
}
```

---

## 🎛️ 버튼 스타일

### ✅ 정의된 버튼만 사용
```html
<!-- 주요 액션 -->
<button class="btn btn-primary">가입하기</button>

<!-- Navy 배경용 -->
<button class="btn btn-outline-white">더 알아보기</button>

<!-- 뱃지/태그 -->
<span class="btn btn-pill">신규</span>
```

### ❌ 커스텀 버튼 금지
```html
<!-- ❌ 임의의 스타일 버튼 생성 금지 -->
<button style="background: linear-gradient(...);">버튼</button>
```

---

## 📦 카드 컴포넌트

### ✅ 표준 카드 사용
```html
<!-- White 배경 섹션용 -->
<div class="card">
  <h3 class="h3-card">카드 제목</h3>
  <p class="body-text">카드 내용</p>
</div>

<!-- Navy 배경 섹션용 -->
<div class="card card-dark">
  <h3 class="h3-card">카드 제목</h3>
  <p class="body-text">카드 내용</p>
</div>
```

### 카드 반응형 규칙
- **Border-radius**: 12px (mobile) → 16px (desktop)
- **Padding**: 20px (mobile) → 24px (tablet) → 30px (desktop)
- **Shadow**: `var(--shadow-card)` 고정

---

## 🏗️ 레이아웃 패턴

### 히어로 섹션
```html
<section class="section-dark">
  <div class="container">
    <!-- Mobile: 세로 배치 -->
    <!-- Desktop: 가로 2단 (텍스트 | 이미지) -->
    <div class="hero-content">
      <span class="subtitle-label">상단 라벨</span>
      <h1 class="h1-hero">메인 제목</h1>
      <p class="body-text">설명 텍스트</p>
      <div class="button-group">
        <button class="btn btn-primary">주요 버튼</button>
        <button class="btn btn-outline-white">보조 버튼</button>
      </div>
    </div>
    <!-- 통계 4개 (mobile: 2x2, desktop: 1x4) -->
    <div class="grid grid-2 grid-lg-4">
      <div class="stat-item">
        <span class="stat-number">33건</span>
        <span class="caption">라벨</span>
      </div>
      <!-- 3개 더 반복 -->
    </div>
  </div>
</section>
```

### 카드 그리드 섹션
```html
<section class="section-light">
  <div class="container">
    <h2 class="h2-section text-center">섹션 제목</h2>
    <!-- Mobile: 1단, Tablet: 2단, Desktop: 3단 -->
    <div class="grid grid-1 grid-sm-2 grid-lg-3">
      <div class="card">
        <div class="icon-box">🎯</div>
        <h3 class="h3-card">카드 제목</h3>
        <p class="body-text">카드 내용</p>
      </div>
      <!-- 더 많은 카드 -->
    </div>
  </div>
</section>
```

### 콘텐츠+이미지 섹션
```html
<section class="section-dark">
  <div class="container">
    <!-- Mobile: 이미지 위, 텍스트 아래 (세로) -->
    <!-- Desktop: 이미지 왼쪽, 텍스트 오른쪽 (가로) -->
    <div class="content-image-layout">
      <div class="image-area">
        <img src="..." alt="..." class="img-rounded">
      </div>
      <div class="text-area">
        <span class="subtitle-label">상단 라벨</span>
        <h2 class="h2-section">섹션 제목</h2>
        <p class="body-text">설명 텍스트</p>
        <button class="btn btn-outline-white">버튼</button>
      </div>
    </div>
  </div>
</section>
```

---

## 🔍 작업 완료 전 최종 체크리스트

모든 페이지를 완성한 후 **반드시** 다음을 확인하세요:

### 색상 & 타이포그래피
- [ ] 모든 색상이 디자인 시스템에 정의된 색상인가?
- [ ] 임의의 font-size를 사용하지 않았는가?
- [ ] 정의된 타이포그래피 클래스만 사용했는가?

### 레이아웃
- [ ] 섹션 배경이 White ↔ Navy 교차 패턴인가?
- [ ] 모든 콘텐츠가 `.container` 안에 있는가?
- [ ] Section padding이 반응형으로 적용되었는가?

### 반응형
- [ ] **375px** (iPhone SE)에서 정상 작동하는가?
- [ ] **768px** (태블릿)에서 레이아웃이 변경되는가?
- [ ] **1024px** (데스크톱)에서 최종 레이아웃이 적용되는가?
- [ ] 모든 텍스트가 반응형 크기를 갖는가?
- [ ] 카드 그리드가 1→2→3 단으로 변하는가?

### 버튼 & 인터랙션
- [ ] 모든 버튼이 정의된 스타일(btn-primary, btn-outline-white)인가?
- [ ] 모바일에서 터치 영역이 44px 이상인가?
- [ ] Hover 효과가 `@media (hover: hover)`로 제한되었는가?

### 접근성
- [ ] 이미지에 alt 텍스트가 있는가?
- [ ] Focus 스타일이 보이는가?
- [ ] Navy 배경의 텍스트가 충분히 밝은가?

### 파일 구조
- [ ] `design-system-global.css`가 링크되어 있는가?
- [ ] CSS Variables를 사용했는가?
- [ ] 인라인 스타일을 최소화했는가?

---

## 🚫 절대 금지 사항

### 1. 임의의 색상 생성
```css
/* ❌ 금지 */
background: #FF5733;
color: rgb(123, 234, 45);
```

### 2. 임의의 폰트 크기
```css
/* ❌ 금지 */
font-size: 27px;
font-size: 3.5rem;
```

### 3. 디자인 시스템 무시
```html
<!-- ❌ 금지: 새로운 버튼 스타일 만들기 -->
<button class="my-custom-button">...</button>
```

### 4. Desktop-first 접근
```css
/* ❌ 금지: max-width 미디어 쿼리 */
@media (max-width: 768px) { ... }
```

### 5. 섹션 배경 연속
```html
<!-- ❌ 금지: Navy → Navy 연속 -->
<section class="section-dark">...</section>
<section class="section-dark">...</section>
```

---

## ✅ 모범 사례

### 새 페이지 시작 시
```markdown
1. design-system-responsive.json 확인
2. 이 페이지에 필요한 section_pattern 선택
3. design-system-global.css 링크
4. Mobile-first로 HTML 구조 작성
5. 반응형 클래스 적용
6. 375px, 768px, 1024px에서 테스트
7. 색상/타이포그래피 최종 확인
8. 사용자에게 전달
```

### 컴포넌트 재사용
- 헤더: 모든 페이지에서 **동일**
- 푸터: 모든 페이지에서 **동일**
- 버튼: `.btn` 클래스 조합으로 **통일**
- 카드: `.card` 클래스로 **표준화**

---

## 📞 문제 발생 시

만약 디자인 시스템에 정의되지 않은 요소가 필요하다면:

1. **절대 임의로 만들지 마세요**
2. 사용자에게 다음을 물어보세요:
   ```
   "이 [요소]는 디자인 시스템에 정의되어 있지 않습니다.
   기존 스타일 중 어떤 것을 사용할까요?
   아니면 디자인 시스템에 새로 추가해야 할까요?"
   ```

---

## 🎯 핵심 원칙

> **"일관성이 창의성보다 중요합니다"**

- 모든 페이지는 **같은 디자인 언어**를 사용해야 합니다
- 디자인 시스템은 **절대적인 규칙**입니다
- 의문이 들 때는 **항상 디자인 시스템을 참고**하세요
- 새로운 스타일이 필요하면 **사용자에게 확인**하세요

---

## 📌 빠른 참조

| 요소 | 클래스 | 반응형 |
|------|--------|--------|
| 메인 제목 | `.h1-hero` | 32px → 56px |
| 섹션 제목 | `.h2-section` | 24px → 36px |
| 본문 | `.body-text` | 14px → 16px |
| 통계 숫자 | `.stat-number` | 32px → 48px |
| 주요 버튼 | `.btn.btn-primary` | 고정 스타일 |
| 카드 | `.card` | 12px → 16px radius |
| 컨테이너 | `.container` | max-width: 1200px |
| 라이트 섹션 | `.section-light` | White 배경 |
| 다크 섹션 | `.section-dark` | Navy 배경 |

---

**이 가이드라인을 모든 페이지 작업 시 반드시 준수하세요! 🚀**
