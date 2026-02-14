# 문의 게시판 시스템 전면 개선

## ⚠️ 최우선 원칙

1. **⛔ 기존 CSS, 글씨체, 폰트, 전역 스타일을 절대 수정하거나 새로 추가하지 마세요.** 현재 프로젝트에 설정된 Tailwind 설정, CSS 파일, 글씨체(font-family)를 100% 그대로 사용해야 합니다. 새로운 폰트 import, 새로운 CSS 파일 추가, 전역 스타일 변경은 절대 금지입니다.
2. **기존 인증 방식(세션 기반), 라우팅 구조, 기술 스택(React + TanStack Query + shadcn/ui + Drizzle ORM)을 그대로 유지하세요.**
3. **함께 첨부된 예시 파일(admin-board-design-v2.jsx, member-inquiry-design.jsx)은 디자인 방향을 보여주는 참고용입니다. 똑같이 만들 필요 없습니다.** 기존 프로젝트의 컴포넌트 구조와 코드 스타일을 유지하면서, 이 프롬프트에 명시된 기능과 구조를 반영하세요.
4. 작업은 단계별로 진행하고, 각 단계 완료 후 정상 동작을 확인한 뒤 다음 단계로 넘어가세요.
5. 작업 진행 상황과 결과는 항상 **한글**로 보여주세요.

> **🚫 절대 하지 말아야 할 것:**
> - 새로운 폰트(Google Fonts 등) 추가
> - 새로운 CSS 파일 생성
> - 기존 globals.css, tailwind.config 등 전역 설정 수정
> - 기존에 사용 중인 shadcn/ui 컴포넌트 스타일 변경
>
> **✅ 반드시 지켜야 할 것:**
> - 현재 프로젝트의 기존 CSS, 폰트, Tailwind 설정을 그대로 사용
> - 기존 shadcn/ui 컴포넌트(Card, Badge, Button, Dialog, Select, Input, Textarea 등) 활용
> - 기존 프로젝트에서 이미 사용 중인 스타일링 방식 그대로 따르기

---

## 📋 작업 개요

현재 문의 게시판 시스템(관리자 `/admin/board` + 회원 `/dashboard` 문의 게시판 탭)을 전면 개선합니다.

**핵심 변경사항:**
- 카테고리를 대시보드 문의현황 6가지와 통일
- 단일 답변 → 스레드(대화) 방식으로 전환
- 상태를 2단계 → 5단계로 확장
- 관리자 UI를 모달 → 좌우 분할 레이아웃으로 변경
- 카테고리별 필수 입력 항목 동적 폼 구현
- 이미지/파일 업로드 기능 추가
- 대시보드 문의현황과 실시간 연동

---

## 1단계: 데이터베이스 스키마 변경

### 1-1. inquiries 테이블 수정

기존 `inquiries` 테이블의 컬럼을 변경합니다:

**삭제할 컬럼:**
- `answer` (text) — 삭제 (대화 테이블로 이동)
- `answered_by` (varchar) — 삭제
- `answered_at` (timestamp) — 삭제

**추가할 컬럼:**
- `priority` varchar(10), 기본값 "normal" — 값: "normal" / "urgent"
- `is_starred` boolean, 기본값 false — 관리자 중요 표시
- `closed_at` timestamp, nullable — 종결 처리 일시
- `closed_by` varchar(100), nullable — 종결 처리 관리자
- `last_message_at` timestamp, 기본값 now() — 마지막 메시지 시간 (정렬용)
- `unread_by_admin` boolean, 기본값 true — 관리자 미읽음
- `unread_by_member` boolean, 기본값 false — 회원 미읽음 (새 답변)

**수정할 컬럼:**

`category` 값을 아래 6가지로 변경:
- 일반문의
- 상품CS/미수
- 정산/계산서
- 회원정보(등급)
- 행사특가/변경
- 기타

`status` 값을 아래 5가지로 변경:
- 대기 (신규 문의, 미확인)
- 확인중 (관리자가 확인했으나 답변 전)
- 답변완료 (관리자가 답변 등록)
- 추가문의 (답변 후 회원이 추가 질문)
- 종결 (처리 완료)

