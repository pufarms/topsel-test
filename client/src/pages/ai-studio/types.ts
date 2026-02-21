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
  imageFile: File | null;
  imageBase64: string;
  aspectRatio: string;
}

export interface TextLayer {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  width?: number;
  align?: "left" | "center" | "right";
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
  imageSrc: string;
  textLayers: TextLayer[];
}

export interface GenerationProgress {
  currentSection: number;
  totalSections: number;
  sectionName: string;
  status: "idle" | "generating" | "done" | "error";
  phase: "copy" | "image";
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
  { id: "donald-miller", name: "Donald Miller", description: "고객이 주인공이 되는 짧은 한 마디. 예: \"당신의 피부, 오늘부터 다시 태어납니다.\"" },
  { id: "david-ogilvy", name: "David Ogilvy", description: "구체적 수치나 팩트로 신뢰를 주는 헤드라인. 예: \"소음은 90% 줄고, 집중은 2배로.\"" },
  { id: "eugene-schwartz", name: "Eugene Schwartz", description: "지금 당장 사야 할 욕구를 자극하는 긴박함. 예: \"지금 놓치면 1년을 기다려야 합니다.\"" },
  { id: "gary-halbert", name: "Gary Halbert", description: "친구에게 말하듯 툭 던지는 도발적인 질문. 예: \"아직도 비싼 돈 내고 배우시나요?\"" },
  { id: "claude-hopkins", name: "Claude Hopkins", description: "\"왜 좋은지\"에 대한 가장 강력한 이유 하나. 예: \"특허받은 공법으로 쓴맛을 잡았습니다.\"" },
] as const;

const IMAGE_PROMPT_PREFIX = "Keep the product in the foreground exactly as is. Change the background to:";
const IMAGE_PROMPT_SUFFIX = "Professional advertising photography, photorealistic, high quality, 4k, spacious composition, clean layout.";

export const SECTION_IMAGE_PROMPTS: Record<string, string> = {
  hero: `${IMAGE_PROMPT_PREFIX} Premium studio lighting, water droplets on surface, fresh morning dew feel, luxury food photography, soft bokeh background. ${IMAGE_PROMPT_SUFFIX}`,
  problem: `${IMAGE_PROMPT_PREFIX} Soft warm-toned kitchen table, natural window light, cozy home atmosphere, slightly blurred background, relatable everyday setting. ${IMAGE_PROMPT_SUFFIX}`,
  "social-proof": `${IMAGE_PROMPT_PREFIX} Clean minimal white/cream background, professional product photography, trust-building composition, subtle gradient. ${IMAGE_PROMPT_SUFFIX}`,
  "taste-quality": `${IMAGE_PROMPT_PREFIX} Close-up macro photography style, juice dripping, vibrant saturated colors, cross-section view feel, appetizing food photography. ${IMAGE_PROMPT_SUFFIX}`,
  composition: `${IMAGE_PROMPT_PREFIX} Flat lay arrangement on clean white surface, all items neatly displayed, product unboxing feel, organized composition. ${IMAGE_PROMPT_SUFFIX}`,
  origin: `${IMAGE_PROMPT_PREFIX} Korean countryside orchard, golden sunlight through fruit trees, rustic wooden crate, harvest season atmosphere, traditional farm scenery. ${IMAGE_PROMPT_SUFFIX}`,
  delivery: `${IMAGE_PROMPT_PREFIX} Clean packaging scene with ice packs, cushioning material, styrofoam box, careful packaging process, fresh delivery concept. ${IMAGE_PROMPT_SUFFIX}`,
  cta: `${IMAGE_PROMPT_PREFIX} Warm golden premium lighting, elegant dark or gradient background, call-to-action mood, urgency and desire, luxury gift feel. ${IMAGE_PROMPT_SUFFIX}`,
};

export const FONTS = [
  { name: "Noto Sans KR", value: "'Noto Sans KR', sans-serif" },
  { name: "Inter", value: "'Inter', sans-serif" },
  { name: "Serif", value: "serif" },
  { name: "Monospace", value: "monospace" },
];

export const COLORS = [
  "#000000", "#FFFFFF", "#FF3B30", "#FF9500", "#FFCC00",
  "#4CD964", "#5AC8FA", "#007AFF", "#5856D6", "#FF2D55",
  "#1F2937", "#4B5563", "#9CA3AF",
];
