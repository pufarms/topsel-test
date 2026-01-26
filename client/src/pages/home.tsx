import { PublicLayout } from "@/components/public";
import { Link } from "wouter";
import { 
  Award, 
  TrendingUp, 
  Package, 
  Truck, 
  Clock, 
  Gift,
  CreditCard,
  Users,
  CheckCircle,
  Headphones,
  BarChart3,
  ShieldCheck
} from "lucide-react";

export default function Home() {
  return (
    <PublicLayout transparentHeader={true} hasHeroBanner={true}>
      {/* Hero Section - Navy Background */}
      <section 
        className="relative min-h-[600px] md:min-h-[700px] flex items-center"
        style={{
          background: `linear-gradient(rgba(17, 24, 39, 0.7), rgba(17, 24, 39, 0.8)), url('https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
        data-testid="hero-section"
      >
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 py-20 md:py-28">
          <div className="text-center max-w-[800px] mx-auto">
            {/* Label */}
            <span 
              className="inline-block text-xs md:text-sm font-bold tracking-wider text-[#22D3EE] uppercase mb-4"
              data-testid="hero-label"
            >
              온라인과 오프라인 판매
            </span>
            
            {/* Main Title */}
            <h1 
              className="text-[32px] sm:text-[40px] md:text-[48px] lg:text-[56px] font-extrabold leading-tight text-white mb-6"
              data-testid="hero-title"
            >
              온라인 과일 판매의<br />
              <span className="text-[#5D7AF2]">차원</span>을 바꿉니다!
            </h1>
            
            {/* Description */}
            <p 
              className="text-sm md:text-base text-white/80 mb-8 max-w-[600px] mx-auto"
              data-testid="hero-description"
            >
              최상의 상품과 공급가로 당신의 성공을 지원합니다.<br className="hidden md:block" />
              지금 바로 시작하세요!
            </p>
            
            {/* Buttons */}
            <div className="flex flex-wrap gap-4 justify-center mb-16">
              <Link href="/register">
                <button 
                  className="px-8 py-3 bg-[#5D7AF2] text-white font-semibold rounded-lg hover:bg-[#4b63c7] transition-all shadow-lg"
                  data-testid="hero-cta-primary"
                >
                  시작하기
                </button>
              </Link>
              <Link href="/guide">
                <button 
                  className="px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-all"
                  data-testid="hero-cta-secondary"
                >
                  서비스 둘러보기
                </button>
              </Link>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 md:gap-12 max-w-[500px] mx-auto">
              <div className="text-center" data-testid="stat-years">
                <div className="text-[32px] md:text-[40px] lg:text-[48px] font-extrabold text-[#10B981]">32년</div>
                <div className="text-xs md:text-sm text-white/60 mt-1">업계 경력</div>
              </div>
              <div className="text-center" data-testid="stat-partners">
                <div className="text-[32px] md:text-[40px] lg:text-[48px] font-extrabold text-[#10B981]">28+</div>
                <div className="text-xs md:text-sm text-white/60 mt-1">파트너사</div>
              </div>
              <div className="text-center" data-testid="stat-satisfaction">
                <div className="text-[32px] md:text-[40px] lg:text-[48px] font-extrabold text-[#10B981]">99%</div>
                <div className="text-xs md:text-sm text-white/60 mt-1">고객 만족도</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Topsel Section - White Background */}
      <section className="py-16 md:py-20 lg:py-24 bg-white" data-testid="why-topsel-section">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-block text-xs md:text-sm font-bold tracking-wider text-[#5D7AF2] uppercase mb-3">
              WHY TOPSEL
            </span>
            <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-[#111827]">
              "과일판매" 탑셀러와 함께해야 하는 이유!
            </h2>
          </div>
          
          {/* Three Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {/* Card 1 */}
            <div className="text-center" data-testid="feature-card-1">
              <div className="relative rounded-xl overflow-hidden mb-6 aspect-[4/3]">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="30년 경력의 전문가 파트너" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-[18px] md:text-[20px] lg:text-[22px] font-bold text-[#111827] mb-3">
                30년 경력의 전문가 파트너
              </h3>
              <p className="text-sm md:text-base text-[#6B7280] leading-relaxed">
                단순한 B2B사이트가 아닙니다. 30여년 경험과 산지 네트워크를 통해 최상의 품질, 가격을 제공합니다.
              </p>
            </div>
            
            {/* Card 2 */}
            <div className="text-center" data-testid="feature-card-2">
              <div className="relative rounded-xl overflow-hidden mb-6 aspect-[4/3]">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="공급과 관리를 책임집니다" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-[18px] md:text-[20px] lg:text-[22px] font-bold text-[#111827] mb-3">
                공급과 관리를 책임집니다
              </h3>
              <p className="text-sm md:text-base text-[#6B7280] leading-relaxed">
                탑셀러가 모든 상품의 공급과 관리를 책임집니다. 당신은 판매에만 집중하세요.
              </p>
            </div>
            
            {/* Card 3 */}
            <div className="text-center" data-testid="feature-card-3">
              <div className="relative rounded-xl overflow-hidden mb-6 aspect-[4/3]">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="성장을 위한 맞춤형 혜택" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-[18px] md:text-[20px] lg:text-[22px] font-bold text-[#111827] mb-3">
                성장을 위한 맞춤형 혜택
              </h3>
              <p className="text-sm md:text-base text-[#6B7280] leading-relaxed">
                판매 규모에 따른 단계별 혜택과 마케팅 지원으로 당신의 성장을 함께합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Interview Section - Navy Background */}
      <section className="py-16 md:py-20 lg:py-24 bg-[#111827]" data-testid="interview-section">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-block text-xs md:text-sm font-bold tracking-wider text-[#22D3EE] uppercase mb-3">
              고객사 인터뷰
            </span>
            <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-white">
              품질과 신뢰를 확인하세요
            </h2>
          </div>
          
          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Image */}
            <div className="order-1">
              <div className="rounded-xl overflow-hidden">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="고객사 인터뷰" 
                  className="w-full aspect-[16/10] object-cover"
                />
              </div>
            </div>
            
            {/* Text */}
            <div className="order-2">
              <h3 className="text-[20px] md:text-[24px] font-bold text-white mb-4">
                "탑셀러와 함께한 후 매출이 3배 증가했습니다"
              </h3>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-6">
                처음 온라인 판매를 시작할 때 막막했는데, 탑셀러의 전문적인 지원 덕분에 
                안정적으로 사업을 확장할 수 있었습니다. 상품 품질은 물론, 
                빠른 배송과 체계적인 관리 시스템이 정말 큰 도움이 되었어요.
              </p>
              <ul className="space-y-3 text-white/80">
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="text-sm md:text-base">최상급 품질의 과일만 선별 공급</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="text-sm md:text-base">전국 익일 배송 시스템</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0" />
                  <span className="text-sm md:text-base">1:1 전담 매니저 배정</span>
                </li>
              </ul>
              <Link href="/about">
                <button className="mt-8 px-6 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-all">
                  자세히 알아보기
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery System Section - White Background */}
      <section className="py-16 md:py-20 lg:py-24 bg-white" data-testid="delivery-section">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-block text-xs md:text-sm font-bold tracking-wider text-[#5D7AF2] uppercase mb-3">
              빠른 배송
            </span>
            <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-[#111827]">
              안정적이고 편리함을 위한 "빠른 배송 시스템"을 갖췄습니다
            </h2>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8 max-w-[800px] mx-auto">
            <div className="bg-[#F9FAFB] rounded-xl p-6 md:p-8 text-center" data-testid="delivery-stat-1">
              <div className="w-16 h-16 bg-[#5D7AF2]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-[#5D7AF2]" />
              </div>
              <div className="text-[32px] md:text-[40px] font-extrabold text-[#5D7AF2]">10K</div>
              <div className="text-sm md:text-base text-[#6B7280] mt-2">월간 배송 건수</div>
            </div>
            
            <div className="bg-[#F9FAFB] rounded-xl p-6 md:p-8 text-center" data-testid="delivery-stat-2">
              <div className="w-16 h-16 bg-[#FF6B00]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-8 h-8 text-[#FF6B00]" />
              </div>
              <div className="text-[32px] md:text-[40px] font-extrabold text-[#FF6B00]">6K</div>
              <div className="text-sm md:text-base text-[#6B7280] mt-2">배송 가능 지역</div>
            </div>
            
            <div className="bg-[#F9FAFB] rounded-xl p-6 md:p-8 text-center" data-testid="delivery-stat-3">
              <div className="w-16 h-16 bg-[#10B981]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-[#10B981]" />
              </div>
              <div className="text-[32px] md:text-[40px] font-extrabold text-[#10B981]">D+1</div>
              <div className="text-sm md:text-base text-[#6B7280] mt-2">익일 배송 보장</div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features Section - Navy Background */}
      <section className="py-16 md:py-20 lg:py-24 bg-[#111827]" data-testid="platform-section">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-block text-xs md:text-sm font-bold tracking-wider text-[#22D3EE] uppercase mb-3">
              FOR SELLERS
            </span>
            <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-white">
              오직! 판매자를 생각하는 플랫폼입니다
            </h2>
          </div>
          
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Image */}
            <div className="order-2 lg:order-1">
              <div className="rounded-xl overflow-hidden">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="사용자 중심의 편리한 기능" 
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            </div>
            
            {/* Features List */}
            <div className="order-1 lg:order-2">
              <h3 className="text-[20px] md:text-[24px] font-bold text-white mb-6">
                사용자 중심의 편리한 기능
              </h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-[#5D7AF2]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-6 h-6 text-[#5D7AF2]" />
                  </div>
                  <div>
                    <h4 className="text-base md:text-lg font-semibold text-white mb-1">실시간 재고 및 가격 확인</h4>
                    <p className="text-sm text-white/70">언제든지 실시간으로 재고와 가격을 확인할 수 있습니다.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-[#FF6B00]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="w-6 h-6 text-[#FF6B00]" />
                  </div>
                  <div>
                    <h4 className="text-base md:text-lg font-semibold text-white mb-1">간편한 주문 시스템</h4>
                    <p className="text-sm text-white/70">복잡한 과정 없이 클릭 몇 번으로 주문이 완료됩니다.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-[#10B981]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-[#10B981]" />
                  </div>
                  <div>
                    <h4 className="text-base md:text-lg font-semibold text-white mb-1">판매 분석 리포트</h4>
                    <p className="text-sm text-white/70">상세한 판매 데이터와 인사이트를 제공합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment System Section - White Background */}
      <section className="py-16 md:py-20 lg:py-24 bg-white" data-testid="payment-section">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Text */}
            <div>
              <span className="inline-block text-xs md:text-sm font-bold tracking-wider text-[#5D7AF2] uppercase mb-3">
                결제 시스템
              </span>
              <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-[#111827] mb-6">
                후불 결제 지원과<br />유연한 결제 시스템
              </h2>
              <p className="text-sm md:text-base text-[#6B7280] leading-relaxed mb-8">
                신뢰를 바탕으로 한 후불 결제 시스템을 지원합니다. 
                현금, 카드, 계좌이체 등 다양한 결제 방식을 선택할 수 있어 
                편리하게 거래할 수 있습니다.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-4 bg-[#F9FAFB] rounded-lg">
                  <CreditCard className="w-6 h-6 text-[#5D7AF2]" />
                  <span className="text-sm font-medium text-[#111827]">카드 결제</span>
                </div>
                <div className="flex items-center gap-3 p-4 bg-[#F9FAFB] rounded-lg">
                  <ShieldCheck className="w-6 h-6 text-[#10B981]" />
                  <span className="text-sm font-medium text-[#111827]">안전 거래</span>
                </div>
              </div>
            </div>
            
            {/* Image */}
            <div>
              <div className="rounded-xl overflow-hidden">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="결제 시스템" 
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section - Navy Background */}
      <section className="py-16 md:py-20 lg:py-24 bg-[#111827]" data-testid="benefits-section">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-block text-xs md:text-sm font-bold tracking-wider text-[#22D3EE] uppercase mb-3">
              회원 혜택
            </span>
            <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-white">
              성공적인 판매를 위한 맞춤형 혜택
            </h2>
          </div>
          
          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center" data-testid="benefit-1">
              <div className="w-14 h-14 bg-[#5D7AF2]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Gift className="w-7 h-7 text-[#5D7AF2]" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white mb-2">첫 예치금 10% 추가</h3>
              <p className="text-sm text-white/60">신규 회원 가입 시 첫 예치금에 10%를 추가로 지급해 드립니다.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center" data-testid="benefit-2">
              <div className="w-14 h-14 bg-[#FF6B00]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-7 h-7 text-[#FF6B00]" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white mb-2">상품 콘텐츠 무료</h3>
              <p className="text-sm text-white/60">이미지, 동영상 등 상품 콘텐츠를 무료로 사용하실 수 있습니다.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center" data-testid="benefit-3">
              <div className="w-14 h-14 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-7 h-7 text-[#10B981]" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white mb-2">후불 결제 지원</h3>
              <p className="text-sm text-white/60">신뢰를 바탕으로 한 후불 결제 시스템을 지원합니다.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center" data-testid="benefit-4">
              <div className="w-14 h-14 bg-[#8B5CF6]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-[#8B5CF6]" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white mb-2">무료 교육 프로그램</h3>
              <p className="text-sm text-white/60">과일 셀러 연구소에서 성공 노하우를 배우세요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Support Section - White Background */}
      <section className="py-16 md:py-20 lg:py-24 bg-white" data-testid="support-section">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Image */}
            <div className="order-2 lg:order-1">
              <div className="rounded-xl overflow-hidden">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="CS 지원" 
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            </div>
            
            {/* Text */}
            <div className="order-1 lg:order-2">
              <span className="inline-block text-xs md:text-sm font-bold tracking-wider text-[#5D7AF2] uppercase mb-3">
                고객 지원
              </span>
              <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-[#111827] mb-6">
                24시간 자동 예치금과<br />신속한 CS 지원
              </h2>
              <p className="text-sm md:text-base text-[#6B7280] leading-relaxed mb-6">
                언제든지 예치금 충전이 가능하며, 전문 상담팀이 
                신속하게 문의사항을 처리해 드립니다.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#5D7AF2]/10 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#5D7AF2]" />
                  </div>
                  <span className="text-sm md:text-base text-[#111827]">24시간 자동 예치금 충전 시스템</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-full flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <span className="text-sm md:text-base text-[#111827]">전문 상담팀 신속 대응</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#FF6B00]/10 rounded-full flex items-center justify-center">
                    <Award className="w-5 h-5 text-[#FF6B00]" />
                  </div>
                  <span className="text-sm md:text-base text-[#111827]">1:1 전담 매니저 배정</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section - Primary Gradient */}
      <section 
        className="py-16 md:py-20 lg:py-24"
        style={{ background: 'linear-gradient(135deg, #5D7AF2 0%, #4b63c7 100%)' }}
        data-testid="cta-section"
      >
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10 text-center">
          <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-white mb-4">
            탑셀러와 함께하세요
          </h2>
          <p className="text-sm md:text-base text-white/90 mb-8 max-w-[600px] mx-auto">
            탑셀러는 단순히 상품만을 공급하는 곳이 아닙니다.<br className="hidden md:block" />
            성공적인 온라인 판매자가 되는 모든 여정을 함께합니다.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/register">
              <button 
                className="px-8 py-3 bg-white text-[#5D7AF2] font-semibold rounded-lg hover:bg-gray-100 transition-all shadow-lg"
                data-testid="cta-register"
              >
                회원 가입하기
              </button>
            </Link>
            <Link href="/contact">
              <button 
                className="px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-all"
                data-testid="cta-contact"
              >
                상담 문의하기
              </button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
