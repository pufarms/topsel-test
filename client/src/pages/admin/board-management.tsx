import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Search, Trash2, Send, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import type { Inquiry } from "@shared/schema";

const PAGE_SIZE = 15;

export default function BoardManagement() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("전체");
  const [categoryFilter, setCategoryFilter] = useState("전체");
  const [searchText, setSearchText] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [page, setPage] = useState(1);

  const { data: inquiriesData = [], isLoading } = useQuery<Inquiry[]>({
    queryKey: ["/api/admin/inquiries", statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "전체") params.set("status", statusFilter);
      if (categoryFilter !== "전체") params.set("category", categoryFilter);
      const res = await fetch(`/api/admin/inquiries?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const answerMutation = useMutation({
    mutationFn: async ({ id, answer }: { id: number; answer: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/inquiries/${id}/answer`, { answer });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inquiries"] });
      setSelectedInquiry(data);
      setAnswerText("");
      toast({ title: "답변이 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "답변 등록 실패", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/inquiries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inquiries"] });
      setSelectedInquiry(null);
      toast({ title: "문의가 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const filtered = inquiriesData.filter((item) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.memberName.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const pendingCount = inquiriesData.filter((i) => i.status === "대기").length;
  const answeredCount = inquiriesData.filter((i) => i.status === "답변완료").length;

  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  const openDetail = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setAnswerText(inquiry.answer || "");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-foreground" data-testid="text-board-title">게시판 관리</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs" data-testid="badge-pending-count">
            대기 {pendingCount}건
          </Badge>
          <Badge variant="secondary" className="text-xs" data-testid="badge-answered-count">
            답변완료 {answeredCount}건
          </Badge>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[120px]" data-testid="select-status-filter">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="전체">전체 상태</SelectItem>
              <SelectItem value="대기">대기</SelectItem>
              <SelectItem value="답변완료">답변완료</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]" data-testid="select-category-filter">
              <SelectValue placeholder="카테고리" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="전체">전체 카테고리</SelectItem>
              <SelectItem value="일반문의">일반문의</SelectItem>
              <SelectItem value="상품문의">상품문의</SelectItem>
              <SelectItem value="배송문의">배송문의</SelectItem>
              <SelectItem value="결제문의">결제문의</SelectItem>
              <SelectItem value="기타">기타</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="제목, 작성자, 내용 검색"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
              className="pl-8"
              data-testid="input-search"
            />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">등록된 문의가 없습니다</p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm" data-testid="table-inquiries">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2.5 text-left font-semibold w-12">번호</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-20">상태</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-24">카테고리</th>
                  <th className="px-3 py-2.5 text-left font-semibold">제목</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-28">작성자</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-36">등록일</th>
                  <th className="px-3 py-2.5 text-center font-semibold w-16">보기</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => openDetail(item)}
                    data-testid={`row-inquiry-${item.id}`}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">{item.id}</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={item.status === "대기" ? "destructive" : "secondary"}
                        className="text-xs"
                        data-testid={`status-inquiry-${item.id}`}
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground text-xs">{item.category}</td>
                    <td className="px-3 py-2.5 font-medium truncate max-w-[300px]">{item.title}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.memberName}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); openDetail(item); }}
                        data-testid={`button-view-inquiry-${item.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">
              총 {filtered.length}건 중 {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)}건
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm">{page} / {totalPages}</span>
              <Button
                size="icon"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                data-testid="button-next-page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!selectedInquiry} onOpenChange={(open) => { if (!open) setSelectedInquiry(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedInquiry && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <DialogTitle className="text-lg" data-testid="text-inquiry-detail-title">문의 상세</DialogTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedInquiry.status === "대기" ? "destructive" : "secondary"}>
                      {selectedInquiry.status}
                    </Badge>
                    <Badge variant="outline">{selectedInquiry.category}</Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">작성자:</span>
                    <span className="ml-2 font-medium" data-testid="text-inquiry-member">{selectedInquiry.memberName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">등록일:</span>
                    <span className="ml-2">{formatDate(selectedInquiry.createdAt)}</span>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-1" data-testid="text-inquiry-title">{selectedInquiry.title}</h3>
                  <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap min-h-[80px]" data-testid="text-inquiry-content">
                    {selectedInquiry.content}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    관리자 답변
                  </h4>

                  {selectedInquiry.status === "답변완료" && selectedInquiry.answer ? (
                    <div className="space-y-2">
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm whitespace-pre-wrap" data-testid="text-inquiry-answer">
                        {selectedInquiry.answer}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-1">
                        <span>답변자: {selectedInquiry.answeredBy}</span>
                        <span>{selectedInquiry.answeredAt && formatDate(selectedInquiry.answeredAt)}</span>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1">답변 수정:</p>
                        <Textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="수정할 답변 내용을 입력하세요"
                          rows={3}
                          data-testid="textarea-edit-answer"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <Button
                            size="sm"
                            disabled={!answerText.trim() || answerMutation.isPending}
                            onClick={() => answerMutation.mutate({ id: selectedInquiry.id, answer: answerText })}
                            data-testid="button-update-answer"
                          >
                            {answerMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            답변 수정
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="답변 내용을 입력하세요"
                        rows={4}
                        data-testid="textarea-answer"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <Button
                          size="sm"
                          disabled={!answerText.trim() || answerMutation.isPending}
                          onClick={() => answerMutation.mutate({ id: selectedInquiry.id, answer: answerText })}
                          data-testid="button-submit-answer"
                        >
                          {answerMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                          <Send className="h-4 w-4 mr-1" />
                          답변 등록
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 flex justify-end">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("이 문의를 삭제하시겠습니까?")) {
                        deleteMutation.mutate(selectedInquiry.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-inquiry"
                  >
                    {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <Trash2 className="h-4 w-4 mr-1" />
                    문의 삭제
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
