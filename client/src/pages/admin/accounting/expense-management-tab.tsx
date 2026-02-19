import { useState, useRef, useEffect, useMemo } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Search, Plus, Trash2, Pencil, ChevronLeft, ChevronRight,
  Download, Upload, List, Grid3X3, CalendarClock, BookOpen, Save,
  TrendingUp, TrendingDown, X,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const EXPENSE_CATEGORIES = [
  '물류/배송비', '인건비', '시설/임대료', '마케팅/광고',
  'IT/시스템', '사무/관리', '금융비용', '기타',
];

const CATEGORY_COLORS: Record<string, string> = {
  '물류/배송비': '#3B82F6',
  '인건비': '#EF4444',
  '시설/임대료': '#F59E0B',
  '마케팅/광고': '#8B5CF6',
  'IT/시스템': '#10B981',
  '사무/관리': '#6366F1',
  '금융비용': '#EC4899',
  '기타': '#6B7280',
};

const PAYMENT_METHODS = ['카드', '계좌이체', '현금', '기타'];
const TAX_TYPES = [
  { value: 'taxable', label: '과세' },
  { value: 'exempt', label: '면세' },
];
const taxTypeLabel = (v: string) => v === 'taxable' ? '과세' : v === 'exempt' ? '면세' : v;
const taxTypeValue = (label: string) => label === '과세' ? 'taxable' : label === '면세' ? 'exempt' : label;

interface Expense {
  id: number;
  expenseDate: string;
  category: string;
  subCategory: string;
  itemName: string;
  amount: number;
  supplyAmount: number;
  vatAmount: number;
  taxType: string;
  paymentMethod: string;
  vendorName: string;
  memo: string;
}

interface ExpenseSummary {
  totalExpense: number;
  byCategory: { category: string; total: number }[];
  previousMonthTotal: number;
  changePercent: number;
}

interface TrendMonth {
  month: string;
  total: number;
  categories: { category: string; total: number }[];
}

interface RecurringExpense {
  id: number;
  itemName: string;
  category: string;
  subCategory: string | null;
  amount: number;
  dayOfMonth: number;
  cycle: string;
  cycleMonth: number | null;
  taxType: string;
  paymentMethod: string;
  vendorName: string | null;
  memo: string | null;
  isActive: boolean;
}

interface Keyword {
  id: number;
  keyword: string;
  category: string;
  subCategory: string;
  matchType: string;
  priority: number;
  source: string;
  useCount: number;
}

interface SpreadsheetRow {
  expenseDate: string;
  itemName: string;
  amount: string;
  category: string;
  taxType: string;
  paymentMethod: string;
  vendorName: string;
  memo: string;
}

function emptySpreadsheetRow(): SpreadsheetRow {
  return {
    expenseDate: new Date().toISOString().slice(0, 10),
    itemName: '',
    amount: '',
    category: '기타',
    taxType: 'taxable',
    paymentMethod: '카드',
    vendorName: '',
    memo: '',
  };
}

