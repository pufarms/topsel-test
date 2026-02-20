import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ChevronDown, ChevronUp, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PublicHeader } from "@/components/public/PublicHeader";
import type { Page } from "@shared/schema";

declare global {
  interface Window {
    PortOne: {
      requestIdentityVerification: (params: {
        storeId: string;
        channelKey: string;
        identityVerificationId: string;
      }) => Promise<{ code?: string; message?: string }>;
    };
  }
}

interface RegisterPageContent {
  title?: string;
  description?: string;
  sections?: {
    member_info?: { title?: string };
    business_info?: { title?: string };
    manager_info?: { title?: string; description?: string };
    documents?: { title?: string };
    terms?: { title?: string };
    verification?: { title?: string; description?: string; button_text?: string };
    signature?: { title?: string; description?: string };
  };
  labels?: Record<string, string>;
  placeholders?: Record<string, string>;
  terms_content?: {
    service?: { title?: string; content?: string };
    privacy?: { title?: string; content?: string };
    third_party?: { title?: string; content?: string };
  };
  messages?: {
    success?: string;
    error?: string;
    password_mismatch?: string;
    password_match?: string;
    password_min_length?: string;
    signature_required?: string;
    verification_required?: string;
    terms_required?: string;
  };
  submit_button?: string;
}