### 1-2. inquiry_messages 테이블 신규 생성

```
inquiry_messages 테이블:
- id: serial, Primary Key
- inquiry_id: integer, NOT NULL, Foreign Key → inquiries.id (CASCADE DELETE)
- sender_type: varchar(10), NOT NULL — 값: "member" / "admin"
- sender_id: varchar(100), NOT NULL — 작성자 ID
- sender_name: varchar(100), NOT NULL — 작성자 이름
- content: text, NOT NULL — 메시지 내용
- created_at: timestamp, NOT NULL, 기본값 now()
```

### 1-3. inquiry_fields 테이블 신규 생성

카테고리별 필수 입력 항목 데이터를 저장합니다.

```
inquiry_fields 테이블:
- id: serial, Primary Key
- inquiry_id: integer, NOT NULL, Foreign Key → inquiries.id (CASCADE DELETE)
- field_name: varchar(100), NOT NULL — 필드명 (예: "담당자연락처", "상품발송일")
- field_value: text, NOT NULL — 입력값
```

### 1-4. inquiry_attachments 테이블 신규 생성

```
inquiry_attachments 테이블:
- id: serial, Primary Key
- inquiry_id: integer, NOT NULL, Foreign Key → inquiries.id (CASCADE DELETE)
- message_id: integer, nullable, Foreign Key → inquiry_messages.id — 특정 메시지에 첨부 시
- file_name: varchar(300), NOT NULL — 원본 파일명
- file_url: text, NOT NULL — 저장 경로/URL
- file_size: integer — 파일 크기(bytes)
- file_type: varchar(50) — MIME 타입 (image/jpeg, application/pdf 등)
- label: varchar(100), nullable — 라벨 (예: "발송 박스 전체", "상품 전체 사진")
- created_at: timestamp, NOT NULL, 기본값 now()
```

### 1-5. Zod 스키마 업데이트

`shared/schema.ts`에 새 테이블들의 Zod 스키마와 TypeScript 타입을 추가하세요.

---

## 2단계: API 엔드포인트 변경

### 2-1. 관리자 API 수정/추가

기존 API를 수정하고 새 API를 추가합니다:

**수정:**

```
GET /api/admin/inquiries
```
- 쿼리 파라미터: `status`, `category`, `search` (서버 사이드 검색)
- 응답에 각 문의의 `messageCount`, `lastMessage` 포함
- 정렬: `last_message_at` 기준 최신순, 단 `urgent`가 true인 건은 항상 최상단

```
GET /api/admin/inquiries/:id
```
- 응답에 `messages[]`, `fields[]`, `attachments[]` 포함

**수정 (답변 → 메시지 등록 방식으로 변경):**

```
POST /api/admin/inquiries/:id/messages
```
- 요청: `{ content: "답변 내용" }`
- 동작: inquiry_messages에 새 메시지 추가 (sender_type: "admin")
- 상태 자동 변경: → "답변완료"
- `unread_by_member` → true (회원에게 새 답변 알림)
- `unread_by_admin` → false
- `last_message_at` 갱신

**추가:**

```
PATCH /api/admin/inquiries/:id/status
```
- 요청: `{ status: "확인중" | "종결" }`
- "종결" 시 `closed_at`, `closed_by` 기록

```
PATCH /api/admin/inquiries/:id/star
```
- 요청: `{ is_starred: true/false }`
- 관리자 중요 표시 토글

```
PATCH /api/admin/inquiries/:id/read
```
- 동작: `unread_by_admin` → false
- 문의 상세 열 때 자동 호출

```
GET /api/admin/inquiries/counts
```
- 응답: 카테고리별 + 상태별 건수 (대시보드 연동용)
- 예: `{ total: 12, byStatus: { "대기": 4, "확인중": 2, ... }, byCategory: { "일반문의": 3, ... } }`

### 2-2. 회원 API 수정/추가

**수정:**

