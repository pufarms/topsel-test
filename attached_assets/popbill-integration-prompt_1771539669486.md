# 팝빌 전자세금계산서 API 연동 - Replit 프롬프트

> 이 프롬프트는 기존 매출 요약 탭의 수동 발행 버튼에 팝빌 API를 연동하여 실제 세금계산서/계산서를 발행하는 기능을 구현합니다.

---

## 🔑 1단계: 환경변수 설정 (Secrets)

Replit Secrets에 아래 값들을 등록해주세요:

```
POPBILL_LINK_ID=HYUN
POPBILL_SECRET_KEY=Mrg9Xw+GJMTRQGputUkqExWRqTfdkio86647FsHmbAE=
POPBILL_CORP_NUM=8178802684
POPBILL_USER_ID=kgong5026@gmail.com
POPBILL_IS_TEST=true
```

> ⚠️ 코드에 직접 API Key를 하드코딩하지 마세요. 반드시 환경변수로 관리합니다.

---

## 📦 2단계: SDK 설치

```bash
npm install popbill
```

---

## ⚙️ 3단계: 팝빌 서비스 초기화 모듈 생성

`server/lib/popbill.ts` (또는 .js) 파일을 새로 생성합니다.

```javascript
// server/lib/popbill.ts
// 팝빌 전자세금계산서 서비스 초기화

const popbill = require('popbill');

// ===== 환경변수에서 API Key 로드 =====
const LinkID = process.env.POPBILL_LINK_ID;          // 'HYUN'
const SecretKey = process.env.POPBILL_SECRET_KEY;     // 비밀키
const IsTest = process.env.POPBILL_IS_TEST === 'true'; // true: 테스트, false: 운영

// ===== 전자세금계산서 서비스 객체 생성 =====
const taxinvoiceService = popbill.TaxinvoiceService(LinkID, SecretKey);

// ===== Replit 환경 필수 설정 =====
// Replit은 서버 IP가 유동적이므로 IP 검증을 비활성화해야 합니다.
taxinvoiceService.IsTest = IsTest;
taxinvoiceService.IPRestrictOnOff = false;  // ⚠️ 필수! Replit은 IP가 변경됨
taxinvoiceService.UseStaticIP = false;      // 고정 IP 미사용
taxinvoiceService.UseLocalTimeYN = true;    // 로컬시간 사용

module.exports = { taxinvoiceService };
```

### 중요 설정 설명:
- `IPRestrictOnOff = false` → Replit은 배포 시 서버 IP가 변경되므로, Token 발급 IP와 API 호출 IP 일치 검증을 비활성화해야 합니다. 이 설정이 없으면 "-99999905 인증토큰이 만료되었습니다" 오류가 발생합니다.
- `UseStaticIP = false` → 고정 IP 엔드포인트를 사용하지 않습니다.
- `UseLocalTimeYN = true` → 서버 로컬 시간 기준으로 처리합니다.

---

## 🧾 4단계: 세금계산서 발행 API 라우트 생성

기존 매출 요약 탭의 발행 버튼과 연동할 API 엔드포인트를 생성합니다.

### 4-1. 즉시 발행 API (RegistIssue)

`server/routes/popbill-invoice.ts` (또는 기존 accounting 라우트에 추가)

