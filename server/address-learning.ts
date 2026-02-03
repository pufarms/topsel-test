import { db } from './db';
import { addressLearningData } from '@shared/schema';
import { eq, and, gte, desc, isNotNull, sql } from 'drizzle-orm';
import { PatternAnalysisResult } from './ai-pattern-analyzer';
import { compareTwoStrings } from 'string-similarity';

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
          ? Math.min(1.0, parseFloat(String(existingData.confidenceScore)) + 0.05)
          : parseFloat(String(existingData.confidenceScore));
      
      await db
        .update(addressLearningData)
        .set({
          correctedDetailAddress,
          correctionType,
          confidenceScore: String(newConfidence),
          occurrenceCount: (existingData.occurrenceCount || 0) + 1,
          updatedAt: new Date(),
          lastUsedAt: new Date(),
        })
        .where(eq(addressLearningData.id, existingData.id));
      
      console.log(`📚 학습 데이터 업데이트: "${originalDetailAddress}" (${existingData.occurrenceCount}회 → ${(existingData.occurrenceCount || 0) + 1}회)`);
    } else {
      await db
        .insert(addressLearningData)
        .values({
          originalDetailAddress,
          correctedDetailAddress,
          buildingType,
          correctionType,
          confidenceScore: '0.80',
          occurrenceCount: 1,
          successCount: 0,
          userConfirmed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      
      console.log(`📚 새 학습 데이터 저장: "${originalDetailAddress}" → "${correctedDetailAddress}"`);
    }
  } catch (error) {
    console.error('학습 데이터 저장 실패:', error);
    throw error;
  }
}

