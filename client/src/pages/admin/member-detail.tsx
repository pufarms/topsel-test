import { useState } from "react";
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
import { Loader2, ArrowLeft, Save, KeyRound, UserCheck, History, User, FileText, ExternalLink, Download } from "lucide-react";
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
  return new Date(date).toLocaleDateString("ko-KR");
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("ko-KR");
}

export default function MemberDetailPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/admin/members/:id");
  const memberId = params?.id;

  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [formData, setFormData] = useState<{
    grade: string;
    representative: string;
    businessAddress: string;
    phone: string;
    managerName: string;
    managerPhone: string;
    manager2Name: string;
    manager2Phone: string;
    manager3Name: string;
    manager3Phone: string;
    email: string;
    depositAdjust: string;
    pointAdjust: string;
    status: string;
    memo: string;
    password: string;
    postOfficeEnabled: boolean;
  }>({
    grade: "",
    representative: "",
    businessAddress: "",
    phone: "",
    managerName: "",
    managerPhone: "",
    manager2Name: "",
    manager2Phone: "",
    manager3Name: "",
    manager3Phone: "",
    email: "",
    depositAdjust: "",
    pointAdjust: "",
    status: "",
    memo: "",
    password: "",
    postOfficeEnabled: false,
  });

  const { data: member, isLoading } = useQuery<MemberDetail>({
    queryKey: ["/api/admin/members", memberId],
    enabled: !!memberId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/admin/members/${memberId}`, data);
      return res.json();
    },
    onSuccess: () => {
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

  const handleSave = () => {
    if (!member) return;

    const updateData: any = {};
    
    if (formData.grade && formData.grade !== member.grade) updateData.grade = formData.grade;
    if (formData.representative && formData.representative !== member.representative) updateData.representative = formData.representative;
    if (formData.businessAddress !== (member.businessAddress || "")) updateData.businessAddress = formData.businessAddress;
    if (formData.phone && formData.phone !== member.phone) updateData.phone = formData.phone;
    if (formData.managerName !== (member.managerName || "")) updateData.managerName = formData.managerName;
    if (formData.managerPhone !== (member.managerPhone || "")) updateData.managerPhone = formData.managerPhone;
    if (formData.manager2Name !== (member.manager2Name || "")) updateData.manager2Name = formData.manager2Name;
    if (formData.manager2Phone !== (member.manager2Phone || "")) updateData.manager2Phone = formData.manager2Phone;
    if (formData.manager3Name !== (member.manager3Name || "")) updateData.manager3Name = formData.manager3Name;
    if (formData.manager3Phone !== (member.manager3Phone || "")) updateData.manager3Phone = formData.manager3Phone;
    if (formData.email !== (member.email || "")) updateData.email = formData.email;
    if (formData.status && formData.status !== member.status) updateData.status = formData.status;
    if (formData.postOfficeEnabled !== (member.postOfficeEnabled ?? false)) updateData.postOfficeEnabled = formData.postOfficeEnabled;
    if (formData.memo !== (member.memo || "")) updateData.memo = formData.memo;
    if (formData.password && formData.password.length >= 6) updateData.password = formData.password;
    
    if (formData.depositAdjust) {
      const adjust = parseInt(formData.depositAdjust);
      if (!isNaN(adjust)) updateData.deposit = member.deposit + adjust;
    }
    if (formData.pointAdjust) {
      const adjust = parseInt(formData.pointAdjust);
      if (!isNaN(adjust)) updateData.point = member.point + adjust;
    }

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
              {memberGradeLabels[displayGrade as MemberGrade] || displayGrade}
            </Badge>
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
              <CardTitle className="text-base md:text-lg">기본 정보 (수정 불가)</CardTitle>
              <CardDescription>아이디, 상호명, 사업자번호는 변경할 수 없습니다</CardDescription>
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
                  <Input value={member.memberName || "-"} disabled className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">사업자번호</Label>
                  <Input value={member.businessNumber} disabled className="bg-muted" />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">통신판매번호</Label>
                  <Input value={member.mailNo || "-"} disabled className="bg-muted" />
                </div>
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
                    value={formData.grade || member.grade} 
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
                    value={formData.status || member.status} 
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
                    value={formData.postOfficeEnabled !== undefined ? String(formData.postOfficeEnabled) : String(member.postOfficeEnabled ?? false)} 
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
                  <Label className="text-sm">대표자명</Label>
                  <Input 
                    value={formData.representative || member.representative}
                    onChange={(e) => setFormData({...formData, representative: e.target.value})}
                    data-testid="input-representative"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">대표연락처</Label>
                  <Input 
                    value={formData.phone || member.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    data-testid="input-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자1</Label>
                  <Input 
                    value={formData.managerName !== "" ? formData.managerName : (member.managerName || "")}
                    onChange={(e) => setFormData({...formData, managerName: e.target.value})}
                    data-testid="input-manager-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자1 연락처</Label>
                  <Input 
                    value={formData.managerPhone !== "" ? formData.managerPhone : (member.managerPhone || "")}
                    onChange={(e) => setFormData({...formData, managerPhone: e.target.value})}
                    data-testid="input-manager-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자2</Label>
                  <Input 
                    value={formData.manager2Name !== "" ? formData.manager2Name : (member.manager2Name || "")}
                    onChange={(e) => setFormData({...formData, manager2Name: e.target.value})}
                    data-testid="input-manager2-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자2 연락처</Label>
                  <Input 
                    value={formData.manager2Phone !== "" ? formData.manager2Phone : (member.manager2Phone || "")}
                    onChange={(e) => setFormData({...formData, manager2Phone: e.target.value})}
                    data-testid="input-manager2-phone"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자3</Label>
                  <Input 
                    value={formData.manager3Name !== "" ? formData.manager3Name : (member.manager3Name || "")}
                    onChange={(e) => setFormData({...formData, manager3Name: e.target.value})}
                    data-testid="input-manager3-name"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">담당자3 연락처</Label>
                  <Input 
                    value={formData.manager3Phone !== "" ? formData.manager3Phone : (member.manager3Phone || "")}
                    onChange={(e) => setFormData({...formData, manager3Phone: e.target.value})}
                    data-testid="input-manager3-phone"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-sm">이메일</Label>
                  <Input 
                    type="email"
                    value={formData.email !== "" ? formData.email : (member.email || "")}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-sm">사업자주소</Label>
                  <Input 
                    value={formData.businessAddress !== "" ? formData.businessAddress : (member.businessAddress || "")}
                    onChange={(e) => setFormData({...formData, businessAddress: e.target.value})}
                    data-testid="input-address"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm">예치금 조정 (+/-)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">현재: {member.deposit.toLocaleString()}원</span>
                  </div>
                  <Input 
                    placeholder="예: 10000 또는 -5000"
                    value={formData.depositAdjust}
                    onChange={(e) => setFormData({...formData, depositAdjust: e.target.value})}
                    data-testid="input-deposit-adjust"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">포인트 조정 (+/-)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">현재: {member.point.toLocaleString()}P</span>
                  </div>
                  <Input 
                    placeholder="예: 1000 또는 -500"
                    value={formData.pointAdjust}
                    onChange={(e) => setFormData({...formData, pointAdjust: e.target.value})}
                    data-testid="input-point-adjust"
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-1">
                <Label className="text-sm">비밀번호 변경</Label>
                <Input 
                  type="password"
                  placeholder="새 비밀번호 (6자 이상)"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  data-testid="input-password"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-sm">메모</Label>
                <Textarea 
                  placeholder="메모를 입력하세요..."
                  value={formData.memo !== "" ? formData.memo : (member.memo || "")}
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
