import { useState } from "react";

const MemberInquiryDesign = () => {
  const [activeView, setActiveView] = useState("list"); // list, write, detail
  const [selectedCategory, setSelectedCategory] = useState("");
  const [activeFilter, setActiveFilter] = useState("전체");
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [replyText, setReplyText] = useState("");

  const categoryFields = {
    "일반문의": {
      emoji: "💬",
      color: "blue",
      desc: "일반적인 질문 및 요청사항을 남겨주세요.",
      fields: [
        { name: "title", label: "제목", type: "text", required: true, placeholder: "문의 제목을 입력하세요" },
        { name: "content", label: "문의 내용", type: "textarea", required: true, placeholder: "문의 내용을 상세히 작성해주세요" },
      ]
    },
    "상품CS/미수": {
      emoji: "🚨",
      color: "red",
      desc: "상품 불량, 오배송 등 클레임을 접수해주세요. 증빙사진 3장은 필수입니다.",
      fields: [
        { name: "title", label: "제목", type: "text", required: true, placeholder: "예: 사과 3박스 중 1박스 불량" },
        { name: "contact", label: "담당자 / 연락처", type: "text", required: true, placeholder: "홍길동 / 010-1234-5678" },
        { name: "shipDate", label: "상품 발송일", type: "date", required: true },
        { name: "productName", label: "상품명 / 코드", type: "text", required: true, placeholder: "경북 사과 10kg / APL-001" },
        { name: "receiver", label: "수령자", type: "text", required: true, placeholder: "수령자 이름" },
        { name: "trackingNo", label: "운송장 번호", type: "text", required: true, placeholder: "운송장 번호 입력" },
        { name: "content", label: "상세 내용", type: "textarea", required: true, placeholder: "불량/파손 상황을 상세히 설명해주세요" },
        { name: "photos", label: "증빙 사진 (필수 3장)", type: "photos", required: true },
      ]
    },
    "정산/계산서": {
      emoji: "🧾",
      color: "yellow",
      desc: "세금계산서 발행, 예치금 충전 확인, 후불결제 신청 등을 요청하세요.",
      fields: [
        { name: "title", label: "제목", type: "text", required: true, placeholder: "예: 1월 세금계산서 발행 요청" },
        { name: "bizName", label: "사업자명 / ID", type: "text", required: true, placeholder: "사업자명 또는 회원 ID" },
        { name: "amount", label: "요청 금액 / 내용", type: "text", required: true, placeholder: "금액 및 요청 내용" },
        { name: "content", label: "상세 내용", type: "textarea", required: false, placeholder: "추가 설명이 필요하면 작성해주세요" },
        { name: "docs", label: "관련 증빙 서류", type: "file", required: true },
      ]
    },
    "회원정보(등급)": {
      emoji: "👤",
      color: "orange",
      desc: "회원 정보 수정, 등급 상향 요청, 사업자 정보 변경 등을 문의하세요.",
      fields: [
        { name: "title", label: "제목", type: "text", required: true, placeholder: "예: 회원 등급 변경 요청" },
        { name: "memberId", label: "회원 아이디", type: "text", required: true, placeholder: "회원 아이디" },
        { name: "contact", label: "담당자 이름 / 연락처", type: "text", required: true, placeholder: "홍길동 / 010-1234-5678" },
        { name: "requestDate", label: "문의 접수일", type: "date", required: true },
        { name: "content", label: "상세 내용", type: "textarea", required: true, placeholder: "요청 사항을 상세히 작성해주세요" },
      ]
    },
    "행사특가/변경": {
      emoji: "🏷️",
      color: "green",
      desc: "행사 특가 신청, 대량 구매 관련 협의를 진행합니다.",
      fields: [
        { name: "title", label: "제목 / 아이디", type: "text", required: true, placeholder: "예: 2월 감귤 행사 특가 신청" },
        { name: "productName", label: "행사 상품명 / 코드", type: "text", required: true, placeholder: "제주 감귤 5kg / MND-002" },
        { name: "siteName", label: "사이트명 / 행사명", type: "text", required: true, placeholder: "쿠팡 / 설맞이 대전" },
        { name: "quantity", label: "판매 예상 수량", type: "text", required: true, placeholder: "예: 500박스" },
        { name: "eventDate", label: "행사 / 출고 예정일", type: "date", required: true },
        { name: "content", label: "상세 내용", type: "textarea", required: false, placeholder: "추가 요청사항이 있으면 작성해주세요" },
      ]
    },
    "기타": {
      emoji: "📝",
      color: "gray",
      desc: "위 카테고리에 해당하지 않는 기타 문의를 남겨주세요.",
      fields: [
        { name: "title", label: "제목", type: "text", required: true, placeholder: "문의 제목을 입력하세요" },
        { name: "content", label: "문의 내용", type: "textarea", required: true, placeholder: "문의 내용을 상세히 작성해주세요" },
      ]
    },
  };

  const myInquiries = [
    { id: 1, status: "답변완료", category: "상품CS/미수", title: "사과 3박스 중 1박스 불량건", date: "02-14", msgCount: 4, hasNew: true },
    { id: 2, status: "대기", category: "정산/계산서", title: "1월 세금계산서 발행 요청", date: "02-13", msgCount: 1, hasNew: false },
    { id: 3, status: "종결", category: "일반문의", title: "신규 상품 입고 일정 문의", date: "02-10", msgCount: 3, hasNew: false },
    { id: 4, status: "답변완료", category: "행사특가/변경", title: "2월 감귤 행사 적용 확인", date: "02-08", msgCount: 2, hasNew: false },
  ];

  const detailMessages = [
    { sender: "member", name: "나", content: "2월 10일 주문한 사과 3박스 중 1박스가 불량이었습니다. 사진 첨부합니다. 교환 또는 환불 처리 부탁드립니다.", time: "02-14 09:30", images: 3 },
    { sender: "admin", name: "관리자", content: "안녕하세요 프레시마트님, 불편을 드려 죄송합니다. 사진 확인했습니다. 내일 오전 중 교환 상품 발송해드리겠습니다.", time: "02-14 10:15", images: 0 },
    { sender: "member", name: "나", content: "감사합니다. 불량 박스는 어떻게 하면 될까요? 반품 수거 해주시나요?", time: "02-14 10:30", images: 0 },
    { sender: "admin", name: "관리자", content: "네, 내일 교환 상품 배송 시 불량 박스 수거하겠습니다. 번거로우시겠지만 박스 준비 부탁드립니다.", time: "02-14 11:00", images: 0 },
  ];

  const getStatusStyle = (status) => {
    const map = {
      "대기": "bg-red-100 text-red-700",
      "확인중": "bg-orange-100 text-orange-700",
      "답변완료": "bg-blue-100 text-blue-700",
      "추가문의": "bg-red-100 text-red-600",
      "종결": "bg-gray-100 text-gray-500",
    };
    return map[status] || "";
  };

  const getCategoryColor = (color) => {
    const map = {
      blue: { bg: "bg-blue-50", border: "border-blue-200", header: "bg-blue-100 text-blue-800" },
      red: { bg: "bg-red-50", border: "border-red-200", header: "bg-red-100 text-red-800" },
      yellow: { bg: "bg-yellow-50", border: "border-yellow-200", header: "bg-yellow-100 text-yellow-800" },
      orange: { bg: "bg-orange-50", border: "border-orange-200", header: "bg-orange-100 text-orange-800" },
      green: { bg: "bg-green-50", border: "border-green-200", header: "bg-green-100 text-green-800" },
      gray: { bg: "bg-gray-50", border: "border-gray-200", header: "bg-gray-100 text-gray-800" },
    };
    return map[color] || map.gray;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 회원 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="" alt="" className="w-8 h-8 bg-indigo-100 rounded-lg" />
          <span className="font-bold text-indigo-900">탑셀러</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>프레시마트님</span>
          <span className="text-gray-300">|</span>
          <span className="text-xs text-gray-400">Star회원</span>
        </div>
      </div>

      <div className="flex">
        {/* 회원 사이드바 */}
        <div className="w-52 bg-white min-h-screen border-r border-gray-200 pt-4 flex-shrink-0">
          <div className="px-4 mb-4">
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <div className="text-xs text-indigo-500 font-medium">나의 등급</div>
              <div className="text-lg font-bold text-indigo-700">⭐ Star회원</div>
            </div>
          </div>
          {[
            { label: "📊 대시보드", active: false },
            { label: "🛒 주문내역", active: false },
            { label: "📦 상품목록", active: false },
            { label: "💰 정산내역", active: false },
            { label: "💬 문의 게시판", active: true, badge: 1 },
            { label: "👤 내 정보", active: false },
          ].map((item, i) => (
            <div key={i} className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${
              item.active ? "bg-indigo-50 text-indigo-700 font-semibold border-r-3 border-indigo-500" : "text-gray-600 hover:bg-gray-50"
            }`}>
              <span>{item.label}</span>
              {item.badge && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{item.badge}</span>
              )}
            </div>
          ))}
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 p-6">

          {/* ══════════════════════════════════════ */}
          {/* 문의 목록 뷰                           */}
          {/* ══════════════════════════════════════ */}
          {activeView === "list" && (
            <div>
              {/* 페이지 헤더 */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-xl font-bold text-indigo-900">문의 게시판</h1>
                  <p className="text-xs text-gray-500 mt-0.5">궁금한 사항이나 요청사항을 남겨주세요. 담당자가 신속하게 답변드립니다.</p>
                </div>
                <button
                  onClick={() => setActiveView("write")}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                >
                  ✏️ 문의하기
                </button>
              </div>

              {/* 상태 요약 카드 */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: "전체 문의", value: "4", color: "text-gray-700", bg: "bg-white", border: "border-gray-200" },
                  { label: "답변 대기", value: "1", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                  { label: "답변 완료", value: "2", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", badge: 1 },
                  { label: "종결", value: "1", color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" },
                ].map((card, i) => (
                  <div key={i} className={`${card.bg} rounded-xl border ${card.border} p-4 text-center cursor-pointer hover:shadow-md transition-shadow`}>
                    <div className="text-xs text-gray-500 font-medium mb-1">{card.label}</div>
                    <div className="flex items-center justify-center gap-1">
                      <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                      {card.badge && (
                        <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">N</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 필터 */}
              <div className="flex items-center gap-2 mb-4">
                {["전체", "대기", "답변완료", "종결"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeFilter === f ? "bg-indigo-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* 문의 목록 */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {myInquiries.map((item, i) => (
                  <div
                    key={item.id}
                    onClick={() => { setSelectedInquiry(item); setActiveView("detail"); }}
                    className={`px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${
                      i > 0 ? "border-t border-gray-100" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${getStatusStyle(item.status)}`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{item.category}</span>
                      <p className="text-sm text-gray-800 truncate font-medium">{item.title}</p>
                      {item.hasNew && (
                        <span className="flex-shrink-0 bg-red-500 text-white text-xs rounded px-1.5 py-0.5 font-bold">새 답변</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 ml-4 flex-shrink-0">
                      <span>💬 {item.msgCount}</span>
                      <span>{item.date}</span>
                      <span className="text-gray-300">›</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════ */}
          {/* 문의 작성 뷰                           */}
          {/* ══════════════════════════════════════ */}
          {activeView === "write" && (
            <div>
              {/* 헤더 */}
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setActiveView("list")} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
                <div>
                  <h1 className="text-xl font-bold text-indigo-900">문의 작성</h1>
                  <p className="text-xs text-gray-500 mt-0.5">카테고리를 선택하면 필수 입력 항목이 표시됩니다.</p>
                </div>
              </div>

              {/* 카테고리 선택 */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
                <div className="text-sm font-bold text-gray-700 mb-3">📂 카테고리 선택 <span className="text-red-500">*</span></div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(categoryFields).map(([key, val]) => {
                    const colors = getCategoryColor(val.color);
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedCategory(key)}
                        className={`rounded-lg p-3 text-left transition-all border-2 ${
                          selectedCategory === key
                            ? `${colors.bg} ${colors.border} shadow-md ring-2 ring-offset-1 ring-${val.color}-300`
                            : "bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{val.emoji}</span>
                          <span className={`text-sm font-medium ${selectedCategory === key ? "text-gray-900" : "text-gray-700"}`}>{key}</span>
                        </div>
                        <p className="text-xs text-gray-400 leading-snug line-clamp-2">{val.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 카테고리별 동적 폼 */}
              {selectedCategory && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
                  {/* 폼 헤더 */}
                  <div className={`px-5 py-3 border-b flex items-center gap-2 ${getCategoryColor(categoryFields[selectedCategory].color).header}`}>
                    <span>{categoryFields[selectedCategory].emoji}</span>
                    <span className="text-sm font-bold">{selectedCategory} — 필수 입력 항목</span>
                  </div>

                  {/* 폼 필드 */}
                  <div className="p-5 space-y-4">
                    {categoryFields[selectedCategory].fields.map((field, i) => (
                      <div key={i}>
                        {/* 텍스트 입력 */}
                        {field.type === "text" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <input
                              type="text"
                              placeholder={field.placeholder}
                              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white"
                            />
                          </div>
                        )}

                        {/* 날짜 입력 */}
                        {field.type === "date" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <input
                              type="date"
                              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white"
                            />
                          </div>
                        )}

                        {/* 텍스트영역 */}
                        {field.type === "textarea" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <textarea
                              rows={5}
                              placeholder={field.placeholder}
                              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white resize-none"
                            />
                          </div>
                        )}

                        {/* 증빙 사진 업로드 (상품CS 전용) */}
                        {field.type === "photos" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                              <p className="text-xs text-red-700 leading-relaxed">
                                ⚠️ 온라인 특성상 확인 가능한 사진이 없으면 처리가 불가능합니다. 아래 3가지를 반드시 첨부해 주세요.
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              {[
                                { label: "① 발송 박스 전체", desc: "송장 부착 확인 가능하게" },
                                { label: "② 상품 전체 사진", desc: "상품 전체 상태 확인" },
                                { label: "③ 이슈 부분 상세", desc: "불량/파손 부분 클로즈업" },
                              ].map((photo, j) => (
                                <div key={j} className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
                                  <div className="text-3xl text-gray-300 mb-2">📷</div>
                                  <div className="text-xs font-medium text-gray-600 mb-0.5">{photo.label}</div>
                                  <div className="text-xs text-gray-400">{photo.desc}</div>
                                  <div className="mt-2 text-xs text-indigo-500 font-medium">클릭하여 업로드</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 파일 업로드 */}
                        {field.type === "file" && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer">
                              <div className="text-2xl text-gray-300 mb-1">📎</div>
                              <div className="text-sm text-gray-500">클릭하여 파일을 업로드하세요</div>
                              <div className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, Excel (최대 10MB)</div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 긴급 체크 */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <input type="checkbox" id="urgent" className="w-4 h-4 rounded border-gray-300 text-red-500" />
                      <label htmlFor="urgent" className="text-sm text-gray-700">🔴 긴급 문의로 등록 <span className="text-xs text-gray-400">(빠른 처리가 필요한 경우 체크)</span></label>
                    </div>
                  </div>
                </div>
              )}

              {/* 하단 버튼 */}
              {selectedCategory && (
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setActiveView("list"); setSelectedCategory(""); }}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    취소
                  </button>
                  <button className="px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                    문의 등록
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════ */}
          {/* 문의 상세 뷰 (대화형)                   */}
          {/* ══════════════════════════════════════ */}
          {activeView === "detail" && (
            <div>
              {/* 헤더 */}
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => setActiveView("list")} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusStyle("답변완료")}`}>답변완료</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">🚨 상품CS/미수</span>
                  </div>
                  <h1 className="text-lg font-bold text-gray-900">사과 3박스 중 1박스 불량건</h1>
                </div>
                <div className="text-xs text-gray-400">📅 2026-02-14</div>
              </div>

              {/* 접수 정보 요약 (접이식) */}
              <div className="bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden">
                <button className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-medium text-gray-700">📋 접수 정보 보기</span>
                  <span className="text-gray-400 text-xs">▼ 펼치기</span>
                </button>
              </div>

              {/* 대화 영역 */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">💬 대화 내역</span>
                  <span className="text-xs text-gray-400">총 {detailMessages.length}건</span>
                </div>

                <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
                  {detailMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === "member" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-sm rounded-xl px-4 py-3 ${
                        msg.sender === "member"
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-gray-100 text-gray-800 rounded-bl-sm"
                      }`}>
                        <div className={`flex items-center gap-2 mb-1.5 text-xs ${
                          msg.sender === "member" ? "text-indigo-200" : "text-gray-500"
                        }`}>
                          <span className="font-medium">{msg.sender === "member" ? "👤 " : "🛡️ "}{msg.name}</span>
                          <span>{msg.time}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                        {msg.images > 0 && (
                          <div className={`mt-2 pt-2 border-t text-xs ${
                            msg.sender === "member" ? "border-indigo-400/30 text-indigo-200" : "border-gray-200 text-gray-400"
                          }`}>
                            📎 이미지 {msg.images}장 첨부
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 추가 문의 입력 */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="text-sm font-bold text-gray-700 mb-2">✏️ 추가 문의</div>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="추가로 문의할 내용을 작성하세요..."
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white resize-none"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                      📎 파일 첨부
                    </button>
                    <button className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                      추가 문의 등록
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default MemberInquiryDesign;
