import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface OrderStats {
  total: number;
  pending: number;
  adjustment: number;
  preparing: number;
  readyToShip: number;
  memberCancelled: number;
  shipping: number;
  isAdmin: boolean;
}

export default function OrderStatsBanner() {
  const { data: stats, isLoading } = useQuery<OrderStats>({
    queryKey: ["/api/order-stats"],
  });

  const totalOrders = stats?.total || 0;
  const pendingOrders = stats?.pending || 0;
  const adjustmentOrders = stats?.adjustment || 0;
  const preparingOrders = stats?.preparing || 0;
  const readyToShipOrders = stats?.readyToShip || 0;
  const memberCancelledOrders = stats?.memberCancelled || 0;
  const shippingOrders = stats?.shipping || 0;

  return (
    <div className="bg-[#0a1a4a] rounded-lg p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">전체주문</div>
          <div className="text-white font-bold" data-testid="text-total-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${totalOrders}건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">주문대기</div>
          <div className="text-white font-bold" data-testid="text-pending-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${pendingOrders}건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">주문조정</div>
          <div className="text-white font-bold" data-testid="text-adjustment-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${adjustmentOrders}건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">상품준비중</div>
          <div className="text-white font-bold" data-testid="text-preparing-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${preparingOrders}건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">배송준비중</div>
          <div className="text-white font-bold" data-testid="text-ready-to-ship-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${readyToShipOrders}건`}
          </div>
          <div className="text-slate-400 text-[10px] mt-1 leading-tight">
            운송장파일다운 · 회원취소건등록
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">회원취소</div>
          <div className="text-white font-bold" data-testid="text-member-cancelled-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${memberCancelledOrders}건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">배송중</div>
          <div className="text-white font-bold" data-testid="text-shipping-orders">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${shippingOrders}건`}
          </div>
        </div>
      </div>
    </div>
  );
}
