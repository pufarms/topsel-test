import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Building2, Star, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getQueryFn } from "@/lib/queryClient";
import type { Member } from "@shared/schema";

const memberGradeLabels: Record<string, string> = {
  PENDING: "승인대기",
  ASSOCIATE: "준회원",
  START: "Start회원",
  DRIVING: "Driving회원",
  TOP: "Top회원",
};

interface MemberPageBannerProps {
  title: string;
  description?: string;
  memberData?: Member | null;
}

export function MemberPageBanner({ title, description, memberData: externalMemberData }: MemberPageBannerProps) {
  const { user } = useAuth();

  const { data: internalMemberData } = useQuery<Member | null>({
    queryKey: ["/api/member/profile"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user && !externalMemberData,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const { data: purchaseStats } = useQuery<{
    lastMonthTotal: number;
    thisMonthTotal: number;
  }>({
    queryKey: ["/api/member/purchase-stats"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const memberData = externalMemberData ?? internalMemberData;

  const lastMonthTotal = purchaseStats?.lastMonthTotal || 0;
  const thisMonthTotal = purchaseStats?.thisMonthTotal || 0;

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  return (
    <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] text-white py-[35px]">
      <div className="container mx-auto px-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">{title}</h1>
        {description && (
          <p className="text-blue-200 text-sm md:text-base mb-6">
            {description}
          </p>
        )}

        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
          <Building2 className="h-4 w-4 text-amber-400" />
          <span className="text-sm">
            {memberData?.companyName || user?.name || "회원"}님
          </span>
          <Badge className="bg-amber-500 text-white hover:bg-amber-600 ml-2">
            환영합니다!
          </Badge>
          {memberData?.isPostpaid && (
            <span className="text-red-500 font-bold text-sm ml-1">/후불결재 회원</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Star className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-blue-200">회원님 등급</p>
              <p className="font-semibold">{memberGradeLabels[memberData?.grade || "ASSOCIATE"] || "준회원"}</p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <BarChart3 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-blue-200">지난 달 매입 총액</p>
              <p className="font-semibold">{formatPrice(lastMonthTotal)}</p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-blue-200">이번 달 매입 총액</p>
              <p className="font-semibold">{formatPrice(thisMonthTotal)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
