import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Eye, Shield, Clock, User, Building, Phone, Hash, Globe, Monitor, CheckCircle, UserX } from "lucide-react";

interface TermAgreement {
  id: string;
  memberId: string | null;
  memberUsername: string;
  memberName: string | null;
  companyName: string | null;
  businessNumber: string | null;
  representative: string | null;
  agreedAt: string;
  serviceTermVersion: string | null;
  serviceTermContent: string | null;
  serviceTermAgreed: string;
  privacyTermVersion: string | null;
  privacyTermContent: string | null;
  privacyTermAgreed: string;
  thirdPartyTermVersion: string | null;
  thirdPartyTermContent: string | null;
  thirdPartyTermAgreed: string;
  signatureData: string | null;
  signatureHash: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  contentHash: string | null;
  ceoBirth: string | null;
  ceoCi: string | null;
  ceoPhone: string | null;
  memberStatus: string;
}

export default function TermAgreementsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAgreement, setSelectedAgreement] = useState<TermAgreement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: agreements = [], isLoading } = useQuery<TermAgreement[]>({
    queryKey: ["/api/admin/term-agreements"],
  });

  const filteredAgreements = agreements.filter((a) => {
    const matchesSearch =
      a.memberUsername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.businessNumber?.includes(searchTerm) ||
      a.representative?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || a.memberStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const activeCount = agreements.filter(a => a.memberStatus === "active").length;
  const deletedCount = agreements.filter(a => a.memberStatus === "deleted").length;

  const openDetail = (agreement: TermAgreement) => {
    setSelectedAgreement(agreement);
    setDetailOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            약관 동의 기록
          </h1>
          <p className="text-muted-foreground mt-1">
            회원가입 시 동의한 약관 기록을 조회합니다. 법적 증빙 자료로 활용됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            전체 {agreements.length}건
          </Badge>
          <Badge variant="default" className="text-sm">
            활성 {activeCount}건
          </Badge>
          <Badge variant="secondary" className="text-sm bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            탈퇴 {deletedCount}건
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="회원명, 상호명, 사업자번호, 대표자명 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-agreements"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                <SelectValue placeholder="회원 상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="active">활성 회원</SelectItem>
                <SelectItem value="deleted">탈퇴 회원</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAgreements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>약관 동의 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAgreements.map((agreement) => (
                <div
                  key={agreement.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${agreement.memberStatus === "deleted" ? "bg-orange-100 dark:bg-orange-900" : "bg-primary/10"}`}>
                      {agreement.memberStatus === "deleted" ? (
                        <UserX className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      ) : (
                        <User className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {agreement.companyName || agreement.memberUsername}
                        <Badge variant="secondary" className="text-xs">
                          {agreement.memberUsername}
                        </Badge>
                        {agreement.memberStatus === "deleted" && (
                          <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700">
                            탈퇴
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {agreement.businessNumber || "-"}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {agreement.representative || "-"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(agreement.agreedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {agreement.serviceTermAgreed === "true" && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          이용약관
                        </Badge>
                      )}
                      {agreement.privacyTermAgreed === "true" && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          개인정보
                        </Badge>
                      )}
                      {agreement.thirdPartyTermAgreed === "true" && (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          제3자제공
                        </Badge>
                      )}
                      {agreement.signatureData && (
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                          전자서명
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(agreement)}
                      data-testid={`button-view-agreement-${agreement.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      상세보기
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              약관 동의 상세 기록
            </DialogTitle>
            <DialogDescription>
              법적 증빙을 위한 약관 동의 상세 정보입니다.
            </DialogDescription>
          </DialogHeader>

          {selectedAgreement && (
            <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">기본 정보</TabsTrigger>
                <TabsTrigger value="terms">약관 내용</TabsTrigger>
                <TabsTrigger value="signature">전자 서명</TabsTrigger>
                <TabsTrigger value="technical">기술 정보</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="flex-1 overflow-auto mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4" />
                        회원 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">아이디</span>
                        <span className="font-medium">{selectedAgreement.memberUsername}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">회원명</span>
                        <span className="font-medium">{selectedAgreement.memberName || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">대표자</span>
                        <span className="font-medium">{selectedAgreement.representative || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">대표자 연락처</span>
                        <span className="font-medium">{selectedAgreement.ceoPhone || "-"}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        사업자 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">상호명</span>
                        <span className="font-medium">{selectedAgreement.companyName || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">사업자번호</span>
                        <span className="font-medium">{selectedAgreement.businessNumber || "-"}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        동의 항목
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${selectedAgreement.serviceTermAgreed === "true" ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-sm">서비스 이용약관</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${selectedAgreement.privacyTermAgreed === "true" ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-sm">개인정보 수집 및 이용</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${selectedAgreement.thirdPartyTermAgreed === "true" ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-sm">개인정보 제3자 제공</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${selectedAgreement.signatureData ? "bg-green-500" : "bg-gray-300"}`} />
                          <span className="text-sm">전자 서명</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        동의 일시
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-lg font-medium">{formatDate(selectedAgreement.agreedAt)}</span>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="terms" className="flex-1 overflow-hidden mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4 pr-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">서비스 이용약관 (버전: {selectedAgreement.serviceTermVersion || "1.0"})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md max-h-[200px] overflow-auto">
                          {selectedAgreement.serviceTermContent || "내용 없음"}
                        </pre>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">개인정보 수집 및 이용 동의 (버전: {selectedAgreement.privacyTermVersion || "1.0"})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md max-h-[200px] overflow-auto">
                          {selectedAgreement.privacyTermContent || "내용 없음"}
                        </pre>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">개인정보 제3자 제공 동의 (버전: {selectedAgreement.thirdPartyTermVersion || "1.0"})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded-md max-h-[200px] overflow-auto">
                          {selectedAgreement.thirdPartyTermContent || "내용 없음"}
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="signature" className="flex-1 overflow-auto mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">전자 서명</CardTitle>
                    <CardDescription>회원가입 시 작성한 전자 서명입니다.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    {selectedAgreement.signatureData ? (
                      <>
                        <div className="border-2 border-dashed rounded-lg p-4 bg-white">
                          <img
                            src={selectedAgreement.signatureData}
                            alt="전자 서명"
                            className="max-w-[400px] max-h-[200px]"
                          />
                        </div>
                        <div className="mt-4 text-xs text-muted-foreground">
                          <span className="font-medium">서명 해시:</span> {selectedAgreement.signatureHash?.substring(0, 32)}...
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>전자 서명이 없습니다.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="technical" className="flex-1 overflow-auto mt-4">
                <div className="grid grid-cols-1 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        접속 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IP 주소</span>
                        <span className="font-mono">{selectedAgreement.ipAddress || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">User Agent</span>
                        <div className="font-mono text-xs mt-1 bg-muted p-2 rounded break-all">
                          {selectedAgreement.userAgent || "-"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        무결성 검증
                      </CardTitle>
                      <CardDescription className="text-xs">
                        데이터 위변조 확인을 위한 해시값입니다.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">콘텐츠 해시 (SHA-256)</span>
                        <div className="font-mono text-xs mt-1 bg-muted p-2 rounded break-all">
                          {selectedAgreement.contentHash || "-"}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">서명 해시 (SHA-256)</span>
                        <div className="font-mono text-xs mt-1 bg-muted p-2 rounded break-all">
                          {selectedAgreement.signatureHash || "-"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4" />
                        본인인증 정보
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">대표자 생년월일</span>
                        <span className="font-medium">{selectedAgreement.ceoBirth || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">본인인증 CI</span>
                        <div className="font-mono text-xs mt-1 bg-muted p-2 rounded break-all">
                          {selectedAgreement.ceoCi || "-"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
