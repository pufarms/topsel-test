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
        className="section-dark relative min-h-[600px] md:min-h-[700px] flex items-center"
        style={{
          background: `linear-gradient(rgba(var(--navy-rgb, 17, 24, 39), 0.7), rgba(var(--navy-rgb, 17, 24, 39), 0.8)), url('https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: 0
        }}
        data-testid="hero-section"
      >
        <div className="container py-20 md:py-28">
          <div className="text-center max-w-[800px] mx-auto">
            {/* Label */}
            <span 
              className="subtitle-label"
              style={{ color: 'var(--accent-cyan)' }}
              data-testid="hero-label"
            >
              온라인과 오프라인 판매
            </span>
            
            {/* Main Title */}
            <h1 
              className="h1-hero mt-4 mb-6"
              style={{ color: 'var(--white)' }}
              data-testid="hero-title"
            >
              온라인 과일 판매의<br />
              <span style={{ color: 'var(--primary)' }}>차원</span>을 바꿉니다!
            </h1>
            
            {/* Description */}
            <p 
              className="body-text mb-8 max-w-[600px] mx-auto"
              style={{ color: 'rgba(255,255,255,0.8)' }}
              data-testid="hero-description"
            >
              최상의 상품과 공급가로 당신의 성공을 지원합니다.<br className="hidden md:block" />
              지금 바로 시작하세요!
            </p>
            
            {/* Buttons */}
            <div className="flex flex-wrap gap-4 justify-center mb-16">
              <Link href="/register">
                <button 
                  className="btn btn-primary"
                  data-testid="hero-cta-primary"
                >
                  시작하기
                </button>
              </Link>
              <Link href="/guide">
                <button 
                  className="btn btn-outline-white"
                  data-testid="hero-cta-secondary"
                >
                  서비스 둘러보기
                </button>
              </Link>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 md:gap-12 max-w-[500px] mx-auto">
              <div className="text-center" data-testid="stat-years">
                <div className="stat-number">32년</div>
                <div className="caption mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>업계 경력</div>
              </div>
              <div className="text-center" data-testid="stat-partners">
                <div className="stat-number">28+</div>
                <div className="caption mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>파트너사</div>
              </div>
              <div className="text-center" data-testid="stat-satisfaction">
                <div className="stat-number">99%</div>
                <div className="caption mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>고객 만족도</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Topsel Section - White Background */}
      <section className="section-light" data-testid="why-topsel-section">
        <div className="container">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <span className="subtitle-label mb-3">
              WHY TOPSEL
            </span>
            <h2 className="h2-section">
              "과일판매" 탑셀러와 함께해야 하는 이유!
            </h2>
          </div>
          
          {/* Three Column Layout */}
          <div className="grid grid-1 grid-sm-2 grid-lg-3">
            {/* Card 1 */}
            <div className="text-center" data-testid="feature-card-1">
              <div className="relative rounded-xl overflow-hidden mb-6 aspect-[4/3]">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="30년 경력의 전문가 파트너" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="h3-card mb-3">
                30년 경력의 전문가 파트너
              </h3>
              <p className="body-text">
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
              <h3 className="h3-card mb-3">
                공급과 관리를 책임집니다
              </h3>
              <p className="body-text">
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
              <h3 className="h3-card mb-3">
                성장을 위한 맞춤형 혜택
              </h3>
              <p className="body-text">
                판매 규모에 따른 단계별 혜택과 마케팅 지원으로 당신의 성장을 함께합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Interview Section - Navy Background */}
      <section className="section-dark" data-testid="interview-section">
        <div className="container">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <span className="subtitle-label" style={{ color: 'var(--accent-cyan)' }}>
              고객사 인터뷰
            </span>
            <h2 className="h2-section" style={{ color: 'var(--white)' }}>
              품질과 신뢰를 확인하세요
            </h2>
          </div>
          
          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Image */}
            <div className="order-1">
              <div className="img-rounded overflow-hidden">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="고객사 인터뷰" 
                  className="w-full aspect-[16/10] object-cover"
                />
              </div>
            </div>
            
            {/* Text */}
            <div className="order-2">
              <h3 className="h3-card mb-4" style={{ color: 'var(--white)', fontSize: '20px' }}>
                "탑셀러와 함께한 후 매출이 3배 증가했습니다"
              </h3>
              <p className="body-text mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
                처음 온라인 판매를 시작할 때 막막했는데, 탑셀러의 전문적인 지원 덕분에 
                안정적으로 사업을 확장할 수 있었습니다. 상품 품질은 물론, 
                빠른 배송과 체계적인 관리 시스템이 정말 큰 도움이 되었어요.
              </p>
              <ul className="space-y-3" style={{ color: 'rgba(255,255,255,0.8)' }}>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-green)' }} />
                  <span className="body-text" style={{ color: 'rgba(255,255,255,0.8)' }}>최상급 품질의 과일만 선별 공급</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-green)' }} />
                  <span className="body-text" style={{ color: 'rgba(255,255,255,0.8)' }}>전국 익일 배송 시스템</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent-green)' }} />
                  <span className="body-text" style={{ color: 'rgba(255,255,255,0.8)' }}>1:1 전담 매니저 배정</span>
                </li>
              </ul>
              <Link href="/about">
                <button className="btn btn-outline-white mt-8">
                  자세히 알아보기
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery System Section - White Background */}
      <section className="section-light" data-testid="delivery-section">
        <div className="container">
          <div className="text-center mb-12 md:mb-16">
            <span className="subtitle-label mb-3">
              빠른 배송
            </span>
            <h2 className="h2-section">
              안정적이고 편리함을 위한 "빠른 배송 시스템"을 갖췄습니다
            </h2>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-1 grid-sm-3 max-w-[800px] mx-auto">
            <div className="card text-center" data-testid="delivery-stat-1">
              <div className="icon-box mx-auto mb-4" style={{ backgroundColor: 'rgba(93,122,242,0.1)' }}>
                <Package className="w-8 h-8" style={{ color: 'var(--primary)' }} />
              </div>
              <div className="stat-number" style={{ color: 'var(--primary)' }}>10K</div>
              <div className="body-text mt-2">월간 배송 건수</div>
            </div>
            
            <div className="card text-center" data-testid="delivery-stat-2">
              <div className="icon-box mx-auto mb-4" style={{ backgroundColor: 'rgba(255,107,0,0.1)' }}>
                <Truck className="w-8 h-8" style={{ color: 'var(--accent-orange)' }} />
              </div>
              <div className="stat-number" style={{ color: 'var(--accent-orange)' }}>6K</div>
              <div className="body-text mt-2">배송 가능 지역</div>
            </div>
            
            <div className="card text-center" data-testid="delivery-stat-3">
              <div className="icon-box mx-auto mb-4" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}>
                <Clock className="w-8 h-8" style={{ color: 'var(--accent-green)' }} />
              </div>
              <div className="stat-number">D+1</div>
              <div className="body-text mt-2">익일 배송 보장</div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features Section - Navy Background */}
      <section className="section-dark" data-testid="platform-section">
        <div className="container">
          <div className="text-center mb-12 md:mb-16">
            <span className="subtitle-label" style={{ color: 'var(--accent-cyan)' }}>
              FOR SELLERS
            </span>
            <h2 className="h2-section" style={{ color: 'var(--white)' }}>
              오직! 판매자를 생각하는 플랫폼입니다
            </h2>
          </div>
          
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Image */}
            <div className="order-2 lg:order-1">
              <div className="img-rounded overflow-hidden">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="사용자 중심의 편리한 기능" 
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            </div>
            
            {/* Features List */}
            <div className="order-1 lg:order-2">
              <h3 className="h3-card mb-6" style={{ color: 'var(--white)', fontSize: '24px' }}>
                사용자 중심의 편리한 기능
              </h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="icon-box flex-shrink-0" style={{ backgroundColor: 'rgba(93,122,242,0.2)' }}>
                    <BarChart3 className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <h4 className="h3-card mb-1" style={{ color: 'var(--white)' }}>실시간 재고 및 가격 확인</h4>
                    <p className="body-text" style={{ color: 'rgba(255,255,255,0.7)' }}>언제든지 실시간으로 재고와 가격을 확인할 수 있습니다.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="icon-box flex-shrink-0" style={{ backgroundColor: 'rgba(255,107,0,0.2)' }}>
                    <Package className="w-6 h-6" style={{ color: 'var(--accent-orange)' }} />
                  </div>
                  <div>
                    <h4 className="h3-card mb-1" style={{ color: 'var(--white)' }}>간편한 주문 시스템</h4>
                    <p className="body-text" style={{ color: 'rgba(255,255,255,0.7)' }}>복잡한 과정 없이 클릭 몇 번으로 주문이 완료됩니다.</p>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <div className="icon-box flex-shrink-0" style={{ backgroundColor: 'rgba(16,185,129,0.2)' }}>
                    <TrendingUp className="w-6 h-6" style={{ color: 'var(--accent-green)' }} />
                  </div>
                  <div>
                    <h4 className="h3-card mb-1" style={{ color: 'var(--white)' }}>판매 분석 리포트</h4>
                    <p className="body-text" style={{ color: 'rgba(255,255,255,0.7)' }}>상세한 판매 데이터와 인사이트를 제공합니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Payment System Section - White Background */}
      <section className="section-light" data-testid="payment-section">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Text */}
            <div>
              <span className="subtitle-label mb-3">
                결제 시스템
              </span>
              <h2 className="h2-section mb-6">
                후불 결제 지원과<br />유연한 결제 시스템
              </h2>
              <p className="body-text mb-8">
                신뢰를 바탕으로 한 후불 결제 시스템을 지원합니다. 
                현금, 카드, 계좌이체 등 다양한 결제 방식을 선택할 수 있어 
                편리하게 거래할 수 있습니다.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="card flex items-center gap-3 p-4">
                  <CreditCard className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                  <span className="h3-card">카드 결제</span>
                </div>
                <div className="card flex items-center gap-3 p-4">
                  <ShieldCheck className="w-6 h-6" style={{ color: 'var(--accent-green)' }} />
                  <span className="h3-card">안전 거래</span>
                </div>
              </div>
            </div>
            
            {/* Image */}
            <div>
              <div className="img-rounded overflow-hidden">
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
      <section className="section-dark" data-testid="benefits-section">
        <div className="container">
          <div className="text-center mb-12 md:mb-16">
            <span className="subtitle-label" style={{ color: 'var(--accent-cyan)' }}>
              회원 혜택
            </span>
            <h2 className="h2-section" style={{ color: 'var(--white)' }}>
              성공적인 판매를 위한 맞춤형 혜택
            </h2>
          </div>
          
          {/* Benefits Grid */}
          <div className="grid grid-1 grid-sm-2 grid-lg-4">
            <div className="card card-dark text-center" data-testid="benefit-1">
              <div className="icon-box mx-auto mb-4" style={{ backgroundColor: 'rgba(93,122,242,0.2)' }}>
                <Gift className="w-7 h-7" style={{ color: 'var(--primary)' }} />
              </div>
              <h3 className="h3-card mb-2" style={{ color: 'var(--white)' }}>첫 예치금 10% 추가</h3>
              <p className="body-text" style={{ color: 'rgba(255,255,255,0.6)' }}>신규 회원 가입 시 첫 예치금에 10%를 추가로 지급해 드립니다.</p>
            </div>
            
            <div className="card card-dark text-center" data-testid="benefit-2">
              <div className="icon-box mx-auto mb-4" style={{ backgroundColor: 'rgba(255,107,0,0.2)' }}>
                <Package className="w-7 h-7" style={{ color: 'var(--accent-orange)' }} />
              </div>
              <h3 className="h3-card mb-2" style={{ color: 'var(--white)' }}>상품 콘텐츠 무료</h3>
              <p className="body-text" style={{ color: 'rgba(255,255,255,0.6)' }}>이미지, 동영상 등 상품 콘텐츠를 무료로 사용하실 수 있습니다.</p>
            </div>
            
            <div className="card card-dark text-center" data-testid="benefit-3">
              <div className="icon-box mx-auto mb-4" style={{ backgroundColor: 'rgba(16,185,129,0.2)' }}>
                <CreditCard className="w-7 h-7" style={{ color: 'var(--accent-green)' }} />
              </div>
              <h3 className="h3-card mb-2" style={{ color: 'var(--white)' }}>후불 결제 지원</h3>
              <p className="body-text" style={{ color: 'rgba(255,255,255,0.6)' }}>신뢰를 바탕으로 한 후불 결제 시스템을 지원합니다.</p>
            </div>
            
            <div className="card card-dark text-center" data-testid="benefit-4">
              <div className="icon-box mx-auto mb-4" style={{ backgroundColor: 'rgba(139,92,246,0.2)' }}>
                <Users className="w-7 h-7" style={{ color: 'var(--badge-purple)' }} />
              </div>
              <h3 className="h3-card mb-2" style={{ color: 'var(--white)' }}>무료 교육 프로그램</h3>
              <p className="body-text" style={{ color: 'rgba(255,255,255,0.6)' }}>과일 셀러 연구소에서 성공 노하우를 배우세요.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Support Section - White Background */}
      <section className="section-light" data-testid="support-section">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Image */}
            <div className="order-2 lg:order-1">
              <div className="img-rounded overflow-hidden">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="CS 지원" 
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            </div>
            
            {/* Text */}
            <div className="order-1 lg:order-2">
              <span className="subtitle-label mb-3">
                고객 지원
              </span>
              <h2 className="h2-section mb-6">
                24시간 자동 예치금과<br />신속한 CS 지원
              </h2>
              <p className="body-text mb-6">
                언제든지 예치금 충전이 가능하며, 전문 상담팀이 
                신속하게 문의사항을 처리해 드립니다.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="icon-box" style={{ backgroundColor: 'rgba(93,122,242,0.1)', width: '40px', height: '40px' }}>
                    <Clock className="w-5 h-5" style={{ color: 'var(--primary)' }} />
                  </div>
                  <span className="body-text" style={{ color: 'var(--text-main)' }}>24시간 자동 예치금 충전 시스템</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="icon-box" style={{ backgroundColor: 'rgba(16,185,129,0.1)', width: '40px', height: '40px' }}>
                    <Headphones className="w-5 h-5" style={{ color: 'var(--accent-green)' }} />
                  </div>
                  <span className="body-text" style={{ color: 'var(--text-main)' }}>전문 상담팀 신속 대응</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="icon-box" style={{ backgroundColor: 'rgba(255,107,0,0.1)', width: '40px', height: '40px' }}>
                    <Award className="w-5 h-5" style={{ color: 'var(--accent-orange)' }} />
                  </div>
                  <span className="body-text" style={{ color: 'var(--text-main)' }}>1:1 전담 매니저 배정</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section - Primary Gradient */}
      <section 
        className="section-dark"
        style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' }}
        data-testid="cta-section"
      >
        <div className="container text-center">
          <h2 className="h2-section mb-4" style={{ color: 'var(--white)' }}>
            탑셀러와 함께하세요
          </h2>
          <p className="body-text mb-8 max-w-[600px] mx-auto" style={{ color: 'rgba(255,255,255,0.9)' }}>
            탑셀러는 단순히 상품만을 공급하는 곳이 아닙니다.<br className="hidden md:block" />
            성공적인 온라인 판매자가 되는 모든 여정을 함께합니다.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/register">
              <button 
                className="btn"
                style={{ backgroundColor: 'var(--white)', color: 'var(--primary)' }}
                data-testid="cta-register"
              >
                회원 가입하기
              </button>
            </Link>
            <Link href="/contact">
              <button 
                className="btn btn-outline-white"
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
