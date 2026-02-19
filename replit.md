# Order Management System

## Overview
This project is a Korean-language order management system designed to streamline operations for sellers and administrators. Its primary purpose is to allow sellers to efficiently submit orders and provide administrators with comprehensive tools for managing all orders and users. Key capabilities include robust role-based authentication, separate dashboards for sellers and administrators, intuitive order entry forms, detailed order history tracking, and extensive user management functionalities. The system aims to enhance efficiency, reduce manual errors, and provide a centralized platform for order and user data. It features critical business rules for pricing, a responsive design, integrated category management, smart address validation, and an outsourcing/vendor system for order fulfillment. The project's vision is to become the leading order management solution in the Korean market, known for its reliability, comprehensive features, and user-friendly experience, ultimately driving significant efficiency gains for e-commerce businesses.

## User Preferences
Preferred communication style: Simple, everyday language.

### 개발 원칙 (CRITICAL - 절대 잊지 말 것!)
1. **새 기능 추가/수정 시 기존 기능 손상 금지**: 다른 기능을 추가하거나 수정할 때 이미 작동하던 기능이 깨지지 않도록 반드시 확인
2. **수정 전 영향 범위 분석**: 코드 수정 전에 해당 코드가 어디서 사용되는지 확인하고, 관련된 모든 부분이 계속 작동하는지 검증
3. **SSE 실시간 업데이트 유지**: 주문 관련 기능 수정 시 SSE 이벤트 발송 및 쿼리 무효화 로직이 유지되는지 확인
4. **API 호출 일관성 유지**: pending_orders 관련 페이지는 모두 `/api/admin/pending-orders` 또는 `/api/member/pending-orders` 사용

### 주문 상태 워크플로우 (4단계 + 예외)
**정상 흐름 (4단계):**
1. 대기 (주문조정 단계) → pending.tsx
2. 상품준비중 (운송장 출력 단계) → preparing.tsx
3 배송준비중 (회원취소건 접수 단계) → ready-to-ship.tsx
4. 배송중 → shipping.tsx

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

### 회원 등급 자동 조정 시스템
**등급 기준 (전월 매입금 = 배송중 확정 주문의 공급가 합계 + 회원 직접매출 합계 기준, 예치금/포인터와 무관):**
- START: 100만원 미만
- DRIVING: 100만원 이상 ~ 300만원 미만
- TOP: 300만원 이상

**조정 규칙:**
- 매월 1일 0시(KST) 자동 실행 (서버 시작 시 스케줄러 등록)
- 전월 1일~말일 배송중 확정 주문 금액 합산 (priceConfirmed=true, 상태='배송중')
- 전월 1일~말일 회원 직접매출(clientType='member') 금액도 매입금에 합산 (매입업체 직접매출은 제외)
- 최저 등급 보호: START 밑으로는 하향 불가
- 등급 고정 회원: gradeLocked=true이면 자동 조정 제외
- 관리자 수동 실행 가능: `/api/admin/members/grade-adjustment/run` (SUPER_ADMIN)
- 미리보기 API: `/api/admin/members/grade-adjustment/preview`

**등급 고정 기능:**
- members 테이블: gradeLocked, lockedGrade, gradeLockReason, gradeLockSetBy, gradeLockSetAt
- API: `/api/admin/members/:memberId/grade-lock` (POST)
- 관리자 회원 상세 페이지에 등급 고정 UI 제공
- 회원 목록에서 잠금 아이콘으로 표시

**예치금 충전 시 자동 승급:**
- ASSOCIATE → START 자동 승급 (3개 경로: 뱅크다 자동매칭, 수동매칭, 관리자 직접충전)
- 트랜잭션 내 원자적 처리, memberLogs에 이력 기록

### 정산 시스템 (Settlement System)
**잔액 구조:**
- 예치금(deposit): 계좌이체 후 관리자가 충전, 주문 정산 시 차감
- 포인터(point): 관리자가 지급, 주문 정산 시 우선 차감
- 사용 가능 잔액 = (예치금 + 포인터) - (대기~배송준비중 주문 총액)

**잔액 검증 시점:**
1. 엑셀 일괄 업로드 시: 정상건 총 주문금액 vs 사용가능잔액
2. 잔액 부족 시 상세 메시지 반환 (부족금액, 예치금, 포인터, 진행중 주문액)
3. 모든 주문은 엑셀 파일 업로드 방식으로만 진행 (개별 주문 등록 없음)

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

**엑셀 업로드 검증 결과 케이스:**
- A: 상품 오류만, 잔액 OK → 기존 다이얼로그 + 잔액 확인 블록(초록)
- B: 잔액 부족만 → 잔액 부족 전용 다이얼로그 (max-w-500px)
- C: 오류 + 잔액 부족 → 복합 다이얼로그 (오류목록 + 잔액부족 두 영역, max-w-560px), "정상건만 등록" 버튼 없음
- D: 오류 있지만 정상건 잔액 OK → 기존 + 잔액 확인 블록(초록) + "정상건만 등록" 버튼 유지
- G: 부분 성공 → 토스트에 정산 정보 한 줄 추가

