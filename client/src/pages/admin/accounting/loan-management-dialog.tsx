import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Trash2, Pencil, ChevronDown, ChevronUp,
  Building2, Calculator, DollarSign, TrendingDown, CalendarDays, X,
} from "lucide-react";

interface LoanManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Loan {
  id: number;
  loanName: string;
  bankName: string;
  loanType: string;
  loanAmount: number;
  annualRate: string | number;
  loanStartDate: string;
  loanEndDate: string;
  loanTermMonths: number;
  repaymentType: string;
  repaymentDay: number;
  monthlyPayment: number;
  remainingBalance: number;
  status: string;
  memo: string | null;
  totalRepaid: number;
  totalInterestPaid: number;
  repaymentCount: number;
}

interface Repayment {
  id: number;
  loanId: number;
  repaymentDate: string;
  totalAmount: number;
  principalAmount: number;
  interestAmount: number;
  remainingAfter: number;
  isExtraPayment: boolean;
  memo: string | null;
}

interface LoanSummary {
  activeCount: number;
  totalRemainingBalance: number;
  monthlyRepayment: number;
  monthlyInterest: number;
}

interface CalcResult {
  totalAmount: number;
  principalAmount: number;
  interestAmount: number;
  remainingAfter: number;
}

const REPAYMENT_TYPE_LABELS: Record<string, string> = {
  equal_payment: '원리금균등',
  equal_principal: '원금균등',
  interest_only: '만기일시',
  custom: '자유상환',
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  term: '기간대출',
  credit: '신용대출',
  mortgage: '담보대출',
};

