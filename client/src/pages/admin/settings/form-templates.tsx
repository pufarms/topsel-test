import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Upload, Download, Trash2, Edit, FileSpreadsheet, RefreshCw, File, CheckCircle, XCircle, Copy, Check } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import type { FormTemplate } from "@shared/schema";

const TEMPLATE_CATEGORIES = [
  "주문관리",
  "상품관리",
  "재고관리",
  "회원관리",
  "정산관리",
  "기타",
];

const TEMPLATE_TYPES = [
  { value: "download", label: "다운로드용" },
  { value: "upload", label: "업로드용" },
];

const CATEGORY_CODE_MAP: Record<string, string> = {
  "주문관리": "order",
  "상품관리": "product",
  "재고관리": "inventory",
  "회원관리": "member",
  "정산관리": "settlement",
  "기타": "etc",
};

const korToEngMap: Record<string, string> = {
  "주문": "order", "등록": "reg", "양식": "form", "목록": "list",
  "상품": "product", "재고": "stock", "회원": "member", "정산": "settle",
  "취소": "cancel", "반품": "return", "교환": "exchange", "송장": "invoice",
  "배송": "ship", "발주": "purchase", "입고": "inbound", "출고": "outbound",
  "매핑": "mapping", "카테고리": "category", "거래처": "partner", "현재": "current",
  "공급": "supply", "가격": "price", "템플릿": "template", "파일": "file",
};

