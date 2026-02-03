import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface OrderStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  cancelled: number;
  today: number;
  isAdmin: boolean;
}

export default function OrderStatsBanner() {
  const { data: stats, isLoading } = useQuery<OrderStats>({
    queryKey: ["/api/order-stats"],
  });

  const totalOrders = stats?.total || 0;
  const pendingOrders = stats?.pending || 0;
  const processingOrders = stats?.processing || 0;
  const completedOrders = stats?.completed || 0;
  const cancelledOrders = stats?.cancelled || 0;
  const todayOrders = stats?.today || 0;

  return (
    <div className="bg-[#0a1a4a] rounded-lg p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">전체 주문건수</div>
          <div className="text-white font-bold" data-testid="text-total-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${totalOrders} 건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">대기 (미처리)</div>
          <div className="text-white font-bold" data-testid="text-pending-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${pendingOrders} 건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">처리중</div>
          <div className="text-white font-bold" data-testid="text-processing-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${processingOrders} 건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">완료</div>
          <div className="text-white font-bold" data-testid="text-completed-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${completedOrders} 건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">취소</div>
          <div className="text-white font-bold" data-testid="text-cancelled-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${cancelledOrders} 건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">오늘 등록</div>
          <div className="text-white font-bold" data-testid="text-today-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${todayOrders} 건`}
          </div>
        </div>
      </div>
    </div>
  );
}
