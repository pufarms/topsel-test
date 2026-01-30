import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';

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
  const [targetType, setTargetType] = useState<'all' | 'grade'>('all');
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
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

  const autoTemplates = templates.filter((t) => t.isAuto);
  const manualTemplates = templates.filter((t) => !t.isAuto);

  const handleSend = (template: AlimtalkTemplate) => {
    setSelectedTemplate(template);
    setSendModalOpen(true);
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
              <CardTitle>자동 발송 알림</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {autoTemplates.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">자동 발송 템플릿이 없습니다</p>
              ) : (
                autoTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`template-auto-${template.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{template.templateName}</h3>
                        <Badge variant="secondary">{template.templateCode}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {template.description}
                      </p>
                      <div className="text-sm text-muted-foreground">
                        발송: {template.totalSent.toLocaleString()}건 / 비용:{' '}
                        {template.totalCost.toLocaleString()}원
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.isActive}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: template.id, isActive: checked })
                        }
                        data-testid={`switch-${template.id}`}
                      />
                      <span className="text-sm font-medium">
                        {template.isActive ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>수동 발송 알림</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {manualTemplates.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">수동 발송 템플릿이 없습니다</p>
              ) : (
                manualTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`template-manual-${template.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{template.templateName}</h3>
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
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSend(template)}
                        disabled={!template.isActive}
                        data-testid={`btn-send-${template.id}`}
                      >
                        발송
                      </Button>
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
              {history.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">발송 이력이 없습니다</p>
              ) : (
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
                      {history.map((item) => (
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
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>알림톡 발송</DialogTitle>
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
    </div>
  );
}
