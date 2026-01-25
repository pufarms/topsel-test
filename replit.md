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
- **HTTP Server**: Node's native HTTP server
- **Session Management**: express-session with memorystore (development)
- **API Design**: RESTful JSON API endpoints under `/api`
- **Authentication**: Session-based with SHA256 password hashing and role-based access control (SUPER_ADMIN, ADMIN, seller)

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: Shared `shared/schema.ts`
- **Validation**: Zod schemas generated from Drizzle
- **Database Connection**: `node-postgres` (pg) pool

### Database Schema Highlights
- `users`: User authentication and role management (SUPER_ADMIN, ADMIN, seller)
- `orders`: Core order details and user linkage
- `products`, `product_registrations`, `categories`: Comprehensive product and category management, including supply price calculation.
- `materials`, `material_categories_*`: Multi-level inventory management for raw, semi, and sub-materials with automatic code generation.
- `product_mappings`, `product_material_mappings`: Links products to their required materials for inventory control.
- `members`, `member_logs`: Member (partner) management and historical changes.
  - Members can log in separately from admin users and access their own mypage.
  - Member authentication checks: status="활성" and grade≠"PENDING"
- `images`: Storage of various image types with categories and subcategories.

### Member Mypage (Member Only)
- **Route**: `/mypage` - Member self-service profile page
- **API Endpoints**:
  - `GET /api/member/profile`: Get current logged-in member's profile
  - `PATCH /api/member/profile`: Update member's own profile
- **Editable fields**: representative, businessAddress, phone, managerName, managerPhone, email, password
- **Read-only fields**: companyName, businessNumber, username, grade, deposit, point
- **Access control**: Only accessible when session.userType === "member"
- **Data synchronization**: Admin and member both modify the same `members` table, ensuring real-time sync

### Product Management (Admin Only)
- Role-based access control for SUPER_ADMIN and ADMIN.
- Dedicated routes for category management, product registration (with supply price calculation), and viewing product statuses (current, next-week, suspended).
- Secure API endpoints enforce administrator permissions.

### Inventory Management (Admin Only)
- Role-based access control for SUPER_ADMIN and ADMIN.
- Features include material management (4-level category structure), product mapping, stock status, and stock history tracking.
- Materials have types (raw, semi, sub) and support automatic code generation.
- Strict rules for stock immutability and deletion constraints on categories.
- Supports bulk upload of materials via Excel.

### Stock History Tracking
- Comprehensive tracking of all stock changes (공급상품 and 원재료)
- Records: stockType, actionType (in/out/adjust), itemCode, itemName, quantity, beforeStock, afterStock, reason, note, adminId, source, orderId
- Automatic history recording on: product stock-in, stock adjustment, stock deletion, material stock adjustment
- Source field supports: "manual" (현재 사용), "order" (주문 연동 대비)
- API endpoints: GET /api/stock-history (with filters), GET /api/stock-history/admins, GET /api/stock-history/download
- Frontend: Filter by stockType, actionType, source, adminId, date range, keyword search; pagination; Excel download

### Product Mapping
- Enables mapping products to necessary materials (raw, semi, sub) for inventory integration.
- Provides a list of products with filtering and search, supporting responsive table/card views.
- **Category Filtering**: Hierarchical filtering by product categories (대/중/소분류)
  - Large category (대분류) dropdown enables medium category dropdown when selected
  - Medium category (중분류) dropdown enables small category dropdown when selected
  - Category data synced from product_registrations categories
- Allows adding products from existing registrations or direct input.
- Supports material selection, quantity input, and full replacement saving for mappings.
- Automatic status updates (complete/incomplete) based on material assignments.
- Includes Excel template download and bulk upload functionality for products and materials.
- **Mapping Check Before Send**: When sending products to "차주 예상공급가 상품", the system checks if products are mapped. Unmapped products trigger a dialog prompting navigation to the mapping page.

### Admin Design System
- Standardized components (PageHeader, StatCard, FilterSection, DataTable, MobileCard) for consistent UI.
- Common design rules for padding, section gaps, card padding, input/button heights, and responsive behavior.
- Admin sidebar adapts to screen size (hidden on mobile, collapsed on tablet, expanded on desktop).

### Excel Upload Standard Pattern
- Supports `.xlsx` and `.xls` file formats.
- Frontend uses FormData to send files directly to the server.
- Backend utilizes `multer` for memory storage and `xlsx` library for parsing.
- Server-side generation of Excel files for template downloads.

### Site Settings Management (Admin)
- **Database Table**: `siteSettings` stores key-value pairs with type information (string, boolean, number, json)
- **Categories**: header (로고, 버튼 표시), footer (회사정보, 링크), general (사이트명, 설명)
- **API Endpoints**:
  - `GET /api/site-settings/public`: Public endpoint for header/footer (no auth required)
  - `GET /api/site-settings`: Admin-only, all settings
  - `PUT /api/site-settings/bulk`: Admin-only, bulk update
  - `POST /api/site-settings/seed`: SUPER_ADMIN only, create initial settings