export default function ExpenseManagementTab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [viewMode, setViewMode] = useState<'list' | 'spreadsheet'>('list');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showKeywordDialog, setShowKeywordDialog] = useState(false);
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formItemName, setFormItemName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('기타');
  const [formSubCategory, setFormSubCategory] = useState('');
  const [formTaxType, setFormTaxType] = useState('taxable');
  const [formPaymentMethod, setFormPaymentMethod] = useState('카드');
  const [formVendorName, setFormVendorName] = useState('');
  const [formMemo, setFormMemo] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(-1);
  const [similarKeywords, setSimilarKeywords] = useState<any[]>([]);

  const [spreadsheetRows, setSpreadsheetRows] = useState<SpreadsheetRow[]>([emptySpreadsheetRow()]);

  const [recurringForm, setRecurringForm] = useState({
    itemName: '', category: '기타', amount: '', dayOfMonth: '1', cycle: 'monthly',
  });

  const [keywordForm, setKeywordForm] = useState({
    keyword: '', category: '기타', subCategory: '', matchType: 'exact',
  });

  const monthYear = selectedMonth.split('-');
  const monthLabel = `${monthYear[0]}년 ${parseInt(monthYear[1])}월`;

  const navigateMonth = (dir: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const { data: expensesData, isLoading: expensesLoading } = useQuery<{
    expenses: Expense[];
    monthTotal: number;
    categoryTotals: { category: string; total: number }[];
  }>({
    queryKey: ['/api/admin/accounting/expenses', selectedMonth, categoryFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({ month: selectedMonth });
      if (categoryFilter) params.set('category', categoryFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/admin/accounting/expenses?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('조회 실패');
      return res.json();
    },
  });

  const { data: summary } = useQuery<ExpenseSummary>({
    queryKey: ['/api/admin/accounting/expenses/summary', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/expenses/summary?month=${selectedMonth}`, { credentials: 'include' });
      if (!res.ok) throw new Error('요약 조회 실패');
      return res.json();
    },
  });

  const { data: trendData } = useQuery<{ months: TrendMonth[] }>({
    queryKey: ['/api/admin/accounting/expenses/trend'],
    queryFn: async () => {
      const res = await fetch('/api/admin/accounting/expenses/trend?months=6', { credentials: 'include' });
      if (!res.ok) throw new Error('추세 조회 실패');
      return res.json();
    },
  });

  const { data: recurringData } = useQuery<RecurringExpense[]>({
    queryKey: ['/api/admin/accounting/expenses/recurring'],
    enabled: showRecurringDialog,
  });

  const { data: keywordsData } = useQuery<Keyword[]>({
    queryKey: ['/api/admin/accounting/expenses/keywords'],
    enabled: showKeywordDialog,
  });

  const { data: autocompleteData } = useQuery<{ item_name: string; category: string; sub_category?: string; last_amount: number; source?: string }[]>({
    queryKey: ['/api/admin/accounting/expenses/autocomplete', formItemName],
    queryFn: async () => {
      const res = await fetch(`/api/admin/accounting/expenses/autocomplete?q=${encodeURIComponent(formItemName)}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: formItemName.length >= 1 && showAutocomplete,
  });

  const expenses = expensesData?.expenses || [];
  const recurringExpenses = recurringData || [];
  const keywords = keywordsData || [];
  const autocompleteItems = autocompleteData || [];

  const createMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest('POST', '/api/admin/accounting/expenses', body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '등록 완료', description: '비용이 등록되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/trend'] });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: '등록 실패', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const res = await apiRequest('PUT', `/api/admin/accounting/expenses/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '수정 완료', description: '비용이 수정되었습니다.' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/trend'] });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: '수정 실패', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/accounting/expenses/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '삭제 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/trend'] });
    },
    onError: (error: any) => {
      toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const res = await apiRequest('POST', '/api/admin/accounting/expenses/bulk', { items: rows });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: '일괄 저장 완료', description: `${data.count || ''}건이 저장되었습니다.` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/trend'] });
      setSpreadsheetRows([emptySpreadsheetRow()]);
    },
    onError: (error: any) => {
      toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    },
  });

  const recurringCreateMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest('POST', '/api/admin/accounting/expenses/recurring', body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '정기비용 등록 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/recurring'] });
      setRecurringForm({ itemName: '', category: '기타', amount: '', dayOfMonth: '1', cycle: 'monthly' });
    },
    onError: (error: any) => {
      toast({ title: '등록 실패', description: error.message, variant: 'destructive' });
    },
  });

  const recurringToggleMutation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const res = await apiRequest('PATCH', `/api/admin/accounting/expenses/recurring/${id}/toggle`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/recurring'] });
    },
  });

  const recurringDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/accounting/expenses/recurring/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '삭제 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/recurring'] });
    },
  });

  const generateRecurringMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/accounting/expenses/recurring/generate', { month: selectedMonth });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: '자동 생성 완료', description: `생성 ${data.generated || 0}건, 건너뜀 ${data.skipped || 0}건` });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/summary'] });
    },
    onError: (error: any) => {
      toast({ title: '생성 실패', description: error.message, variant: 'destructive' });
    },
  });

  const keywordCreateMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest('POST', '/api/admin/accounting/expenses/keywords', body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '키워드 등록 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/keywords'] });
      setKeywordForm({ keyword: '', category: '기타', subCategory: '', matchType: 'exact' });
    },
    onError: (error: any) => {
      toast({ title: '등록 실패', description: error.message, variant: 'destructive' });
    },
  });

  const keywordDeleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('DELETE', `/api/admin/accounting/expenses/keywords/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '삭제 완료' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/keywords'] });
    },
  });

  const resetForm = () => {
    setShowAddDialog(false);
    setEditingExpense(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormItemName('');
    setFormAmount('');
    setFormCategory('기타');
    setFormSubCategory('');
    setFormTaxType('taxable');
    setFormPaymentMethod('카드');
    setFormVendorName('');
    setFormMemo('');
    setShowAutocomplete(false);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setFormDate(expense.expenseDate);
    setFormItemName(expense.itemName);
    setFormAmount(String(expense.amount));
    setFormCategory(expense.category);
    setFormSubCategory(expense.subCategory || '');
    setFormTaxType(expense.taxType);
    setFormPaymentMethod(expense.paymentMethod);
    setFormVendorName(expense.vendorName || '');
    setFormMemo(expense.memo || '');
    setShowAddDialog(true);
  };

  const handleFormSubmit = async () => {
    if (!formItemName.trim()) {
      toast({ title: '항목명을 입력해주세요', variant: 'destructive' });
      return;
    }
    const amount = parseInt(formAmount);
    if (!amount || amount <= 0) {
      toast({ title: '올바른 금액을 입력해주세요', variant: 'destructive' });
      return;
    }

    const body = {
      expenseDate: formDate,
      itemName: formItemName.trim(),
      amount,
      category: formCategory,
      subCategory: formSubCategory.trim(),
      taxType: formTaxType,
      paymentMethod: formPaymentMethod,
      vendorName: formVendorName.trim(),
      memo: formMemo.trim(),
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, ...body });
    } else {
      createMutation.mutate(body);
    }
  };

  const handleContinueSubmit = async () => {
    if (!formItemName.trim()) {
      toast({ title: '항목명을 입력해주세요', variant: 'destructive' });
      return;
    }
    const amount = parseInt(formAmount);
    if (!amount || amount <= 0) {
      toast({ title: '올바른 금액을 입력해주세요', variant: 'destructive' });
      return;
    }
    const body = {
      expenseDate: formDate,
      itemName: formItemName.trim(),
      amount,
      category: formCategory,
      subCategory: formSubCategory.trim(),
      taxType: formTaxType,
      paymentMethod: formPaymentMethod,
      vendorName: formVendorName.trim(),
      memo: formMemo.trim(),
    };
    try {
      const res = await apiRequest('POST', '/api/admin/accounting/expenses', body);
      await res.json();
      toast({ title: '등록 완료', description: '비용이 등록되었습니다. 계속 입력하세요.' });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/trend'] });
      setFormItemName('');
      setFormAmount('');
      setFormSubCategory('');
      setFormVendorName('');
      setFormMemo('');
      setShowAutocomplete(false);
    } catch (error: any) {
      toast({ title: '등록 실패', description: error.message, variant: 'destructive' });
    }
  };

  const handleAutoClassify = async () => {
    if (!formItemName.trim()) return;
    try {
      const res = await apiRequest('POST', '/api/admin/accounting/expenses/classify', { item_name: formItemName });
      const data = await res.json();
      if (data.confidence === 'high' || data.confidence === 'medium') {
        if (data.category) setFormCategory(data.category);
        if (data.sub_category) setFormSubCategory(data.sub_category);
        toast({ title: '자동 분류 완료', description: `${data.category} / ${data.sub_category || ''}` });
      } else {
        toast({ title: '자동 분류 실패', description: '매칭되는 분류를 찾지 못했습니다.' });
      }
    } catch {
      toast({ title: '분류 요청 실패', variant: 'destructive' });
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/admin/accounting/expenses/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: '업로드 완료', description: `${data.count || ''}건이 등록되었습니다.` });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/summary'] });
        queryClient.invalidateQueries({ queryKey: ['/api/admin/accounting/expenses/trend'] });
      } else {
        toast({ title: '업로드 실패', description: data.message || '오류가 발생했습니다.', variant: 'destructive' });
      }
    } catch {
      toast({ title: '업로드 실패', variant: 'destructive' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExcelDownload = () => {
    window.open(`/api/admin/accounting/expenses/download?month=${selectedMonth}`, '_blank');
  };

  const handleTemplateDownload = () => {
    window.open('/api/admin/accounting/expenses/template', '_blank');
  };

  const handleBulkSave = () => {
    const validRows = spreadsheetRows.filter(r => r.itemName.trim() && r.amount);
    if (validRows.length === 0) {
      toast({ title: '저장할 데이터가 없습니다', variant: 'destructive' });
      return;
    }
    bulkMutation.mutate(validRows.map(r => ({
      expenseDate: r.expenseDate,
      itemName: r.itemName.trim(),
      amount: parseInt(r.amount) || 0,
      category: r.category,
      taxType: r.taxType,
      paymentMethod: r.paymentMethod,
      vendorName: r.vendorName.trim(),
      memo: r.memo.trim(),
    })));
  };

  const updateSpreadsheetRow = (idx: number, field: keyof SpreadsheetRow, value: string) => {
    setSpreadsheetRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const computedSupply = useMemo(() => {
    const amt = parseInt(formAmount) || 0;
    if (formTaxType === 'taxable') {
      const supply = Math.round(amt / 1.1);
      return { supplyAmount: supply, vatAmount: amt - supply };
    }
    return { supplyAmount: amt, vatAmount: 0 };
  }, [formAmount, formTaxType]);

  const activeRecurringCount = recurringExpenses.filter(r => r.isActive).length;

  useEffect(() => {
    setAutocompleteIndex(-1);
  }, [formItemName]);

  useEffect(() => {
    if (!showAutocomplete) setAutocompleteIndex(-1);
  }, [showAutocomplete]);

  useEffect(() => {
    if (!keywordForm.keyword || keywordForm.keyword.length < 2 || !showKeywordDialog) {
      setSimilarKeywords([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/accounting/expenses/keywords/similar?q=${encodeURIComponent(keywordForm.keyword)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSimilarKeywords(data.similar || []);
        }
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [keywordForm.keyword, showKeywordDialog]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pieData = useMemo(() => {
    return (summary?.byCategory || []).map(c => ({
      name: c.category,
      value: c.total,
    }));
  }, [summary]);

  const lineData = useMemo(() => {
    return (trendData?.months || []).map(m => ({
      month: m.month,
      total: m.total,
    }));
  }, [trendData]);

  return (
    <div className="space-y-5" data-testid="expense-management-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => navigateMonth(-1)} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[120px] text-center" data-testid="text-selected-month">
            {monthLabel}
          </span>
          <Button size="icon" variant="outline" onClick={() => navigateMonth(1)} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-expense">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">총 비용</div>
            <div className="text-2xl font-bold mt-1" data-testid="text-total-expense">
              {(summary?.totalExpense || 0).toLocaleString()}원
            </div>
            {summary && summary.changePercent !== undefined && (
              <div className={`flex items-center gap-1 text-sm mt-1 ${summary.changePercent > 0 ? 'text-red-500' : 'text-green-500'}`} data-testid="text-change-percent">
                {summary.changePercent > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(summary.changePercent).toFixed(1)}% vs 전월
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-top-categories">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">Top 3 카테고리</div>
            <div className="mt-2 space-y-1">
              {(summary?.byCategory || []).slice(0, 3).map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-sm" data-testid={`text-top-category-${i}`}>
                  <span className="truncate">{c.category}</span>
                  <span className="font-medium ml-2 whitespace-nowrap">{c.total.toLocaleString()}원</span>
                </div>
              ))}
              {(!summary?.byCategory || summary.byCategory.length === 0) && (
                <div className="text-sm text-muted-foreground">데이터 없음</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-expense-count">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">등록 건수</div>
            <div className="text-2xl font-bold mt-1" data-testid="text-expense-count">
              {expenses.length}건
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-recurring-count">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm text-muted-foreground">정기비용</div>
            <div className="text-2xl font-bold mt-1" data-testid="text-recurring-count">
              {activeRecurringCount}건
            </div>
            <div className="text-xs text-muted-foreground mt-1">활성 정기비용</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {EXPENSE_CATEGORIES.map(cat => {
          const catTotal = (summary?.byCategory || []).find(c => c.category === cat)?.total || 0;
          const isSelected = categoryFilter === cat;
          return (
            <Card
              key={cat}
              className={`cursor-pointer hover-elevate ${isSelected ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setCategoryFilter(isSelected ? '' : cat)}
              data-testid={`card-category-${cat}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-1 mb-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
                  <span className="text-xs truncate">{cat}</span>
                </div>
                <div className="text-sm font-bold">{catTotal.toLocaleString()}원</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {categoryFilter && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            {categoryFilter}
            <X className="h-3 w-3 cursor-pointer" onClick={() => setCategoryFilter('')} />
          </Badge>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-1"
            data-testid="button-view-list"
          >
            <List className="h-4 w-4" />목록
          </Button>
          <Button
            variant={viewMode === 'spreadsheet' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('spreadsheet')}
            className="gap-1"
            data-testid="button-view-spreadsheet"
          >
            <Grid3X3 className="h-4 w-4" />스프레드시트
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true); }} className="gap-1" data-testid="button-add-expense">
            <Plus className="h-4 w-4" />간편등록
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1" data-testid="button-excel-upload">
            <Upload className="h-4 w-4" />엑셀 업로드
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleExcelUpload}
            data-testid="input-excel-upload"
          />
          <Button size="sm" variant="outline" onClick={handleExcelDownload} className="gap-1" data-testid="button-excel-download">
            <Download className="h-4 w-4" />엑셀 다운로드
          </Button>
          <Button size="sm" variant="outline" onClick={handleTemplateDownload} className="gap-1" data-testid="button-template-download">
            <Download className="h-4 w-4" />템플릿 다운로드
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowRecurringDialog(true)} className="gap-1" data-testid="button-recurring-manage">
            <CalendarClock className="h-4 w-4" />정기비용 관리
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowKeywordDialog(true)} className="gap-1" data-testid="button-keyword-dict">
            <BookOpen className="h-4 w-4" />키워드 사전
          </Button>
        </div>
      </div>

      {viewMode === 'list' && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Select value={categoryFilter || '__all__'} onValueChange={(v) => setCategoryFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[160px]" data-testid="select-category-filter">
                  <SelectValue placeholder="전체 분류" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">전체 분류</SelectItem>
                  {EXPENSE_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="항목명 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                  data-testid="input-search-expense"
                />
              </div>
            </div>

            {expensesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-expenses">
                등록된 비용이 없습니다
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <Table className="min-w-[1200px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>날짜</TableHead>
                      <TableHead>분류</TableHead>
                      <TableHead>세부항목</TableHead>
                      <TableHead>항목명</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="text-right">공급가</TableHead>
                      <TableHead className="text-right">부가세</TableHead>
                      <TableHead>과세구분</TableHead>
                      <TableHead>결제방법</TableHead>
                      <TableHead>거래처</TableHead>
                      <TableHead>메모</TableHead>
                      <TableHead className="text-center">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((exp) => (
                      <TableRow key={exp.id} data-testid={`row-expense-${exp.id}`}>
                        <TableCell className="whitespace-nowrap">{exp.expenseDate}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="no-default-active-elevate" style={{ borderColor: CATEGORY_COLORS[exp.category] || '#6B7280' }}>
                            {exp.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{exp.subCategory}</TableCell>
                        <TableCell className="font-medium">{exp.itemName}</TableCell>
                        <TableCell className="text-right font-medium">{exp.amount.toLocaleString()}원</TableCell>
                        <TableCell className="text-right">{exp.supplyAmount.toLocaleString()}원</TableCell>
                        <TableCell className="text-right">{exp.vatAmount.toLocaleString()}원</TableCell>
                        <TableCell>
                          <Badge
                            variant={exp.taxType === 'taxable' ? 'default' : 'secondary'}
                            className="no-default-active-elevate"
                            data-testid={`badge-tax-${exp.id}`}
                          >
                            {taxTypeLabel(exp.taxType)}
                          </Badge>
                        </TableCell>
                        <TableCell>{exp.paymentMethod}</TableCell>
                        <TableCell>{exp.vendorName}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{exp.memo}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(exp)} data-testid={`button-edit-expense-${exp.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(exp.id)} data-testid={`button-delete-expense-${exp.id}`}>
                              <Trash2 className="h-4 w-4" />
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
      )}

      {viewMode === 'spreadsheet' && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="text-sm text-muted-foreground">스프레드시트 모드 - 직접 입력 후 일괄 저장</div>
              <Button size="sm" onClick={handleBulkSave} disabled={bulkMutation.isPending} className="gap-1" data-testid="button-bulk-save">
                {bulkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                일괄 저장
              </Button>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">날짜</TableHead>
                    <TableHead>항목명</TableHead>
                    <TableHead className="w-[110px]">금액</TableHead>
                    <TableHead className="w-[130px]">분류</TableHead>
                    <TableHead className="w-[90px]">과세구분</TableHead>
                    <TableHead className="w-[100px]">결제방법</TableHead>
                    <TableHead>거래처</TableHead>
                    <TableHead>메모</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spreadsheetRows.map((row, idx) => (
                    <TableRow key={idx} data-testid={`row-spreadsheet-${idx}`}>
                      <TableCell>
                        <Input
                          type="date"
                          value={row.expenseDate}
                          onChange={(e) => updateSpreadsheetRow(idx, 'expenseDate', e.target.value)}
                          data-testid={`input-ss-date-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.itemName}
                          onChange={(e) => updateSpreadsheetRow(idx, 'itemName', e.target.value)}
                          placeholder="항목명"
                          data-testid={`input-ss-item-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.amount}
                          onChange={(e) => updateSpreadsheetRow(idx, 'amount', e.target.value)}
                          placeholder="금액"
                          data-testid={`input-ss-amount-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={row.category} onValueChange={(v) => updateSpreadsheetRow(idx, 'category', v)}>
                          <SelectTrigger data-testid={`select-ss-category-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map(c => (
                              <SelectItem key={c} value={c}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.taxType} onValueChange={(v) => updateSpreadsheetRow(idx, 'taxType', v)}>
                          <SelectTrigger data-testid={`select-ss-tax-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAX_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.paymentMethod} onValueChange={(v) => updateSpreadsheetRow(idx, 'paymentMethod', v)}>
                          <SelectTrigger data-testid={`select-ss-payment-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map(p => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.vendorName}
                          onChange={(e) => updateSpreadsheetRow(idx, 'vendorName', e.target.value)}
                          placeholder="거래처"
                          data-testid={`input-ss-vendor-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.memo}
                          onChange={(e) => updateSpreadsheetRow(idx, 'memo', e.target.value)}
                          placeholder="메모"
                          data-testid={`input-ss-memo-${idx}`}
                        />
                      </TableCell>
                      <TableCell>
                        {spreadsheetRows.length > 1 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSpreadsheetRows(prev => prev.filter((_, i) => i !== idx))}
                            data-testid={`button-ss-remove-${idx}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-1"
              onClick={() => setSpreadsheetRows(prev => [...prev, emptySpreadsheetRow()])}
              data-testid="button-ss-add-row"
            >
              <Plus className="h-4 w-4" />행 추가
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="card-donut-chart">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm font-medium mb-3">카테고리별 비용 비율</div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[entry.name] || '#6B7280'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toLocaleString()}원`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground">데이터 없음</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-trend-chart">
          <CardContent className="pt-4 pb-4">
            <div className="text-sm font-medium mb-3">6개월 비용 추세</div>
            {lineData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip formatter={(value: number) => `${value.toLocaleString()}원`} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#3B82F6" name="총 비용" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground">데이터 없음</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-expense">
              {editingExpense ? '비용 수정' : '비용 등록'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>비용일</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                data-testid="input-expense-date"
              />
            </div>
            <div className="relative" ref={autocompleteRef}>
              <Label>항목명</Label>
              <Input
                value={formItemName}
                onChange={(e) => {
                  setFormItemName(e.target.value);
                  if (e.target.value.length >= 1) setShowAutocomplete(true);
                  else setShowAutocomplete(false);
                }}
                onFocus={() => { if (formItemName.length >= 1) setShowAutocomplete(true); }}
                onBlur={() => { setTimeout(() => handleAutoClassify(), 300); }}
                onKeyDown={(e) => {
                  if (!showAutocomplete || autocompleteItems.length === 0) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setAutocompleteIndex(prev => (prev + 1) % autocompleteItems.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setAutocompleteIndex(prev => (prev - 1 + autocompleteItems.length) % autocompleteItems.length);
                  } else if (e.key === 'Enter' && autocompleteIndex >= 0) {
                    e.preventDefault();
                    const item = autocompleteItems[autocompleteIndex];
                    setFormItemName(item.item_name);
                    if (item.category) setFormCategory(item.category);
                    if (item.sub_category) setFormSubCategory(item.sub_category);
                    if (item.last_amount) setFormAmount(String(item.last_amount));
                    setShowAutocomplete(false);
                  } else if (e.key === 'Escape') {
                    setShowAutocomplete(false);
                  }
                }}
                placeholder="항목명을 입력하세요"
                data-testid="input-expense-item-name"
              />
              {showAutocomplete && autocompleteItems.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto" data-testid="dropdown-autocomplete">
                  {autocompleteItems.map((item, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`w-full text-left px-3 py-2 hover-elevate text-sm flex items-center justify-between ${i === autocompleteIndex ? 'bg-accent' : ''}`}
                      onClick={() => {
                        setFormItemName(item.item_name);
                        if (item.category) setFormCategory(item.category);
                        if (item.sub_category) setFormSubCategory(item.sub_category);
                        if (item.last_amount) setFormAmount(String(item.last_amount));
                        setShowAutocomplete(false);
                      }}
                      data-testid={`button-autocomplete-${i}`}
                    >
                      <span>{item.item_name}</span>
                      <span className="text-muted-foreground text-xs">{item.category} / {item.last_amount?.toLocaleString()}원</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>금액</Label>
              <Input
                type="number"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="금액을 입력하세요"
                data-testid="input-expense-amount"
              />
              {formAmount && (
                <div className="text-xs text-muted-foreground mt-1" data-testid="text-tax-preview">
                  공급가: {computedSupply.supplyAmount.toLocaleString()}원 / 부가세: {computedSupply.vatAmount.toLocaleString()}원
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>분류</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger data-testid="select-expense-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>세부항목</Label>
                <Input
                  value={formSubCategory}
                  onChange={(e) => setFormSubCategory(e.target.value)}
                  placeholder="세부항목"
                  data-testid="input-expense-subcategory"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>과세구분</Label>
                <Select value={formTaxType} onValueChange={setFormTaxType}>
                  <SelectTrigger data-testid="select-expense-tax-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>결제방법</Label>
                <Select value={formPaymentMethod} onValueChange={setFormPaymentMethod}>
                  <SelectTrigger data-testid="select-expense-payment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>거래처</Label>
              <Input
                value={formVendorName}
                onChange={(e) => setFormVendorName(e.target.value)}
                placeholder="거래처명"
                data-testid="input-expense-vendor"
              />
            </div>
            <div>
              <Label>메모</Label>
              <Textarea
                value={formMemo}
                onChange={(e) => setFormMemo(e.target.value)}
                placeholder="메모를 입력하세요"
                className="resize-none"
                data-testid="input-expense-memo"
              />
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
              <Button variant="outline" onClick={resetForm} data-testid="button-cancel-expense">
                취소
              </Button>
              {!editingExpense && (
                <Button
                  variant="outline"
                  onClick={handleContinueSubmit}
                  disabled={createMutation.isPending}
                  data-testid="button-continue-expense"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  연속등록
                </Button>
              )}
              <Button
                onClick={handleFormSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-expense"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editingExpense ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-recurring">정기비용 관리</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => generateRecurringMutation.mutate()}
                disabled={generateRecurringMutation.isPending}
                className="gap-1"
                data-testid="button-generate-recurring"
              >
                {generateRecurringMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                이번 달 자동 생성
              </Button>
            </div>

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>항목명</TableHead>
                    <TableHead>분류</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>결제일</TableHead>
                    <TableHead>주기</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-center">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        등록된 정기비용이 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    recurringExpenses.map((r) => (
                      <TableRow key={r.id} data-testid={`row-recurring-${r.id}`}>
                        <TableCell className="font-medium">{r.itemName}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell className="text-right">{r.amount.toLocaleString()}원</TableCell>
                        <TableCell>매월 {r.dayOfMonth}일</TableCell>
                        <TableCell>{r.cycle === 'monthly' ? '월간' : r.cycle === 'yearly' ? '연간' : r.cycle}</TableCell>
                        <TableCell>
                          <Badge
                            variant={r.isActive ? 'default' : 'secondary'}
                            className="cursor-pointer"
                            onClick={() => recurringToggleMutation.mutate({ id: r.id })}
                            data-testid={`badge-recurring-status-${r.id}`}
                          >
                            {r.isActive ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => recurringDeleteMutation.mutate(r.id)}
                              data-testid={`button-delete-recurring-${r.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-sm font-medium mb-3">정기비용 추가</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>항목명</Label>
                    <Input
                      value={recurringForm.itemName}
                      onChange={(e) => setRecurringForm(p => ({ ...p, itemName: e.target.value }))}
                      placeholder="항목명"
                      data-testid="input-recurring-item"
                    />
                  </div>
                  <div>
                    <Label>분류</Label>
                    <Select value={recurringForm.category} onValueChange={(v) => setRecurringForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger data-testid="select-recurring-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>금액</Label>
                    <Input
                      type="number"
                      value={recurringForm.amount}
                      onChange={(e) => setRecurringForm(p => ({ ...p, amount: e.target.value }))}
                      placeholder="금액"
                      data-testid="input-recurring-amount"
                    />
                  </div>
                  <div>
                    <Label>결제일</Label>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={recurringForm.dayOfMonth}
                      onChange={(e) => setRecurringForm(p => ({ ...p, dayOfMonth: e.target.value }))}
                      data-testid="input-recurring-day"
                    />
                  </div>
                  <div>
                    <Label>주기</Label>
                    <Select value={recurringForm.cycle} onValueChange={(v) => setRecurringForm(p => ({ ...p, cycle: v }))}>
                      <SelectTrigger data-testid="select-recurring-cycle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">월간</SelectItem>
                        <SelectItem value="yearly">연간</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={() => {
                        if (!recurringForm.itemName.trim() || !recurringForm.amount) {
                          toast({ title: '항목명과 금액을 입력해주세요', variant: 'destructive' });
                          return;
                        }
                        recurringCreateMutation.mutate({
                          itemName: recurringForm.itemName.trim(),
                          category: recurringForm.category,
                          amount: parseInt(recurringForm.amount),
                          dayOfMonth: parseInt(recurringForm.dayOfMonth),
                          cycle: recurringForm.cycle,
                        });
                      }}
                      disabled={recurringCreateMutation.isPending}
                      className="gap-1"
                      data-testid="button-add-recurring"
                    >
                      {recurringCreateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      <Plus className="h-4 w-4" />추가
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showKeywordDialog} onOpenChange={setShowKeywordDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-keywords">키워드 사전</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>키워드</TableHead>
                    <TableHead>분류</TableHead>
                    <TableHead>세부항목</TableHead>
                    <TableHead>매칭</TableHead>
                    <TableHead>우선순위</TableHead>
                    <TableHead>출처</TableHead>
                    <TableHead className="text-right">사용횟수</TableHead>
                    <TableHead className="text-center">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                        등록된 키워드가 없습니다
                      </TableCell>
                    </TableRow>
                  ) : (
                    keywords.map((kw) => (
                      <TableRow key={kw.id} data-testid={`row-keyword-${kw.id}`}>
                        <TableCell className="font-medium">{kw.keyword}</TableCell>
                        <TableCell>{kw.category}</TableCell>
                        <TableCell>{kw.subCategory}</TableCell>
                        <TableCell>{kw.matchType === 'exact' ? '완전일치' : kw.matchType === 'contains' ? '포함' : kw.matchType}</TableCell>
                        <TableCell>{kw.priority}</TableCell>
                        <TableCell>
                          <Badge
                            variant={kw.source === 'system' ? 'default' : kw.source === 'admin' ? 'outline' : 'secondary'}
                            className="no-default-active-elevate"
                            data-testid={`badge-keyword-source-${kw.id}`}
                          >
                            {kw.source === 'system' ? '시스템' : kw.source === 'admin' ? '관리자' : '학습'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{kw.useCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {kw.source !== 'system' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => keywordDeleteMutation.mutate(kw.id)}
                                data-testid={`button-delete-keyword-${kw.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="text-sm font-medium mb-3">키워드 추가</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label>키워드</Label>
                    <Input
                      value={keywordForm.keyword}
                      onChange={(e) => setKeywordForm(p => ({ ...p, keyword: e.target.value }))}
                      placeholder="키워드"
                      data-testid="input-keyword-text"
                    />
                    {similarKeywords.length > 0 && (
                      <div className="mt-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-xs space-y-1" data-testid="similar-keywords-warning">
                        <div className="font-medium text-yellow-700 dark:text-yellow-400">유사 키워드가 존재합니다:</div>
                        {similarKeywords.map((sk: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500">
                            <span>"{sk.keyword}" ({sk.category})</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">{sk.relation === 'exact' ? '동일' : '유사'}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>분류</Label>
                    <Select value={keywordForm.category} onValueChange={(v) => setKeywordForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger data-testid="select-keyword-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>세부항목</Label>
                    <Input
                      value={keywordForm.subCategory}
                      onChange={(e) => setKeywordForm(p => ({ ...p, subCategory: e.target.value }))}
                      placeholder="세부항목"
                      data-testid="input-keyword-subcategory"
                    />
                  </div>
                  <div>
                    <Label>매칭 방식</Label>
                    <Select value={keywordForm.matchType} onValueChange={(v) => setKeywordForm(p => ({ ...p, matchType: v }))}>
                      <SelectTrigger data-testid="select-keyword-match-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact">완전일치</SelectItem>
                        <SelectItem value="contains">포함</SelectItem>
                        <SelectItem value="startsWith">시작일치</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <Button
                    onClick={() => {
                      if (!keywordForm.keyword.trim()) {
                        toast({ title: '키워드를 입력해주세요', variant: 'destructive' });
                        return;
                      }
                      keywordCreateMutation.mutate({
                        keyword: keywordForm.keyword.trim(),
                        category: keywordForm.category,
                        subCategory: keywordForm.subCategory.trim(),
                        matchType: keywordForm.matchType,
                      });
                    }}
                    disabled={keywordCreateMutation.isPending}
                    className="gap-1"
                    data-testid="button-add-keyword"
                  >
                    {keywordCreateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Plus className="h-4 w-4" />추가
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