```
POST /api/member/inquiries
```
- 요청 확장: `{ category, title, content, priority, fields: [{field_name, field_value}] }`
- 카테고리별 필수 필드 서버 사이드 검증 추가 (아래 "카테고리별 필수 항목" 섹션 참고)
- 자동으로 inquiry_messages에 첫 메시지 추가 (content를 첫 메시지로)
- 자동으로 inquiry_fields에 필드 데이터 저장

**추가:**

```
POST /api/member/inquiries/:id/messages
```
- 요청: `{ content: "추가 문의 내용" }`
- 동작: inquiry_messages에 새 메시지 추가 (sender_type: "member")
- 상태 자동 변경: "답변완료" → "추가문의"
- `unread_by_admin` → true
- `unread_by_member` → false
- `last_message_at` 갱신
- 보안: 본인 문의만 가능

```
PATCH /api/member/inquiries/:id/read
```
- 동작: `unread_by_member` → false
- 문의 상세 열 때 자동 호출

```
POST /api/member/inquiries/:id/attachments
```
- 파일 업로드 처리 (multer 등 사용)
- Cloudflare R2 또는 로컬 스토리지에 저장
- inquiry_attachments에 레코드 추가

```
GET /api/member/inquiries/counts
```
- 응답: 상태별 건수 + 새 답변 건수
- 예: `{ total: 4, byStatus: { "대기": 1, "답변완료": 2, ... }, newReplies: 1 }`

---

## 3단계: 카테고리별 필수 입력 항목 정의

회원이 문의 등록 시, 선택한 카테고리에 따라 필수 입력 필드가 동적으로 표시되어야 합니다.

### 💬 일반문의
| 필드명 | 타입 | 필수 |
|--------|------|------|
| 제목 | text | O |
| 문의 내용 | textarea | O |

### 🚨 상품CS/미수
| 필드명 | 타입 | 필수 |
|--------|------|------|
| 제목 | text | O |
| 담당자 / 연락처 | text | O |
| 상품 발송일 | date | O |
| 상품명 / 코드 | text | O |
| 수령자 | text | O |
| 운송장 번호 | text | O |
| 상세 내용 | textarea | O |
| 증빙 사진 3장 | photo upload | O |

**증빙 사진 안내 (상품CS/미수 전용):**
- ① 발송 박스 전체 사진 (송장 부착 확인 가능)
- ② 상품 전체 사진
- ③ 이슈(불량/파손) 부분 상세 사진
- 경고 문구: "온라인 특성상 확인 가능한 사진이 없으면 처리가 불가능합니다."
- 3장 미첨부 시 등록 불가

### 🧾 정산/계산서
| 필드명 | 타입 | 필수 |
|--------|------|------|
| 제목 | text | O |
| 사업자명 / ID | text | O |
| 요청 금액 / 내용 | text | O |
| 상세 내용 | textarea | X |
| 관련 증빙 서류 | file upload | O |

### 👤 회원정보(등급)
| 필드명 | 타입 | 필수 |
|--------|------|------|
| 제목 | text | O |
| 회원 아이디 | text | O |
| 담당자 이름 / 연락처 | text | O |
| 문의 접수일 | date | O |
| 상세 내용 | textarea | O |

### 🏷️ 행사특가/변경
| 필드명 | 타입 | 필수 |
|--------|------|------|
| 제목 / 아이디 | text | O |
| 행사 상품명 / 코드 | text | O |
| 사이트명 / 행사명 | text | O |
| 판매 예상 수량 | text | O |
| 행사 / 출고 예정일 | date | O |
| 상세 내용 | textarea | X |

### 📝 기타
| 필드명 | 타입 | 필수 |
|--------|------|------|
| 제목 | text | O |
| 문의 내용 | textarea | O |

**서버 검증:**
- 각 카테고리별로 필수 필드가 모두 입력되었는지 서버에서도 반드시 검증하세요.
- 상품CS/미수의 경우 첨부파일이 3개 이상인지 검증하세요.

---

## 4단계: 관리자 게시판 관리 페이지 UI 개선

파일: `client/src/pages/admin/board-management.tsx`

> ⚠️ UI 변경 시 기존 프로젝트의 CSS, 글씨체, shadcn/ui 컴포넌트를 그대로 사용하세요. 새로운 스타일을 추가하지 마세요.

