import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, ArrowRight, Bot, Layers, Wand2, Upload, ImageIcon, Download, DollarSign, Clock, Shield } from "lucide-react";

interface LandingHeroProps {
  onStart: () => void;
}

function TypingText({ texts, className }: { texts: string[]; className?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentFullText = texts[currentIndex];
    let timeout: NodeJS.Timeout;

    if (!isDeleting && displayText.length < currentFullText.length) {
      timeout = setTimeout(() => setDisplayText(currentFullText.slice(0, displayText.length + 1)), 80);
    } else if (!isDeleting && displayText.length === currentFullText.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && displayText.length > 0) {
      timeout = setTimeout(() => setDisplayText(displayText.slice(0, -1)), 40);
    } else if (isDeleting && displayText.length === 0) {
      setIsDeleting(false);
      setCurrentIndex((prev) => (prev + 1) % texts.length);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentIndex, texts]);

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse text-cyan-400">|</span>
    </span>
  );
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 224, 255, ${p.alpha})`;
        ctx.fill();
      });

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 224, 255, ${0.08 * (1 - dist / 120)})`;
            ctx.stroke();
          }
        }
      }
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

const featureCards = [
  { icon: <Bot className="h-6 w-6" />, title: "AI 카피라이팅", desc: "5명의 AI 카피라이터가 각기 다른 스타일로 작성" },
  { icon: <ImageIcon className="h-6 w-6" />, title: "AI 배경 이미지 합성", desc: "상품 사진을 올리면 섹션별 프로급 배경을 자동 생성" },
  { icon: <Layers className="h-6 w-6" />, title: "8개 섹션 자동 생성", desc: "히어로부터 CTA까지 완벽한 상세페이지 구성" },
  { icon: <Wand2 className="h-6 w-6" />, title: "비주얼 에디터", desc: "이미지 위에 텍스트를 드래그하고 폰트/색상 자유 편집" },
];

const steps = [
  {
    num: "01",
    icon: <Upload className="h-8 w-8" />,
    title: "사진 올리기",
    desc: "과일 상품 사진을 업로드하고\n제품 정보를 입력하세요",
    color: "from-cyan-500 to-blue-500",
  },
  {
    num: "02",
    icon: <Sparkles className="h-8 w-8" />,
    title: "AI가 만들기",
    desc: "8개 섹션의 배경 이미지와\n5가지 스타일 카피를 자동 생성",
    color: "from-violet-500 to-purple-500",
  },
  {
    num: "03",
    icon: <Download className="h-8 w-8" />,
    title: "편집 & 다운로드",
    desc: "캔버스 에디터로 편집 후\nJPG/ZIP으로 바로 다운로드",
    color: "from-emerald-500 to-teal-500",
  },
];

export default function LandingHero({ onStart }: LandingHeroProps) {
  return (
    <div className="relative bg-gradient-to-br from-gray-950 via-gray-900 to-slate-950 overflow-hidden rounded-xl">
      <ParticleField />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,224,255,0.08),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.06),transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center px-6">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] py-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-sm font-medium mb-8 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            <span>Gemini AI Powered</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-center text-white mb-4 tracking-tight leading-tight">
            AI 상세페이지
            <span className="block bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
              자동 생성 마법사
            </span>
          </h1>

          <div className="h-8 md:h-10 mb-8 text-lg md:text-xl text-gray-400 text-center">
            <TypingText
              texts={[
                "사진만 올리면 상세페이지 이미지 완성!",
                "8개 섹션 × 5가지 스타일 카피 자동 생성",
                "AI 배경 합성 + 캔버스 에디터로 편집",
                "ZIP으로 한 번에 다운로드",
              ]}
            />
          </div>

          <p className="text-gray-500 text-center max-w-xl mb-10 text-sm md:text-base leading-relaxed">
            과일 상품 사진을 올리면 Google Gemini AI가
            섹션별 프로급 배경을 합성하고 5가지 스타일의 마케팅 카피를 자동 생성합니다.
            캔버스 에디터에서 텍스트를 자유롭게 편집한 뒤 이미지를 다운로드하세요.
          </p>

          <Button
            onClick={onStart}
            size="lg"
            className="group relative px-8 py-6 text-lg font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_30px_rgba(0,224,255,0.3)] hover:shadow-[0_0_50px_rgba(0,224,255,0.5)] transition-all duration-300"
            data-testid="btn-start-ai-studio"
          >
            <Zap className="h-5 w-5 mr-2" />
            지금 시작하기
            <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 max-w-5xl w-full">
            {featureCards.map((card, i) => (
              <div
                key={i}
                className="relative group p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm hover:border-cyan-500/30 hover:bg-white/10 transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="inline-flex p-3 rounded-lg bg-cyan-500/10 text-cyan-400 mb-4">
                    {card.icon}
                  </div>
                  <h3 className="text-white font-bold mb-2">{card.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-5xl py-20 border-t border-white/10">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">이렇게 사용하세요</h2>
            <p className="text-gray-400">3단계만으로 전문가급 상세페이지 완성</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] border-t border-dashed border-white/15 z-0" />
                )}
                <div className={`relative z-10 inline-flex p-5 rounded-2xl bg-gradient-to-br ${step.color} mb-5 shadow-lg`}>
                  <div className="text-white">{step.icon}</div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white text-gray-900 text-xs font-black flex items-center justify-center shadow">
                    {step.num}
                  </div>
                </div>
                <h3 className="text-white text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-4xl py-16 border-t border-white/10">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">비용 안내</h2>
            <p className="text-gray-400">Google AI Studio에서 무료로 발급받는 API Key를 사용합니다</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
              <DollarSign className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg mb-1">무료 사용 가능</h3>
              <p className="text-gray-400 text-sm">
                Google AI Studio 무료 플랜으로
                <br />
                <span className="text-emerald-400 font-bold">하루 약 62개</span> 이미지 생성 가능
              </p>
            </div>
            <div className="p-6 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-center">
              <Clock className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg mb-1">유료 시 약 500원</h3>
              <p className="text-gray-400 text-sm">
                유료 API Key 사용 시
                <br />
                상세페이지 1세트 약 <span className="text-cyan-400 font-bold">500원</span>
              </p>
            </div>
            <div className="p-6 rounded-xl border border-violet-500/20 bg-violet-500/5 text-center">
              <Shield className="h-8 w-8 text-violet-400 mx-auto mb-3" />
              <h3 className="text-white font-bold text-lg mb-1">안전한 Key 관리</h3>
              <p className="text-gray-400 text-sm">
                API Key는 서버에서 암호화 저장
                <br />
                <span className="text-violet-400 font-bold">본인만</span> 조회/사용 가능
              </p>
            </div>
          </div>
        </div>

        <div className="w-full py-16 border-t border-white/10 mb-8">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 mb-6">
              <Sparkles className="h-10 w-10 text-cyan-400" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              5분이면 전문 디자이너가 만든 것 같은 상세페이지 이미지 8장을 완성할 수 있습니다.
              Google AI API Key만 있으면 바로 사용 가능합니다.
            </p>
            <Button
              onClick={onStart}
              size="lg"
              className="group px-10 py-6 text-lg font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_40px_rgba(0,224,255,0.4)] hover:shadow-[0_0_60px_rgba(0,224,255,0.6)] transition-all duration-300"
              data-testid="btn-start-ai-studio-bottom"
            >
              <Zap className="h-5 w-5 mr-2" />
              무료로 시작하기
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <p className="text-xs text-gray-600 mt-4">Google AI Studio 무료 API Key로 시작 가능</p>
          </div>
        </div>
      </div>
    </div>
  );
}
