# Order Management System

## Overview

This project is a Korean-language order management system designed to streamline operations for sellers and administrators. Its primary purpose is to allow sellers to efficiently submit orders and provide administrators with comprehensive tools for managing all orders and users. Key capabilities include robust role-based authentication, separate dashboards tailored for sellers and administrators, intuitive order entry forms, detailed order history tracking, and extensive user management functionalities. The system aims to enhance efficiency, reduce manual errors, and provide a centralized platform for order and user data, with a strong emphasis on critical business rules for pricing, responsive design, and integrated category management.

## User Preferences

Preferred communication style: Simple, everyday language.

### 개발 원칙 (CRITICAL - 절대 잊지 말 것!)

**기존 기능 보존:**
1. **새 기능 추가/수정 시 기존 기능 손상 금지**: 다른 기능을 추가하거나 수정할 때 이미 작동하던 기능이 깨지지 않도록 반드시 확인
2. **수정 전 영향 범위 분석**: 코드 수정 전에 해당 코드가 어디서 사용되는지 확인하고, 관련된 모든 부분이 계속 작동하는지 검증
3. **SSE 실시간 업데이트 유지**: 주문 관련 기능 수정 시 SSE 이벤트 발송 및 쿼리 무효화 로직이 유지되는지 확인
4. **API 호출 일관성 유지**: pending_orders 관련 페이지는 모두 `/api/admin/pending-orders` 또는 `/api/member/pending-orders` 사용

### 주문 상태 워크플로우 (4단계 + 예외)

**정상 흐름 (4단계):**
```
1. 대기 (주문조정 단계) → pending.tsx
   └→ 조건 충족 시 상품준비중으로 이동
   
2. 상품준비중 (운송장 출력 단계) → preparing.tsx
   └→ 운송장 입력 시 배송준비중으로 이동 (자동/수동)
   
3. 배송준비중 (회원취소건 접수 단계) → ready-to-ship.tsx
   └→ 취소건 접수처리 완료 시 배송중으로 이동
   
4. 배송중 → shipping.tsx
```

**예외 상태:**
- 주문조정: 재고 부족 등으로 조정이 필요한 주문 → admin-cancel.tsx
- 취소: 취소된 주문 → cancelled.tsx

**핵심 규칙:**
1. **상태 유일성**: 동일 주문은 4단계 중 하나의 단계에만 존재 (중복 불가)
2. **순차적 진행**: 모든 주문은 1→2→3→4 순서로 진행 (예외 상태로 분리되는 경우 제외)
3. **API 일관성**: 모든 주문 페이지는 `/api/admin/pending-orders` 사용
4. **상태값**: `["대기", "주문조정", "상품준비중", "배송준비중", "배송중", "취소"]`

### 핵심 비즈니스 규칙 (CRITICAL - 절대 잊지 말 것!)

**상품가격 체계 및 기준:**
1. **현재공급가가 모든 기준!**: 주문관리, 정산, 통계 등 모든 실제 운영의 기준은 **현재공급가(current_products)** 테이블입니다.
2. **상품등록/예상공급가는 준비 단계일 뿐**: 
   - `상품등록(공급가계산)` → 1원 단위로 정밀 계산
   - `차주 예상공급가` → 10원 올림 후 저장 (준비 단계)
   - `현재공급가` → 실제 운영 적용 (모든 주문/정산의 기준)
3. **10원 올림 시점**: 전송(Transmission) 단계에서 적용
   - 상품등록 → 예상공급가 전송 시: `Math.ceil(price/10)*10` 적용 후 저장
   - 예상공급가 → 현재공급가 전송 시: 올림된 가격 유지
4. **주문 검증 기준**: 회원 주문 업로드 시 반드시 **현재공급가 테이블**에서 상품 존재 여부 확인
   - `getCurrentProductByCode()` 사용 (NOT getProductRegistrationByCode)
   - 공급중지 상품(supplyStatus === 'suspended')도 주문 불가