export default function Register() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [portoneConfig, setPortoneConfig] = useState({ storeId: '', channelKey: '', configured: false });
  const [expandedTerms, setExpandedTerms] = useState<number[]>([]);
  const [agreements, setAgreements] = useState({ agree1: false, agree2: false, agree3: false });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [signatureData, setSignatureData] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [isKakaoFriendAdded, setIsKakaoFriendAdded] = useState(false);
  const [kakaoChannelId, setKakaoChannelId] = useState<string>('');
  
  const passwordMatch = passwordConfirm.length > 0 ? password === passwordConfirm : null;

  const { data: pageData } = useQuery<Page>({
    queryKey: ["/api/pages/by-path", { path: "/register" }],
    queryFn: async () => {
      const res = await fetch("/api/pages/by-path?path=/register");
      if (!res.ok) throw new Error("Failed to fetch page");
      return res.json();
    },
  });

  const content = (pageData?.content as RegisterPageContent) || {};
  const sections = content.sections || {};
  const labels = content.labels || {};
  const placeholders = content.placeholders || {};
  const messages = content.messages || {};
  const termsContent = content.terms_content || {};

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.portone.io/v2/browser-sdk.js';
    script.async = true;
    document.head.appendChild(script);

    fetch('/api/config/portone')
      .then(res => res.json())
      .then(config => {
        setPortoneConfig(config);
      })
      .catch(err => console.error('포트원 설정 로드 실패:', err));

    fetch('/api/config/kakao-channel')
      .then(res => res.json())
      .then(config => {
        if (config.channelId) {
          setKakaoChannelId(config.channelId);
        }
      })
      .catch(err => console.error('카카오채널 설정 로드 실패:', err));

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 200;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    setLastPos(getPos(e, canvas));
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    setLastPos(pos);
    setSignatureData(canvas.toDataURL());
  }, [isDrawing, lastPos, getPos]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureData('');
    }
  };

  const toggleTerm = (index: number) => {
    setExpandedTerms(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleVerification = async () => {
    if (!portoneConfig.configured) {
      toast({ variant: "destructive", title: "오류", description: "본인인증 설정이 완료되지 않았습니다." });
      return;
    }

    const identityVerificationId = 'auth_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    try {
      const response = await window.PortOne.requestIdentityVerification({
        storeId: portoneConfig.storeId,
        channelKey: portoneConfig.channelKey,
        identityVerificationId,
      });

      if (response.code) {
        toast({ variant: "destructive", title: "본인인증 실패", description: response.message || response.code });
        return;
      }

      const verifyRes = await fetch('/api/auth/get-certification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityVerificationId }),
      });

      const data = await verifyRes.json();

      if (data.success) {
        const ceoNameInput = document.querySelector<HTMLInputElement>('input[name="ceo_name"]');
        const ceoPhoneInput = document.querySelector<HTMLInputElement>('input[name="ceo_phone"]');
        const ceoBirthInput = document.querySelector<HTMLInputElement>('input[name="ceo_birth"]');
        const ceoCiInput = document.querySelector<HTMLInputElement>('input[name="ceo_ci"]');
        
        if (ceoNameInput) ceoNameInput.value = data.name;
        if (ceoPhoneInput) ceoPhoneInput.value = data.phone;
        if (ceoBirthInput) ceoBirthInput.value = data.birth || '';
        if (ceoCiInput) ceoCiInput.value = data.ci || '';
        
        setIsVerified(true);
        toast({ title: "본인인증 완료", description: "대표자 정보가 자동 입력되었습니다." });
      } else {
        toast({ variant: "destructive", title: "인증 실패", description: data.message });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "오류", description: error.message || "인증 처리 중 오류가 발생했습니다." });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);

    const password = formData.get('password') as string;
    const passwordConfirm = formData.get('password_confirm') as string;

    if (password !== passwordConfirm) {
      toast({ variant: "destructive", title: "오류", description: messages.password_mismatch || "비밀번호가 일치하지 않습니다." });
      return;
    }

    if (!signatureData) {
      toast({ variant: "destructive", title: "오류", description: messages.signature_required || "전자 서명을 해주세요." });
      return;
    }

    if (!agreements.agree1 || !agreements.agree2 || !agreements.agree3) {
      toast({ variant: "destructive", title: "오류", description: messages.terms_required || "필수 약관에 동의해주세요." });
      return;
    }

    if (!isKakaoFriendAdded) {
      toast({ variant: "destructive", title: "오류", description: "카카오채널 친구추가를 완료해주세요." });
      return;
    }

    formData.append('signature_data', signatureData);

    setIsLoading(true);
    try {
      const response = await fetch('/register', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: "회원가입 완료", description: messages.success || "관리자 승인 후 이용 가능합니다." });
        setTimeout(() => window.location.href = '/', 2000);
      } else {
        toast({ variant: "destructive", title: "회원가입 실패", description: data.message || messages.error });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "오류", description: error.message || "회원가입 처리 중 오류가 발생했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 via-background to-primary/10 flex flex-col">
      <PublicHeader />
      
      <main className="flex-1 flex items-center justify-center p-4 pt-20 pb-10">
        <Card className="w-full max-w-2xl shadow-2xl">
          <CardHeader className="text-center bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg">
            <CardTitle className="text-2xl md:text-3xl">{content.title || "탑셀러 회원가입"}</CardTitle>
            <CardDescription className="text-primary-foreground/80">{content.description || "30년 과일 유통 경력의 믿을 수 있는 파트너"}</CardDescription>
          </CardHeader>
          
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6" encType="multipart/form-data">
              
              <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">{sections.member_info?.title || "회원정보"}</h3>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="member_name">{labels.member_name || "회원명"} <span className="text-destructive">*</span></Label>
                    <Input id="member_name" name="member_name" required maxLength={6} placeholder={placeholders.member_name || "한글 6자 이내"} data-testid="input-member-name" />
                    <p className="text-xs text-muted-foreground mt-1">입금 시 자동매칭을 위하여 한글 6자 이내로 입력</p>
                  </div>
                  <div>
                    <Label htmlFor="user_id">{labels.user_id || "아이디"} <span className="text-destructive">*</span></Label>
                    <Input id="user_id" name="user_id" required placeholder={placeholders.user_id || "사용하실 아이디"} data-testid="input-user-id" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="password">{labels.password || "비밀번호"} <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Input 
                          id="password" 
                          name="password" 
                          type={showPassword ? "text" : "password"} 
                          required 
                          minLength={6} 
                          placeholder={placeholders.password || "6자 이상"} 
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-10"
                          data-testid="input-password" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="password_confirm">{labels.password_confirm || "비밀번호 확인"} <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <Input 
                          id="password_confirm" 
                          name="password_confirm" 
                          type={showPasswordConfirm ? "text" : "password"} 
                          required 
                          placeholder={placeholders.password_confirm || "비밀번호 확인"} 
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          className={`pr-24 ${passwordMatch === false ? "border-destructive" : passwordMatch === true ? "border-green-500" : ""}`}
                          data-testid="input-password-confirm" 
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                          {passwordMatch !== null && (
                            <span className={`text-sm font-medium flex items-center gap-1 ${passwordMatch ? "text-green-600" : "text-destructive"}`}>
                              {passwordMatch ? (
                                <><Check className="w-4 h-4" /> {messages.password_match || "일치"}</>
                              ) : (
                                <><AlertCircle className="w-4 h-4" /> {messages.password_mismatch || "불일치"}</>
                              )}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                            className="text-muted-foreground hover:text-foreground"
                            data-testid="button-toggle-password-confirm"
                          >
                            {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  {sections.business_info?.title || "사업자 정보"}
                  <span className="text-sm font-normal text-blue-500 ml-2">세금계산서 발행을 위해 정확하게 입력해 주세요!</span>
                </h3>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="biz_name">{labels.biz_name || "상호명"} <span className="text-destructive">*</span> <span className="text-xs text-blue-500 font-normal ml-1">사업자등록 상호명</span> <span className="text-xs text-destructive font-normal ml-1">입금자명이 아닙니다, 입금자명=회원명</span></Label>
                    <Input id="biz_name" name="biz_name" required placeholder={placeholders.biz_name || "사업자 상호명"} data-testid="input-biz-name" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="biz_no">{labels.biz_no || "사업자번호"} <span className="text-destructive">*</span></Label>
                      <Input id="biz_no" name="biz_no" required placeholder={placeholders.biz_no || "123-45-67890"} data-testid="input-biz-no" />
                    </div>
                    <div>
                      <Label htmlFor="mail_no">{labels.mail_no || "통신판매번호"} <span className="text-destructive">*</span></Label>
                      <Input id="mail_no" name="mail_no" required placeholder={placeholders.mail_no || "제2023-경북-000호"} data-testid="input-mail-no" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="biz_type">업태 <span className="text-destructive">*</span></Label>
                      <Input id="biz_type" name="biz_type" required placeholder="예: 도매 및 소매업" data-testid="input-biz-type" />
                    </div>
                    <div>
                      <Label htmlFor="biz_class">종목 <span className="text-destructive">*</span></Label>
                      <Input id="biz_class" name="biz_class" required placeholder="예: 식료품, 농산물" data-testid="input-biz-class" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="address">{labels.address || "사업장 주소"} <span className="text-destructive">*</span></Label>
                    <Input id="address" name="address" required placeholder={placeholders.address || "전체 주소"} data-testid="input-address" />
                  </div>
                  <div>
                    <Label htmlFor="email">{labels.email || "이메일"} <span className="text-destructive">*</span></Label>
                    <Input id="email" name="email" type="email" required placeholder={placeholders.email || "example@email.com"} data-testid="input-email" />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">{sections.manager_info?.title || "담당자 정보 (선택)"}</h3>
                <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{sections.manager_info?.description || "담당자 정보를 입력하시면 주문 관련 알림을 자동으로 발송해드립니다. (최대 3명)"}</span>
                </div>
                {[1, 2, 3].map((num) => (
                  <div key={num} className="space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`manager${num}_name`}>담당자{num} (역할)</Label>
                        <Input id={`manager${num}_name`} name={`manager${num}_name`} placeholder={`예: 홍길동(${num === 1 ? '주문' : num === 2 ? '배송' : 'CS'}담당)`} data-testid={`input-manager${num}-name`} />
                      </div>
                      <div>
                        <Label htmlFor={`manager${num}_phone`}>담당자{num} 휴대폰</Label>
                        <Input id={`manager${num}_phone`} name={`manager${num}_phone`} placeholder="010-0000-0000" data-testid={`input-manager${num}-phone`} />
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">{sections.documents?.title || "서류 업로드"}</h3>
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="bizFile">{labels.biz_file || "사업자등록증"} <span className="text-destructive">*</span></Label>
                    <Input id="bizFile" name="bizFile" type="file" required accept="image/*,.pdf" className="cursor-pointer" data-testid="input-biz-file" />
                  </div>
                  <div>
                    <Label htmlFor="mailFile">{labels.mail_file || "통신판매업신고증"} <span className="text-destructive">*</span></Label>
                    <Input id="mailFile" name="mailFile" type="file" required accept="image/*,.pdf" className="cursor-pointer" data-testid="input-mail-file" />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">
                  카카오채널 친구추가 <span className="text-destructive">*</span>
                </h3>
                <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-[#FEE500] rounded-full flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#3C1E1E">
                        <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.68 6.78-.15.53-.52 1.9-.6 2.2-.1.37.14.37.29.27.12-.08 1.84-1.22 2.58-1.71.67.1 1.37.16 2.05.16 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
                        탑셀러 카카오채널 친구추가
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                        긴급 상품 가격정보, 할인상품 정보 등 중요 알림을 받으시려면 카카오채널 친구추가가 필요합니다.
                      </p>
                      {isKakaoFriendAdded ? (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
                          <Check className="w-5 h-5" />
                          <span>친구추가 완료</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Button
                            type="button"
                            onClick={() => {
                              if (kakaoChannelId) {
                                window.open(`https://pf.kakao.com/${kakaoChannelId}`, '_blank');
                              } else {
                                toast({
                                  title: "카카오채널 설정 필요",
                                  description: "관리자에게 문의해주세요.",
                                  variant: "destructive",
                                });
                              }
                            }}
                            className="bg-[#FEE500] text-[#3C1E1E] font-medium"
                            data-testid="button-kakao-add-friend"
                          >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" fill="#3C1E1E">
                              <path d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.68 6.78-.15.53-.52 1.9-.6 2.2-.1.37.14.37.29.27.12-.08 1.84-1.22 2.58-1.71.67.1 1.37.16 2.05.16 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z"/>
                            </svg>
                            카카오채널 친구추가
                          </Button>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="kakao-friend-confirm"
                              checked={isKakaoFriendAdded}
                              onCheckedChange={(checked) => setIsKakaoFriendAdded(!!checked)}
                              data-testid="checkbox-kakao-friend"
                            />
                            <Label htmlFor="kakao-friend-confirm" className="text-sm cursor-pointer text-amber-700 dark:text-amber-300">
                              친구추가를 완료했습니다
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">{sections.verification?.title || "대표자 본인인증"}</h3>
                {!isKakaoFriendAdded && (
                  <div className="bg-amber-50 dark:bg-amber-950 p-3 rounded-lg text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>카카오채널 친구추가를 먼저 완료해주세요.</span>
                  </div>
                )}
                {isKakaoFriendAdded && (
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{sections.verification?.description || "휴대폰 본인인증을 통해 대표자 정보를 자동으로 입력합니다."}</span>
                  </div>
                )}
                <Button 
                  type="button" 
                  onClick={handleVerification}
                  disabled={isVerified || !isKakaoFriendAdded}
                  className="w-full"
                  variant={isVerified ? "outline" : "default"}
                  data-testid="button-verification"
                >
                  {isVerified ? (
                    <><Check className="mr-2 h-4 w-4" /> 본인인증 완료</>
                  ) : !isKakaoFriendAdded ? (
                    "카카오채널 친구추가 후 인증 가능"
                  ) : (
                    sections.verification?.button_text || "휴대폰 본인인증 하기"
                  )}
                </Button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ceo_name">{labels.ceo_name || "대표자명"} <span className="text-destructive">*</span></Label>
                    <Input id="ceo_name" name="ceo_name" required disabled={!isVerified} placeholder="본인인증 후 자동입력" data-testid="input-ceo-name" />
                  </div>
                  <div>
                    <Label htmlFor="ceo_phone">{labels.ceo_phone || "대표자 연락처"} <span className="text-destructive">*</span></Label>
                    <Input id="ceo_phone" name="ceo_phone" required disabled={!isVerified} placeholder="본인인증 후 자동입력" data-testid="input-ceo-phone" />
                  </div>
                </div>
                <input type="hidden" name="ceo_birth" />
                <input type="hidden" name="ceo_ci" />

                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-base font-medium mb-3">{sections.terms?.title || "약관 동의"}</h4>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    {[
                      { key: 'service', title: termsContent.service?.title || "서비스 이용약관", content: termsContent.service?.content || "본 약관은 현 농업회사법인 주식회사가 제공하는 탑셀러 서비스의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임사항을 규정합니다." },
                      { key: 'privacy', title: termsContent.privacy?.title || "개인정보 수집 및 이용 동의", content: termsContent.privacy?.content || "서비스 제공 및 계약 이행, 회원 관리 및 본인 확인, 고지사항 전달 및 민원 처리를 위해 개인정보를 수집합니다." },
                      { key: 'third_party', title: termsContent.third_party?.title || "개인정보 제3자 제공 동의", content: termsContent.third_party?.content || "택배사(CJ대한통운, 롯데택배 등)에 수령인 성명, 전화번호, 배송지 주소를 제공합니다. 배송 완료 후 3개월간 보유됩니다." },
                    ].map((term, index) => (
                      <div key={term.key} className="bg-background rounded-lg border">
                        <div 
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleTerm(index)}
                        >
                          <span className="font-medium text-sm">{index + 1}. {term.title}</span>
                          {expandedTerms.includes(index) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                        {expandedTerms.includes(index) && (
                          <div className="p-3 pt-0 text-sm text-muted-foreground border-t">
                            {term.content}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <div className="space-y-2 pt-2">
                      {[
                        { id: 'agree1', label: '[필수] 위 서비스 이용약관 내용에 동의합니다.' },
                        { id: 'agree2', label: '[필수] 개인정보 수집 및 이용에 동의합니다.' },
                        { id: 'agree3', label: '[필수] 개인정보 제3자 제공에 동의합니다.' },
                      ].map((item) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-background rounded">
                          <Checkbox 
                            id={item.id} 
                            checked={agreements[item.id as keyof typeof agreements]}
                            onCheckedChange={(checked) => setAgreements(prev => ({ ...prev, [item.id]: !!checked }))}
                            data-testid={`checkbox-${item.id}`}
                          />
                          <Label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">{sections.signature?.title || "약관 동의 전자 서명 (필수)"}</h3>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2 mb-4">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{sections.signature?.description || "아래 서명란에 본인의 서명을 작성해주세요. 이는 전자서명법에 의거한 법적 효력이 있습니다."}</span>
                  </div>
                  <canvas
                    ref={canvasRef}
                    className="w-full h-[200px] border-2 border-primary rounded-lg bg-white cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    data-testid="canvas-signature"
                  />
                  <Button type="button" variant="destructive" size="sm" onClick={clearSignature} className="mt-2" data-testid="button-clear-signature">
                    서명 지우기
                  </Button>
                </div>
              </section>

              <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading} data-testid="button-submit">
                {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {content.submit_button || "회원가입 신청하기"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                회원가입 신청 후 관리자 승인이 완료되면 서비스를 이용하실 수 있습니다.
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
