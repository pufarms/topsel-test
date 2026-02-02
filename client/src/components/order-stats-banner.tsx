interface OrderStatsBannerProps {
  stats?: {
    totalOrders: number;
    firstDeadline: number;
    secondDeadline: number;
    orderAdjustment: number;
    memberCancelled: number;
    finalShipping: number;
  };
}

export default function OrderStatsBanner({ stats }: OrderStatsBannerProps) {
  const defaultStats = {
    totalOrders: 0,
    firstDeadline: 0,
    secondDeadline: 0,
    orderAdjustment: 0,
    memberCancelled: 0,
    finalShipping: 0,
  };

  const data = stats || defaultStats;

  return (
    <div className="bg-[#0a1a4a] rounded-lg p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">전체 주문건수</div>
          <div className="text-white font-bold">{data.totalOrders} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">1차 주문 마감(9시)</div>
          <div className="text-white font-bold">{data.firstDeadline} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">2차 주문마감(최종)</div>
          <div className="text-white font-bold">{data.secondDeadline} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">주문조정</div>
          <div className="text-white font-bold">{data.orderAdjustment} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">회원취소</div>
          <div className="text-white font-bold">{data.memberCancelled} 건</div>
        </div>
        <div className="border border-slate-600 rounded p-3 text-center">
          <div className="text-slate-300 text-sm mb-1">최종 발송건</div>
          <div className="text-white font-bold">{data.finalShipping} 건</div>
        </div>
      </div>
    </div>
  );
}
