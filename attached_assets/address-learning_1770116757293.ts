import { db } from './db';
import { addressLearningData } from '@shared/schema';
import { eq, and, gte, desc, isNotNull, sql } from 'drizzle-orm';
import { PatternAnalysisResult } from './ai-pattern-analyzer';
import { compareTwoStrings } from 'string-similarity';

/**
 * 사용자가 주소를 수정했을 때 학습 데이터로 저장
 * 
 * @param originalDetailAddress - 원본 상세주소
 * @param correctedDetailAddress - 수정된 상세주소
 * @param buildingType - 건물 유형
 * @param correctionType - 수정 유형
 * @returns 저장 성공 여부
 */
export async function saveAddressCorrection(
  originalDetailAddress: string,
  correctedDetailAddress: string,
  buildingType: string,
  correctionType: string
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(addressLearningData)
      .where(
        and(
          eq(addressLearningData.originalDetailAddress, originalDetailAddress),
          eq(addressLearningData.buildingType, buildingType)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      const existingData = existing[0];
      
      const newConfidence = 
        existingData.correctedDetailAddress === correctedDetailAddress
          ? Math.min(Number(existingData.confidenceScore) + 0.05, 1.0)
          : Number(existingData.confidenceScore) * 0.8;
      
      await db
        .update(addressLearningData)
        .set({
          occurrenceCount: existingData.occurrenceCount + 1,
          confidenceScore: newConfidence.toFixed(2),
          updatedAt: new Date(),
          correctedDetailAddress: correctedDetailAddress
        })
        .where(eq(addressLearningData.id, existingData.id));
      
      console.log('[학습] 기존 패턴 업데이트:', {
        original: originalDetailAddress,
        corrected: correctedDetailAddress,
        occurrenceCount: existingData.occurrenceCount + 1,
        confidence: newConfidence.toFixed(2)
      });
      
    } else {
      await db.insert(addressLearningData).values({
        originalDetailAddress,
        correctedDetailAddress,
        buildingType,
        correctionType,
        confidenceScore: '0.70',
        occurrenceCount: 1,
        successCount: 0,
        userConfirmed: false
      });
      
      console.log('[학습] 새 패턴 저장:', {
        original: originalDetailAddress,
        corrected: correctedDetailAddress,
        type: buildingType
      });
    }
    
  } catch (error) {
    console.error('[학습] 저장 실패:', error);
    throw error;
  }
}

/**
 * 문자열 유사도 기반으로 비슷한 패턴 찾기
 * 
 * @param detailAddress - 검색할 상세주소
 * @param buildingType - 건물 유형
 * @returns 유사한 패턴 정보 또는 null
 */
