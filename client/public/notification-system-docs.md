# 알림 시스템 종합 문서

> 작성일: 2026-02-19  
> 시스템: 탑셀러 주문관리 시스템  
> 연동 서비스: Solapi (솔라피)

---

## 목차

1. [시스템 개요](#1-시스템-개요)
2. [환경 설정](#2-환경-설정)
3. [Solapi SDK 연동 구조](#3-solapi-sdk-연동-구조)
4. [알림톡 (Alimtalk) 시스템](#4-알림톡-alimtalk-시스템)
5. [브랜드톡 (Brandtalk/친구톡) 시스템](#5-브랜드톡-brandtalk친구톡-시스템)
6. [SMS 발송 시스템](#6-sms-발송-시스템)
7. [데이터베이스 스키마](#7-데이터베이스-스키마)
8. [API 엔드포인트 목록](#8-api-엔드포인트-목록)
9. [프론트엔드 페이지](#9-프론트엔드-페이지)
10. [등록된 템플릿 목록](#10-등록된-템플릿-목록)
11. [자동 발송 시나리오](#11-자동-발송-시나리오)
12. [수동 발송 시나리오](#12-수동-발송-시나리오)
13. [매입업체 배분 알림 (SMS)](#13-매입업체-배분-알림-sms)
14. [발송 이력 및 통계](#14-발송-이력-및-통계)
15. [비용 구조](#15-비용-구조)
16. [핵심 파일 구조](#16-핵심-파일-구조)
17. [주의사항 및 트러블슈팅](#17-주의사항-및-트러블슈팅)

---

## 1. 시스템 개요

탑셀러 주문관리 시스템은 **Solapi(솔라피) API**를 연동하여 3가지 채널의 알림 발송을 지원합니다:

| 채널 | 용도 | 특징 |
|------|------|------|
| **알림톡 (Alimtalk)** | 회원 대상 카카오톡 알림 | 템플릿 기반, 사전 승인 필요 |
| **브랜드톡 (Brandtalk/친구톡)** | 회원 대상 마케팅/정보 메시지 | 자유 메시지, 카카오 채널 친구 대상 |
| **SMS** | 매입업체 대상 문자 발송 | 배분 요청 알림 용도 |

### 인증 방식
- **Solapi SDK**: 공식 `solapi` npm 패키지 사용 (알림톡, SMS)
- **REST API 직접 호출**: HMAC-SHA256 인증 (템플릿 조회, 브랜드톡)

---

## 2. 환경 설정

### 필수 환경변수 (Secrets)

| 변수명 | 설명 | 상태 |
|--------|------|------|
| `SOLAPI_API_KEY` | Solapi API 키 | 설정됨 |
| `SOLAPI_API_SECRET` | Solapi API 시크릿 | 설정됨 |
| `SOLAPI_SENDER` | 발신번호 (예: 1588-xxxx 또는 010-xxxx-xxxx) | 설정됨 |
| `KAKAO_PFID` | 카카오 비즈니스 채널 프로필 ID | 설정됨 |

### 환경변수 사용처
```
SOLAPI_API_KEY    → SDK 초기화, HMAC 인증 헤더 생성
SOLAPI_API_SECRET → SDK 초기화, HMAC 서명 생성
SOLAPI_SENDER     → 알림톡/SMS 발신번호 (from 필드)
KAKAO_PFID        → 알림톡/브랜드톡 카카오 채널 식별 (pfId 필드)
```

---

## 3. Solapi SDK 연동 구조

### 파일 위치
`server/services/solapi.ts`

### 클래스 구조: `SolapiService`

```
SolapiService (싱글턴 export: solapiService)
├── constructor()           → SDK 초기화, 환경변수 로드
├── generateAuthHeader()    → HMAC-SHA256 인증 헤더 생성 (REST API용)
├── sendAlimTalk()          → 알림톡 단건 발송
├── sendAlimtalkBulk()      → 알림톡 대량 발송
├── sendBrandtalk()         → 브랜드톡 발송 (SDK)
├── sendBrandTalkDirect()   → 브랜드톡 직접 발송 (REST API)
├── sendSMS()               → SMS 단건 발송
├── getTemplateDetail()     → 솔라피 알림톡 템플릿 상세 조회
├── getBrandTemplates()     → 브랜드 템플릿 목록 조회
└── getBrandTemplateDetail()→ 브랜드 템플릿 상세 조회
```

### SDK 초기화 로직
```typescript
// 서버 시작 시 자동 초기화
if (SOLAPI_API_KEY && SOLAPI_API_SECRET) {
  this.messageService = new SolapiMessageService(apiKey, apiSecret);
  // "✅ Solapi SDK 초기화 완료" 로그 출력
} else {
  // "⚠️ Solapi API 키가 설정되지 않았습니다" 경고 출력
}
```

### 인증 방식 상세

**SDK 방식** (알림톡, SMS):
- `SolapiMessageService.send()` 메서드가 인증 자동 처리

**HMAC-SHA256 방식** (REST API 직접 호출):
```
1. date = ISO 8601 형식 현재 시간
2. salt = 32바이트(또는 16바이트) 랜덤 hex
3. hmacData = date + salt (연결)
4. signature = HMAC-SHA256(apiSecret, hmacData) → hex
5. Authorization: "HMAC-SHA256 apiKey={key}, date={date}, salt={salt}, signature={sig}"
```

---

## 4. 알림톡 (Alimtalk) 시스템

### 개념
- 카카오톡 알림톡은 **사전 등록/승인된 템플릿** 기반으로만 발송 가능
- 각 템플릿에는 **솔라피 템플릿 ID** (예: `KA01TP...`)가 할당됨
- 변수 치환을 통해 동적 내용 삽입 가능 (예: `#{이름}`, `#{주문번호}`)

### 발송 흐름

#### 알림톡 단건 발송
```
sendAlimTalk(templateId, receiverPhone, variables)
  → sendAlimtalkBulk([{ to, templateId, variables }])
    → messageService.send([{ to, from, kakaoOptions }])
```

#### 알림톡 대량 발송
```
sendAlimtalkBulk(params[])
  1. 환경변수 검증 (API키, PFID, 발신번호)
  2. 메시지 배열 구성:
     - to: 수신번호 (하이픈 제거)
     - from: 발신번호 (하이픈 제거)
     - kakaoOptions: { pfId, templateId, variables }
  3. SDK send() 호출
  4. 결과 분석:
     - registeredSuccess = 큐 등록 성공 (발송 예정)
     - registeredFailed = 등록 실패
     - sentSuccess = 실제 발송 완료 (비동기)
  5. SendResult 반환: { successCount, failCount, data }
```

### 수신자 선택 로직
- **전체 활성 회원**: `status === '활성'`인 모든 회원
- **등급별 필터링**: `targetType === 'grade'` + `selectedGrades[]` 조합
- **연락처 수집**: 대표번호 + 담당자1~3 전화번호 모두 수집
- **중복 제거**: `Set`으로 전화번호 중복 자동 제거

### 모드 구분

| 모드 | 필드 | 설명 |
|------|------|------|
| 자동 (Auto) | `isAuto: true` | 시스템 이벤트 발생 시 자동 발송 |
| 수동 (Manual) | `isAuto: false` | 관리자가 직접 수신자 선택 후 발송 |

### ON/OFF 토글
- `isActive: true/false`로 템플릿 활성/비활성 전환
- 비활성 템플릿은 자동/수동 모두 발송 불가

---

## 5. 브랜드톡 (Brandtalk/친구톡) 시스템

### 개념
- 카카오 비즈니스 채널 친구에게 보내는 자유 형식 메시지
- 알림톡과 달리 **템플릿 사전 승인 불필요**
- 정보성(I), 마케팅(M), 무분류(N) 유형으로 구분

### 발송 방식

**SDK 방식** (`sendBrandtalk`):
```
메시지 구조:
{
  to: 수신번호,
  from: 발신번호,
  kakaoOptions: {
    pfId: 카카오 채널 ID,
    bms: {
      targeting: 'I',           // 정보성
      chatBubbleType: 'TEXT',   // 텍스트형
      content: 메시지 내용,
      buttons: [{ linkType: 'WL', name, linkMobile, linkPc }]
    }
  }
}
```

**REST API 방식** (`sendBrandTalkDirect`):
- `POST https://api.solapi.com/messages/v4/send-many`
- HMAC-SHA256 인증 헤더 사용
- 템플릿 없이 직접 메시지 구성

### 브랜드톡 템플릿 관리
- DB에 자체 템플릿 저장 (제목, 메시지, 버튼)
- 솔라피 브랜드 템플릿 API로 목록/상세 조회 가능

### 프론트엔드 페이지
- 경로: `/admin/kakao-notifications/brandtalk`
- 메뉴명: "친구톡 관리"
- 현재 기본 구조만 구현 (60줄)

---

## 6. SMS 발송 시스템

### 용도
- **매입업체(Vendor) 배분 알림** 전용
- 카카오톡 기반이 아닌 일반 문자 메시지

### 발송 메서드
```typescript
sendSMS(to: string, text: string): Promise<SendResult>
```

### SDK 사용
```typescript
messageService.send([{ to, from: sender, text }])
```

### 호출 시점
- 관리자가 배분(Allocation) 요청 시 매입업체에 자동 발송
- 추가 배분 요청 시에도 발송

### 메시지 형식 예시
```
[탑셀러] 배분 요청
상품: {상품명}
요청수량: {수량}박스
매입가: {가격}원
마감시간: {시간}
대시보드에서 가능수량을 입력해 주세요.
```

---

## 7. 데이터베이스 스키마

### alimtalk_templates (알림톡 템플릿)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial (PK) | 자동 증가 ID |
| template_code | text (UNIQUE) | 시스템 내부 코드 (예: SHIPPING, WELCOME) |
| template_id | text (UNIQUE) | 솔라피 템플릿 ID (예: KA01TP...) |
| template_name | text | 템플릿 표시명 |
| description | text | 설명 |
| is_auto | boolean | 자동 발송 여부 (default: false) |
| is_active | boolean | 활성 여부 (default: true) |
| total_sent | integer | 누적 발송 수 (default: 0) |
| total_cost | integer | 누적 비용 (default: 0) |
| created_at | timestamp | 생성일시 |
| updated_at | timestamp | 수정일시 |

### alimtalk_history (알림톡 발송 이력)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial (PK) | 자동 증가 ID |
| template_id | integer (FK) | 알림톡 템플릿 ID |
| recipient_count | integer | 수신자 수 |
| success_count | integer | 성공 건수 |
| fail_count | integer | 실패 건수 |
| cost | integer | 비용 (원) |
| sent_by | varchar (FK) | 발송자 (users.id) |
| sent_at | timestamp | 발송일시 |
| response_data | jsonb | 솔라피 API 응답 데이터 |

### brandtalk_templates (브랜드톡 템플릿)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial (PK) | 자동 증가 ID |
| title | text | 제목 |
| message | text | 메시지 내용 |
| button_name | text | 버튼명 |
| button_url | text | 버튼 URL |
| total_sent | integer | 누적 발송 수 |
| last_sent_at | timestamp | 마지막 발송일시 |
| created_by | varchar (FK) | 생성자 (users.id) |
| created_at | timestamp | 생성일시 |
| updated_at | timestamp | 수정일시 |

### brandtalk_history (브랜드톡 발송 이력)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial (PK) | 자동 증가 ID |
| template_id | integer (FK) | 브랜드톡 템플릿 ID |
| title | text | 제목 |
| message | text | 메시지 내용 |
| recipient_count | integer | 수신자 수 |
| success_count | integer | 성공 건수 |
| fail_count | integer | 실패 건수 |
| cost | integer | 비용 (원) |
| sent_by | varchar (FK) | 발송자 (users.id) |
| sent_at | timestamp | 발송일시 |
| response_data | jsonb | 솔라피 API 응답 데이터 |

---

## 8. API 엔드포인트 목록

### 알림톡 관리 API (관리자 전용)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/admin/alimtalk/templates` | 템플릿 목록 조회 |
| POST | `/api/admin/alimtalk/templates` | 템플릿 신규 등록 |
| GET | `/api/admin/alimtalk/templates/:id/detail` | 템플릿 상세 조회 (DB) |
| PUT | `/api/admin/alimtalk/templates/:id` | 템플릿 수정 |
| PATCH | `/api/admin/alimtalk/templates/:id` | 템플릿 ON/OFF 토글 |
| PATCH | `/api/admin/alimtalk/templates/:id/mode` | 자동/수동 모드 변경 |
| DELETE | `/api/admin/alimtalk/templates/:id` | 템플릿 삭제 |
| GET | `/api/admin/alimtalk/statistics` | 전체 통계 조회 |
| GET | `/api/admin/alimtalk/history` | 발송 이력 조회 |
| GET | `/api/admin/alimtalk/recipients` | 수신자 목록 조회 |
| POST | `/api/admin/alimtalk/send/:code` | 수동 발송 |
| POST | `/api/admin/alimtalk/test/:code` | 테스트 발송 |

### 인증 요구사항
- 모든 API: `req.session.userId` 필수
- 권한: `SUPER_ADMIN` 또는 `ADMIN` 역할 필요

---

## 9. 프론트엔드 페이지

### 라우팅 구조

| 경로 | 컴포넌트 | 메뉴 위치 |
|------|----------|-----------|
| `/admin/kakao-notifications/alimtalk` | `AlimtalkPage` | 관리자 > 카카오 알림 > 알림톡(고정) |
| `/admin/kakao-notifications/brandtalk` | `BrandtalkPage` | 관리자 > 카카오 알림 > 친구톡 관리 |

### 알림톡 관리 페이지 기능 (1,078줄)

1. **템플릿 목록**: 전체 템플릿 카드 그리드 표시
2. **ON/OFF 토글**: 스위치로 활성/비활성 전환
3. **자동/수동 모드**: 토글 스위치로 모드 전환
4. **템플릿 상세 보기**: 다이얼로그에서 상세 정보 확인
5. **템플릿 수정**: 인라인 편집
6. **템플릿 등록**: 새 템플릿 추가 다이얼로그
7. **템플릿 삭제**: 확인 후 삭제
8. **테스트 발송**: 특정 번호로 테스트 발송
9. **수동 발송**: 수신자 선택 → 발송
10. **발송 이력**: 최근 발송 기록 목록
11. **통계 대시보드**: 전체 발송 통계 카드

### 브랜드톡 관리 페이지 (60줄)
- 기본 레이아웃만 구현됨
- 추후 확장 예정

---

## 10. 등록된 템플릿 목록

현재 DB에 등록된 알림톡 템플릿 (12개):

### 자동 발송 (isAuto: true) - 6개

| 코드 | 이름 | 솔라피 ID | 설명 |
|------|------|-----------|------|
| `SHIPPING` | 배송중 알림 | KA01TP2511060518... | 배송 출발 시 자동 |
| `ORDER_PREPARE` | 운송장 등록 알림 | KA01TP2503260045... | 상품 준비 완료 시 자동 |
| `WELCOME` | 회원가입 환영 인사 | KA01TP2601050243... | 신규 회원 환영 |
| `ORDER_DEADLINE_9AM` | 9시 주문마감 알림 | KA01TP2511250555... | 9시 마감 알림 |
| `ORDER_DEADLINE_10AM` | 10시 주문마감 알림 | KA01TP2511250548... | 10시 마감 알림 |
| `MEMBER_CANCEL_ALT` | 회원취소 마감 알림(대체) | KA01TP2503260047... | 취소 마감 대체 |

### 수동 발송 (isAuto: false) - 6개

| 코드 | 이름 | 솔라피 ID | 설명 | 누적발송 |
|------|------|-----------|------|----------|
| `ORDER_DEADLINE_10MIN` | 주문 마감 10분전 알림 | KA01TP2503260040... | 마감 10분전 | 1건 |
| `WAYBILL_DOWNLOAD` | 운송장 다운로드 마감 안내 | KA01TP2504010648... | 운송장 안내 | 1건 |
| `MEMBER_CANCEL` | 회원취소 마감 알림 | KA01TP2512230005... | 취소 마감 | 1건 |
| `MEMBER_CANCEL_10MIN` | 회원취소 마감10분전 알림 | KA01TP2512230002... | 취소 10분전 | 0건 |
| `MEMBER_CANCEL_10MIN_ALT` | 회원취소 마감10분전(대체) | KA01TP2503260046... | 취소 10분전 대체 | 0건 |
| `FORCE_CANCEL` | 직권 취소 알림 | KA01TP2503260043... | 관리자 직권 취소 | 0건 |

---

## 11. 자동 발송 시나리오

`isAuto: true`인 템플릿은 시스템 이벤트 발생 시 자동으로 발송됩니다.

### 시나리오 1: 배송중 전환 알림 (`SHIPPING`)
```
트리거: 주문 상태가 "배송중"으로 전환될 때
수신자: 해당 주문의 회원 연락처
내용: 배송 출발 안내
```

### 시나리오 2: 운송장 등록 알림 (`ORDER_PREPARE`)
```
트리거: 상품준비중 단계에서 운송장 정보 등록 시
수신자: 해당 주문의 회원 연락처
내용: 상품 준비 완료 안내
```

### 시나리오 3: 회원가입 환영 (`WELCOME`)
```
트리거: 신규 회원 가입 승인 시
수신자: 신규 회원 연락처
내용: 회원가입 환영 메시지
```

### 시나리오 4: 주문 마감 알림 (`ORDER_DEADLINE_9AM`, `ORDER_DEADLINE_10AM`)
```
트리거: 자동 발송 모드일 경우, 해당 시간에 자동 발송
수신자: 활성 회원 전체
내용: 주문 마감 안내
```

### 시나리오 5: 회원취소 마감 알림 (대체) (`MEMBER_CANCEL_ALT`)
```
트리거: 자동 발송 모드일 경우
수신자: 활성 회원
내용: 회원 주문 취소 마감 안내
```

---

## 12. 수동 발송 시나리오

### 발송 프로세스

```
1. 관리자 로그인
2. 카카오 알림 > 알림톡(고정) 페이지 진입
3. 수동 템플릿 선택
4. "발송" 버튼 클릭
5. 수신자 타입 선택:
   - 전체: 모든 활성 회원
   - 등급별: START, DRIVING, TOP 중 선택
6. 변수 입력 (템플릿에 따라)
7. 발송 실행
8. 결과 확인 (성공/실패 건수, 비용)
```

### 수신자 수집 로직
```
활성 회원 필터링 (status === '활성')
→ 등급 필터 적용 (선택 시)
→ 각 회원의 연락처 수집:
  - member.phone (대표번호)
  - member.managerPhone (담당자1)
  - member.manager2Phone (담당자2)
  - member.manager3Phone (담당자3)
→ 하이픈 제거
→ Set으로 중복 제거
→ 발송 대상 확정
```

### 테스트 발송
```
1. 템플릿 카드에서 "테스트" 버튼 클릭
2. 수신 번호 입력 (직접 입력)
3. 발송 실행
4. 결과 확인

주의: SOLAPI_SENDER가 대표번호(1588-xxxx)인 경우,
      대표번호로는 알림톡 수신 불가 → 개인 휴대폰 번호로 테스트
```

---

## 13. 매입업체 배분 알림 (SMS)

### 발송 시점
매입업체(Vendor)에 대한 주문 배분(Allocation) 시 SMS 자동 발송

### 시나리오 1: 초기 배분 알림
```
트리거: POST /api/admin/allocations/:allocationId/notify
동작:
  1. 배분 대상 업체별 반복
  2. vendor.contactPhone 존재 시 SMS 발송
  3. solapiService.sendSMS(vendor.contactPhone, message)
  4. 발송 결과를 notifiedVendors에 기록
```

### 시나리오 2: 추가 배분 알림
```
트리거: POST /api/admin/allocations/:allocationId/notify-additional
동작: 초기 배분과 동일한 로직
메시지: "[탑셀러] 추가 배분 요청" 제목으로 구분
```

### SMS 메시지 구조
```
[탑셀러] 배분 요청
상품: {allocation.productName}
요청수량: {requestedQuantity}박스
매입가: {vendorPrice}원 (또는 "미정")
마감시간: {deadline}
대시보드에서 가능수량을 입력해 주세요.
```

### 에러 처리
- SMS 발송 실패 시 콘솔 에러 로그만 남기고 프로세스 계속 진행
- `kakaoSent: boolean` 플래그로 발송 성공 여부 추적

---

## 14. 발송 이력 및 통계

### 이력 저장 (알림톡)
수동 발송 완료 후 자동 기록:
```
alimtalk_history 레코드 생성:
  - templateId: 사용된 템플릿 ID
  - recipientCount: 수신자 수
  - successCount: 성공 건수
  - failCount: 실패 건수
  - cost: successCount * 13 (원)
  - sentBy: 발송한 관리자 ID
  - responseData: Solapi API 전체 응답 (JSON)
```

### 템플릿 통계 업데이트
```
발송 완료 시 alimtalk_templates 업데이트:
  - totalSent += successCount
  - totalCost += cost
  - updatedAt = 현재 시간
```

### 통계 API 응답
```json
{
  "totalTemplates": 12,       // 전체 템플릿 수
  "autoTemplates": 6,         // 자동 템플릿 수
  "manualTemplates": 6,       // 수동 템플릿 수
  "totalSent": 3,             // 이번 달 총 발송 수
  "totalCost": 39,            // 이번 달 총 비용 (원)
  "monthlySent": 0,           // 이번 달 이력 기반 발송 수
  "monthlyCost": 0            // 이번 달 이력 기반 비용
}
```

### 이력 조회 API
- `GET /api/admin/alimtalk/history?limit=50&offset=0`
- 템플릿명, 수신자수, 성공/실패, 비용, 발송일시 반환

---

## 15. 비용 구조

| 채널 | 건당 비용 | 비고 |
|------|-----------|------|
| 알림톡 | 13원 | Solapi 기준 |
| 브랜드톡 | 별도 | 마케팅/정보성에 따라 다름 |
| SMS | 별도 | 단문/장문에 따라 다름 |

### 비용 계산 로직
```typescript
const cost = result.successCount * 13; // 알림톡 건당 13원
```

---

## 16. 핵심 파일 구조

```
프로젝트/
├── server/
│   ├── services/
│   │   └── solapi.ts              ← Solapi SDK 서비스 (593줄)
│   └── routes.ts                  ← API 엔드포인트 (알림톡 12개 + SMS 2개)
├── shared/
│   └── schema.ts                  ← DB 스키마 (4개 테이블)
├── client/src/
│   ├── App.tsx                    ← 라우팅 등록
│   ├── pages/
│   │   └── admin/
│   │       ├── admin-layout.tsx   ← 사이드바 메뉴 (카카오 알림)
│   │       └── kakao-notifications/
│   │           ├── alimtalk.tsx   ← 알림톡 관리 페이지 (1,078줄)
│   │           └── brandtalk.tsx  ← 브랜드톡 관리 페이지 (60줄)
│   └── components/
│       └── admin/
│           └── allocation-section.tsx  ← 배분 알림 (SMS 호출 UI)
```

---

## 17. 주의사항 및 트러블슈팅

### 1. 발신번호 관련
- `SOLAPI_SENDER`가 대표번호(1588-xxxx)인 경우 알림톡 **수신** 불가
- 테스트 시 반드시 카카오톡이 설치된 개인 휴대폰 번호 사용
- 발신번호는 사전에 Solapi에서 등록/인증 필요

### 2. 솔라피 응답 해석
- `registeredSuccess`: 메시지가 큐에 등록됨 (성공 지표)
- `sentSuccess`: 실제 발송 완료 (비동기, 즉시 조회 시 0일 수 있음)
- `registeredFailed`: 등록 실패 (형식 오류, API 오류)
- 발송 직후에는 `registeredSuccess`를 기준으로 성공 판단

### 3. 템플릿 ID
- 솔라피 콘솔에서 발급받은 ID 그대로 사용
- 형식: `KA01TP` + 날짜/시간/랜덤 문자열 (예: `KA01TP250401064812535rjuhD934ZTC`)
- 잘못된 템플릿 ID 사용 시 발송 실패

### 4. KAKAO_PFID
- 카카오 비즈니스 채널의 프로필 ID
- 형식: `@비즈채널명` 또는 영문 코드
- 채널에 등록된 템플릿만 발송 가능

### 5. 전화번호 형식
- 내부적으로 하이픈 자동 제거: `010-1234-5678` → `01012345678`
- 하이픈 포함/미포함 모두 입력 가능

### 6. 중복 발송 방지
- 수신자 목록에서 `Set`으로 전화번호 중복 제거
- 같은 회원의 대표번호와 담당자 번호가 동일하면 1건만 발송

### 7. SMS 발송 실패 처리
- SMS 발송 실패 시 에러를 catch하고 로그만 남김
- 배분 프로세스 자체는 중단되지 않음 (비핵심 기능)

### 8. 비활성 템플릿
- `isActive: false`인 템플릿으로 발송 시도 시 400 에러 반환
- 자동 발송도 비활성 체크 후 스킵

---

## 부록: Solapi SDK 설치 정보

```
패키지: solapi
버전: npm에서 최신 버전 사용
설치: npm install solapi
공식 문서: https://docs.solapi.com
```

### 핵심 클래스
```typescript
import { SolapiMessageService } from 'solapi';
const messageService = new SolapiMessageService(apiKey, apiSecret);
```

---

*이 문서는 탑셀러 주문관리 시스템의 알림 시스템 전체 현황을 정리한 것입니다.*
*최종 업데이트: 2026-02-19*