5. **회원 등급별 공급가**: 주문 시 회원의 grade에 따라 해당 공급가 적용 (start/driving/top)
   - `getSupplyPriceByGrade()` 헬퍼 함수로 매핑: START→startPrice, DRIVING→drivingPrice, TOP→topPrice
   - ASSOCIATE/PENDING은 START 가격 기본값 (실제로는 주문 불가)
6. **주문 가능 등급 제한**: START, DRIVING, TOP만 주문 등록 가능
   - PENDING(승인대기), ASSOCIATE(준회원)은 주문 등록 불가 (API 403 반환)
   - 준회원(ASSOCIATE) 이상은 상품리스트에서 현재공급가/차주예상공급가 조회 및 다운로드 가능
7. **가격 확정 워크플로우**: 
   - 미확정 주문 (대기~배송준비중): 실시간으로 current_products에서 등급별 가격 표시
   - 확정 주문 (배송중): "배송중 전환" 시점에 가격 확정 (priceConfirmed=true), 이후 가격 변동 없음
   - 통계 API: 확정 주문은 저장된 가격, 미확정 주문은 실시간 계산 (하이브리드 방식)

### 정산 시스템 (Settlement System)

**잔액 구조:**
- 예치금(deposit): 계좌이체 후 관리자가 충전, 주문 정산 시 차감
- 포인터(point): 관리자가 지급, 주문 정산 시 우선 차감
- 사용 가능 잔액 = (예치금 + 포인터) - (대기~배송준비중 주문 총액)

**잔액 검증 시점:**
1. 개별 주문 등록 시 (⑤-1 단계): 단건 주문금액 vs 사용가능잔액
2. 엑셀 일괄 업로드 시 (⑩-1 단계): 정상건 총 주문금액 vs 사용가능잔액
3. 잔액 부족 시 상세 메시지 반환 (부족금액, 예치금, 포인터, 진행중 주문액)

**자동 정산 (배송중 전환 시):**
- 회원별로 주문 그룹핑 → 순차 정산 처리
- 차감 순서: 포인터 우선 차감 → 예치금 차감
- 이력 기록: settlement_history, pointer_history, deposit_history
- 잔액 부족 시 해당 주문부터 실패 처리, 정상 처리된 건만 전환

**관리자 기능:**
- 예치금 충전/환급: `/api/admin/members/:memberId/deposit/charge|refund`
- 포인터 지급: `/api/admin/members/:memberId/pointer/grant`
- 정산/예치금/포인터 이력 조회: `/api/admin/settlements|deposit-history|pointer-history`
- 회원별 잔액 현황: `/api/admin/members-balance`

**회원 기능:**
- 내 잔액 조회: `/api/member/my-balance`
- 정산/예치금/포인터 이력 조회: `/api/member/my-settlements|my-deposit-history|my-pointer-history`

**DB 테이블:**
- `settlement_history`: 주문 정산 이력 (포인터차감, 예치금차감, 총액, 잔액)
- `deposit_history`: 예치금 변동 이력 (충전/환급/차감)
- `pointer_history`: 포인터 변동 이력 (지급/차감)

**프론트엔드 페이지:**
- 관리자: `/admin/settlements` (회원 잔액 현황, 정산/예치금/포인터 이력 탭, 충전/환급/지급 다이얼로그)
- 회원: 대시보드 예치금충전 탭 (잔액 현황, 정산/예치금/포인터 이력 탭)

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

### 페이지 접근권한 체계 (8단계 계층)
- **접근권한 레벨**: `all` < `PENDING` < `ASSOCIATE` < `START` < `DRIVING` < `TOP` < `ADMIN` < `SUPER_ADMIN`
- **페이지관리**에서 각 페이지의 접근권한을 8단계 중 하나로 설정
- **계층 구조**: 상위 등급은 하위 등급 페이지에도 접근 가능 (예: ADMIN은 TOP 이하 모든 페이지 접근 가능)
- **권한 라벨**:
  - `all`: 전체 공개 (비로그인 포함)
  - `PENDING`: 보류회원 이상
  - `ASSOCIATE`: 준회원 이상
  - `START`: Start회원 이상
  - `DRIVING`: Driving회원 이상
  - `TOP`: Top회원 이상
  - `ADMIN`: 관리자(부관리자) 이상
  - `SUPER_ADMIN`: 최고관리자 전용
