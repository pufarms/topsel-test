import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { users, members } from "@shared/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt, maskApiKey } from "./utils/encryption";
import { GoogleGenAI } from "@google/genai";

const router = Router();

function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "인증이 필요합니다" });
  }
  next();
}

function getUserType(req: Request): "user" | "member" {
  return req.session?.userType === "member" ? "member" : "user";
}

async function getApiKeyRecord(userId: string, userType: "user" | "member") {
  if (userType === "member") {
    const [row] = await db.select({
      geminiApiKey: members.geminiApiKey,
      geminiApiKeyUpdatedAt: members.geminiApiKeyUpdatedAt,
    }).from(members).where(eq(members.id, userId));
    return row || null;
  }
  const [row] = await db.select({
    geminiApiKey: users.geminiApiKey,
    geminiApiKeyUpdatedAt: users.geminiApiKeyUpdatedAt,
  }).from(users).where(eq(users.id, userId));
  return row || null;
}

async function saveApiKey(userId: string, userType: "user" | "member", encrypted: string) {
  const table = userType === "member" ? members : users;
  await db.update(table)
    .set({ geminiApiKey: encrypted, geminiApiKeyUpdatedAt: new Date() } as any)
    .where(eq(table.id, userId));
}

async function deleteApiKeyFromDb(userId: string, userType: "user" | "member") {
  const table = userType === "member" ? members : users;
  await db.update(table)
    .set({ geminiApiKey: null, geminiApiKeyUpdatedAt: null } as any)
    .where(eq(table.id, userId));
}

async function getUserApiKey(userId: string, userType: "user" | "member"): Promise<string | null> {
  const row = await getApiKeyRecord(userId, userType);
  if (!row || !row.geminiApiKey) return null;
  return decrypt(row.geminiApiKey);
}

const SECTION_COPY_GUIDES: Record<string, { purpose: string; tone: string; forbidden: string; mustInclude: string; mainExample: string; subExample: string; hasSubCopy: boolean }> = {
  hero: {
    purpose: "3초 안에 스크롤을 멈추게 하는 강렬한 첫인상",
    tone: "감탄사, 짧고 강렬한 Hook",
    forbidden: "설명적 문장, 기능 나열",
    mustInclude: "감정을 즉시 자극하는 한 마디",
    mainExample: "이 사과, 한 입에 반합니다",
    subExample: "",
    hasSubCopy: false,
  },
  problem: {
    purpose: "고객의 과일 구매 실패 경험에 공감하여 '맞아!' 반응 유도",
    tone: "공감, 질문, 아쉬움",
    forbidden: "제품 자랑, 긍정적 표현",
    mustInclude: "구매 실패 상황 언급 (맛없는 과일, 실망, 속음)",
    mainExample: "또 맛없는 과일에 속으셨나요?",
    subExample: "마트에서 예뻐 보여 골랐는데 집에 오면 실망, 한두 번이 아니시죠?",
    hasSubCopy: true,
  },
  "social-proof": {
    purpose: "이 과일이 이미 많은 사람에게 검증되었다는 신뢰 구축",
    tone: "자신감, 팩트, 숫자",
    forbidden: "감성적 표현, 추상적 표현",
    mustInclude: "구체적 숫자 (판매량, 재주문율, 리뷰 수, 별점 등)",
    mainExample: "재주문율 87%, 이유가 있습니다",
    subExample: "지난 시즌 판매 2만 박스, 고객 별점 4.9점의 검증된 맛",
    hasSubCopy: true,
  },
  "taste-quality": {
    purpose: "이 과일의 맛이 왜 특별한지 구체적으로 설득",
    tone: "감각적(시각, 미각, 촉각), 구체적",
    forbidden: "추상적 '맛있다', 일반적 표현",
    mustInclude: "당도, 식감, 과즙 등 구체적 맛 표현",
    mainExample: "한 입 베어물면, 과즙이 터집니다",
    subExample: "당도 16.5Brix, 아삭한 식감에 새콤달콤 과즙이 입안 가득",
    hasSubCopy: true,
  },
  composition: {
    purpose: "구매 시 정확히 무엇을 받는지 명확하게 안내",
    tone: "명확, 정리, 안심",
    forbidden: "감성적 표현, 과장",
    mustInclude: "수량, 중량, 사이즈, 포장 방식",
    mainExample: "받으실 구성을 확인하세요",
    subExample: "3kg / 특대 9~11과 / 개별 완충 포장 / 선물용 박스",
    hasSubCopy: true,
  },
  origin: {
    purpose: "산지와 생산자에 대한 감성적 신뢰와 연결",
    tone: "따뜻함, 정성, 전통, 스토리텔링",
    forbidden: "차가운 팩트 나열, 광고 느낌",
    mustInclude: "산지명, 생산자 경력, 재배 철학",
    mainExample: "30년 명인의 과수원에서 왔습니다",
    subExample: "충주 수안보의 김영동 농부, 매년 첫 수확 과일만 엄선합니다",
    hasSubCopy: true,
  },
  delivery: {
    purpose: "신선식품 배송에 대한 걱정을 해소하고 안심시킴",
    tone: "안심, 꼼꼼함, 신뢰",
    forbidden: "제품 맛 설명, 구매 압박",
    mustInclude: "배송 방법, 포장 상태, 보관법",
    mainExample: "수확 후 24시간, 신선하게 도착합니다",
    subExample: "아이스팩 + 완충재 + 냉장 배송, 문 앞까지 신선함 그대로",
    hasSubCopy: true,
  },
  cta: {
    purpose: "마지막 구매 결정을 이끌어내는 행동 촉구",
    tone: "긴박감, 혜택 강조, 행동 유도",
    forbidden: "정보 전달, 설명",
    mustInclude: "한정 혜택, 지금 사야 하는 이유",
    mainExample: "지금이 아니면 1년을 기다려야 합니다",
    subExample: "올해 첫 수확 한정 물량, 3박스 이상 주문 시 10% 즉시 할인",
    hasSubCopy: true,
  },
};

