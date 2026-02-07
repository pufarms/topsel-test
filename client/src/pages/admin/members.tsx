import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Users, Clock, UserCheck, Rocket, Car, Crown, Trash2, UserPlus, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Member, MemberGrade } from "@shared/schema";
import { memberGradeLabels } from "@shared/schema";
import * as XLSX from "xlsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PageHeader,
  StatCard,
  StatCardsGrid,
  FilterSection,
  FilterField,
  DataTable,
  ActionSection,
  MobileCard,
  MobileCardField,
  MobileCardsList,
  type Column
} from "@/components/admin";

type MemberWithoutPassword = Omit<Member, "password">;

interface MemberStats {
  total: number;
  pending: number;
  associate: number;
  start: number;
  driving: number;
  top: number;
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

function formatNumber(num: number): string {
  return num.toLocaleString("ko-KR");
}

export default function MembersPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [searchCompany, setSearchCompany] = useState("");
  const [searchUsername, setSearchUsername] = useState("");
  const [companySelectMode, setCompanySelectMode] = useState<"direct" | string>("all");
  const [usernameSelectMode, setUsernameSelectMode] = useState<"direct" | string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterPostOffice, setFilterPostOffice] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  const [bulkGrade, setBulkGrade] = useState<string>("none");
  const [bulkPostOffice, setBulkPostOffice] = useState<string>("none");
  const [bulkDepositAdjust, setBulkDepositAdjust] = useState("");
  const [bulkPointAdjust, setBulkPointAdjust] = useState("");
  const [bulkMemoAdd, setBulkMemoAdd] = useState("");
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<MemberWithoutPassword | null>(null);
  
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);
  const [quickRegisterForm, setQuickRegisterForm] = useState({
    companyName: "",
    username: "",
    password: "",
    businessNumber: "",
    representative: "",
    phone: "",
    email: "",
    grade: "PENDING",
  });

  const { data: members = [], isLoading } = useQuery<MemberWithoutPassword[]>({
    queryKey: ["/api/admin/members"],
  });

  const quickRegisterMutation = useMutation({
    mutationFn: async (data: typeof quickRegisterForm) => {
      const res = await apiRequest("POST", "/api/admin/members/quick-register", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members/stats"] });
      toast({ title: "회원이 등록되었습니다" });
      setQuickRegisterOpen(false);
      setQuickRegisterForm({
        companyName: "",
        username: "",
        password: "",
        businessNumber: "",
        representative: "",
        phone: "",
        email: "",
        grade: "PENDING",
      });
    },
    onError: (error: any) => {
      toast({ title: "등록 실패", description: error.message || "회원 등록 중 오류가 발생했습니다", variant: "destructive" });
    },
  });

  const { data: stats } = useQuery<MemberStats>({
    queryKey: ["/api/admin/members/stats"],
  });

  const uniqueCompanyNames = Array.from(new Set(members.map(m => m.companyName))).sort((a, b) => a.localeCompare(b));
  const uniqueUsernames = Array.from(new Set(members.map(m => m.username))).sort((a, b) => a.localeCompare(b));

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: { memberIds: string[]; grade?: string; depositAdjust?: number; pointAdjust?: number; memoAdd?: string }) => {
      const res = await apiRequest("POST", "/api/admin/members/bulk-update", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members/stats"] });
      toast({ title: "선택한 회원이 업데이트되었습니다" });
      setSelectedMembers([]);
      setBulkGrade("none");
      setBulkDepositAdjust("");
      setBulkPointAdjust("");
      setBulkMemoAdd("");
    },
    onError: () => {
      toast({ title: "업데이트 실패", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/members/${memberId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/members/stats"] });
      toast({ title: "회원이 삭제되었습니다" });
      setDeleteDialogOpen(false);
      setMemberToDelete(null);
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const handleDeleteClick = (e: React.MouseEvent, member: MemberWithoutPassword) => {
    e.stopPropagation();
    setMemberToDelete(member);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (memberToDelete) {
      deleteMutation.mutate(memberToDelete.id);
    }
  };

  const filteredMembers = members
    .filter(m => {
      if (filterGrade !== "all" && m.grade !== filterGrade) return false;
      if (filterPostOffice === "true" && !m.postOfficeEnabled) return false;
      if (filterPostOffice === "false" && m.postOfficeEnabled) return false;
      if (companySelectMode === "direct") {
        if (searchCompany && !m.companyName.toLowerCase().includes(searchCompany.toLowerCase())) return false;
      } else if (companySelectMode !== "all") {
        if (m.companyName !== companySelectMode) return false;
      }
      if (usernameSelectMode === "direct") {
        if (searchUsername && !m.username.toLowerCase().includes(searchUsername.toLowerCase())) return false;
      } else if (usernameSelectMode !== "all") {
        if (m.username !== usernameSelectMode) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "company": return a.companyName.localeCompare(b.companyName);
        case "deposit": return b.deposit - a.deposit;
        default: return 0;
      }
    });

  const handleSelectAll = (checked: boolean) => {
    setSelectedMembers(checked ? filteredMembers.map(m => m.id) : []);
  };

  const handleSelectMember = (memberId: string, checked: boolean) => {
    setSelectedMembers(checked 
      ? [...selectedMembers, memberId] 
      : selectedMembers.filter(id => id !== memberId)
    );
  };

  const handleBulkUpdate = () => {
    if (selectedMembers.length === 0) {
      toast({ title: "선택된 회원이 없습니다", variant: "destructive" });
      return;
    }
    const updateData: any = { memberIds: selectedMembers };
    if (bulkGrade && bulkGrade !== "none") updateData.grade = bulkGrade;
    if (bulkPostOffice === "true") updateData.postOfficeEnabled = true;
    if (bulkPostOffice === "false") updateData.postOfficeEnabled = false;
    if (bulkDepositAdjust) updateData.depositAdjust = parseInt(bulkDepositAdjust);
    if (bulkPointAdjust) updateData.pointAdjust = parseInt(bulkPointAdjust);
    if (bulkMemoAdd) updateData.memoAdd = bulkMemoAdd;
    bulkUpdateMutation.mutate(updateData);
  };

  const handleReset = () => {
    setSearchCompany("");
    setSearchUsername("");
    setCompanySelectMode("all");
    setUsernameSelectMode("all");
    setFilterGrade("all");
    setFilterPostOffice("all");
    setSortBy("newest");
  };

  const handleExcelDownload = () => {
    const data = filteredMembers.map(m => ({
      "상호명": m.companyName,
      "아이디": m.username,
      "회원명": m.memberName || "",
      "등급": memberGradeLabels[m.grade as MemberGrade] || m.grade,
      "대표자명": m.representative || "",
      "대표연락처": m.phone || "",
      "이메일": m.email || "",
      "사업자번호": m.businessNumber || "",
      "통신판매번호": m.mailNo || "",
      "사업장주소": m.businessAddress || "",
      "담당자1": m.managerName || "",
      "담당자1연락처": m.managerPhone || "",
      "담당자2": m.manager2Name || "",
      "담당자2연락처": m.manager2Phone || "",
      "담당자3": m.manager3Name || "",
      "담당자3연락처": m.manager3Phone || "",
      "예치금": m.deposit,
      "포인트": m.point,
      "우체국양식": m.postOfficeEnabled ? "사용" : "미사용",
      "상태": m.status,
      "가입일": formatDate(m.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "회원목록");
    XLSX.writeFile(wb, `회원목록_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const columns: Column<MemberWithoutPassword>[] = [
    { key: "companyName", label: "상호명", render: (m) => <span className="font-medium">{m.companyName}</span> },
    { key: "username", label: "아이디", className: "text-muted-foreground" },
    { key: "memberName", label: "회원명", render: (m) => m.memberName || "-" },
    { key: "grade", label: "등급", render: (m) => (
      <Badge className={gradeColors[m.grade]}>{memberGradeLabels[m.grade as MemberGrade]}</Badge>
    )},
    { key: "representative", label: "대표자", render: (m) => m.representative || "-" },
    { key: "phone", label: "대표연락처", render: (m) => m.phone || "-" },
    { key: "email", label: "이메일", render: (m) => m.email || "-" },
    { key: "deposit", label: "예치금", className: "text-right", render: (m) => `${formatNumber(m.deposit)}원` },
    { key: "point", label: "포인트", className: "text-right", render: (m) => `${formatNumber(m.point)}P` },
    { key: "postOfficeEnabled", label: "우체국", render: (m) => (
      <Badge variant={m.postOfficeEnabled ? "default" : "secondary"}>{m.postOfficeEnabled ? "사용" : "미사용"}</Badge>
    )},
    { key: "status", label: "상태", render: (m) => (
      <Badge variant={m.status === "활성" ? "default" : "secondary"}>{m.status}</Badge>
    )},
    { key: "createdAt", label: "가입일", render: (m) => formatDate(m.createdAt) },
    { key: "actions", label: "관리", render: (m) => (
      <Button
        size="icon"
        variant="ghost"
        onClick={(e) => handleDeleteClick(e, m)}
        className="text-destructive hover:text-destructive"
        data-testid={`button-delete-member-${m.id}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    )},
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <PageHeader 
        title="회원관리" 
        description="검색/등급/예치금/포인트/메모/일괄 처리"
        icon={Users}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={() => setQuickRegisterOpen(true)} data-testid="button-quick-register">
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">간편 등록</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleExcelDownload} data-testid="button-excel">
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">엑셀</span>
            </Button>
          </div>
        }
      />

      <StatCardsGrid columns={6}>
        <StatCard
          label="전체 회원"
          value={stats?.total || 0}
          suffix="명"
          icon={Users}
          iconColor="bg-primary text-primary-foreground"
          isActive={filterGrade === "all"}
          onClick={() => setFilterGrade("all")}
          testId="stat-card-total"
        />
        <StatCard
          label="보류중"
          value={stats?.pending || 0}
          suffix="명"
          icon={Clock}
          iconColor="bg-yellow-500 text-white"
          isActive={filterGrade === "PENDING"}
          onClick={() => setFilterGrade("PENDING")}
          testId="stat-card-pending"
        />
        <StatCard
          label="준회원"
          value={stats?.associate || 0}
          suffix="명"
          icon={UserCheck}
          iconColor="bg-gray-500 text-white"
          isActive={filterGrade === "ASSOCIATE"}
          onClick={() => setFilterGrade("ASSOCIATE")}
          testId="stat-card-associate"
        />
        <StatCard
          label="Start회원"
          value={stats?.start || 0}
          suffix="명"
          icon={Rocket}
          iconColor="bg-blue-500 text-white"
          isActive={filterGrade === "START"}
          onClick={() => setFilterGrade("START")}
          testId="stat-card-start"
        />
        <StatCard
          label="Driving회원"
          value={stats?.driving || 0}
          suffix="명"
          icon={Car}
          iconColor="bg-green-500 text-white"
          isActive={filterGrade === "DRIVING"}
          onClick={() => setFilterGrade("DRIVING")}
          testId="stat-card-driving"
        />
        <StatCard
          label="Top회원"
          value={stats?.top || 0}
          suffix="명"
          icon={Crown}
          iconColor="bg-purple-500 text-white"
          isActive={filterGrade === "TOP"}
          onClick={() => setFilterGrade("TOP")}
          testId="stat-card-top"
        />
      </StatCardsGrid>

      <FilterSection onReset={handleReset}>
        <FilterField label="상호명">
          <Select value={companySelectMode} onValueChange={(v) => { setCompanySelectMode(v); if (v !== "direct") setSearchCompany(""); }}>
            <SelectTrigger className="h-9" data-testid="select-search-company">
              <SelectValue placeholder="상호명 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="direct">직접입력</SelectItem>
              {uniqueCompanyNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {companySelectMode === "direct" && (
            <Input placeholder="상호명 검색..." value={searchCompany} onChange={(e) => setSearchCompany(e.target.value)} className="h-9 mt-1" data-testid="input-search-company" />
          )}
        </FilterField>
        <FilterField label="아이디">
          <Select value={usernameSelectMode} onValueChange={(v) => { setUsernameSelectMode(v); if (v !== "direct") setSearchUsername(""); }}>
            <SelectTrigger className="h-9" data-testid="select-search-username">
              <SelectValue placeholder="아이디 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="direct">직접입력</SelectItem>
              {uniqueUsernames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {usernameSelectMode === "direct" && (
            <Input placeholder="아이디 검색..." value={searchUsername} onChange={(e) => setSearchUsername(e.target.value)} className="h-9 mt-1" data-testid="input-search-username" />
          )}
        </FilterField>
        <FilterField label="등급">
          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger className="h-9" data-testid="select-filter-grade">
              <SelectValue placeholder="전체 등급" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 등급</SelectItem>
              <SelectItem value="PENDING">보류중</SelectItem>
              <SelectItem value="ASSOCIATE">준회원</SelectItem>
              <SelectItem value="START">Start회원</SelectItem>
              <SelectItem value="DRIVING">Driving회원</SelectItem>
              <SelectItem value="TOP">Top회원</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="우체국양식">
          <Select value={filterPostOffice} onValueChange={setFilterPostOffice}>
            <SelectTrigger className="h-9" data-testid="select-filter-postoffice">
              <SelectValue placeholder="전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="true">사용</SelectItem>
              <SelectItem value="false">미사용</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="정렬">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9" data-testid="select-sort">
              <SelectValue placeholder="정렬 기준" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">가입일 최신순</SelectItem>
              <SelectItem value="oldest">가입일 오래된순</SelectItem>
              <SelectItem value="company">상호명순</SelectItem>
              <SelectItem value="deposit">예치금순</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterSection>

      <ActionSection
        title="일괄 수정"
        description="체크한 회원에게 적용됩니다"
        icon={Users}
        selectedCount={selectedMembers.length}
        onApply={handleBulkUpdate}
        applyLabel="일괄 적용"
        applyDisabled={selectedMembers.length === 0 || bulkUpdateMutation.isPending}
      >
        <FilterField label="등급 변경">
          <Select value={bulkGrade} onValueChange={setBulkGrade}>
            <SelectTrigger className="h-9" data-testid="select-bulk-grade">
              <SelectValue placeholder="변경 안함" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">변경 안함</SelectItem>
              <SelectItem value="PENDING">보류중</SelectItem>
              <SelectItem value="ASSOCIATE">준회원</SelectItem>
              <SelectItem value="START">Start회원</SelectItem>
              <SelectItem value="DRIVING">Driving회원</SelectItem>
              <SelectItem value="TOP">Top회원</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="우체국양식">
          <Select value={bulkPostOffice} onValueChange={setBulkPostOffice}>
            <SelectTrigger className="h-9" data-testid="select-bulk-postoffice">
              <SelectValue placeholder="변경 안함" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">변경 안함</SelectItem>
              <SelectItem value="true">사용</SelectItem>
              <SelectItem value="false">미사용</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="예치금 ±">
          <Input placeholder="예: 10000 또는 -5000" value={bulkDepositAdjust} onChange={(e) => setBulkDepositAdjust(e.target.value)} className="h-9" data-testid="input-bulk-deposit" />
        </FilterField>
        <FilterField label="포인트 ±">
          <Input placeholder="예: 1000 또는 -500" value={bulkPointAdjust} onChange={(e) => setBulkPointAdjust(e.target.value)} className="h-9" data-testid="input-bulk-point" />
        </FilterField>
        <FilterField label="메모 추가">
          <Input placeholder="기존 메모에 추가됨" value={bulkMemoAdd} onChange={(e) => setBulkMemoAdd(e.target.value)} className="h-9" data-testid="input-bulk-memo" />
        </FilterField>
      </ActionSection>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <DataTable
          title={`총 ${filteredMembers.length}명`}
          columns={columns}
          data={filteredMembers}
          keyField="id"
          onRowClick={(m) => setLocation(`/admin/members/${m.id}`)}
          selectable
          selectedIds={selectedMembers}
          onSelectAll={handleSelectAll}
          onSelectItem={handleSelectMember}
          emptyMessage="회원이 없습니다"
        />
      </div>

      {/* Mobile Cards */}
      <MobileCardsList>
        {filteredMembers.map((member) => (
          <MobileCard
            key={member.id}
            onClick={() => setLocation(`/admin/members/${member.id}`)}
            selectable
            selected={selectedMembers.includes(member.id)}
            onSelect={(checked) => handleSelectMember(member.id, checked)}
            testId={`card-member-${member.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium truncate">{member.companyName}</span>
              <div className="flex items-center gap-2">
                <Badge className={gradeColors[member.grade]}>
                  {memberGradeLabels[member.grade as MemberGrade]}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => handleDeleteClick(e, member)}
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  data-testid={`button-delete-member-mobile-${member.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">@{member.username}</p>
            <div className="space-y-1">
              <MobileCardField label="회원명" value={member.memberName || "-"} />
              <MobileCardField label="대표자" value={member.representative || "-"} />
              <MobileCardField label="대표연락처" value={member.phone || "-"} />
              <MobileCardField label="이메일" value={member.email || "-"} />
              <MobileCardField label="예치금" value={`${formatNumber(member.deposit)}원`} />
              <MobileCardField label="포인트" value={`${formatNumber(member.point)}P`} />
              <MobileCardField label="우체국양식" value={member.postOfficeEnabled ? "사용" : "미사용"} />
              <MobileCardField label="가입일" value={formatDate(member.createdAt)} />
            </div>
          </MobileCard>
        ))}
        {filteredMembers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            회원이 없습니다
          </div>
        )}
      </MobileCardsList>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>회원 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToDelete && (
                <>
                  <strong>{memberToDelete.companyName}</strong> ({memberToDelete.username}) 회원을 삭제하시겠습니까?
                  <br />
                  <span className="text-destructive">이 작업은 되돌릴 수 없습니다.</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={quickRegisterOpen} onOpenChange={setQuickRegisterOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>회원 간편 등록</DialogTitle>
            <DialogDescription>
              관리자가 직접 회원을 등록합니다. 필수 항목을 입력해 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">상호명 *</Label>
                <Input
                  id="companyName"
                  value={quickRegisterForm.companyName}
                  onChange={(e) => setQuickRegisterForm({ ...quickRegisterForm, companyName: e.target.value })}
                  placeholder="상호명 입력"
                  data-testid="input-quick-company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">아이디 *</Label>
                <Input
                  id="username"
                  value={quickRegisterForm.username}
                  onChange={(e) => setQuickRegisterForm({ ...quickRegisterForm, username: e.target.value })}
                  placeholder="로그인 아이디"
                  data-testid="input-quick-username"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호 *</Label>
                <Input
                  id="password"
                  type="password"
                  value={quickRegisterForm.password}
                  onChange={(e) => setQuickRegisterForm({ ...quickRegisterForm, password: e.target.value })}
                  placeholder="비밀번호"
                  data-testid="input-quick-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="grade">등급</Label>
                <Select
                  value={quickRegisterForm.grade}
                  onValueChange={(value) => setQuickRegisterForm({ ...quickRegisterForm, grade: value })}
                >
                  <SelectTrigger data-testid="select-quick-grade">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="businessNumber">사업자번호 *</Label>
                <Input
                  id="businessNumber"
                  value={quickRegisterForm.businessNumber}
                  onChange={(e) => setQuickRegisterForm({ ...quickRegisterForm, businessNumber: e.target.value })}
                  placeholder="000-00-00000"
                  data-testid="input-quick-business-number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="representative">대표자명 *</Label>
                <Input
                  id="representative"
                  value={quickRegisterForm.representative}
                  onChange={(e) => setQuickRegisterForm({ ...quickRegisterForm, representative: e.target.value })}
                  placeholder="대표자명"
                  data-testid="input-quick-representative"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">대표연락처 *</Label>
                <Input
                  id="phone"
                  value={quickRegisterForm.phone}
                  onChange={(e) => setQuickRegisterForm({ ...quickRegisterForm, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  data-testid="input-quick-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={quickRegisterForm.email}
                  onChange={(e) => setQuickRegisterForm({ ...quickRegisterForm, email: e.target.value })}
                  placeholder="email@example.com"
                  data-testid="input-quick-email"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickRegisterOpen(false)} data-testid="button-quick-cancel">
              취소
            </Button>
            <Button
              onClick={() => quickRegisterMutation.mutate(quickRegisterForm)}
              disabled={
                quickRegisterMutation.isPending ||
                !quickRegisterForm.companyName ||
                !quickRegisterForm.username ||
                !quickRegisterForm.password ||
                !quickRegisterForm.businessNumber ||
                !quickRegisterForm.representative ||
                !quickRegisterForm.phone
              }
              data-testid="button-quick-submit"
            >
              {quickRegisterMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  등록 중...
                </>
              ) : (
                "등록"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