### 4-1. 전체 레이아웃 변경

현재 모달 방식을 **좌우 분할(Split View) 레이아웃**으로 변경합니다.

```
┌──────────────────────────────────────────────────────┐
│  게시판 관리              총 12건 | 미답변 4건 | 추가문의 2건  │
├──────────────────────────────────────────────────────┤
│  [전체][💬일반문의 3][🚨상품CS 4][🧾정산 2][👤회원 1][🏷행사 1][📝기타 1]  │
├────────────────────┬─────────────────────────────────┤
│  문의 목록 (38%)     │  문의 상세 (62%)                    │
│                      │                                   │
│  [상태필터][검색]     │  [접수정보] [대화] [첨부파일]         │
│                      │                                   │
│  🔴대기 상품CS 긴급   │  (탭 내용 표시)                     │
│  프레시마트 02-14     │                                   │
│  ──────────────     │                                   │
│  🔴추가 정산/계산서   │                                   │
│  과일나라 02-13      │                                   │
│  ──────────────     │  ┌───────────────────────────┐   │
│  🟡확인중 일반문의    │  │ 답변 입력...                 │   │
│  프레시마트 02-13     │  └───────────────────────────┘   │
│  ...                 │  [파일첨부]         [답변 등록]     │
└────────────────────┴─────────────────────────────────┘
```

### 4-2. 페이지 상단

- 제목: "게시판 관리"
- 우측: 총 건수, 미답변 건수(빨강), 추가문의 건수(주황)

### 4-3. 카테고리 탭 바

- 전체 + 6개 카테고리 탭 (가로 나열)
- 각 탭에 건수 배지
- 대시보드 문의현황 카드 클릭 시 해당 카테고리 탭 활성화 (URL 파라미터: `/admin/board?category=상품CS/미수`)

### 4-4. 좌측 — 문의 목록 패널 (38%)

**상단: 상태 필터**
- 전체, 대기(빨강), 확인중(주황), 답변완료(파랑), 추가문의(빨강), 종결(회색)
- 각 상태 앞에 색상 점, 뒤에 건수

**상단: 검색**
- 제목, 작성자, 내용 통합 검색

**목록 항목:**
- 각 문의 항목에 표시: 상태 배지 + 카테고리 + 긴급 표시 + 제목 + 작성자 + 날짜 + 메시지 수
- 미읽음 건(unread_by_admin=true): 빨간 점 + 볼드 + 연한 빨간 배경
- 선택된 항목: 좌측 파란 라인 + 연한 인디고 배경
- 긴급 건: "긴급" 빨간 배지 표시

### 4-5. 우측 — 문의 상세 패널 (62%)

**상세 헤더:**
- 상태 배지 + 카테고리 + 긴급 표시
- 제목, 작성자, 등록일, 메시지 수, 첨부파일 수
- 버튼: "확인중 전환", "종결 처리", "삭제"

**3개 탭:**

**① 접수정보 탭:**
- 카테고리에 따른 필수 입력 데이터를 카드 형태로 표시
- 상품CS/미수: 담당자/연락처, 상품발송일, 상품명/코드, 수령자, 운송장번호 + 증빙사진 3장 썸네일
- 각 필드는 아이콘 + 라벨 + 값으로 구성
- 증빙사진은 클릭 시 원본 보기

**② 대화 탭:**
- 스레드 형태 대화 (회원=왼쪽 흰색 말풍선, 관리자=오른쪽 남색 말풍선)
- 각 메시지: 발신자 이름 + 시간 + 내용 + 첨부이미지 표시
- 하단: 답변 입력 텍스트영역 + 파일첨부 버튼 + 답변등록 버튼
- 답변 등록 시 상태 자동으로 "답변완료"로 변경

**③ 첨부파일 탭:**
- 전체 파일 목록 (파일명, 용량, 날짜, 다운로드)
- 이미지 파일은 미리보기 그리드 표시
- "전체 다운로드" 버튼

---

## 5단계: 회원 문의 게시판 UI 개선

