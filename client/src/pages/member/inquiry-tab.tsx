import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, Plus, Send, ArrowLeft, AlertCircle, FileText, User, Package, Clock, Star, Paperclip, Camera, ChevronRight } from "lucide-react";
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
  newReplies: number;
}

const categoryFieldDefs: Record<string, { icon: React.ComponentType<any>; color: string; desc: string; fields: Array<{ name: string; label: string; type: "text" | "date" | "textarea"; required: boolean; placeholder?: string }> }> = {
  "일반문의": {
    icon: MessageSquare,
    color: "blue",
    desc: "일반적인 질문 및 요청사항을 남겨주세요.",
    fields: [
      { name: "title", label: "제목", type: "text", required: true, placeholder: "문의 제목을 입력하세요" },
      { name: "content", label: "문의 내용", type: "textarea", required: true, placeholder: "문의 내용을 상세히 작성해주세요" },
    ]
  },
  "상품CS/미수": {
    icon: AlertCircle,
    color: "red",
    desc: "상품 불량, 오배송 등 클레임을 접수해주세요.",
    fields: [
      { name: "title", label: "제목", type: "text", required: true, placeholder: "예: 사과 3박스 중 1박스 불량" },
      { name: "contact", label: "담당자 / 연락처", type: "text", required: true, placeholder: "홍길동 / 010-1234-5678" },
      { name: "shipDate", label: "상품 발송일", type: "date", required: true },
      { name: "productName", label: "상품명 / 코드", type: "text", required: true, placeholder: "경북 사과 10kg / APL-001" },
      { name: "receiver", label: "수령자", type: "text", required: true, placeholder: "수령자 이름" },
      { name: "trackingNo", label: "운송장 번호", type: "text", required: true, placeholder: "운송장 번호 입력" },
      { name: "content", label: "상세 내용", type: "textarea", required: true, placeholder: "불량/파손 상황을 상세히 설명해주세요" },
    ]
  },
  "정산/계산서": {
    icon: FileText,
    color: "yellow",
    desc: "세금계산서 발행, 예치금 충전 확인 등을 요청하세요.",
    fields: [
      { name: "title", label: "제목", type: "text", required: true, placeholder: "예: 1월 세금계산서 발행 요청" },
      { name: "bizName", label: "사업자명 / ID", type: "text", required: true, placeholder: "사업자명 또는 회원 ID" },
      { name: "amount", label: "요청 금액 / 내용", type: "text", required: true, placeholder: "금액 및 요청 내용" },
      { name: "content", label: "상세 내용", type: "textarea", required: false, placeholder: "추가 설명이 필요하면 작성해주세요" },
    ]
  },
  "회원정보(등급)": {
    icon: User,
    color: "orange",
    desc: "회원 정보 수정, 등급 상향 요청 등을 문의하세요.",
    fields: [
      { name: "title", label: "제목", type: "text", required: true, placeholder: "예: 회원 등급 변경 요청" },
      { name: "memberId", label: "회원 아이디", type: "text", required: true, placeholder: "회원 아이디" },
      { name: "contact", label: "담당자 이름 / 연락처", type: "text", required: true, placeholder: "홍길동 / 010-1234-5678" },
      { name: "requestDate", label: "문의 접수일", type: "date", required: true },
      { name: "content", label: "상세 내용", type: "textarea", required: true, placeholder: "요청 사항을 상세히 작성해주세요" },
    ]
  },
  "행사특가/변경": {
    icon: Package,
    color: "green",
    desc: "행사 특가 신청, 대량 구매 관련 협의를 진행합니다.",
    fields: [
      { name: "title", label: "제목 / 아이디", type: "text", required: true, placeholder: "예: 2월 감귤 행사 특가 신청" },
      { name: "productName", label: "행사 상품명 / 코드", type: "text", required: true, placeholder: "제주 감귤 5kg / MND-002" },
      { name: "siteName", label: "사이트명 / 행사명", type: "text", required: true, placeholder: "쿠팡 / 설맞이 대전" },
      { name: "quantity", label: "판매 예상 수량", type: "text", required: true, placeholder: "예: 500박스" },
      { name: "eventDate", label: "행사 / 출고 예정일", type: "date", required: true },
      { name: "content", label: "상세 내용", type: "textarea", required: false, placeholder: "추가 요청사항이 있으면 작성해주세요" },
    ]
  },
  "기타": {
    icon: Clock,
    color: "gray",
    desc: "위 카테고리에 해당하지 않는 기타 문의를 남겨주세요.",
    fields: [
      { name: "title", label: "제목", type: "text", required: true, placeholder: "문의 제목을 입력하세요" },
      { name: "content", label: "문의 내용", type: "textarea", required: true, placeholder: "문의 내용을 상세히 작성해주세요" },
    ]
  },
};

