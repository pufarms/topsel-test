# 문의 게시판 시스템 상세 구조 문서

## 1. 시스템 개요

1:1 스레드 기반 문의 게시판 시스템으로, **회원(Member)**이 문의를 등록하고 **관리자(Admin)**가 답변하는 양방향 커뮤니케이션 구조입니다.

- **회원 측**: 마이페이지 내 "문의 게시판" 탭 (`inquiry-tab.tsx`)
- **관리자 측**: 관리자 메뉴 "게시판 관리" 페이지 (`board-management.tsx`)

---

## 2. 데이터베이스 스키마

### 2.1 `inquiries` (문의 메인 테이블)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | serial (PK) | 문의 고유 ID |
| `memberId` | varchar (NOT NULL) | 문의 작성 회원 ID |
| `memberName` | varchar(100) | 회원명 (업체명 우선, 없으면 회원명/아이디) |
| `category` | varchar(50) | 문의 카테고리 (기본값: "일반문의") |
| `title` | varchar(300) | 문의 제목 |
| `content` | text | 문의 내용 본문 |
| `status` | varchar(20) | 문의 상태 (기본값: "대기") |
| `priority` | varchar(10) | 우선순위 (normal / urgent) |
| `isStarred` | boolean | 관리자 즐겨찾기 (기본값: false) |
| `closedAt` | timestamp | 종결 일시 |
| `closedBy` | varchar(100) | 종결 처리자 |
| `lastMessageAt` | timestamp | 마지막 메시지 시각 (정렬 기준) |
| `unreadByAdmin` | boolean | 관리자 미확인 여부 (기본값: true) |
| `unreadByMember` | boolean | 회원 미확인 여부 (기본값: false) |
| `createdAt` | timestamp | 생성 일시 |
| `updatedAt` | timestamp | 수정 일시 |

### 2.2 `inquiry_messages` (메시지/대화 테이블)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | serial (PK) | 메시지 고유 ID |
| `inquiryId` | integer (NOT NULL) | 소속 문의 ID |
| `senderType` | varchar(10) | 발신자 유형 ("member" / "admin") |
| `senderId` | varchar(100) | 발신자 ID |
| `senderName` | varchar(100) | 발신자 이름 |
| `content` | text | 메시지 내용 |
| `createdAt` | timestamp | 전송 일시 |

### 2.3 `inquiry_fields` (카테고리별 동적 필드)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | serial (PK) | 필드 고유 ID |
| `inquiryId` | integer (NOT NULL) | 소속 문의 ID |
| `fieldName` | varchar(100) | 필드 라벨명 |
| `fieldValue` | text | 필드 입력값 |

### 2.4 `inquiry_attachments` (첨부파일 테이블)

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `id` | serial (PK) | 첨부파일 고유 ID |
| `inquiryId` | integer (NOT NULL) | 소속 문의 ID |
| `messageId` | integer (nullable) | 연결 메시지 ID |
| `fileName` | varchar(300) | 원본 파일명 |
| `fileUrl` | text | 저장 경로 URL |
| `fileSize` | integer | 파일 크기 (bytes) |
| `fileType` | varchar(50) | MIME 타입 |
| `label` | varchar(100) | 파일 라벨 |
| `createdAt` | timestamp | 업로드 일시 |

---

## 3. 문의 상태 흐름 (Status Flow)

```
[회원 문의 등록]
      │
      ▼
    대기  ──────────────────────────┐
      │                            │
      │  관리자: "확인중 전환"        │
      ▼                            │
   확인중                           │
      │                            │
      │  관리자: 답변 메시지 전송      │
      ▼                            │
  답변완료 ◄───────────────────────┘
      │                     ▲
      │  회원: 추가 문의      │ 관리자: 재답변
      ▼                     │
  추가문의 ─────────────────┘
      │
      │  관리자: "종결 처리"
      ▼
    종결
```

### 상태 전환 규칙

| 현재 상태 | 트리거 | 다음 상태 |
|-----------|--------|-----------|
| 대기 | 관리자 답변 메시지 전송 | 답변완료 |
| 대기 | 관리자 "확인중 전환" 클릭 | 확인중 |
| 확인중 | 관리자 답변 메시지 전송 | 답변완료 |
| 답변완료 | 회원 추가 문의 메시지 전송 | 추가문의 |
| 추가문의 | 관리자 답변 메시지 전송 | 답변완료 |
| 모든 상태 | 관리자 "종결 처리" 클릭 | 종결 |
| 종결 | - | 추가 메시지 전송 불가 |

### 상태별 색상

| 상태 | 색상 | 의미 |
|------|------|------|
| 대기 | 빨강 (red) | 아직 관리자가 확인하지 않은 문의 |
| 확인중 | 주황 (orange) | 관리자가 확인 중인 문의 |
| 답변완료 | 파랑 (blue) | 관리자가 답변을 완료한 문의 |
| 추가문의 | 분홍 (pink/red) | 회원이 추가 질문을 남긴 문의 |
| 종결 | 회색 (gray) | 완료 처리된 문의 |

