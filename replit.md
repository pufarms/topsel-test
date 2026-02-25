# Order Management System

## Overview
This project is a comprehensive Korean-language order management system for sellers and administrators, centralizing order submission and management. It features role-based authentication, distinct dashboards, intuitive order entry, detailed history tracking, and extensive user management. The system aims to enhance operational efficiency, minimize manual errors, and provide a unified data source with critical business rules for pricing, responsive design, category management, smart address validation, and an integrated outsourcing/vendor system. The goal is to establish it as a leading, reliable, feature-rich, and user-friendly solution in the Korean e-commerce market.

## User Preferences
Preferred communication style: Simple, everyday language.

### 개발 원칙 (CRITICAL - 절대 잊지 말 것!)
1. 새 기능 추가/수정 시 기존 기능 손상 금지
2. 수정 전 영향 범위 분석
3. SSE 실시간 업데이트 유지
4. API 호출 일관성 유지

### 주문 상태 워크플로우 (4단계 + 예외)
**정상 흐름 (4단계):**
1. 대기 (주문조정 단계)
2. 상품준비중 (운송장 출력 단계)
3 배송준비중 (회원취소건 접수 단계)
4. 배송중

**예외 상태:**
- 주문조정
- 취소

**핵심 규칙:**
1. 상태 유일성
2. 순차적 진행
3. API 일관성
4. 상태값: `["대기", "주문조정", "상품준비중", "배송준비중", "배송중", "취소"]`

### 핵심 비즈니스 규칙 (CRITICAL - 절대 잊지 말 것!)
**상품가격 체계 및 기준:**
1. 현재공급가가 모든 기준!
2. 상품등록/예상공급가는 준비 단계일 뿐
3. 10원 올림 시점: 전송(Transmission) 단계에서 적용
4. 주문 검증 기준: 회원 주문 업로드 시 반드시 현재공급가 테이블에서 상품 존재 여부 확인
5. 회원 등급별 공급가: 주문 시 회원의 grade에 따라 해당 공급가 적용
6. 주문 가능 등급 제한: START, DRIVING, TOP만 주문 등록 가능
7. 가격 확정 워크플로우: 미확정 주문은 실시간 가격, 확정 주문은 배송중 전환 시점 가격 고정

### 회원 등급 자동 조정 시스템
**등급 기준 (전월 매입금 기준):**
- START: 100만원 미만
- DRIVING: 100만원 이상 ~ 300만원 미만
- TOP: 300만원 이상

**조정 규칙:**
- 매월 1일 0시(KST) 자동 실행
- 전월 1일~말일 배송중 확정 주문 금액 및 회원 직접매출 합산
- 최저 등급 보호: START 밑으로는 하향 불가
- 등급 고정 회원: gradeLocked=true이면 자동 조정 제외
- 관리자 수동 실행 및 미리보기 API 제공

**등급 고정 기능:**
- DB 필드 및 API 지원
- 관리자 UI에 등급 고정 기능 제공
- 회원 목록에서 잠금 아이콘으로 표시

**예치금 충전 시 자동 승급:**
- ASSOCIATE → START 자동 승급 (뱅크다, 수동, 관리자 충전 시)
- 트랜잭션 내 원자적 처리, memberLogs에 이력 기록

### 정산 시스템 (Settlement System)
**잔액 구조:**
- 예치금(deposit), 포인터(point)
- 사용 가능 잔액 = (예치금 + 포인터) - (대기~배송준비중 주문 총액)

**잔액 검증 시점:**
1. 엑셀 일괄 업로드 시
2. 잔액 부족 시 상세 메시지 반환
3. 모든 주문은 엑셀 파일 업로드 방식으로만 진행

**후불결재 회원 시스템:**
- 후불결재 회원(isPostpaid=true)은 잔액 없이도 주문 등록 가능
- 정산 시 포인터 우선 차감, 예치금 마이너스 허용
- 관리자 설정 및 DB 필드, UI 제공
- 매출/정산 내역 필터에 회원 유형 추가

**자동 정산 (배송중 전환 시):**
- 회원별 주문 그룹핑 후 순차 정산
- 차감 순서: 포인터 우선 → 예치금
- 이력 기록: settlement_history, pointer_history, deposit_history
- 일반 회원: 잔액 부족 시 주문 실패
- 후불결재 회원: 잔액 부족 시에도 정산 진행

**관리자 기능:**
- 예치금 충전/환급, 포인터 지급
- 정산/예치금/포인터 이력 조회
- 회원별 잔액 현황

**회원 기능:**
- 내 잔액 조회
- 정산/예치금/포인터 이력 조회

**DB 테이블:**
- `settlement_history`, `deposit_history`, `pointer_history`

**프론트엔드 페이지:**
- 관리자: `/admin/settlements`
- 회원: 대시보드 예치금충전 탭

