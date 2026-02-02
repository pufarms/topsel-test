# Order Management System

## Overview

This project is a Korean-language order management system designed to streamline operations for sellers and administrators. Its primary purpose is to allow sellers to efficiently submit orders and provide administrators with comprehensive tools for managing all orders and users. Key capabilities include robust role-based authentication, separate dashboards tailored for sellers and administrators, intuitive order entry forms, detailed order history tracking, and extensive user management functionalities. The system aims to enhance efficiency, reduce manual errors, and provide a centralized platform for order and user data.

## User Preferences

Preferred communication style: Simple, everyday language.

### 필수 디자인 요구사항 (모든 페이지 적용)
1. **반응형 웹 디자인 (필수!)**: 모든 페이지에 모바일/태블릿/데스크톱 반응형 레이아웃 적용
   - 테이블: 데스크톱은 테이블, 모바일/태블릿은 카드 레이아웃
   - 그리드: `grid-cols-1 sm:grid-cols-2` 등 반응형 그리드
   - 텍스트: `text-xl md:text-2xl` 등 반응형 크기
2. **Pretendard 한글 폰트 (필수!)**: 모든 페이지에 Pretendard 폰트 적용 유지
3. **테이블 가로 스크롤 (필수!)**: 주문/통계 관련 모든 테이블에 가로 스크롤 적용
   - 테이블 컨테이너에 `overflow-x-auto` 클래스 필수
   - 예: `<div className="border rounded-lg overflow-x-auto"><Table>...</Table></div>`
   - 컬럼이 많은 테이블은 모든 컬럼을 볼 수 있도록 스크롤 지원
4. **카테고리 연동 (필수!)**: 모든 대분류/중분류/소분류 필터는 "상품관리/카테고리관리"와 연동
   - 카테고리 데이터 소스: `/api/categories` 엔드포인트 (categories 테이블)
   - 카테고리 레벨: `large` (대분류), `medium` (중분류), `small` (소분류)
   - 계단식 필터링: 대분류 선택 → 해당 중분류만 표시 → 해당 소분류만 표시
   - 상품관리와 연동: 상품의 카테고리는 반드시 카테고리관리에서 설정된 카테고리와 매칭되어야 함

### Topsel 디자인 시스템 (v2.0.0)
공개 페이지 작업 시 반드시 준수해야 할 디자인 규칙:

**파일 위치**: `public/design-system/`
- `design-system-global.css`: 글로벌 CSS 스타일시트
- `REPLIT-STRICT-GUIDELINES.md`: 준수 사항 체크리스트

**색상 팔레트 (CSS Variables)**:
- `--primary: #5D7AF2` (주요 브랜드 색상)
- `--navy: #111827` (섹션 배경 어두운 색)
- `--accent-orange: #FF6B00`
- `--accent-cyan: #22D3EE`
- `--accent-green: #10B981`

**섹션 배경 교차 규칙**:
- White ↔ Navy 반드시 교차 (연속 금지)
- 예: Hero(Navy) → Features(White) → Content(Navy)

**반응형 브레이크포인트**:
- xs: 375px (모바일)
- md: 768px (태블릿)
- lg: 1024px (데스크톱)
- Mobile-first 접근 (`min-width` 미디어쿼리만 사용)

**타이포그래피 클래스**:
- `.h1-hero`: 32px→56px (반응형)
- `.h2-section`: 24px→36px
- `.h3-card`: 18px→22px
- `.body-text`: 14px→16px
- `.stat-number`: 32px→48px (통계용)

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query for server state, React Context for authentication
- **UI Components**: shadcn/ui built on Radix UI, Lucide React for icons
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode)
- **Responsive Design**: Mobile-first approach with standard breakpoints
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite with custom path aliases

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript
- **Session Management**: express-session with memorystore (development)
- **API Design**: RESTful JSON API endpoints under `/api`
- **Authentication**: Session-based with SHA256 password hashing and role-based access control (SUPER_ADMIN, ADMIN, seller)

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Shared `shared/schema.ts`
- **Validation**: Zod schemas generated from Drizzle

