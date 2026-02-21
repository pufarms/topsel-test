import { Router, type Request, type Response } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
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

async function getUserApiKey(userId: string): Promise<string | null> {
  const [user] = await db.select({
    geminiApiKey: users.geminiApiKey,
  }).from(users).where(eq(users.id, userId));
  if (!user || !user.geminiApiKey) return null;
  return decrypt(user.geminiApiKey);
}

router.get("/api-key", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const [user] = await db.select({
      geminiApiKey: users.geminiApiKey,
      geminiApiKeyUpdatedAt: users.geminiApiKeyUpdatedAt,
    }).from(users).where(eq(users.id, userId));

    if (!user || !user.geminiApiKey) {
      return res.json({ hasKey: false, maskedKey: null, updatedAt: null });
    }

    const decrypted = decrypt(user.geminiApiKey);
    return res.json({
      hasKey: true,
      maskedKey: maskApiKey(decrypted),
      updatedAt: user.geminiApiKeyUpdatedAt,
    });
  } catch (error) {
    console.error("API Key 조회 오류:", error);
    return res.status(500).json({ error: "API Key 조회 중 오류가 발생했습니다" });
  }
});

router.post("/api-key", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
      return res.status(400).json({ error: "API Key를 입력해주세요" });
    }

    const encrypted = encrypt(apiKey.trim());
    await db.update(users)
      .set({
        geminiApiKey: encrypted,
        geminiApiKeyUpdatedAt: new Date(),
      })
      .where(eq(users.id, userId));

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

    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
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
    await db.update(users)
      .set({
        geminiApiKey: null,
        geminiApiKeyUpdatedAt: null,
      })
      .where(eq(users.id, userId));

    return res.json({ success: true, message: "API Key가 삭제되었습니다" });
  } catch (error) {
    console.error("API Key 삭제 오류:", error);
    return res.status(500).json({ error: "API Key 삭제 중 오류가 발생했습니다" });
  }
});

router.post("/generate-section", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) {
      return res.status(400).json({ error: "API Key가 등록되지 않았습니다" });
    }

    const { sectionId, sectionName, sectionDescription, product } = req.body;
    if (!sectionId || !product) {
      return res.status(400).json({ error: "섹션 정보와 제품 정보가 필요합니다" });
    }

    const COPYWRITER_STYLES = [
      { id: "professional", name: "전문가형", description: "신뢰감 있는 전문적 어조" },
      { id: "friendly", name: "친근형", description: "편안하고 친근한 대화체" },
      { id: "luxury", name: "프리미엄형", description: "고급스럽고 감성적인 표현" },
      { id: "impact", name: "임팩트형", description: "강렬하고 직설적인 카피" },
      { id: "story", name: "스토리텔링형", description: "이야기를 풀어내는 서사적 카피" },
    ];

    const prompt = `당신은 한국 B2B 과일 도매 플랫폼의 전문 마케팅 카피라이터입니다.
아래 제품 정보를 바탕으로 상세페이지의 "${sectionName}" 섹션용 마케팅 카피를 작성하세요.

[제품 정보]
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
${product.additionalNotes ? `- 추가 참고: ${product.additionalNotes}` : ""}

[섹션 설명]
${sectionDescription}

5가지 카피라이터 스타일로 각각 카피를 작성해주세요:
${COPYWRITER_STYLES.map(s => `"${s.id}" (${s.name}): ${s.description}`).join("\n")}

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
[
  {
    "style": "professional",
    "headline": "메인 헤드라인 (1줄, 강렬하게)",
    "subheadline": "서브 헤드라인 (1-2줄, 보조 설명)",
    "body": "본문 내용 (3-5줄, 상세 설명)",
    "cta": "행동 유도 문구 (1줄)"
  },
  ... (5개 스타일 모두)
]`;

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        temperature: 0.8,
        maxOutputTokens: 2048,
      },
    });

    const text = response.text || "";
    let copies;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("JSON array not found");
      const parsed = JSON.parse(jsonMatch[0]);
      copies = parsed.map((item: any, idx: number) => ({
        id: `${sectionId}-${item.style || idx}`,
        style: item.style || COPYWRITER_STYLES[idx]?.id || `style-${idx}`,
        headline: item.headline || "",
        subheadline: item.subheadline || "",
        body: item.body || "",
        cta: item.cta || "",
      }));
    } catch {
      copies = COPYWRITER_STYLES.map((s) => ({
        id: `${sectionId}-${s.id}`,
        style: s.id,
        headline: "생성 오류 - 다시 시도해주세요",
        subheadline: "",
        body: text.substring(0, 200),
        cta: "",
      }));
    }

    return res.json({
      id: sectionId,
      name: sectionName,
      description: sectionDescription,
      copies,
      selectedCopyIndex: 0,
      editedCopy: null,
      isGenerated: true,
    });
  } catch (error: any) {
    console.error("AI 생성 오류:", error?.message);
    return res.status(500).json({ error: error?.message || "AI 생성 중 오류가 발생했습니다" });
  }
});

router.post("/generate-image", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session!.userId;
    const apiKey = await getUserApiKey(userId);
    if (!apiKey) {
      return res.status(400).json({ error: "API Key가 등록되지 않았습니다" });
    }

    const { imageBase64, prompt, aspectRatio, sectionId } = req.body;
    if (!imageBase64 || !prompt) {
      return res.status(400).json({ error: "이미지와 프롬프트가 필요합니다" });
    }

    const ai = new GoogleGenAI({ apiKey });

    const fullPrompt = `Keep the product in the foreground exactly as is. Change ONLY the background to: ${prompt}. Professional advertising photography, photorealistic, high quality, 4k. Do NOT modify the product itself. The product must remain sharp and unaltered.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
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