const COPYWRITER_STYLES = [
  { id: "donald-miller", name: "Donald Miller" },
  { id: "david-ogilvy", name: "David Ogilvy" },
  { id: "eugene-schwartz", name: "Eugene Schwartz" },
  { id: "gary-halbert", name: "Gary Halbert" },
  { id: "claude-hopkins", name: "Claude Hopkins" },
];

function buildCopyPrompt(sectionId: string, sectionName: string, product: any): string {
  const guide = SECTION_COPY_GUIDES[sectionId];
  if (!guide) {
    return buildFallbackPrompt(sectionName, product);
  }

  const productBlock = `[제품 정보]
- 상품명: ${product.productName}
- 원산지: ${product.origin}
- 품종: ${product.variety || "미지정"}
- 등급: ${product.grade || "미지정"}
- 중량/규격: ${product.weight || "미지정"}
- 포장단위: ${product.packUnit || "미지정"}
- 당도: ${product.sweetness || "미지정"}
- 보관방법: ${product.storageMethod || "미지정"}
- 유통기한: ${product.shelfLife || "미지정"}
- 타깃 고객: ${product.targetCustomer || "미지정"}
- 셀링포인트: ${product.sellingPoints}
- 인증: ${product.certifications || "없음"}
- 배송정보: ${product.deliveryInfo || "미지정"}
- 가격대: ${product.priceRange || "미지정"}
${product.additionalNotes ? `- 추가 참고: ${product.additionalNotes}` : ""}`;

  const subCopyInstruction = guide.hasSubCopy
    ? `또한 "subCopy" 필드에 40~60자 분량의 서브카피(설명문)도 작성하세요.
서브카피 방향: ${guide.subExample ? `예시 — "${guide.subExample}"` : "메인 카피를 보충하는 구체적 설명"}`
    : `이 섹션은 서브카피 없이 메인 카피만 작성합니다. "subCopy" 필드는 빈 문자열("")로 두세요.`;

  const jsonFormat = `[
  {
    "style": "donald-miller",
    "headline": "메인 카피 (공백포함 25자 이내)",
    "subCopy": "${guide.hasSubCopy ? "서브카피 설명문 (40~60자)" : ""}",
    "subheadline": "",
    "body": "",
    "cta": ""
  }
]`;

  return `당신은 한국 과일 상세페이지 전문 마케팅 카피라이터입니다.

${productBlock}

━━━━━━━━━━━━━━━━━━━━━━━━
[섹션: ${sectionName}]
━━━━━━━━━━━━━━━━━━━━━━━━
■ 목적: ${guide.purpose}
■ 톤/분위기: ${guide.tone}
■ 절대 금지: ${guide.forbidden}
■ 반드시 포함: ${guide.mustInclude}
■ 메인 카피 예시 방향: "${guide.mainExample}"

${subCopyInstruction}

아래 5명의 카피라이터 페르소나로 각각 카피를 작성하세요:

1) Donald Miller (id: "donald-miller") — 고객이 주인공이 되는 짧은 한 마디
2) David Ogilvy (id: "david-ogilvy") — 구체적 수치나 팩트로 신뢰를 주는 헤드라인
3) Eugene Schwartz (id: "eugene-schwartz") — 지금 당장 사야 할 욕구를 자극하는 긴박함
4) Gary Halbert (id: "gary-halbert") — 친구에게 말하듯 툭 던지는 도발적 질문
5) Claude Hopkins (id: "claude-hopkins") — "왜 좋은지"에 대한 가장 강력한 이유 하나

[필수 제약]
- headline은 공백 포함 25자 이내
- 이 섹션의 목적/톤/금지사항을 정확히 반영
- 각 카피라이터의 고유 접근법을 반영

반드시 아래 JSON 배열로만 응답하세요 (다른 텍스트 없이):
${jsonFormat}
(5명 카피라이터 모두 포함, 총 5개 객체)`;
}