function getStatusVariant(status: string): "destructive" | "secondary" | "outline" | "default" {
  switch (status) {
    case "대기": return "destructive";
    case "확인중": return "secondary";
    case "답변완료": return "default";
    case "추가문의": return "destructive";
    case "종결": return "outline";
    default: return "outline";
  }
}

function getStatusClasses(status: string): string {
  switch (status) {
    case "대기": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "확인중": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "답변완료": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "추가문의": return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400";
    case "종결": return "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400";
    default: return "bg-gray-100 text-gray-500";
  }
}

function getCategoryColorClasses(color: string) {
  const map: Record<string, { bg: string; border: string; selectedBg: string; iconColor: string }> = {
    blue: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-300 dark:border-blue-700", selectedBg: "bg-blue-100 dark:bg-blue-900/40", iconColor: "text-blue-600 dark:text-blue-400" },
    red: { bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-300 dark:border-red-700", selectedBg: "bg-red-100 dark:bg-red-900/40", iconColor: "text-red-600 dark:text-red-400" },
    yellow: { bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-300 dark:border-yellow-700", selectedBg: "bg-yellow-100 dark:bg-yellow-900/40", iconColor: "text-yellow-600 dark:text-yellow-400" },
    orange: { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-300 dark:border-orange-700", selectedBg: "bg-orange-100 dark:bg-orange-900/40", iconColor: "text-orange-600 dark:text-orange-400" },
    green: { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-300 dark:border-green-700", selectedBg: "bg-green-100 dark:bg-green-900/40", iconColor: "text-green-600 dark:text-green-400" },
    gray: { bg: "bg-gray-50 dark:bg-gray-950/30", border: "border-gray-300 dark:border-gray-700", selectedBg: "bg-gray-100 dark:bg-gray-900/40", iconColor: "text-gray-600 dark:text-gray-400" },
  };
  return map[color] || map.gray;
}

function formatDate(d: string | Date) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(d: string | Date) {
  const date = new Date(d);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function MemberInquiryTab() {
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<"list" | "write" | "detail">("list");
  const [activeFilter, setActiveFilter] = useState("전체");
  const [selectedInquiryId, setSelectedInquiryId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isUrgent, setIsUrgent] = useState(false);
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: inquiries = [], isLoading: inquiriesLoading } = useQuery<InquiryWithCount[]>({
    queryKey: ["/api/member/inquiries"],
  });

  const { data: counts } = useQuery<InquiryCounts>({
    queryKey: ["/api/member/inquiries/counts"],
  });

  const { data: detail, isLoading: detailLoading } = useQuery<InquiryDetail>({
    queryKey: ["/api/member/inquiries", selectedInquiryId],
    enabled: !!selectedInquiryId && activeView === "detail",
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/member/inquiries/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/inquiries/counts"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { category: string; title: string; content: string; priority: string; fields: Array<{ fieldName: string; fieldValue: string }> }) => {
      const res = await apiRequest("POST", "/api/member/inquiries", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/inquiries/counts"] });
      setSelectedCategory("");
      setFormData({});
      setIsUrgent(false);
      setActiveView("list");
      toast({ title: "문의가 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "문의 등록에 실패했습니다", variant: "destructive" });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      const res = await apiRequest("POST", `/api/member/inquiries/${id}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/member/inquiries", selectedInquiryId] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/inquiries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/member/inquiries/counts"] });
      setReplyText("");
      toast({ title: "추가 문의가 등록되었습니다" });
    },
    onError: () => {
      toast({ title: "메시지 전송에 실패했습니다", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (selectedInquiryId && activeView === "detail") {
      markReadMutation.mutate(selectedInquiryId);
    }
  }, [selectedInquiryId, activeView]);

  useEffect(() => {
    if (detail?.messages && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [detail?.messages]);

  const filteredInquiries = inquiries.filter((item) => {
    if (activeFilter === "전체") return true;
    return item.status === activeFilter;
  });

  const handleSubmit = () => {
    if (!selectedCategory) return;
    const catDef = categoryFieldDefs[selectedCategory];
    if (!catDef) return;

    const title = formData["title"] || "";
    const content = formData["content"] || "";

    const requiredFields = catDef.fields.filter((f) => f.required);
    for (const field of requiredFields) {
      if (!formData[field.name]?.trim()) {
        toast({ title: `${field.label}을(를) 입력해주세요`, variant: "destructive" });
        return;
      }
    }

    const fields: Array<{ fieldName: string; fieldValue: string }> = [];
    for (const field of catDef.fields) {
      if (field.name !== "title" && field.name !== "content" && formData[field.name]) {
        fields.push({ fieldName: field.label, fieldValue: formData[field.name] });
      }
    }

    createMutation.mutate({
      category: selectedCategory,
      title,
      content,
      priority: isUrgent ? "urgent" : "normal",
      fields,
    });
  };

  const handleReply = () => {
    if (!selectedInquiryId || !replyText.trim()) return;
    replyMutation.mutate({ id: selectedInquiryId, content: replyText.trim() });
  };

  if (activeView === "detail") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setActiveView("list"); setSelectedInquiryId(null); }}
            data-testid="button-back-to-list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {detail && (
              <>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className={getStatusClasses(detail.status)} data-testid="badge-detail-status">
                    {detail.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{detail.category}</span>
                </div>
                <h1 className="text-lg font-bold truncate" data-testid="text-detail-title">{detail.title}</h1>
              </>
            )}
          </div>
          {detail && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Clock className="h-3 w-3" />
              <span>{formatDate(detail.createdAt)}</span>
            </div>
          )}
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <>
            {detail.fields && detail.fields.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>접수 정보</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {detail.fields.map((field) => (
                      <div key={field.id} className="text-sm" data-testid={`text-field-${field.id}`}>
                        <span className="text-muted-foreground">{field.fieldName}: </span>
                        <span className="font-medium">{field.fieldValue}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>대화 내역</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {detail.messages?.length || 0}건
                  </span>
                </div>

                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                  {detail.messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.senderType === "member" ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div
                        className={`max-w-sm rounded-xl px-4 py-3 ${
                          msg.senderType === "member"
                            ? "bg-indigo-600 text-white dark:bg-indigo-700 rounded-br-none"
                            : "bg-muted rounded-bl-none"
                        }`}
                      >
                        <div className={`flex items-center gap-2 mb-1.5 text-xs ${
                          msg.senderType === "member" ? "text-indigo-200" : "text-muted-foreground"
                        }`}>
                          {msg.senderType === "member" ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Star className="h-3 w-3" />
                          )}
                          <span className="font-medium">{msg.senderName}</span>
                          <span>{formatDateTime(msg.createdAt)}</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
            </Card>

            {detail.status !== "종결" && (
              <Card>
                <CardContent className="p-4">
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span>추가 문의</span>
                  </div>
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="추가로 문의할 내용을 작성하세요..."
                    rows={3}
                    data-testid="textarea-reply"
                  />
                  <div className="flex items-center justify-end mt-3 gap-2">
                    <Button
                      onClick={handleReply}
                      disabled={!replyText.trim() || replyMutation.isPending}
                      data-testid="button-send-reply"
                    >
                      {replyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      추가 문의 등록
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    );
  }

  if (activeView === "write") {
    const catDef = selectedCategory ? categoryFieldDefs[selectedCategory] : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { setActiveView("list"); setSelectedCategory(""); setFormData({}); setIsUrgent(false); }}
            data-testid="button-back-from-write"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-write-header">문의 작성</h1>
            <p className="text-xs text-muted-foreground mt-0.5">카테고리를 선택하면 필수 입력 항목이 표시됩니다.</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-5">
            <div className="text-sm font-bold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              카테고리 선택 <span className="text-red-500">*</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(categoryFieldDefs).map(([key, val]) => {
                const colors = getCategoryColorClasses(val.color);
                const isSelected = selectedCategory === key;
                const IconComp = val.icon;
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedCategory(key); setFormData({}); }}
                    className={`rounded-md p-3 text-left transition-all border-2 ${
                      isSelected
                        ? `${colors.selectedBg} ${colors.border}`
                        : "bg-card border-border hover-elevate"
                    }`}
                    data-testid={`button-category-${key}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <IconComp className={`h-4 w-4 ${colors.iconColor}`} />
                      <span className={`text-sm font-medium ${isSelected ? "" : "text-foreground"}`}>{key}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{val.desc}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {catDef && (
          <Card>
            <CardContent className="p-0">
              <div className={`px-5 py-3 border-b flex items-center gap-2 ${getCategoryColorClasses(catDef.color).bg}`}>
                {(() => { const IC = catDef.icon; return <IC className={`h-4 w-4 ${getCategoryColorClasses(catDef.color).iconColor}`} />; })()}
                <span className="text-sm font-bold">{selectedCategory} — 필수 입력 항목</span>
              </div>

              <div className="p-5 space-y-4">
                {selectedCategory === "상품CS/미수" && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
                    <div className="flex items-start gap-2">
                      <Camera className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                        온라인 특성상 확인 가능한 사진이 없으면 처리가 불가능합니다. 발송 박스 전체, 상품 전체 사진, 이슈 부분 상세 사진 3장을 별도로 준비해주세요.
                      </p>
                    </div>
                  </div>
                )}

                {catDef.fields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium mb-1">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === "text" && (
                      <Input
                        type="text"
                        placeholder={field.placeholder}
                        value={formData[field.name] || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        data-testid={`input-${field.name}`}
                      />
                    )}
                    {field.type === "date" && (
                      <Input
                        type="date"
                        value={formData[field.name] || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        data-testid={`input-${field.name}`}
                      />
                    )}
                    {field.type === "textarea" && (
                      <Textarea
                        placeholder={field.placeholder}
                        rows={5}
                        value={formData[field.name] || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, [field.name]: e.target.value }))}
                        data-testid={`textarea-${field.name}`}
                      />
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Checkbox
                    id="urgent"
                    checked={isUrgent}
                    onCheckedChange={(checked) => setIsUrgent(!!checked)}
                    data-testid="checkbox-urgent"
                  />
                  <label htmlFor="urgent" className="text-sm cursor-pointer">
                    <Star className="h-3 w-3 inline mr-1 text-red-500" />
                    긴급 문의로 등록 <span className="text-xs text-muted-foreground">(빠른 처리가 필요한 경우 체크)</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedCategory && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => { setActiveView("list"); setSelectedCategory(""); setFormData({}); setIsUrgent(false); }}
              data-testid="button-cancel-write"
            >
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              data-testid="button-submit-inquiry"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Send className="h-4 w-4 mr-1" />
              문의 등록
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-bold" data-testid="text-inquiry-tab-title">문의 게시판</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">궁금한 사항이나 요청사항을 남겨주세요. 담당자가 신속하게 답변드립니다.</p>
        </div>
        <Button onClick={() => setActiveView("write")} data-testid="button-new-inquiry">
          <Plus className="h-4 w-4 mr-1" />
          문의하기
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "전체 문의", value: counts?.total ?? 0, colorClass: "" },
          { label: "답변 대기", value: counts?.byStatus?.["대기"] ?? 0, colorClass: "text-red-600 dark:text-red-400" },
          { label: "답변 완료", value: counts?.byStatus?.["답변완료"] ?? 0, colorClass: "text-blue-600 dark:text-blue-400", badge: counts?.newReplies },
          { label: "종결", value: counts?.byStatus?.["종결"] ?? 0, colorClass: "text-muted-foreground" },
        ].map((card) => (
          <Card key={card.label} data-testid={`card-stat-${card.label}`}>
            <CardContent className="p-4 text-center">
              <div className="text-xs text-muted-foreground font-medium mb-1">{card.label}</div>
              <div className="flex items-center justify-center gap-1">
                <div className={`text-2xl font-bold ${card.colorClass}`}>{card.value}</div>
                {card.badge && card.badge > 0 && (
                  <Badge variant="destructive" className="text-xs" data-testid="badge-new-replies">
                    N
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {["전체", "대기", "답변완료", "종결"].map((f) => (
          <Button
            key={f}
            variant={activeFilter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveFilter(f)}
            data-testid={`button-filter-${f}`}
          >
            {f}
          </Button>
        ))}
      </div>

      {inquiriesLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredInquiries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground mb-3">등록된 문의가 없습니다</p>
            <Button variant="outline" size="sm" onClick={() => setActiveView("write")} data-testid="button-first-inquiry">
              문의하기
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {filteredInquiries.map((item, i) => (
              <div
                key={item.id}
                onClick={() => { setSelectedInquiryId(item.id); setActiveView("detail"); }}
                className={`px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover-elevate ${
                  i > 0 ? "border-t" : ""
                }`}
                data-testid={`row-member-inquiry-${item.id}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Badge className={`${getStatusClasses(item.status)} flex-shrink-0`} data-testid={`badge-status-${item.id}`}>
                    {item.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{item.category}</span>
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.unreadByMember && (
                    <Badge variant="destructive" className="flex-shrink-0 text-xs" data-testid={`badge-new-${item.id}`}>
                      N
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {item.messageCount}
                  </span>
                  <span>{formatDate(item.createdAt)}</span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