- **서버 체크**: `/api/pages/by-path` 엔드포인트에서 `pageAccessLevelRank` 기반으로 접근권한 검증
- **관리자 역할**: SUPER_ADMIN(최고관리자)은 부관리자(ADMIN)의 메뉴 권한을 설정 가능 (12개 메뉴 권한 체크박스)
- **헬퍼 함수**: `getUserAccessRank()`, `canAccessPage()` (shared/schema.ts)

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, Wouter for routing.
- **State Management**: TanStack React Query for server state, React Context for authentication.
- **UI/Styling**: shadcn/ui built on Radix UI, Lucide React for icons, Tailwind CSS with CSS variables for theming (light/dark mode), mobile-first responsive design.
- **Form Handling**: React Hook Form with Zod validation.
- **Build Tool**: Vite with custom path aliases.
- **Design System**: Topsel Design System (v2.0.0) governs global styles, color palette (e.g., `--primary: #5D7AF2`, `--navy: #111827`), section background alternation (White ↔ Navy), responsive breakpoints (xs: 375px, md: 768px, lg: 1024px), and typography classes (e.g., `.h1-hero`, `.body-text`).

### Backend Architecture
- **Framework**: Express 5 on Node.js with TypeScript.
- **Session Management**: express-session with memorystore (development).
- **API Design**: RESTful JSON API endpoints under `/api`.
- **Authentication**: Session-based with SHA256 password hashing and role-based access control (SUPER_ADMIN, ADMIN, seller).

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Shared `shared/schema.ts` with Zod schemas generated from Drizzle.
- **Database Schema Highlights**: Key tables include `users`, `orders`, `products`, `product_registrations`, `categories`, `materials`, `product_mappings`, `members`, `images`, `siteSettings`, `headerMenus`, `pages`, and `term_agreements`.

### Core Features
- **User Portals**: Member Mypage and Admin-specific dashboards for product, inventory, and site management.
- **Product & Inventory Management**: Comprehensive tools for product categories, registration, material management, product mapping, stock tracking, and bulk Excel uploads.
- **Admin Design System**: Standardized components and design rules for consistent UI.
- **Filter Components**: Dedicated `AdminCategoryFilter` and `MemberOrderFilter` for distinct user roles, enabling advanced search and cascading category selection.
- **Excel Upload Standard Pattern**: Supports `.xlsx` and `.xls` for data import (`multer`, `xlsx`), including partial order uploads with error reporting.
- **CMS & Configuration**: Site Settings Management, Header Menu Management (dynamic, drag-and-drop), and Page Management for dynamic content with visual editor and access control.
- **Legal Compliance**: Term Agreement Record Keeping with content snapshots and SHA-256 hashes for integrity.
- **Smart Address Validation System**: Multi-step pipeline for validating and normalizing recipient addresses during Excel order uploads, utilizing regex, pattern similarity, rule-based validation, and AI normalization with a learning mechanism. It categorizes addresses as `VALID`, `WARNING`, or `INVALID`.
- **AI Address Learning Management**: Admin interface to register error address patterns, enabling AI to analyze, learn, and apply these patterns during order validation. This includes bulk Excel upload for learning and manual registration, inferring `correctionType` and assigning confidence scores.
- **Order Workflow**: Orders transition through `주문대기` (Pending), `주문조정` (Adjustment), `상품준비중` (Product Preparation), `배송준비중` (Ready for Shipping), and `배송중` (In Shipping), with real-time updates via SSE events for both administrators and members.
- **Date Range Filtering (KST)**: All order-related pages include a `DateRangeFilter` component with preset buttons. Date filtering uses KST timezone (UTC+9) with server-side SQL filtering. Default is "today".

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
- **Anthropic Claude AI**: For detailed address normalization.