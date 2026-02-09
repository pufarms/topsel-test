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

### 주문 등록 알림 UI 통합 설계

**잔액 배너 3단계 (주문등록 화면 상단):**
- ≥10만원: 파란 배경 (정상)
- <5만원: 주황 배경 + "잔액이 적습니다" 안내
- 0원 이하: 빨간 배경 + "예치금 충전 후 주문 가능합니다" 안내

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
- **UI/Styling**: shadcn/ui (Radix UI, Lucide React), Tailwind CSS (theming, responsive design).
- **Form Handling**: React Hook Form with Zod validation.
- **Build Tool**: Vite.
- **Design System**: Topsel Design System (v2.0.0) defines global styles, color palette, responsive breakpoints, and typography.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript.
- **Session Management**: express-session with memorystore (development).
- **API Design**: RESTful JSON API endpoints under `/api`.
- **Authentication**: Session-based with SHA256 password hashing and role-based access control (SUPER_ADMIN, ADMIN, seller).

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Shared `shared/schema.ts` with Zod schemas generated from Drizzle.
- **Database Schema**: Key tables include `users`, `orders`, `products`, `categories`, `members`, and `siteSettings`.

### Core Features
- **User Portals**: Member Mypage and Admin dashboards for product, inventory, and site management.
- **Product & Inventory Management**: Tools for categories, registration, material management, product mapping, stock tracking, and bulk Excel uploads.
- **Admin Design System**: Standardized components and design rules.
- **Filter Components**: `AdminCategoryFilter` and `MemberOrderFilter` for distinct user roles with cascading category selection.
- **Excel Upload Standard Pattern**: Supports `.xlsx` and `.xls` for data import, including partial order uploads with error reporting.
- **CMS & Configuration**: Site Settings, Header Menu Management, and Page Management with dynamic content and access control.
- **Legal Compliance**: Term Agreement Record Keeping with content snapshots and SHA-256 hashes.
- **Smart Address Validation System**: Multi-step pipeline for validating and normalizing recipient addresses using regex, pattern similarity, rule-based validation, and AI with learning mechanisms. It categorizes addresses as `VALID`, `WARNING`, or `INVALID`.
- **AI Address Learning Management**: Admin interface to register error address patterns for AI analysis and application during order validation, including bulk Excel upload and manual registration.
- **Order Workflow**: Orders transition through `주문대기` (Pending), `주문조정` (Adjustment), `상품준비중` (Product Preparation), `배송준비중` (Ready for Shipping), and `배송중` (In Shipping), with real-time updates via SSE events.
- **Date Range Filtering (KST)**: All order-related pages include a `DateRangeFilter` component with preset buttons. Date filtering uses KST timezone (UTC+9) with server-side SQL filtering.
- **Design Requirements**: All pages must be responsive, use Pretendard font, have scrollable tables with sticky headers and pagination options, and integrate category filtering.

### Page Access Control
- **Levels**: `all` < `PENDING` < `ASSOCIATE` < `START` < `DRIVING` < `TOP` < `ADMIN` < `SUPER_ADMIN`.
- **Hierarchy**: Higher ranks can access lower-rank pages.
- **Validation**: Server-side validation based on `pageAccessLevelRank`.
- **Admin Roles**: SUPER_ADMIN can set menu permissions for ADMIN.

## External Dependencies

### Database
- **PostgreSQL**

### UI/UX Libraries
- **Radix UI**
- **Lucide React**
- **embla-carousel-react**
- **vaul**
- **cmdk**
- **react-day-picker**
- **recharts**

### Session Storage
- **memorystore** (development)

### Image Storage
- **Cloudflare R2**

### Other APIs
- **Resend** (email)
- **Juso.go.kr (행정안전부 주소 API)** (address verification)
- **Anthropic Claude AI** (address normalization)

## Recent Changes

### 외주/벤더 시스템 Phase 1 (2026-02-09)
- **DB 테이블**: `vendors` (외주업체), `product_vendors` (상품-업체 매핑) 추가
- **스키마 확장**: `product_registrations`, `next_week_products`, `current_products`에 `isVendorProduct` 플래그 추가; `pending_orders`에 `vendorId`, `fulfillmentType`, `vendorPrice` 컬럼 추가
- **관리자 페이지**: `/admin/vendors` 외주업체 CRUD 관리 페이지
- **상품등록 연동**: 상품등록 페이지 하단에 외주업체 매핑 섹션 (ProductVendorSection)
- **주문 목록**: 6개 주문 페이지 모두에 발송구분(자체/외주) 컬럼 표시
- **현재공급가 필터**: 자체/외주 필터 추가
- **전송 검증 분기**: 외주상품→업체매핑 확인, 자체상품→재료매핑 확인 (4개 전송 API)
- **재고 로직**: 외주발송(fulfillmentType='vendor') 주문은 재료/상품 재고 차감 건너뜀; 자체발송 주문은 배송중 전환 시 product_stocks 차감 (트랜잭션 보장)