function buildFallbackPrompt(sectionName: string, product: any): string {
  return `당신은 한국 과일 상세페이지 전문 카피라이터입니다.
"${sectionName}" 섹션의 마케팅 카피를 5개 스타일로 작성하세요.
상품: ${product.productName} (${product.origin})
셀링포인트: ${product.sellingPoints}

5명 카피라이터 (donald-miller, david-ogilvy, eugene-schwartz, gary-halbert, claude-hopkins)로 각각 작성.
headline은 25자 이내. JSON 배열로만 응답:
[{"style":"donald-miller","headline":"...","subCopy":"...","subheadline":"","body":"","cta":""},...]`;
}

function extractJsonArray(text: string): any[] | null {
  const patterns = [
    /```json\s*([\s\S]*?)```/,
    /```\s*([\s\S]*?)```/,
    /(\[[\s\S]*\])/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const cleaned = match[1].trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* try next */ }
    }
  }
  try {
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
}

router.get("/api-key", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const userType = getUserType(req);
    const row = await getApiKeyRecord(userId, userType);

    if (!row || !row.geminiApiKey) {
      return res.json({ hasKey: false, maskedKey: null, updatedAt: null });
    }

    const decrypted = decrypt(row.geminiApiKey);
    return res.json({
      hasKey: true,
      maskedKey: maskApiKey(decrypted),
      updatedAt: row.geminiApiKeyUpdatedAt,
    });
  } catch (error) {
    console.error("API Key 조회 오류:", error);
    return res.status(500).json({ error: "API Key 조회 중 오류가 발생했습니다" });
  }
});

router.post("/api-key", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const userType = getUserType(req);
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return res.status(400).json({ error: "API Key를 입력해주세요" });
    }

    const encrypted = encrypt(apiKey.trim());
    await saveApiKey(userId, userType, encrypted);

    return res.json({
      success: true,
      maskedKey: maskApiKey(apiKey.trim()),
      message: "API Key가 안전하게 저장되었습니다",
    });
  } catch (error) {
    console.error("API Key 저장 오류:", error);
    return res.status(500).json({ error: "API Key 저장 중 오류가 발생했습니다" });
  }
});