```javascript
const { taxinvoiceService } = require('../lib/popbill');

// ===== 세금계산서/계산서 즉시 발행 =====
// POST /api/admin/accounting/popbill-issue
router.post('/popbill-issue', requireAdmin, async (req, res) => {
  try {
    const {
      targetType,      // 'member' 또는 'vendor'
      targetId,
      targetName,
      businessNumber,  // 공급받는자 사업자번호 ('-' 제외 10자리)
      invoiceType,     // 'exempt'(면세=계산서), 'taxable'(과세=세금계산서)
      year,
      month,
      orderIds,        // 발행 대상 주문 ID 배열
      memo
    } = req.body;

    // 1. 서버에서 금액 재계산 (클라이언트 값 불신 - 기존 로직 활용)
    const amounts = await recalculateAmounts(orderIds, invoiceType);
    // amounts = { supplyAmount, vatAmount, totalAmount }

    // 2. 중복 발행 체크 (기존 로직 활용)
    const duplicateCheck = await checkDuplicateInvoice(orderIds);
    if (duplicateCheck.hasDuplicate) {
      return res.status(400).json({
        error: `이미 발행된 주문이 ${duplicateCheck.count}건 포함되어 있습니다.`
      });
    }

    // 3. 팝빌 사업자번호 (공급자 = 우리 회사)
    const CorpNum = process.env.POPBILL_CORP_NUM; // '8178802684'

    // 4. 문서번호 생성 (중복 방지)
    // 형식: YYYYMM-타입-대상ID-타임스탬프
    const MgtKey = `${year}${String(month).padStart(2, '0')}-${invoiceType === 'exempt' ? 'EX' : 'TX'}-${Date.now()}`;

    // 5. 세금계산서 객체 생성
    const taxinvoice = {
      // === 문서 기본 정보 ===
      writeDate: formatDate(new Date()),           // 작성일자 (yyyyMMdd)
      issueType: '정발행',                          // 발행유형
      taxType: invoiceType === 'exempt' ? '면세' : '과세',  // 과세형태

      // 면세인 경우 chargeDirection 설정
      // 과세: 세금계산서, 면세: 계산서
      chargeDirection: '정과금',                    // 공급자 과금

      // === 공급자 정보 (우리 회사) ===
      invoicerCorpNum: CorpNum,                    // 공급자 사업자번호
      invoicerTaxRegID: '',                         // 종사업장 식별번호
      invoicerCorpName: '탑셀러',                   // ⚠️ 실제 상호명으로 변경
      invoicerCEOName: '',                          // ⚠️ 실제 대표자명으로 변경
      invoicerAddr: '',                             // ⚠️ 실제 사업장 주소
      invoicerBizType: '',                          // ⚠️ 업태
      invoicerBizClass: '',                         // ⚠️ 종목
      invoicerContactName: '',                      // 담당자 이름
      invoicerEmail: '',                            // 담당자 이메일
      invoicerTEL: '',                              // 담당자 전화번호

      // === 공급받는자 정보 (회원/매입업체) ===
      invoiceeType: '사업자',                       // 사업자 유형
      invoiceeCorpNum: businessNumber,              // 공급받는자 사업자번호
      invoiceeCorpName: targetName,                 // 공급받는자 상호
      invoiceeCEOName: '',                          // ⚠️ DB에서 조회하여 채울 것
      invoiceeAddr: '',                             // ⚠️ DB에서 조회하여 채울 것
      invoiceeBizType: '',                          // 업태
      invoiceeBizClass: '',                         // 종목
      invoiceeEmail: '',                            // ⚠️ DB에서 조회 - 발행 메일 수신 주소

      // === 금액 정보 ===
      supplyCostTotal: String(amounts.supplyAmount),  // 공급가액 합계
      taxTotal: String(amounts.vatAmount),             // 세액 합계
      totalAmount: String(amounts.totalAmount),        // 합계금액

      // === 품목 정보 (최대 99개) ===
      // 월별 일괄 발행이므로 품목 1건으로 요약
      detailList: [
        {
          serialNum: 1,                               // 일련번호
          itemName: `${year}년 ${month}월 공급분`,     // 품목명
          supplyCost: String(amounts.supplyAmount),    // 공급가액
          tax: String(amounts.vatAmount),              // 세액
          remark: `주문 ${orderIds.length}건`,          // 비고
        }
      ],

      // === 추가 정보 ===
      remark1: memo || `${year}년 ${month}월분 ${invoiceType === 'exempt' ? '계산서' : '세금계산서'}`,
    };

    // 6. 팝빌 즉시 발행 호출
    const result = await new Promise((resolve, reject) => {
      taxinvoiceService.registIssue(
        CorpNum,                // 공급자 사업자번호
        taxinvoice,             // 세금계산서 객체
        false,                  // forceIssue (지연발행 강제 여부)
        memo || '',             // 메모
        false,                  // writeSpecification (전자거래명세서 동시작성)
        '',                     // dealInvoiceMgtKey
        '',                     // emailSubject (빈값 = 기본 양식)
        MgtKey,                 // 문서번호 (관리키)
        function(result) {      // 성공 콜백
          resolve(result);
        },
        function(error) {       // 실패 콜백
          reject(error);
        }
      );
    });

    // 7. 발행 성공 → invoice_records에 기록
    const invoiceRecord = await db.query(`
      INSERT INTO invoice_records (
        target_type, target_id, target_name, business_number,
        invoice_type, year, month, order_ids, order_count,
        supply_amount, vat_amount, total_amount,
        is_auto_issued, memo, issued_at, issued_by,
        popbill_mgt_key, popbill_nts_confirm_num
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), $15, $16, $17)
      RETURNING *
    `, [
      targetType, targetId, targetName, businessNumber,
      invoiceType, year, month, JSON.stringify(orderIds), orderIds.length,
      amounts.supplyAmount, amounts.vatAmount, amounts.totalAmount,
      false, memo, req.user.name,
      MgtKey, result.ntsConfirmNum || null
    ]);

    res.json({
      success: true,
      message: '계산서 발행이 완료되었습니다.',
      data: {
        invoiceId: invoiceRecord.rows[0].id,
        mgtKey: MgtKey,
        ntsConfirmNum: result.ntsConfirmNum,  // 국세청 승인번호
        code: result.code,
        message: result.message
      }
    });

  } catch (error) {
    console.error('팝빌 발행 오류:', error);

    // 팝빌 오류 코드 매핑
    const errorMessage = getPopbillErrorMessage(error.code || error);

    res.status(500).json({
      success: false,
      error: errorMessage,
      code: error.code
    });
  }
});

// ===== 발행 취소 API =====
// POST /api/admin/accounting/popbill-cancel
router.post('/popbill-cancel', requireAdmin, async (req, res) => {
  try {
    const { invoiceId, mgtKey, reason } = req.body;
    const CorpNum = process.env.POPBILL_CORP_NUM;

    // 팝빌 발행 취소 호출
    const result = await new Promise((resolve, reject) => {
      taxinvoiceService.cancelIssue(
        CorpNum,
        popbill.MgtKeyType.SELL,  // 매출 문서
        mgtKey,
        reason || '발행 취소',
        function(result) { resolve(result); },
        function(error) { reject(error); }
      );
    });

    // invoice_records 업데이트
    await db.query(`
      UPDATE invoice_records
      SET cancelled_at = NOW(), cancel_reason = $1
      WHERE id = $2
    `, [reason, invoiceId]);

    res.json({ success: true, message: '발행이 취소되었습니다.' });

  } catch (error) {
    console.error('팝빌 취소 오류:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== 발행 상태 조회 API =====
// GET /api/admin/accounting/popbill-status/:mgtKey
router.get('/popbill-status/:mgtKey', requireAdmin, async (req, res) => {
  try {
    const CorpNum = process.env.POPBILL_CORP_NUM;
    const { mgtKey } = req.params;

    const result = await new Promise((resolve, reject) => {
      taxinvoiceService.getInfo(
        CorpNum,
        popbill.MgtKeyType.SELL,
        mgtKey,
        function(result) { resolve(result); },
        function(error) { reject(error); }
      );
    });

    res.json({ success: true, data: result });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== 세금계산서 인쇄/미리보기 URL =====
// GET /api/admin/accounting/popbill-popup/:mgtKey
router.get('/popbill-popup/:mgtKey', requireAdmin, async (req, res) => {
  try {
    const CorpNum = process.env.POPBILL_CORP_NUM;
    const UserID = process.env.POPBILL_USER_ID;
    const { mgtKey } = req.params;

    const url = await new Promise((resolve, reject) => {
      taxinvoiceService.getPopUpURL(
        CorpNum,
        popbill.MgtKeyType.SELL,
        mgtKey,
        UserID,
        function(result) { resolve(result); },
        function(error) { reject(error); }
      );
    });

    res.json({ success: true, url });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== 팝빌 오류 메시지 매핑 =====
function getPopbillErrorMessage(code) {
  const errorMap = {
    '-99999905': '인증토큰이 만료되었습니다. IPRestrictOnOff 설정을 확인하세요.',
    '-11000020': '공동인증서가 등록되지 않았습니다. 팝빌에서 인증서를 등록해주세요.',
    '-12000004': '이미 등록된 문서번호입니다.',
    '-12000009': '공급받는자 사업자번호가 유효하지 않습니다.',
    '-20000013': '포인트가 부족합니다. 팝빌에서 포인트를 충전해주세요.',
  };
  return errorMap[String(code)] || `팝빌 오류 (코드: ${code})`;
}

// ===== 날짜 포맷 함수 =====
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}
```

