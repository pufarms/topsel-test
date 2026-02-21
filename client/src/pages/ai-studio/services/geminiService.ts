import { apiRequest } from "@/lib/queryClient";
import type { SectionData } from "../types";
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

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await apiRequest("POST", "/api/ai-studio/validate-key", { apiKey });
    const data = await res.json();
    return data.valid === true;
  } catch {
    return false;
  }
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

export async function generateAllSections(
  product: any,
  imageBase64: string,
  onProgress: (sectionIndex: number, sectionName: string, phase: "copy" | "image") => void
): Promise<SectionData[]> {
  const results: SectionData[] = [];

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
            style: "professional",
            headline: "생성 실패",
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

    if (imageBase64) {
      onProgress(i, section.name, "image");
      try {
        const sectionPrompt = SECTION_IMAGE_PROMPTS[section.id] || "Clean professional studio lighting background";
        const imageSrc = await generateSectionImage(section.id, imageBase64, sectionPrompt);
        sectionData.imageSrc = imageSrc;
      } catch (error: any) {
        console.error(`섹션 ${section.name} 이미지 생성 실패:`, error?.message);
      }
    }

    results.push(sectionData);
  }

  return results;
}
