# Order Management System

## Overview

A Korean-language order management system (주문관리 시스템) designed for sellers to submit orders and administrators to manage all orders and users. The application features role-based authentication with separate dashboards for sellers and admins, order entry forms, order history tables, and user management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

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