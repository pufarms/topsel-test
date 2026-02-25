import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type Member } from "@shared/schema";
import { 
  User, Building2, Star, CreditCard, Eye, EyeOff, 
  Check, X, Loader2, Mail, Lock, AlertTriangle, MessageSquare
} from "lucide-react";
import { useLocation } from "wouter";

export default function MemberInfoTab({ onNavigateTab }: { onNavigateTab?: (tab: string) => void } = {}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: memberData, isLoading } = useQuery<Member>({
    queryKey: ["/api/member/profile"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [manager2Name, setManager2Name] = useState("");
  const [manager2Phone, setManager2Phone] = useState("");
  const [manager3Name, setManager3Name] = useState("");
  const [manager3Phone, setManager3Phone] = useState("");

  const [editMemberName, setEditMemberName] = useState("");
  const [memberNameChecked, setMemberNameChecked] = useState(false);
  const [memberNameAvailable, setMemberNameAvailable] = useState<boolean | null>(null);
  const [memberNameSelf, setMemberNameSelf] = useState(false);
  const [memberNameMsg, setMemberNameMsg] = useState("");
  const [isCheckingName, setIsCheckingName] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPwModal, setShowPwModal] = useState(false);

  useEffect(() => {
    if (memberData) {
      setManagerName(memberData.managerName || "");
      setManagerPhone(memberData.managerPhone || "");
      setManager2Name((memberData as any).manager2Name || "");
      setManager2Phone((memberData as any).manager2Phone || "");
      setManager3Name((memberData as any).manager3Name || "");
      setManager3Phone((memberData as any).manager3Phone || "");
      setEditMemberName(memberData.memberName || "");
      setMemberNameChecked(true);
      setMemberNameAvailable(true);
      setMemberNameSelf(true);
      setMemberNameMsg("");
    }
  }, [memberData]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/member/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/profile"] });
      toast({ title: "저장 완료", description: "담당자 정보가 저장되었습니다." });
    },
    onError: (err: any) => {
      toast({ title: "저장 실패", description: err.message, variant: "destructive" });
    },
  });

  const handleCheckMemberName = async () => {
    const trimmed = editMemberName.trim();
    if (!trimmed) {
      toast({ title: "입력 오류", description: "회원명을 입력해 주세요.", variant: "destructive" });
      return;
    }
    if (!/^[가-힣]{1,6}$/.test(trimmed)) {
      toast({ title: "입력 오류", description: "한글 6자 이내로 입력해 주세요.", variant: "destructive" });
      return;
    }
    setIsCheckingName(true);
    try {
      const res = await fetch(`/api/auth/check-member-name-auth?name=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setMemberNameChecked(true);
      setMemberNameAvailable(data.available);
      setMemberNameSelf(data.self || false);
      setMemberNameMsg(data.message || "");
    } catch {
      setMemberNameMsg("중복 확인 중 오류가 발생했습니다.");
      setMemberNameAvailable(false);
    } finally {
      setIsCheckingName(false);
    }
  };

  const handleSave = () => {
    if (!managerName.trim()) {
      toast({ title: "입력 오류", description: "1번 담당자명은 필수입니다.", variant: "destructive" });
      return;
    }
    if (!editMemberName.trim()) {
      toast({ title: "입력 오류", description: "회원명은 필수입니다.", variant: "destructive" });
      return;
    }
    const memberNameChanged = editMemberName.trim() !== (memberData?.memberName || "");
    if (memberNameChanged && (!memberNameChecked || !memberNameAvailable)) {
      toast({ title: "입력 오류", description: "회원명 중복확인을 완료해 주세요.", variant: "destructive" });
      return;
    }
    const payload: any = {
      managerName,
      managerPhone,
      manager2Name,
      manager2Phone,
      manager3Name,
      manager3Phone,
    };
    if (memberNameChanged) {
      payload.memberName = editMemberName.trim();
    }
    saveMutation.mutate(payload);
  };

  const handleCancel = () => {
    if (memberData) {
      setManagerName(memberData.managerName || "");
      setManagerPhone(memberData.managerPhone || "");
      setManager2Name((memberData as any).manager2Name || "");
      setManager2Phone((memberData as any).manager2Phone || "");
      setManager3Name((memberData as any).manager3Name || "");
      setManager3Phone((memberData as any).manager3Phone || "");
      setEditMemberName(memberData.memberName || "");
      setMemberNameChecked(true);
      setMemberNameAvailable(true);
      setMemberNameSelf(true);
      setMemberNameMsg("");
    }
  };

  const formatNumber = (n: number) => n.toLocaleString("ko-KR");
  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "-";
    const date = new Date(d);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };

  const gradeLabel = (grade: string) => {
    const map: Record<string, string> = { PENDING: "보류중", ASSOCIATE: "준회원", START: "Start회원", DRIVING: "Driving회원", TOP: "Top회원" };
    return map[grade] || grade;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!memberData) return null;

  return (
    <div className="space-y-4" data-testid="member-info-tab">
      {/* 예치금 & 포인터 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
        <div className="relative overflow-hidden rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg, #1e2a6e 0%, #2d3a8c 100%)" }}>
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
          <div className="flex items-center gap-1 text-[11px] opacity-70 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />현재 예치금
          </div>
          <div className="font-bold text-xl tracking-tight" style={{ fontFamily: "Montserrat, sans-serif" }} data-testid="text-deposit-amount">
            {formatNumber(memberData.deposit || 0)}<span className="text-xs font-normal ml-1 opacity-70">원</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl p-4 text-white" style={{ background: "linear-gradient(135deg, #1565c0 0%, #0277bd 100%)" }}>
          <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/5" />
          <div className="flex items-center gap-1 text-[11px] opacity-70 mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#00e5ff" }} />보유 포인터
          </div>
          <div className="font-bold text-xl tracking-tight" style={{ fontFamily: "Montserrat, sans-serif" }} data-testid="text-point-amount">
            {formatNumber(memberData.point || 0)}<span className="text-xs font-normal ml-1 opacity-70">P</span>
          </div>
          <div className="text-[11px] opacity-50 mt-0.5">사용 가능 포인터</div>
        </div>

        <button
          onClick={() => onNavigateTab ? onNavigateTab("deposit-guide") : navigate("/dashboard?tab=deposit-guide")}
          className="flex flex-col items-center justify-center gap-1 rounded-xl px-6 py-4 text-white font-bold text-sm cursor-pointer transition-transform hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #f5a623 0%, #e8920a 100%)", boxShadow: "0 4px 14px rgba(245,166,35,0.35)", minHeight: 76 }}
          data-testid="button-charge-deposit"
        >
          <span className="text-lg">⚡</span>
          예치금 충전
        </button>
      </div>

      {/* 섹션 1: 기본 정보 */}
      <div className="bg-white rounded-xl shadow-sm border" data-testid="section-basic-info">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <div className="flex items-center gap-2 text-sm font-bold">
            <User className="h-4 w-4" /> 기본 정보
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">수정 가능</span>
          </div>
        </div>
        <div className="p-5">
          <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
            담당자 정보 <span className="text-gray-400 font-normal">(최대 3명 · 휴대폰 번호 필수)</span> <span className="text-red-500 text-sm">*</span>
          </div>
          <div className="space-y-2 mb-4">
            {[
              { num: 1, name: managerName, setName: setManagerName, phone: managerPhone, setPhone: setManagerPhone },
              { num: 2, name: manager2Name, setName: setManager2Name, phone: manager2Phone, setPhone: setManager2Phone },
              { num: 3, name: manager3Name, setName: setManager3Name, phone: manager3Phone, setPhone: setManager3Phone },
            ].map(({ num, name, setName, phone, setPhone }) => (
              <div key={num} className="grid grid-cols-[26px_1fr_1fr] gap-2 items-center bg-gray-50 rounded-lg p-2.5">
                <div className="w-[22px] h-[22px] rounded-full bg-[#1e2a6e] text-white text-[10px] font-bold flex items-center justify-center">{num}</div>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                  type="text"
                  placeholder="담당자명"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid={`input-manager${num}-name`}
                />
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                  type="tel"
                  placeholder="휴대폰 번호"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  data-testid={`input-manager${num}-phone`}
                />
              </div>
            ))}
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              이메일 <span className="text-red-500 text-sm">*</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-gray-50 text-gray-400"
                type="email"
                value={memberData.email || ""}
                readOnly
                data-testid="input-current-email"
              />
              <button
                className="shrink-0 border border-gray-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-500 hover:border-[#1e2a6e] hover:text-[#1e2a6e] transition bg-white"
                onClick={() => setShowEmailModal(true)}
                data-testid="button-change-email"
              >
                이메일 변경
              </button>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">※ 세금계산서 수신 이메일과 동일하게 적용됩니다.</div>
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">비밀번호</div>
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none bg-gray-50 text-gray-400"
                type="password"
                value="••••••••"
                readOnly
                data-testid="input-password-masked"
              />
              <button
                className="shrink-0 border border-gray-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-500 hover:border-[#1e2a6e] hover:text-[#1e2a6e] transition bg-white"
                onClick={() => setShowPwModal(true)}
                data-testid="button-change-password"
              >
                비밀번호 변경
              </button>
            </div>
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
              회원명 (입금자 확인용) <span className="text-red-500 text-sm">*</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                type="text"
                placeholder="한글 6자 이내"
                value={editMemberName}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, "").slice(0, 6);
                  setEditMemberName(val);
                  if (val !== (memberData?.memberName || "")) {
                    setMemberNameChecked(false);
                    setMemberNameAvailable(null);
                    setMemberNameSelf(false);
                    setMemberNameMsg("");
                  } else {
                    setMemberNameChecked(true);
                    setMemberNameAvailable(true);
                    setMemberNameSelf(true);
                    setMemberNameMsg("");
                  }
                }}
                maxLength={6}
                data-testid="input-edit-member-name"
              />
              <button
                className="shrink-0 border border-gray-200 rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-500 hover:border-[#1e2a6e] hover:text-[#1e2a6e] transition bg-white disabled:opacity-50"
                onClick={handleCheckMemberName}
                disabled={isCheckingName || !editMemberName.trim() || editMemberName.trim() === (memberData?.memberName || "")}
                data-testid="button-check-member-name"
              >
                {isCheckingName ? <Loader2 className="h-3 w-3 animate-spin" /> : "중복확인"}
              </button>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">한글 6자 이내 · 입금 시 자동매칭에 사용됩니다</div>
            {memberNameMsg && memberNameChecked && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${memberNameAvailable ? "text-green-600" : "text-red-500"}`}>
                {memberNameAvailable ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {memberNameSelf ? "현재 사용 중인 회원명입니다." : memberNameAvailable ? "✓ 사용 가능한 회원명입니다." : "✗ 이미 사용 중인 회원명입니다."}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-3.5 border-t">
            <button
              className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition"
              onClick={handleCancel}
              data-testid="button-cancel-info"
            >
              취소
            </button>
            <button
              className="rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "#1e2a6e" }}
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-info"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "💾 변경사항 저장"}
            </button>
          </div>
        </div>
      </div>

      {/* 섹션 2: 사업자 정보 */}
      <div className="bg-white rounded-xl shadow-sm border" data-testid="section-business-info">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Building2 className="h-4 w-4" /> 사업자 정보
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">읽기 전용</span>
          </div>
          <button
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 hover:border-[#1e2a6e] hover:text-[#1e2a6e] transition bg-white"
            onClick={() => navigate("/dashboard?tab=inquiry")}
            data-testid="button-inquiry-biz"
          >
            ✉️ 변경 문의하기
          </button>
        </div>
        <div className="p-5">
          <div className="flex gap-2 rounded-lg p-2.5 mb-3.5 text-xs leading-relaxed" style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>사업자 정보는 직접 수정이 불가합니다.</strong><br />
              세금계산서 발행 및 거래 계약과 직결되는 정보로, 임의 변경 시 법적 문제가 발생할 수 있습니다. 변경이 필요하신 경우 우측 <strong>[변경 문의하기]</strong> 버튼을 이용해 주세요.
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="sm:col-span-2">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                <div className="text-[10px] font-semibold text-blue-500 tracking-wide mb-1">회원명 (입금자 확인용)</div>
                <div className="text-sm font-bold text-gray-900" data-testid="text-biz-member-name">{memberData.memberName || "-"}</div>
                <div className="mt-1.5 space-y-0.5">
                  <div className="text-[11px] text-amber-700 flex items-center gap-1"><AlertTriangle className="h-3 w-3 shrink-0" /> 예치금 입금 시 반드시 이 회원명으로 입금해야 자동 매칭됩니다.</div>
                  <div className="text-[11px] text-gray-500">사업자 대표자명과 다를 수 있습니다.</div>
                  <div className="text-[11px] text-gray-500">회원명 변경이 필요한 경우 기본 정보 섹션에서 수정하세요.</div>
                </div>
              </div>
            </div>
            <BizItem label="사업자등록번호" value={memberData.businessNumber || "-"} />
            <BizItem label="상호명" value={memberData.companyName || "-"} />
            <BizItem label="대표자명" value={memberData.representative || "-"} />
            <BizItem label="업태 / 종목" value={`${memberData.bizType || "-"} / ${memberData.bizClass || "-"}`} />
            <div className="sm:col-span-2">
              <BizItem label="사업장 주소" value={memberData.businessAddress || "-"} />
            </div>
            <div className="sm:col-span-2">
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-[10px] font-semibold text-gray-400 tracking-wide mb-1">세금계산서 수신 이메일</div>
                <div className="text-sm font-semibold text-gray-800">
                  {memberData.email || "-"}
                  <span className="inline-block text-[10px] bg-blue-50 text-blue-600 rounded-full px-2 py-0.5 font-semibold ml-1.5 align-middle">
                    회원정보 이메일과 동일
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 섹션 3: 회원 등급 & 가입 정보 */}
      <div className="bg-white rounded-xl shadow-sm border" data-testid="section-grade-info">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Star className="h-4 w-4" /> 회원 등급 & 가입 정보
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">읽기 전용</span>
          </div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
              <div className="text-[10px] font-semibold text-gray-400 tracking-wide mb-1">현재 등급</div>
              <span
                className="inline-flex items-center gap-1 text-white rounded-full px-3 py-0.5 text-xs font-bold"
                style={{ background: "linear-gradient(135deg, #1e2a6e, #3d4fa8)" }}
                data-testid="text-member-grade"
              >
                ⭐ {gradeLabel(memberData.grade)}
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
              <div className="text-[10px] font-semibold text-gray-400 tracking-wide mb-1">계정 상태</div>
              <span
                className="inline-block rounded-full px-3 py-0.5 text-xs font-bold"
                style={{ background: memberData.status === "활성" ? "#dcfce7" : "#fecaca", color: memberData.status === "활성" ? "#16a34a" : "#dc2626" }}
                data-testid="text-member-status"
              >
                {memberData.status === "활성" ? "✅ 정상" : "⚠️ " + memberData.status}
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
              <div className="text-[10px] font-semibold text-gray-400 tracking-wide mb-1">가입일</div>
              <div className="text-sm font-bold text-gray-800" data-testid="text-created-at">{formatDate(memberData.createdAt)}</div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
              <div className="text-[10px] font-semibold text-gray-400 tracking-wide mb-1">마지막 로그인</div>
              <div className="text-sm font-bold text-gray-800" data-testid="text-last-login">{formatDate(memberData.lastLoginAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 이메일 변경 모달 */}
      {showEmailModal && (
        <EmailChangeModal
          currentEmail={memberData.email || ""}
          onClose={() => setShowEmailModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/member/profile"] });
          }}
        />
      )}

      {/* 비밀번호 변경 모달 */}
      {showPwModal && (
        <PasswordChangeModal onClose={() => setShowPwModal(false)} />
      )}
    </div>
  );
}

function BizItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5">
      <div className="text-[10px] font-semibold text-gray-400 tracking-wide mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-800">{value}</div>
    </div>
  );
}

