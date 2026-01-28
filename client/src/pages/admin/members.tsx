import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Users, Clock, UserCheck, Rocket, Car, Crown, Trash2 } from "lucide-react";
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
  const [sortBy, setSortBy] = useState<string>("newest");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  
  const [bulkGrade, setBulkGrade] = useState<string>("none");
  const [bulkDepositAdjust, setBulkDepositAdjust] = useState("");
  const [bulkPointAdjust, setBulkPointAdjust] = useState("");
  const [bulkMemoAdd, setBulkMemoAdd] = useState("");
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<MemberWithoutPassword | null>(null);

  const { data: members = [], isLoading } = useQuery<MemberWithoutPassword[]>({
    queryKey: ["/api/admin/members"],
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
    setSortBy("newest");
  };

  const handleExcelDownload = () => {
    const data = filteredMembers.map(m => ({
      "상호명": m.companyName,
      "아이디": m.username,
      "등급": memberGradeLabels[m.grade as MemberGrade] || m.grade,
      "예치금": m.deposit,
      "포인트": m.point,
      "연락처": m.phone,
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
    { key: "grade", label: "등급", render: (m) => (
      <Badge className={gradeColors[m.grade]}>{memberGradeLabels[m.grade as MemberGrade]}</Badge>
    )},
    { key: "deposit", label: "예치금", className: "text-right", render: (m) => `${formatNumber(m.deposit)}원` },
    { key: "point", label: "포인트", className: "text-right", render: (m) => `${formatNumber(m.point)}P` },
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
          <Button size="sm" variant="outline" onClick={handleExcelDownload} data-testid="button-excel">
            <Download className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">엑셀</span>
          </Button>
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
              <MobileCardField label="예치금" value={`${formatNumber(member.deposit)}원`} />
              <MobileCardField label="포인트" value={`${formatNumber(member.point)}P`} />
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
    </div>
  );
}
