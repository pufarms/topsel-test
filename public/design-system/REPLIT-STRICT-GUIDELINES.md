# 🚨 REPLIT 필수 준수 사항

## ⚠️ 모든 페이지 작업 시 반드시 따라야 할 규칙

---

## 📋 작업 시작 전 체크리스트

- [ ] `design-system-responsive.json` 파일을 열어서 내용을 확인했는가?
- [ ] `design-system-global.css` 파일을 `<head>` 섹션에 링크했는가?
- [ ] 이 페이지가 어떤 section_pattern을 따를지 결정했는가?
- [ ] Mobile-first 접근 방식으로 시작할 준비가 되었는가?

---

## 🎨 색상 사용 규칙

### ✅ 허용됨
```css
color: var(--primary);
background-color: var(--navy);
border-color: var(--accent-green);
```

### ❌ 금지됨
```css
color: #1234AB;
background-color: #FFAABB;
```

**사용 가능한 색상만**:
- Brand: `--primary`, `--navy`, `--accent-orange`, `--accent-cyan`, `--accent-green`, `--badge-purple`
- Neutral: `--white`, `--gray-50`, `--gray-100`, `--gray-400`, `--gray-600`, `--gray-900`
- Semantic: `--success`, `--warning`, `--error`

---

## 📐 타이포그래피 규칙

### ✅ 허용됨
```html
<h1 class="h1-hero">메인 제목</h1>
<h2 class="h2-section">섹션 제목</h2>
<h3 class="h3-card">카드 제목</h3>
<p class="body-text">본문 텍스트</p>
<span class="stat-number">99%</span>
```

### ❌ 금지됨
```html
<h1 style="font-size: 72px;">제목</h1>
<p style="font-size: 18px;">텍스트</p>
```

---

## 🔲 섹션 배경 교차 규칙 (필수!)

### ✅ 올바른 순서
```
Header (Light) → Hero (Dark) → Features (Light) → Content (Dark) → Stats (Light) → Footer (Dark)
```

### ❌ 잘못된 순서
Navy → Navy 연속 금지!

**규칙**: White ↔ Navy 반드시 교차!

---

## 📱 반응형 브레이크포인트

### 필수 테스트 크기
- xs: 375px (iPhone SE)
- sm: 640px (큰 모바일)
- md: 768px (태블릿)
- lg: 1024px (데스크톱)
- xl: 1280px (큰 데스크톱)

### ✅ Mobile-First 접근
```css
@media (min-width: 768px) { ... }
```

### ❌ Desktop-First (금지)
```css
@media (max-width: 768px) { ... }
```

---

## 🔍 작업 완료 전 최종 체크리스트

- [ ] 모든 색상이 디자인 시스템에 정의된 색상인가?
- [ ] 정의된 타이포그래피 클래스만 사용했는가?
- [ ] 섹션 배경이 White ↔ Navy 교차 패턴인가?
- [ ] 375px, 768px, 1024px에서 정상 작동하는가?
- [ ] design-system-global.css가 링크되어 있는가?

---

**이 가이드라인을 모든 페이지 작업 시 반드시 준수하세요! 🚀**
