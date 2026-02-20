import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft, Save, KeyRound, UserCheck, History, User, FileText, ExternalLink, Download, Lock, Unlock, CreditCard, Fingerprint, PenTool } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Member, MemberLog, MemberGrade } from "@shared/schema";
import { memberGradeLabels, memberStatuses } from "@shared/schema";

type MemberWithoutPassword = Omit<Member, "password">;

interface MemberLogWithUser extends MemberLog {
  changedByUser?: { name: string };
}

interface MemberDetail extends MemberWithoutPassword {
  logs: MemberLogWithUser[];
}

const gradeColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ASSOCIATE: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  START: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  DRIVING: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  TOP: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default function MemberDetailPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/members/:id");
  const memberId = params?.id;

  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [gradeLockData, setGradeLockData] = useState<{
    gradeLocked: boolean;
    lockedGrade: string;
    gradeLockReason: string;
  }>({ gradeLocked: false, lockedGrade: 'START', gradeLockReason: '' });

  const [postpaidData, setPostpaidData] = useState<{
    isPostpaid: boolean;
    postpaidNote: string;
  }>({ isPostpaid: false, postpaidNote: '' });

  const [formData, setFormData] = useState<Record<string, any>>({});
  const formInitRef = useRef<string | null>(null);

  const { data: member, isLoading } = useQuery<MemberDetail>({
    queryKey: ["/api/admin/members", memberId],
    enabled: !!memberId,
  });

  useEffect(() => {
    if (member && formInitRef.current !== member.id) {
      formInitRef.current = member.id;
      setFormData({
        grade: member.grade || "",
        representative: member.representative || "",
        memberName: member.memberName || "",
        businessAddress: member.businessAddress || "",
        phone: member.phone || "",
        managerName: member.managerName || "",
        managerPhone: member.managerPhone || "",
        managerEmail: member.managerEmail || "",
        manager2Name: member.manager2Name || "",
        manager2Phone: member.manager2Phone || "",
        manager3Name: member.manager3Name || "",
        manager3Phone: member.manager3Phone || "",
        email: member.email || "",
        status: member.status || "",
        memo: member.memo || "",
        password: "",
        postOfficeEnabled: member.postOfficeEnabled ?? false,
      });
      setGradeLockData({
        gradeLocked: member.gradeLocked ?? false,
        lockedGrade: member.lockedGrade || 'START',
        gradeLockReason: member.gradeLockReason || '',
      });
      setPostpaidData({
        isPostpaid: member.isPostpaid ?? false,
        postpaidNote: member.postpaidNote || '',
      });
    }
  }, [member]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/admin/members/${memberId}`, data);
      return res.json();
    },
    onSuccess: () => {
      formInitRef.current = null;
      setFormData({});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members", memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members/stats"] });
      toast({ title: "회원 정보가 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "저장 실패", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members", memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members/stats"] });
      toast({ title: "회원이 승인되었습니다" });
    },
    onError: () => {
      toast({ title: "승인 실패", variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/reset-password`);
      return res.json();
    },
    onSuccess: (data: { tempPassword: string; email?: string }) => {
      setTempPassword(data.tempPassword);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members", memberId] });
      if (data.email) {
        toast({ 
          title: "비밀번호가 초기화되었습니다",
          description: `이메일 발송 예정: ${data.email} (TODO: 이메일 연동 필요)`
        });
      } else {
        toast({ 
          title: "비밀번호가 초기화되었습니다",
          description: "회원 이메일이 등록되어 있지 않습니다"
        });
      }
    },
    onError: () => {
      toast({ title: "비밀번호 초기화 실패", variant: "destructive" });
    },
  });

  const gradeLockMutation = useMutation({
    mutationFn: async (data: { gradeLocked: boolean; lockedGrade: string; gradeLockReason: string }) => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/grade-lock`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members", memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      toast({ title: data.message || "등급 고정 설정이 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "등급 고정 설정 실패", variant: "destructive" });
    },
  });

  const postpaidMutation = useMutation({
    mutationFn: async (data: { isPostpaid: boolean; postpaidNote: string }) => {
      const res = await apiRequest("POST", `/api/admin/members/${memberId}/postpaid`, data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members", memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      toast({ title: data.message || "후불결재 설정이 저장되었습니다" });
    },
    onError: () => {
      toast({ title: "후불결재 설정 실패", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!member) return;

    const updateData: any = {};
    const orig: Record<string, any> = {
      grade: member.grade || "",
      memberName: member.memberName || "",
      representative: member.representative || "",
      businessAddress: member.businessAddress || "",
      phone: member.phone || "",
      managerName: member.managerName || "",
      managerPhone: member.managerPhone || "",
      managerEmail: member.managerEmail || "",
      manager2Name: member.manager2Name || "",
      manager2Phone: member.manager2Phone || "",
      manager3Name: member.manager3Name || "",
      manager3Phone: member.manager3Phone || "",
      email: member.email || "",
      status: member.status || "",
      memo: member.memo || "",
      postOfficeEnabled: member.postOfficeEnabled ?? false,
    };

    const fields = [
      'grade', 'memberName', 'representative', 'businessAddress', 'phone',
      'managerName', 'managerPhone', 'managerEmail',
      'manager2Name', 'manager2Phone', 'manager3Name', 'manager3Phone',
      'email', 'status', 'memo', 'postOfficeEnabled'
    ];
    for (const key of fields) {
      if (formData[key] !== undefined && formData[key] !== orig[key]) {
        updateData[key] = formData[key];
      }
    }
    if (formData.password && formData.password.length >= 6) updateData.password = formData.password;

    if (Object.keys(updateData).length === 0) {
      toast({ title: "변경된 내용이 없습니다" });
      return;
    }

    updateMutation.mutate(updateData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">회원을 찾을 수 없습니다</p>
        <Button className="mt-4" onClick={() => setLocation("/admin/users")}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  const displayGrade = formData.grade || member.grade;
  const displayStatus = formData.status || member.status;
  const getVal = (key: string, fallback?: string) => formData[key] !== undefined ? formData[key] : (fallback ?? "");

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/users")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold">{member.companyName}</h1>
            <Badge className={gradeColors[displayGrade] || ""}>
              {member.gradeLocked && <Lock className="h-3 w-3 mr-1 inline" />}
              {memberGradeLabels[displayGrade as MemberGrade] || displayGrade}
            </Badge>
            {member.isPostpaid && (
              <Badge variant="secondary" className="no-default-active-elevate">
                후불결재
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{member.username}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Read-only Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">기본 정보</CardTitle>
              <CardDescription>아이디, 상호명, 대표자명, 사업자번호는 변경할 수 없습니다. 회원명만 수정 가능합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">아이디</Label>
                  <Input value={member.username} disabled className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">상호명</Label>
                  <Input value={member.companyName} disabled className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">회원명</Label>
                  <Input 
                    value={getVal('memberName', member.memberName || "")}
                    onChange={(e) => setFormData({...formData, memberName: e.target.value})}
                    placeholder="회원명 (뱅크다 입금자명 매칭용)"
                    data-testid="input-member-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">대표자명 (본인인증 · 세금계산서용)</Label>
                  <Input value={member.representative} disabled className="bg-muted" data-testid="input-representative" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">사업자번호</Label>
                  <Input value={member.businessNumber} disabled className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">통신판매번호</Label>
                  <Input value={member.mailNo || "-"} disabled className="bg-muted" />
                </div>
                {member.ceoBirth && (
                  <div className="space-y-1">
                    <Label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Fingerprint className="h-3.5 w-3.5" />
                      대표자 생년월일 (본인인증)
                    </Label>
                    <Input value={member.ceoBirth} disabled className="bg-muted" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Uploaded Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                등록 서류
              </CardTitle>
              <CardDescription>회원가입 시 제출한 서류</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">사업자등록증</Label>
                  {member.businessLicenseUrl ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <a 
                          href={member.businessLicenseUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline text-sm"
                          data-testid="link-business-license"
                        >
                          <ExternalLink className="h-4 w-4" />
                          파일 보기
                        </a>
                        <a 
                          href={member.businessLicenseUrl} 
                          download
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
                          data-testid="download-business-license"
                        >
                          <Download className="h-4 w-4" />
                          다운로드
                        </a>
                      </div>
                      {member.businessLicenseUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                        <img 
                          src={member.businessLicenseUrl} 
                          alt="사업자등록증" 
                          className="max-w-full h-auto rounded-md border max-h-48 object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">등록된 파일 없음</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">통신판매신고증</Label>
                  {member.mailFilePath ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <a 
                          href={member.mailFilePath} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline text-sm"
                          data-testid="link-mail-file"
                        >
                          <ExternalLink className="h-4 w-4" />
                          파일 보기
                        </a>
                        <a 
                          href={member.mailFilePath} 
                          download
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm"
                          data-testid="download-mail-file"
                        >
                          <Download className="h-4 w-4" />
                          다운로드
                        </a>
                      </div>
                      {member.mailFilePath.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                        <img 
                          src={member.mailFilePath} 
                          alt="통신판매신고증" 
                          className="max-w-full h-auto rounded-md border max-h-48 object-contain"
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">등록된 파일 없음</p>
                  )}
                </div>
              </div>
              {member.signatureData && (
                <div className="mt-4 pt-4 border-t">
                  <Label className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                    <PenTool className="h-3.5 w-3.5" />
                    약관동의 전자서명
                  </Label>
                  <div className="bg-white border rounded-lg p-2 inline-block">
                    <img 
                      src={member.signatureData} 
                      alt="전자서명" 
                      className="max-w-[300px] h-auto max-h-24 object-contain"
                      data-testid="img-signature"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editable Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">수정 가능 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm">등급</Label>
                  <Select 
                    value={getVal('grade', member.grade)} 
                    onValueChange={(v) => setFormData({...formData, grade: v})}
                  >
                    <SelectTrigger data-testid="select-grade">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">보류중</SelectItem>
                      <SelectItem value="ASSOCIATE">준회원</SelectItem>
                      <SelectItem value="START">Start회원</SelectItem>
                      <SelectItem value="DRIVING">Driving회원</SelectItem>
                      <SelectItem value="TOP">Top회원</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">상태</Label>
                  <Select 
                    value={getVal('status', member.status)} 
                    onValueChange={(v) => setFormData({...formData, status: v})}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {memberStatuses.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">우체국양식 사용</Label>
                  <Select 
                    value={String(formData.postOfficeEnabled !== undefined ? formData.postOfficeEnabled : (member.postOfficeEnabled ?? false))} 
                    onValueChange={(v) => setFormData({...formData, postOfficeEnabled: v === "true"})}
                  >
                    <SelectTrigger data-testid="select-post-office">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">사용</SelectItem>
                      <SelectItem value="false">미사용</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">대표연락처</Label>
                  <Input 
                    value={getVal('phone', member.phone)}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자1</Label>
                  <Input 
                    value={getVal('managerName', member.managerName || "")}
                    onChange={(e) => setFormData({...formData, managerName: e.target.value})}
                    data-testid="input-manager-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자1 연락처</Label>
                  <Input 
                    value={getVal('managerPhone', member.managerPhone || "")}
                    onChange={(e) => setFormData({...formData, managerPhone: e.target.value})}
                    data-testid="input-manager-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자1 이메일</Label>
                  <Input 
                    type="email"
                    value={getVal('managerEmail')}
                    onChange={(e) => setFormData({...formData, managerEmail: e.target.value})}
                    placeholder="담당자 이메일 (세금계산서 발행용)"
                    data-testid="input-manager-email"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자2</Label>
                  <Input 
                    value={getVal('manager2Name', member.manager2Name || "")}
                    onChange={(e) => setFormData({...formData, manager2Name: e.target.value})}
                    data-testid="input-manager2-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자2 연락처</Label>
                  <Input 
                    value={getVal('manager2Phone', member.manager2Phone || "")}
                    onChange={(e) => setFormData({...formData, manager2Phone: e.target.value})}
                    data-testid="input-manager2-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자3</Label>
                  <Input 
                    value={getVal('manager3Name', member.manager3Name || "")}
                    onChange={(e) => setFormData({...formData, manager3Name: e.target.value})}
                    data-testid="input-manager3-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자3 연락처</Label>
                  <Input 
                    value={getVal('manager3Phone', member.manager3Phone || "")}
                    onChange={(e) => setFormData({...formData, manager3Phone: e.target.value})}
                    data-testid="input-manager3-phone"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-sm">이메일</Label>
                  <Input 
                    type="email"
                    value={getVal('email', member.email || "")}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-sm">사업자주소</Label>
                  <Input 
                    value={getVal('businessAddress', member.businessAddress || "")}
                    onChange={(e) => setFormData({...formData, businessAddress: e.target.value})}
                    data-testid="input-address"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <Label className="text-sm">비밀번호 변경</Label>
                <Input 
                  type="password"
                  placeholder="새 비밀번호 (6자 이상)"
                  value={getVal('password')}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  data-testid="input-password"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">메모</Label>
                <Textarea 
                  placeholder="메모를 입력하세요..."
                  value={getVal('memo', member.memo || "")}
                  onChange={(e) => setFormData({...formData, memo: e.target.value})}
                  rows={4}
                  data-testid="textarea-memo"
                />
              </div>
            </CardContent>
          </Card>

          {/* Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base md:text-lg">수정 이력</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {member.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">수정 이력이 없습니다</p>
              ) : (
                <div className="hidden md:block table-scroll-container">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead>일시</TableHead>
                        <TableHead>변경유형</TableHead>
                        <TableHead>변경자</TableHead>
                        <TableHead>내용</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {member.logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{log.changeType}</Badge>
                          </TableCell>
                          <TableCell>{log.changedByUser?.name || "-"}</TableCell>
                          <TableCell>{log.description || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {member.logs.length > 0 && (
                <div className="md:hidden space-y-2">
                  {member.logs.map((log) => (
                    <div key={log.id} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline">{log.changeType}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                      </div>
                      <p className="text-sm">{log.description || "-"}</p>
                      <p className="text-xs text-muted-foreground">변경자: {log.changedByUser?.name || "-"}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">회원 상태</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">예치금</span>
                <span className="font-bold text-lg">{member.deposit.toLocaleString()}원</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">포인트</span>
                <span className="font-bold text-lg">{member.point.toLocaleString()}P</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">가입일</span>
                <span>{formatDate(member.createdAt)}</span>
              </div>
              {member.approvedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">승인일</span>
                  <span>{formatDate(member.approvedAt)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {['ASSOCIATE', 'START', 'DRIVING', 'TOP'].includes(member.grade) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  {member.gradeLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  등급 고정 설정
                </CardTitle>
                <CardDescription>
                  고정 시 월별 자동 등급 조정에서 제외됩니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">등급 고정</Label>
                  <Switch
                    checked={gradeLockData.gradeLocked !== undefined ? gradeLockData.gradeLocked : (member.gradeLocked ?? false)}
                    onCheckedChange={(checked) => setGradeLockData({
                      ...gradeLockData,
                      gradeLocked: checked,
                      lockedGrade: checked ? (gradeLockData.lockedGrade || member.lockedGrade || member.grade) : gradeLockData.lockedGrade,
                    })}
                    data-testid="switch-grade-lock"
                  />
                </div>
                {(gradeLockData.gradeLocked !== undefined ? gradeLockData.gradeLocked : member.gradeLocked) && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-sm">고정 등급</Label>
                      <Select
                        value={gradeLockData.lockedGrade || member.lockedGrade || member.grade}
                        onValueChange={(v) => setGradeLockData({ ...gradeLockData, lockedGrade: v })}
                      >
                        <SelectTrigger data-testid="select-locked-grade">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ASSOCIATE">준회원</SelectItem>
                          <SelectItem value="START">Start회원</SelectItem>
                          <SelectItem value="DRIVING">Driving회원</SelectItem>
                          <SelectItem value="TOP">Top회원</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">고정 사유 (선택)</Label>
                      <Input
                        value={gradeLockData.gradeLockReason || (member.gradeLockReason ?? '')}
                        onChange={(e) => setGradeLockData({ ...gradeLockData, gradeLockReason: e.target.value })}
                        placeholder="예: VIP 고객, 특별 계약"
                        data-testid="input-grade-lock-reason"
                      />
                    </div>
                    {member.gradeLockSetAt && (
                      <p className="text-xs text-muted-foreground">
                        설정일: {formatDateTime(member.gradeLockSetAt)}
                      </p>
                    )}
                  </>
                )}
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => gradeLockMutation.mutate({
                    gradeLocked: gradeLockData.gradeLocked !== undefined ? gradeLockData.gradeLocked : (member.gradeLocked ?? false),
                    lockedGrade: gradeLockData.lockedGrade || member.lockedGrade || member.grade,
                    gradeLockReason: gradeLockData.gradeLockReason || (member.gradeLockReason ?? ''),
                  })}
                  disabled={gradeLockMutation.isPending}
                  data-testid="button-save-grade-lock"
                >
                  {gradeLockMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                  등급 고정 저장
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                후불결재 회원 설정
              </CardTitle>
              <CardDescription>
                후불결재 회원은 잔액 없이도 주문이 가능하며, 예치금이 마이너스로 기록됩니다
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">후불결재 회원</Label>
                <Switch
                  checked={postpaidData.isPostpaid !== undefined ? postpaidData.isPostpaid : (member.isPostpaid ?? false)}
                  onCheckedChange={(checked) => setPostpaidData({
                    ...postpaidData,
                    isPostpaid: checked,
                  })}
                  data-testid="switch-postpaid"
                />
              </div>
              {(postpaidData.isPostpaid !== undefined ? postpaidData.isPostpaid : member.isPostpaid) && (
                <>
                  <div className="space-y-1">
                    <Label className="text-sm">메모/사유 (선택)</Label>
                    <Input
                      value={postpaidData.postpaidNote || (member.postpaidNote ?? '')}
                      onChange={(e) => setPostpaidData({ ...postpaidData, postpaidNote: e.target.value })}
                      placeholder="예: 대량 거래 고객, 월말 정산"
                      data-testid="input-postpaid-note"
                    />
                  </div>
                  {member.postpaidSetAt && (
                    <p className="text-xs text-muted-foreground">
                      설정일: {formatDateTime(member.postpaidSetAt)}
                    </p>
                  )}
                </>
              )}
              <Button
                className="w-full"
                variant="outline"
                onClick={() => postpaidMutation.mutate({
                  isPostpaid: postpaidData.isPostpaid !== undefined ? postpaidData.isPostpaid : (member.isPostpaid ?? false),
                  postpaidNote: postpaidData.postpaidNote || (member.postpaidNote ?? ''),
                })}
                disabled={postpaidMutation.isPending}
                data-testid="button-save-postpaid"
              >
                {postpaidMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                후불결재 설정 저장
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">작업</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full" 
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                저장
              </Button>

              {member.grade === "PENDING" && (
                <Button 
                  variant="outline"
                  className="w-full text-green-600 border-green-600 hover:bg-green-50"
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve"
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />}
                  승인
                </Button>
              )}

              <Button 
                variant="outline"
                className="w-full"
                onClick={() => setShowResetPasswordDialog(true)}
                data-testid="button-reset-password"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                비밀번호 초기화
              </Button>

              <Button 
                variant="ghost"
                className="w-full"
                onClick={() => setLocation("/admin/users")}
                data-testid="button-back-to-list"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                목록으로
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 초기화</DialogTitle>
            <DialogDescription>
              {tempPassword 
                ? "임시 비밀번호가 생성되었습니다. 회원에게 전달해 주세요."
                : "정말 비밀번호를 초기화하시겠습니까?"
              }
            </DialogDescription>
          </DialogHeader>
          {tempPassword && (
            <div className="bg-muted p-4 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">임시 비밀번호</p>
              <p className="text-2xl font-mono font-bold">{tempPassword}</p>
            </div>
          )}
          <DialogFooter>
            {tempPassword ? (
              <Button onClick={() => { setShowResetPasswordDialog(false); setTempPassword(null); }}>
                확인
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowResetPasswordDialog(false)}>
                  취소
                </Button>
                <Button 
                  onClick={() => resetPasswordMutation.mutate()}
                  disabled={resetPasswordMutation.isPending}
                >
                  {resetPasswordMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  초기화
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
