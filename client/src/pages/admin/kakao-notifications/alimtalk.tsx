import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, Save } from 'lucide-react';

interface AlimtalkTemplate {
  id: number;
  templateCode: string;
  templateId: string;
  templateName: string;
  description: string;
  isAuto: boolean;
  isActive: boolean;
  totalSent: number;
  totalCost: number;
}

interface AlimtalkStatistics {
  totalTemplates: number;
  totalSent: number;
  totalCost: number;
  monthlySent: number;
  monthlyCost: number;
}

interface AlimtalkHistoryItem {
  id: number;
  templateName: string;
  recipientCount: number;
  successCount: number;
  failCount: number;
  cost: number;
  sentAt: string;
}

export default function AlimtalkPage() {
  const [activeTab, setActiveTab] = useState('templates');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AlimtalkTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<AlimtalkTemplate | null>(null);
  const [targetType, setTargetType] = useState<'all' | 'grade'>('all');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery<AlimtalkTemplate[]>({
    queryKey: ['/api/admin/alimtalk/templates'],
  });

  const { data: statistics } = useQuery<AlimtalkStatistics>({
    queryKey: ['/api/admin/alimtalk/statistics'],
  });

  const { data: history = [] } = useQuery<AlimtalkHistoryItem[]>({
    queryKey: ['/api/admin/alimtalk/history'],
  });

  const { data: templateDetail, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['/api/admin/alimtalk/templates', viewingTemplate?.id, 'detail'],
    queryFn: async () => {
      if (!viewingTemplate?.id) return null;
      const response = await fetch(`/api/admin/alimtalk/templates/${viewingTemplate.id}/detail`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load template');
      }
      return response.json();
    },
    enabled: !!viewingTemplate?.id,
    retry: 1,
    staleTime: 0
  });

  useEffect(() => {
    if (templateDetail) {
      setEditName(templateDetail.templateName || '');
      setEditDescription(templateDetail.description || '');
    }
  }, [templateDetail]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const res = await fetch(`/api/admin/alimtalk/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('토글 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/alimtalk/templates'] });
      toast({ title: '변경되었습니다' });
    },
    onError: () => {
      toast({ title: '오류가 발생했습니다', variant: 'destructive' });
    },
  });

  const modeMutation = useMutation({
    mutationFn: async ({ id, isAuto }: { id: number; isAuto: boolean }) => {
      const res = await fetch(`/api/admin/alimtalk/templates/${id}/mode`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAuto }),
      });
      if (!res.ok) throw new Error('모드 변경 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/alimtalk/templates'] });
      toast({ title: '모드가 변경되었습니다' });
    },
    onError: () => {
      toast({ title: '오류가 발생했습니다', variant: 'destructive' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({
      code,
      recipients,
    }: {
      code: string;
      recipients: string[];
    }) => {
      const res = await fetch(`/api/admin/alimtalk/send/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients }),
      });
      if (!res.ok) throw new Error('발송 실패');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/alimtalk/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/alimtalk/statistics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/alimtalk/history'] });
      toast({
        title: '발송 완료',
        description: `${data.successCount}건 발송 / ${data.failCount}건 실패 / 비용: ${data.cost.toLocaleString()}원`,
      });
      setSendModalOpen(false);
    },
    onError: () => {
      toast({ title: '발송 실패', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, templateName, description }: { id: number; templateName: string; description: string }) => {
      const res = await fetch(`/api/admin/alimtalk/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName, description }),
      });
      if (!res.ok) throw new Error('수정 실패');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/alimtalk/templates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/alimtalk/templates', viewingTemplate?.id, 'detail'] });
      toast({ title: '템플릿이 수정되었습니다' });
      setViewingTemplate(null);
    },
    onError: () => {
      toast({ title: '수정 실패', variant: 'destructive' });
    },
  });

  const handleSend = (template: AlimtalkTemplate) => {
    setSelectedTemplate(template);
    setSendModalOpen(true);
  };

  const handleViewTemplate = (template: AlimtalkTemplate) => {
    setViewingTemplate(template);
  };

  const handleConfirmSend = async () => {
    if (!selectedTemplate) return;

    const recipients = ['01012345678'];

    sendMutation.mutate({
      code: selectedTemplate.templateCode,
      recipients,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">알림톡(고정)</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates" data-testid="tab-templates">템플릿 관리</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">발송 이력</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    총 템플릿
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-templates">
                    {statistics.totalTemplates}개
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    총 발송
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-sent">
                    {statistics.totalSent.toLocaleString()}건
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    이번 달 발송
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-monthly-sent">
                    {statistics.monthlySent.toLocaleString()}건
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">
                    이번 달 비용
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-monthly-cost">
                    {statistics.monthlyCost.toLocaleString()}원
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>전체 템플릿</CardTitle>
              <p className="text-sm text-muted-foreground">
                자동: 시스템에서 자동 발송 / 수동: 관리 페이지에서 버튼 클릭 시 발송
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {templates.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">등록된 템플릿이 없습니다</p>
              ) : (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`template-${template.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold">{template.templateName}</h3>
                        <Badge variant={template.isAuto ? 'secondary' : 'default'}>
                          {template.isAuto ? '자동' : '수동'}
                        </Badge>
                        <Badge variant="outline">{template.templateCode}</Badge>
                        {!template.isActive && (
                          <Badge variant="secondary">비활성</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {template.description}
                      </p>
                      <div className="text-sm text-muted-foreground">
                        발송: {template.totalSent.toLocaleString()}건 / 비용:{' '}
                        {template.totalCost.toLocaleString()}원
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Select
                        value={template.isAuto ? 'auto' : 'manual'}
                        onValueChange={(value) =>
                          modeMutation.mutate({
                            id: template.id,
                            isAuto: value === 'auto',
                          })
                        }
                      >
                        <SelectTrigger className="w-24" data-testid={`select-mode-${template.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">자동</SelectItem>
                          <SelectItem value="manual">수동</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewTemplate(template)}
                        data-testid={`btn-view-${template.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        내용
                      </Button>

                      {!template.isAuto && (
                        <Button
                          size="sm"
                          onClick={() => handleSend(template)}
                          disabled={!template.isActive}
                          data-testid={`btn-test-${template.id}`}
                        >
                          테스트
                        </Button>
                      )}

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={template.isActive}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: template.id, isActive: checked })
                          }
                          data-testid={`switch-${template.id}`}
                        />
                        <span className="text-sm font-medium w-8">
                          {template.isActive ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>발송 이력</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">날짜</th>
                      <th className="text-left p-2">템플릿</th>
                      <th className="text-right p-2">대상</th>
                      <th className="text-right p-2">성공</th>
                      <th className="text-right p-2">실패</th>
                      <th className="text-right p-2">비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          발송 이력이 없습니다
                        </td>
                      </tr>
                    ) : (
                      history.map((item) => (
                        <tr key={item.id} className="border-b" data-testid={`history-row-${item.id}`}>
                          <td className="p-2">
                            {new Date(item.sentAt).toLocaleString('ko-KR')}
                          </td>
                          <td className="p-2">{item.templateName}</td>
                          <td className="text-right p-2">
                            {item.recipientCount.toLocaleString()}건
                          </td>
                          <td className="text-right p-2 text-green-600">
                            {item.successCount.toLocaleString()}건
                          </td>
                          <td className="text-right p-2 text-red-600">
                            {item.failCount.toLocaleString()}건
                          </td>
                          <td className="text-right p-2">
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
        </TabsContent>
      </Tabs>

      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>알림톡 테스트 발송</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.templateName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                발송 대상
              </label>
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

            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>발송 건수:</span>
                  <span className="font-medium">1건 (테스트)</span>
                </div>
                <div className="flex justify-between">
                  <span>건당 비용:</span>
                  <span className="font-medium">13원</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>총 예상 비용:</span>
                  <span>13원</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModalOpen(false)} data-testid="btn-cancel-send">
              취소
            </Button>
            <Button onClick={handleConfirmSend} disabled={sendMutation.isPending} data-testid="btn-confirm-send">
              {sendMutation.isPending ? '발송 중...' : '발송하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingTemplate} onOpenChange={(open) => !open && setViewingTemplate(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>템플릿 정보 수정</DialogTitle>
            <DialogDescription>
              템플릿 정보를 확인하고 수정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">로딩 중...</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">템플릿 코드</Label>
                  <div className="p-3 bg-muted rounded-lg font-mono text-sm">
                    {viewingTemplate?.templateCode}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium mb-2 block">솔라피 템플릿 ID</Label>
                  <div className="p-3 bg-muted rounded-lg font-mono text-sm break-all">
                    {viewingTemplate?.templateId}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-name" className="text-sm font-medium mb-2 block">템플릿 이름</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="템플릿 이름을 입력하세요"
                  data-testid="input-template-name"
                />
              </div>

              <div>
                <Label htmlFor="edit-description" className="text-sm font-medium mb-2 block">설명</Label>
                <Textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="템플릿 설명을 입력하세요"
                  rows={3}
                  data-testid="input-template-description"
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">발송 통계</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">총 발송</div>
                    <div className="text-2xl font-bold">
                      {viewingTemplate?.totalSent?.toLocaleString() || 0}건
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">총 비용</div>
                    <div className="text-2xl font-bold">
                      {viewingTemplate?.totalCost?.toLocaleString() || 0}원
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">현재 상태</Label>
                <div className="flex gap-2">
                  <Badge variant={viewingTemplate?.isAuto ? 'secondary' : 'default'}>
                    {viewingTemplate?.isAuto ? '자동 발송' : '수동 발송'}
                  </Badge>
                  <Badge variant={viewingTemplate?.isActive ? 'default' : 'secondary'}>
                    {viewingTemplate?.isActive ? '활성화' : '비활성화'}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewingTemplate(null)} data-testid="btn-close-view">
              취소
            </Button>
            <Button 
              onClick={() => {
                if (viewingTemplate) {
                  updateMutation.mutate({
                    id: viewingTemplate.id,
                    templateName: editName,
                    description: editDescription
                  });
                }
              }}
              disabled={updateMutation.isPending || !editName.trim()}
              data-testid="btn-save-template"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