router.post("/validate-key", requireAuth, async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ valid: false, error: "API Key를 입력해주세요" });
    }

    const trimmedKey = apiKey.trim();
    const ai = new GoogleGenAI({ apiKey: trimmedKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Say 'OK' in one word.",
    });
    const valid = !!response.text;
    return res.json({ valid });
  } catch (error: any) {
    return res.json({ valid: false, error: error?.message || "검증 실패" });
  }
});

router.delete("/api-key", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const userType = getUserType(req);
    await deleteApiKeyFromDb(userId, userType);
    return res.json({ success: true, message: "API Key가 삭제되었습니다" });
  } catch (error) {
    console.error("API Key 삭제 오류:", error);
    return res.status(500).json({ error: "API Key 삭제 중 오류가 발생했습니다" });
  }
});

router.post("/art-direction", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const userType = getUserType(req);
    const apiKey = await getUserApiKey(userId, userType);
    if (!apiKey) {
      return res.status(400).json({ error: "API Key가 등록되지 않았습니다" });
    }
    const { product } = req.body;
    if (!product) {
      return res.status(400).json({ error: "제품 정보가 필요합니다" });
    }

    const prompt = `당신은 과일 상세페이지 전문 아트 디렉터입니다.
이 상품의 상세페이지 이미지 8장 세트를 만들 예정입니다.
8장이 하나의 상세페이지로서 통일감 있게 보이도록 전체 비주얼 기조를 설계해주세요.

상품 정보:
- 과일: ${product.productName}
- 산지: ${product.origin}
- 특징: ${product.sellingPoints}
- 품종: ${product.variety || "미지정"}
- 당도: ${product.sweetness || "미지정"}

아래 항목을 JSON으로 응답해주세요 (다른 텍스트 없이):
{
  "colorTone": "전체 색감 톤 (영어로, 예: warm golden with soft green accents)",
  "lightingStyle": "조명 스타일 (영어로, 예: natural warm sunlight, golden hour)",
  "mood": "전체 분위기 (영어로, 예: premium yet approachable countryside freshness)",
  "productPlacement": "상품 배치 기조 (영어로, 예: product centered, 40-60% of frame)",
  "commonElements": "공통 소품/질감 (영어로, 예: wooden texture, morning dew, linen)",
  "backgroundBase": "기본 배경 방향 (영어로, 예: soft cream/beige natural tones)"
}

주의사항:
- 과일의 색감과 어울리는 톤 선택
- 산지의 느낌 반영 (한국 시골, 과수원, 자연)
- 8장 전체가 한 세트로 느껴지는 통일감이 핵심
- 모든 값은 영어로 작성 (이미지 생성 프롬프트에 사용됨)`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { temperature: 0.7, maxOutputTokens: 1024 },
    });

    const text = response.text || "";
    let artDirection;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("JSON not found");
      artDirection = JSON.parse(jsonMatch[0]);
    } catch {
      artDirection = {
        colorTone: "warm natural tones with product-complementary accents",
        lightingStyle: "soft natural daylight, clean studio feel",
        mood: "premium yet approachable, clean and fresh",
        productPlacement: "product centered, occupying 40-50% of frame",
        commonElements: "clean white/cream surface, subtle shadows",
        backgroundBase: "soft gradient from white to light warm gray",
      };
    }

    return res.json({ artDirection });
  } catch (error: any) {
    console.error("아트 디렉션 생성 오류:", error?.message);
    return res.json({
      artDirection: {
        colorTone: "warm natural tones with product-complementary accents",
        lightingStyle: "soft natural daylight, clean studio feel",
        mood: "premium yet approachable, clean and fresh",
        productPlacement: "product centered, occupying 40-50% of frame",
        commonElements: "clean white/cream surface, subtle shadows",
        backgroundBase: "soft gradient from white to light warm gray",
      },
    });
  }
});

