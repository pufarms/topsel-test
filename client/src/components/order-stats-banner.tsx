import { useQuery } from "@tanstack/react-query";
import type { Order } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function OrderStatsBanner() {
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/orders"],
  });

  const totalOrders = orders.length;
  const firstDeadline = 0;
  const secondDeadline = 0;
  const orderAdjustment = 0;
  const memberCancelled = 0;
  const finalShipping = 0;

  return (
    <div className="bg-[#0a1a4a] rounded-lg p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">전체 주문건수</div>
          <div className="text-white font-bold">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `${totalOrders} 건`}
          </div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">1차 주문 마감(9시)</div>
          <div className="text-white font-bold">{firstDeadline} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">2차 주문마감(최종)</div>
          <div className="text-white font-bold">{secondDeadline} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">주문조정</div>
          <div className="text-white font-bold">{orderAdjustment} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">회원취소</div>
          <div className="text-white font-bold">{memberCancelled} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">최종 발송건</div>
          <div className="text-white font-bold">{finalShipping} 건</div>
        </div>
      </div>
    </div>
  );
}
