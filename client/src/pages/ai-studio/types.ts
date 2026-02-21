export type AppStep = "landing" | "api-key" | "input" | "generating" | "editor" | "preview";

export interface ProductInfo {
  productName: string;
  origin: string;
  variety: string;
  grade: string;
  weight: string;
  packUnit: string;
  sweetness: string;
  storageMethod: string;
  shelfLife: string;
  targetCustomer: string;
  sellingPoints: string;
  certifications: string;
  deliveryInfo: string;
  priceRange: string;
  additionalNotes: string;
  images: string[];
}

export interface CopyVariant {
  id: string;
  style: string;
  headline: string;
  subheadline: string;
  body: string;
  cta: string;
}

export interface SectionData {
  id: string;
  name: string;
  icon: string;
  description: string;
  copies: CopyVariant[];
  selectedCopyIndex: number;
  editedCopy: CopyVariant | null;
  isGenerated: boolean;
}

export interface GenerationProgress {
  currentSection: number;
  totalSections: number;
  sectionName: string;
  status: "idle" | "generating" | "done" | "error";
  errorMessage?: string;
}

export const SECTION_DEFINITIONS = [
  { id: "hero", name: "히어로 메인", icon: "🎯", description: "첫인상을 결정짓는 강렬한 메인 배너 카피" },
  { id: "problem", name: "문제공감", icon: "💡", description: "고객의 고민과 니즈에 공감하는 스토리텔링" },
  { id: "social-proof", name: "사회적 증거", icon: "⭐", description: "구매자 리뷰, 판매량, 수상 등 신뢰 요소" },
  { id: "taste-quality", name: "맛/품질 강조", icon: "🍊", description: "당도, 식감, 신선도 등 품질 포인트 어필" },
  { id: "composition", name: "구성/스펙", icon: "📦", description: "용량, 수량, 등급 등 상품 상세 스펙" },
  { id: "origin", name: "산지 스토리", icon: "🌿", description: "재배 환경, 농장 이야기, 산지 직송 강조" },
  { id: "delivery", name: "배송/보관", icon: "🚚", description: "신선 배송, 포장 방법, 보관법 안내" },
  { id: "cta", name: "구매 유도 CTA", icon: "🛒", description: "할인, 한정 수량, 긴급성 등 구매 전환 유도" },
] as const;

export const COPYWRITER_STYLES = [
  { id: "professional", name: "전문가형", description: "신뢰감 있는 전문적 어조" },
  { id: "friendly", name: "친근형", description: "편안하고 친근한 대화체" },
  { id: "luxury", name: "프리미엄형", description: "고급스럽고 감성적인 표현" },
  { id: "impact", name: "임팩트형", description: "강렬하고 직설적인 카피" },
  { id: "story", name: "스토리텔링형", description: "이야기를 풀어내는 서사적 카피" },
] as const;