---

## 🗃️ 5단계: DB 스키마 업데이트

기존 `invoice_records` 테이블에 팝빌 관련 컬럼을 추가합니다.

```sql
-- 팝빌 연동 컬럼 추가
ALTER TABLE invoice_records
  ADD COLUMN IF NOT EXISTS popbill_mgt_key VARCHAR(50),
  ADD COLUMN IF NOT EXISTS popbill_nts_confirm_num VARCHAR(50),
  ADD COLUMN IF NOT EXISTS popbill_issue_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- popbill_issue_status 값: 'pending', 'issued', 'failed', 'cancelled'
```

---

## 🖥️ 6단계: 프론트엔드 발행 버튼 연동

기존 매출 요약 탭의 "발행" 버튼 클릭 핸들러를 수정합니다.

기존 발행 다이얼로그에서 "발행" 버튼 클릭 시:

```javascript
// 기존: invoice_records에만 기록
// 변경: 팝빌 API 호출 → 실제 발행 → invoice_records에 기록

async function handleIssueInvoice(invoiceData) {
  try {
    setLoading(true);

    const response = await fetch('/api/admin/accounting/popbill-issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: invoiceData.type,
        targetId: invoiceData.targetId,
        targetName: invoiceData.targetName,
        businessNumber: invoiceData.businessNumber,
        invoiceType: invoiceData.invoiceType,  // 'exempt' 또는 'taxable'
        year: selectedYear,
        month: selectedMonth,
        orderIds: invoiceData.orderIds,
        memo: invoiceData.memo
      })
    });

    const result = await response.json();

    if (result.success) {
      // 성공: 국세청 승인번호 표시
      toast.success(`발행 완료! 국세청 승인번호: ${result.data.ntsConfirmNum}`);
      refreshTable();  // 테이블 갱신
    } else {
      toast.error(`발행 실패: ${result.error}`);
    }

  } catch (error) {
    toast.error('발행 중 오류가 발생했습니다.');
    console.error(error);
  } finally {
    setLoading(false);
  }
}
```

