import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Search, Trash2, Send, Star, AlertCircle, Clock, CheckCircle, XCircle, FileText, Paperclip, Download, User, Calendar, Package, Phone, Truck, ArrowRight } from "lucide-react";
import type { Inquiry, InquiryMessage, InquiryField, InquiryAttachment } from "@shared/schema";

interface InquiryWithCount extends Inquiry {
  messageCount: number;
}

interface InquiryDetail extends Inquiry {
  messages: InquiryMessage[];
  fields: InquiryField[];
  attachments: InquiryAttachment[];
}

interface InquiryCounts {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  unreadCount: number;
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  "대기": { badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  "확인중": { badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  "답변완료": { badge: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  "추가문의": { badge: "bg-red-100 text-red-600 border-red-200", dot: "bg-red-400" },
  "종결": { badge: "bg-gray-100 text-gray-500 border-gray-200", dot: "bg-gray-400" },
};

const CATEGORY_ICONS: Record<string, typeof MessageSquare> = {
  "일반문의": MessageSquare,
  "상품CS/미수": AlertCircle,
  "정산/계산서": FileText,
  "회원정보(등급)": User,
  "행사특가/변경": Package,
  "기타": Clock,
};

const CATEGORIES = ["전체", "일반문의", "상품CS/미수", "정산/계산서", "회원정보(등급)", "행사특가/변경", "기타"];
const STATUSES = [
  { label: "전체", color: "" },
  { label: "대기", color: "bg-red-500" },
  { label: "확인중", color: "bg-orange-500" },
  { label: "답변완료", color: "bg-blue-500" },
  { label: "추가문의", color: "bg-red-400" },
  { label: "종결", color: "bg-gray-400" },
];

function formatDate(d: string | Date) {
  const date = new Date(d);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

function formatFullDate(d: string | Date) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function BoardManagement() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("전체");
  const [activeStatus, setActiveStatus] = useState("전체");
  const [searchText, setSearchText] = useState("");
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [detailTab, setDetailTab] = useState<"접수정보" | "대화" | "첨부파일">("대화");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: counts } = useQuery<InquiryCounts>({
    queryKey: ["/api/admin/inquiries/counts"],
  });

  const { data: inquiries = [], isLoading: isListLoading } = useQuery<InquiryWithCount[]>({
    queryKey: ["/api/admin/inquiries", activeStatus, activeCategory, searchText],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeStatus !== "전체") params.set("status", activeStatus);
      if (activeCategory !== "전체") params.set("category", activeCategory);
      if (searchText.trim()) params.set("search", searchText.trim());
      const res = await fetch(`/api/admin/inquiries?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: detail, isLoading: isDetailLoading } = useQuery<InquiryDetail>({
    queryKey: ["/api/admin/inquiries", selectedInquiryId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/inquiries/${selectedInquiryId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch detail");
      return res.json();
    },
    enabled: !!selectedInquiryId,
  });

  const refetchAllInquiries = async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ["/api/admin/inquiries"] }),
      queryClient.refetchQueries({ queryKey: ["/api/admin/inquiries/counts"] }),
    ]);
  };

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/admin/inquiries/${id}/read`);
    },
    onSuccess: () => { refetchAllInquiries(); },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      await apiRequest("POST", `/api/admin/inquiries/${id}/messages`, { content });
    },
    onSuccess: () => {
      setReplyText("");
      refetchAllInquiries();
      toast({ title: "답변이 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "답변 등록 실패", variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/admin/inquiries/${id}/status`, { status });
    },
    onSuccess: () => {
      refetchAllInquiries();
      toast({ title: "상태가 변경되었습니다" });
    },
    onError: () => {
      toast({ title: "상태 변경 실패", variant: "destructive" });
    },
  });

  const starMutation = useMutation({
    mutationFn: async ({ id, isStarred }: { id: number; isStarred: boolean }) => {
      await apiRequest("PATCH", `/api/admin/inquiries/${id}/star`, { isStarred });
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/admin/inquiries"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/inquiries/${id}`);
    },
    onSuccess: () => {
      setSelectedInquiryId(null);
      refetchAllInquiries();
      toast({ title: "문의가 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "삭제 실패", variant: "destructive" });
    },
  });

  const handleSelectInquiry = (id: number) => {
    setSelectedInquiryId(id);
    setDetailTab("대화");
    setReplyText("");
    markReadMutation.mutate(id);
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedInquiryId) return;
    replyMutation.mutate({ id: selectedInquiryId, content: replyText.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  useEffect(() => {
    if (detail?.messages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [detail?.messages]);

  const getCategoryIcon = (cat: string) => {
    const Icon = CATEGORY_ICONS[cat];
    return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-background border-b px-6 py-4 flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-indigo-600" />
          <h1 className="text-xl font-bold text-foreground" data-testid="text-board-title">게시판 관리</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>총 <strong className="text-foreground">{counts?.total ?? 0}</strong>건</span>
          <span className="text-muted-foreground/40">|</span>
          <span>미답변 <strong className="text-red-600">{counts?.byStatus?.["대기"] ?? 0}</strong>건</span>
          <span className="text-muted-foreground/40">|</span>
          <span>추가문의 <strong className="text-orange-600">{counts?.byStatus?.["추가문의"] ?? 0}</strong>건</span>
        </div>
      </div>

      <div className="bg-background border-b px-6 py-2.5 flex items-center gap-1.5 flex-shrink-0 overflow-x-auto flex-wrap">
        {CATEGORIES.map((cat) => {
          const catCount = cat === "전체" ? (counts?.total ?? 0) : (counts?.byCategory?.[cat] ?? 0);
          return (
            <Button
              key={cat}
              size="sm"
              variant={activeCategory === cat ? "default" : "secondary"}
              className={activeCategory === cat ? "bg-indigo-600 text-white" : ""}
              onClick={() => setActiveCategory(cat)}
              data-testid={`button-category-${cat}`}
            >
              {cat !== "전체" && getCategoryIcon(cat)}
              <span>{cat}</span>
              <Badge variant="secondary" className={`ml-1 text-xs ${activeCategory === cat ? "bg-white/30 text-white no-default-hover-elevate no-default-active-elevate" : ""}`}>
                {catCount}
              </Badge>
            </Button>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div style={{ width: "38%" }} className="border-r flex flex-col bg-background">
          <div className="px-4 py-3 border-b space-y-2 flex-shrink-0">
            <div className="flex items-center gap-1 flex-wrap">
              {STATUSES.map((s) => {
                const sCount = s.label === "전체" ? (counts?.total ?? 0) : (counts?.byStatus?.[s.label] ?? 0);
                return (
                  <Button
                    key={s.label}
                    size="sm"
                    variant={activeStatus === s.label ? "default" : "outline"}
                    onClick={() => setActiveStatus(s.label)}
                    data-testid={`button-status-${s.label}`}
                  >
                    {s.color && <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />}
                    <span>{s.label}</span>
                    <span className="text-xs opacity-70">{sCount}</span>
                  </Button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="제목, 작성자, 내용 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isListLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : inquiries.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                조건에 맞는 문의가 없습니다.
              </div>
            ) : (
              inquiries.map((item) => {
                const isSelected = selectedInquiryId === item.id;
                const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES["종결"];
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectInquiry(item.id)}
                    className={`px-4 py-3.5 border-b cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-l-indigo-500"
                        : item.unreadByAdmin
                        ? "bg-red-50/40 dark:bg-red-950/10 border-l-4 border-l-transparent hover-elevate"
                        : "border-l-4 border-l-transparent hover-elevate"
                    }`}
                    data-testid={`row-inquiry-${item.id}`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${statusStyle.badge}`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.category}</span>
                        {item.priority === "urgent" && (
                          <Badge variant="destructive" className="text-xs animate-pulse">긴급</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{item.messageCount}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.unreadByAdmin && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                      <p className={`text-sm truncate ${item.unreadByAdmin ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {item.title}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{item.memberName}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ width: "62%" }} className="flex flex-col bg-muted/30">
          {!selectedInquiryId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">문의를 선택해 주세요</p>
            </div>
          ) : isDetailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <>
              <div className="bg-background px-6 py-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLES[detail.status]?.badge || ""}`}>
                      {detail.status}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                      {getCategoryIcon(detail.category)}
                      {detail.category}
                    </span>
                    {detail.priority === "urgent" && (
                      <Badge variant="destructive" className="text-xs">긴급</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        starMutation.mutate({ id: detail.id, isStarred: !detail.isStarred });
                      }}
                      data-testid="button-toggle-star"
                    >
                      <Star className={`h-4 w-4 ${detail.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    </Button>
                    {detail.status !== "확인중" && detail.status !== "종결" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ id: detail.id, status: "확인중" })}
                        disabled={statusMutation.isPending}
                        data-testid="button-status-checking"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        확인중 전환
                      </Button>
                    )}
                    {detail.status !== "종결" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => statusMutation.mutate({ id: detail.id, status: "종결" })}
                        disabled={statusMutation.isPending}
                        data-testid="button-status-close"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        종결 처리
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm("이 문의를 삭제하시겠습니까?")) {
                          deleteMutation.mutate(detail.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid="button-delete-inquiry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      삭제
                    </Button>
                  </div>
                </div>
                <h2 className="text-base font-bold text-foreground mb-1" data-testid="text-inquiry-title">{detail.title}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><User className="h-3 w-3" /> {detail.memberName}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatFullDate(detail.createdAt)}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> 메시지 {detail.messages?.length ?? 0}건</span>
                  <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" /> 첨부 {detail.attachments?.length ?? 0}건</span>
                </div>
              </div>

              <div className="bg-background border-b px-6 flex items-center gap-0 flex-shrink-0">
                {(["접수정보", "대화", "첨부파일"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === tab
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-muted-foreground"
                    }`}
                    data-testid={`tab-${tab}`}
                  >
                    {tab}
                    {tab === "첨부파일" && detail.attachments?.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">{detail.attachments.length}</Badge>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto">
                {detailTab === "접수정보" && (
                  <div className="px-6 py-5 space-y-4">
                    <Card className="overflow-hidden">
                      <div className="bg-muted px-4 py-2.5 border-b flex items-center gap-2">
                        {getCategoryIcon(detail.category)}
                        <span className="text-sm font-bold text-foreground">{detail.category} — 접수 정보</span>
                      </div>
                      <div className="p-4">
                        {detail.fields && detail.fields.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                            {detail.fields.map((field, i) => (
                              <div key={field.id} className={`bg-muted/50 rounded-lg p-3 ${i === detail.fields.length - 1 && detail.fields.length % 2 !== 0 ? "col-span-2" : ""}`}>
                                <div className="text-xs text-muted-foreground mb-1">{field.fieldName}</div>
                                <div className="text-sm font-medium text-foreground">{field.fieldValue}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">접수 정보가 없습니다.</p>
                        )}
                      </div>
                    </Card>

                    <Card className="p-4">
                      <h4 className="text-sm font-semibold text-foreground mb-2">문의 내용</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detail.content}</p>
                    </Card>
                  </div>
                )}

                {detailTab === "대화" && (
                  <div className="px-6 py-4 space-y-4">
                    {detail.messages && detail.messages.length > 0 ? (
                      detail.messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.senderType === "admin" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-md rounded-xl px-4 py-3 ${
                            msg.senderType === "admin"
                              ? "bg-indigo-600 text-white rounded-br-sm"
                              : "bg-white dark:bg-card border text-foreground rounded-bl-sm"
                          }`}>
                            <div className={`flex items-center gap-2 mb-1.5 text-xs ${
                              msg.senderType === "admin" ? "text-indigo-200" : "text-muted-foreground"
                            }`}>
                              <span className="font-medium flex items-center gap-1">
                                {msg.senderType === "admin" ? <CheckCircle className="h-3 w-3" /> : <User className="h-3 w-3" />}
                                {msg.senderName}
                              </span>
                              <span>{formatDate(msg.createdAt)}</span>
                            </div>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">아직 메시지가 없습니다.</p>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}

                {detailTab === "첨부파일" && (
                  <div className="px-6 py-5">
                    <Card className="overflow-hidden">
                      <div className="bg-muted px-4 py-2.5 border-b flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-foreground flex items-center gap-1">
                          <Paperclip className="h-4 w-4" /> 첨부된 파일 목록
                        </span>
                      </div>
                      <div className="p-4 space-y-2">
                        {detail.attachments && detail.attachments.length > 0 ? (
                          detail.attachments.map((file) => (
                            <div key={file.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/50 hover-elevate">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <div className="text-sm font-medium text-foreground">{file.fileName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {file.fileSize ? `${(file.fileSize / 1024 / 1024).toFixed(1)}MB` : ""} {file.label || ""}
                                  </div>
                                </div>
                              </div>
                              <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" data-testid={`button-download-${file.id}`}>
                                <Button size="icon" variant="ghost">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">첨부된 파일이 없습니다.</p>
                        )}
                      </div>
                    </Card>
                  </div>
                )}
              </div>

              {detailTab === "대화" && (
                <div className="bg-background border-t px-4 py-3 flex-shrink-0">
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="답변을 입력하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
                      rows={2}
                      className="flex-1 resize-none"
                      data-testid="textarea-reply"
                    />
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      data-testid="button-send-reply"
                    >
                      {replyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      전송
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