**엑셀 업로드 검증 결과 케이스:**
- 다양한 오류 및 잔액 부족 시나리오에 따른 다이얼로그 및 메시지 처리
- 서버 응답 확장 (`validation_failed`, `partial_success`, `insufficient_balance`)

**핵심 규칙:**
- 한 번에 하나의 다이얼로그만 표시
- 검증 순서: 등급→파일→중복→상품→잔액→주소→결과
- 기존 검증 알림/순서 절대 변경 금지

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, Wouter for routing.
- **State Management**: TanStack React Query for server state, React Context for authentication.
- **UI/Styling**: shadcn/ui (Radix UI, Lucide React), Tailwind CSS, Topsel Design System (v2.0.0).
- **Form Handling**: React Hook Form with Zod validation.
- **Build Tool**: Vite.

### Backend
- **Framework**: Express 5 on Node.js with TypeScript.
- **Session Management**: express-session.
- **API Design**: RESTful JSON API endpoints under `/api`.
- **Authentication**: Session-based with SHA256 password hashing and role-based access control (SUPER_ADMIN, ADMIN, seller).

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Schema**: Shared `shared/schema.ts` with Zod schemas.
- **Database Schema**: Key tables for users, orders, products, categories, members, site settings, vendors, allocations, payments, inquiries, invoices, and expenses.

### Core Features
- **User Portals**: Member Mypage, Admin dashboards, Partner Portal.
- **Product & Inventory Management**: Categories, registration, material management, product mapping, stock tracking, bulk Excel uploads.
- **Filtering**: `AdminCategoryFilter`, `MemberOrderFilter`, `DateRangeFilter` (KST timezone, server-side SQL filtering).
- **Excel Uploads**: Standard pattern for `.xlsx` and `.xls` with partial order support and error reporting.
- **CMS**: Site Settings, Header Menu, Page Management.
- **Legal**: Term Agreement Record Keeping.
- **Smart Address Validation**: Multi-step pipeline using regex, pattern similarity, rule-based validation, and AI, categorizing addresses as `VALID`, `WARNING`, or `INVALID`.
- **Order Workflow**: Orders transition through `주문대기` (Pending), `주문조정` (Adjustment), `상품준비중` (Product Preparation), `배송준비중` (Ready for Shipping), and `배송중` (In Shipping), with real-time updates via SSE.
- **Page Access Control**: Hierarchical role-based access from `PENDING` to `SUPER_ADMIN` with server-side validation.
- **Outsourcing/Vendor System**: Vendor management and product mapping, stock logic for vendor/self-fulfilled orders.
- **Allocation System**: 5-step workflow (aggregation → notification → response → confirmation → assignment) for vendor order allocation, with auto-adjustment.
- **Partner Portal**: Vendor-facing portal with JWT auth, dashboard, allocation response, order list, tracking, and settlement.
- **Vendor Payment System**: Tracks admin-entered payments and provides chronological settlement views.
- **Inquiry Board System**: Thread-based 1:1 inquiry system with dynamic fields, attachments, status flow, and category-specific features.
- **Sales Statistics Dashboard**: Comprehensive analytics (`/admin/stats`) including overview, member-specific, and product-specific sales data, charts, tables, and Excel export, based on `priceConfirmed=true` orders.
- **Invoice Management System**: Monthly invoice tracking, unified summary, manual issuance, with `isAutoIssued` for future automation.
- **Expense Management System**: Expense tracking across 8 categories, auto-classification via keyword dictionary, autocomplete, bulk spreadsheet entry, Excel import/export, recurring expense management, charts, and keyword learning.
- **AI 상세페이지 마법사**: Google Gemini API를 활용한 과일 상품 상세페이지 마케팅 카피 자동 생성 시스템. 8개 섹션 × 5가지 카피라이터 스타일로 순차 생성. 서버 프록시 방식으로 API Key 보안 유지(AES-256-GCM 암호화). 관리자(`/admin/ai-studio`)와 회원 대시보드(ai-studio 탭) 모두 접근 가능.
- **이메일 발송 시스템**: Resend API 기반. `server/utils/email.ts`에 `sendVerificationCode()`, `sendTempPassword()` 함수 구현. 탑셀러 브랜드 HTML 템플릿 적용. DB 테이블: `email_verifications`. API: `POST /api/auth/email-verify/send`, `POST /api/auth/email-verify/confirm`, `POST /api/auth/password-reset/send`. 관리자 비밀번호 초기화 시 자동 이메일 발송 연동 완료.

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
- Resend (이메일 발송)
- Juso.go.kr (행정안전부 주소 API for address verification)
- Anthropic Claude AI (address normalization)
- Solapi (SMS for vendor notification)
- Popbill (팝빌 전자세금계산서/계산서 발행 API)
- Google Gemini AI (AI 상세페이지 카피 생성)