---

## 4. 카테고리별 동적 필드 시스템

문의 카테고리에 따라 필수 입력 항목이 달라지는 **동적 폼 시스템**입니다.

### 4.1 카테고리 목록 및 필드 정의

#### (1) 일반문의
- 아이콘: MessageSquare (파랑)
- 필드: 제목*, 문의 내용*

#### (2) 상품CS/미수
- 아이콘: AlertCircle (빨강)
- 필드: 제목*, 담당자/연락처*, 상품 발송일*, 상품명/코드*, 수령자*, 운송장 번호*, 상세 내용*
- 특수 안내: "사진 3장 필수" 안내 배너 표시

#### (3) 정산/계산서
- 아이콘: FileText (노랑)
- 필드: 제목*, 사업자명/ID*, 요청 금액/내용*, 상세 내용

#### (4) 회원정보(등급)
- 아이콘: User (주황)
- 필드: 제목*, 회원 아이디*, 담당자 이름/연락처*, 문의 접수일*, 상세 내용*

#### (5) 행사특가/변경
- 아이콘: Package (초록)
- 필드: 제목/아이디*, 행사 상품명/코드*, 사이트명/행사명*, 판매 예상 수량*, 행사/출고 예정일*, 상세 내용

#### (6) 기타
- 아이콘: Clock (회색)
- 필드: 제목*, 문의 내용*

### 4.2 동적 필드 저장 로직

1. `title`과 `content` 필드는 inquiries 테이블에 직접 저장
2. 그 외 카테고리별 추가 필드들은 `inquiry_fields` 테이블에 key-value 형태로 저장
3. 서버에서 카테고리별 필수 필드 검증 수행

---

## 5. 미확인/알림 시스템 (Unread System)

양방향 미확인 플래그를 통해 새 메시지를 추적합니다.

| 이벤트 | unreadByAdmin | unreadByMember |
|--------|:-------------:|:--------------:|
| 회원이 문의 등록 | true | false |
| 관리자가 답변 전송 | false | true |
| 회원이 추가 문의 | true | false |
| 관리자가 문의 상세 열람 | false (mark read) | 변동 없음 |
| 회원이 문의 상세 열람 | 변동 없음 | false (mark read) |

### 실시간 갱신

- 회원 측: 문의 목록/카운트 **5초 간격** 자동 갱신, 상세 보기 **3초 간격** 자동 갱신
- 관리자 측: 문의 목록/카운트 **5초 간격** 자동 갱신, 상세 보기 **3초 간격** 자동 갱신

---

## 6. API 엔드포인트

### 6.1 관리자 API (`/api/admin/inquiries`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/admin/inquiries/counts` | 전체/상태별/카테고리별 통계 + 미확인 수 |
| GET | `/api/admin/inquiries` | 문의 목록 (status, category, search 필터) |
| GET | `/api/admin/inquiries/:id` | 문의 상세 (messages, fields, attachments 포함) |
| POST | `/api/admin/inquiries/:id/messages` | 답변 메시지 전송 → 상태 "답변완료"로 변경 |
| PATCH | `/api/admin/inquiries/:id/status` | 상태 변경 (확인중, 종결 등) |
| PATCH | `/api/admin/inquiries/:id/star` | 즐겨찾기 토글 |
| PATCH | `/api/admin/inquiries/:id/read` | 관리자 읽음 처리 |
| DELETE | `/api/admin/inquiries/:id` | 문의 삭제 (첨부파일, 필드, 메시지 포함 cascade) |
| POST | `/api/admin/inquiries/:id/attachments` | 첨부파일 업로드 (multer, 10MB 제한) |

### 6.2 회원 API (`/api/member/inquiries`)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/member/inquiries/counts` | 내 문의 통계 (전체, 상태별, 새 답변 수) |
| GET | `/api/member/inquiries` | 내 문의 목록 (lastMessageAt 내림차순) |
| POST | `/api/member/inquiries` | 문의 등록 (카테고리별 필수 필드 검증) |
| GET | `/api/member/inquiries/:id` | 내 문의 상세 (본인 문의만 조회 가능) |
| POST | `/api/member/inquiries/:id/messages` | 추가 문의 전송 → 답변완료 상태면 "추가문의"로 변경 |
| PATCH | `/api/member/inquiries/:id/read` | 회원 읽음 처리 |
| POST | `/api/member/inquiries/:id/attachments` | 첨부파일 업로드 |

### 6.3 정렬 규칙

**관리자 목록**: 
1. 긴급(urgent) 문의 우선 → `CASE WHEN priority = 'urgent' THEN 0 ELSE 1 END`
2. 마지막 메시지 시각 내림차순 → `DESC lastMessageAt`

**회원 목록**:
- 마지막 메시지 시각 내림차순

---

## 7. 프론트엔드 구조

### 7.1 회원 페이지 (`inquiry-tab.tsx`, 669줄)

회원 마이페이지의 탭 컴포넌트로, 3개의 뷰(View)를 `activeView` 상태로 전환합니다.

