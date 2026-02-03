import Anthropic from '@anthropic-ai/sdk';

export interface AIEnhancementResult {
  normalized: string;
  confidence: number;
  reasoning: string;
  hasError: boolean;
  suggestedCorrection?: string;
}

type BuildingType = 'apartment' | 'villa' | 'officetel' | 'general';

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ ANTHROPIC_API_KEY가 설정되지 않았습니다.');
    return null;
  }
  
  return new Anthropic({
    apiKey: apiKey,
  });
}

export function isAIEnabled(): boolean {
  const enabled = process.env.ENABLE_AI_ADDRESS_NORMALIZATION === 'true';
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  return enabled && hasKey;
}

export async function normalizeDetailAddressWithAI(
  rawDetailAddress: string,
  buildingType: BuildingType,
  buildingName?: string
): Promise<AIEnhancementResult> {
  
  if (!isAIEnabled()) {
    return {
      normalized: rawDetailAddress,
      confidence: 0.5,
      reasoning: 'AI 기능이 비활성화되어 있습니다.',
      hasError: false
    };
  }

  const client = getAnthropicClient();
  if (!client) {
    return {
      normalized: rawDetailAddress,
      confidence: 0.5,
      reasoning: 'Anthropic API 키가 설정되지 않았습니다.',
      hasError: true
    };
  }

  try {
    const prompt = buildAIPrompt(rawDetailAddress, buildingType, buildingName);
    
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';
    
    const result = parseAIResponse(responseText);
    
    console.log('✅ AI 정규화 성공:', {
      input: rawDetailAddress,
      output: result.normalized,
      confidence: result.confidence
    });
    
    return result;

  } catch (error: any) {
    console.error('❌ AI 정규화 실패:', error.message);
    return {
      normalized: rawDetailAddress,
      confidence: 0.3,
      reasoning: `AI 호출 실패: ${error.message}`,
      hasError: true
    };
  }
}

function buildAIPrompt(
  rawDetailAddress: string,
  buildingType: BuildingType,
  buildingName?: string
): string {
  
  const buildingTypeKo = {
    apartment: '아파트',
    villa: '빌라',
    officetel: '오피스텔',
    general: '일반 건물'
  }[buildingType];

  return `당신은 한국 주소 정규화 전문가입니다.

**입력 정보:**
- 원본 상세주소: "${rawDetailAddress}"
- 건물 유형: ${buildingTypeKo}
${buildingName ? `- 건물명: ${buildingName}` : ''}

**작업 요청:**
1. 상세주소를 표준 형식으로 정규화하세요.
2. 다음 패턴을 적용하세요:
   - "101 1001" → "101동 1001호"
   - "A-302" → "A동 302호"
   - "지하 1층" → "지하1층"
   - "101동 1001호 (부재시 문앞)" → "101동 1001호" (메모 제거)
   - "테헤란노" → "테헤란로" (오타 교정)

3. ${buildingTypeKo === '아파트' ? '아파트는 반드시 "동+호" 형식이어야 합니다.' : ''}

**응답 형식 (JSON만 출력):**
\`\`\`json
{
  "normalized": "정규화된 주소",
  "confidence": 0.95,
  "reasoning": "판단 근거",
  "hasError": false,
  "suggestedCorrection": "추가 제안사항 (선택)"
}
\`\`\`

**제약사항:**
- JSON 형식만 출력하세요.
- 불필요한 설명을 추가하지 마세요.
- confidence는 0.0~1.0 사이 값입니다.`;
}

function parseAIResponse(responseText: string): AIEnhancementResult {
  try {
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                      responseText.match(/\{[\s\S]*\}/);
    
    const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : responseText;
    const parsed = JSON.parse(jsonText);
    
    return {
      normalized: parsed.normalized || '',
      confidence: parsed.confidence || 0.7,
      reasoning: parsed.reasoning || 'AI 응답 파싱 완료',
      hasError: parsed.hasError || false,
      suggestedCorrection: parsed.suggestedCorrection
    };
    
  } catch (error) {
    console.error('JSON 파싱 실패:', responseText);
    return {
      normalized: '',
      confidence: 0.3,
      reasoning: 'AI 응답 파싱 실패',
      hasError: true
    };
  }
}

export async function correctAddressTypo(
  address: string
): Promise<{ corrected: string; confidence: number }> {
  
  if (!isAIEnabled()) {
    return { corrected: address, confidence: 0.5 };
  }

  const client = getAnthropicClient();
  if (!client) {
    return { corrected: address, confidence: 0.5 };
  }

  try {
    const prompt = `다음 주소의 오타를 교정하세요:
"${address}"

일반적인 오타 예시:
- "테헤란노" → "테헤란로"
- "강남데로" → "강남대로"

JSON 형식으로 응답:
\`\`\`json
{
  "corrected": "교정된 주소",
  "confidence": 0.95
}
\`\`\``;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        corrected: parsed.corrected || address,
        confidence: parsed.confidence || 0.7
      };
    }

    return { corrected: address, confidence: 0.5 };

  } catch (error) {
    console.error('오타 교정 실패:', error);
    return { corrected: address, confidence: 0.3 };
  }
}
