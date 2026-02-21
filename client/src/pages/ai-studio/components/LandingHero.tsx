import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, ArrowRight, Bot, Layers, Wand2 } from "lucide-react";

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
  { icon: <Layers className="h-6 w-6" />, title: "8개 섹션 자동 생성", desc: "히어로부터 CTA까지 완벽한 상세페이지 구성" },
  { icon: <Wand2 className="h-6 w-6" />, title: "실시간 편집", desc: "생성된 카피를 자유롭게 수정하고 다운로드" },
];

export default function LandingHero({ onStart }: LandingHeroProps) {
  return (
    <div className="relative min-h-[calc(100vh-120px)] bg-gradient-to-br from-gray-950 via-gray-900 to-slate-950 overflow-hidden rounded-xl">
      <ParticleField />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,224,255,0.08),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.06),transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-120px)] px-6 py-16">
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
              "과일 상품 정보만 입력하면 끝!",
              "8개 섹션, 5가지 스타일 자동 생성",
              "클릭 한 번으로 상세페이지 완성",
              "AI가 만드는 프리미엄 마케팅 카피",
            ]}
          />
        </div>

        <p className="text-gray-500 text-center max-w-xl mb-10 text-sm md:text-base leading-relaxed">
          Google Gemini AI가 과일 상품에 최적화된 마케팅 카피를 자동으로 생성합니다.
          전문 카피라이터 5명이 각기 다른 스타일로 작성한 것처럼
          다양한 시안 중 최적의 카피를 선택하세요.
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-4xl w-full">
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
    </div>
  );
}