```
activeView 상태:
├── "list"   → 문의 목록 화면
├── "write"  → 문의 작성 화면
└── "detail" → 문의 상세/대화 화면
```

#### 목록 화면 (list)
- 통계 카드 4개: 전체 문의, 답변 대기, 답변 완료(+새 답변 배지), 종결
- 상태 필터 버튼: 전체, 대기, 답변완료, 종결
- 문의 리스트: 상태 배지, 카테고리, 제목, 미확인(N) 배지, 메시지 수, 날짜

#### 작성 화면 (write)
- 카테고리 선택 그리드 (3열, 6개 카테고리)
- 카테고리 선택 시 해당 필수 필드 폼 동적 생성
- 긴급 문의 체크박스
- 제출 시 서버 검증 후 등록

#### 상세 화면 (detail)
- 문의 헤더: 상태 배지, 카테고리, 제목, 등록일
- 접수 정보 카드: 카테고리별 동적 필드 표시 (2열 그리드)
- 대화 내역: 채팅 버블 UI (회원: 우측/인디고, 관리자: 좌측/회색)
- 추가 문의 입력란 (종결 상태가 아닌 경우에만 표시)
- 자동 스크롤: 새 메시지 시 하단으로 자동 스크롤

### 7.2 관리자 페이지 (`board-management.tsx`, 575줄)

좌우 분할 레이아웃 (38% : 62%)의 게시판 관리 화면입니다.

```
┌──────────────────────────────────────────────────┐
│  헤더: "게시판 관리" + 통계 (총 N건 / 미답변 N건)     │
├──────────────────────────────────────────────────┤
│  카테고리 필터 탭 (전체, 일반문의, 상품CS/미수, ...)   │
├─────────────────┬────────────────────────────────┤
│ [좌: 문의 목록]   │  [우: 문의 상세]                  │
│                 │                                │
│ 상태 필터 버튼    │  문의 헤더                       │
│ 검색 입력        │  (상태, 카테고리, 긴급, 즐겨찾기)   │
│                 │  (확인중 전환, 종결 처리, 삭제)     │
│ ┌─────────────┐ │                                │
│ │ 문의 1       │ │  탭: 접수정보 | 대화 | 첨부파일    │
│ │ ● 대기       │ │                                │
│ │ 제목...      │ │  [탭 내용 영역]                  │
│ │ 홍길동       │ │                                │
│ ├─────────────┤ │  ┌──────────────────────────┐  │
│ │ 문의 2       │ │  │ 답변 입력란               │  │
│ │ ● 답변완료   │ │  │ [전송 버튼]               │  │
│ └─────────────┘ │  └──────────────────────────┘  │
└─────────────────┴────────────────────────────────┘
```

#### 관리자 기능
- **카테고리 필터**: 전체 + 6개 카테고리, 각 카테고리별 건수 배지
- **상태 필터**: 전체/대기/확인중/답변완료/추가문의/종결 (색상 도트 표시)
- **검색**: 제목, 내용, 작성자 통합 검색 (ilike)
- **문의 목록**: 미확인 문의 강조 (빨간 점 + 굵은 글씨), 긴급 문의 배지
- **상세 탭**: 접수정보 / 대화 / 첨부파일
- **관리 액션**: 즐겨찾기 토글, 확인중 전환, 종결 처리, 삭제
- **답변 전송**: 텍스트 입력 후 Enter(전송) 또는 Shift+Enter(줄바꿈)

---

## 8. 첨부파일 시스템

- **저장 경로**: `uploads/inquiries/` 디렉토리
- **업로드 제한**: 10MB (`multer` 사용)
- **업로드 주체**: 관리자, 회원 모두 가능
- **접근**: `fileUrl` 필드를 통해 직접 다운로드

---

## 9. 보안 및 접근 제어

### 관리자 API
- 세션 기반 인증 (`req.session.userId`)
- `isAdmin(user.role)` 검증 (SUPER_ADMIN, ADMIN 허용)

### 회원 API
- 세션 기반 인증 + `userType === "member"` 검증
- **문의 소유권 검증**: 모든 회원 API에서 `eq(inquiries.memberId, member.id)` 조건 적용
- 종결된 문의에는 추가 메시지 전송 불가 (400 에러)

### 삭제 처리
- 관리자만 삭제 가능
- 삭제 시 cascade: 첨부파일 → 필드 → 메시지 → 문의 본체 순서로 삭제

---

## 10. 파일 위치 요약

| 구분 | 파일 경로 |
|------|----------|
| DB 스키마 | `shared/schema.ts` (inquiries, inquiryMessages, inquiryFields, inquiryAttachments) |
| 백엔드 API | `server/routes.ts` (약 15907~16397 라인) |
| 회원 프론트엔드 | `client/src/pages/member/inquiry-tab.tsx` (669줄) |
| 관리자 프론트엔드 | `client/src/pages/admin/board-management.tsx` (575줄) |
| 첨부파일 저장소 | `uploads/inquiries/` |