파일: `client/src/pages/member/inquiry-tab.tsx`

> ⚠️ UI 변경 시 기존 프로젝트의 CSS, 글씨체, shadcn/ui 컴포넌트를 그대로 사용하세요. 새로운 스타일을 추가하지 마세요.

### 5-1. 목록 화면

**상단:**
- 제목: "문의 게시판"
- 설명: "궁금한 사항이나 요청사항을 남겨주세요."
- "문의하기" 버튼

**상태 요약 카드 (4개, 가로 1줄):**
- 전체 문의 N건
- 답변 대기 N건 (빨강)
- 답변 완료 N건 (파랑) + 새 답변 N 배지
- 종결 N건 (회색)

**필터:** 전체 / 대기 / 답변완료 / 종결

**목록:**
- 각 항목: 상태 배지 + 카테고리 + 제목 + "새 답변" 빨간 배지(unread_by_member=true) + 메시지 수 + 날짜
- 클릭 시 상세 화면으로 전환

### 5-2. 문의 작성 화면

**카테고리 선택 (3열 카드 그리드):**
- 6개 카테고리를 카드 형태로 표시
- 각 카드: 이모지 + 카테고리명 + 설명
- 선택 시 해당 색상으로 강조 (테두리, 배경)

**카테고리 선택 후 → 동적 폼 표시:**
- 선택한 카테고리에 따라 필수 입력 필드가 동적으로 나타남
- 폼 헤더에 카테고리 이모지 + "OOO — 필수 입력 항목" 표시
- 각 필드별 타입에 맞는 입력 UI:
  - text → 텍스트 입력
  - date → 날짜 선택
  - textarea → 텍스트영역
  - photos → 증빙사진 3장 업로드 (각 슬롯에 라벨: ①발송박스 전체, ②상품 전체, ③이슈 상세)
  - file → 파일 업로드
- 필수 항목에 빨간 * 표시
- 상품CS/미수 선택 시 사진 미첨부 경고 안내 박스 표시

**하단:**
- 긴급 문의 체크박스: "🔴 긴급 문의로 등록 (빠른 처리가 필요한 경우)"
- "취소" / "문의 등록" 버튼
- 등록 시 필수 필드 검증 → 미입력 시 해당 필드 하이라이트 + 에러 메시지

### 5-3. 문의 상세 화면

**헤더:** 뒤로가기 + 상태 배지 + 카테고리 + 제목 + 날짜

**접수 정보 패널 (접이식):**
- "📋 접수 정보 보기" 클릭 시 펼침/접힘
- 카테고리별 필수 필드 데이터 표시
- 증빙사진 썸네일 표시

**대화 영역:**
- 스레드 대화 (회원=오른쪽 인디고, 관리자=왼쪽 회색)
- 이미지 첨부 표시

**추가 문의 입력:**
- 텍스트영역 + 파일첨부 + "추가 문의 등록" 버튼
- 등록 시 상태가 "추가문의"로 변경됨
- "종결" 상태일 때는 추가 문의 입력 숨김 + "이 문의는 종결되었습니다" 안내

---

## 6단계: 대시보드 문의현황 연동

### 6-1. 관리자 대시보드

- 문의현황 6개 카드의 숫자를 `GET /api/admin/inquiries/counts`에서 가져와서 각 카테고리별 "대기" + "추가문의" 건수 합계로 표시
- 각 카드 클릭 시 `/admin/board?category=해당카테고리`로 이동

### 6-2. 관리자 사이드바

- "게시판 관리" 메뉴 옆에 미답변(대기 + 추가문의) 건수 빨간 배지 표시

### 6-3. 회원 대시보드

- 문의 게시판 카드에 새 답변 건수 표시 (unread_by_member=true 건수)
- "더보기" 클릭 시 문의 게시판 탭으로 이동

---

## 7단계: 상태 자동 전환 로직

상태는 아래 규칙에 따라 자동 전환됩니다. API에서 처리하세요.

