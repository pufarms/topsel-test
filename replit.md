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
10. **categories**: id (UUID), name, level (large/medium/small), parentId (FK), createdAt, updatedAt - 3단계 상품 카테고리
11. **product_registrations**: id (UUID), status (active/suspended), categoryLarge, categoryMedium, categorySmall, weight, productCode (unique), productName, sourceProduct, sourcePrice, lossRate, sourceWeight, unitPrice (계산), boxCost, materialCost, outerBoxCost, wrappingCost, laborCost, shippingCost, totalCost (계산), startMarginRate, startPrice (계산), startMargin (계산), drivingMarginRate, drivingPrice (계산), drivingMargin (계산), topMarginRate, topPrice (계산), topMargin (계산), suspendedAt, suspendReason, createdAt, updatedAt
6. **products**: id (UUID), productCode (unique), productName, category, price, status
7. **partner_products**: id (UUID), partnerId (FK), productId (FK) - Many-to-many relationship
8. **members**: id (UUID), username (unique), password, grade (PENDING/ASSOCIATE/START/DRIVING/TOP), companyName, businessNumber, businessAddress, representative, phone, managerName, managerPhone, email, deposit, point, status (활성/비활성), memo, approvedAt, approvedBy, createdAt, updatedAt
9. **member_logs**: id (UUID), memberId (FK), adminId (FK), action, beforeData (JSON), afterData (JSON), createdAt - 회원 변경 이력
12. **material_categories_large**: id (UUID), name (unique), sortOrder, createdAt, updatedAt - 재료 대분류
13. **material_categories_medium**: id (UUID), largeCategoryId (FK), name, sortOrder, createdAt, updatedAt - 재료 중분류
14. **materials**: id (UUID), materialType (raw/semi/sub), largeCategoryId (FK), mediumCategoryId (FK), materialCode (unique, R001/S001/B001 형식), materialName, currentStock, createdAt, updatedAt - 재료

### Authentication Flow
- Session-based authentication stored server-side
- `/api/auth/me` - Check current session
- `/api/auth/login` - Create session (username-based)
- `/api/auth/logout` - Destroy session
- `/api/auth/register` - Create user and session
- Role-based access control: SUPER_ADMIN (최고관리자), ADMIN (관리자), seller (셀러)
- Single SUPER_ADMIN account: kgong5026

### Product Management (관리자 전용)
- **접근 권한**: SUPER_ADMIN, ADMIN만 접근 가능 (회원 접근 불가)
- **라우트**: /admin/products/* (AdminRoute로 보호)
- **페이지**:
  - 카테고리 관리: /admin/products/categories
  - 상품등록 (공급가 계산): /admin/products/registration
  - 차주 예상공급가 상품: /admin/products/next-week
  - 현재 공급가 상품: /admin/products/current
  - 공급 중지 상품: /admin/products/suspended
- **API 보안**: 모든 mutation 엔드포인트에 관리자 권한 검사 (403 반환)

### Inventory Management (재고관리 - 관리자 전용)
- **접근 권한**: SUPER_ADMIN, ADMIN만 접근 가능
- **라우트**: /admin/inventory/* (AdminRoute로 보호)
- **페이지**:
  - 재료 관리: /admin/inventory/materials (3단 레이아웃: 대분류/중분류/재료)
  - 상품 매핑: /admin/inventory/mapping (준비 중)
  - 재고 현황: /admin/inventory/status (준비 중)
  - 입고 관리: /admin/inventory/receiving (준비 중)
  - 재고 이력: /admin/inventory/history (준비 중)
- **재료타입**: raw(원재료/R코드), semi(반재료/S코드), sub(부재료/B코드)
- **자동 코드 생성**: 재료코드 미입력 시 자동 생성 (R001, R002... 등)
- **재고 불변성**: 재료 수정 시 재고 변경 불가 (입고 관리에서만 변경)
- **엑셀 일괄 업로드**: 양식 다운로드(.xlsx) 후 엑셀 업로드로 재료 일괄 등록

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

## Admin Design System

### Common Components (client/src/components/admin/)
- **PageHeader**: Page title with icon, description, and action buttons
- **StatCard / StatCardsGrid**: Compact statistics cards (h-16, 3-6 columns grid)
- **FilterSection / FilterField**: Search and filter controls with p-3 padding
- **DataTable**: Compact table with selectable rows, px-3 py-2 cells
- **ActionSection**: Collapsible bulk action panel
- **MobileCard / MobileCardsList**: Mobile-friendly card layout (lg:hidden)

### Design Rules
- Page padding: p-4
- Section gap: space-y-3
- Card padding: p-3
- Input/Button height: h-9
- Table cell padding: px-3 py-2
- Responsive: Table on lg+, Cards on mobile

### Usage Example
```tsx
import { PageHeader, StatCard, FilterSection, DataTable } from "@/components/admin";

<div className="space-y-3 p-4">
  <PageHeader title="페이지명" icon={Icon} />
  <StatCardsGrid columns={6}>{/* StatCards */}</StatCardsGrid>
  <FilterSection onReset={handleReset}>{/* FilterFields */}</FilterSection>
  <DataTable columns={columns} data={data} keyField="id" />
</div>
```

## 엑셀 업로드 표준 패턴

이 웹사이트의 모든 엑셀 업로드 기능은 다음 패턴을 따라야 합니다:

### 프론트엔드 (클라이언트)
1. **파일 입력**: `accept=".xlsx,.xls"` 설정
2. **파일 전송**: FormData로 서버에 파일 직접 전송 (클라이언트에서 파싱하지 않음)
3. **업로드 뮤테이션**:
```tsx
const uploadMutation = useMutation({
  mutationFn: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/endpoint/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    if (!res.ok) throw new Error((await res.json()).message);
    return res.json();
  },
});
```

### 백엔드 (서버)
1. **multer 미들웨어**: 메모리 스토리지 사용
```ts
const excelUpload = multer({ storage: multer.memoryStorage() });
app.post("/api/endpoint/upload", excelUpload.single("file"), async (req, res) => { ... });
```
2. **xlsx 라이브러리**: 서버에서 엑셀 파싱
```ts
const XLSX = await import("xlsx");
const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
```
3. **양식 다운로드**: xlsx 라이브러리로 엑셀 파일 생성
```ts
const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "시트명");
const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
res.setHeader("Content-Disposition", "attachment; filename=template.xlsx");
return res.send(buffer);
```

### 적용된 페이지
- 상품등록 (공급가 계산): /admin/products/registration
- 재료 관리: /admin/inventory/materials

## TODO: 미구현 기능
### 이메일 발송 기능
- **위치**: server/routes.ts - POST /api/admin/members/:id/reset-password
- **목적**: 비밀번호 초기화 시 회원 이메일로 임시 비밀번호 발송
- **필요 작업**:
  1. Resend 또는 SendGrid 연동 설정
  2. RESEND_API_KEY 환경변수 설정
  3. TODO 주석 부분 구현