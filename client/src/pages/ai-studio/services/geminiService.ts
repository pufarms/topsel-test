import { apiRequest } from "@/lib/queryClient";
import type { SectionData, ArtDirection } from "../types";
import { SECTION_DEFINITIONS, SECTION_IMAGE_PROMPTS } from "../types";

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const MAX_DIMENSION = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          resolve(dataUrl.split(",")[1]);
        } else {
          reject(new Error("Canvas context failed"));
        }
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (error) => reject(error);
  });
}

export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; authError?: boolean; error?: string }> {
  try {
    const res = await fetch("/api/ai-studio/validate-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
      credentials: "include",
    });
    if (res.status === 401) {
      return { valid: false, authError: true, error: "인증이 만료되었습니다. 다시 로그인해주세요." };
    }
    const data = await res.json();
    if (data.valid === true) {
      return { valid: true };
    }
    return { valid: false, error: data.error || "유효하지 않은 API Key입니다." };
  } catch {
    return { valid: false, error: "네트워크 오류가 발생했습니다. 다시 시도해주세요." };
  }
}

export async function generateArtDirection(product: any): Promise<ArtDirection> {
  const res = await apiRequest("POST", "/api/ai-studio/art-direction", { product });
  if (!res.ok) {
    throw new Error("아트 디렉션 생성 실패");
  }
  const data = await res.json();
  return data.artDirection;
}

function buildImagePromptWithArtDirection(sectionId: string, artDirection: ArtDirection | null): string {
  const basePrompt = SECTION_IMAGE_PROMPTS[sectionId] || "Clean professional studio lighting background";
  if (!artDirection) return basePrompt;

  const artDirectionBlock = `Maintain visual consistency: Color tone: ${artDirection.colorTone}. Lighting: ${artDirection.lightingStyle}. Mood: ${artDirection.mood}. Common elements: ${artDirection.commonElements}. Background base: ${artDirection.backgroundBase}.`;

  return `${basePrompt} ${artDirectionBlock}`;
}

export async function generateSection(
  section: typeof SECTION_DEFINITIONS[number],
  product: any
): Promise<SectionData> {
  const res = await apiRequest("POST", "/api/ai-studio/generate-section", {
    sectionId: section.id,
    sectionName: section.name,
    sectionDescription: section.description,
    product,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "생성 실패" }));
    throw new Error(err.error || "AI 생성 중 오류가 발생했습니다");
  }

  const data = await res.json();
  return {
    ...data,
    icon: section.icon,
    imageSrc: "",
    textLayers: [],
  };
}

export async function generateSectionImage(
  sectionId: string,
  imageBase64: string,
  prompt: string,
  aspectRatio: string = "3:4"
): Promise<string> {
  const res = await apiRequest("POST", "/api/ai-studio/generate-image", {
    sectionId,
    imageBase64,
    prompt,
    aspectRatio,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "이미지 생성 실패" }));
    throw new Error(err.error || "이미지 생성 중 오류가 발생했습니다");
  }

  const data = await res.json();
  return data.imageSrc;
}

function getSectionImageBase64(product: any, sectionId: string): string {
  const base64s: string[] = product.imageBase64s || [];
  const sectionMap: Record<string, number> = product.sectionImageMap || {};

  if (base64s.length === 0) return product.imageBase64 || "";

  const assignedIdx = sectionMap[sectionId];
  if (assignedIdx !== undefined && assignedIdx < base64s.length) {
    return base64s[assignedIdx];
  }

  return base64s[0];
}

export async function generateAllSections(
  product: any,
  imageBase64: string,
  onProgress: (sectionIndex: number, sectionName: string, phase: "art-direction" | "copy" | "image") => void,
  aspectRatio: string = "3:4"
): Promise<SectionData[]> {
  const results: SectionData[] = [];

  onProgress(0, "비주얼 기조 설계", "art-direction");
  let artDirection: ArtDirection | null = null;
  try {
    artDirection = await generateArtDirection(product);
  } catch (error: any) {
    console.error("아트 디렉션 생성 실패:", error?.message);
  }

  for (let i = 0; i < SECTION_DEFINITIONS.length; i++) {
    const section = SECTION_DEFINITIONS[i];

    onProgress(i, section.name, "copy");
    let sectionData: SectionData;
    try {
      sectionData = await generateSection(section, product);
    } catch (error: any) {
      sectionData = {
        id: section.id,
        name: section.name,
        icon: section.icon,
        description: section.description,
        copies: [
          {
            id: `${section.id}-error`,
            style: "donald-miller",
            headline: "생성 실패",
            subCopy: "",
            subheadline: error?.message || "알 수 없는 오류",
            body: "",
            cta: "",
          },
        ],
        selectedCopyIndex: 0,
        editedCopy: null,
        isGenerated: false,
        imageSrc: "",
        textLayers: [],
      };
    }

    const sectionImageBase64 = getSectionImageBase64(product, section.id);
    if (sectionImageBase64) {
      onProgress(i, section.name, "image");
      try {
        const sectionPrompt = buildImagePromptWithArtDirection(section.id, artDirection);
        const imageSrc = await generateSectionImage(section.id, sectionImageBase64, sectionPrompt, aspectRatio);
        sectionData.imageSrc = imageSrc;
      } catch (error: any) {
        console.error(`섹션 ${section.name} 이미지 생성 실패:`, error?.message);
      }
    }

    results.push(sectionData);
  }

  return results;
}