### Database Schema Highlights
- `users`: User authentication and role management (SUPER_ADMIN, ADMIN, seller)
- `orders`: Core order details and user linkage
- `products`, `product_registrations`, `categories`: Product and category management.
- `materials`, `material_categories_*`: Multi-level inventory management for raw, semi, and sub-materials with automatic code generation.
- `product_mappings`, `product_material_mappings`: Links products to their required materials.
- `members`, `member_logs`: Member (partner) management and historical changes. Members can access their own mypage.
- `images`: Storage of various image types with categories and subcategories.
- `siteSettings`: Key-value pairs for site configuration.
- `headerMenus`: Stores header menu items for dynamic navigation.
- `pages`: Page definitions with categories, access levels, and JSONB content for CMS.

### Core Features
- **Member Mypage**: Self-service profile page for members (`/mypage`), with editable fields and read-only information, accessible only to logged-in members.
- **Product Management (Admin Only)**: Role-based access for product categories, registration, and status viewing.
- **Inventory Management (Admin Only)**: Material management, product mapping, stock status, and history tracking. Supports bulk Excel uploads.
- **Stock History Tracking**: Comprehensive tracking of all stock changes with detailed records and API for filtering and download.
- **Product Mapping**: Links products to necessary materials for inventory control. Includes hierarchical category filtering, bulk upload/download, and mapping checks before product dispatch.
- **Admin Design System**: Standardized components and design rules for consistent UI within the admin panel.
- **Admin Category Filter**: Specialized filter component for admin order pages with member selection (상호명 search/select), cascading category filters, and keyword search. All 8 admin order status pages use AdminCategoryFilter with 상호명 column in tables. Member filtering uses members.id (UUID) for matching orders.
  - **중요 규칙**: 검색 필터는 페이지 전체가 아닌 해당 리스트 테이블에만 적용됨
  - 한 페이지에 여러 리스트 테이블이 있으면 각 테이블마다 독립적인 필터 컴포넌트 적용 필수
  - 새로운 리스트 테이블 생성 시 반드시 해당 테이블 전용 필터 상태(state)와 컴포넌트 분리
- **Excel Upload Standard Pattern**: Supports `.xlsx` and `.xls` files for data import using `multer` and `xlsx`.
- **Site Settings Management (Admin)**: Manages site-wide settings (header, footer, general) stored in `siteSettings` table, with public and admin APIs and a dedicated admin page.
- **Header Menu Management (Site Settings - 헤더 탭)**: Manages dynamic header menus with conditional visibility based on login status, menu types (custom/system), drag-and-drop ordering, and an "Open in new tab" option.
- **Page Management (Admin)**: CMS for dynamic page creation and management using a JSON-based content system (`pages` table). Features include a visual content editor with 9 section types, real-time preview, 8 predefined page categories, and access level control. System pages are non-deletable. Dynamic page rendering handles public paths.
- **Term Agreement Record Keeping (Admin)**: Legal evidence system for storing user consent records (`term_agreements` table). Features include:
  - Full terms content snapshot at time of agreement (not a reference)
  - SHA-256 hash for content integrity verification (contentHash)
  - Electronic signature storage with SHA-256 signature hash (signatureHash)
  - IP address (first IP from x-forwarded-for), user agent, and timestamp recording
  - Member identification (CEO birth, CI from identity verification, phone)
  - Term versions from CMS for traceability
  - Admin page for searching and viewing agreement records (/admin/term-agreements)

## External Dependencies

### Database
- **PostgreSQL**: Primary database.
- **Drizzle Kit**: For database migrations.

### UI/UX Libraries
- **Radix UI**: Accessible primitive components.
- **Lucide React**: Icon library.
- **embla-carousel-react**: Carousel component.
- **vaul**: Drawer component.
- **cmdk**: Command palette component.
- **react-day-picker**: Calendar/date picker.
- **recharts**: Charting library.

### Session Storage
- **memorystore**: In-memory session store for development.

### Image Storage
- **Cloudflare R2**: S3-compatible object storage for images. Public URL: `https://pub-ecc7de5cc4bd40e3965936a44b6.r2.dev`.

### Other APIs
- **Resend**: For email sending functionality.