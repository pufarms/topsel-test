# 뱅크다A 연동 — 예치금 자동충전 시스템 구현 요구사항

## 1. 목적

회원이 농협 계좌로 입금하면, 뱅크다A REST API를 통해 입금 내역을 자동 감지하고
입금자명으로 회원을 찾아 예치금(deposit)을 자동 충전하는 시스템을 만들어주세요.

---

## 2. 뱅크다A REST API 스펙

### 호출 정보
- URL: `https://a.bankda.com/dtsvc/bank_tr.php`
- Method: `POST`
- Header: `Authorization: Bearer {BANKDA_ACCESS_TOKEN}`
- Content-Type: `application/x-www-form-urlencoded`

### 요청 파라미터 (Body - form-data)
| 파라미터 | 설명 |
|---------|------|
| datefrom | 조회 시작일 (YYYYMMDD) - 필수 |
| dateto | 조회 종료일 (YYYYMMDD) - 필수 |
| accountnum | 계좌번호 (숫자만, 생략시 전체계좌) |
| datatype | json 또는 xml (기본 json) |
| charset | utf8 또는 euckr (기본 utf8) |
| bkcode | 거래내역 고유번호 (숫자만) |
| istest | y 또는 n (기본 n, y면 5분제한 없이 최대 2건 반환) |

### 응답 (JSON)
```json
{
  "request": {
    "accountnum": "계좌번호",
    "bkname": "은행명",
    "bkcode": "",
    "datefrom": "20260211",
    "dateto": "20260211"
  },
  "response": {
    "record": 2,
    "description": "",
    "bank": [
      {
        "bkcode": "거래 고유번호 (중복방지 키로 사용)",
        "accountnum": "계좌번호",
        "bkname": "은행명",
        "bkdate": "거래일자 (YYYYMMDD)",
        "bktime": "거래시간 (HHMMSS)",
        "bkjukyo": "적요 (입금자명) ★ 이것으로 회원 매칭",
        "bkcontent": "내용 (거래유형 등)",
        "bketc": "기타 (거래점포명 등)",
        "bkinput": "입금액 (출금이면 0) ★ 이것이 충전 금액",
        "bkoutput": "출금액 (입금이면 0)",
        "bkjango": "잔액"
      }
    ]
  }
}
```

### API 제약사항
- 조회 후 5분이 지나야 다시 조회 가능 (계좌별 5분 제한)
- istest=y면 5분 제한 없음 (단, 최대 2건만 반환)

---

## 3. 환경 변수 (추가 필요)

```
BANKDA_API_URL=https://a.bankda.com/dtsvc/bank_tr.php
BANKDA_ACCESS_TOKEN=(발급받은 토큰)
BANKDA_ACCOUNT_NUM=(농협 계좌번호, 숫자만)
BANKDA_SYNC_INTERVAL_MS=300000
BANKDA_ENABLED=true
```

---

## 4. 필요한 기능 — 전체 흐름

### 자동 충전 프로세스

```
[5분마다 자동 실행]
   │
   ▼
① 뱅크다 API 호출 (오늘 날짜 기준 입금 내역 조회)
   │
   ▼
② 응답에서 입금 건만 필터링 (bkinput > 0)
   │
   ▼
③ 각 입금 건에 대해:
   │
   ├─ bkcode로 중복 체크 (이미 처리한 건이면 skip)
   │
   ├─ bankda_transactions 테이블에 저장
   │
   ├─ 입금자명(bkjukyo)으로 members 테이블의 "name"(회원명) 필드를 검색
   │  ※ 주의: 상호명(company_name 등)이 아님!
   │  ※ 회원 가입 시 "회원명(입금자명으로 사용-예치금 자동 충전)" 필드에
   │     한글 6자 이내로 입력한 값이 매칭 기준임
   │     │
   │     ├─ 매칭 1건 → 자동 충전 실행
   │     │    ├─ members.deposit += 입금액
   │     │    ├─ deposit_history에 기록 (type: 'charge', method: 'auto_bankda')
   │     │    └─ match_status = 'matched'
   │     │
   │     ├─ 매칭 0건 → match_status = 'unmatched' (관리자 수동 처리)
   │     │
   │     └─ 매칭 2건+ → match_status = 'duplicate_name' (관리자 수동 처리)
   │
   └─ 완료
```

---

## 5. DB — 새로 만들 테이블

### bankda_transactions

뱅크다에서 가져온 입금 내역을 저장하고, 매칭/충전 상태를 관리하는 테이블입니다.

