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

  const prompt = `당신은 한국 주소 오류 패턴 분석 전문가입니다.

**입력된 오류 주소:**
"${errorAddress}"

**작업:**
1. 이 주소가 왜 오류인지 분석하세요
2. 오류 패턴을 식별하세요
3. 정상 주소로 변환하세요
4. 유사한 오류 패턴을 예측하세요
5. 이 패턴을 감지할 정규식을 생성하세요

**응답 형식 (JSON만 출력):**
\`\`\`json
{
  "originalAddress": "원본 주소",
  "correctedAddress": "정상 주소",
  "errorPattern": "오류_패턴_코드",
  "problemDescription": "무엇이 잘못되었는지 한글로 설명",
  "patternRegex": "이 패턴을 감지할 정규식 (이스케이프 처리)",
  "solution": "어떻게 수정했는지 설명",
  "buildingType": "apartment|villa|officetel|general",
  "confidence": 0.95,
  "similarPatterns": [
    "유사한 오류 패턴 예시 3개"
  ],
  "extractedMemo": "메모가 있었다면 추출 (없으면 null)"
}
\`\`\`

**오류 패턴 코드 예시:**
- SPACE_SEPARATED_UNIT_HO: 공백으로만 구분 (예: "101 1001")
- HYPHEN_SEPARATED_UNIT_HO: 하이픈 구분 (예: "A-302")
- MEMO_MIXED: 배송 메모 혼입 (예: "101동 1001호 (부재시 문앞)")
- TYPO_IN_ROAD: 도로명 오타 (예: "테헤란노" → "테헤란로")
- MISSING_UNIT: 동 누락
- MISSING_HO: 호 누락
- FLOOR_SPACE: 층 표기 공백 (예: "지하 1층")
- INVALID_FORMAT: 형식 오류

**정규식 작성 규칙:**
- 백슬래시는 이중 이스케이프: \\\\d (JSON에서 \\d로 파싱됨)
- 그룹 캡처 사용: (\\\\d{1,3})\\\\s+(\\\\d{3,4})
- 테스트 가능한 정규식 생성

중요: JSON만 출력하고 다른 설명은 추가하지 마세요.`;

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
