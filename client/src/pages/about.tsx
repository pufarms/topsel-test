import { PublicLayout } from "@/components/public";
import { Building2, Users, Target, Award, TrendingUp, Heart, Truck, Shield } from "lucide-react";

export default function AboutPage() {
  return (
    <PublicLayout transparentHeader={true} hasHeroBanner={true}>
      {/* ============================================
          HERO SECTION - Navy 배경
          ============================================ */}
      <section className="bg-[#111827] text-white" style={{ padding: "100px 0 60px" }}>
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="text-center max-w-[800px] mx-auto">
            <span className="text-sm font-bold uppercase tracking-wider text-[#5D7AF2]">
              ABOUT TOPSEL
            </span>
            
            <h1 className="mt-4 text-[32px] sm:text-[40px] md:text-[48px] lg:text-[56px] font-extrabold leading-tight text-white">
              온라인 과일 판매의<br />
              <span className="text-[#22D3EE]">차원을 바꿉니다</span>
            </h1>
            
            <p className="mt-6 text-sm md:text-base text-white/80 leading-relaxed">
              탑셀러는 B2B 과일 도매 시장에 혁신을 가져온 선도적인 플랫폼입니다.<br className="hidden md:block" />
              32년간의 과일 유통 노하우를 바탕으로 온라인과 오프라인을 연결합니다.
            </p>
          </div>
          
          {/* 통계 섹션 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-12 text-center">
            <div>
              <div className="text-[32px] md:text-[40px] lg:text-[48px] font-extrabold text-[#10B981]">32년</div>
              <div className="text-sm text-white/60 mt-2">업력</div>
            </div>
            <div>
              <div className="text-[32px] md:text-[40px] lg:text-[48px] font-extrabold text-[#10B981]">28+</div>
              <div className="text-sm text-white/60 mt-2">파트너사</div>
            </div>
            <div>
              <div className="text-[32px] md:text-[40px] lg:text-[48px] font-extrabold text-[#10B981]">99%</div>
              <div className="text-sm text-white/60 mt-2">고객 만족도</div>
            </div>
            <div>
              <div className="text-[32px] md:text-[40px] lg:text-[48px] font-extrabold text-[#10B981]">10K+</div>
              <div className="text-sm text-white/60 mt-2">월 배송 건수</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          MISSION SECTION - White 배경
          ============================================ */}
      <section className="bg-white py-[60px] md:py-[80px] lg:py-[100px]">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="text-center mb-12">
            <span className="text-sm font-bold uppercase tracking-wider text-[#5D7AF2]">
              OUR MISSION
            </span>
            <h2 className="mt-4 text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-[#111827]">
              "과일판매" 탑셀러와 함께해야 하는 이유!
            </h2>
          </div>
          
          {/* 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            <div className="bg-white rounded-xl md:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] p-5 md:p-6 lg:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
              <div className="w-10 h-10 md:w-[45px] md:h-[45px] lg:w-[50px] lg:h-[50px] rounded-xl bg-[#5D7AF2] flex items-center justify-center text-white">
                <Target className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h3 className="mt-5 text-lg md:text-xl lg:text-[22px] font-bold text-[#1F2937]">
                32년 경험의 전문가 파트너
              </h3>
              <p className="mt-3 text-sm md:text-base text-[#6B7280] leading-relaxed">
                과일 유통 분야에서 32년간 쌓아온 노하우와 네트워크를 통해 최상의 품질을 보장합니다.
              </p>
            </div>
            
            <div className="bg-white rounded-xl md:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] p-5 md:p-6 lg:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
              <div className="w-10 h-10 md:w-[45px] md:h-[45px] lg:w-[50px] lg:h-[50px] rounded-xl bg-[#FF6B00] flex items-center justify-center text-white">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h3 className="mt-5 text-lg md:text-xl lg:text-[22px] font-bold text-[#1F2937]">
                매출 증대 솔루션
              </h3>
              <p className="mt-3 text-sm md:text-base text-[#6B7280] leading-relaxed">
                데이터 기반 판매 전략과 마케팅 지원으로 파트너사의 지속적인 매출 성장을 돕습니다.
              </p>
            </div>
            
            <div className="bg-white rounded-xl md:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.05)] p-5 md:p-6 lg:p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.1)]">
              <div className="w-10 h-10 md:w-[45px] md:h-[45px] lg:w-[50px] lg:h-[50px] rounded-xl bg-[#10B981] flex items-center justify-center text-white">
                <Truck className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <h3 className="mt-5 text-lg md:text-xl lg:text-[22px] font-bold text-[#1F2937]">
                빠른 배송 시스템
              </h3>
              <p className="mt-3 text-sm md:text-base text-[#6B7280] leading-relaxed">
                전국 콜드체인 물류 네트워크를 통해 신선한 과일을 빠르고 안전하게 배송합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          VISION SECTION - Navy 배경
          ============================================ */}
      <section className="bg-[#111827] py-[60px] md:py-[80px] lg:py-[100px]">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* 이미지 */}
            <div className="order-1">
              <div className="rounded-xl md:rounded-2xl overflow-hidden bg-[#1F2937] aspect-[4/3]">
                <img 
                  src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop" 
                  alt="신선한 과일" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            {/* 텍스트 */}
            <div className="order-2 text-center lg:text-left">
              <span className="text-sm font-bold uppercase tracking-wider text-[#22D3EE]">
                OUR VISION
              </span>
              <h2 className="mt-4 text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-white">
                품질과 신뢰를<br />
                최우선으로 생각합니다
              </h2>
              <p className="mt-5 text-sm md:text-base text-white/80 leading-relaxed">
                탑셀러는 단순한 유통 플랫폼이 아닙니다. 농가와 판매자, 소비자를 연결하는 
                신뢰의 다리 역할을 합니다. 우리의 비전은 모든 이해관계자가 함께 성장하는 
                지속 가능한 과일 유통 생태계를 구축하는 것입니다.
              </p>
              <ul className="mt-6 space-y-3 text-white/80 text-sm md:text-base">
                <li className="flex items-center gap-2 justify-center lg:justify-start">
                  <span className="text-[#10B981]">✓</span> 산지 직거래로 신선도 보장
                </li>
                <li className="flex items-center gap-2 justify-center lg:justify-start">
                  <span className="text-[#10B981]">✓</span> 공정한 가격으로 상생 협력
                </li>
                <li className="flex items-center gap-2 justify-center lg:justify-start">
                  <span className="text-[#10B981]">✓</span> 24시간 전문 CS 지원
                </li>
              </ul>
              <a 
                href="/register" 
                className="mt-8 inline-block px-5 md:px-6 lg:px-7 py-3 text-sm md:text-[15px] lg:text-base font-semibold rounded-md bg-white/10 text-white border border-white/50 hover:bg-white/20 hover:border-white transition-all duration-300"
              >
                파트너 등록하기
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          VALUES SECTION - White 배경
          ============================================ */}
      <section className="bg-white py-[60px] md:py-[80px] lg:py-[100px]">
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <div className="text-center mb-12">
            <span className="text-sm font-bold uppercase tracking-wider text-[#5D7AF2]">
              CORE VALUES
            </span>
            <h2 className="mt-4 text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-[#111827]">
              탑셀러의 핵심 가치
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#5D7AF2]/10 flex items-center justify-center">
                <Award className="w-8 h-8 text-[#5D7AF2]" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-bold text-[#1F2937]">품질</h3>
              <p className="mt-2 text-sm text-[#6B7280]">
                최상의 품질만을 선별하여 공급합니다
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#10B981]/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-[#10B981]" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-bold text-[#1F2937]">신뢰</h3>
              <p className="mt-2 text-sm text-[#6B7280]">
                투명한 거래로 신뢰를 쌓아갑니다
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#FF6B00]/10 flex items-center justify-center">
                <Users className="w-8 h-8 text-[#FF6B00]" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-bold text-[#1F2937]">상생</h3>
              <p className="mt-2 text-sm text-[#6B7280]">
                파트너와 함께 성장합니다
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#22D3EE]/10 flex items-center justify-center">
                <Heart className="w-8 h-8 text-[#22D3EE]" />
              </div>
              <h3 className="mt-4 text-lg md:text-xl font-bold text-[#1F2937]">고객중심</h3>
              <p className="mt-2 text-sm text-[#6B7280]">
                고객의 성공이 우리의 성공입니다
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          CTA BANNER - Primary Gradient 배경
          ============================================ */}
      <section 
        className="py-[60px] md:py-[80px] text-center"
        style={{ background: "linear-gradient(135deg, #5D7AF2 0%, #4b63c7 100%)" }}
      >
        <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 lg:px-10">
          <h2 className="text-[24px] sm:text-[28px] md:text-[32px] lg:text-[36px] font-extrabold text-white">
            탑셀러와 함께하세요
          </h2>
          <p className="mt-4 text-sm md:text-base text-white/90">
            지금 파트너로 등록하고 다양한 혜택을 누리세요
          </p>
          <a 
            href="/register" 
            className="mt-8 inline-block px-6 md:px-7 py-3 md:py-4 text-sm md:text-base font-semibold rounded-md bg-white text-[#5D7AF2] hover:shadow-lg transition-all duration-300"
            data-testid="button-cta-register"
          >
            무료로 시작하기
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