---

## ✅ 7단계: 테스트 체크리스트

SDK 설치 및 연동 후 아래 순서로 테스트합니다:

### 테스트 1: SDK 연결 확인
```javascript
// 팝빌 잔여 포인트 조회 (가장 간단한 API)
taxinvoiceService.getBalance(CorpNum,
  function(result) { console.log('잔여 포인트:', result); },
  function(error) { console.error('연결 오류:', error); }
);
```
→ 포인트 잔액이 반환되면 SDK 연결 성공

### 테스트 2: 테스트 세금계산서 발행
- 테스트 환경이므로 실제 국세청 전송 안 됨
- 공급받는자 사업자번호: 아무 10자리 숫자 가능 (테스트)
- 발행 후 https://test.popbill.com 에서 확인 가능

### 테스트 3: 기존 기능과의 연동 확인
- 매출 요약 탭에서 "발행" 버튼 클릭 → 팝빌 API 호출 → invoice_records 기록
- 이미 발행된 건 재발행 시도 → 중복 차단 확인
- 발행 취소 → 상태 변경 확인

---

## ⚠️ 주의사항

### Replit 환경 특이사항
1. **IP 검증 반드시 비활성화**: `IPRestrictOnOff = false` (없으면 토큰 오류)
2. **환경변수 관리**: Secrets에 API Key 저장 (코드에 하드코딩 금지)
3. **테스트 ↔ 운영 전환**: `POPBILL_IS_TEST` 환경변수만 변경

### 세금계산서 발행 규칙
1. **면세(exempt) = 계산서**: 농산물 원물, 부가세 없음
2. **과세(taxable) = 세금계산서**: 가공품/부자재, 부가세 10%
3. **포인터 사용액은 발행 제외**: 예치금 결제분만 발행 대상
4. **서버 측 금액 재계산 필수**: 클라이언트 전송 금액은 무시

### 공급자 정보 (⚠️ 반드시 실제 정보로 변경)
코드의 공급자 정보(invoicerCorpName, invoicerCEOName 등)를
실제 사업자등록증 기준 정보로 변경해야 합니다.

---

## 📋 구현 순서 요약

```
1. Secrets에 환경변수 등록 (LinkID, SecretKey, CorpNum, UserID)
2. npm install popbill
3. server/lib/popbill.ts 생성 (서비스 초기화)
4. 잔여 포인트 조회로 SDK 연결 테스트
5. invoice_records 테이블에 팝빌 컬럼 추가
6. 발행 API 라우트 생성 (popbill-issue, popbill-cancel, popbill-status)
7. 기존 매출 요약 탭 발행 버튼에 팝빌 API 연결
8. 테스트 세금계산서 발행 및 확인
```