const generateTemplateCode = (name: string, category: string, templateType: string): string => {
  const categoryCode = CATEGORY_CODE_MAP[category] || "etc";
  const typeCode = templateType === "upload" ? "up" : "dl";
  
  let nameCode = name;
  for (const [kor, eng] of Object.entries(korToEngMap)) {
    nameCode = nameCode.replace(new RegExp(kor, 'g'), eng);
  }
  nameCode = nameCode
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${categoryCode}_${nameCode || "template"}_${typeCode}_${timestamp}${randomSuffix}`;
};

export default function FormTemplatesPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    category: "기타",
    templateType: "download",
  });

  const handleCopyCode = async (code: string) => {
    try {
      if (!navigator.clipboard) {
        throw new Error("클립보드가 지원되지 않습니다");
      }
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({ title: "코드 복사됨", description: `${code}` });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast({ 
        title: "복사 실패", 
        description: "코드를 수동으로 선택하여 복사해주세요.", 
        variant: "destructive" 
      });
    }
  };

  const { data: templates, isLoading, refetch } = useQuery<FormTemplate[]>({
    queryKey: ["/api/admin/form-templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await apiRequest("POST", "/api/admin/form-templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/form-templates"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "양식 생성 완료", description: "새 양식이 등록되었습니다." });
    },
    onError: (error: any) => {
      toast({ title: "생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const res = await apiRequest("PUT", `/api/admin/form-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/form-templates"] });
      setIsEditOpen(false);
      setSelectedTemplate(null);
      toast({ title: "수정 완료", description: "양식이 수정되었습니다." });
    },
    onError: (error: any) => {
      toast({ title: "수정 실패", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/form-templates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/form-templates"] });
      toast({ title: "삭제 완료", description: "양식이 삭제되었습니다." });
    },
    onError: (error: any) => {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/form-templates/${id}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "업로드 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/form-templates"] });
      setUploadingId(null);
      toast({ title: "업로드 완료", description: "파일이 업로드되었습니다." });
    },
    onError: (error: any) => {
      setUploadingId(null);
      toast({ title: "업로드 실패", description: error.message, variant: "destructive" });
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/form-templates/seed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/form-templates"] });
      toast({ title: "초기 양식 생성", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "생성 실패", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", code: "", description: "", category: "기타", templateType: "download" });
  };

  const handleCreate = () => {
    if (!formData.name) {
      toast({ title: "입력 오류", description: "양식 이름은 필수입니다.", variant: "destructive" });
      return;
    }
    const generatedCode = generateTemplateCode(formData.name, formData.category, formData.templateType);
    createMutation.mutate({ ...formData, code: generatedCode });
  };

  const handleEdit = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      code: template.code,
      description: template.description || "",
      category: template.category,
      templateType: template.templateType || "download",
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTemplate) return;
    updateMutation.mutate({
      id: selectedTemplate.id,
      data: {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        templateType: formData.templateType,
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("정말 이 양식을 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleUploadClick = (templateId: string) => {
    setUploadingId(templateId);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingId) {
      uploadMutation.mutate({ id: uploadingId, file });
    }
    e.target.value = "";
  };

  const handleDownload = (template: FormTemplate) => {
    if (!template.fileUrl) {
      toast({ title: "다운로드 불가", description: "업로드된 파일이 없습니다.", variant: "destructive" });
      return;
    }
    const link = document.createElement("a");
    link.href = template.fileUrl;
    link.download = template.fileName || `${template.name}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="양식 관리"
        description="사이트에서 사용되는 엑셀 양식 파일을 관리합니다."
      />

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        data-testid="input-file-upload"
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                양식 목록
              </CardTitle>
              <CardDescription>양식을 등록하고 파일을 업로드하세요.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                새로고침
              </Button>
              {(!templates || templates.length === 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  data-testid="button-seed"
                >
                  {seedMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  기본 양식 생성
                </Button>
              )}
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-create">
                    <Plus className="w-4 h-4 mr-1" />
                    양식 추가
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 양식 등록</DialogTitle>
                    <DialogDescription>양식 정보를 입력하세요. 코드는 자동 생성됩니다.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">양식 이름 *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="예: 주문등록 양식"
                        data-testid="input-name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category">카테고리</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TEMPLATE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="templateType">양식 유형</Label>
                        <Select
                          value={formData.templateType}
                          onValueChange={(value) => setFormData({ ...formData, templateType: value })}
                        >
                          <SelectTrigger data-testid="select-template-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TEMPLATE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">설명</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="양식에 대한 설명"
                        data-testid="input-description"
                      />
                    </div>
                    {formData.name && (
                      <div className="space-y-2">
                        <Label>자동 생성될 코드 (미리보기)</Label>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <code className="text-xs flex-1 break-all">
                            {generateTemplateCode(formData.name, formData.category, formData.templateType)}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">이 코드는 사이트 연동 시 사용됩니다.</p>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
                      취소
                    </Button>
                    <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-create">
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                      등록
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!templates || templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>등록된 양식이 없습니다.</p>
              <p className="text-sm mt-1">"기본 양식 생성" 버튼을 클릭하여 기본 양식을 추가하세요.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">양식 이름</TableHead>
                    <TableHead className="w-[200px]">코드</TableHead>
                    <TableHead className="w-[90px]">유형</TableHead>
                    <TableHead className="w-[100px]">카테고리</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead className="w-[100px]">파일</TableHead>
                    <TableHead className="w-[70px]">버전</TableHead>
                    <TableHead className="w-[80px]">상태</TableHead>
                    <TableHead className="w-[150px] text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id} data-testid={`row-${template.code}`}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1 py-0.5 rounded max-w-[140px] truncate block" title={template.code}>
                            {template.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleCopyCode(template.code)}
                            title="코드 복사"
                            data-testid={`button-copy-${template.code}`}
                          >
                            {copiedCode === template.code ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.templateType === "upload" ? "default" : "secondary"}>
                          {template.templateType === "upload" ? "업로드" : "다운로드"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {template.description || "-"}
                      </TableCell>
                      <TableCell>
                        {template.fileUrl ? (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <File className="w-3 h-3" />
                            <span>{formatFileSize(template.fileSize)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">미등록</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">v{template.version || 1}</Badge>
                      </TableCell>
                      <TableCell>
                        {template.isActive === "true" ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            활성
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="w-3 h-3 mr-1" />
                            비활성
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUploadClick(template.id)}
                            disabled={uploadMutation.isPending && uploadingId === template.id}
                            title="파일 업로드"
                            data-testid={`button-upload-${template.code}`}
                          >
                            {uploadMutation.isPending && uploadingId === template.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                          </Button>
                          {template.fileUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(template)}
                              title="다운로드"
                              data-testid={`button-download-${template.code}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(template)}
                            title="수정"
                            data-testid={`button-edit-${template.code}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(template.id)}
                            disabled={deleteMutation.isPending}
                            title="삭제"
                            data-testid={`button-delete-${template.code}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>양식 수정</DialogTitle>
            <DialogDescription>양식 정보를 수정하세요. 코드는 변경할 수 없습니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">양식 이름 *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-code">양식 코드</Label>
              <Input
                id="edit-code"
                value={formData.code}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">카테고리</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-templateType">양식 유형</Label>
                <Select
                  value={formData.templateType}
                  onValueChange={(value) => setFormData({ ...formData, templateType: value })}
                >
                  <SelectTrigger data-testid="select-edit-template-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">설명</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                data-testid="input-edit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setSelectedTemplate(null); }}>
              취소
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-submit-edit">
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
