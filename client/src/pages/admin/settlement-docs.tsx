import { Button } from "@/components/ui/button";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function SettlementDocs() {
  const [, setLocation] = useLocation();

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-content { 
            max-width: 100% !important; 
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-content h1 { font-size: 22pt !important; }
          .print-content h2 { font-size: 16pt !important; break-before: auto; }
          .print-content h3 { font-size: 13pt !important; }
          .print-content p, .print-content li, .print-content td { font-size: 10pt !important; }
          .print-content table { page-break-inside: avoid; }
          .section-block { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-[9999] bg-background border-b p-3 flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/admin/settlements")} data-testid="button-back-settlements">
          <ArrowLeft className="h-4 w-4 mr-1" />뒤로가기
        </Button>
        <div className="flex-1" />
        <Button onClick={handlePrint} data-testid="button-download-pdf">
          <Download className="h-4 w-4 mr-1" />PDF 다운로드 / 인쇄
        </Button>
      </div>

      <div className="print-content max-w-4xl mx-auto p-6 md:p-10 space-y-8 text-sm leading-relaxed">
        <header className="text-center border-b pb-6 mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">회원 정산 시스템 매뉴얼</h1>
          <p className="text-muted-foreground">Topsel 주문관리 플랫폼 - 정산 프로세스 전체 문서</p>
          <p className="text-xs text-muted-foreground mt-1">문서 버전: 1.0 | 최종 갱신: 2026-02-09</p>
        </header>

        <nav className="section-block border rounded-md p-4 bg-muted/30">
          <h2 className="text-lg font-bold mb-3">목차</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li><a href="#section-1" className="hover:underline">정산 시스템 개요</a></li>
            <li><a href="#section-2" className="hover:underline">잔액 구조 (예치금 / 포인터)</a></li>
            <li><a href="#section-3" className="hover:underline">사용 가능 잔액 계산 로직</a></li>
            <li><a href="#section-4" className="hover:underline">주문 등록 시 잔액 검증</a></li>
            <li><a href="#section-5" className="hover:underline">자동 정산 프로세스 (배송중 전환)</a></li>
            <li><a href="#section-6" className="hover:underline">관리자 정산 관리 기능</a></li>
            <li><a href="#section-7" className="hover:underline">회원 정산 조회 기능</a></li>
            <li><a href="#section-8" className="hover:underline">데이터베이스 테이블 구조</a></li>
            <li><a href="#section-9" className="hover:underline">API 엔드포인트 목록</a></li>
            <li><a href="#section-10" className="hover:underline">UI/UX 알림 시스템</a></li>
            <li><a href="#section-11" className="hover:underline">가격 확정 워크플로우</a></li>
            <li><a href="#section-12" className="hover:underline">오류 처리 및 예외 상황</a></li>
          </ol>
        </nav>

        {/* Section 1 */}
        <section id="section-1" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">1. 정산 시스템 개요</h2>
          <p>
            Topsel 정산 시스템은 회원(셀러)의 주문에 대한 비용을 <strong>예치금</strong>과 <strong>포인터</strong>로 관리하는 선불 정산 체계입니다.
            회원이 주문을 등록하면 잔액이 검증되고, 주문이 "배송중" 상태로 전환될 때 자동으로 비용이 차감됩니다.
          </p>
          <div className="border rounded-md p-4 bg-muted/20">
            <h3 className="font-semibold mb-2">전체 흐름 요약</h3>
            <div className="space-y-1 text-xs md:text-sm font-mono">
              <p>① 관리자: 예치금 충전 / 포인터 지급</p>
              <p className="pl-6">↓</p>
              <p>② 회원: 엑셀 파일로 주문 업로드</p>
              <p className="pl-6">↓ (잔액 검증)</p>
              <p>③ 주문 상태: 대기 → 상품준비중 → 배송준비중</p>
              <p className="pl-6">↓</p>
              <p>④ 관리자: "배송중 전환" 실행</p>
              <p className="pl-6">↓ (자동 정산: 포인터 우선 차감 → 예치금 차감)</p>
              <p>⑤ 주문 상태: 배송중 (가격 확정, 정산 완료)</p>
              <p className="pl-6">↓</p>
              <p>⑥ 정산/예치금/포인터 이력 기록 완료</p>
            </div>
          </div>
        </section>

        {/* Section 2 */}
        <section id="section-2" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">2. 잔액 구조 (예치금 / 포인터)</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs md:text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2 text-left">항목</th>
                  <th className="border p-2 text-left">예치금 (Deposit)</th>
                  <th className="border p-2 text-left">포인터 (Point)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2 font-medium">충전 방식</td>
                  <td className="border p-2">계좌이체 후 관리자가 수동 충전</td>
                  <td className="border p-2">관리자가 직접 지급</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">사용 용도</td>
                  <td className="border p-2">주문 정산 시 차감</td>
                  <td className="border p-2">주문 정산 시 우선 차감</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">차감 우선순위</td>
                  <td className="border p-2">2순위 (포인터 부족분 차감)</td>
                  <td className="border p-2">1순위 (포인터 먼저 차감)</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">환급 가능</td>
                  <td className="border p-2">가능 (관리자 환급 처리)</td>
                  <td className="border p-2">불가</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">DB 필드</td>
                  <td className="border p-2 font-mono text-xs">members.deposit</td>
                  <td className="border p-2 font-mono text-xs">members.point</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 */}
        <section id="section-3" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">3. 사용 가능 잔액 계산 로직</h2>
          
          <div className="border rounded-md p-4 bg-muted/20">
            <h3 className="font-semibold mb-2">계산 공식</h3>
            <p className="font-mono text-center text-base p-3 bg-background rounded border">
              사용가능잔액 = (예치금 + 포인터) - 진행중 주문 총액
            </p>
          </div>

          <h3 className="font-semibold mt-4">진행중 주문이란?</h3>
          <p>아직 정산이 완료되지 않은 주문, 즉 다음 상태에 있는 주문들의 총 금액을 의미합니다:</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li><strong>대기</strong> - 주문 접수 완료, 조정 단계</li>
            <li><strong>상품준비중</strong> - 운송장 출력 단계</li>
            <li><strong>배송준비중</strong> - 회원 취소건 접수 단계</li>
          </ul>

          <h3 className="font-semibold mt-4">가격 결정 방식 (진행중 주문)</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs md:text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2 text-left">조건</th>
                  <th className="border p-2 text-left">가격 소스</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2">가격 확정된 주문 (priceConfirmed=true)</td>
                  <td className="border p-2">저장된 supplyPrice 사용</td>
                </tr>
                <tr>
                  <td className="border p-2">미확정이지만 supplyPrice 존재</td>
                  <td className="border p-2">저장된 supplyPrice 사용</td>
                </tr>
                <tr>
                  <td className="border p-2">supplyPrice 미설정</td>
                  <td className="border p-2">현재공급가(current_products) 테이블에서 등급별 가격 조회</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold mt-4">회원 등급별 공급가 매핑</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs md:text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">회원 등급</th>
                  <th className="border p-2">적용 가격 필드</th>
                  <th className="border p-2">주문 가능 여부</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2 text-center">START</td>
                  <td className="border p-2 font-mono text-xs">startPrice</td>
                  <td className="border p-2 text-center text-green-600">가능</td>
                </tr>
                <tr>
                  <td className="border p-2 text-center">DRIVING</td>
                  <td className="border p-2 font-mono text-xs">drivingPrice</td>
                  <td className="border p-2 text-center text-green-600">가능</td>
                </tr>
                <tr>
                  <td className="border p-2 text-center">TOP</td>
                  <td className="border p-2 font-mono text-xs">topPrice</td>
                  <td className="border p-2 text-center text-green-600">가능</td>
                </tr>
                <tr>
                  <td className="border p-2 text-center">ASSOCIATE</td>
                  <td className="border p-2 font-mono text-xs">startPrice (기본)</td>
                  <td className="border p-2 text-center text-red-500">불가 (403)</td>
                </tr>
                <tr>
                  <td className="border p-2 text-center">PENDING</td>
                  <td className="border p-2 font-mono text-xs">startPrice (기본)</td>
                  <td className="border p-2 text-center text-red-500">불가 (403)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4 */}
        <section id="section-4" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">4. 주문 등록 시 잔액 검증</h2>
          
          <h3 className="font-semibold">검증 시점</h3>
          <p>회원이 엑셀 파일을 업로드하여 주문을 등록할 때 서버에서 잔액을 검증합니다.</p>
          
          <h3 className="font-semibold mt-4">검증 프로세스 (순서대로)</h3>
          <ol className="list-decimal list-inside space-y-2 pl-4">
            <li><strong>회원 등급 확인</strong>: START, DRIVING, TOP만 주문 등록 가능</li>
            <li><strong>엑셀 파일 파싱</strong>: .xlsx, .xls 파일 읽기</li>
            <li><strong>중복 확인</strong>: 주문번호 중복 체크</li>
            <li><strong>상품 검증</strong>: 현재공급가(current_products) 테이블에서 상품코드 존재 확인, 공급중지 상품 차단</li>
            <li><strong>잔액 검증</strong>: 정상건 총 주문금액 vs 사용가능잔액 비교</li>
            <li><strong>주소 검증</strong>: 수령인 주소 유효성 검사 (행정안전부 API + AI)</li>
            <li><strong>결과 반환</strong>: 검증 결과에 따른 응답</li>
          </ol>

          <h3 className="font-semibold mt-4">잔액 부족 시 응답 케이스</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs md:text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">케이스</th>
                  <th className="border p-2">조건</th>
                  <th className="border p-2">결과</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2 font-medium">A</td>
                  <td className="border p-2">상품 오류만, 잔액 OK</td>
                  <td className="border p-2">오류 다이얼로그 + 잔액 확인 블록(초록)</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">B</td>
                  <td className="border p-2">잔액 부족만</td>
                  <td className="border p-2">잔액 부족 전용 다이얼로그</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">C</td>
                  <td className="border p-2">오류 + 잔액 부족</td>
                  <td className="border p-2">복합 다이얼로그 (등록 불가)</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">D</td>
                  <td className="border p-2">오류 있지만 정상건 잔액 OK</td>
                  <td className="border p-2">오류 + "정상건만 등록" 버튼</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">G</td>
                  <td className="border p-2">부분 성공</td>
                  <td className="border p-2">토스트에 정산 정보 한 줄 추가</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold mt-4">잔액 배너 (주문등록 화면 상단)</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs md:text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">잔액 수준</th>
                  <th className="border p-2">배너 색상</th>
                  <th className="border p-2">안내 메시지</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2">10만원 이상</td>
                  <td className="border p-2">파란색 배경</td>
                  <td className="border p-2">정상 (별도 메시지 없음)</td>
                </tr>
                <tr>
                  <td className="border p-2">5만원 미만</td>
                  <td className="border p-2">주황색 배경</td>
                  <td className="border p-2">"잔액이 적습니다"</td>
                </tr>
                <tr>
                  <td className="border p-2">0원 이하</td>
                  <td className="border p-2">빨간색 배경</td>
                  <td className="border p-2">"예치금 충전 후 주문 가능합니다"</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5 */}
        <section id="section-5" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">5. 자동 정산 프로세스 (배송중 전환)</h2>
          
          <p>관리자가 "배송중 전환" 버튼을 클릭하면, 선택된 주문들에 대해 <strong>자동 정산</strong>이 실행됩니다.</p>

          <h3 className="font-semibold mt-4">정산 실행 흐름</h3>
          <div className="border rounded-md p-4 bg-muted/20 space-y-2 text-xs md:text-sm font-mono">
            <p>1. 대상 주문 조회 (배송준비중 → 배송중 전환 대상)</p>
            <p>2. 회원별 주문 그룹핑</p>
            <p>3. 회원별 순차 정산 시작 (DB 트랜잭션)</p>
            <p className="pl-4">3-1. 회원 잔액 행 잠금 (SELECT ... FOR UPDATE)</p>
            <p className="pl-4">3-2. 주문별 확정 가격 계산 (등급별 현재공급가)</p>
            <p className="pl-4">3-3. 잔액 충분 여부 확인</p>
            <p className="pl-8">• 충분: 차감 진행</p>
            <p className="pl-8">• 부족: 해당 주문부터 실패, 이전 정상건만 반영</p>
            <p className="pl-4">3-4. 차감 순서: 포인터 우선 → 예치금</p>
            <p className="pl-4">3-5. 주문 상태 변경: "배송중" + priceConfirmed=true</p>
            <p className="pl-4">3-6. 이력 기록 (settlement_history, pointer_history, deposit_history)</p>
            <p className="pl-4">3-7. 자체발송 상품인 경우 재고 차감 (product_stocks)</p>
            <p className="pl-4">3-8. 회원 잔액 업데이트 (members.deposit, members.point)</p>
            <p>4. 트랜잭션 커밋</p>
            <p>5. SSE 이벤트 발송 (실시간 UI 업데이트)</p>
          </div>

          <h3 className="font-semibold mt-4">차감 순서 상세 (핵심 로직)</h3>
          <div className="border rounded-md p-4 bg-muted/20">
            <p className="mb-2">예시: 주문 금액 15,000원 / 포인터 잔액 10,000P / 예치금 잔액 50,000원</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border text-xs md:text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="border p-2">단계</th>
                    <th className="border p-2">항목</th>
                    <th className="border p-2">금액</th>
                    <th className="border p-2">잔액</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">1</td>
                    <td className="border p-2">포인터 차감 (우선)</td>
                    <td className="border p-2">-10,000P</td>
                    <td className="border p-2">포인터: 0P</td>
                  </tr>
                  <tr>
                    <td className="border p-2">2</td>
                    <td className="border p-2">예치금 차감 (부족분)</td>
                    <td className="border p-2">-5,000원</td>
                    <td className="border p-2">예치금: 45,000원</td>
                  </tr>
                  <tr className="bg-muted/30">
                    <td className="border p-2" colSpan={2}>최종 정산 완료</td>
                    <td className="border p-2">총 15,000원</td>
                    <td className="border p-2">사용가능: 45,000원</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <h3 className="font-semibold mt-4">잔액 부족 시 처리</h3>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>한 회원의 주문을 순차 처리하다가 잔액이 부족해지면, <strong>해당 주문부터 실패</strong> 처리</li>
            <li>이전까지 정상 처리된 주문들은 정상적으로 "배송중" 전환 완료</li>
            <li>실패한 주문들은 기존 상태 유지</li>
            <li>응답에 실패 내역 포함: 회원명, 미처리 건수, 부족 금액</li>
          </ul>

          <h3 className="font-semibold mt-4">트랜잭션 보장</h3>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li><strong>행 잠금 (FOR UPDATE)</strong>: 동시 접근 방지, 회원 잔액 정합성 보장</li>
            <li>회원 단위 트랜잭션: 한 회원의 모든 주문이 하나의 트랜잭션으로 처리</li>
            <li>트랜잭션 실패 시 해당 회원의 모든 주문 롤백, 다른 회원은 영향 없음</li>
          </ul>
        </section>

        {/* Section 6 */}
        <section id="section-6" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">6. 관리자 정산 관리 기능</h2>
          
          <h3 className="font-semibold">6.1 예치금 충전</h3>
          <div className="pl-4 space-y-1">
            <p><strong>경로</strong>: 관리자 &gt; 정산관리 &gt; 예치금 충전</p>
            <p><strong>프로세스</strong>: 회원 선택 → 금액 입력 → 설명 입력 → 충전 실행</p>
            <p><strong>처리</strong>: 트랜잭션으로 members.deposit 증가 + deposit_history 기록</p>
          </div>

          <h3 className="font-semibold mt-4">6.2 예치금 환급</h3>
          <div className="pl-4 space-y-1">
            <p><strong>경로</strong>: 관리자 &gt; 정산관리 &gt; 예치금 환급</p>
            <p><strong>프로세스</strong>: 회원 선택 → 금액 입력 → 설명 입력 → 환급 실행</p>
            <p><strong>검증</strong>: 환급 금액 &le; 현재 예치금 (초과 시 거부)</p>
            <p><strong>처리</strong>: 트랜잭션으로 members.deposit 감소 + deposit_history 기록</p>
          </div>

          <h3 className="font-semibold mt-4">6.3 포인터 지급</h3>
          <div className="pl-4 space-y-1">
            <p><strong>경로</strong>: 관리자 &gt; 정산관리 &gt; 포인터 지급</p>
            <p><strong>프로세스</strong>: 회원 선택 → 금액 입력 → 설명 입력 → 지급 실행</p>
            <p><strong>처리</strong>: 트랜잭션으로 members.point 증가 + pointer_history 기록</p>
          </div>

          <h3 className="font-semibold mt-4">6.4 이력 조회</h3>
          <div className="pl-4 space-y-1">
            <p>관리자 페이지에서 3개의 이력 탭 제공:</p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li><strong>정산 이력</strong>: 자동/수동 정산 내역 (주문별 포인터/예치금 차감액, 잔액)</li>
              <li><strong>예치금 이력</strong>: 충전/환급/차감 내역</li>
              <li><strong>포인터 이력</strong>: 지급/차감/만료 내역</li>
            </ul>
            <p className="mt-2">모든 이력은 날짜 범위, 회원, 유형으로 필터링 가능. 페이지네이션 지원 (30건/페이지).</p>
          </div>

          <h3 className="font-semibold mt-4">6.5 회원 잔액 현황</h3>
          <div className="pl-4 space-y-1">
            <p>START/DRIVING/TOP 등급 회원의 예치금, 포인터 현황 조회</p>
            <p>회원별 상세 잔액 조회 시 사용가능잔액(진행중 주문 차감) 계산 결과 제공</p>
          </div>
        </section>

        {/* Section 7 */}
        <section id="section-7" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">7. 회원 정산 조회 기능</h2>
          
          <p>회원(셀러) 대시보드의 "예치금충전" 탭에서 다음 정보를 확인할 수 있습니다:</p>
          
          <h3 className="font-semibold mt-3">잔액 현황</h3>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>예치금 잔액</li>
            <li>포인터 잔액</li>
            <li>진행중 주문 총액</li>
            <li>사용 가능 잔액</li>
          </ul>

          <h3 className="font-semibold mt-3">이력 조회 (3개 탭)</h3>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li><strong>정산 이력</strong>: 본인의 주문별 정산 내역</li>
            <li><strong>예치금 이력</strong>: 충전/차감 내역</li>
            <li><strong>포인터 이력</strong>: 지급/차감 내역</li>
          </ul>
        </section>

        {/* Section 8 */}
        <section id="section-8" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">8. 데이터베이스 테이블 구조</h2>
          
          <h3 className="font-semibold">8.1 settlement_history (정산 이력)</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">컬럼</th>
                  <th className="border p-2">타입</th>
                  <th className="border p-2">설명</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-1 font-mono">id</td><td className="border p-1">varchar (UUID)</td><td className="border p-1">PK</td></tr>
                <tr><td className="border p-1 font-mono">member_id</td><td className="border p-1">varchar</td><td className="border p-1">회원 ID (FK)</td></tr>
                <tr><td className="border p-1 font-mono">order_id</td><td className="border p-1">varchar</td><td className="border p-1">주문 ID</td></tr>
                <tr><td className="border p-1 font-mono">settlement_type</td><td className="border p-1">text</td><td className="border p-1">"auto" 또는 "manual"</td></tr>
                <tr><td className="border p-1 font-mono">pointer_amount</td><td className="border p-1">integer</td><td className="border p-1">포인터 차감액</td></tr>
                <tr><td className="border p-1 font-mono">deposit_amount</td><td className="border p-1">integer</td><td className="border p-1">예치금 차감액</td></tr>
                <tr><td className="border p-1 font-mono">total_amount</td><td className="border p-1">integer</td><td className="border p-1">총 정산 금액</td></tr>
                <tr><td className="border p-1 font-mono">pointer_balance</td><td className="border p-1">integer</td><td className="border p-1">정산 후 포인터 잔액</td></tr>
                <tr><td className="border p-1 font-mono">deposit_balance</td><td className="border p-1">integer</td><td className="border p-1">정산 후 예치금 잔액</td></tr>
                <tr><td className="border p-1 font-mono">description</td><td className="border p-1">text</td><td className="border p-1">설명</td></tr>
                <tr><td className="border p-1 font-mono">created_at</td><td className="border p-1">timestamp</td><td className="border p-1">생성일시</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold mt-4">8.2 deposit_history (예치금 이력)</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">컬럼</th>
                  <th className="border p-2">타입</th>
                  <th className="border p-2">설명</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-1 font-mono">id</td><td className="border p-1">varchar (UUID)</td><td className="border p-1">PK</td></tr>
                <tr><td className="border p-1 font-mono">member_id</td><td className="border p-1">varchar</td><td className="border p-1">회원 ID (FK)</td></tr>
                <tr><td className="border p-1 font-mono">type</td><td className="border p-1">text</td><td className="border p-1">"charge"(충전), "deduct"(차감), "refund"(환급)</td></tr>
                <tr><td className="border p-1 font-mono">amount</td><td className="border p-1">integer</td><td className="border p-1">금액</td></tr>
                <tr><td className="border p-1 font-mono">balance_after</td><td className="border p-1">integer</td><td className="border p-1">변동 후 잔액</td></tr>
                <tr><td className="border p-1 font-mono">description</td><td className="border p-1">text</td><td className="border p-1">설명</td></tr>
                <tr><td className="border p-1 font-mono">admin_id</td><td className="border p-1">varchar</td><td className="border p-1">처리 관리자 ID</td></tr>
                <tr><td className="border p-1 font-mono">related_order_id</td><td className="border p-1">varchar</td><td className="border p-1">관련 주문 ID</td></tr>
                <tr><td className="border p-1 font-mono">created_at</td><td className="border p-1">timestamp</td><td className="border p-1">생성일시</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold mt-4">8.3 pointer_history (포인터 이력)</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">컬럼</th>
                  <th className="border p-2">타입</th>
                  <th className="border p-2">설명</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-1 font-mono">id</td><td className="border p-1">varchar (UUID)</td><td className="border p-1">PK</td></tr>
                <tr><td className="border p-1 font-mono">member_id</td><td className="border p-1">varchar</td><td className="border p-1">회원 ID (FK)</td></tr>
                <tr><td className="border p-1 font-mono">type</td><td className="border p-1">text</td><td className="border p-1">"grant"(지급), "deduct"(차감), "expire"(만료)</td></tr>
                <tr><td className="border p-1 font-mono">amount</td><td className="border p-1">integer</td><td className="border p-1">금액</td></tr>
                <tr><td className="border p-1 font-mono">balance_after</td><td className="border p-1">integer</td><td className="border p-1">변동 후 잔액</td></tr>
                <tr><td className="border p-1 font-mono">description</td><td className="border p-1">text</td><td className="border p-1">설명</td></tr>
                <tr><td className="border p-1 font-mono">admin_id</td><td className="border p-1">varchar</td><td className="border p-1">처리 관리자 ID</td></tr>
                <tr><td className="border p-1 font-mono">related_order_id</td><td className="border p-1">varchar</td><td className="border p-1">관련 주문 ID</td></tr>
                <tr><td className="border p-1 font-mono">created_at</td><td className="border p-1">timestamp</td><td className="border p-1">생성일시</td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold mt-4">8.4 members 테이블 (잔액 관련 필드)</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">컬럼</th>
                  <th className="border p-2">타입</th>
                  <th className="border p-2">기본값</th>
                  <th className="border p-2">설명</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-1 font-mono">deposit</td><td className="border p-1">integer</td><td className="border p-1">0</td><td className="border p-1">예치금 잔액</td></tr>
                <tr><td className="border p-1 font-mono">point</td><td className="border p-1">integer</td><td className="border p-1">0</td><td className="border p-1">포인터 잔액</td></tr>
                <tr><td className="border p-1 font-mono">grade</td><td className="border p-1">text</td><td className="border p-1">"PENDING"</td><td className="border p-1">회원 등급</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 9 */}
        <section id="section-9" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">9. API 엔드포인트 목록</h2>
          
          <h3 className="font-semibold">관리자 API</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">메서드</th>
                  <th className="border p-2">경로</th>
                  <th className="border p-2">설명</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/members/:memberId/balance</td>
                  <td className="border p-1">회원 잔액 상세 조회</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">POST</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/members/:memberId/deposit/charge</td>
                  <td className="border p-1">예치금 충전</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">POST</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/members/:memberId/deposit/refund</td>
                  <td className="border p-1">예치금 환급</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">POST</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/members/:memberId/pointer/grant</td>
                  <td className="border p-1">포인터 지급</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/settlements</td>
                  <td className="border p-1">정산 이력 조회 (필터/페이징)</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/deposit-history</td>
                  <td className="border p-1">예치금 이력 조회 (필터/페이징)</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/pointer-history</td>
                  <td className="border p-1">포인터 이력 조회 (필터/페이징)</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/members-balance</td>
                  <td className="border p-1">전체 회원 잔액 현황</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">POST</td>
                  <td className="border p-1 font-mono text-xs">/api/admin/pending-orders/to-shipping</td>
                  <td className="border p-1">배송중 전환 (자동 정산 포함)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold mt-4">회원 API</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">메서드</th>
                  <th className="border p-2">경로</th>
                  <th className="border p-2">설명</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/member/my-balance</td>
                  <td className="border p-1">내 잔액 조회</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/member/my-settlements</td>
                  <td className="border p-1">내 정산 이력 조회</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/member/my-deposit-history</td>
                  <td className="border p-1">내 예치금 이력 조회</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">GET</td>
                  <td className="border p-1 font-mono text-xs">/api/member/my-pointer-history</td>
                  <td className="border p-1">내 포인터 이력 조회</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 10 */}
        <section id="section-10" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">10. UI/UX 알림 시스템</h2>
          
          <h3 className="font-semibold">서버 응답 확장 필드</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs md:text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">응답 status</th>
                  <th className="border p-2">추가 필드</th>
                  <th className="border p-2">설명</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-1 font-mono">validation_failed</td>
                  <td className="border p-1 font-mono text-xs">balanceInfo, totalOrderAmount, balanceSufficient</td>
                  <td className="border p-1">검증 실패 시 잔액 정보 포함</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">insufficient_balance</td>
                  <td className="border p-1 font-mono text-xs">balanceInfo, shortage, errors[]</td>
                  <td className="border p-1">잔액 부족 전용 응답</td>
                </tr>
                <tr>
                  <td className="border p-1 font-mono">partial_success</td>
                  <td className="border p-1 font-mono text-xs">settlementInfo(orderAmount, remainingBalance)</td>
                  <td className="border p-1">부분 성공 시 정산 정보</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="font-semibold mt-4">알림 규칙</h3>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>한 번에 하나의 다이얼로그만 표시</li>
            <li>검증 순서: 등급 → 파일 → 중복 → 상품 → 잔액 → 주소 → 결과</li>
            <li>기존 검증 알림/순서 절대 변경 금지</li>
          </ul>
        </section>

        {/* Section 11 */}
        <section id="section-11" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">11. 가격 확정 워크플로우</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs md:text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">구분</th>
                  <th className="border p-2">주문 상태</th>
                  <th className="border p-2">가격 처리</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2 font-medium">미확정</td>
                  <td className="border p-2">대기 ~ 배송준비중</td>
                  <td className="border p-2">실시간으로 current_products에서 등급별 가격 조회/표시</td>
                </tr>
                <tr>
                  <td className="border p-2 font-medium">확정</td>
                  <td className="border p-2">배송중</td>
                  <td className="border p-2">"배송중 전환" 시점에 가격 확정 (priceConfirmed=true), 이후 변동 없음</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3">
            <strong>통계 API 하이브리드 방식</strong>: 확정 주문은 저장된 가격(supplyPrice) 사용, 미확정 주문은 현재공급가 테이블에서 실시간 계산.
          </p>
        </section>

        {/* Section 12 */}
        <section id="section-12" className="section-block space-y-3">
          <h2 className="text-xl font-bold border-b pb-2">12. 오류 처리 및 예외 상황</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs md:text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border p-2">상황</th>
                  <th className="border p-2">처리 방식</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2">주문 등록 시 잔액 부족</td>
                  <td className="border p-2">주문 등록 거부, 부족 금액 안내</td>
                </tr>
                <tr>
                  <td className="border p-2">배송중 전환 시 잔액 부족</td>
                  <td className="border p-2">해당 주문부터 실패, 이전 정상건만 전환</td>
                </tr>
                <tr>
                  <td className="border p-2">트랜잭션 실패</td>
                  <td className="border p-2">해당 회원 전체 롤백, 다른 회원 영향 없음</td>
                </tr>
                <tr>
                  <td className="border p-2">환급 금액 &gt; 예치금</td>
                  <td className="border p-2">400 에러 반환, 현재 예치금 안내</td>
                </tr>
                <tr>
                  <td className="border p-2">상품코드 미존재</td>
                  <td className="border p-2">가격 0원 처리 (현재공급가 조회 실패)</td>
                </tr>
                <tr>
                  <td className="border p-2">공급중지 상품 주문</td>
                  <td className="border p-2">주문 등록 거부 (검증 단계에서 차단)</td>
                </tr>
                <tr>
                  <td className="border p-2">PENDING/ASSOCIATE 등급 주문 시도</td>
                  <td className="border p-2">403 Forbidden 반환</td>
                </tr>
                <tr>
                  <td className="border p-2">동시 정산 접근</td>
                  <td className="border p-2">SELECT FOR UPDATE로 행 잠금, 순차 처리 보장</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <footer className="text-center text-xs text-muted-foreground border-t pt-6 mt-8">
          <p>Topsel 주문관리 플랫폼 - 정산 시스템 매뉴얼</p>
          <p>본 문서는 시스템의 현재 구현 상태를 기준으로 작성되었습니다.</p>
        </footer>
      </div>
    </>
  );
}