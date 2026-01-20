import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, RotateCcw, Download, Users, Clock, UserCheck, Rocket, Car, Crown, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Member, MemberGrade } from "@shared/schema";
import { memberGradeLabels } from "@shared/schema";
import * as XLSX from "xlsx";

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
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  
  const [bulkGrade, setBulkGrade] = useState<string>("none");
  const [bulkDepositAdjust, setBulkDepositAdjust] = useState("");
  const [bulkPointAdjust, setBulkPointAdjust] = useState("");
  const [bulkMemoAdd, setBulkMemoAdd] = useState("");

  const { data: members = [], isLoading } = useQuery<MemberWithoutPassword[]>({
    queryKey: ["/api/admin/members"],
  });

  const { data: stats } = useQuery<MemberStats>({
    queryKey: ["/api/admin/members/stats"],
  });

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

  const filteredMembers = members
    .filter(m => {
      if (filterGrade !== "all" && m.grade !== filterGrade) return false;
      if (searchCompany && !m.companyName.toLowerCase().includes(searchCompany.toLowerCase())) return false;
      if (searchUsername && !m.username.toLowerCase().includes(searchUsername.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "company":
          return a.companyName.localeCompare(b.companyName);
        case "deposit":
          return b.deposit - a.deposit;
        default:
          return 0;
      }
    });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMembers(filteredMembers.map(m => m.id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleSelectMember = (memberId: string, checked: boolean) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, memberId]);
    } else {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId));
    }
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

  const statCards = [
    { key: "total", label: "전체 회원", count: stats?.total || 0, icon: Users, color: "bg-primary text-primary-foreground", filter: "all" },
    { key: "pending", label: "보류중", count: stats?.pending || 0, icon: Clock, color: "bg-yellow-500 text-white", filter: "PENDING" },
    { key: "associate", label: "준회원", count: stats?.associate || 0, icon: UserCheck, color: "bg-gray-500 text-white", filter: "ASSOCIATE" },
    { key: "start", label: "Start회원", count: stats?.start || 0, icon: Rocket, color: "bg-blue-500 text-white", filter: "START" },
    { key: "driving", label: "Driving회원", count: stats?.driving || 0, icon: Car, color: "bg-green-500 text-white", filter: "DRIVING" },
    { key: "top", label: "Top회원", count: stats?.top || 0, icon: Crown, color: "bg-purple-500 text-white", filter: "TOP" },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary rounded-lg">
          <Users className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">회원관리</h1>
          <p className="text-sm text-muted-foreground">검색/등급/예치금/포인트/메모/일괄 처리</p>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-4">
        {statCards.map((card) => (
          <Card 
            key={card.key}
            className={`cursor-pointer transition-all hover:scale-105 ${filterGrade === card.filter ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFilterGrade(card.filter)}
            data-testid={`stat-card-${card.key}`}
          >
            <CardContent className="p-3 md:p-4">
              <div className={`inline-flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg ${card.color} mb-2`}>
                <card.icon className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">{card.label}</p>
              <p className="text-lg md:text-2xl font-bold">{card.count}<span className="text-sm md:text-base font-normal">명</span></p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-base md:text-lg">검색 및 필터</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <div className="space-y-1">
              <Label className="text-sm">상호명</Label>
              <Input
                placeholder="상호명 검색..."
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                data-testid="input-search-company"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">아이디</Label>
              <Input
                placeholder="아이디 검색..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                data-testid="input-search-username"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">등급</Label>
              <Select value={filterGrade} onValueChange={setFilterGrade}>
                <SelectTrigger data-testid="select-filter-grade">
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
            </div>
            <div className="space-y-1">
              <Label className="text-sm">정렬</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger data-testid="select-sort">
                  <SelectValue placeholder="정렬 기준" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">가입일 최신순</SelectItem>
                  <SelectItem value="oldest">가입일 오래된순</SelectItem>
                  <SelectItem value="company">상호명순</SelectItem>
                  <SelectItem value="deposit">예치금순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => {}} data-testid="button-search">
              <Search className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">검색</span>
            </Button>
            <Button variant="outline" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">초기화</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Edit Section */}
      <Card>
        <CardHeader className="pb-3">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowBulkEdit(!showBulkEdit)}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base md:text-lg">일괄 수정</CardTitle>
              {selectedMembers.length > 0 && (
                <Badge variant="secondary">{selectedMembers.length}명 선택</Badge>
              )}
            </div>
            {showBulkEdit ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
          <CardDescription>체크한 회원에게 적용됩니다</CardDescription>
        </CardHeader>
        {showBulkEdit && (
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="space-y-1">
                <Label className="text-sm">등급 변경</Label>
                <Select value={bulkGrade} onValueChange={setBulkGrade}>
                  <SelectTrigger data-testid="select-bulk-grade">
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
              </div>
              <div className="space-y-1">
                <Label className="text-sm">예치금 ±</Label>
                <Input
                  placeholder="예: 10000 또는 -5000"
                  value={bulkDepositAdjust}
                  onChange={(e) => setBulkDepositAdjust(e.target.value)}
                  data-testid="input-bulk-deposit"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">포인트 ±</Label>
                <Input
                  placeholder="예: 1000 또는 -500"
                  value={bulkPointAdjust}
                  onChange={(e) => setBulkPointAdjust(e.target.value)}
                  data-testid="input-bulk-point"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">메모 추가</Label>
                <Input
                  placeholder="기존 메모에 추가됨"
                  value={bulkMemoAdd}
                  onChange={(e) => setBulkMemoAdd(e.target.value)}
                  data-testid="input-bulk-memo"
                />
              </div>
            </div>
            <Button 
              className="mt-4" 
              onClick={handleBulkUpdate}
              disabled={selectedMembers.length === 0 || bulkUpdateMutation.isPending}
              data-testid="button-bulk-save"
            >
              {bulkUpdateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              선택 회원 저장
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base md:text-lg">회원 목록</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                총 {filteredMembers.length}명
              </span>
              <Button variant="outline" size="sm" onClick={handleExcelDownload} data-testid="button-excel-download">
                <Download className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">엑셀</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              등록된 회원이 없습니다
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>상호명</TableHead>
                      <TableHead>아이디</TableHead>
                      <TableHead>등급</TableHead>
                      <TableHead className="text-right">예치금</TableHead>
                      <TableHead className="text-right">포인트</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow 
                        key={member.id}
                        className="cursor-pointer hover:bg-muted/50"
                        data-testid={`row-member-${member.id}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedMembers.includes(member.id)}
                            onCheckedChange={(checked) => handleSelectMember(member.id, checked as boolean)}
                            data-testid={`checkbox-member-${member.id}`}
                          />
                        </TableCell>
                        <TableCell 
                          className="font-medium"
                          onClick={() => setLocation(`/admin/members/${member.id}`)}
                        >
                          {member.companyName}
                        </TableCell>
                        <TableCell onClick={() => setLocation(`/admin/members/${member.id}`)}>
                          {member.username}
                        </TableCell>
                        <TableCell onClick={() => setLocation(`/admin/members/${member.id}`)}>
                          <Badge className={gradeColors[member.grade] || ""}>
                            {memberGradeLabels[member.grade as MemberGrade] || member.grade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={() => setLocation(`/admin/members/${member.id}`)}>
                          {formatNumber(member.deposit)}
                        </TableCell>
                        <TableCell className="text-right" onClick={() => setLocation(`/admin/members/${member.id}`)}>
                          {formatNumber(member.point)}
                        </TableCell>
                        <TableCell onClick={() => setLocation(`/admin/members/${member.id}`)}>
                          {member.phone}
                        </TableCell>
                        <TableCell onClick={() => setLocation(`/admin/members/${member.id}`)}>
                          {formatDate(member.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile/Tablet Cards */}
              <div className="lg:hidden space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={selectedMembers.length === filteredMembers.length && filteredMembers.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all-mobile"
                  />
                  <span className="text-sm text-muted-foreground">전체 선택</span>
                </div>
                {filteredMembers.map((member) => (
                  <Card 
                    key={member.id} 
                    className="p-4"
                    data-testid={`card-member-${member.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedMembers.includes(member.id)}
                        onCheckedChange={(checked) => handleSelectMember(member.id, checked as boolean)}
                        className="mt-1"
                        data-testid={`checkbox-member-mobile-${member.id}`}
                      />
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => setLocation(`/admin/members/${member.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{member.companyName}</p>
                            <p className="text-sm text-muted-foreground">{member.username}</p>
                          </div>
                          <Badge className={gradeColors[member.grade] || ""}>
                            {memberGradeLabels[member.grade as MemberGrade] || member.grade}
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">예치금</span>
                            <p className="font-medium">{formatNumber(member.deposit)}원</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">포인트</span>
                            <p className="font-medium">{formatNumber(member.point)}P</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">연락처</span>
                            <p className="font-medium">{member.phone}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">가입일</span>
                            <p className="font-medium">{formatDate(member.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