- **Admin Page**: `/admin/settings/site` with tabs (일반, 헤더, 푸터) - 메뉴관리는 헤더 탭 안에 포함
- **Public Components**: 
  - `PublicHeader`: Dynamic header from settings (logo, dynamic menus, login/register/cart buttons)
  - `PublicFooter`: Dynamic footer from settings (company info, copyright, links)
  - `PublicLayout`: Wrapper component with header + content + footer
- **Hook**: `useSiteSettings` with `usePublicSiteSettings()`, `useAdminSiteSettings()`, `useUpdateSiteSettings()`

### Header Menu Management (Site Settings - 헤더 탭)
- **Database Table**: `headerMenus` stores menu items with name, path, sortOrder, isVisible, openInNewTab, menuType, systemKey, showWhenLoggedIn, showWhenLoggedOut
- **Menu Types**:
  - `custom`: 사용자 정의 메뉴 (관리자가 추가)
  - `system`: 시스템 메뉴 (login, logout, register, cart, mypage)
- **Conditional Visibility**: 
  - `showWhenLoggedIn`: 로그인 사용자에게 표시 여부
  - `showWhenLoggedOut`: 비로그인 사용자에게 표시 여부
- **API Endpoints**:
  - `GET /api/header-menus/public`: Public endpoint for visible menus ordered by sortOrder
  - `GET /api/header-menus`: Admin-only, all menus
  - `POST /api/header-menus`: Create new menu
  - `PUT /api/header-menus/:id`: Update menu
  - `DELETE /api/header-menus/:id`: Delete menu
  - `PUT /api/header-menus/order/update`: Bulk update menu order
  - `POST /api/header-menus/seed`: SUPER_ADMIN only, create default system menus
- **Features**:
  - Add/Edit/Delete menus with name and path
  - Drag-style ordering via up/down arrows
  - Visibility toggle (show/hide menus on public site)
  - Login-based conditional display (로그인/비로그인 시 표시)
  - System menu seed button (로그인, 로그아웃, 회원가입, 장바구니, 마이페이지)
  - "Open in new tab" option for external links
  - Responsive design with desktop/mobile views in PublicHeader
- **Hooks**: `usePublicHeaderMenus()`, `useAdminHeaderMenus()`, `useCreateHeaderMenu()`, `useUpdateHeaderMenu()`, `useDeleteHeaderMenu()`, `useUpdateHeaderMenuOrder()`, `useSeedHeaderMenus()`
- **PublicHeader Logic**: All menus displayed on right side, filtered by login status

### Page Management (Admin)
- **Database Table**: `pages` stores page definitions with categories, access levels, and settings
- **Page Categories (8)**:
  1. 기본페이지: 로그인, 로그아웃, 회원가입, 이용약관, 개인정보처리방침, 개인정보 제3자 동의
  2. 메인/서브페이지: 메인 페이지, 서브페이지
  3. 회원마이페이지: 마이페이지 대시보드, 회원정보
  4. 주문관리페이지: 주문등록, 취소건 관리, 운송장 다운로드, 배송중/완료 리스트
  5. 통계관리페이지: 상품별 통계관리, 정산 관리
  6. 가이드페이지: 회원가입과 등급, 주문/발주 관리, 상품, 예치금/포인트 정산, 혜택과 지원
  7. 게시판관리페이지: 일반 게시판, 회원전용 게시판
  8. 기타페이지
- **Access Levels**: all (전체 공개), ASSOCIATE (준회원 이상), START (Start회원 이상), DRIVING (Driving회원 이상), TOP (Top회원 전용)
- **API Endpoints**:
  - `GET /api/pages`: Admin-only, all pages
  - `POST /api/pages`: Create new page (with Zod validation)
  - `PUT /api/pages/:id`: Update page (with Zod validation)
  - `DELETE /api/pages/:id`: Delete page (system pages cannot be deleted)
  - `POST /api/pages/seed`: SUPER_ADMIN only, create default pages
- **UI Features**:
  - List view grouped by 8 categories with collapsible sections
  - Each page shows name, path, status badge, access level badge, system flag
  - Add/Edit/Delete pages with category, access level, and status selection
  - Search functionality across all pages
  - System pages (isSystem="true") cannot be deleted

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
- **recharts**: Charting library (via shadcn chart component).

### Session Storage
- **memorystore**: In-memory session store for development.
- **connect-pg-simple**: Available for PostgreSQL session storage in production.

### Image Storage
- **Cloudflare R2**: S3-compatible object storage.
- **R2 Public URL**: `https://pub-ecc7de5cc4bd40e3965936a44b6.r2.dev`
- Supports image categorization (banner, product, icon, misc) with subcategories.
- Features include drag-and-drop upload, auto-dimension detection, and 2-level category filtering.

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: Key for session encryption.
- `R2_ACCESS_KEY_ID`: Cloudflare R2 access key.
- `R2_SECRET_ACCESS_KEY`: Cloudflare R2 secret key.
- `RESEND_API_KEY`: For email sending (e.g., password resets).