import { useState } from "react";

const DashboardDesignV3_2 = () => {
  const [orderPeriod, setOrderPeriod] = useState("오늘");

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="text-base">☰</span>
          <span className="font-bold tracking-wide">탑셀러 관리자</span>
        </div>
        <div className="flex items-center gap-4 text-gray-300 text-xs">
          <span>관리자님</span>
          <span className="text-gray-500">|</span>
          <span className="cursor-pointer hover:text-white">로그아웃</span>
        </div>
      </div>

      <div className="flex">
        {/* 사이드바 */}
        <div className="w-48 bg-gray-900 min-h-screen pt-2 flex-shrink-0">
          {["📊 대시보드", "👥 회원관리", "🛒 주문관리", "📦 상품관리", "🏬 재고관리",
            "📒 회계장부", "🏦 입금관리", "📈 통계관리", "🎟️ 쿠폰관리", "💬 카카오 알림",
            "📄 페이지관리", "⚙️ 설정"].map((item, i) => (
            <div key={i} className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${i === 0 ? "bg-blue-600 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              {item}
            </div>
          ))}
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 overflow-auto">
          {/* 페이지 헤더 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-indigo-900">관리자 대시보드</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <button className="px-3 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50">🔄 데이터 초기화</button>
              <span>📅 2026년 2월 14일 토요일</span>
            </div>
          </div>

          <div className="p-5 space-y-8">

            {/* ════════════════════════════════════════════════════════ */}
            {/* 1행: 주문/배송 현황 — 가로 전체 1열 (크림색)              */}
            {/* ════════════════════════════════════════════════════════ */}
            <div className="bg-amber-50 rounded-xl px-5 pt-5 pb-12 border-2 border-amber-300 shadow-lg">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">1</span>
                  <h2 className="text-gray-900 font-bold text-sm">주문/배송 현황</h2>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-1">기간:</span>
                    {["오늘", "어제", "이번 주", "지난주", "이번 달", "지난달", "직접 선택"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setOrderPeriod(p)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          orderPeriod === p
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white text-gray-600 border border-gray-300 hover:border-amber-400"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">📅 2026-02-14 (오늘)</span>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: "전체주문", value: "0", icon: "📋", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-blue-700", iconColor: "text-blue-500" },
                  { label: "주문대기", value: "0", icon: "🔔", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-red-600", iconColor: "text-red-500" },
                  { label: "주문조정", value: "0", icon: "🔀", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-blue-700", iconColor: "text-blue-500" },
                  { label: "상품준비중", value: "0", icon: "📦", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", iconColor: "text-purple-500" },
                  { label: "배송준비중", value: "0", icon: "🚛", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", iconColor: "text-blue-500", sub: "운송장미등록건 · 직접배송건전용" },
                  { label: "취합/취소", value: "0", icon: "🚫", bg: "bg-red-50", border: "border-red-200", text: "text-red-600", iconColor: "text-red-500" },
                  { label: "배송중", value: "0", icon: "✅", bg: "bg-green-50", border: "border-green-200", text: "text-green-700", iconColor: "text-green-500" },
                ].map((item, i) => (
                  <div key={i} className={`flex-1 ${item.bg} rounded-lg overflow-hidden shadow-sm border ${item.border} p-3.5`}>
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className={`text-xs ${item.iconColor}`}>{item.icon}</span>
                      <span className="text-xs text-gray-600 font-medium">{item.label}</span>
                    </div>
                    <div className={`text-xl font-bold ${item.text}`}>
                      {item.value}<span className="text-sm font-normal ml-0.5">건</span>
                    </div>
                    {item.sub && <div className="text-xs text-gray-400 mt-1 truncate">{item.sub}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* 2행: 회원 현황 + 문의 현황 — 가로 2열                    */}
            {/* ════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 gap-5">

              {/* ── 회원 현황 — 다크 네이비 ── */}
              <div className="bg-slate-600 rounded-xl px-5 py-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">2</span>
                  <h2 className="text-white font-bold text-sm">회원 현황</h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "총회원수", value: "3", unit: "명", color: "text-blue-600", bg: "bg-blue-100", border: "border-blue-300", icon: "👤" },
                    { label: "승인대기", value: "0", unit: "명", color: "text-amber-600", bg: "bg-amber-100", border: "border-amber-300", icon: "⏳" },
                    { label: "준회원", value: "1", unit: "명", color: "text-gray-600", bg: "bg-gray-100", border: "border-gray-300", icon: "☆" },
                    { label: "Star회원", value: "1", unit: "명", color: "text-yellow-600", bg: "bg-yellow-100", border: "border-yellow-300", icon: "⭐" },
                    { label: "Driving회원", value: "1", unit: "명", color: "text-purple-600", bg: "bg-purple-100", border: "border-purple-300", icon: "💫" },
                    { label: "Top회원", value: "0", unit: "명", color: "text-emerald-600", bg: "bg-emerald-100", border: "border-emerald-300", icon: "👑" },
                  ].map((item, i) => (
                    <div key={i} className={`${item.bg} border ${item.border} rounded-lg p-3.5`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-gray-600 font-medium">{item.label}</span>
                        <span className="text-sm">{item.icon}</span>
                      </div>
                      <div className={`text-xl font-bold ${item.color}`}>
                        {item.value}<span className="text-xs font-normal ml-0.5 text-gray-500">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 문의 현황 — 연보라 ── */}
              <div className="bg-violet-50 rounded-xl px-5 py-5 border-2 border-violet-300 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold">3</span>
                  <h2 className="text-gray-900 font-bold text-sm">문의 현황</h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "일반 문의", value: "0", emoji: "💬", border: "border-blue-300", text: "text-blue-600" },
                    { label: "상품 CS/미수", value: "0", emoji: "🚨", border: "border-red-300", text: "text-red-600" },
                    { label: "정산/계산서", value: "0", emoji: "🧾", border: "border-yellow-300", text: "text-yellow-600" },
                    { label: "회원정보(등급)", value: "0", emoji: "👤", border: "border-orange-300", text: "text-orange-600" },
                    { label: "행사특가/변경", value: "0", emoji: "🏷️", border: "border-green-300", text: "text-green-600" },
                    { label: "기타", value: "0", emoji: "📝", border: "border-gray-300", text: "text-gray-600" },
                  ].map((item, i) => (
                    <div key={i} className={`bg-white rounded-lg border-2 ${item.border} p-3.5 text-center hover:shadow-md transition-shadow`}>
                      <div className="text-xl mb-1">{item.emoji}</div>
                      <div className="text-xs text-gray-500 font-medium mb-1 truncate">{item.label}</div>
                      <div className={`text-lg font-bold ${item.text}`}>{item.value}<span className="text-xs ml-0.5">개</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* 3행: 매출 현황 — 가로 전체 1열 (흰색 + 초록 하단보더)     */}
            {/* ════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border-b-4 border-emerald-400 px-5 py-5 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">4</span>
                <h2 className="text-gray-900 font-bold text-sm">매출 현황</h2>
              </div>

              {/* 확정매출 + 예상매출 가로 2열 */}
              <div className="grid grid-cols-2 gap-4">
                {/* 확정매출 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white">확정매출</span>
                    <span className="text-xs text-gray-400">배송후 전월 반영</span>
                    <div className="h-px flex-1 bg-emerald-100"></div>
                  </div>
                  <div className="flex gap-2">
                    {["금일", "전일", "전월", "이번달"].map((label, i) => (
                      <div key={i} className={`flex-1 rounded-lg p-3.5 ${i === 0 ? "bg-emerald-500 text-white" : "bg-emerald-50 border border-emerald-200"}`}>
                        <div className={`text-xs font-medium mb-1 ${i === 0 ? "text-emerald-100" : "text-emerald-600"}`}>
                          {label} {["📈", "⏰", "📅", "📊"][i]}
                        </div>
                        <div className={`text-lg font-bold ${i === 0 ? "text-white" : "text-emerald-800"}`}>
                          0<span className="text-xs font-normal ml-0.5">원</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 예상매출 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-400 text-white">예상매출</span>
                    <span className="text-xs text-gray-400">출고~배송완료중, 정산 전</span>
                    <div className="h-px flex-1 bg-gray-200"></div>
                  </div>
                  <div className="flex gap-2">
                    {["금일", "전일", "전월", "이번달"].map((label, i) => (
                      <div key={i} className="flex-1 rounded-lg p-3.5 bg-gray-50 border border-gray-200">
                        <div className="text-xs font-medium mb-1 text-gray-500">
                          {label} {["📈", "⏰", "📅", "📊"][i]}
                        </div>
                        <div className="text-lg font-bold text-gray-700">
                          0<span className="text-xs font-normal ml-0.5">원</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════ */}
            {/* 4행: 행사진행 현황 + 공지사항 — 가로 2열                  */}
            {/* ════════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 gap-5">

              {/* ── 행사진행 현황 — 연핑크 ── */}
              <div className="bg-rose-50 rounded-xl px-5 py-5 border border-rose-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold">5</span>
                    <h2 className="text-gray-900 font-bold text-sm">행사진행 현황</h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white">3개 진행중</span>
                </div>
                <div className="bg-white rounded-lg overflow-hidden border border-rose-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-rose-100 text-rose-700 text-xs">
                        <th className="px-3 py-2 text-left font-semibold">업체</th>
                        <th className="px-3 py-2 text-left font-semibold">기간</th>
                        <th className="px-3 py-2 text-left font-semibold">행사품목</th>
                        <th className="px-3 py-2 text-left font-semibold">쿠폰</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { company: "농협", period: "01.15-01.31", item: "제주 감귤", coupon: "10%", status: "ended" },
                        { company: "이마트", period: "01.20-02.05", item: "청송 사과", coupon: "15%", status: "ending" },
                        { company: "롯데마트", period: "02.01-02.14", item: "상주 참외", coupon: "20%", status: "active" },
                      ].map((row, i) => (
                        <tr key={i} className={`border-t ${
                          row.status === "active" ? "bg-green-50" :
                          row.status === "ending" ? "bg-amber-50" :
                          "bg-gray-50 text-gray-400"
                        }`}>
                          <td className="px-3 py-2 font-semibold">{row.company}</td>
                          <td className="px-3 py-2 text-xs">{row.period}</td>
                          <td className="px-3 py-2">{row.item}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                              row.status === "active" ? "bg-green-500 text-white" :
                              row.status === "ending" ? "bg-amber-400 text-white" :
                              "bg-gray-300 text-white"
                            }`}>
                              {row.coupon}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── 공지사항 (신규) — 연파랑 ── */}
              <div className="bg-sky-50 rounded-xl px-5 py-5 border border-sky-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500 text-white text-xs font-bold">6</span>
                    <h2 className="text-gray-900 font-bold text-sm">공지사항</h2>
                  </div>
                  <button className="px-2.5 py-1 rounded-md text-xs font-medium bg-sky-500 text-white hover:bg-sky-600 transition-colors">
                    + 새 공지
                  </button>
                </div>
                <div className="bg-white rounded-lg overflow-hidden border border-sky-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-sky-100 text-sky-700 text-xs">
                        <th className="px-3 py-2 text-left font-semibold w-16">구분</th>
                        <th className="px-3 py-2 text-left font-semibold">제목</th>
                        <th className="px-3 py-2 text-left font-semibold w-24">등록일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { type: "긴급", title: "2월 설 연휴 배송 일정 안내", date: "02-10", typeColor: "bg-red-500" },
                        { type: "안내", title: "신규 회원 가입 이벤트 진행", date: "02-05", typeColor: "bg-blue-500" },
                        { type: "안내", title: "2월 행사 상품 업데이트 안내", date: "02-01", typeColor: "bg-blue-500" },
                        { type: "점검", title: "시스템 정기 점검 안내 (2/15)", date: "01-28", typeColor: "bg-amber-500" },
                        { type: "안내", title: "1월 정산 완료 안내", date: "01-15", typeColor: "bg-blue-500" },
                      ].map((item, i) => (
                        <tr key={i} className="border-t hover:bg-sky-50 transition-colors cursor-pointer">
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold text-white ${item.typeColor}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 font-medium">{item.title}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-400">{item.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardDesignV3_2;