async function findSimilarPattern(
  detailAddress: string,
  buildingType: string
): Promise<{
  found: boolean;
  corrected: string;
  confidence: number;
  occurrenceCount: number;
} | null> {
  
  try {
    const allPatterns = await db
      .select()
      .from(addressLearningData)
      .where(
        and(
          eq(addressLearningData.buildingType, buildingType),
          gte(addressLearningData.confidenceScore, '0.80')
        )
      )
      .orderBy(desc(addressLearningData.occurrenceCount))
      .limit(100);
    
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const pattern of allPatterns) {
      const similarity = compareTwoStrings(
        detailAddress.toLowerCase(),
        pattern.originalDetailAddress.toLowerCase()
      );
      
      if (similarity > bestSimilarity && similarity >= 0.85) {
        bestSimilarity = similarity;
        bestMatch = pattern;
      }
    }
    
    if (bestMatch && bestSimilarity >= 0.85) {
      return {
        found: true,
        corrected: bestMatch.correctedDetailAddress,
        confidence: bestSimilarity,
        occurrenceCount: bestMatch.occurrenceCount
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('[학습] 유사 패턴 검색 실패:', error);
    return null;
  }
}

/**
 * 학습된 데이터에서 정확히 일치하는 패턴 찾기
 * 
 * @param detailAddress - 검색할 상세주소
 * @param buildingType - 건물 유형
 * @returns 발견된 패턴 정보 또는 null
 */
export async function findLearnedPattern(
  detailAddress: string,
  buildingType: string
): Promise<{
  found: boolean;
  corrected?: string;
  confidence?: number;
  occurrenceCount?: number;
} | null> {
  
  try {
    const exactMatch = await db
      .select()
      .from(addressLearningData)
      .where(
        and(
          eq(addressLearningData.originalDetailAddress, detailAddress),
          eq(addressLearningData.buildingType, buildingType),
          gte(addressLearningData.confidenceScore, '0.80'),
          gte(addressLearningData.occurrenceCount, 3)
        )
      )
      .orderBy(desc(addressLearningData.occurrenceCount))
      .limit(1);
    
    if (exactMatch.length > 0) {
      const match = exactMatch[0];
      
      await db
        .update(addressLearningData)
        .set({
          lastUsedAt: new Date(),
          successCount: match.successCount + 1
        })
        .where(eq(addressLearningData.id, match.id));
      
      console.log('[학습] 정확 매칭 발견:', {
        original: detailAddress,
        corrected: match.correctedDetailAddress,
        confidence: match.confidenceScore,
        occurrenceCount: match.occurrenceCount
      });
      
      return {
        found: true,
        corrected: match.correctedDetailAddress,
        confidence: Number(match.confidenceScore),
        occurrenceCount: match.occurrenceCount
      };
    }
    
    const similarPattern = await findSimilarPattern(detailAddress, buildingType);
    
    if (similarPattern) {
      console.log('[학습] 유사 패턴 발견:', similarPattern);
      return similarPattern;
    }
    
    console.log('[학습] 패턴 없음:', detailAddress);
    return null;
    
  } catch (error) {
    console.error('[학습] 검색 실패:', error);
    return null;
  }
}

/**
 * 원본과 수정된 주소를 비교하여 수정 유형 자동 추론
 * 
 * @param original - 원본 상세주소
 * @param corrected - 수정된 상세주소
 * @returns 수정 유형 문자열
 */
export function inferCorrectionType(original: string, corrected: string): string {
  if (original.includes('(') || original.includes(')') || 
      original.includes('부재시') || original.includes('경비실') || 
      original.includes('문앞') || original.includes('택배함')) {
    return 'memo_separation';
  }
  
  if (/^\d+\s+\d+$/.test(original.trim())) {
    return 'missing_unit_separator';
  }
  
  if (/^[A-Z가-힣]-?\d+$/.test(original.trim())) {
    return 'hyphen_to_unit';
  }
  
  if (original.includes('층') || original.includes('F') || original.includes('B')) {
    return 'floor_normalization';
  }
  
  return 'unknown';
}

/**
 * 사용자가 직접 수정한 경우 신뢰도를 높게 설정
 * 
 * @param originalDetailAddress - 원본 상세주소
 * @param buildingType - 건물 유형
 */
export async function markUserConfirmed(
  originalDetailAddress: string,
  buildingType: string
): Promise<void> {
  try {
    await db
      .update(addressLearningData)
      .set({
        userConfirmed: true,
        confidenceScore: '0.95',
        updatedAt: new Date()
      })
      .where(
        and(
          eq(addressLearningData.originalDetailAddress, originalDetailAddress),
          eq(addressLearningData.buildingType, buildingType)
        )
      );
    
    console.log('[학습] 사용자 확인 업데이트:', originalDetailAddress);
    
  } catch (error) {
    console.error('[학습] 사용자 확인 업데이트 실패:', error);
  }
}

/**
 * AI 패턴 분석 결과 저장
 */
export async function savePatternAnalysis(
  analysis: PatternAnalysisResult
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(addressLearningData)
      .where(eq(addressLearningData.originalDetailAddress, analysis.originalAddress))
      .limit(1);
    
    if (existing.length > 0) {
      await db
        .update(addressLearningData)
        .set({
          correctedDetailAddress: analysis.correctedAddress,
          errorPattern: analysis.errorPattern,
          problemDescription: analysis.problemDescription,
          patternRegex: analysis.patternRegex,
          solutionDescription: analysis.solution,
          similarPatterns: JSON.stringify(analysis.similarPatterns),
          extractedMemo: analysis.extractedMemo || null,
          analyzedAt: new Date(),
          aiModel: 'claude-sonnet-4-5-20250514',
          confidenceScore: String(analysis.confidence),
          occurrenceCount: existing[0].occurrenceCount + 1,
          updatedAt: new Date()
        })
        .where(eq(addressLearningData.id, existing[0].id));
      
      console.log('✅ 패턴 분석 업데이트:', analysis.errorPattern);
    } else {
      await db.insert(addressLearningData).values({
        originalAddress: null,
        originalDetailAddress: analysis.originalAddress,
        correctedDetailAddress: analysis.correctedAddress,
        buildingType: analysis.buildingType,
        correctionType: analysis.errorPattern,
        confidenceScore: String(analysis.confidence),
        occurrenceCount: 1,
        successCount: 0,
        userConfirmed: true,
        errorPattern: analysis.errorPattern,
        problemDescription: analysis.problemDescription,
        patternRegex: analysis.patternRegex,
        solutionDescription: analysis.solution,
        similarPatterns: JSON.stringify(analysis.similarPatterns),
        extractedMemo: analysis.extractedMemo || null,
        analyzedAt: new Date(),
        aiModel: 'claude-sonnet-4-5-20250514'
      });
      
      console.log('✅ 패턴 분석 저장 완료:', analysis.errorPattern);
    }
    
  } catch (error) {
    console.error('패턴 저장 실패:', error);
    throw error;
  }
}

/**
 * 정규식 패턴 기반 주소 검색
 */
export async function findByPattern(
  address: string,
  buildingType?: string
): Promise<{
  id: number;
  errorPattern: string | null;
  patternRegex: string | null;
  correctedDetailAddress: string;
  confidenceScore: string;
  buildingType: string | null;
} | null> {
  try {
    const minConfidence = 0.7;
    
    let query = db
      .select()
      .from(addressLearningData)
      .where(
        and(
          isNotNull(addressLearningData.patternRegex),
          gte(addressLearningData.confidenceScore, String(minConfidence))
        )
      )
      .orderBy(desc(addressLearningData.confidenceScore), desc(addressLearningData.occurrenceCount));
    
    const patterns = await query;
    
    for (const pattern of patterns) {
      try {
        if (!pattern.patternRegex) continue;
        
        if (buildingType && pattern.buildingType && pattern.buildingType !== buildingType) {
          continue;
        }
        
        const regex = new RegExp(pattern.patternRegex);
        if (regex.test(address)) {
          console.log(`📚 패턴 매칭: ${pattern.errorPattern} (신뢰도: ${pattern.confidenceScore})`);
          return {
            id: pattern.id,
            errorPattern: pattern.errorPattern,
            patternRegex: pattern.patternRegex,
            correctedDetailAddress: pattern.correctedDetailAddress,
            confidenceScore: pattern.confidenceScore,
            buildingType: pattern.buildingType
          };
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('패턴 검색 실패:', error);
    return null;
  }
}
