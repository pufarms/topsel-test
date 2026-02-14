import { useState } from "react";

const AdminBoardDesignV2 = () => {
  const [activeCategory, setActiveCategory] = useState("전체");
  const [activeStatus, setActiveStatus] = useState("전체");
  const [selectedInquiry, setSelectedInquiry] = useState(1);
  const [replyText, setReplyText] = useState("");
  const [detailTab, setDetailTab] = useState("대화");

  const categories = [
    { label: "전체", count: 12, emoji: "📋" },
    { label: "일반문의", count: 3, emoji: "💬" },
    { label: "상품CS/미수", count: 4, emoji: "🚨" },
    { label: "정산/계산서", count: 2, emoji: "🧾" },
    { label: "회원정보(등급)", count: 1, emoji: "👤" },
    { label: "행사특가/변경", count: 1, emoji: "🏷️" },
    { label: "기타", count: 1, emoji: "📝" },
  ];

  const statuses = [
    { label: "전체", count: 12 },
    { label: "대기", count: 4, color: "bg-red-500" },
    { label: "확인중", count: 2, color: "bg-orange-500" },
    { label: "답변완료", count: 3, color: "bg-blue-500" },
    { label: "추가문의", count: 2, color: "bg-red-400" },
    { label: "종결", count: 1, color: "bg-gray-400" },
  ];

  const inquiries = [
    { id: 1, status: "대기", urgent: true, category: "상품CS/미수", title: "사과 3박스 중 1박스 불량건", member: "프레시마트", date: "02-14 09:30", unread: true, msgCount: 3 },
    { id: 2, status: "추가문의", urgent: false, category: "정산/계산서", title: "1월 세금계산서 발행 요청", member: "과일나라", date: "02-13 16:20", unread: true, msgCount: 5 },
    { id: 3, status: "대기", urgent: true, category: "상품CS/미수", title: "배송 상품 파손 클레임", member: "탑셀01", date: "02-13 14:10", unread: true, msgCount: 1 },
    { id: 4, status: "확인중", urgent: false, category: "일반문의", title: "신규 상품 입고 일정 문의", member: "프레시마트", date: "02-13 11:00", unread: false, msgCount: 2 },
    { id: 5, status: "답변완료", urgent: false, category: "행사특가/변경", title: "2월 감귤 행사 적용 확인", member: "과일나라", date: "02-12 15:30", unread: false, msgCount: 4 },
    { id: 6, status: "답변완료", urgent: false, category: "회원정보(등급)", title: "회원 등급 변경 요청", member: "탑셀01", date: "02-12 10:00", unread: false, msgCount: 2 },
    { id: 7, status: "종결", urgent: false, category: "기타", title: "사이트 이용 방법 문의", member: "프레시마트", date: "02-11 09:00", unread: false, msgCount: 3 },
  ];

  const messages = [
    { sender: "member", name: "프레시마트", content: "2월 10일 주문한 사과 3박스 중 1박스가 불량이었습니다. 사진 첨부합니다. 교환 또는 환불 처리 부탁드립니다.", time: "02-14 09:30", images: ["box_photo.jpg", "product_photo.jpg", "damage_photo.jpg"] },
    { sender: "admin", name: "관리자", content: "안녕하세요 프레시마트님, 불편을 드려 죄송합니다. 사진 확인했습니다. 내일 오전 중 교환 상품 발송해드리겠습니다.", time: "02-14 10:15", images: [] },
    { sender: "member", name: "프레시마트", content: "감사합니다. 불량 박스는 어떻게 하면 될까요? 반품 수거 해주시나요?", time: "02-14 10:30", images: [] },
  ];

  /* 상품CS/미수 카테고리의 필수 접수 정보 */
  const csFields = {
    담당자연락처: "김영수 / 010-1234-5678",
    상품발송일: "2026-02-10",
    상품명코드: "경북 사과 10kg / APL-001",
    수령자: "김영수",
    운송장번호: "123456789012",
  };

  const getStatusStyle = (status) => {
    const styles = {
      "대기": "bg-red-100 text-red-700 border-red-200",
      "확인중": "bg-orange-100 text-orange-700 border-orange-200",
      "답변완료": "bg-blue-100 text-blue-700 border-blue-200",
      "추가문의": "bg-red-100 text-red-600 border-red-200",
      "종결": "bg-gray-100 text-gray-500 border-gray-200",
    };
    return styles[status] || "";
  };

  const getStatusDot = (status) => {
    const dots = {
      "대기": "bg-red-500",
      "확인중": "bg-orange-500",
      "답변완료": "bg-blue-500",
      "추가문의": "bg-red-400",
      "종결": "bg-gray-400",
    };
    return dots[status] || "";
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-gray-900 text-white px-6 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="text-base">☰</span>
          <span className="font-bold tracking-wide">탑셀러 관리자</span>
        </div>
        <div className="flex items-center gap-4 text-gray-300 text-xs">
          <div className="relative cursor-pointer">
            <span>🔔</span>
            <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">4</span>
          </div>
          <span>관리자님</span>
          <span className="text-gray-500">|</span>
          <span className="cursor-pointer hover:text-white">로그아웃</span>
        </div>
      </div>

      <div className="flex">
        {/* 사이드바 */}
        <div className="w-48 bg-gray-900 min-h-screen pt-2 flex-shrink-0">
          {[
            { label: "📊 대시보드", active: false },
            { label: "👥 회원관리", active: false },
            { label: "🛒 주문관리", active: false },
            { label: "📦 상품관리", active: false },
            { label: "🏬 재고관리", active: false },
            { label: "📒 회계장부", active: false },
            { label: "🏦 입금관리", active: false },
            { label: "📈 통계관리", active: false },
            { label: "📋 게시판 관리", active: true, badge: 4 },
            { label: "🎟️ 쿠폰관리", active: false },
            { label: "💬 카카오 알림", active: false },
            { label: "📄 페이지관리", active: false },
            { label: "⚙️ 설정", active: false },
          ].map((item, i) => (
            <div key={i} className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between ${item.active ? "bg-blue-600 text-white font-medium" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
              <span>{item.label}</span>
              {item.badge && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{item.badge}</span>
              )}
            </div>
          ))}
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 44px)" }}>
          {/* 페이지 헤더 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <h1 className="text-xl font-bold text-indigo-900">게시판 관리</h1>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>총 <strong className="text-gray-900">12</strong>건</span>
              <span className="text-gray-300">|</span>
              <span>미답변 <strong className="text-red-600">4</strong>건</span>
              <span className="text-gray-300">|</span>
              <span>추가문의 <strong className="text-orange-600">2</strong>건</span>
            </div>
          </div>

          {/* 카테고리 탭 */}
          <div className="bg-white border-b border-gray-200 px-6 py-2.5 flex items-center gap-1.5 flex-shrink-0 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(cat.label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  activeCategory === cat.label
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  activeCategory === cat.label ? "bg-white/30 text-white" : "bg-gray-200 text-gray-500"
                }`}>{cat.count}</span>
              </button>
            ))}
          </div>

          {/* 좌우 분할 영역 */}
          <div className="flex flex-1 overflow-hidden">

            {/* ── 좌측: 문의 목록 (38%) ── */}
            <div className="w-5/13 border-r border-gray-200 flex flex-col bg-white" style={{ width: "38%" }}>
              
              {/* 상태 필터 + 검색 */}
              <div className="px-4 py-3 border-b border-gray-100 space-y-2 flex-shrink-0">
                <div className="flex items-center gap-1 flex-wrap">
                  {statuses.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setActiveStatus(s.label)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                        activeStatus === s.label
                          ? "bg-gray-800 text-white"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {s.color && <span className={`w-1.5 h-1.5 rounded-full ${s.color}`}></span>}
                      <span>{s.label}</span>
                      <span className="text-xs opacity-70">{s.count}</span>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                  <input
                    type="text"
                    placeholder="제목, 작성자, 내용 검색..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white"
                  />
                </div>
              </div>

              {/* 문의 목록 */}
              <div className="flex-1 overflow-y-auto">
                {inquiries.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedInquiry(item.id)}
                    className={`px-4 py-3.5 border-b border-gray-100 cursor-pointer transition-colors ${
                      selectedInquiry === item.id
                        ? "bg-indigo-50 border-l-4 border-l-indigo-500"
                        : item.unread
                        ? "bg-red-50/40 hover:bg-gray-50 border-l-4 border-l-transparent"
                        : "hover:bg-gray-50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${getStatusDot(item.status)}`}></span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${getStatusStyle(item.status)}`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-gray-400">{item.category}</span>
                        {item.urgent && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-500 text-white animate-pulse">긴급</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400">💬{item.msgCount}</span>
                        <span className="text-xs text-gray-400">{item.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.unread && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>}
                      <p className={`text-sm truncate ${item.unread ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                        {item.title}
                      </p>
                    </div>
                    <div className="mt-1">
                      <span className="text-xs text-gray-500">👤 {item.member}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 우측: 문의 상세 (62%) ── */}
            <div className="flex flex-col bg-gray-50" style={{ width: "62%" }}>
              
              {/* 상세 헤더 */}
              <div className="bg-white px-6 py-4 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusStyle("대기")}`}>대기</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">🚨 상품CS/미수</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-500 text-white">긴급</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors">
                      확인중 전환
                    </button>
                    <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                      종결 처리
                    </button>
                    <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
                      삭제
                    </button>
                  </div>
                </div>
                <h2 className="text-base font-bold text-gray-900 mb-1">사과 3박스 중 1박스 불량건</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>👤 프레시마트</span>
                  <span>📅 2026-02-14 09:30</span>
                  <span>💬 메시지 3건</span>
                  <span>📎 이미지 3장</span>
                </div>
              </div>

              {/* 탭: 접수정보 / 대화 / 첨부파일 */}
              <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-0 flex-shrink-0">
                {["접수정보", "대화", "첨부파일"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === tab
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {tab}
                    {tab === "첨부파일" && <span className="ml-1 bg-gray-200 text-gray-600 text-xs rounded-full px-1.5 py-0.5">3</span>}
                  </button>
                ))}
              </div>

              {/* 탭 콘텐츠 */}
              <div className="flex-1 overflow-y-auto">

                {/* ── 접수정보 탭 ── */}
                {detailTab === "접수정보" && (
                  <div className="px-6 py-5 space-y-4">
                    {/* 카테고리별 필수정보 — 상품CS/미수 예시 */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-red-50 px-4 py-2.5 border-b border-red-100 flex items-center gap-2">
                        <span>🚨</span>
                        <span className="text-sm font-bold text-red-800">상품CS/미수 — 접수 정보</span>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "담당자 / 연락처", value: csFields.담당자연락처, icon: "📞" },
                            { label: "상품 발송일", value: csFields.상품발송일, icon: "📅" },
                            { label: "상품명 / 코드", value: csFields.상품명코드, icon: "📦" },
                            { label: "수령자", value: csFields.수령자, icon: "👤" },
                            { label: "운송장 번호", value: csFields.운송장번호, icon: "🚛" },
                          ].map((field, i) => (
                            <div key={i} className={`bg-gray-50 rounded-lg p-3 ${i === 4 ? "col-span-2" : ""}`}>
                              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                <span>{field.icon}</span>
                                <span>{field.label}</span>
                                <span className="text-red-500">*</span>
                              </div>
                              <div className="text-sm font-medium text-gray-900">{field.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 증빙 사진 */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-100 flex items-center gap-2">
                        <span>📸</span>
                        <span className="text-sm font-bold text-amber-800">증빙 사진 (필수 3장)</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">3/3 첨부완료</span>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "① 발송 박스 전체", desc: "송장 부착 확인" },
                            { label: "② 상품 전체 사진", desc: "상품 상태 확인" },
                            { label: "③ 이슈 부분 상세", desc: "불량/파손 상세" },
                          ].map((photo, i) => (
                            <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                              <div className="bg-gray-200 h-32 flex items-center justify-center text-gray-400 text-3xl">
                                🖼️
                              </div>
                              <div className="p-2.5 bg-white">
                                <div className="text-xs font-medium text-gray-700">{photo.label}</div>
                                <div className="text-xs text-gray-400">{photo.desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 다른 카테고리 필수정보 참고 안내 */}
                    <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
                      <div className="text-xs font-bold text-blue-800 mb-2">📌 카테고리별 접수 필수 항목</div>
                      <div className="space-y-1.5 text-xs text-blue-700">
                        <div><strong>💬 일반문의:</strong> 제목, 문의내용</div>
                        <div><strong>🚨 상품CS/미수:</strong> 제목, 담당자/연락처, 상품발송일, 상품명/코드, 수령자, 운송장번호, 증빙사진 3장</div>
                        <div><strong>🧾 정산/계산서:</strong> 제목, 사업자명/ID, 요청금액/내용, 관련 증빙서류</div>
                        <div><strong>👤 회원정보(등급):</strong> 제목, 회원아이디, 담당자이름/연락처, 문의접수일</div>
                        <div><strong>🏷️ 행사특가/변경:</strong> 제목/아이디, 행사상품명/코드, 사이트명/행사명, 판매예상수량, 행사/출고예정일</div>
                        <div><strong>📝 기타:</strong> 제목, 문의내용</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 대화 탭 ── */}
                {detailTab === "대화" && (
                  <div className="px-6 py-4 space-y-4">
                    {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-md rounded-xl px-4 py-3 ${
                          msg.sender === "admin"
                            ? "bg-indigo-600 text-white rounded-br-sm"
                            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                        }`}>
                          <div className={`flex items-center gap-2 mb-1.5 text-xs ${
                            msg.sender === "admin" ? "text-indigo-200" : "text-gray-500"
                          }`}>
                            <span className="font-medium">{msg.sender === "admin" ? "🛡️ " : "👤 "}{msg.name}</span>
                            <span>{msg.time}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                          {/* 이미지 첨부가 있는 경우 */}
                          {msg.images && msg.images.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200/30">
                              <div className="flex gap-2">
                                {msg.images.map((img, j) => (
                                  <div key={j} className="w-16 h-16 bg-gray-300/30 rounded-lg flex items-center justify-center text-lg cursor-pointer hover:opacity-80 transition-opacity">
                                    🖼️
                                  </div>
                                ))}
                              </div>
                              <div className={`text-xs mt-1 ${msg.sender === "admin" ? "text-indigo-200" : "text-gray-400"}`}>
                                📎 이미지 {msg.images.length}장 첨부
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── 첨부파일 탭 ── */}
                {detailTab === "첨부파일" && (
                  <div className="px-6 py-5">
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-700">📎 첨부된 파일 목록</span>
                        <button className="px-3 py-1 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors">
                          전체 다운로드
                        </button>
                      </div>
                      <div className="p-4 space-y-2">
                        {[
                          { name: "발송_박스_전체.jpg", size: "2.3MB", date: "02-14 09:30", type: "image" },
                          { name: "상품_전체_사진.jpg", size: "1.8MB", date: "02-14 09:30", type: "image" },
                          { name: "파손_부분_상세.jpg", size: "3.1MB", date: "02-14 09:30", type: "image" },
                        ].map((file, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">🖼️</span>
                              <div>
                                <div className="text-sm font-medium text-gray-800">{file.name}</div>
                                <div className="text-xs text-gray-400">{file.size} · {file.date}</div>
                              </div>
                            </div>
                            <button className="px-2 py-1 rounded text-xs text-indigo-600 hover:bg-indigo-50">다운로드</button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 이미지 미리보기 */}
                    <div className="mt-4">
                      <div className="text-sm font-bold text-gray-700 mb-3">🖼️ 이미지 미리보기</div>
                      <div className="grid grid-cols-3 gap-3">
                        {["① 발송 박스 전체", "② 상품 전체 사진", "③ 이슈 부분 상세"].map((label, i) => (
                          <div key={i} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <div className="bg-gray-200 h-40 flex items-center justify-center text-gray-400 text-4xl">
                              🖼️
                            </div>
                            <div className="p-2 text-center">
                              <div className="text-xs font-medium text-gray-600">{label}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* 답변 입력 (대화 탭일 때만 표시) */}
              {detailTab === "대화" && (
                <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="답변을 입력하세요..."
                        rows={3}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white resize-none"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <button className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                          📎 파일 첨부
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Shift+Enter로 줄바꿈</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 justify-end">
                      <button className="px-5 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm">
                        답변 등록
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBoardDesignV2;