```sql
CREATE TABLE bankda_transactions (
  id              SERIAL PRIMARY KEY,
  bkcode          VARCHAR(50) UNIQUE NOT NULL,   -- 뱅크다 거래 고유번호 (중복 방지)
  accountnum      VARCHAR(30),                    -- 계좌번호
  bkname          VARCHAR(50),                    -- 은행명
  bkdate          VARCHAR(8),                     -- 거래일자 (YYYYMMDD)
  bktime          VARCHAR(6),                     -- 거래시간 (HHMMSS)
  bkjukyo         VARCHAR(100),                   -- 적요 (입금자명)
  bkcontent       VARCHAR(200),                   -- 내용
  bketc           VARCHAR(200),                   -- 기타
  bkinput         INTEGER DEFAULT 0,              -- 입금액
  bkoutput        INTEGER DEFAULT 0,              -- 출금액
  bkjango         BIGINT DEFAULT 0,               -- 잔액

  -- 매칭 결과
  match_status    VARCHAR(20) DEFAULT 'pending',
  -- pending: 매칭 대기
  -- matched: 매칭 성공, 예치금 충전 완료
  -- unmatched: 매칭되는 회원 없음 (관리자 수동 처리 필요)
  -- duplicate_name: 동명이인 (관리자 수동 처리 필요)
  -- manual: 관리자가 수동 매칭 처리
  -- ignored: 무시 처리 (예치금 대상 아닌 입금)

  matched_member_id INTEGER REFERENCES members(id),
  matched_at      TIMESTAMP,

  -- 충전 결과
  deposit_charged BOOLEAN DEFAULT FALSE,
  deposit_history_id INTEGER,
  charge_error    TEXT,

  -- 관리자 메모
  admin_memo      TEXT,

  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

---

## 6. 관리자 기능

### 6-1. 뱅크다 입금 관리 페이지 (새 메뉴)

위치: 관리자 사이드바 → 정산 하위 → "입금 관리" (또는 "뱅크다 입금")

#### 상단 요약 카드 (4개)
- 오늘 입금: 총 건수 / 총 금액
- 자동 매칭 성공: 건수
- 미매칭 (처리 필요): 건수 (빨간색 뱃지)
- 마지막 동기화: 시간 표시

#### 입금 내역 테이블
- 필터: 전체 / 매칭완료 / 미매칭 / 동명이인 / 무시
- 날짜 범위 선택
- 컬럼: 거래일시, 입금자명, 입금액, 매칭상태, 매칭회원, 충전여부, 액션 버튼

#### 액션 버튼
- **미매칭(unmatched) 건**: [수동 매칭] 버튼 → 회원 검색 팝업 → 회원 선택 → 예치금 충전
- **동명이인(duplicate_name) 건**: [회원 선택] 버튼 → 동명이인 목록 표시 → 선택 → 예치금 충전
- **모든 미처리 건**: [무시] 버튼 → 예치금 대상이 아닌 입금 (업체 대금 등) 무시 처리

#### 수동 동기화 버튼
- 페이지 상단에 [지금 동기화] 버튼 → 즉시 뱅크다 API 호출

### 6-2. 관리자 API

| 엔드포인트 | Method | 설명 |
|-----------|--------|------|
| GET /api/admin/bankda/transactions | GET | 입금 내역 목록 (필터: status, 날짜) |
| GET /api/admin/bankda/summary | GET | 상단 요약 카드 데이터 |
| POST /api/admin/bankda/transactions/:id/manual-match | POST | 수동 매칭 (body: { memberId }) |
| POST /api/admin/bankda/transactions/:id/ignore | POST | 무시 처리 |
| POST /api/admin/bankda/sync | POST | 수동 동기화 트리거 |

---

## 7. 기존 시스템 연동

### deposit_history 테이블 연동
예치금 자동 충전 시 기존 deposit_history에 기록해야 합니다:
- type: 'charge'
- method: 'auto_bankda' (기존 수동 충전과 구분하기 위해)
- amount: 입금액
- description: '뱅크다 자동입금 (입금자: {입금자명})'

### 회원 잔액 업데이트
기존 예치금 충전 로직과 동일하게 members.deposit에 금액을 더합니다.

---

## 8. 회원 쪽 변경

### 회원 예치금 이력 페이지
기존 예치금 이력에서 method가 'auto_bankda'인 경우:
- "자동입금" 또는 "계좌이체 자동확인" 으로 표시
- 기존 수동 충전과 시각적으로 구분

---

## 9. 중요 규칙

1. **중복 충전 절대 방지**: bkcode(거래 고유번호)를 UNIQUE 키로 사용. 같은 거래가 두 번 충전되면 안 됩니다.
2. **입금 건만 처리**: bkinput > 0 인 것만 처리. 출금(bkoutput > 0)은 무시.
3. **입금자명 매칭 기준**: 뱅크다 응답의 `bkjukyo`(입금자명)를 members 테이블의 `name`(회원명) 필드와 매칭합니다.
   - 회원명은 "입금자명으로 사용 — 예치금 자동 충전" 용도로, 한글 6자 이내입니다.
   - 상호명(company_name)으로 매칭하면 안 됩니다.
   - 매칭 시 공백 제거 후 비교합니다 (은행에서 공백이 추가/제거될 수 있음).
4. **동명이인 안전장치**: 같은 이름의 회원이 2명 이상이면 자동 충전하지 않고 관리자 수동 처리.
5. **5분 주기 호출**: 뱅크다 API가 5분 제한이 있으므로 5분 간격으로 호출.
6. **에러 처리**: API 호출 실패, 매칭 실패, 충전 실패 시 에러를 기록하고 다음 건으로 넘어가야 합니다. 한 건 실패가 전체를 멈추면 안 됩니다.
7. **ON/OFF 제어**: 환경변수 BANKDA_ENABLED=false로 기능을 끌 수 있어야 합니다.