```
[회원 문의 등록] → 상태: "대기"
    ↓
[관리자 "확인중 전환" 클릭] → 상태: "확인중" (선택사항)
    ↓
[관리자 답변 등록] → 상태: "답변완료", unread_by_member=true
    ↓
[회원 추가 문의 등록] → 상태: "추가문의", unread_by_admin=true
    ↓
[관리자 다시 답변] → 상태: "답변완료", unread_by_member=true
    ↓
(반복 가능)
    ↓
[관리자 "종결 처리" 클릭] → 상태: "종결", closed_at/closed_by 기록
```

"종결" 상태에서는 회원의 추가 문의가 불가합니다.

---

## 8단계: 파일 업로드 처리

### 업로드 방식
- multer 미들웨어를 사용하여 파일 업로드 처리
- 현재 프로젝트에서 사용 중인 파일 저장 방식(Cloudflare R2 또는 로컬)을 그대로 사용
- 이미지: JPG, PNG, WEBP (최대 5MB)
- 문서: PDF, XLS, XLSX (최대 10MB)

### 업로드 API
```
POST /api/member/inquiries/:id/attachments
POST /api/admin/inquiries/:id/attachments
```
- multipart/form-data로 파일 전송
- inquiry_attachments 테이블에 레코드 추가
- 응답: `{ id, file_name, file_url, file_size, file_type }`

---

## 검증 체크리스트

각 단계 완료 후 아래 항목을 확인하세요:

### DB/API 검증
1. ✅ inquiries 테이블에 새 컬럼(priority, is_starred, closed_at 등)이 추가되었는가?
2. ✅ inquiry_messages 테이블이 생성되고 CRUD가 동작하는가?
3. ✅ inquiry_fields 테이블에 카테고리별 필드가 저장되는가?
4. ✅ inquiry_attachments 테이블에 파일 정보가 저장되는가?
5. ✅ 카테고리가 6가지로 통일되었는가?
6. ✅ 상태가 5단계로 동작하는가?
7. ✅ 답변/추가문의 시 상태가 자동 전환되는가?
8. ✅ unread_by_admin, unread_by_member 플래그가 올바르게 동작하는가?

### 관리자 UI 검증
9. ✅ 좌우 분할 레이아웃으로 변경되었는가?
10. ✅ 카테고리 탭 + 상태 필터 + 검색이 동작하는가?
11. ✅ 접수정보 탭에서 카테고리별 필수 필드가 표시되는가?
12. ✅ 대화 탭에서 스레드 방식으로 메시지가 표시되는가?
13. ✅ 첨부파일 탭에서 이미지 미리보기와 다운로드가 동작하는가?
14. ✅ 상태 전환 버튼(확인중/종결/삭제)이 정상 동작하는가?

### 회원 UI 검증
15. ✅ 카테고리 선택 시 필수 입력 필드가 동적으로 나타나는가?
16. ✅ 상품CS/미수 선택 시 증빙사진 3장 업로드가 동작하는가?
17. ✅ 정산/계산서 선택 시 증빙서류 첨부가 동작하는가?
18. ✅ 필수 항목 미입력 시 검증 에러가 표시되는가?
19. ✅ 문의 상세에서 대화 스레드가 표시되는가?
20. ✅ 추가 문의 등록이 동작하는가?
21. ✅ 종결 상태에서는 추가 문의가 차단되는가?

### 연동 검증
22. ✅ 관리자 대시보드 문의현황 카드에 실시간 건수가 반영되는가?
23. ✅ 대시보드 카드 클릭 시 해당 카테고리로 이동하는가?
24. ✅ 사이드바에 미답변 건수 배지가 표시되는가?
25. ✅ 회원 대시보드에 새 답변 알림이 표시되는가?

### 기존 기능 보존 검증
26. ✅ 기존에 등록된 문의 데이터가 마이그레이션되어 정상 표시되는가?
27. ✅ 세션 기반 인증이 정상 동작하는가?
28. ✅ 회원은 자신의 문의만 볼 수 있는가?
29. ✅ **기존 CSS, 글씨체, 폰트가 변경 없이 100% 유지되는가? 새로운 폰트나 CSS 파일이 추가되지 않았는가?**

결과를 한글로 보고해 주세요.
