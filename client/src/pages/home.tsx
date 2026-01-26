import { PublicLayout } from "@/components/public";
import { Link } from "wouter";
import { useState, useEffect, useRef } from "react";
import { 
  Play,
  X,
  Tag,
  CreditCard,
  TrendingUp,
  Wallet,
  MessageSquare,
  FileText,
  Zap,
  PartyPopper,
  Check
} from "lucide-react";

function useCountUp(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
    }
  }, [startOnView]);

  useEffect(() => {
    if (startOnView && ref.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasStarted) {
            setHasStarted(true);
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    }
  }, [startOnView, hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [hasStarted, end, duration]);

  return { count, ref };
}

function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
}

function VideoModal({ isOpen, onClose, videoId }: VideoModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
      data-testid="video-modal"
    >
      <button
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
        onClick={onClose}
        data-testid="close-video-modal"
      >
        <X className="w-8 h-8" />
      </button>
      <div 
        className="w-full max-w-4xl aspect-video mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          className="w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

const customerVideos = [
  { id: "9BMwihIIi_w", thumbnail: "https://img.youtube.com/vi/9BMwihIIi_w/maxresdefault.jpg" },
  { id: "tkA0w7YDbGA", thumbnail: "https://img.youtube.com/vi/tkA0w7YDbGA/maxresdefault.jpg" },
  { id: "uClLMDn4L7M", thumbnail: "https://img.youtube.com/vi/uClLMDn4L7M/maxresdefault.jpg" },
  { id: "KyBwiUTZNgU", thumbnail: "https://img.youtube.com/vi/KyBwiUTZNgU/maxresdefault.jpg" },
  { id: "jLCjK18xZHg", thumbnail: "https://img.youtube.com/vi/jLCjK18xZHg/maxresdefault.jpg" },
];

export default function Home() {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const yearsCounter = useCountUp(32, 2000);
  const partnersCounter = useCountUp(28, 2000);
  const satisfactionCounter = useCountUp(99, 2000);

  const whyTopselAnim = useScrollAnimation();
  const expertAnim = useScrollAnimation();
  const customerStoriesAnim = useScrollAnimation();
  const supplyAnim = useScrollAnimation();
  const deliveryAnim = useScrollAnimation();
  const platformAnim = useScrollAnimation();
  const specialBenefitsAnim = useScrollAnimation();
  const customBenefitsAnim = useScrollAnimation();
  const autoSystemAnim = useScrollAnimation();
  const ctaAnim = useScrollAnimation();

  return (
    <PublicLayout transparentHeader={true} hasHeroBanner={true}>
      <VideoModal 
        isOpen={!!activeVideoId} 
        onClose={() => setActiveVideoId(null)} 
        videoId={activeVideoId || ""} 
      />

      {/* Hero Section */}
      <section 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(17, 24, 39, 0.85) 0%, rgba(17, 24, 39, 0.75) 100%), url('https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        data-testid="hero-section"
      >
        {/* Promotion Badge */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-10">
          <a 
            href="#" 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors hover:opacity-90"
            style={{ 
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: 'white'
            }}
            data-testid="promo-badge"
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            신규 가입 프로모션 진행 중
          </a>
        </div>

        <div className="container text-center pt-32 pb-20">
          {/* Main Title */}
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6"
            style={{ color: 'white' }}
            data-testid="hero-title"
          >
            온라인 과일 판매의<br />
            <span style={{ color: 'var(--primary)' }}>차원</span>을 바꿉니다!
          </h1>

          {/* Subtitle */}
          <p 
            className="text-base sm:text-lg md:text-xl mb-4 font-medium"
            style={{ color: 'rgba(255,255,255,0.9)' }}
          >
            전문 셀러처럼 당당하게 정면 승부하세요!
          </p>
          <p 
            className="text-sm sm:text-base md:text-lg mb-10"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            최상의 상품과 공급가로 당신의 성공을 지원합니다.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 justify-center mb-16">
            <Link href="/register">
              <button 
                className="btn btn-primary text-base px-8 py-3"
                data-testid="hero-cta-start"
              >
                시작하기
              </button>
            </Link>
            <Link href="/guide">
              <button 
                className="btn btn-outline-white text-base px-8 py-3"
                data-testid="hero-cta-learn"
              >
                서비스 둘러보기
              </button>
            </Link>
          </div>

          {/* Stats Counter */}
          <div 
            ref={yearsCounter.ref}
            className="grid grid-cols-3 gap-4 sm:gap-8 max-w-xl mx-auto"
          >
            <div className="text-center" data-testid="stat-years">
              <div 
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold"
                style={{ color: 'var(--accent-green)' }}
              >
                {yearsCounter.count}년
              </div>
              <div className="text-xs sm:text-sm mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                과일 전문 경력
              </div>
            </div>
            <div className="text-center" ref={partnersCounter.ref} data-testid="stat-partners">
              <div 
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold"
                style={{ color: 'var(--accent-green)' }}
              >
                {partnersCounter.count}+
              </div>
              <div className="text-xs sm:text-sm mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                파트너 셀러
              </div>
            </div>
            <div className="text-center" ref={satisfactionCounter.ref} data-testid="stat-satisfaction">
              <div 
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold"
                style={{ color: 'var(--accent-green)' }}
              >
                {satisfactionCounter.count}%
              </div>
              <div className="text-xs sm:text-sm mt-2" style={{ color: 'rgba(255,255,255,0.6)' }}>
                셀러 만족도
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Topsel Section */}
      <section 
        className="section-light"
        data-testid="why-topsel-section"
      >
        <div className="container">
          <div 
            ref={whyTopselAnim.ref}
            className={`text-center mb-12 transition-all duration-700 ${whyTopselAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <span className="subtitle-label mb-3">WHY TOPSEL</span>
            <h2 className="h2-section mb-4">
              "과일판매" 탑셀러와 함께해야 하는 이유!
            </h2>
            <p className="body-text max-w-2xl mx-auto">
              과일 판매의 시작부터 성공까지, 든든한 전문가가 함께합니다.
            </p>
          </div>
        </div>
      </section>

      {/* Expert Partner Section */}
      <section className="section-light" style={{ paddingTop: 0 }}>
        <div className="container">
          <div 
            ref={expertAnim.ref}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center transition-all duration-700 ${expertAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {/* Image */}
            <div className="order-2 lg:order-1">
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="30년 경력의 전문가 파트너"
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            </div>

            {/* Content */}
            <div className="order-1 lg:order-2">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6" style={{ color: 'var(--navy)' }}>
                30년 경력의 전문가 파트너
              </h3>
              <p className="body-text mb-4 text-base leading-relaxed">
                탑셀러는 단순 공급처가 아닌 셀러들의 성공 비즈니스 파트너입니다.
              </p>
              <p className="body-text mb-4 text-base leading-relaxed">
                30년 산지 경험과 20년 온라인 유통 노하우를 통해
                최상의 상품 경쟁력과 실패 없는 판매 전략을 모두 제공합니다.
              </p>
              <p className="body-text text-base leading-relaxed font-medium" style={{ color: 'var(--navy)' }}>
                막막한 과일 판매, 검증된 전문가 탑셀러와 함께
                최고의 기회로 만드십시오.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Customer Stories Section */}
      <section 
        className="section-dark"
        data-testid="customer-stories-section"
      >
        <div className="container">
          <div 
            ref={customerStoriesAnim.ref}
            className={`text-center mb-12 transition-all duration-700 ${customerStoriesAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <span className="subtitle-label mb-3" style={{ color: 'var(--accent-cyan)' }}>
              CUSTOMER STORIES
            </span>
            <h2 className="h2-section mb-4" style={{ color: 'white' }}>
              고객사 인터뷰
            </h2>
            <p className="body-text" style={{ color: 'rgba(255,255,255,0.7)' }}>
              탑셀러와 함께 성공한 파트너들의 이야기를 들어보세요!
            </p>
          </div>

          {/* Video Carousel - Grid layout for all devices */}
          <div className="relative">
            {/* Grid of videos - responsive columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {customerVideos.slice(0, 5).map((video, index) => (
                <div
                  key={video.id}
                  className={`${index >= 3 ? 'hidden lg:block' : ''} ${index >= 2 && index < 3 ? 'hidden sm:block' : ''}`}
                  data-testid={`video-thumbnail-${index}`}
                >
                  <div 
                    className="relative rounded-xl overflow-hidden cursor-pointer group aspect-video"
                    onClick={() => setActiveVideoId(video.id)}
                  >
                    <img 
                      src={video.thumbnail}
                      alt={`고객 인터뷰 ${index + 1}`}
                      className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/50 transition-colors">
                        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center transition-colors group-hover:bg-white">
                          <Play className="w-6 h-6 text-red-600 ml-1" fill="currentColor" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

          </div>
        </div>
      </section>

      {/* Supply & Management Section */}
      <section className="section-light" data-testid="supply-section">
        <div className="container">
          <div 
            ref={supplyAnim.ref}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center transition-all duration-700 ${supplyAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {/* Content */}
            <div>
              <h2 className="h2-section mb-6">
                공급과 관리를 책임집니다
              </h2>
              <p className="body-text mb-4 text-base leading-relaxed">
                상품 공급과 관리는 탑셀러가 책임지니,
                셀러는 오직 판매에만 집중하십시오.
              </p>
              <p className="body-text mb-4 text-base leading-relaxed">
                산지 직접 수매로 확보한 가격 경쟁력과
                최첨단 콜드체인 및 자동 포장 시스템이 최상의 품질을 보장합니다.
              </p>
              <p className="body-text text-base leading-relaxed font-medium" style={{ color: 'var(--navy)' }}>
                탑셀러의 완벽한 인프라가 성공 비즈니스의 든든한 기반이 되겠습니다
              </p>
            </div>

            {/* Image */}
            <div>
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="공급과 관리"
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery System Section */}
      <section className="section-dark" data-testid="delivery-section">
        <div className="container">
          <div 
            ref={deliveryAnim.ref}
            className={`text-center mb-12 transition-all duration-700 ${deliveryAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <span className="subtitle-label mb-3" style={{ color: 'var(--accent-cyan)' }}>
              DELIVERY SYSTEM
            </span>
            <h2 className="h2-section mb-4" style={{ color: 'white' }}>
              안정적이고 경쟁력을 갖춘 "택배 배송 시스템"을 완비
            </h2>
            <p className="body-text max-w-3xl mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
              롯데택배와 CJ택배와 같은 대형 택배회사와 대량 배송계약을 체결함으써 경쟁력 있는 비용을 확보하고,
              전국 물류기지를 통한 직송 시스템으로 안정적인 택배 배송을 보장하였습니다.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="text-4xl sm:text-5xl font-extrabold mb-2" style={{ color: 'var(--primary)' }}>
                10K
              </div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                일일 최대 포장
              </div>
            </div>
            <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="text-4xl sm:text-5xl font-extrabold mb-2" style={{ color: 'var(--accent-orange)' }}>
                6K
              </div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                아이스박스 발송
              </div>
            </div>
            <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div className="text-4xl sm:text-5xl font-extrabold mb-2" style={{ color: 'var(--accent-green)' }}>
                D+1
              </div>
              <div className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                전국 익일 배송
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features Section */}
      <section className="section-light" data-testid="platform-section">
        <div className="container">
          <div 
            ref={platformAnim.ref}
            className={`transition-all duration-700 ${platformAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="text-center mb-12">
              <span className="subtitle-label mb-3">WHY TOPSEL</span>
              <h2 className="h2-section mb-4">
                오직! 판매자를 생각하는 플랫폼입니다
              </h2>
              <p className="body-text max-w-2xl mx-auto">
                편리한 기능과 자동화 시스템으로 여러분의 비즈니스를 지원합니다.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              {/* Image */}
              <div className="order-2 lg:order-1">
                <div className="rounded-2xl overflow-hidden shadow-xl">
                  <img 
                    src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                    alt="사용자 중심의 편리한 기능"
                    className="w-full aspect-[4/3] object-cover"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="order-1 lg:order-2">
                <h3 className="text-xl sm:text-2xl font-bold mb-6" style={{ color: 'var(--navy)' }}>
                  사용자 중심의 편리한 기능
                </h3>
                <p className="body-text mb-4 text-base leading-relaxed">
                  복잡한 절차 없는 원스톱 솔루션으로 누구나 쉽게 시작하십시오.
                </p>
                <p className="body-text mb-4 text-base leading-relaxed">
                  AI 기반의 엑셀 자동 변환과 주소 검증 시스템이
                  번거로운 주문 처리 시간을 획기적으로 단축해 줍니다.
                </p>
                <p className="body-text text-base leading-relaxed">
                  또한 상세페이지 원본(PSD)과 홍보 영상 등 고품질 마케팅 리소스를 무료로 제공하여,
                  셀러들의 업무 효율과 판매 경쟁력을 동시에 높여드립니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Special Benefits Section */}
      <section className="section-dark" data-testid="special-benefits-section">
        <div className="container">
          <div 
            ref={specialBenefitsAnim.ref}
            className={`transition-all duration-700 ${specialBenefitsAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="text-center mb-12">
              <span className="subtitle-label mb-3" style={{ color: 'var(--accent-cyan)' }}>
                SPECIAL BENEFITS
              </span>
              <h2 className="h2-section mb-4" style={{ color: 'white' }}>
                특가 행사 지원과 후불 결제 시스템
              </h2>
              <p className="body-text max-w-3xl mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
                매출 성장의 핵심인 특가 행사를 횟수 제한 없이 자유롭게 지원하며, 
                사업자 전용 후불 결제 시스템으로 초기 자금 부담까지 획기적으로 덜어드립니다.
              </p>
              <p className="body-text max-w-3xl mx-auto mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
                유연한 프로모션 기회와 실질적인 자금 지원을 통해 사장님의 사업 확장을 강력하게 뒷받침하겠습니다
              </p>
            </div>

            {/* Benefits Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'rgba(93,122,242,0.2)' }}>
                  <Tag className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'white' }}>특가 행사 지원</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>횟수 제한 없이 행사 진행 가능</p>
              </div>

              <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,0,0.2)' }}>
                  <CreditCard className="w-6 h-6" style={{ color: 'var(--accent-orange)' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'white' }}>후불 결제</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>사업자 회원 후불 결제 시스템</p>
              </div>

              <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)' }}>
                  <TrendingUp className="w-6 h-6" style={{ color: 'var(--accent-green)' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'white' }}>판매량 증가</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>특가 행사로 판매량 증가 기회</p>
              </div>

              <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)' }}>
                  <Wallet className="w-6 h-6" style={{ color: 'var(--badge-purple)' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'white' }}>자금 부담 감소</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>초기 자금 부담 대폭 절감</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Benefits Section */}
      <section className="section-light" data-testid="custom-benefits-section">
        <div className="container">
          <div 
            ref={customBenefitsAnim.ref}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center transition-all duration-700 ${customBenefitsAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {/* Content */}
            <div>
              <h2 className="h2-section mb-6">
                성공적인 판매를 위한 맞춤형 혜택
              </h2>
              <p className="body-text mb-4 text-base leading-relaxed">
                판매 단계별 맞춤 혜택과 마케팅 지원으로
                셀러들의 성장을 가속화합니다.
              </p>
              <p className="body-text mb-4 text-base leading-relaxed">
                첫 예치금 보너스로 부담 없는 시작을 돕고,
                판매 성과에 따른 등급별(Start, Driving, Top) 차등 할인으로
                수익성을 극대화해 드립니다.
              </p>
              <p className="body-text text-base leading-relaxed font-medium" style={{ color: 'var(--navy)' }}>
                판매량이 늘어날수록 더 강력해지는 혜택, 탑셀러와 함께 성공을 키워가십시오.
              </p>
            </div>

            {/* Image */}
            <div>
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <img 
                  src="https://pub-ecc7de5cc4bd40e3965936a44b8274b6.r2.dev/기타/26012544.jpg" 
                  alt="맞춤형 혜택"
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Auto System Section */}
      <section className="section-dark" data-testid="auto-system-section">
        <div className="container">
          <div 
            ref={autoSystemAnim.ref}
            className={`transition-all duration-700 ${autoSystemAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="text-center mb-12">
              <span className="subtitle-label mb-3" style={{ color: 'var(--accent-cyan)' }}>
                AUTO SYSTEM
              </span>
              <h2 className="h2-section mb-4" style={{ color: 'white' }}>
                24시간 자동 예치금과 신속한 CS 지원
              </h2>
              <p className="body-text max-w-3xl mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
                24시간 자동 예치금 시스템으로 결제 지연 없는 업무 연속성을 보장합니다.
                또한 상품·배송 이슈에는 다양한 채널로 즉각 대응하여, 셀러들에게 가장 안정적인 영업 환경을 약속드립니다.
              </p>
            </div>

            {/* Features Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'rgba(93,122,242,0.2)' }}>
                  <CreditCard className="w-6 h-6" style={{ color: 'var(--primary)' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'white' }}>자동 예치금</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>24시간 자동 예치금 전환시스템</p>
              </div>

              <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,107,0,0.2)' }}>
                  <MessageSquare className="w-6 h-6" style={{ color: 'var(--accent-orange)' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'white' }}>멀티 채널 CS</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>카카오톡, 챗봇, 문자, 전화 지원</p>
              </div>

              <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)' }}>
                  <FileText className="w-6 h-6" style={{ color: 'var(--accent-green)' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'white' }}>맞춤형 CS 기준</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>상품별 차별화된 대응 전략 제공</p>
              </div>

              <div className="text-center p-6 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)' }}>
                  <Zap className="w-6 h-6" style={{ color: 'var(--badge-purple)' }} />
                </div>
                <h3 className="font-bold text-lg mb-2" style={{ color: 'white' }}>신속 대응</h3>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>고객 문제 즉각 해결 지원</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section 
        className="py-20"
        style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #4338ca 100%)' }}
        data-testid="cta-section"
      >
        <div className="container">
          <div 
            ref={ctaAnim.ref}
            className={`text-center transition-all duration-700 ${ctaAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {/* Promo Badge */}
            <a 
              href="#" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 transition-colors hover:opacity-90"
              style={{ 
                background: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)'
              }}
            >
              <PartyPopper className="w-4 h-4" />
              지금 가입하면 포인터 10% 추가 지급
            </a>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4" style={{ color: 'white' }}>
              탑셀러와 함께하세요
            </h2>
            <p className="body-text max-w-2xl mx-auto mb-8" style={{ color: 'rgba(255,255,255,0.9)' }}>
              탑셀러는 단순히 상품만을 공급하는 곳이 아닙니다.<br className="hidden sm:block" />
              성공적인 온라인 판매자가 되는 모든 여정을 함께합니다.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link href="/register">
                <button 
                  className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-base transition-colors hover:opacity-90"
                  style={{ background: 'white', color: 'var(--primary)' }}
                  data-testid="cta-register"
                >
                  회원 가입하기
                </button>
              </Link>
              <Link href="/contact">
                <button 
                  className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-base transition-colors hover:opacity-90"
                  style={{ background: 'transparent', color: 'white', border: '2px solid white' }}
                  data-testid="cta-contact"
                >
                  상담 문의하기
                </button>
              </Link>
            </div>

            {/* Benefits List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Check className="w-4 h-4" style={{ color: 'var(--accent-green)' }} />
                <span className="text-sm font-medium" style={{ color: 'white' }}>첫 예치금 추가 10% 지급</span>
              </div>
              <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Check className="w-4 h-4" style={{ color: 'var(--accent-green)' }} />
                <span className="text-sm font-medium" style={{ color: 'white' }}>상품 콘텐츠 무료사용</span>
              </div>
              <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Check className="w-4 h-4" style={{ color: 'var(--accent-green)' }} />
                <span className="text-sm font-medium" style={{ color: 'white' }}>후불 결재 시스템 지원</span>
              </div>
              <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Check className="w-4 h-4" style={{ color: 'var(--accent-green)' }} />
                <span className="text-sm font-medium" style={{ color: 'white' }}>무료 교육_과일 셀러 연구소</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
