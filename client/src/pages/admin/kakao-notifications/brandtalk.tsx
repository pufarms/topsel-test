import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Plus, Edit, Send, Trash2, Calendar, Users, DollarSign, X, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';

interface BrandtalkTemplate {
  id: number;
  title: string;
  message: string;
  buttonName: string | null;
  buttonUrl: string | null;
  totalSent: number;
  lastSentAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface BrandtalkStatistics {
  totalTemplates: number;
  totalSent: number;
  totalCost: number;
}

interface BrandtalkHistoryItem {
  id: number;
  templateId: number | null;
  title: string;
  message: string;
  recipientCount: number;
  successCount: number;
  failCount: number;
  cost: number;
  sentBy: string;
  sentAt: string;
}

interface ButtonItem {
  name: string;
  url: string;
}

const COST_PER_MESSAGE = 27;

interface SolapiTemplate {
  templateId: string;
  name: string;
  content: string;
  buttons?: Array<{ name: string; url: string }>;
}

export default function BrandtalkPage() {
  const [activeTab, setActiveTab] = useState('templates');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [solapiModalOpen, setSolapiModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<BrandtalkTemplate | null>(null);
  const [targetType, setTargetType] = useState<'all' | 'grade'>('all');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [phoneType, setPhoneType] = useState<'phone' | 'managerPhone' | 'both'>('phone');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSolapiTemplates, setSelectedSolapiTemplates] = useState<string[]>([]);
  const itemsPerPage = 20;

  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editButtons, setEditButtons] = useState<ButtonItem[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery<BrandtalkTemplate[]>({
    queryKey: ['/api/admin/brandtalk/templates'],
  });

  const { data: statistics } = useQuery<BrandtalkStatistics>({
    queryKey: ['/api/admin/brandtalk/statistics'],
  });

  const { data: history = [] } = useQuery<BrandtalkHistoryItem[]>({
    queryKey: ['/api/admin/brandtalk/history', dateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter !== 'all') {
        params.set('days', dateFilter);
      }
      const res = await fetch(`/api/admin/brandtalk/history?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    }
  });

  const { data: solapiData, isLoading: isLoadingSolapi, refetch: refetchSolapi } = useQuery<{ success: boolean; templates: SolapiTemplate[] }>({
    queryKey: ['/api/admin/brandtalk/solapi/templates'],
    enabled: solapiModalOpen,
    retry: 1,
  });

  interface Recipient {
    id: string;
    companyName: string;
    representative: string;
    grade: string;
    phone: string | null;
    managerName: string | null;
    managerPhone: string | null;
  }

  const { data: recipientsData } = useQuery<{ success: boolean; recipients: Recipient[]; totalCount: number; phoneStats: { withPhone: number; withManagerPhone: number } }>({
    queryKey: ['/api/admin/brandtalk/recipients'],
    enabled: sendModalOpen,
  });

  const syncMutation = useMutation({
    mutationFn: async (templateIds: string[]) => {
      const res = await fetch('/api/admin/brandtalk/solapi/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateIds }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('동기화 실패');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: '동기화 완료', 
        description: `${data.synced}개 템플릿을 성공적으로 불러왔습니다` 
      });
      setSolapiModalOpen(false);
      setSelectedSolapiTemplates([]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/statistics'] });
    },
    onError: () => {
      toast({ title: '동기화 실패', description: '다시 시도해주세요', variant: 'destructive' });
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; message: string; buttonName?: string; buttonUrl?: string }) => {
      const res = await fetch('/api/admin/brandtalk/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('생성 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/statistics'] });
      toast({ title: '브랜드톡이 생성되었습니다' });
      setEditModalOpen(false);
      resetEditForm();
    },
    onError: () => {
      toast({ title: '생성 실패', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { title: string; message: string; buttonName?: string; buttonUrl?: string } }) => {
      const res = await fetch(`/api/admin/brandtalk/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('수정 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/templates'] });
      toast({ title: '브랜드톡이 수정되었습니다' });
      setEditModalOpen(false);
      resetEditForm();
    },
    onError: () => {
      toast({ title: '수정 실패', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/brandtalk/templates/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('삭제 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/statistics'] });
      toast({ title: '브랜드톡이 삭제되었습니다' });
      setDeleteModalOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({ title: '삭제 실패', variant: 'destructive' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, targetType, selectedGrades, phoneType }: { id: number; targetType: string; selectedGrades: string[]; phoneType: string }) => {
      const res = await fetch(`/api/admin/brandtalk/send/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, selectedGrades, phoneType }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('발송 실패');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/statistics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/brandtalk/history'] });
      toast({
        title: '발송 완료',
        description: `${data.successCount}건 발송 / ${data.failCount}건 실패 / 비용: ${data.cost.toLocaleString()}원`,
      });
      setSendModalOpen(false);
      setSelectedTemplate(null);
    },
    onError: () => {
      toast({ title: '발송 실패', variant: 'destructive' });
    },
  });

  const resetEditForm = () => {
    setEditTitle('');
    setEditMessage('');
    setEditButtons([]);
    setSelectedTemplate(null);
  };

  const handleCreate = () => {
    resetEditForm();
    setEditModalOpen(true);
  };

  const handleEdit = (template: BrandtalkTemplate) => {
    setSelectedTemplate(template);
    setEditTitle(template.title);
    setEditMessage(template.message);
    if (template.buttonName && template.buttonUrl) {
      setEditButtons([{ name: template.buttonName, url: template.buttonUrl }]);
    } else {
      setEditButtons([]);
    }
    setEditModalOpen(true);
  };

  const handleSend = (template: BrandtalkTemplate) => {
    setSelectedTemplate(template);
    setTargetType('all');
    setSelectedGrades([]);
    setSendModalOpen(true);
  };

  const handleDelete = (template: BrandtalkTemplate) => {
    setSelectedTemplate(template);
    setDeleteModalOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!editTitle.trim() || !editMessage.trim()) {
      toast({ title: '제목과 내용을 입력해주세요', variant: 'destructive' });
      return;
    }

    const data = {
      title: editTitle.trim(),
      message: editMessage.trim(),
      buttonName: editButtons.length > 0 ? editButtons[0].name : undefined,
      buttonUrl: editButtons.length > 0 ? editButtons[0].url : undefined,
    };

    if (selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleConfirmSend = () => {
    if (!selectedTemplate) return;
    sendMutation.mutate({ 
      id: selectedTemplate.id, 
      targetType, 
      selectedGrades, 
      phoneType 
    });
  };

  // 예상 수신자 수 계산
  const getExpectedRecipientCount = () => {
    if (!recipientsData?.recipients) return 0;
    
    let targetMembers = recipientsData.recipients;
    
    if (targetType === 'grade' && selectedGrades.length > 0) {
      targetMembers = targetMembers.filter(m => selectedGrades.includes(m.grade));
    }
    
    let count = 0;
    for (const member of targetMembers) {
      if (phoneType === 'phone' && member.phone) count++;
      else if (phoneType === 'managerPhone' && member.managerPhone) count++;
      else if (phoneType === 'both') {
        if (member.phone) count++;
        if (member.managerPhone) count++;
      }
    }
    return count;
  };

  const expectedCount = getExpectedRecipientCount();

  const addButton = () => {
    if (editButtons.length < 5) {
      setEditButtons([...editButtons, { name: '', url: '' }]);
    }
  };

  const removeButton = (index: number) => {
    setEditButtons(editButtons.filter((_, i) => i !== index));
  };

  const updateButton = (index: number, field: 'name' | 'url', value: string) => {
    const updated = [...editButtons];
    updated[index][field] = value;
    setEditButtons(updated);
  };

  const paginatedHistory = history.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(history.length / itemsPerPage);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">브랜드톡</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates" data-testid="tab-templates">브랜드톡 관리</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">발송 이력</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    총 브랜드톡
                  </CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-templates">
                    {statistics.totalTemplates}개
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    총 발송 건수
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-sent">
                    {statistics.totalSent.toLocaleString()}건
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    총 비용
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-cost">
                    {statistics.totalCost.toLocaleString()}원
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSolapiModalOpen(true)} data-testid="btn-solapi-import">
              <Download className="w-4 h-4 mr-2" />
              솔라피에서 불러오기
            </Button>
            <Button onClick={handleCreate} data-testid="btn-create-brandtalk">
              <Plus className="w-4 h-4 mr-2" />
              새 브랜드톡 작성
            </Button>
          </div>

          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-muted-foreground text-center">등록된 브랜드톡이 없습니다</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <Card key={template.id} data-testid={`brandtalk-card-${template.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base line-clamp-1">{template.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {template.message.length > 100
                        ? template.message.substring(0, 100) + '...'
                        : template.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(template.createdAt).toLocaleDateString('ko-KR')}</span>
                      {template.totalSent > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {template.totalSent.toLocaleString()}건 발송
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(template)}
                        data-testid={`btn-edit-${template.id}`}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        편집
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSend(template)}
                        data-testid={`btn-send-${template.id}`}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        발송
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(template)}
                        data-testid={`btn-delete-${template.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40" data-testid="select-date-filter">
                <SelectValue placeholder="기간 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">오늘</SelectItem>
                <SelectItem value="7">최근 7일</SelectItem>
                <SelectItem value="30">최근 30일</SelectItem>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">발송일시</th>
                      <th className="text-left p-3 font-medium">제목</th>
                      <th className="text-right p-3 font-medium">발송건수</th>
                      <th className="text-right p-3 font-medium">성공</th>
                      <th className="text-right p-3 font-medium">실패</th>
                      <th className="text-right p-3 font-medium">비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          발송 이력이 없습니다
                        </td>
                      </tr>
                    ) : (
                      paginatedHistory.map((item) => (
                        <tr key={item.id} className="border-b" data-testid={`history-row-${item.id}`}>
                          <td className="p-3">
                            {new Date(item.sentAt).toLocaleString('ko-KR')}
                          </td>
                          <td className="p-3">{item.title}</td>
                          <td className="text-right p-3">
                            {item.recipientCount.toLocaleString()}건
                          </td>
                          <td className="text-right p-3 text-green-600">
                            {item.successCount.toLocaleString()}건
                          </td>
                          <td className="text-right p-3 text-red-600">
                            {item.failCount.toLocaleString()}건
                          </td>
                          <td className="text-right p-3">
                            {item.cost.toLocaleString()}원
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                data-testid="btn-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                data-testid="btn-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? '브랜드톡 편집' : '새 브랜드톡 작성'}</DialogTitle>
            <DialogDescription>
              브랜드톡 메시지를 작성하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">제목 (필수)</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value.slice(0, 50))}
                placeholder="제목을 입력하세요"
                maxLength={50}
                data-testid="input-title"
              />
              <p className="text-xs text-muted-foreground mt-1">{editTitle.length}/50자</p>
            </div>

            <div>
              <Label htmlFor="edit-message">메시지 내용 (필수)</Label>
              <Textarea
                id="edit-message"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value.slice(0, 1000))}
                placeholder="메시지 내용을 입력하세요"
                rows={6}
                maxLength={1000}
                data-testid="input-message"
              />
              <p className="text-xs text-muted-foreground mt-1">{editMessage.length}/1,000자</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>버튼 (선택사항)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  disabled={editButtons.length >= 5}
                  data-testid="btn-add-button"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  버튼 추가
                </Button>
              </div>

              {editButtons.map((button, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <Input
                    value={button.name}
                    onChange={(e) => updateButton(index, 'name', e.target.value.slice(0, 14))}
                    placeholder="버튼명 (14자)"
                    maxLength={14}
                    className="w-1/3"
                    data-testid={`input-button-name-${index}`}
                  />
                  <Input
                    value={button.url}
                    onChange={(e) => updateButton(index, 'url', e.target.value)}
                    placeholder="링크 URL"
                    className="flex-1"
                    data-testid={`input-button-url-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeButton(index)}
                    data-testid={`btn-remove-button-${index}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}

              {editButtons.length === 0 && (
                <p className="text-sm text-muted-foreground">버튼 없이 메시지만 발송됩니다.</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} data-testid="btn-cancel-edit">
              취소
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createMutation.isPending || updateMutation.isPending || !editTitle.trim() || !editMessage.trim()}
              data-testid="btn-save-template"
            >
              {createMutation.isPending || updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>브랜드톡 발송</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">메시지 미리보기</h4>
              <p className="text-sm whitespace-pre-wrap line-clamp-4">
                {selectedTemplate?.message}
              </p>
            </div>

            <div>
              <Label className="mb-2 block">발송 대상</Label>
              <Select value={targetType} onValueChange={(v: 'all' | 'grade') => setTargetType(v)}>
                <SelectTrigger data-testid="select-target-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 회원</SelectItem>
                  <SelectItem value="grade">등급별 선택</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetType === 'grade' && (
              <div className="space-y-2">
                {['ASSOCIATE', 'START', 'DRIVING', 'TOP'].map((grade) => (
                  <label key={grade} className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedGrades.includes(grade)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedGrades([...selectedGrades, grade]);
                        } else {
                          setSelectedGrades(selectedGrades.filter((g) => g !== grade));
                        }
                      }}
                      data-testid={`checkbox-grade-${grade}`}
                    />
                    <span>{grade}</span>
                  </label>
                ))}
              </div>
            )}

            <div>
              <Label className="mb-2 block">연락처 유형</Label>
              <Select value={phoneType} onValueChange={(v: 'phone' | 'managerPhone' | 'both') => setPhoneType(v)}>
                <SelectTrigger data-testid="select-phone-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">대표연락처</SelectItem>
                  <SelectItem value="managerPhone">담당자연락처</SelectItem>
                  <SelectItem value="both">둘 다</SelectItem>
                </SelectContent>
              </Select>
              {recipientsData?.phoneStats && (
                <p className="text-xs text-muted-foreground mt-1">
                  대표연락처: {recipientsData.phoneStats.withPhone}명 / 담당자연락처: {recipientsData.phoneStats.withManagerPhone}명
                </p>
              )}
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>총 회원 수:</span>
                  <span className="font-medium">{recipientsData?.totalCount || 0}명</span>
                </div>
                <div className="flex justify-between">
                  <span>예상 발송 건수:</span>
                  <span className="font-medium">{expectedCount}건</span>
                </div>
                <div className="flex justify-between">
                  <span>건당 비용:</span>
                  <span className="font-medium">{COST_PER_MESSAGE}원</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>총 예상 비용:</span>
                  <span>{(expectedCount * COST_PER_MESSAGE).toLocaleString()}원</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive font-medium">
                주의: 발송 후에는 취소할 수 없습니다.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModalOpen(false)} data-testid="btn-cancel-send">
              취소
            </Button>
            <Button 
              onClick={handleConfirmSend} 
              disabled={sendMutation.isPending || expectedCount === 0} 
              data-testid="btn-confirm-send"
            >
              {sendMutation.isPending ? '발송 중...' : `${expectedCount}건 발송하기`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>브랜드톡 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">"{selectedTemplate?.title}"</span>을(를) 삭제하시겠습니까?
              <br />
              삭제된 브랜드톡은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="btn-confirm-delete"
            >
              {deleteMutation.isPending ? '삭제 중...' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={solapiModalOpen} onOpenChange={setSolapiModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>솔라피 브랜드톡 템플릿 불러오기</DialogTitle>
            <DialogDescription>
              솔라피 콘솔에 등록된 브랜드톡 템플릿을 선택하여 불러옵니다
            </DialogDescription>
          </DialogHeader>

          {isLoadingSolapi ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : solapiData?.success && solapiData?.templates?.length > 0 ? (
            <div className="space-y-2">
              {solapiData.templates.map((template: SolapiTemplate) => (
                <div
                  key={template.templateId}
                  className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover-elevate"
                  onClick={() => {
                    setSelectedSolapiTemplates(prev =>
                      prev.includes(template.templateId)
                        ? prev.filter(id => id !== template.templateId)
                        : [...prev, template.templateId]
                    );
                  }}
                  data-testid={`solapi-template-${template.templateId}`}
                >
                  <Checkbox
                    checked={selectedSolapiTemplates.includes(template.templateId)}
                    onCheckedChange={() => {}}
                    data-testid={`checkbox-solapi-${template.templateId}`}
                  />
                  <div className="flex-1">
                    <h4 className="font-medium">{template.name || '제목 없음'}</h4>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {template.content?.substring(0, 100)}...
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      ID: {template.templateId}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {solapiData?.success === false
                ? '솔라피 API 연결에 실패했습니다. API 키를 확인해주세요.'
                : '등록된 브랜드톡 템플릿이 없습니다'}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSolapiModalOpen(false)} data-testid="btn-cancel-solapi">
              취소
            </Button>
            <Button
              onClick={() => syncMutation.mutate(selectedSolapiTemplates)}
              disabled={selectedSolapiTemplates.length === 0 || syncMutation.isPending}
              data-testid="btn-sync-solapi"
            >
              {syncMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  동기화 중...
                </>
              ) : (
                `선택한 ${selectedSolapiTemplates.length}개 불러오기`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
