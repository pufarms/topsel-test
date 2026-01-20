# Order Management System

## Overview

A Korean-language order management system (주문관리 시스템) designed for sellers to submit orders and administrators to manage all orders and users. The application features role-based authentication with separate dashboards for sellers and admins, order entry forms, order history tables, and user management capabilities.

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
- **Routing**: Wouter (lightweight router alternative to React Router)
- **State Management**: TanStack React Query for server state, React Context for auth state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Font**: Pretendard (Korean optimized font) imported via CDN
- **Responsive Design**: Mobile-first approach with breakpoints (sm:640px, md:768px, lg:1024px, xl:1280px)
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers
- **Build Tool**: Vite with custom configuration for path aliases (@/, @shared/, @assets/)

### Backend Architecture
- **Framework**: Express 5 running on Node.js with TypeScript
- **HTTP Server**: Node's native HTTP server wrapping Express
- **Session Management**: express-session with memorystore for development (consider connect-pg-simple for production)
- **API Design**: RESTful JSON API endpoints under /api prefix
- **Authentication**: Session-based auth with SHA256 password hashing (stored in sessions)

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: shared/schema.ts (shared between client and server)
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Database Connection**: node-postgres (pg) pool

### Database Schema
Main tables:
1. **users**: id (UUID), username (unique), email, password (hashed), name, role (SUPER_ADMIN/ADMIN/seller), tier, permissions (JSON), createdAt, lastLoginAt
2. **orders**: id (UUID), userId (FK), productName, quantity, price, recipientName, recipientPhone, recipientAddress, createdAt
3. **images**: id (UUID), filename, storagePath, publicUrl, category, subcategory, fileSize, mimeType, width, height, uploadedAt, uploadedBy (FK)
4. **image_subcategories**: id (UUID), name, category, createdAt
5. **partners**: id (UUID), username, password, companyName, businessNumber, representative, address, phone1, phone2, shippingCompany, status, createdAt, updatedAt
6. **products**: id (UUID), productCode (unique), productName, category, price, status
7. **partner_products**: id (UUID), partnerId (FK), productId (FK) - Many-to-many relationship
8. **members**: id (UUID), username (unique), password, grade (PENDING/ASSOCIATE/START/DRIVING/TOP), companyName, businessNumber, businessAddress, representative, phone, managerName, managerPhone, email, deposit, point, status (활성/비활성), memo, approvedAt, approvedBy, createdAt, updatedAt
9. **member_logs**: id (UUID), memberId (FK), adminId (FK), action, beforeData (JSON), afterData (JSON), createdAt - 회원 변경 이력

### Authentication Flow
- Session-based authentication stored server-side
- `/api/auth/me` - Check current session
- `/api/auth/login` - Create session (username-based)
- `/api/auth/logout` - Destroy session
- `/api/auth/register` - Create user and session
- Role-based access control: SUPER_ADMIN (최고관리자), ADMIN (관리자), seller (셀러)
- Single SUPER_ADMIN account: kgong5026

### Admin Sidebar Responsive Behavior
- **Mobile (< 768px)**: Sidebar hidden, hamburger menu toggles overlay
- **Tablet (768px - 1024px)**: Sidebar collapsed (icons only with tooltips)
- **Desktop (> 1024px)**: Sidebar fully expanded with labels

### Build System
- Development: tsx for TypeScript execution with Vite dev server
- Production: esbuild bundles server code, Vite builds client to dist/public
- Script: script/build.ts handles full production build

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via DATABASE_URL environment variable
- **Drizzle Kit**: Database migrations stored in /migrations directory

### UI Framework Dependencies
- **Radix UI**: Full suite of accessible primitive components
- **Lucide React**: Icon library
- **embla-carousel-react**: Carousel component
- **vaul**: Drawer component
- **cmdk**: Command palette component
- **react-day-picker**: Calendar/date picker
- **recharts**: Charting library (via shadcn chart component)

### Session Storage
- **memorystore**: In-memory session store for development
- **connect-pg-simple**: Available for PostgreSQL session storage in production

### Image Storage
- **Cloudflare R2**: S3-compatible object storage for images
- **R2 Public URL**: https://pub-ecc7de5cc4bd40e3965936a44b6.r2.dev
- **Image Categories**: 배너, 상품, 아이콘, 기타 (with customizable subcategories)
- **Features**: Drag-and-drop upload, auto-dimension detection, 2-level category filtering

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret key for session encryption (optional, has default)
- `R2_ACCESS_KEY_ID`: Cloudflare R2 access key
- `R2_SECRET_ACCESS_KEY`: Cloudflare R2 secret key
- `RESEND_API_KEY`: (TODO) Resend API key for email sending (password reset notifications)

## TODO: 미구현 기능
### 이메일 발송 기능
- **위치**: server/routes.ts - POST /api/admin/members/:id/reset-password
- **목적**: 비밀번호 초기화 시 회원 이메일로 임시 비밀번호 발송
- **필요 작업**:
  1. Resend 또는 SendGrid 연동 설정
  2. RESEND_API_KEY 환경변수 설정
  3. TODO 주석 부분 구현