export async function savePatternAnalysis(
  analysis: PatternAnalysisResult
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(addressLearningData)
      .where(
        eq(addressLearningData.originalDetailAddress, analysis.originalAddress)
      )
      .limit(1);
    
    if (existing.length > 0) {
      await db
        .update(addressLearningData)
        .set({
          errorPattern: analysis.errorPattern,
          problemDescription: analysis.problemDescription,
          patternRegex: analysis.patternRegex,
          solutionDescription: analysis.solution,
          similarPatterns: JSON.stringify(analysis.similarPatterns),
          extractedMemo: analysis.extractedMemo,
          analyzedAt: new Date(),
          aiModel: 'claude-sonnet-4',
          updatedAt: new Date(),
        })
        .where(eq(addressLearningData.id, existing[0].id));
    } else {
      await db
        .insert(addressLearningData)
        .values({
          originalDetailAddress: analysis.originalAddress,
          correctedDetailAddress: analysis.correctedAddress,
          buildingType: analysis.buildingType,
          correctionType: analysis.errorPattern,
          confidenceScore: String(analysis.confidence),
          occurrenceCount: 1,
          successCount: 0,
          userConfirmed: false,
          errorPattern: analysis.errorPattern,
          problemDescription: analysis.problemDescription,
          patternRegex: analysis.patternRegex,
          solutionDescription: analysis.solution,
          similarPatterns: JSON.stringify(analysis.similarPatterns),
          extractedMemo: analysis.extractedMemo,
          analyzedAt: new Date(),
          aiModel: 'claude-sonnet-4',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }
    
    console.log(`✅ 패턴 분석 저장 완료: ${analysis.errorPattern}`);
  } catch (error) {
    console.error('패턴 분석 저장 실패:', error);
    throw error;
  }
}

export interface LearnedPatternResult {
  found: boolean;
  corrected?: string;
  confidence?: number;
  occurrenceCount?: number;
}

export async function findLearnedPattern(
  originalDetailAddress: string,
  buildingType: string,
  similarityThreshold: number = 0.85
): Promise<LearnedPatternResult> {
  try {
    const exactMatch = await db
      .select()
      .from(addressLearningData)
      .where(
        and(
          eq(addressLearningData.originalDetailAddress, originalDetailAddress),
          eq(addressLearningData.buildingType, buildingType),
          gte(addressLearningData.confidenceScore, '0.7')
        )
      )
      .limit(1);
    
    if (exactMatch.length > 0) {
      const match = exactMatch[0];
      
      await db
        .update(addressLearningData)
        .set({ lastUsedAt: new Date() })
        .where(eq(addressLearningData.id, match.id));
      
      return {
        found: true,
        corrected: match.correctedDetailAddress,
        confidence: parseFloat(String(match.confidenceScore)),
        occurrenceCount: match.occurrenceCount || 0
      };
    }
    
    const candidates = await db
      .select()
      .from(addressLearningData)
      .where(
        and(
          eq(addressLearningData.buildingType, buildingType),
          gte(addressLearningData.confidenceScore, '0.7'),
          gte(addressLearningData.occurrenceCount, 2)
        )
      )
      .orderBy(desc(addressLearningData.occurrenceCount))
      .limit(50);
    
    for (const candidate of candidates) {
      const similarity = compareTwoStrings(
        originalDetailAddress.toLowerCase(),
        candidate.originalDetailAddress.toLowerCase()
      );
      
      if (similarity >= similarityThreshold) {
        console.log(`🔍 유사 패턴 발견: "${originalDetailAddress}" ≈ "${candidate.originalDetailAddress}" (${(similarity * 100).toFixed(1)}%)`);
        
        await db
          .update(addressLearningData)
          .set({ lastUsedAt: new Date() })
          .where(eq(addressLearningData.id, candidate.id));
        
        return {
          found: true,
          corrected: candidate.correctedDetailAddress,
          confidence: similarity * parseFloat(String(candidate.confidenceScore)),
          occurrenceCount: candidate.occurrenceCount || 0
        };
      }
    }
    
    return { found: false };
  } catch (error) {
    console.error('학습 패턴 검색 실패:', error);
    return { found: false };
  }
}

export interface PatternMatchResult {
  patternRegex: string;
  correctedDetailAddress: string;
  errorPattern?: string;
  confidence: number;
}

export async function findByPattern(
  detailAddress: string,
  buildingType: string
): Promise<PatternMatchResult | null> {
  try {
    const patterns = await db
      .select()
      .from(addressLearningData)
      .where(
        and(
          isNotNull(addressLearningData.patternRegex),
          eq(addressLearningData.buildingType, buildingType),
          gte(addressLearningData.confidenceScore, '0.8')
        )
      )
      .orderBy(desc(addressLearningData.occurrenceCount))
      .limit(100);
    
    for (const pattern of patterns) {
      if (!pattern.patternRegex) continue;
      
      try {
        const regex = new RegExp(pattern.patternRegex);
        if (regex.test(detailAddress)) {
          console.log(`🎯 정규식 패턴 매칭: ${pattern.errorPattern}`);
          return {
            patternRegex: pattern.patternRegex,
            correctedDetailAddress: pattern.correctedDetailAddress,
            errorPattern: pattern.errorPattern || undefined,
            confidence: parseFloat(String(pattern.confidenceScore))
          };
        }
      } catch (regexError) {
        console.warn(`정규식 오류 (ID: ${pattern.id}):`, regexError);
      }
    }
    
    return null;
  } catch (error) {
    console.error('패턴 검색 실패:', error);
    return null;
  }
}

export function inferCorrectionType(
  original: string,
  corrected: string
): string {
  if (original === corrected) return 'no_change';
  
  const hasMemoPattern = /(부재시|문앞|경비실|택배함|연락주세요|공동현관)/;
  if (hasMemoPattern.test(original) && !hasMemoPattern.test(corrected)) {
    return 'memo_separation';
  }
  
  const hyphenPattern = /^(\d+)\s*-\s*(\d+)$/;
  if (hyphenPattern.test(original.trim()) && /동.*호/.test(corrected)) {
    return 'hyphen_to_unit';
  }
  
  const spacePattern = /^(\d+)\s+(\d+)$/;
  if (spacePattern.test(original.trim()) && /동.*호/.test(corrected)) {
    return 'space_to_unit';
  }
  
  if (!/동/.test(original) && /동/.test(corrected)) {
    return 'missing_dong';
  }
  if (!/호/.test(original) && /호/.test(corrected)) {
    return 'missing_ho';
  }
  
  if (/지하\s*\d/.test(original) && /지하\d/.test(corrected)) {
    return 'floor_space_fix';
  }
  
  return 'general_normalization';
}

export async function incrementSuccessCount(
  originalDetailAddress: string
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(addressLearningData)
      .where(eq(addressLearningData.originalDetailAddress, originalDetailAddress))
      .limit(1);
    
    if (existing.length > 0) {
      const current = existing[0];
      const newSuccessCount = (current.successCount || 0) + 1;
      const newConfidence = Math.min(
        1.0,
        parseFloat(String(current.confidenceScore)) + 0.02
      );
      
      await db
        .update(addressLearningData)
        .set({
          successCount: newSuccessCount,
          confidenceScore: String(newConfidence),
          updatedAt: new Date(),
        })
        .where(eq(addressLearningData.id, current.id));
    }
  } catch (error) {
    console.error('성공 카운트 증가 실패:', error);
  }
}
