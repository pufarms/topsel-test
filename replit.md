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
3. **테이블 스크롤 (필수!)**: 주문/통계 관련 모든 테이블에 가로+세로 스크롤 적용
   - **페이지 레벨**: 페이지는 가로 스크롤 금지 (`overflow-x-hidden`)
   - **레이아웃**: admin-layout의 main에 `overflow-x-hidden`, 콘텐츠 div에 `min-w-0`
   - **Card 컴포넌트**: 테이블을 포함하는 Card에 `overflow-hidden` 필수
   - **CardContent**: `overflow-hidden` 추가
   - **테이블 컨테이너**: `overflow-x-auto overflow-y-auto max-h-[600px]` 클래스 필수
   - **테이블**: `w-max` 또는 `min-w-[1600px]` 등으로 자연스럽게 확장
   - **테이블 헤더 고정**: `<TableHeader className="sticky top-0 z-10 bg-background">`
   - **표시 개수 선택**: "10개씩, 30개씩, 100개씩, 전체" 옵션 제공
   - **flex 컨테이너**: flex-1 요소에는 반드시 `min-w-0` 추가 (콘텐츠 오버플로우 허용)
   - 예시 구조:
     ```
     <Card className="overflow-hidden">
       <CardContent className="overflow-hidden">
         <div className="border rounded-lg overflow-x-auto overflow-y-auto max-h-[600px]">
           <Table className="w-max">
             <TableHeader className="sticky top-0 z-10 bg-background">...
           </Table>
         </div>
       </CardContent>
     </Card>
     ```
4. **카테고리 연동 (필수!)**: 모든 대분류/중분류/소분류 필터는 "상품관리/카테고리관리"와 연동
   - 카테고리 데이터 소스: `/api/categories` 엔드포인트 (categories 테이블)
   - 카테고리 레벨: `large` (대분류), `medium` (중분류), `small` (소분류)
   - 계단식 필터링: 대분류 선택 → 해당 중분류만 표시 → 해당 소분류만 표시
   - 상품관리와 연동: 상품의 카테고리는 반드시 카테고리관리에서 설정된 카테고리와 매칭되어야 함

5. **공통 필터 컴포넌트 (필수!)**: 관리자와 회원은 각각 별도의 공통 필터 컴포넌트 사용
   - **관리자 필터**: `AdminCategoryFilter` 컴포넌트 사용
     - 위치: `client/src/components/admin/AdminCategoryFilter.tsx`
     - 특징: 상호명(회원) 검색/선택, 대분류/중분류/소분류 계단식, 키워드 검색
     - 회원 필터링: `members.id` (UUID) 사용
     - 적용 대상: 관리자 주문관리 8개 페이지
   - **회원 필터**: `MemberOrderFilter` 컴포넌트 사용
     - 위치: `client/src/components/member/MemberOrderFilter.tsx`
     - 특징: 대분류/중분류/소분류 계단식, 날짜 범위, 검색어 (선택적)
     - 적용 대상: 회원 마이페이지 주문관리 5개 탭
   - **새 리스트 테이블 추가 시**: 반드시 해당 영역의 공통 필터 컴포넌트 적용
   - **중요**: 검색 필터는 페이지 전체가 아닌 해당 리스트 테이블에만 적용
   - 한 페이지에 여러 리스트 테이블이 있으면 각 테이블마다 독립적인 필터 컴포넌트 적용

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
- `term_agreements`: Stores user consent records with content snapshots and hashes for integrity.

### Core Features
- **Member Mypage**: Self-service profile page for members (`/mypage`).
- **Product Management (Admin Only)**: Role-based access for product categories, registration, and status viewing.
- **Inventory Management (Admin Only)**: Material management, product mapping, stock status, and history tracking. Supports bulk Excel uploads.
- **Stock History Tracking**: Comprehensive tracking of all stock changes.
- **Product Mapping**: Links products to necessary materials for inventory control.
- **Admin Design System**: Standardized components and design rules for consistent UI.
- **Admin Category Filter**: Specialized filter component for admin order pages with member selection, cascading category filters, and keyword search.
- **Excel Upload Standard Pattern**: Supports `.xlsx` and `.xls` files for data import using `multer` and `xlsx`.
- **Partial Order Upload (주문 부분 업로드)**: Excel order upload supports partial registration when validation errors exist, with an option to register only valid rows and download an error report.
- **Site Settings Management (Admin)**: Manages site-wide settings (header, footer, general).
- **Header Menu Management (Site Settings - 헤더 탭)**: Manages dynamic header menus with conditional visibility and drag-and-drop ordering.
- **Page Management (Admin)**: CMS for dynamic page creation and management with a visual content editor, real-time preview, and access level control.
- **Term Agreement Record Keeping (Admin)**: Legal evidence system for storing user consent records with content snapshots, SHA-256 hashes for integrity, and detailed metadata.
- **Smart Address Validation System (스마트 주소 검증 시스템)**: Automatically validates and normalizes recipient addresses during Excel order uploads using a multi-step pipeline including regex matching, pattern similarity, rule-based validation (Juso.go.kr API), and AI normalization (Anthropic Claude AI). It auto-learns from AI results to improve efficiency.
  - Validation Statuses: `VALID`, `WARNING`, `INVALID`.
  - Integration: Invalid addresses cause errors in partial uploads, warnings add notes to shipping messages, and validated addresses are stored.

### Order Workflow (주문 워크플로우)
Orders progress through the following stages, with SSE events updating dashboards in real-time for both administrators and members:

1.  **주문대기** (Pending Orders): Member submits an order.
2.  **주문조정** (Order Adjustment): Admin adjusts orders, including cancellation.
3.  **상품준비중** (Product Preparation): Admin prepares products and prints waybills.
4.  **배송준비중** (Ready for Shipping): Automatically moves here after waybill registration. Members can request cancellations.
5.  **배송중** (In Shipping): Admin moves orders to this stage. Settlement (deposit, points) occurs here.

**Important Rule**: All order status changes trigger SSE events (`order-updated`, `orders-deleted`, `order-created`) for real-time notifications and dashboard updates.

## External Dependencies

### Database
- **PostgreSQL**: Primary database.

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
- **Cloudflare R2**: S3-compatible object storage for images.

### Other APIs
- **Resend**: For email sending functionality.
- **Juso.go.kr (행정안전부 주소 API)**: For delivery address verification.
- **Anthropic Claude AI**: For detailed address normalization (optional).