function EmailChangeModal({ currentEmail, onClose, onSuccess }: { currentEmail: string; onClose: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(300);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(300);
    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendCode = async () => {
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({ title: "올바른 이메일 주소를 입력해 주세요.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/email-verify/send", { newEmail, type: "email_change" });
      const data = await res.json();
      if (data.success) {
        setStep(2);
        startTimer();
        setTimeout(() => codeRefs.current[0]?.focus(), 100);
      }
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(":").slice(1).join(":").trim() : "인증번호 발송에 실패했습니다.";
      try { const parsed = JSON.parse(msg); toast({ title: parsed.message || msg, variant: "destructive" }); } catch { toast({ title: msg, variant: "destructive" }); }
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    setCode(["", "", "", "", "", ""]);
    setSending(true);
    try {
      await apiRequest("POST", "/api/auth/email-verify/send", { newEmail, type: "email_change" });
      startTimer();
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
      toast({ title: "인증번호가 재발송되었습니다." });
    } catch {
      toast({ title: "재발송에 실패했습니다.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = async () => {
    const codeStr = code.join("");
    if (codeStr.length < 6) {
      toast({ title: "인증번호 6자리를 모두 입력해 주세요.", variant: "destructive" });
      return;
    }
    setConfirming(true);
    try {
      const res = await apiRequest("POST", "/api/auth/email-verify/confirm", { newEmail, code: codeStr, type: "email_change" });
      const data = await res.json();
      if (data.success) {
        if (timerRef.current) clearInterval(timerRef.current);
        setStep(3);
        onSuccess();
        setTimeout(onClose, 2500);
      }
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(":").slice(1).join(":").trim() : "인증에 실패했습니다.";
      try { const parsed = JSON.parse(msg); toast({ title: parsed.message || msg, variant: "destructive" }); } catch { toast({ title: msg, variant: "destructive" }); }
    } finally {
      setConfirming(false);
    }
  };

  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const timerDisplay = `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center" onClick={onClose} data-testid="modal-email-change">
      <div className="bg-white rounded-xl w-[440px] max-w-[calc(100vw-32px)] shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <div className="text-sm font-bold flex items-center gap-2"><Mail className="h-4 w-4" /> 이메일 변경</div>
          <button className="text-gray-400 hover:bg-gray-100 rounded px-1.5 py-0.5 text-base" onClick={onClose}>✕</button>
        </div>
        <div className="p-5">
          {/* 스텝 인디케이터 */}
          <div className="flex items-center gap-1.5 mb-1">
            <StepDot num="1" state={step === 1 ? "active" : step > 1 ? "done" : "default"} />
            <div className={`flex-1 h-px ${step > 1 ? "bg-green-500" : "bg-gray-200"}`} />
            <StepDot num="2" state={step === 2 ? "active" : step > 2 ? "done" : "default"} />
            <div className={`flex-1 h-px ${step > 2 ? "bg-green-500" : "bg-gray-200"}`} />
            <StepDot num="✓" state={step === 3 ? "done" : "default"} />
          </div>
          <div className="flex justify-between mb-3">
            <span className={`text-[11px] ${step === 1 ? "text-[#1e2a6e] font-semibold" : "text-gray-400"}`}>이메일 입력</span>
            <span className={`text-[11px] ${step === 2 ? "text-[#1e2a6e] font-semibold" : "text-gray-400"}`}>인증번호 확인</span>
            <span className={`text-[11px] ${step === 3 ? "text-[#1e2a6e] font-semibold" : "text-gray-400"}`}>변경 완료</span>
          </div>

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <div className="mb-3">
                <div className="text-xs font-semibold text-gray-500 mb-1.5">현재 이메일</div>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400" readOnly value={currentEmail} />
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">새 이메일 주소 <span className="text-red-500 text-sm">*</span></div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                    type="email"
                    placeholder="새 이메일 주소 입력"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    data-testid="input-new-email"
                  />
                  <button
                    className="shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                    style={{ background: "#1e2a6e" }}
                    onClick={handleSendCode}
                    disabled={sending}
                    data-testid="button-send-verify-code"
                  >
                    {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : "인증번호 발송"}
                  </button>
                </div>
                <div className="text-[11px] text-gray-400 mt-1">입력하신 이메일로 6자리 인증번호가 발송됩니다.</div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <div className="bg-gray-50 rounded-lg p-2.5 text-xs text-gray-600 leading-relaxed mb-3">
                📧 <strong>{newEmail}</strong> 으로 6자리 인증번호가 발송되었습니다.
              </div>
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-2">
                  <span>인증번호 입력</span>
                  <div className="flex items-center gap-2">
                    <span className="text-red-500 font-bold" style={{ fontFamily: "Montserrat, sans-serif" }} data-testid="text-timer">
                      {timer > 0 ? timerDisplay : "만료됨"}
                    </span>
                    <button
                      className="border border-gray-200 rounded-md px-2 py-1 text-[11px] text-gray-500 hover:border-[#1e2a6e] hover:text-[#1e2a6e]"
                      onClick={handleResend}
                      data-testid="button-resend-code"
                    >
                      재발송
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {code.map((c, i) => (
                    <input
                      key={i}
                      ref={(el) => { codeRefs.current[i] = el; }}
                      className={`w-10 h-11 border-2 rounded-lg text-center text-lg font-bold outline-none transition ${c ? "border-[#1e2a6e] bg-blue-50/50" : "border-gray-200"} focus:border-blue-400`}
                      style={{ fontFamily: "Montserrat, sans-serif" }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={c}
                      onChange={(e) => handleCodeInput(i, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      data-testid={`input-code-${i}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-sm font-semibold text-gray-800">이메일이 성공적으로 변경되었습니다!</p>
              <span className="text-xs text-gray-400 mt-1 block">{newEmail}</span>
            </div>
          )}
        </div>
        {step !== 3 && (
          <div className="flex justify-end gap-2 px-5 py-3 border-t">
            <button className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-500" onClick={onClose}>취소</button>
            {step === 2 && (
              <button
                className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "#1e2a6e" }}
                onClick={handleConfirm}
                disabled={confirming || timer === 0}
                data-testid="button-confirm-code"
              >
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "확인 완료 →"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepDot({ num, state }: { num: string; state: "default" | "active" | "done" }) {
  const bg = state === "done" ? "bg-green-500 text-white" : state === "active" ? "bg-[#1e2a6e] text-white" : "bg-gray-200 text-gray-400";
  return (
    <div className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${bg}`}>
      {state === "done" ? "✓" : num}
    </div>
  );
}

function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const getStrength = (pw: string) => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[0-9]/.test(pw) && /[a-zA-Z]/.test(pw)) s++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pw)) s++;
    return s;
  };

  const strength = getStrength(newPw);
  const match = confirmPw ? newPw === confirmPw : null;

  const handleSave = async () => {
    if (!curPw || !newPw || !confirmPw) {
      toast({ title: "모든 항목을 입력해 주세요.", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "새 비밀번호가 일치하지 않습니다.", variant: "destructive" });
      return;
    }
    if (newPw.length < 8) {
      toast({ title: "비밀번호는 8자 이상이어야 합니다.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/member/change-password", { currentPassword: curPw, newPassword: newPw });
      const data = await res.json();
      if (data.success) {
        toast({ title: "비밀번호가 변경되었습니다." });
        onClose();
      }
    } catch (err: any) {
      const msg = err.message?.includes(":") ? err.message.split(":").slice(1).join(":").trim() : "비밀번호 변경에 실패했습니다.";
      try { const parsed = JSON.parse(msg); toast({ title: parsed.message || msg, variant: "destructive" }); } catch { toast({ title: msg, variant: "destructive" }); }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center" onClick={onClose} data-testid="modal-password-change">
      <div className="bg-white rounded-xl w-[440px] max-w-[calc(100vw-32px)] shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <div className="text-sm font-bold flex items-center gap-2"><Lock className="h-4 w-4" /> 비밀번호 변경</div>
          <button className="text-gray-400 hover:bg-gray-100 rounded px-1.5 py-0.5 text-base" onClick={onClose}>✕</button>
        </div>
        <div className="p-5 space-y-3">
          <PwField label="현재 비밀번호" required placeholder="현재 비밀번호 입력" value={curPw} onChange={setCurPw} show={showCur} onToggle={() => setShowCur(!showCur)} testId="input-current-pw" />
          <div>
            <PwField label="새 비밀번호" required placeholder="8자 이상, 영문+숫자+특수문자" value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(!showNew)} testId="input-new-pw" />
            <div className="flex gap-1 mt-1.5">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className="flex-1 h-[3px] rounded-sm transition-all"
                  style={{
                    background: strength >= level
                      ? level === 1 ? "#dc2626" : level === 2 ? "#f5a623" : "#16a34a"
                      : "#e5e7eb"
                  }}
                />
              ))}
            </div>
            {newPw && (
              <div className="text-[11px] mt-0.5" style={{ color: strength === 1 ? "#dc2626" : strength === 2 ? "#f5a623" : "#16a34a" }}>
                {strength === 1 && "약함 — 숫자와 특수문자를 추가해 주세요"}
                {strength === 2 && "보통 — 특수문자 추가 시 더 안전해요"}
                {strength === 3 && "강함 ✓"}
              </div>
            )}
          </div>
          <div>
            <PwField label="새 비밀번호 확인" required placeholder="새 비밀번호를 한 번 더 입력" value={confirmPw} onChange={setConfirmPw} show={showConfirm} onToggle={() => setShowConfirm(!showConfirm)} testId="input-confirm-pw" />
            {match !== null && (
              <div className={`text-[11px] mt-0.5 ${match ? "text-green-600" : "text-red-500"}`}>
                {match ? "✓ 비밀번호가 일치합니다" : "✗ 비밀번호가 일치하지 않습니다"}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t">
          <button className="border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-500" onClick={onClose}>취소</button>
          <button
            className="rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "#1e2a6e" }}
            onClick={handleSave}
            disabled={saving}
            data-testid="button-submit-pw-change"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "✅ 비밀번호 변경"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PwField({ label, required, placeholder, value, onChange, show, onToggle, testId }: {
  label: string; required?: boolean; placeholder: string; value: string;
  onChange: (v: string) => void; show: boolean; onToggle: () => void; testId: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
        {label} {required && <span className="text-red-500 text-sm">*</span>}
      </div>
      <div className="relative">
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-blue-400"
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testId}
        />
        <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" onClick={onToggle} type="button">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
