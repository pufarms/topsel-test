import Anthropic from '@anthropic-ai/sdk';

export interface PatternAnalysisResult {
  originalAddress: string;
  correctedAddress: string;
  errorPattern: string;
  problemDescription: string;
  patternRegex: string;
  solution: string;
  buildingType: string;
  confidence: number;
  similarPatterns: string[];
  extractedMemo?: string;
  conversionTemplate?: string;
}

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

export async function analyzeAddressPattern(
  errorAddress: string
): Promise<PatternAnalysisResult | null> {
  
  const client = getAnthropicClient();
  if (!client) {
    console.error('Anthropic API 키 없음');
    return null;
  }

  const prompt = `당신은 한국 배송 주소의 오류 패턴을 분석하고 학습하는 전문가입니다.

**분석할 오류 주소:**
"${errorAddress}"

**분석 목표:**
1. 이 상세주소가 왜 배송 시스템에서 오류로 처리되는지 분석
2. 오류의 근본 원인과 패턴 식별
3. 표준 형식으로 변환 (예: "101동 1001호")
4. 이 패턴과 유사한 오류를 자동 탐지할 정규식 생성
5. 유사한 오류 예시 생성으로 향후 탐지 정확도 향상

**응답 형식 (JSON만):**
\`\`\`json
{
  "originalAddress": "입력된 원본 주소",
  "correctedAddress": "표준화된 정상 주소 (예: 101동 1001호)",
  "errorPattern": "ERROR_PATTERN_CODE",
  "problemDescription": "이 주소가 오류인 이유를 명확하게 설명 (한글)",
  "patternRegex": "이 패턴을 탐지할 정규식",
  "conversionTemplate": "정규식 그룹을 사용한 변환 템플릿 (예: $1동 $2호)",
  "solution": "수정 방법 설명",
  "buildingType": "apartment|villa|officetel|general",
  "confidence": 0.95,
  "similarPatterns": [
    "유사한 오류 주소 예시 5개 이상"
  ],
  "extractedMemo": "배송 메모가 섞여있었다면 분리된 메모 (없으면 null)"
}
\`\`\`

**오류 패턴 코드 (표준화):**
- SPACE_SEPARATED: 공백으로만 구분 (예: "101 1001")
- HYPHEN_SEPARATED: 하이픈 구분 (예: "101-1001", "A-302")
- MEMO_MIXED: 배송 메모 혼입 (예: "101동 1001호 부재시 문앞")
- MISSING_DONG: 동 표기 누락 (예: "1001호")
- MISSING_HO: 호 표기 누락 (예: "101동 1001")
- FLOOR_FORMAT_ERROR: 층 표기 오류 (예: "지하1층" → "지하 1층")
- ALPHABET_UNIT: 영문 동 표기 (예: "A동" → "에이동")
- ABBREVIATED: 축약 표기 (예: "101-1001" → "101동 1001호")
- INVALID_FORMAT: 기타 형식 오류

**정규식 작성 규칙:**
1. 백슬래시는 이중 이스케이프: \\\\d (JSON에서 \\d로 파싱됨)
2. 캡처 그룹 사용: (\\\\d{1,4}) 로 동/호 숫자 캡처
3. 다양한 케이스 매칭: 공백, 하이픈, 메모 등
4. conversionTemplate과 함께 사용: "$1동 $2호"

**유사 패턴 생성 규칙:**
- 같은 오류 유형의 다양한 변형 생성
- 숫자 범위 다양화 (101-1001, 202-502, A-101 등)
- 실제 발생 가능한 오류 패턴 5개 이상 포함

중요: JSON만 출력하세요.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                      responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('JSON 파싱 실패:', responseText);
      return null;
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    console.log('✅ 패턴 분석 완료:', {
      pattern: parsed.errorPattern,
      confidence: parsed.confidence
    });

    return parsed;

  } catch (error: any) {
    console.error('패턴 분석 실패:', error.message);
    return null;
  }
}

export function matchAndConvertByPattern(
  address: string,
  patternRegex: string,
  correctedTemplate: string
): string | null {
  try {
    const regex = new RegExp(patternRegex);
    const match = address.match(regex);
    
    if (!match) return null;
    
    const hasPlaceholders = /\$\d/.test(correctedTemplate);
    
    if (hasPlaceholders) {
      let result = correctedTemplate;
      let substituted = false;
      
      match.forEach((group, idx) => {
        if (idx > 0 && group) {
          const placeholder = `$${idx}`;
          if (result.includes(placeholder)) {
            result = result.replace(placeholder, group);
            substituted = true;
          }
        }
      });
      
      if (!substituted) {
        console.warn('패턴 템플릿에 유효한 치환이 없음:', correctedTemplate);
        return null;
      }
      
      return result;
    } else {
      return correctedTemplate;
    }
    
  } catch (error) {
    console.error('패턴 매칭 실패:', error);
    return null;
  }
}

export interface SimilarPatternMatchResult {
  matched: boolean;
  originalPattern?: string;
  correctedAddress?: string;
  errorPattern?: string;
  confidence: number;
  method: 'similar_pattern' | 'none';
}

export function matchWithSimilarPatterns(
  testAddress: string,
  similarPatterns: string[],
  correctedFormat: string,
  originalPattern: string
): SimilarPatternMatchResult {
  if (!similarPatterns || similarPatterns.length === 0) {
    return { matched: false, confidence: 0, method: 'none' };
  }

  const normalizedTest = testAddress.toLowerCase().replace(/\s+/g, '');
  
  for (const pattern of similarPatterns) {
    const normalizedPattern = pattern.toLowerCase().replace(/\s+/g, '');
    
    if (normalizedTest === normalizedPattern) {
      console.log(`🎯 유사 패턴 완전 일치: "${testAddress}" === "${pattern}"`);
      return {
        matched: true,
        originalPattern: pattern,
        correctedAddress: correctedFormat,
        errorPattern: originalPattern,
        confidence: 0.95,
        method: 'similar_pattern'
      };
    }
    
    const patternStructure = extractAddressStructure(normalizedPattern);
    const testStructure = extractAddressStructure(normalizedTest);
    
    if (patternStructure && testStructure && 
        patternStructure.type === testStructure.type) {
      console.log(`🔍 구조 유사 패턴 매칭: ${patternStructure.type}`);
      
      const structuredCorrect = applyStructureToCorrection(testStructure, correctedFormat);
      if (structuredCorrect) {
        return {
          matched: true,
          originalPattern: pattern,
          correctedAddress: structuredCorrect,
          errorPattern: originalPattern,
          confidence: 0.90,
          method: 'similar_pattern'
        };
      }
    }
  }

  return { matched: false, confidence: 0, method: 'none' };
}

interface AddressStructure {
  type: 'hyphen' | 'space' | 'memo_mixed' | 'unknown';
  parts: string[];
  memo?: string;
}

function extractAddressStructure(address: string): AddressStructure | null {
  const hyphenMatch = address.match(/^(\d+)-(\d+)(.*)$/);
  if (hyphenMatch) {
    return {
      type: 'hyphen',
      parts: [hyphenMatch[1], hyphenMatch[2]],
      memo: hyphenMatch[3] || undefined
    };
  }
  
  const memoPatterns = /(부재시|문앞|경비실|택배함|연락|배송)/;
  if (memoPatterns.test(address)) {
    const parts = address.split(memoPatterns);
    return {
      type: 'memo_mixed',
      parts: parts.filter(p => p && !memoPatterns.test(p)),
      memo: address.match(memoPatterns)?.[0]
    };
  }
  
  const spaceMatch = address.match(/^(\d+)\s+(\d+)$/);
  if (spaceMatch) {
    return {
      type: 'space',
      parts: [spaceMatch[1], spaceMatch[2]]
    };
  }

  return null;
}

function applyStructureToCorrection(structure: AddressStructure, template: string): string | null {
  if (structure.parts.length >= 2) {
    if (template.includes('$1') && template.includes('$2')) {
      return template.replace('$1', structure.parts[0]).replace('$2', structure.parts[1]);
    }
    
    return `${structure.parts[0]}동 ${structure.parts[1]}호`;
  }
  return null;
}
