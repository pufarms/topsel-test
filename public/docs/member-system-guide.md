# 탑셀러 회원 시스템 전체 구조 및 기능 가이드

> 작성일: 2026-02-17  
> 대상: 탑셀러(TopSel) B2B 과일 도매 플랫폼

---

## 목차

1. [사용자 유형 및 역할 구분](#1-사용자-유형-및-역할-구분)
2. [회원(셀러) 등급 체계](#2-회원셀러-등급-체계)
3. [회원가입 및 승인 프로세스](#3-회원가입-및-승인-프로세스)
4. [로그인 및 인증 구조](#4-로그인-및-인증-구조)
5. [페이지 접근 권한 체계](#5-페이지-접근-권한-체계)
6. [회원 등급별 기능 권한](#6-회원-등급별-기능-권한)
7. [회원 등급 자동 조정 시스템](#7-회원-등급-자동-조정-시스템)
8. [등급 고정 기능](#8-등급-고정-기능)
9. [예치금 충전 시 자동 승급](#9-예치금-충전-시-자동-승급)
10. [정산 시스템과 회원](#10-정산-시스템과-회원)
11. [회원 관리 (관리자)](#11-회원-관리-관리자)
12. [회원 마이페이지 기능](#12-회원-마이페이지-기능)
13. [회원 변경 이력 관리](#13-회원-변경-이력-관리)
14. [회원 삭제 및 데이터 보존](#14-회원-삭제-및-데이터-보존)
15. [DB 테이블 구조](#15-db-테이블-구조)
16. [API 엔드포인트 목록](#16-api-엔드포인트-목록)

---

## 1. 사용자 유형 및 역할 구분

시스템에는 3가지 독립된 사용자 유형이 존재합니다.

### 1-1. 관리자 (Admin)

| 역할 | 설명 |
|------|------|
| **SUPER_ADMIN** (최고관리자) | 모든 권한 보유. 다른 관리자 등록/수정/삭제, 등급 조정 수동 실행 가능 |
| **ADMIN** (관리자) | 회원 관리, 주문 관리, 상품 관리, 정산 관리 등 일반 운영 업무 수행 |

- 저장 테이블: `users`
- 로그인 경로: `/login` (관리자 전용 로그인 구분)
- 관리자 대시보드: `/admin/*` 경로

### 1-2. 회원 (셀러/Member)

| 등급 | 한글명 | 설명 |
|------|--------|------|
| **PENDING** | 승인대기 | 회원가입 후 관리자 승인 전 상태 |
| **ASSOCIATE** | 준회원 | 관리자 승인 완료, 예치금 미충전 상태 |
| **START** | 스타트 | 예치금 충전 완료, 주문 가능 |
| **DRIVING** | 드라이빙 | 전월 매입금 100만원 이상 |
| **TOP** | 탑 | 전월 매입금 300만원 이상 |

- 저장 테이블: `members`
- 로그인 경로: `/login` (공통 로그인, 내부에서 분기)
- 회원 마이페이지: `/dashboard/*` 경로

### 1-3. 파트너 (매입업체/Vendor)

- 별도의 JWT 기반 인증 시스템 사용
- 저장 테이블: `vendors`
- 로그인 경로: `/partner/login`
- 파트너 포털: `/partner/*` 경로
- 기능: 배차 응답, 주문 조회, 송장 등록, 정산 조회

---

## 2. 회원(셀러) 등급 체계

### 등급 계층 구조

```
PENDING (승인대기)
  ↓ [관리자 승인]
ASSOCIATE (준회원)
  ↓ [예치금 최초 충전]
START (스타트)
  ↓ [전월 매입금 100만원 이상]
DRIVING (드라이빙)
  ↓ [전월 매입금 300만원 이상]
TOP (탑)
```

### 등급별 접근 권한 순위 (숫자가 높을수록 상위)

| 순위 | 대상 | 설명 |
|------|------|------|
| 0 | 비회원 (all) | 공개 페이지만 접근 |
| 1 | PENDING | 승인대기 - 로그인만 가능, 거의 모든 기능 제한 |
| 2 | ASSOCIATE | 준회원 - 상품리스트 조회/다운로드 가능 |
| 3 | START | 스타트 - 주문 등록, 정산, 통계 등 핵심 기능 이용 가능 |
| 4 | DRIVING | 드라이빙 - START와 동일 기능 + 더 유리한 공급가 |
| 5 | TOP | 탑 - 최상위 등급, 최저 공급가 적용 |
| 6 | ADMIN | 관리자 |
| 7 | SUPER_ADMIN | 최고관리자 |

### 등급별 공급가 차등 적용

주문 시 회원 등급에 따라 서로 다른 공급가가 적용됩니다.

| 등급 | 적용 공급가 필드 | 설명 |
|------|------------------|------|
| START | `startPrice` | 기본 공급가 |
| DRIVING | `drivingPrice` | START보다 낮은 공급가 |
| TOP | `topPrice` | 가장 낮은 공급가 |
| ASSOCIATE/PENDING | `startPrice` (기본값) | 실제로는 주문 불가 |

공급가 매핑 함수: `getSupplyPriceByGrade(product, grade)`

---

## 3. 회원가입 및 승인 프로세스

### 회원가입 흐름

```
1. 사용자가 /register 페이지에서 회원가입 양식 작성
   ↓
2. 필수 정보 입력:
   - 아이디 (4자 이상, 중복 불가)
   - 비밀번호 (6자 이상)
   - 상호명
   - 사업자등록번호 (000-00-00000 형식)
   - 대표자명
   - 대표연락처
   - 이메일 (선택)
   ↓
3. 사업자등록증 파일 업로드 (선택)
   ↓
4. 약관 동의 (필수/선택 약관)
   ↓
5. 회원 생성 (등급: PENDING, 상태: 활성)
   ↓
6. "회원가입 신청이 완료되었습니다. 관리자 승인 대기 중입니다." 안내
```

### 관리자 승인 프로세스

```
1. 관리자 > 회원관리 페이지에서 PENDING 회원 확인
   ↓
2. 회원 상세 정보 검토 (사업자등록증 등)
   ↓
3. "승인" 버튼 클릭
   ↓
4. 등급 변경: PENDING → ASSOCIATE (준회원)
   ↓
5. 승인 일시/승인자 기록 (approvedAt, approvedBy)
   ↓
6. 회원 변경 이력(memberLogs)에 "승인" 기록
```

### PENDING 상태 제한 사항

- 로그인 시도 시 "승인 대기 중인 계정입니다. 관리자 승인 후 이용 가능합니다." 메시지 반환
- 상품리스트 조회 불가
- 주문 등록 불가
- 마이페이지 제한적 접근

---

## 4. 로그인 및 인증 구조

### 통합 로그인 시스템

시스템은 `/api/auth/login` 단일 엔드포인트에서 3가지 사용자 유형을 순차적으로 확인합니다.

```
로그인 요청 (아이디 + 비밀번호)
  ↓
1. users 테이블 조회 (관리자 계정)
   → 일치하면 관리자로 로그인
  ↓
2. members 테이블 조회 (회원 계정)
   → 일치하면 회원으로 로그인
   → PENDING 상태면 로그인 거부 (승인 대기 안내)
  ↓
3. vendors 테이블 조회 (파트너 계정)
   → 일치하면 파트너 로그인 안내
  ↓
4. 모두 불일치 → "아이디 또는 비밀번호가 올바르지 않습니다"
```

### 세션 관리

- 방식: Express Session (서버 사이드)
- 저장소: MemoryStore
- 세션 정보: `userId`, `userType` (admin/member), `username`
- 비밀번호 해싱: SHA-256

### 인증 확인 API

- `GET /api/auth/me` - 현재 로그인 사용자 정보 반환
- 비로그인 시 401 반환

---

## 5. 페이지 접근 권한 체계

### 접근 레벨 (Access Level)

모든 페이지(CMS)에는 접근 레벨이 설정됩니다.

| 접근 레벨 | 설명 | 접근 가능 사용자 |
|-----------|------|-----------------|
| `all` | 전체 공개 | 비회원 포함 모든 사용자 |
| `PENDING` | 보류회원 이상 | PENDING 이상 모든 등급 |
| `ASSOCIATE` | 준회원 이상 | ASSOCIATE, START, DRIVING, TOP, ADMIN |
| `START` | Start회원 이상 | START, DRIVING, TOP, ADMIN |
| `DRIVING` | Driving회원 이상 | DRIVING, TOP, ADMIN |
| `TOP` | Top회원 이상 | TOP, ADMIN |
| `ADMIN` | 관리자만 | ADMIN, SUPER_ADMIN |
| `SUPER_ADMIN` | 최고관리자만 | SUPER_ADMIN |

### 접근 권한 검증 로직

```
사용자 접근 순위(userRank) >= 페이지 요구 순위(requiredRank)
→ true: 접근 허용
→ false: 403 Forbidden 반환
```

### API 레벨 접근 제어

| API 경로 | 필요 권한 | 설명 |
|----------|----------|------|
| `/api/admin/*` | ADMIN 이상 | 관리자 전용 API |
| `/api/member/*` | 회원 로그인 필수 | 회원 전용 API |
| `/api/partner/*` | 파트너 JWT 인증 | 파트너 전용 API |
| 일부 관리자 API | SUPER_ADMIN만 | 관리자 등록/삭제, 등급 수동 조정 등 |

---

## 6. 회원 등급별 기능 권한

### 기능 권한 매트릭스

| 기능 | PENDING | ASSOCIATE | START | DRIVING | TOP |
|------|---------|-----------|-------|---------|-----|
| 로그인 | 불가 | 가능 | 가능 | 가능 | 가능 |
| 마이페이지 접근 | 제한 | 가능 | 가능 | 가능 | 가능 |
| 상품리스트 조회 | 불가 | 가능 | 가능 | 가능 | 가능 |
| 현재공급가 조회 | 불가 | 가능 | 가능 | 가능 | 가능 |
| 차주예상공급가 조회 | 불가 | 가능 | 가능 | 가능 | 가능 |
| 상품리스트 다운로드 | 불가 | 가능 | 가능 | 가능 | 가능 |
| 주문 등록 (엑셀 업로드) | 불가 | 불가 | 가능 | 가능 | 가능 |
| 주문 내역 조회 | 불가 | 불가 | 가능 | 가능 | 가능 |
| 주문 취소 요청 | 불가 | 불가 | 가능 | 가능 | 가능 |
| 잔액 조회 | 불가 | 가능 | 가능 | 가능 | 가능 |
| 정산 이력 조회 | 불가 | 불가 | 가능 | 가능 | 가능 |
| 매출 통계 조회 | 불가 | 불가 | 가능 | 가능 | 가능 |
| 1:1 문의 | 불가 | 가능 | 가능 | 가능 | 가능 |
| 적용 공급가 | - | - | startPrice | drivingPrice | topPrice |

### 주문 등급 제한 상세

- **주문 가능 등급**: START, DRIVING, TOP만 주문 등록 가능
- **주문 불가 등급**: PENDING, ASSOCIATE는 주문 시도 시 403 에러
  - 에러 메시지: "주문 등록은 스타트 등급 이상 회원만 가능합니다. 등급 승인 후 이용해주세요."

---

## 7. 회원 등급 자동 조정 시스템

### 조정 기준

매월 1일 0시(KST)에 전월 매입금을 기준으로 등급을 자동 조정합니다.

**매입금 = 배송중 확정 주문의 공급가 합계 + 회원 직접매출(clientType='member') 합계**

| 전월 매입금 | 적용 등급 |
|------------|----------|
| 100만원 미만 | START |
| 100만원 이상 ~ 300만원 미만 | DRIVING |
| 300만원 이상 | TOP |

### 매입금 계산 조건

1. **배송중 확정 주문**
   - 상태: `배송중`
   - 가격 확정: `priceConfirmed = true`
   - 기간: 전월 1일 ~ 전월 말일
   - 합산 필드: `supplyPrice`

2. **회원 직접매출**
   - 테이블: `direct_sales`
   - 조건: `clientType = 'member'` (매입업체 직접매출은 제외)
   - 기간: 전월 1일 ~ 전월 말일
   - 합산 필드: `amount`

### 조정 규칙

- **최저 등급 보호**: START 밑으로 하향 불가 (매입금이 0원이어도 START 유지)
- **등급 고정 회원 제외**: `gradeLocked = true`인 회원은 자동 조정 대상에서 제외
- **대상 회원**: START, DRIVING, TOP 등급의 활성 상태 회원만 대상

### 실행 방법

| 방법 | 설명 | 권한 |
|------|------|------|
| 자동 실행 | 매월 1일 0시(KST) 스케줄러 자동 실행 | 시스템 |
| 수동 실행 | `POST /api/admin/members/grade-adjustment/run` | SUPER_ADMIN |
| 미리보기 | `GET /api/admin/members/grade-adjustment/preview` | ADMIN 이상 |

### 등급 변경 시 기록

- `memberLogs` 테이블에 자동 기록
- 기록 내용: 이전 등급, 새 등급, 변경 사유(매입금액), 변경 일시

---

## 8. 등급 고정 기능

관리자가 특정 회원의 등급을 고정하여 월별 자동 조정에서 제외할 수 있습니다.

### 설정 정보

| 필드 | 설명 |
|------|------|
| `gradeLocked` | 등급 고정 여부 (true/false) |
| `lockedGrade` | 고정할 등급 (START/DRIVING/TOP) |
| `gradeLockReason` | 고정 사유 |
| `gradeLockSetBy` | 설정한 관리자 ID |
| `gradeLockSetAt` | 설정 일시 |

### API

- `POST /api/admin/members/:memberId/grade-lock`
- 요청 본문: `{ gradeLocked, lockedGrade, gradeLockReason }`
- 권한: ADMIN 이상

### UI 표시

- 회원 목록: 등급 배지에 잠금 아이콘 표시
- 회원 상세: 등급 고정 설정 카드 (스위치, 등급 선택, 사유 입력)

---

## 9. 예치금 충전 시 자동 승급

### ASSOCIATE → START 자동 승급

준회원(ASSOCIATE)이 예치금을 처음 충전하면 자동으로 START 등급으로 승급합니다.

### 승급 경로 (3가지)

| 경로 | 설명 | API |
|------|------|-----|
| 뱅크다 자동매칭 | 은행 거래 자동 감지 → 예치금 충전 → 자동 승급 | 뱅크다 동기화 |
| 뱅크다 수동매칭 | 관리자가 미매칭 거래를 수동으로 회원에 매칭 → 자동 승급 | `/api/admin/bankda/match` |
| 관리자 직접충전 | 관리자가 회원에게 직접 예치금 충전 → 자동 승급 | `/api/admin/members/:id/deposit/charge` |

### 승급 처리 로직

```
예치금 충전 시점에:
1. 현재 등급이 ASSOCIATE인지 확인
2. ASSOCIATE이면 → START로 등급 변경
3. memberLogs에 "등급자동변경" 이력 기록
4. 모두 트랜잭션 내에서 원자적 처리
```

---

## 10. 정산 시스템과 회원

### 잔액 구조

각 회원은 2가지 잔액을 보유합니다.

| 잔액 유형 | 설명 | 변동 경로 |
|-----------|------|----------|
| **예치금(deposit)** | 계좌이체 후 충전되는 실제 금액 | 충전(+), 주문 정산 차감(-), 환급(-) |
| **포인터(point)** | 관리자가 지급하는 보너스 금액 | 지급(+), 주문 정산 차감(-) |

### 사용 가능 잔액 계산

```
사용 가능 잔액 = (예치금 + 포인터) - (대기~배송준비중 상태 주문의 총 주문금액)
```

### 주문 정산 흐름

```
주문을 "배송중"으로 전환할 때:
1. 회원별로 주문 그룹핑
2. 차감 순서: 포인터 우선 차감 → 예치금 차감
3. 이력 기록: settlement_history, pointer_history, deposit_history
4. 잔액 부족 시 해당 주문부터 실패 처리
5. 가격 확정: priceConfirmed = true 설정
```

### 엑셀 업로드 시 잔액 검증

주문 엑셀 업로드 시 사용 가능 잔액과 주문 총액을 비교합니다.

| 케이스 | 상황 | 처리 |
|--------|------|------|
| A | 상품 오류만, 잔액 OK | 오류 목록 + 잔액 확인 블록(초록) |
| B | 잔액 부족만 | 잔액 부족 전용 다이얼로그 |
| C | 오류 + 잔액 부족 | 복합 다이얼로그, "정상건만 등록" 불가 |
| D | 오류 있지만 정상건 잔액 OK | 오류 목록 + "정상건만 등록" 가능 |

---

## 11. 회원 관리 (관리자)

### 회원 목록 페이지 (`/admin/members`)

- 전체 회원 목록 조회 (테이블/카드 뷰 전환)
- 검색: 상호명, 아이디, 회원명 검색
- 필터: 등급별, 상태별 필터링
- 정렬: 등록일, 상호명 등
- 일괄 작업: 등급 변경, 예치금 조정
- 등급 고정 회원: 잠금 아이콘으로 시각적 구분

### 회원 상세 페이지 (`/admin/members/:id`)

- **기본 정보**: 상호명, 사업자번호, 대표자, 연락처, 이메일
- **담당자 정보**: 담당자 1/2/3 이름, 연락처
- **등급 관리**: 현재 등급 표시, 등급 변경
- **등급 고정 설정**: 스위치, 고정 등급 선택, 사유 입력
- **잔액 현황**: 예치금, 포인터 잔액 표시
- **사업자등록증**: 파일 조회/업로드
- **메모**: 관리자 메모
- **변경 이력**: memberLogs 기반 변경 내역

### 관리자용 회원 관련 API

| API | 메서드 | 설명 | 권한 |
|-----|--------|------|------|
| `/api/admin/members` | GET | 회원 목록 조회 | ADMIN |
| `/api/admin/members/:id` | GET | 회원 상세 조회 | ADMIN |
| `/api/admin/members/:id` | PATCH | 회원 정보 수정 | ADMIN |
| `/api/admin/members/:id` | DELETE | 회원 삭제 | ADMIN |
| `/api/admin/members/:id/approve` | POST | 회원 승인 (PENDING→ASSOCIATE) | ADMIN |
| `/api/admin/members/:id/deposit/charge` | POST | 예치금 충전 | ADMIN |
| `/api/admin/members/:id/deposit/refund` | POST | 예치금 환급 | ADMIN |
| `/api/admin/members/:id/pointer/grant` | POST | 포인터 지급 | ADMIN |
| `/api/admin/members/:id/grade-lock` | POST | 등급 고정 설정/해제 | ADMIN |
| `/api/admin/members/grade-adjustment/preview` | GET | 등급 조정 미리보기 | ADMIN |
| `/api/admin/members/grade-adjustment/run` | POST | 등급 조정 수동 실행 | SUPER_ADMIN |
| `/api/admin/members-balance` | GET | 회원별 잔액 현황 | ADMIN |
| `/api/admin/members/bulk-update` | POST | 일괄 등급/예치금 변경 | ADMIN |

---

## 12. 회원 마이페이지 기능

### 회원 대시보드 (`/dashboard`)

회원이 로그인 후 이용하는 전용 영역입니다.

| 기능 | 설명 | API |
|------|------|-----|
| 프로필 조회/수정 | 내 정보 조회 및 수정 | `GET/PATCH /api/member/profile` |
| 잔액 현황 | 예치금, 포인터, 사용 가능 잔액 | `GET /api/member/my-balance` |
| 주문 등록 | 엑셀 파일로 주문 일괄 업로드 | `POST /api/member/pending-orders/excel-upload` |
| 주문 내역 | 내 주문 목록 조회 | `GET /api/member/pending-orders` |
| 주문 취소 | 배송준비중 단계까지 취소 요청 가능 | `POST /api/member/cancel-orders` |
| 상품 검색 | 현재공급가 기준 상품 검색 | `GET /api/member/products/search` |
| 현재 상품리스트 | 현재공급가 상품 목록 | `GET /api/member/product-list/current` |
| 차주 상품리스트 | 차주 예상공급가 상품 목록 | `GET /api/member/product-list/next-week` |
| 정산 이력 | 주문 정산 내역 | `GET /api/member/my-settlements` |
| 예치금 이력 | 예치금 충전/차감 내역 | `GET /api/member/my-deposit-history` |
| 포인터 이력 | 포인터 지급/차감 내역 | `GET /api/member/my-pointer-history` |
| 통합 정산 뷰 | 정산/예치금/포인터 통합 시간순 | `GET /api/member/my-settlement-view` |
| 매출 통계 | 개요, 상품별, 주문별 통계 | `GET /api/member/statistics/*` |
| 매입 현황 | 월별 매입 금액 현황 | `GET /api/member/purchase-stats` |
| 1:1 문의 | 문의 등록, 조회, 답변 확인 | `/api/member/inquiries/*` |
| 취소 마감 확인 | 취소 가능 기한 상태 | `GET /api/member/cancel-deadline-status` |

---

## 13. 회원 변경 이력 관리

### memberLogs 테이블

회원의 모든 주요 변경 사항이 기록됩니다.

| 필드 | 설명 |
|------|------|
| `memberId` | 대상 회원 ID |
| `changedBy` | 변경 실행자 (관리자 ID) |
| `changeType` | 변경 유형 |
| `previousValue` | 변경 전 값 |
| `newValue` | 변경 후 값 |
| `description` | 변경 상세 설명 |
| `createdAt` | 변경 일시 |

### 기록되는 변경 유형

| 변경 유형 | 발생 시점 |
|-----------|----------|
| 승인 | 관리자가 PENDING 회원 승인 시 |
| 등급변경 | 관리자가 수동으로 등급 변경 시 |
| 등급자동변경 | 예치금 충전으로 ASSOCIATE→START 자동 승급 시 |
| 월별등급조정 | 매월 1일 자동 등급 조정 시 (승급/하향) |
| 등급고정설정 | 관리자가 등급 고정 활성화 시 |
| 등급고정해제 | 관리자가 등급 고정 비활성화 시 |
| 정보수정 | 관리자가 회원 정보 수정 시 |
| 예치금충전 | 예치금 충전 시 |
| 예치금환급 | 예치금 환급 시 |
| 포인터지급 | 포인터 지급 시 |

---

## 14. 회원 삭제 및 데이터 보존

### 삭제 프로세스

회원 삭제 시 데이터 보존을 위해 아카이브 처리됩니다.

```
1. 회원 정보 → deleted_members 테이블에 복사
2. 회원의 주문 정보 → deleted_member_orders 테이블에 복사
3. 관련 주문의 memberId 연결 해제
4. 원본 members 레코드 삭제
```

### 관련 테이블

| 테이블 | 설명 |
|--------|------|
| `deleted_members` | 삭제된 회원 정보 아카이브 |
| `deleted_member_orders` | 삭제된 회원의 주문 아카이브 |

---

## 15. DB 테이블 구조

### members 테이블 (주요 컬럼)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | varchar (UUID) | 기본키 |
| `username` | text | 아이디 (고유) |
| `password` | text | 비밀번호 (SHA-256 해시) |
| `grade` | text | 등급 (PENDING/ASSOCIATE/START/DRIVING/TOP) |
| `memberName` | text | 회원명 |
| `companyName` | text | 상호명 |
| `businessNumber` | text | 사업자등록번호 |
| `businessAddress` | text | 사업장 주소 |
| `representative` | text | 대표자명 |
| `phone` | text | 대표연락처 |
| `managerName` | text | 담당자1 이름 |
| `managerPhone` | text | 담당자1 연락처 |
| `manager2Name` | text | 담당자2 이름 |
| `manager2Phone` | text | 담당자2 연락처 |
| `manager3Name` | text | 담당자3 이름 |
| `manager3Phone` | text | 담당자3 연락처 |
| `email` | text | 이메일 |
| `deposit` | integer | 예치금 잔액 |
| `point` | integer | 포인터 잔액 |
| `status` | text | 상태 (활성/비활성) |
| `memo` | text | 관리자 메모 |
| `businessLicenseUrl` | text | 사업자등록증 URL |
| `profileImageUrl` | text | 프로필 이미지 URL |
| `signatureData` | text | 서명 데이터 |
| `gradeLocked` | boolean | 등급 고정 여부 |
| `lockedGrade` | text | 고정 등급 |
| `gradeLockReason` | text | 고정 사유 |
| `gradeLockSetBy` | varchar | 고정 설정 관리자 ID |
| `gradeLockSetAt` | timestamp | 고정 설정 일시 |
| `approvedAt` | timestamp | 승인 일시 |
| `approvedBy` | varchar | 승인 관리자 ID |
| `lastLoginAt` | timestamp | 최근 로그인 일시 |
| `createdAt` | timestamp | 가입일 |
| `updatedAt` | timestamp | 수정일 |

### 관련 테이블 요약

| 테이블 | 설명 |
|--------|------|
| `member_logs` | 회원 변경 이력 |
| `settlement_history` | 주문 정산 이력 |
| `deposit_history` | 예치금 변동 이력 |
| `pointer_history` | 포인터 변동 이력 |
| `pending_orders` | 주문 데이터 (회원별) |
| `order_upload_history` | 주문 업로드 이력 |
| `deleted_members` | 삭제된 회원 아카이브 |
| `deleted_member_orders` | 삭제된 회원 주문 아카이브 |
| `direct_sales` | 직접매출 (회원/매입업체) |
| `bankda_transactions` | 뱅크다 거래 (예치금 매칭) |

---

## 16. API 엔드포인트 목록

### 인증 관련

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 통합 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 정보 |
| POST | `/api/register` | 간편 회원가입 |
| POST | `/api/auth/member-register` | 회원가입 (파일 업로드 포함) |

### 회원 전용 (로그인 필수)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/member/profile` | 내 프로필 조회 |
| PATCH | `/api/member/profile` | 내 프로필 수정 |
| GET | `/api/member/my-balance` | 내 잔액 조회 |
| GET | `/api/member/my-settlements` | 정산 이력 |
| GET | `/api/member/my-deposit-history` | 예치금 이력 |
| GET | `/api/member/my-pointer-history` | 포인터 이력 |
| GET | `/api/member/my-settlement-view` | 통합 정산 뷰 |
| GET | `/api/member/pending-orders` | 내 주문 목록 |
| POST | `/api/member/pending-orders/excel-upload` | 주문 엑셀 업로드 |
| POST | `/api/member/cancel-orders` | 주문 취소 요청 |
| GET | `/api/member/cancel-deadline-status` | 취소 마감 상태 |
| GET | `/api/member/products/search` | 상품 검색 |
| GET | `/api/member/product-list/current` | 현재공급가 상품 |
| GET | `/api/member/product-list/next-week` | 차주예상공급가 상품 |
| GET | `/api/member/purchase-stats` | 매입 현황 |
| GET | `/api/member/statistics/overview` | 매출 통계 개요 |
| GET | `/api/member/statistics/by-product` | 상품별 매출 통계 |
| GET | `/api/member/statistics/orders` | 주문별 매출 통계 |
| GET | `/api/member/inquiries` | 내 문의 목록 |
| POST | `/api/member/inquiries` | 문의 등록 |
| GET | `/api/member/inquiries/:id` | 문의 상세 |
| POST | `/api/member/inquiries/:id/messages` | 문의 답변/추가 |

### 관리자 회원 관리

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/admin/members` | 회원 목록 | ADMIN |
| GET | `/api/admin/members/:id` | 회원 상세 | ADMIN |
| PATCH | `/api/admin/members/:id` | 회원 수정 | ADMIN |
| DELETE | `/api/admin/members/:id` | 회원 삭제 | ADMIN |
| POST | `/api/admin/members/:id/approve` | 회원 승인 | ADMIN |
| POST | `/api/admin/members/:id/deposit/charge` | 예치금 충전 | ADMIN |
| POST | `/api/admin/members/:id/deposit/refund` | 예치금 환급 | ADMIN |
| POST | `/api/admin/members/:id/pointer/grant` | 포인터 지급 | ADMIN |
| POST | `/api/admin/members/:id/grade-lock` | 등급 고정 | ADMIN |
| POST | `/api/admin/members/bulk-update` | 일괄 변경 | ADMIN |
| GET | `/api/admin/members-balance` | 잔액 현황 | ADMIN |
| GET | `/api/admin/members/grade-adjustment/preview` | 등급 조정 미리보기 | ADMIN |
| POST | `/api/admin/members/grade-adjustment/run` | 등급 조정 실행 | SUPER_ADMIN |

---

> **문서 끝**  
> 이 문서는 탑셀러 시스템의 회원 관련 전체 구조를 설명합니다.  
> 시스템 변경 시 이 문서도 함께 업데이트해야 합니다.
