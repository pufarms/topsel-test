import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Plus, Send, ChevronLeft, ChevronRight } from "lucide-react";
import type { Inquiry } from "@shared/schema";

export default function MemberInquiryTab() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [page, setPage] = useState(1);

  const [formCategory, setFormCategory] = useState("일반문의");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");

  const PAGE_SIZE = 10;

  const { data: inquiries = [], isLoading } = useQuery<Inquiry[]>({
    queryKey: ["/api/member/inquiries"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { category: string; title: string; content: string }) => {
      const res = await apiRequest("POST", "/api/member/inquiries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/inquiries"] });
      setShowForm(false);
      setFormCategory("일반문의");
      setFormTitle("");
      setFormContent("");
      toast({ title: "문의가 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "문의 등록에 실패했습니다", variant: "destructive" });
    },
  });

  const totalPages = Math.max(1, Math.ceil(inquiries.length / PAGE_SIZE));
  const paginated = inquiries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const formatDateTime = (d: string | Date) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-600" />
          <h2 className="text-lg font-bold" data-testid="text-inquiry-tab-title">문의 게시판</h2>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} data-testid="button-new-inquiry">
          <Plus className="h-4 w-4 mr-1" />
          문의하기
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : inquiries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground mb-3">등록된 문의가 없습니다</p>
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)} data-testid="button-first-inquiry">
              문의하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm" data-testid="table-member-inquiries">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2.5 text-left font-semibold w-20">상태</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-24">카테고리</th>
                  <th className="px-3 py-2.5 text-left font-semibold">제목</th>
                  <th className="px-3 py-2.5 text-left font-semibold w-28">등록일</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedInquiry(item)}
                    data-testid={`row-member-inquiry-${item.id}`}
                  >
                    <td className="px-3 py-2.5">
                      <Badge
                        variant={item.status === "대기" ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{item.category}</td>
                    <td className="px-3 py-2.5 font-medium truncate max-w-[250px]">{item.title}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">{page} / {totalPages}</span>
              <Button size="icon" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-new-inquiry-title">문의 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">카테고리</label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger data-testid="select-inquiry-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="일반문의">일반문의</SelectItem>
                  <SelectItem value="상품문의">상품문의</SelectItem>
                  <SelectItem value="배송문의">배송문의</SelectItem>
                  <SelectItem value="결제문의">결제문의</SelectItem>
                  <SelectItem value="기타">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">제목</label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="문의 제목을 입력하세요"
                data-testid="input-inquiry-title"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">내용</label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="문의 내용을 입력하세요"
                rows={5}
                data-testid="textarea-inquiry-content"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>취소</Button>
              <Button
                disabled={!formTitle.trim() || !formContent.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ category: formCategory, title: formTitle, content: formContent })}
                data-testid="button-submit-inquiry"
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Send className="h-4 w-4 mr-1" />
                등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedInquiry} onOpenChange={(open) => { if (!open) setSelectedInquiry(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selectedInquiry && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <DialogTitle className="text-base" data-testid="text-inquiry-view-title">문의 상세</DialogTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedInquiry.status === "대기" ? "outline" : "secondary"}>
                      {selectedInquiry.status}
                    </Badge>
                    <Badge variant="outline">{selectedInquiry.category}</Badge>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="text-xs text-muted-foreground">
                  등록일: {formatDateTime(selectedInquiry.createdAt)}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{selectedInquiry.title}</h3>
                  <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap" data-testid="text-member-inquiry-content">
                    {selectedInquiry.content}
                  </div>
                </div>

                {selectedInquiry.status === "답변완료" && selectedInquiry.answer && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-sm">
                      <Send className="h-4 w-4 text-primary" />
                      관리자 답변
                    </h4>
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm whitespace-pre-wrap" data-testid="text-member-inquiry-answer">
                      {selectedInquiry.answer}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2 flex-wrap gap-1">
                      <span>답변자: {selectedInquiry.answeredBy}</span>
                      <span>{selectedInquiry.answeredAt && formatDateTime(selectedInquiry.answeredAt)}</span>
                    </div>
                  </div>
                )}

                {selectedInquiry.status === "대기" && (
                  <div className="border-t pt-4 text-center text-muted-foreground text-sm">
                    아직 답변이 등록되지 않았습니다
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