function calcMonthlyPayment(principal: number, annualRate: number, months: number, type: string): number {
  const r = annualRate / 100 / 12;
  if (type === 'equal_payment') {
    if (r === 0) return Math.round(principal / months);
    return Math.round(principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
  } else if (type === 'equal_principal') {
    return Math.round(principal / months + principal * r);
  } else if (type === 'interest_only') {
    return Math.round(principal * r);
  }
  return 0;
}

function formatComma(val: string): string {
  const num = val.replace(/[^\d]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString();
}

function parseNum(val: string): number {
  return Number(val.replace(/[^\d]/g, '')) || 0;
}

function calcTermMonths(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

function statusBadge(status: string) {
  if (status === 'active') return <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-loan-active">상환중</Badge>;
  if (status === 'completed') return <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" data-testid="badge-loan-completed">완납</Badge>;
  return <Badge variant="outline" className="bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400" data-testid="badge-loan-closed">조기상환</Badge>;
}

export default function LoanManagementDialog({ open, onOpenChange }: LoanManagementDialogProps) {
  const { toast } = useToast();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [showRepaymentForm, setShowRepaymentForm] = useState(false);
  const [repaymentLoan, setRepaymentLoan] = useState<Loan | null>(null);
  const [isExtraRepayment, setIsExtraRepayment] = useState(false);
  const [deleteRepaymentConfirm, setDeleteRepaymentConfirm] = useState<{ loanId: number; repaymentId: number } | null>(null);

  const [loanName, setLoanName] = useState('');
  const [bankName, setBankName] = useState('');
  const [loanType, setLoanType] = useState('term');
  const [loanAmountDisplay, setLoanAmountDisplay] = useState('');
  const [annualRate, setAnnualRate] = useState('');
  const [loanStartDate, setLoanStartDate] = useState('');
  const [loanEndDate, setLoanEndDate] = useState('');
  const [repaymentType, setRepaymentType] = useState('equal_payment');
  const [repaymentDay, setRepaymentDay] = useState('1');
  const [loanMemo, setLoanMemo] = useState('');
  const [customMonthlyPayment, setCustomMonthlyPayment] = useState('');

  const [repaymentMode, setRepaymentMode] = useState<'auto' | 'manual'>('auto');
  const [repaymentDate, setRepaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [repTotalDisplay, setRepTotalDisplay] = useState('');
  const [repPrincipalDisplay, setRepPrincipalDisplay] = useState('');
  const [repIsExtra, setRepIsExtra] = useState(false);
  const [repMemo, setRepMemo] = useState('');
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);

  const { data: loansData, isLoading: loansLoading } = useQuery<Loan[]>({
    queryKey: ['/api/admin/accounting/loans'],
    enabled: open,
  });
  const loans = loansData || [];

  const { data: summaryData } = useQuery<LoanSummary>({
    queryKey: ['/api/admin/accounting/loans/summary', currentMonth],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/loans/summary?month=${currentMonth}`, { credentials: 'include' });
      if (!res.ok) throw new Error('요약 조회 실패');
      return res.json();
    },
    enabled: open,
  });

  const { data: repaymentsData, isLoading: repaymentsLoading } = useQuery<Repayment[]>({
    queryKey: ['/api/admin/accounting/loans', expandedLoanId, 'repayments'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/loans/${expandedLoanId}/repayments`, { credentials: 'include' });
      if (!res.ok) throw new Error('상환내역 조회 실패');
      return res.json();
    },
    enabled: expandedLoanId !== null,
  });
  const repayments = repaymentsData || [];

  const loanTermMonths = useMemo(() => calcTermMonths(loanStartDate, loanEndDate), [loanStartDate, loanEndDate]);
  const loanAmount = parseNum(loanAmountDisplay);
  const rate = parseFloat(annualRate) || 0;

  const estimatedMonthly = useMemo(() => {
    if (!loanAmount || !loanTermMonths || loanTermMonths <= 0) return 0;
    if (repaymentType === 'custom') return parseNum(customMonthlyPayment);
    return calcMonthlyPayment(loanAmount, rate, loanTermMonths, repaymentType);
  }, [loanAmount, rate, loanTermMonths, repaymentType, customMonthlyPayment]);

  const estimatedTotalRepayment = useMemo(() => {
    if (repaymentType === 'interest_only') return loanAmount + estimatedMonthly * loanTermMonths;
    return estimatedMonthly * loanTermMonths;
  }, [estimatedMonthly, loanTermMonths, loanAmount, repaymentType]);

  const estimatedTotalInterest = useMemo(() => {
    if (repaymentType === 'interest_only') return estimatedMonthly * loanTermMonths;
    return estimatedTotalRepayment - loanAmount;
  }, [estimatedTotalRepayment, loanAmount, estimatedMonthly, loanTermMonths, repaymentType]);

  const repTotal = parseNum(repTotalDisplay);
  const repPrincipal = parseNum(repPrincipalDisplay);
  const repInterest = repaymentMode === 'manual' ? Math.max(0, repTotal - repPrincipal) : (calcResult?.interestAmount || 0);
  const repRemainingAfter = repaymentMode === 'manual'
    ? Math.max(0, (repaymentLoan?.remainingBalance || 0) - repPrincipal)
    : (calcResult?.remainingAfter || 0);

  const invalidateLoans = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/loans'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/loans/summary'] });
  };

  const createLoanMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest('POST', '/api/admin/accounting/loans', body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '대출 등록 완료' });
      invalidateLoans();
      closeLoanForm();
    },
    onError: (e: any) => toast({ title: '등록 실패', description: e.message, variant: 'destructive' }),
  });

  const updateLoanMutation = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const res = await apiRequest('PUT', `/api/admin/accounting/loans/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '대출 수정 완료' });
      invalidateLoans();
      closeLoanForm();
    },
    onError: (e: any) => toast({ title: '수정 실패', description: e.message, variant: 'destructive' }),
  });

  const deleteLoanMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/accounting/loans/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '대출 삭제 완료' });
      invalidateLoans();
      if (expandedLoanId) setExpandedLoanId(null);
    },
    onError: (e: any) => {
      const msg = e.message?.includes('400') ? '상환 내역이 있는 대출은 삭제할 수 없습니다' : e.message;
      toast({ title: '삭제 실패', description: msg, variant: 'destructive' });
    },
  });

  const createRepaymentMutation = useMutation({
    mutationFn: async ({ loanId, ...body }: any) => {
      const res = await apiRequest('POST', `/api/admin/accounting/loans/${loanId}/repayments`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '상환 등록 완료' });
      invalidateLoans();
      if (expandedLoanId) {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/loans', expandedLoanId, 'repayments'] });
      }
      closeRepaymentForm();
    },
    onError: (e: any) => toast({ title: '상환 등록 실패', description: e.message, variant: 'destructive' }),
  });

  const deleteRepaymentMutation = useMutation({
    mutationFn: async ({ loanId, repaymentId }: { loanId: number; repaymentId: number }) => {
      const res = await apiRequest('DELETE', `/api/admin/accounting/loans/${loanId}/repayments/${repaymentId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '상환 내역 삭제 완료' });
      invalidateLoans();
      if (expandedLoanId) {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/loans', expandedLoanId, 'repayments'] });
      }
      setDeleteRepaymentConfirm(null);
    },
    onError: (e: any) => toast({ title: '삭제 실패', description: e.message, variant: 'destructive' }),
  });

  const calculateMutation = useMutation({
    mutationFn: async (loanId: number) => {
      const res = await apiRequest('POST', `/api/admin/accounting/loans/${loanId}/calculate`, {});
      return res.json();
    },
    onSuccess: (data: CalcResult) => {
      setCalcResult(data);
    },
    onError: (e: any) => toast({ title: '계산 실패', description: e.message, variant: 'destructive' }),
  });

  function resetLoanForm() {
    setLoanName('');
    setBankName('');
    setLoanType('term');
    setLoanAmountDisplay('');
    setAnnualRate('');
    setLoanStartDate('');
    setLoanEndDate('');
    setRepaymentType('equal_payment');
    setRepaymentDay('1');
    setLoanMemo('');
    setCustomMonthlyPayment('');
  }

  function closeLoanForm() {
    setShowLoanForm(false);
    setEditingLoan(null);
    resetLoanForm();
  }

  function openEditLoan(loan: Loan) {
    setEditingLoan(loan);
    setLoanName(loan.loanName);
    setBankName(loan.bankName);
    setLoanType(loan.loanType);
    setLoanAmountDisplay(loan.loanAmount.toLocaleString());
    setAnnualRate(String(loan.annualRate));
    setLoanStartDate(loan.loanStartDate);
    setLoanEndDate(loan.loanEndDate);
    setRepaymentType(loan.repaymentType);
    setRepaymentDay(String(loan.repaymentDay));
    setLoanMemo(loan.memo || '');
    if (loan.repaymentType === 'custom' && loan.monthlyPayment) {
      setCustomMonthlyPayment(loan.monthlyPayment.toLocaleString());
    }
    setShowLoanForm(true);
  }

  function closeRepaymentForm() {
    setShowRepaymentForm(false);
    setRepaymentLoan(null);
    setIsExtraRepayment(false);
    setRepaymentMode('auto');
    setRepaymentDate(new Date().toISOString().slice(0, 10));
    setRepTotalDisplay('');
    setRepPrincipalDisplay('');
    setRepIsExtra(false);
    setRepMemo('');
    setCalcResult(null);
  }

  function openRepaymentForm(loan: Loan, extra: boolean) {
    setRepaymentLoan(loan);
    setIsExtraRepayment(extra);
    setRepIsExtra(extra);
    setRepaymentMode('auto');
    setRepaymentDate(new Date().toISOString().slice(0, 10));
    setRepTotalDisplay('');
    setRepPrincipalDisplay('');
    setRepMemo('');
    setCalcResult(null);
    setShowRepaymentForm(true);
  }

  useEffect(() => {
    if (showRepaymentForm && repaymentLoan && repaymentMode === 'auto') {
      calculateMutation.mutate(repaymentLoan.id);
    }
  }, [showRepaymentForm, repaymentLoan?.id, repaymentMode]);

  function handleSubmitLoan() {
    if (!loanName || !bankName || !loanAmountDisplay || !loanStartDate || !loanEndDate) {
      toast({ title: '필수 항목을 입력해주세요', variant: 'destructive' });
      return;
    }
    const body: any = {
      loanName,
      bankName,
      loanType,
      loanAmount: loanAmount,
      annualRate: rate,
      loanStartDate,
      loanEndDate,
      loanTermMonths,
      repaymentType,
      repaymentDay: parseInt(repaymentDay),
      monthlyPayment: estimatedMonthly,
      memo: loanMemo || null,
    };
    if (editingLoan) {
      updateLoanMutation.mutate({ id: editingLoan.id, ...body });
    } else {
      createLoanMutation.mutate(body);
    }
  }

  function handleSubmitRepayment() {
    if (!repaymentLoan) return;
    let body: any;
    if (repaymentMode === 'auto' && calcResult) {
      body = {
        repaymentDate,
        totalAmount: calcResult.totalAmount,
        principalAmount: calcResult.principalAmount,
        interestAmount: calcResult.interestAmount,
        remainingAfter: calcResult.remainingAfter,
        isExtraPayment: repIsExtra,
        memo: repMemo || null,
      };
    } else {
      if (!repTotal) {
        toast({ title: '상환액을 입력해주세요', variant: 'destructive' });
        return;
      }
      body = {
        repaymentDate,
        totalAmount: repTotal,
        principalAmount: repPrincipal,
        interestAmount: repInterest,
        remainingAfter: repRemainingAfter,
        isExtraPayment: repIsExtra,
        memo: repMemo || null,
      };
    }
    createRepaymentMutation.mutate({ loanId: repaymentLoan.id, ...body });
  }

  const summaryCards = [
    { label: '활성 대출', value: summaryData?.activeCount ?? 0, icon: Building2, suffix: '건' },
    { label: '총 잔액', value: summaryData?.totalRemainingBalance ?? 0, icon: DollarSign, suffix: '원', comma: true },
    { label: '이번달 상환액', value: summaryData?.monthlyRepayment ?? 0, icon: TrendingDown, suffix: '원', comma: true },
    { label: '이번달 이자', value: summaryData?.monthlyInterest ?? 0, icon: CalendarDays, suffix: '원', comma: true },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0" data-testid="dialog-loan-management">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2" data-testid="title-loan-management">
            <Building2 className="h-5 w-5" />
            대출 관리
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[80vh] p-6 pt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summaryCards.map((c) => (
              <Card key={c.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <c.icon className="h-4 w-4" />
                    {c.label}
                  </div>
                  <div className="text-lg font-semibold" data-testid={`text-loan-summary-${c.label}`}>
                    {c.comma ? c.value.toLocaleString() : c.value}{c.suffix}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {loansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : loans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">등록된 대출이 없습니다</div>
          ) : (
            <Table data-testid="table-loans">
              <TableHeader>
                <TableRow>
                  <TableHead>대출명</TableHead>
                  <TableHead>금융기관</TableHead>
                  <TableHead className="text-right">대출금액</TableHead>
                  <TableHead className="text-right">이율</TableHead>
                  <TableHead className="text-right">잔액</TableHead>
                  <TableHead>상환방식</TableHead>
                  <TableHead className="text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => {
                  const isExpanded = expandedLoanId === loan.id;
                  const repaidPercent = loan.loanAmount > 0 ? Math.min(100, Math.round((loan.totalRepaid / loan.loanAmount) * 100)) : 0;
                  return (
                    <>{/* Fragment key on the first element */}
                      <TableRow key={`loan-${loan.id}`} data-testid={`row-loan-${loan.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {statusBadge(loan.status)}
                            <span className="font-medium">{loan.loanName}</span>
                          </div>
                        </TableCell>
                        <TableCell>{loan.bankName}</TableCell>
                        <TableCell className="text-right">{loan.loanAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{loan.annualRate}%</TableCell>
                        <TableCell className="text-right font-medium">{loan.remainingBalance.toLocaleString()}</TableCell>
                        <TableCell>{REPAYMENT_TYPE_LABELS[loan.repaymentType] || loan.repaymentType}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                              data-testid={`button-expand-loan-${loan.id}`}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditLoan(loan)}
                              data-testid={`button-edit-loan-${loan.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteLoanMutation.mutate(loan.id)}
                              data-testid={`button-delete-loan-${loan.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow key={`progress-${loan.id}`}>
                        <TableCell colSpan={7} className="py-1 px-4">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${repaidPercent}%` }}
                              />
                            </div>
                            <span>{repaidPercent}% 상환</span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`expanded-${loan.id}`}>
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="font-medium text-sm">상환 내역 ({loan.repaymentCount}건)</span>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" onClick={() => openRepaymentForm(loan, false)} data-testid={`button-add-repayment-${loan.id}`}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    상환 등록
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openRepaymentForm(loan, true)} data-testid={`button-extra-repayment-${loan.id}`}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    추가 상환(중도상환)
                                  </Button>
                                </div>
                              </div>
                              {repaymentsLoading ? (
                                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                              ) : repayments.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground text-sm">상환 내역이 없습니다</div>
                              ) : (
                                <Table data-testid={`table-repayments-${loan.id}`}>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>상환일</TableHead>
                                      <TableHead className="text-right">총 상환액</TableHead>
                                      <TableHead className="text-right">원금</TableHead>
                                      <TableHead className="text-right">이자</TableHead>
                                      <TableHead className="text-right">상환후잔액</TableHead>
                                      <TableHead className="text-right">액션</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {repayments.map((rep) => (
                                      <TableRow key={rep.id} data-testid={`row-repayment-${rep.id}`}>
                                        <TableCell>{rep.repaymentDate}</TableCell>
                                        <TableCell className="text-right">{rep.totalAmount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{rep.principalAmount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{rep.interestAmount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{rep.remainingAfter.toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setDeleteRepaymentConfirm({ loanId: loan.id, repaymentId: rep.id })}
                                            data-testid={`button-delete-repayment-${rep.id}`}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <div className="flex justify-end">
            <Button onClick={() => { resetLoanForm(); setEditingLoan(null); setShowLoanForm(true); }} data-testid="button-add-loan">
              <Plus className="h-4 w-4 mr-1" />
              대출 등록
            </Button>
          </div>
        </div>
      </DialogContent>

      <Dialog open={showLoanForm} onOpenChange={(v) => { if (!v) closeLoanForm(); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-loan-form">
          <DialogHeader>
            <DialogTitle data-testid="title-loan-form">{editingLoan ? '대출 수정' : '대출 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>대출명</Label>
                <Input value={loanName} onChange={(e) => setLoanName(e.target.value)} data-testid="input-loan-name" />
              </div>
              <div>
                <Label>금융기관</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} data-testid="input-bank-name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>대출종류</Label>
                <Select value={loanType} onValueChange={setLoanType}>
                  <SelectTrigger data-testid="select-loan-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOAN_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>대출금액</Label>
                <Input
                  value={loanAmountDisplay}
                  onChange={(e) => setLoanAmountDisplay(formatComma(e.target.value))}
                  disabled={!!editingLoan && editingLoan.repaymentCount > 0}
                  data-testid="input-loan-amount"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>연이율(%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={annualRate}
                  onChange={(e) => setAnnualRate(e.target.value)}
                  data-testid="input-annual-rate"
                />
              </div>
              <div>
                <Label>상환방식</Label>
                <Select value={repaymentType} onValueChange={setRepaymentType}>
                  <SelectTrigger data-testid="select-repayment-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REPAYMENT_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>대출시작일</Label>
                <Input type="date" value={loanStartDate} onChange={(e) => setLoanStartDate(e.target.value)} data-testid="input-loan-start-date" />
              </div>
              <div>
                <Label>대출종료일</Label>
                <Input type="date" value={loanEndDate} onChange={(e) => setLoanEndDate(e.target.value)} data-testid="input-loan-end-date" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>대출기간</Label>
                <Input value={loanTermMonths > 0 ? `${loanTermMonths}개월` : ''} disabled data-testid="input-loan-term" />
              </div>
              <div>
                <Label>상환일(매월)</Label>
                <Select value={repaymentDay} onValueChange={setRepaymentDay}>
                  <SelectTrigger data-testid="select-repayment-day"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}일</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {repaymentType === 'custom' && (
              <div>
                <Label>월 상환액(직접 입력)</Label>
                <Input
                  value={customMonthlyPayment}
                  onChange={(e) => setCustomMonthlyPayment(formatComma(e.target.value))}
                  data-testid="input-custom-monthly-payment"
                />
              </div>
            )}
            <div>
              <Label>메모</Label>
              <Textarea value={loanMemo} onChange={(e) => setLoanMemo(e.target.value)} data-testid="input-loan-memo" />
            </div>

            {loanAmount > 0 && loanTermMonths > 0 && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <Calculator className="h-4 w-4" />
                    예상 계산
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">월 상환액</span>
                      <div className="font-semibold" data-testid="text-estimated-monthly">{estimatedMonthly.toLocaleString()}원</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">총 이자</span>
                      <div className="font-semibold" data-testid="text-estimated-interest">{estimatedTotalInterest.toLocaleString()}원</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">총 상환액</span>
                      <div className="font-semibold" data-testid="text-estimated-total">{estimatedTotalRepayment.toLocaleString()}원</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeLoanForm} data-testid="button-cancel-loan">취소</Button>
              <Button
                onClick={handleSubmitLoan}
                disabled={createLoanMutation.isPending || updateLoanMutation.isPending}
                data-testid="button-submit-loan"
              >
                {(createLoanMutation.isPending || updateLoanMutation.isPending) && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {editingLoan ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRepaymentForm} onOpenChange={(v) => { if (!v) closeRepaymentForm(); }}>
        <DialogContent className="max-w-md" data-testid="dialog-repayment-form">
          <DialogHeader>
            <DialogTitle data-testid="title-repayment-form">
              {isExtraRepayment ? '추가 상환(중도상환)' : '상환 등록'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[70vh]">
            {repaymentLoan && (
              <Card>
                <CardContent className="p-3 text-sm">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="text-muted-foreground">현재 잔액</span>
                    <span className="font-semibold" data-testid="text-current-balance">{repaymentLoan.remainingBalance.toLocaleString()}원</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant={repaymentMode === 'auto' ? 'default' : 'outline'}
                onClick={() => setRepaymentMode('auto')}
                data-testid="button-mode-auto"
              >
                <Calculator className="h-4 w-4 mr-1" />
                자동 계산
              </Button>
              <Button
                size="sm"
                variant={repaymentMode === 'manual' ? 'default' : 'outline'}
                onClick={() => { setRepaymentMode('manual'); setCalcResult(null); }}
                data-testid="button-mode-manual"
              >
                직접 입력
              </Button>
            </div>

            {repaymentMode === 'auto' ? (
              <div className="space-y-3">
                {calculateMutation.isPending ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : calcResult ? (
                  <Card>
                    <CardContent className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">총 상환액</span><span className="font-semibold" data-testid="text-calc-total">{calcResult.totalAmount.toLocaleString()}원</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">원금</span><span data-testid="text-calc-principal">{calcResult.principalAmount.toLocaleString()}원</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">이자</span><span data-testid="text-calc-interest">{calcResult.interestAmount.toLocaleString()}원</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">상환 후 잔액</span><span data-testid="text-calc-remaining">{calcResult.remainingAfter.toLocaleString()}원</span></div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>총 상환액</Label>
                  <Input
                    value={repTotalDisplay}
                    onChange={(e) => setRepTotalDisplay(formatComma(e.target.value))}
                    data-testid="input-rep-total"
                  />
                </div>
                <div>
                  <Label>원금</Label>
                  <Input
                    value={repPrincipalDisplay}
                    onChange={(e) => setRepPrincipalDisplay(formatComma(e.target.value))}
                    data-testid="input-rep-principal"
                  />
                </div>
                <div>
                  <Label>이자</Label>
                  <Input value={repInterest.toLocaleString()} disabled data-testid="input-rep-interest" />
                </div>
                <div>
                  <Label>상환 후 잔액</Label>
                  <Input value={repRemainingAfter.toLocaleString()} disabled data-testid="input-rep-remaining" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                checked={repIsExtra}
                onCheckedChange={(v) => setRepIsExtra(!!v)}
                id="isExtraPayment"
                data-testid="checkbox-extra-payment"
              />
              <Label htmlFor="isExtraPayment" className="text-sm">추가 상환(중도상환)</Label>
            </div>

            {(repaymentMode === 'auto' ? calcResult?.interestAmount : repInterest) ? (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3" data-testid="text-interest-info">
                이자 {(repaymentMode === 'auto' ? calcResult?.interestAmount || 0 : repInterest).toLocaleString()}원은 비용(금융비용/이자비용)에 자동으로 등록됩니다.
              </div>
            ) : null}

            <div>
              <Label>상환일</Label>
              <Input type="date" value={repaymentDate} onChange={(e) => setRepaymentDate(e.target.value)} data-testid="input-repayment-date" />
            </div>
            <div>
              <Label>메모</Label>
              <Textarea value={repMemo} onChange={(e) => setRepMemo(e.target.value)} data-testid="input-repayment-memo" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeRepaymentForm} data-testid="button-cancel-repayment">취소</Button>
              <Button
                onClick={handleSubmitRepayment}
                disabled={createRepaymentMutation.isPending || (repaymentMode === 'auto' && !calcResult)}
                data-testid="button-submit-repayment"
              >
                {createRepaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                상환 등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteRepaymentConfirm} onOpenChange={(v) => { if (!v) setDeleteRepaymentConfirm(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-delete-repayment-confirm">
          <DialogHeader>
            <DialogTitle>상환 내역 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">이 상환 내역을 삭제하시겠습니까? 연결된 이자 비용도 함께 삭제됩니다.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteRepaymentConfirm(null)} data-testid="button-cancel-delete-repayment">취소</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteRepaymentConfirm) {
                  deleteRepaymentMutation.mutate(deleteRepaymentConfirm);
                }
              }}
              disabled={deleteRepaymentMutation.isPending}
              data-testid="button-confirm-delete-repayment"
            >
              {deleteRepaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              삭제
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
