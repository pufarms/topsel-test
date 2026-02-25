import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Copy, BookOpen, MessageSquare } from "lucide-react";
import type { Member } from "@shared/schema";

interface DepositGuideTabProps {
  onNavigate?: (tab: string) => void;
}

export default function DepositGuideTab({ onNavigate }: DepositGuideTabProps) {
  const { toast } = useToast();

  const { data: memberData } = useQuery<Member>({
    queryKey: ["/api/member/profile"],
  });

  const { data: purchaseStats } = useQuery<{
    lastMonthTotal: number;
    thisMonthTotal: number;
    confirmed: { lastMonth: number; thisMonth: number };
    projected: { lastMonth: number; thisMonth: number };
  }>({
    queryKey: ["/api/member/purchase-stats"],
  });

  const isPostpaid = memberData?.isPostpaid === true;
  const memberName = memberData?.memberName || memberData?.representative || "-";
  const grade = memberData?.grade || "ASSOCIATE";

  const gradeLabel: Record<string, string> = {
    ASSOCIATE: "Associate",
    PENDING: "Pending",
    START: "Start회원",
    DRIVING: "Driving회원",
    TOP: "Top회원",
  };

  const formatNumber = (n: number) => n.toLocaleString("ko-KR");

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText("301-0339-1231-81");
      toast({ title: "계좌번호가 복사되었습니다", description: "농협 301-0339-1231-81" });
    } catch {
      toast({ title: "복사 실패", description: "직접 입력해 주세요.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-0">
      <div
        className="relative overflow-hidden rounded-t-xl text-center"
        style={{ background: "linear-gradient(135deg, #1e2a6e 0%, #2d3a8c 50%, #1a5276 100%)" }}
      >
        <div className="absolute -top-[60px] -right-[60px] w-[300px] h-[300px] rounded-full" style={{ background: "rgba(255,255,255,0.04)" }} />
        <div className="absolute -bottom-[40px] left-[10%] w-[200px] h-[200px] rounded-full" style={{ background: "rgba(255,255,255,0.03)" }} />

        <div className="relative z-10 max-w-[900px] mx-auto px-6 pt-10 pb-9">
          <p className="text-[13px] text-white/65 tracking-wider mb-2">👋 환영합니다!</p>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold text-white tracking-tight mb-2.5" style={{ fontFamily: "'Montserrat','Noto Sans KR',sans-serif" }}>
            예치금 충전 안내
          </h1>
          <p className="text-[14px] text-white/75 leading-[1.7] mb-7">
            탑셀러에서 상품을 공급받기 위해서는 예치금 또는 포인트 잔액이 반드시 필요합니다.<br />
            지정된 계좌로 입금하시면 <strong style={{ color: "#f5a623" }}>24시간 자동으로 처리</strong>됩니다.
          </p>

          <div className="flex gap-2.5 justify-center mb-8">
            <button
              onClick={() => onNavigate?.("guide")}
              className="px-5 py-2.5 rounded-3xl text-[13px] font-semibold text-white border-none cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ background: "#f5a623", boxShadow: "0 4px 14px rgba(245,166,35,0.4)" }}
              data-testid="button-deposit-guide-usage"
            >
              📖 이용가이드 보기
            </button>
            <button
              onClick={() => onNavigate?.("inquiry")}
              className="px-5 py-2.5 rounded-3xl text-[13px] font-semibold text-white cursor-pointer transition-all hover:bg-white/25"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
              data-testid="button-deposit-guide-inquiry"
            >
              💬 1:1 문의하기
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-[700px] mx-auto">
            <div className="text-left rounded-[10px] p-3.5" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div className="text-[11px] text-white/65 mb-1">😊 회원 등급</div>
              <div className="text-[17px] font-bold text-white" style={{ fontFamily: "'Montserrat','Noto Sans KR',sans-serif" }}>{gradeLabel[grade] || grade}</div>
            </div>
            <div className="text-left rounded-[10px] p-3.5" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div className="text-[11px] text-white/65 mb-1">📊 지난 달 매입 총액</div>
              <div className="text-[17px] font-bold text-white" style={{ fontFamily: "'Montserrat','Noto Sans KR',sans-serif" }}>{formatNumber(purchaseStats?.lastMonthTotal || 0)} 원</div>
            </div>
            <div className="text-left rounded-[10px] p-3.5 col-span-2 sm:col-span-1" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <div className="text-[11px] text-white/65 mb-1">📋 이번 달 매입 총액</div>
              <div className="text-[17px] font-bold text-white" style={{ fontFamily: "'Montserrat','Noto Sans KR',sans-serif" }}>{formatNumber(purchaseStats?.thisMonthTotal || 0)} 원</div>
            </div>
          </div>
        </div>

        {isPostpaid && (
          <div className="flex items-center gap-3.5 flex-wrap px-6 py-3.5" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}>
            <span className="text-[11px] font-bold text-white px-3 py-1 rounded-[20px] whitespace-nowrap shrink-0" style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.35)" }}>
              🔔 후불결제 회원
            </span>
            <div className="text-[13px] text-white leading-[1.6] flex-1">
              회원님은 <strong className="text-purple-200">후불결제 회원</strong>입니다.
              동일 계좌로 입금 시 <strong className="text-purple-200">후불결제 정산이 자동으로 처리</strong>됩니다.
              예치금 충전도 동일 계좌를 이용합니다.
            </div>
          </div>
        )}
      </div>

      <div className="max-w-[900px] mx-auto px-5 pt-7 pb-16 space-y-4">

        {isPostpaid && (
          <>
            <div className="rounded-[14px] p-5" style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", border: "2px solid #7c3aed" }}>
              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>🔄</div>
                <div>
                  <div className="text-[15px] font-bold text-purple-800">후불결제 정산 안내</div>
                  <div className="text-[12px] text-purple-700 mt-0.5">후불결제 회원 전용 — 아래 계좌로 입금 시 자동 정산 처리</div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { num: "1", text: <><strong className="text-purple-800">후불결제 정산</strong>은 상품 공급 후 발생한 정산 금액을 아래 지정 계좌로 입금하시면 <strong className="text-purple-800">자동으로 정산 처리</strong>됩니다.</> },
                  { num: "2", text: <>입금 시 반드시 <strong className="text-purple-800">회원명(입금자 확인용 이름)</strong>으로 입금해 주세요. 회원명이 다르면 자동 처리되지 않습니다.</> },
                  { num: "3", text: <>예치금 충전도 <strong className="text-purple-800">동일한 계좌</strong>를 이용합니다. 입금 목적(정산/충전)에 관계없이 시스템이 자동으로 구분하여 처리합니다.</> },
                ].map(({ num, text }) => (
                  <div key={num} className="flex gap-3 items-start bg-white rounded-lg p-3.5" style={{ border: "1px solid #ddd6fe" }}>
                    <div className="w-6 h-6 rounded-full text-white text-[11px] font-extrabold flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", fontFamily: "'Montserrat',sans-serif" }}>{num}</div>
                    <div className="text-[13px] text-gray-700 leading-[1.7]">{text}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 items-start mt-3 rounded-lg p-2.5 text-[12px] text-purple-800 leading-[1.7]" style={{ background: "#faf5ff", border: "1px solid #c4b5fd" }}>
                <span>💡</span>
                <span>후불결제 정산 내역은 마이페이지 <strong>정산 관리</strong> 탭에서 확인할 수 있습니다. 정산 관련 문의는 고객센터로 연락해 주세요.</span>
              </div>
            </div>
            <hr className="border-t-2 border-dashed border-gray-200 my-1" />
          </>
        )}

        <div className="bg-white rounded-[14px] shadow-sm overflow-hidden" style={{ boxShadow: "0 2px 16px rgba(30,42,110,0.09)" }}>
          <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ background: "linear-gradient(135deg, #f8f9fc 0%, #fff 100%)" }}>
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg shrink-0 bg-blue-100">💡</div>
            <div className="text-[15px] font-bold text-gray-800">핵심 안내</div>
          </div>
          <div className="p-5">
            <div className="flex gap-3 items-start rounded-lg p-4 mb-5" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)", border: "1px solid #93c5fd" }}>
              <div className="text-[22px] shrink-0 mt-0.5">💡</div>
              <div>
                <div className="text-[13px] font-bold text-blue-800 mb-1">예치금/포인트가 있어야 상품 공급이 가능합니다</div>
                <div className="text-[13px] text-blue-900 leading-[1.7]">
                  탑셀러에서 상품을 공급받기 위해서는 <strong className="text-blue-800">예치금 또는 포인트 잔액</strong>이 반드시 필요합니다.<br />
                  지정된 계좌로 입금하시면 <strong className="text-blue-800">24시간 자동으로 예치금이 충전</strong>됩니다.
                  {isPostpaid && (
                    <><br />후불결제 회원의 경우 <strong className="text-blue-800">동일 계좌로 후불결제 정산도 자동 처리</strong>됩니다.</>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap rounded-[14px] px-6 py-5" style={{ background: "linear-gradient(135deg, #1e2a6e 0%, #2d3a8c 100%)" }}>
              <div>
                <div className="text-[12px] text-white/70 mb-1">🏦 농협은행</div>
                <div className="text-[24px] font-extrabold text-white tracking-wider mb-1" style={{ fontFamily: "'Montserrat',sans-serif" }}>301-0339-1231-81</div>
                <div className="text-[13px] text-white/80">예금주: 현 농업회사법인 주식회사</div>
              </div>
              <button
                onClick={handleCopyAccount}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-white text-[12px] font-semibold cursor-pointer transition-all hover:bg-white/25 whitespace-nowrap"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}
                data-testid="button-copy-account"
              >
                <Copy className="h-3.5 w-3.5" />
                계좌번호 복사
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] shadow-sm overflow-hidden" style={{ boxShadow: "0 2px 16px rgba(30,42,110,0.09)" }}>
          <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ background: "linear-gradient(135deg, #f8f9fc 0%, #fff 100%)" }}>
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg shrink-0 bg-orange-100">📋</div>
            <div className="text-[15px] font-bold text-gray-800">입금 방법</div>
          </div>
          <div className="p-5">
            <div className="flex flex-col">

              <div className="flex gap-4 py-5 border-b border-gray-100">
                <div className="w-9 h-9 rounded-full shrink-0 text-white text-[15px] font-extrabold flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e2a6e, #3d4fa8)", boxShadow: "0 4px 12px rgba(30,42,110,0.25)", fontFamily: "'Montserrat',sans-serif" }}>1</div>
                <div className="flex-1">
                  <div className="text-[14px] font-bold text-gray-800 mb-2 flex items-center gap-2">
                    입금자명 확인
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-[20px]">가장 중요!</span>
                  </div>
                  <div className="text-[13px] text-gray-500 leading-[1.8]">
                    입금 시 <strong className="text-gray-800">입금자명은 반드시 회원명(회원가입 시 등록한 입금자 확인용 이름)과 동일</strong>해야 합니다.
                  </div>
                  <div className="rounded-lg p-4 my-3" style={{ background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)", border: "2px solid #f5a623" }}>
                    <div className="flex items-center gap-2 text-[13px] font-bold text-amber-800 mb-3">⚠️ 반드시 아래 회원명으로 입금해 주세요!</div>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="text-[12px] text-amber-900 font-semibold w-[80px] shrink-0">내 회원명</div>
                      <div className="text-[20px] font-extrabold tracking-wider bg-white rounded-lg px-4 py-2" style={{ color: "#1e2a6e", border: "2px solid #f5a623", fontFamily: "'Montserrat','Noto Sans KR',sans-serif" }} data-testid="text-deposit-member-name">
                        {memberName}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1">
                      <div className="text-[12px] text-amber-800 leading-[1.6] flex items-start gap-1.5"><span>✅</span><span>자동 처리 시스템이 <strong>이 회원명</strong>으로 입금자를 매칭합니다. 반드시 이 이름으로 입금해 주세요.</span></div>
                      <div className="text-[12px] text-amber-800 leading-[1.6] flex items-start gap-1.5"><span>✅</span><span>사업자 대표자명과 다를 수 있습니다. 반드시 위의 <strong>회원명</strong>으로 입금하세요.</span></div>
                      <div className="text-[12px] text-amber-800 leading-[1.6] flex items-start gap-1.5"><span>✅</span><span>띄어쓰기도 동일하게 입력해 주세요.</span></div>
                      <div className="text-[12px] text-amber-800 leading-[1.6] flex items-start gap-1.5">
                        <span>📝</span>
                        <span>회원명 변경이 필요한 경우 <button onClick={() => onNavigate?.("member-info")} className="text-[#1e2a6e] font-bold underline cursor-pointer bg-transparent border-none p-0 text-[12px]" data-testid="link-member-info-from-deposit">회원정보 페이지</button>에서 수정하세요.</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-start rounded-lg p-3 mt-3 text-[12px] text-red-800 leading-[1.6]" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
                    ⚠️ <span><strong>회원명과 입금자명이 다를 경우, 자동 처리가 되지 않습니다.</strong> 고객센터에 직접 문의하셔야 하며 영업시간 내에만 처리 가능합니다.</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 py-5 border-b border-gray-100">
                <div className="w-9 h-9 rounded-full shrink-0 text-white text-[15px] font-extrabold flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e2a6e, #3d4fa8)", boxShadow: "0 4px 12px rgba(30,42,110,0.25)", fontFamily: "'Montserrat',sans-serif" }}>2</div>
                <div className="flex-1">
                  <div className="text-[14px] font-bold text-gray-800 mb-2">지정 계좌로 입금</div>
                  <div className="text-[13px] text-gray-500 leading-[1.8]">
                    위에 안내된 <strong className="text-gray-800">농협 계좌</strong>로 원하시는 금액을 입금해 주세요.<br />
                    입금 금액에 제한은 없으며, 입금하신 금액 그대로 처리됩니다.
                  </div>
                </div>
              </div>

              <div className="flex gap-4 py-5">
                <div className="w-9 h-9 rounded-full shrink-0 text-white text-[15px] font-extrabold flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1e2a6e, #3d4fa8)", boxShadow: "0 4px 12px rgba(30,42,110,0.25)", fontFamily: "'Montserrat',sans-serif" }}>3</div>
                <div className="flex-1">
                  <div className="text-[14px] font-bold text-gray-800 mb-2">자동 처리 완료</div>
                  <div className="text-[13px] text-gray-500 leading-[1.8]">
                    정상적인 입금 시 <strong className="text-gray-800">보통 10분 이내</strong>에 자동으로 처리됩니다.
                  </div>
                  <div className="flex gap-2.5 items-start rounded-lg p-3.5 mt-3 text-[13px] text-gray-500 leading-[1.7] bg-gray-50">
                    <span>🕐</span>
                    <div>
                      전산 처리 상황에 따라 <strong className="text-gray-800">30분 ~ 1시간</strong> 소요될 수 있습니다.<br />
                      <strong className="text-gray-800">자동 처리는 24시간 운영됩니다.</strong> (업무시간 외에도 정상 작동)<br />
                      <span className="text-red-600">💡 1시간이 지나도 처리되지 않으면 고객센터로 문의해 주세요.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[14px] shadow-sm overflow-hidden" style={{ boxShadow: "0 2px 16px rgba(30,42,110,0.09)" }}>
          <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ background: "linear-gradient(135deg, #f8f9fc 0%, #fff 100%)" }}>
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg shrink-0 bg-green-100">🔄</div>
            <div className="text-[15px] font-bold text-gray-800">환불 및 세금계산서 안내</div>
          </div>
          <div className="p-5">
            <div className="rounded-lg p-3 mb-3.5 text-[12px] font-semibold text-red-800 text-center" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
              ⚠️ 예치금 입금 시 세금계산서가 발행되지 않습니다 — 상품 공급 정산 시 발행됩니다.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex gap-3 items-start bg-gray-50 rounded-lg p-4">
                <div className="text-[24px] shrink-0">✅</div>
                <div>
                  <div className="text-[13px] font-bold text-gray-800 mb-1">언제든지 환불 가능</div>
                  <div className="text-[12px] text-gray-500 leading-[1.7]">충전하신 예치금은 요청 시 언제든지 환불받으실 수 있습니다. 환불 신청 후 <strong>1~2일 내</strong>에 처리됩니다.</div>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-gray-50 rounded-lg p-4">
                <div className="text-[24px] shrink-0">📝</div>
                <div>
                  <div className="text-[13px] font-bold text-gray-800 mb-1">환불 신청 방법</div>
                  <div className="text-[12px] text-gray-500 leading-[1.7]">예치금 환불 게시판을 통해 환불 신청서를 작성해 주세요. 신청 후 확인 작업을 거쳐 지정 계좌로 환불됩니다.</div>
                </div>
              </div>
              <div className="flex gap-3 items-start bg-gray-50 rounded-lg p-4 sm:col-span-2">
                <div className="text-[24px] shrink-0">🧾</div>
                <div>
                  <div className="text-[13px] font-bold text-gray-800 mb-1">세금계산서 발행 안내</div>
                  <div className="text-[12px] text-gray-500 leading-[1.7]">예치금으로 <strong>상품 공급 정산 시 세금계산서(계산서)가 발행</strong>됩니다. 예치금 입금에 대한 별도의 세금계산서는 발행되지 않습니다. ※ 입금 시점과 정산 시점의 중복 발행 방지를 위함입니다.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap rounded-[14px] px-6 py-5" style={{ background: "linear-gradient(135deg, #1e2a6e 0%, #2d3a8c 100%)" }}>
          <div className="text-white">
            <div className="text-[15px] font-bold mb-1">🖥️ 문의사항이 있으신가요?</div>
            <div className="text-[12px] text-white/75">예치금 충전 관련 문의는 고객센터(회원전용 게시판)로 연락해 주세요. (영업시간 내 처리)</div>
          </div>
          <button
            onClick={() => onNavigate?.("inquiry")}
            className="border-none rounded-lg px-5 py-2.5 text-[13px] font-bold text-white cursor-pointer whitespace-nowrap transition-all hover:-translate-y-0.5"
            style={{ background: "#f5a623", boxShadow: "0 4px 12px rgba(245,166,35,0.35)" }}
            data-testid="button-deposit-guide-contact"
          >
            💬 고객센터 문의하기
          </button>
        </div>
      </div>
    </div>
  );
}