**서버 응답 확장:**
- `validation_failed`: balanceInfo, totalOrderAmount, balanceSufficient 필드 추가
- `partial_success`: settlementInfo(orderAmount, remainingBalance) 필드 추가
- `insufficient_balance`: errors 배열 포함 (오류건 있을 때)

**핵심 규칙:**
- 한 번에 하나의 다이얼로그만 표시
- 검증 순서: 등급→파일→중복→상품→잔액→주소→결과
- 기존 검증 알림/순서 절대 변경 금지

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Wouter for routing.
- **State Management**: TanStack React Query for server state, React Context for authentication.
- **UI/Styling**: shadcn/ui (Radix UI, Lucide React), Tailwind CSS.
- **Form Handling**: React Hook Form with Zod validation.
- **Build Tool**: Vite.
- **Design System**: Topsel Design System (v2.0.0) defines global styles, color palette, responsive breakpoints, and typography. All pages must be responsive, use Pretendard font, have scrollable tables with sticky headers and pagination options, and integrate category filtering.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript.
- **Session Management**: express-session.
- **API Design**: RESTful JSON API endpoints under `/api`.
- **Authentication**: Session-based with SHA256 password hashing and role-based access control (SUPER_ADMIN, ADMIN, seller).

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Shared `shared/schema.ts` with Zod schemas generated from Drizzle.
- **Database Schema**: Key tables include `users`, `orders`, `products`, `categories`, `members`, `siteSettings`, `vendors`, `product_vendors`, `order_allocations`, `allocation_details`, `vendor_payments`, `inquiries`, `inquiry_messages`, `inquiry_fields`, `inquiry_attachments`, `invoice_records`.

### Core Features
- **User Portals**: Member Mypage, Admin dashboards, and Partner Portal.
- **Product & Inventory Management**: Tools for categories, registration, material management, product mapping, stock tracking, and bulk Excel uploads.
- **Admin Design System**: Standardized components and design rules.
- **Filter Components**: `AdminCategoryFilter`, `MemberOrderFilter`, `DateRangeFilter` (KST timezone, server-side SQL filtering).
- **Excel Upload Standard Pattern**: Supports `.xlsx` and `.xls` for data import, including partial order uploads with error reporting.
- **CMS & Configuration**: Site Settings, Header Menu Management, and Page Management.
- **Legal Compliance**: Term Agreement Record Keeping.
- **Smart Address Validation System**: Multi-step pipeline for validating and normalizing recipient addresses using regex, pattern similarity, rule-based validation, and AI with learning mechanisms. Categorizes addresses as `VALID`, `WARNING`, or `INVALID` and includes AI Address Learning Management.
- **Order Workflow**: Orders transition through `주문대기` (Pending), `주문조정` (Adjustment), `상품준비중` (Product Preparation), `배송준비중` (Ready for Shipping), and `배송중` (In Shipping), with real-time updates via SSE events.
- **Page Access Control**: Levels from `PENDING` to `SUPER_ADMIN` with hierarchical access and server-side validation.
- **Outsourcing/Vendor System**: Manages vendors and product mapping, with stock logic differentiating between vendor and self-fulfilled orders.
- **Allocation System**: 5-step workflow (aggregation → notification → response → confirmation → assignment) for allocating orders to vendors, with auto-adjustment for insufficient supply.
- **Partner Portal (/partner)**: Vendor-facing portal with separate JWT authentication, offering dashboard, allocation response, order list, tracking registration (individual + bulk Excel), and settlement view.
- **Vendor Payment System**: Tracks admin-entered payments per vendor and provides a chronological settlement view merging order and payment rows.
- **Inquiry Board System (문의 게시판)**: Thread-based 1:1 inquiry system with dynamic fields, attachments, status flow, and category-specific features for both admin and members, integrated with dashboards for notifications.
- **Sales Statistics Dashboard** (`/admin/stats`): Comprehensive analytics with overview, member-specific, and product-specific sales data, including charts, tables, and Excel export, all sourced from `priceConfirmed=true` orders.
- **Invoice Management System (계산서/세금계산서 관리)**: Monthly invoice tracking with `invoice_records` table, unified summary view, manual invoice issuance, and `isAutoIssued` flag for future automation.

## External Dependencies

### Database
- PostgreSQL

### UI/UX Libraries
- Radix UI
- Lucide React
- embla-carousel-react
- vaul
- cmdk
- react-day-picker
- recharts

### Session Storage
- memorystore

### Image Storage
- Cloudflare R2

### Other APIs
- Resend (email)
- Juso.go.kr (행정안전부 주소 API) (address verification)
- Anthropic Claude AI (address normalization)
- Solapi (SMS for vendor notification)