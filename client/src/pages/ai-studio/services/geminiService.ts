import { apiRequest } from "@/lib/queryClient";
import type { SectionData } from "../types";
import { SECTION_DEFINITIONS } from "../types";

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
  };
}

export async function generateAllSections(
  product: any,
  onProgress: (sectionIndex: number, sectionName: string) => void
): Promise<SectionData[]> {
  const results: SectionData[] = [];

  for (let i = 0; i < SECTION_DEFINITIONS.length; i++) {
    const section = SECTION_DEFINITIONS[i];
    onProgress(i, section.name);

    try {
      const sectionData = await generateSection(section, product);
      results.push(sectionData);
    } catch (error: any) {
      results.push({
        id: section.id,
        name: section.name,
        icon: section.icon,
        description: section.description,
        copies: [
          { id: `${section.id}-error`, style: "professional", headline: "생성 실패", subheadline: error?.message || "알 수 없는 오류", body: "", cta: "" },
        ],
        selectedCopyIndex: 0,
        editedCopy: null,
        isGenerated: false,
      });
    }
  }

  return results;
}