router.post("/generate-section", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const userType = getUserType(req);
    const apiKey = await getUserApiKey(userId, userType);
    if (!apiKey) {
      return res.status(400).json({ error: "API Key가 등록되지 않았습니다" });
    }

    const { sectionId, sectionName, sectionDescription, product } = req.body;
    if (!sectionId || !product) {
      return res.status(400).json({ error: "섹션 정보와 제품 정보가 필요합니다" });
    }

    const prompt = buildCopyPrompt(sectionId, sectionName, product);
    const ai = new GoogleGenAI({ apiKey });

    let copies: any[] | null = null;
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            temperature: attempt === 0 ? 0.8 : 0.5,
            maxOutputTokens: 2048,
          },
        });

        const text = response.text || "";
        const parsed = extractJsonArray(text);
        if (parsed && parsed.length >= 3) {
          copies = parsed;
          break;
        }
        lastError = `응답 파싱 실패 (attempt ${attempt + 1}): ${text.substring(0, 100)}`;
      } catch (err: any) {
        lastError = err?.message || "Unknown error";
        if (err?.message?.includes("429") || err?.message?.includes("quota")) {
          break;
        }
      }
    }

    const guide = SECTION_COPY_GUIDES[sectionId];
    let formattedCopies;

    if (copies) {
      formattedCopies = copies.map((item: any, idx: number) => ({
        id: `${sectionId}-${item.style || COPYWRITER_STYLES[idx]?.id || idx}`,
        style: item.style || COPYWRITER_STYLES[idx]?.id || `style-${idx}`,
        headline: item.headline || item.mainCopy || "",
        subCopy: guide?.hasSubCopy ? (item.subCopy || item.sub_copy || "") : "",
        subheadline: item.subheadline || "",
        body: item.body || "",
        cta: item.cta || "",
      }));
    } else {
      formattedCopies = COPYWRITER_STYLES.map((s) => ({
        id: `${sectionId}-${s.id}`,
        style: s.id,
        headline: "생성 오류 - 다시 시도해주세요",
        subCopy: "",
        subheadline: lastError.substring(0, 100),
        body: "",
        cta: "",
      }));
    }

    return res.json({
      id: sectionId,
      name: sectionName,
      description: sectionDescription,
      copies: formattedCopies,
      selectedCopyIndex: 0,
      editedCopy: null,
      isGenerated: !!copies,
    });
  } catch (error: any) {
    console.error("AI 생성 오류:", error?.message);
    return res.status(500).json({ error: error?.message || "AI 생성 중 오류가 발생했습니다" });
  }
});

router.post("/generate-image", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const userType = getUserType(req);
    const apiKey = await getUserApiKey(userId, userType);
    if (!apiKey) {
      return res.status(400).json({ error: "API Key가 등록되지 않았습니다" });
    }

    const { imageBase64, prompt, aspectRatio, sectionId } = req.body;
    if (!imageBase64 || !prompt) {
      return res.status(400).json({ error: "이미지와 프롬프트가 필요합니다" });
    }

    const ai = new GoogleGenAI({ apiKey });

    const ratioHint = aspectRatio ? ` Output image aspect ratio should be ${aspectRatio}.` : "";
    const fullPrompt = `${prompt} Do NOT modify the product itself. The product must remain sharp and unaltered.${ratioHint}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBase64,
            },
          },
          {
            text: fullPrompt,
          },
        ],
      },
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      } as any,
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if ((part as any).inlineData) {
        const inlineData = (part as any).inlineData;
        return res.json({
          sectionId,
          imageSrc: `data:${inlineData.mimeType};base64,${inlineData.data}`,
        });
      }
    }

    throw new Error("Gemini에서 이미지를 생성하지 못했습니다");
  } catch (error: any) {
    console.error("이미지 생성 오류:", error?.message);
    if (error?.message?.includes("429") || error?.message?.includes("quota")) {
      return res.status(429).json({
        error: "API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
    return res.status(500).json({
      error: error?.message || "이미지 생성 중 오류가 발생했습니다",
    });
  }
});

export default router;
