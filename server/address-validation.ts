import { Router, Request, Response } from "express";
import multer from "multer";
import { 
  normalizeDetailAddressWithAI, 
  isAIEnabled,
  type AIEnhancementResult 
} from './ai-address-enhancer';
import {
  saveAddressCorrection,
  findLearnedPattern,
  inferCorrectionType,
  findByPattern,
  savePatternAnalysis
} from './address-learning';
import { analyzeAddressPattern, matchAndConvertByPattern } from './ai-pattern-analyzer';
import { db } from './db';
import { addressLearningData } from '@shared/schema';
import { eq, desc, ilike, or, sql } from 'drizzle-orm';

const excelUpload = multer({ storage: multer.memoryStorage() });

const router = Router();

const JUSO_API_KEY = process.env.JUSO_API_KEY;
const JUSO_API_ENDPOINT = "https://www.juso.go.kr/addrlink/addrLinkApi.do";

export type AddressStatus = "valid" | "warning" | "invalid";

export interface AddressValidationResult {
  rowIndex: number;
  originalAddress: string;
  status: AddressStatus;
  standardAddress?: string;
  detailAddress?: string;
  normalizedDetailAddress?: string;
  fullAddress?: string;
  zipCode?: string;
  buildingName?: string;
  warningMessage?: string;
  errorMessage?: string;
  reasonCode?: string;
  isIslandRemote?: boolean;
  isLengthExceeded?: boolean;
  originalPhone?: string;
  formattedPhone?: string;
  phoneModified?: boolean;
}

export interface ValidateAddressesRequest {
  addresses: Array<{
    rowIndex: number;
    address: string;
    phone?: string;
  }>;
}

export interface ValidateAddressesResponse {
  success: boolean;
  results: AddressValidationResult[];
  validCount: number;
  warningCount: number;
  invalidCount: number;
  islandRemoteCount: number;
  lengthExceededCount: number;
}

interface JusoItem {
  roadAddrPart1: string;
  roadAddrPart2: string;
  jibunAddr: string;
  zipNo: string;
  bdNm: string;
  bdKdcd: string;
  siNm: string;
  sggNm: string;
  emdNm: string;
  rn: string;
  buldMnnm: string;
  buldSlno: string;
}

interface JusoAPIResponse {
  results: {
    common: {
      totalCount: string;
      errorCode: string;
      errorMessage: string;
    };
    juso: JusoItem[] | null;
  };
}

const FORBIDDEN_WORDS = [
  "미정", "몰라", "unknown", "모름", "나중에",
  "추후", "확인요", "테스트", "test",
  "ㅇㅇ", "ㅁㅁ", "ㄴㄴ", "asdf", "qwer", "zxcv"
];

const EXPLICIT_NO_DETAIL_PATTERNS = [
  /상세\s*주소\s*없음/i,
  /상세\s*주소\s*없어요/i,
  /상세주소\s*없음/i,
];

const FORBIDDEN_PATTERNS = [
  /^[xX]+$/,
  /^0{3,}$/,
  /^1{4,}$/,
  /^-{3,}$/,
  /^\.{3,}$/,
];

const ISLAND_REMOTE_REGIONS = ["제주", "울릉", "신안", "완도", "진도", "흑산도", "백령도", "연평도"];
const MAX_ADDRESS_LENGTH = 50;

const STRICT_APT_KEYWORDS = ["아파트", "APT", "공동주택", "연립", "다세대"];
const RELAXED_APT_KEYWORDS = ["빌라", "주상복합", "오피스텔", "타운하우스", "타워", "맨션", "팰리스", "빌딩", "레지던스", "하이츠"];
const ALL_APT_KEYWORDS = [...STRICT_APT_KEYWORDS, ...RELAXED_APT_KEYWORDS];

const REPLACE_MAP: Record<string, string> = {
  "·": " ",
  ",": " ",
  "/": " ",
  ".": " ",
  ";": " ",
  ":": " ",
};

const REGION_ABBREVIATIONS: Record<string, string> = {
  "서울": "서울특별시",
  "부산": "부산광역시",
  "대구": "대구광역시",
  "인천": "인천광역시",
  "광주": "광주광역시",
  "대전": "대전광역시",
  "울산": "울산광역시",
  "세종": "세종특별자치시",
  "경기": "경기도",
  "강원": "강원특별자치도",
  "충북": "충청북도",
  "충남": "충청남도",
  "전북": "전북특별자치도",
  "전남": "전라남도",
  "경북": "경상북도",
  "경남": "경상남도",
  "제주": "제주특별자치도",
};

function isIslandRemoteArea(address: string): boolean {
  return ISLAND_REMOTE_REGIONS.some(region => address.includes(region));
}

function isAddressLengthExceeded(fullAddress: string): boolean {
  return fullAddress.length > MAX_ADDRESS_LENGTH;
}

function formatPhoneNumber(phone: string): { formatted: string; modified: boolean } {
  if (!phone) {
    return { formatted: "", modified: false };
  }
  
  const digitsOnly = phone.replace(/\D/g, "");
  
  if (digitsOnly.length === 11) {
    if (digitsOnly.startsWith("010") || digitsOnly.startsWith("070") || 
        digitsOnly.startsWith("050") || digitsOnly.startsWith("080")) {
      const formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 7)}-${digitsOnly.slice(7)}`;
      const modified = formatted !== phone;
      return { formatted, modified };
    }
  }
  
  if (digitsOnly.length === 10) {
    if (digitsOnly.startsWith("02")) {
      const formatted = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 6)}-${digitsOnly.slice(6)}`;
      const modified = formatted !== phone;
      return { formatted, modified };
    } else {
      const formatted = `${digitsOnly.slice(0, 3)}-${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
      const modified = formatted !== phone;
      return { formatted, modified };
    }
  }
  
  if (digitsOnly.length === 9 && digitsOnly.startsWith("02")) {
    const formatted = `${digitsOnly.slice(0, 2)}-${digitsOnly.slice(2, 5)}-${digitsOnly.slice(5)}`;
    const modified = formatted !== phone;
    return { formatted, modified };
  }
  
  if (digitsOnly.length === 8) {
    if (digitsOnly.startsWith("15") || digitsOnly.startsWith("16") ||
        digitsOnly.startsWith("18")) {
      const formatted = `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4)}`;
      const modified = formatted !== phone;
      return { formatted, modified };
    }
  }
  
  return { formatted: phone, modified: false };
}

function normalizeAddress(rawAddress: string): string {
  let normalized = rawAddress.trim();
  
  normalized = normalized.replace(/\s+/g, " ");
  
  for (const [from, to] of Object.entries(REPLACE_MAP)) {
    normalized = normalized.split(from).join(to);
  }
  
  normalized = normalized.replace(/\s*-\s*/g, "-");
  
  normalized = normalized.replace(/\(구:?[^)]*\)/g, "");
  normalized = normalized.replace(/\(옛[^)]*\)/g, "");
  normalized = normalized.replace(/\(旧[^)]*\)/g, "");
  
  normalized = normalized.replace(/\s+/g, " ").trim();
  
  return normalized;
}

function expandRegionAbbreviation(address: string): string {
  const tokens = address.split(" ");
  if (tokens.length > 0) {
    const firstToken = tokens[0];
    if (REGION_ABBREVIATIONS[firstToken]) {
      tokens[0] = REGION_ABBREVIATIONS[firstToken];
      return tokens.join(" ");
    }
  }
  return address;
}

function isStrictApartmentBuilding(bdKdcd: string, bdNm: string): boolean {
  if (bdKdcd === "1") {
    return true;
  }
  
  if (bdNm && STRICT_APT_KEYWORDS.some(keyword => bdNm.includes(keyword))) {
    return true;
  }
  
  return false;
}

function isRelaxedApartmentBuilding(bdKdcd: string, bdNm: string): boolean {
  if (isStrictApartmentBuilding(bdKdcd, bdNm)) return false;
  
  if (!bdNm) return false;
  
  if (RELAXED_APT_KEYWORDS.some(keyword => bdNm.includes(keyword))) return true;
  
  if (bdNm.endsWith("빌")) return true;
  
  return false;
}

function isApartmentBuilding(bdKdcd: string, bdNm: string): boolean {
  return isStrictApartmentBuilding(bdKdcd, bdNm) || isRelaxedApartmentBuilding(bdKdcd, bdNm);
}

function matchPatternA(str: string): boolean {
  const normalized = str.replace(/\s+/g, "");
  return /[가-힣a-zA-Z0-9]+동\s*[0-9]+(호|실)?/.test(normalized) &&
         /[0-9]+(호|실)?/.test(normalized);
}

function matchPatternB(str: string): boolean {
  return /[0-9]+\s*-\s*[0-9]+/.test(str);
}

function matchPatternC(str: string): boolean {
  return /(지하|B|b)?\s*[0-9]+(호|층|F|f)/i.test(str) ||
         /[0-9]+\s*(호|층)/i.test(str);
}

function hasDongPattern(str: string): boolean {
  const normalized = str.replace(/\s+/g, "");
  return /[가-힣a-zA-Z]{1,2}동/.test(normalized) ||
         /[0-9]{1,4}동/.test(normalized) ||
         matchPatternB(str);
}

function hasHoPattern(str: string): boolean {
  return /[0-9]+\s*(호|ho)/i.test(str) || 
         matchPatternB(str);
}

function hasFloorOrHoPattern(str: string): boolean {
  return /[0-9]+\s*(호|ho|층|f)/i.test(str) || 
         matchPatternB(str);
}

function normalizeDetailAddress(detail: string): string {
  let normalized = detail.trim();
  
  const pureHyphenPattern = /^(\d+)\s*-\s*(\d+)$/;
  const pureHyphenMatch = normalized.match(pureHyphenPattern);
  if (pureHyphenMatch) {
    return `${pureHyphenMatch[1]}동 ${pureHyphenMatch[2]}호`;
  }
  
  const embeddedHyphenPattern = /(\d+)\s*-\s*(\d+)(?![가-힣a-zA-Z0-9])/;
  if (embeddedHyphenPattern.test(normalized) && !/동/.test(normalized)) {
    normalized = normalized.replace(embeddedHyphenPattern, "$1동 $2호");
  }
  
  const dongWithoutHo = /(\d{1,4})동\s*(\d{1,5})$/;
  if (dongWithoutHo.test(normalized)) {
    normalized = normalized.replace(dongWithoutHo, "$1동 $2호");
  }
  
  const alphaKorDongWithoutHo = /([A-Za-z가-힣]{1,2})동\s*(\d{1,5})$/;
  if (alphaKorDongWithoutHo.test(normalized)) {
    normalized = normalized.replace(alphaKorDongWithoutHo, "$1동 $2호");
  }
  
  if (/B(\d+)층/i.test(normalized)) {
  } else if (/B(\d+)/i.test(normalized)) {
    normalized = normalized.replace(/B(\d+)/i, "지하 $1층");
  }
  
  if (/지하\s*(\d+)층/.test(normalized)) {
  } else if (/지하\s*(\d+)(?!층)/.test(normalized)) {
    normalized = normalized.replace(/지하\s*(\d+)/, "지하 $1층");
  }
  
  if (/(\d+)층/i.test(normalized)) {
  } else if (/(\d+)\s*F/i.test(normalized)) {
    normalized = normalized.replace(/(\d+)\s*F/i, "$1층");
  }
  
  return normalized;
}

interface DetailAddressValidation {
  isValid: boolean;
  warningMessage?: string;
  reasonCode?: string;
  detailAddress?: string;
  status?: AddressStatus;
  aiEnhanced?: boolean;
  aiConfidence?: number;
  aiReasoning?: string;
  ruleBasedConfidence?: number;
  learnedPattern?: boolean;
  patternBased?: boolean;
  patternName?: string;
}

function validateDetailAddressWithRules(detailAddress: string, bdKdcd: string, bdNm: string): DetailAddressValidation {
  const isStrictApt = isStrictApartmentBuilding(bdKdcd, bdNm);
  const isRelaxedApt = isRelaxedApartmentBuilding(bdKdcd, bdNm);
  
  if (!detailAddress || detailAddress.trim() === "") {
    if (isStrictApt) {
      return {
        isValid: false,
        warningMessage: "아파트: 상세주소(동/호)가 누락되었습니다",
        reasonCode: "W_DETAIL_MISSING_UNIT",
      };
    }
    if (isRelaxedApt) {
      return {
        isValid: false,
        warningMessage: "상세주소(호)가 누락되었습니다",
        reasonCode: "W_DETAIL_MISSING_UNIT",
      };
    }
    return { isValid: true };
  }
  
  if (isStrictApt) {
    const hasPatternA = matchPatternA(detailAddress);
    const hasPatternB = matchPatternB(detailAddress);
    
    if (hasPatternA || hasPatternB) {
      return { isValid: true };
    }
    
    const hasDong = hasDongPattern(detailAddress);
    const hasHo = hasHoPattern(detailAddress);
    
    if (hasDong && hasHo) {
      return { isValid: true };
    }
    
    if (hasHo && !hasDong) {
      return { isValid: true };
    }
    
    if (hasDong && !hasHo) {
      return {
        isValid: false,
        warningMessage: "아파트: 호수가 누락된 것으로 보입니다 (예: 202호)",
        reasonCode: "W_DETAIL_MISSING_HO",
      };
    }
    
    return {
      isValid: false,
      warningMessage: "아파트: 동/호수 정보를 확인해주세요",
      reasonCode: "W_DETAIL_MISSING_UNIT",
    };
  }
  
  if (isRelaxedApt) {
    if (matchPatternA(detailAddress) || matchPatternB(detailAddress) || matchPatternC(detailAddress)) {
      return { isValid: true };
    }
    if (hasHoPattern(detailAddress) || hasFloorOrHoPattern(detailAddress)) {
      return { isValid: true };
    }
    if (detailAddress.length >= 2) {
      return { isValid: true };
    }
    return {
      isValid: false,
      warningMessage: "상세주소(호)가 누락되었습니다",
      reasonCode: "W_DETAIL_MISSING_UNIT",
    };
  }
  
  return { isValid: true };
}

function calculateRuleConfidence(result: DetailAddressValidation): number {
  if (result.isValid) {
    return 0.95;
  }
  
  switch (result.reasonCode) {
    case 'W_DETAIL_MISSING_UNIT':
      return 0.6;
    case 'W_DETAIL_MISSING_HO':
      return 0.7;
    case 'W_DETAIL_MIXED_MEMO':
      return 0.5;
    case 'W_DETAIL_SUSPECT_UNIT':
      return 0.6;
    case 'W_BASE_AMBIGUOUS':
      return 0.5;
    default:
      return 0.75;
  }
}

async function validateDetailAddress(
  detailAddress: string,
  bdKdcd: string,
  bdNm: string
): Promise<DetailAddressValidation> {
  
  const isStrictApt = isStrictApartmentBuilding(bdKdcd, bdNm);
  const isRelaxedApt = isRelaxedApartmentBuilding(bdKdcd, bdNm);
  const buildingType: 'apartment' | 'villa' | 'officetel' | 'general' = 
    isStrictApt ? 'apartment' : 
    isRelaxedApt ? 'villa' : 
    'general';
  
  try {
    const patternMatch = await findByPattern(detailAddress, buildingType);
    
    if (patternMatch && patternMatch.patternRegex) {
      console.log(`🎯 패턴 매칭 성공: ${patternMatch.errorPattern}`);
      
      const converted = matchAndConvertByPattern(
        detailAddress,
        patternMatch.patternRegex,
        patternMatch.correctedDetailAddress
      );
      
      if (converted) {
        return {
          isValid: true,
          detailAddress: converted,
          status: 'valid',
          reasonCode: 'OK_STD',
          aiEnhanced: false,
          patternBased: true,
          patternName: patternMatch.errorPattern || undefined,
          ruleBasedConfidence: 1.0
        };
      }
    }
  } catch (error) {
    console.error('[패턴] 정규식 패턴 검색 실패:', error);
  }
  
  try {
    const learnedPattern = await findLearnedPattern(detailAddress, buildingType);
    
    if (learnedPattern && learnedPattern.found && learnedPattern.corrected) {
      console.log(`📚 학습 패턴 발견! (${learnedPattern.occurrenceCount}회)`);
      return {
        isValid: true,
        detailAddress: learnedPattern.corrected,
        status: 'valid',
        reasonCode: 'OK_STD',
        aiEnhanced: false,
        learnedPattern: true,
        ruleBasedConfidence: learnedPattern.confidence || 1.0
      };
    }
  } catch (error) {
    console.error('[학습] 패턴 검색 실패:', error);
  }
  
  const ruleResult = validateDetailAddressWithRules(detailAddress, bdKdcd, bdNm);
  const ruleConfidence = calculateRuleConfidence(ruleResult);
  
  const AI_THRESHOLD = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.9');
  
  if (isAIEnabled() && ruleConfidence < AI_THRESHOLD) {
    try {
      console.log(`🤖 AI 호출 (룰 확신도: ${ruleConfidence.toFixed(2)})`);
      
      const aiResult = await normalizeDetailAddressWithAI(
        detailAddress,
        buildingType,
        bdNm
      );
      
      if (!aiResult.hasError && aiResult.confidence > ruleConfidence) {
        console.log(`✨ AI 결과 적용 (AI 확신도: ${aiResult.confidence.toFixed(2)})`);
        
        try {
          const correctionType = inferCorrectionType(detailAddress, aiResult.normalized);
          await saveAddressCorrection(
            detailAddress,
            aiResult.normalized,
            buildingType,
            correctionType
          );
          console.log('💾 AI 결과 학습 저장 완료');
        } catch (saveError) {
          console.error('학습 저장 실패:', saveError);
        }
        
        return {
          ...ruleResult,
          detailAddress: aiResult.normalized,
          status: aiResult.confidence >= 0.85 ? 'valid' : 'warning',
          isValid: aiResult.confidence >= 0.85,
          aiEnhanced: true,
          aiConfidence: aiResult.confidence,
          aiReasoning: aiResult.reasoning,
          ruleBasedConfidence: ruleConfidence
        };
      }
      
    } catch (error: any) {
      console.error('❌ AI 호출 실패 (룰 기반으로 폴백):', error.message);
    }
  }
  
  return {
    ...ruleResult,
    aiEnhanced: false,
    ruleBasedConfidence: ruleConfidence
  };
}

function hasExplicitNoDetailExpression(str: string): boolean {
  return EXPLICIT_NO_DETAIL_PATTERNS.some(pattern => pattern.test(str));
}

function hasForbiddenWord(str: string, isApartment: boolean): { found: boolean; word?: string } {
  if (hasExplicitNoDetailExpression(str)) {
    if (isApartment) {
      return { found: true, word: "상세주소없음" };
    }
    return { found: false };
  }
  
  const lowerStr = str.toLowerCase().replace(/\s+/g, "");
  
  for (const word of FORBIDDEN_WORDS) {
    if (lowerStr.includes(word.toLowerCase())) {
      return { found: true, word };
    }
  }
  
  const tokens = str.split(/\s+/);
  for (const token of tokens) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(token)) {
        return { found: true, word: token };
      }
    }
  }
  
  return { found: false };
}

function hasInvalidCharacters(str: string): boolean {
  return /[<>|{}\\`~]/.test(str) || /[\x00-\x1F]/.test(str);
}

function hasMixedMemo(str: string): boolean {
  const hasPhone = /01[0-9]-?\d{3,4}-?\d{4}/.test(str);
  const hasMemoKeywords = /(부재시|문앞|경비실|택배함|연락주세요|현관비밀번호|공동현관)/.test(str);
  return hasPhone || hasMemoKeywords;
}

function hasUnrealisticValue(str: string): boolean {
  const hoMatch = str.match(/(\d+)호/);
  if (hoMatch) {
    const hoNum = parseInt(hoMatch[1], 10);
    if (hoNum > 9999 || hoNum === 0) {
      return true;
    }
  }
  
  const dongMatch = str.match(/(\d+)동/);
  if (dongMatch) {
    const dongNum = parseInt(dongMatch[1], 10);
    if (dongNum > 9999 || dongNum === 0) {
      return true;
    }
  }
  
  return false;
}

async function callJusoAPI(keyword: string): Promise<JusoAPIResponse | null> {
  if (!JUSO_API_KEY) {
    console.error("[Address Validation] JUSO_API_KEY is not set");
    return null;
  }

  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const url = `${JUSO_API_ENDPOINT}?confmKey=${JUSO_API_KEY}&currentPage=1&countPerPage=10&resultType=json&keyword=${encodedKeyword}`;
    
    console.log(`[Address Validation] Calling Juso API: "${keyword}"`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[Address Validation] API HTTP error: ${response.status}`);
      return null;
    }

    const data = await response.json() as JusoAPIResponse;
    return data;
  } catch (error) {
    console.error(`[Address Validation] API call failed:`, error);
    return null;
  }
}

function extractDetailAddress(originalTokens: string[], standardAddress: string): string {
  const standardTokens = standardAddress.split(" ").filter(t => t.length > 0);
  
  const buildingNumPattern = /^(\d+)(-\d+)?$/;
  let buildingNumIdx = -1;
  
  for (let i = 0; i < originalTokens.length; i++) {
    if (buildingNumPattern.test(originalTokens[i])) {
      buildingNumIdx = i;
      break;
    }
  }
  
  if (buildingNumIdx >= 0 && buildingNumIdx < originalTokens.length - 1) {
    const detailParts = originalTokens.slice(buildingNumIdx + 1);
    return detailParts.join(" ");
  }
  
  let matchedIdx = -1;
  for (let i = originalTokens.length - 1; i >= 0; i--) {
    const token = originalTokens[i];
    for (const stdToken of standardTokens) {
      if (stdToken.includes(token) || token.includes(stdToken)) {
        matchedIdx = i;
        break;
      }
    }
    if (matchedIdx >= 0) break;
  }
  
  if (matchedIdx >= 0 && matchedIdx < originalTokens.length - 1) {
    const detailParts = originalTokens.slice(matchedIdx + 1);
    return detailParts.join(" ");
  }
  
  return "";
}

/**
 * 주소에서 도로명 주소 패턴만 추출 (시/도 + 구/군/시 + 도로명 + 번호)
 * 예: "부산광역시 사하구 다대로277번길 85 신세대 지큐빌 아파트" -> "부산광역시 사하구 다대로277번길 85"
 */
function extractRoadAddressPattern(address: string): string | null {
  // 도로명 주소 패턴: 시/도 + 구/군/시 + 읍/면/동(선택) + 도로명(~로/~길) + 번호
  const patterns = [
    // 기본 패턴: 시도 + 시군구 + 도로명 + 번호
    /^(.+(?:도|시|광역시|특별시|특별자치도|특별자치시))\s+(.+(?:시|군|구))\s+(?:(.+(?:읍|면|동))\s+)?(.+(?:로|길))\s*(\d+(?:-\d+)?)/,
    // 세종시 등 특별한 케이스
    /^(세종특별자치시)\s+(.+(?:로|길))\s*(\d+(?:-\d+)?)/,
    // 시/구 직접 시작
    /^(.+(?:시|군|구))\s+(?:(.+(?:읍|면|동))\s+)?(.+(?:로|길))\s*(\d+(?:-\d+)?)/,
  ];
  
  for (const pattern of patterns) {
    const match = address.match(pattern);
    if (match) {
      // 매칭된 전체 도로명 주소 부분 반환
      return match[0];
    }
  }
  
  // 번길 패턴으로 직접 추출 시도
  const roadPattern = /(.+(?:로|길)\s*\d+(?:-\d+)?(?:번길\s*\d+(?:-\d+)?)?)/;
  const roadMatch = address.match(roadPattern);
  if (roadMatch) {
    return roadMatch[1].trim();
  }
  
  return null;
}

interface AddressValidationInternalResult {
  status: AddressStatus;
  standardAddress?: string;
  detailAddress?: string;
  normalizedDetailAddress?: string;
  fullAddress?: string;
  zipCode?: string;
  buildingName?: string;
  warningMessage?: string;
  errorMessage?: string;
  reasonCode?: string;
}

async function validateAddress(rawAddress: string): Promise<AddressValidationInternalResult> {
  if (!rawAddress || rawAddress.trim() === "") {
    return {
      status: "invalid",
      errorMessage: "주소가 비어있습니다",
      reasonCode: "E_EMPTY",
    };
  }

  const normalized = normalizeAddress(rawAddress);
  const expanded = expandRegionAbbreviation(normalized);
  const tokens = expanded.split(" ").filter(t => t.length > 0);

  if (tokens.length < 2) {
    return {
      status: "invalid",
      errorMessage: "주소 형식이 너무 짧습니다",
      reasonCode: "E_TOO_SHORT",
    };
  }

  const response = await callJusoAPI(expanded);

  if (!response) {
    return {
      status: "invalid",
      errorMessage: "주소 검색 서버에 접속할 수 없습니다",
      reasonCode: "E_API_ERROR",
    };
  }

  const totalCount = parseInt(response.results.common.totalCount, 10);

  if (totalCount === 0 || !response.results.juso || response.results.juso.length === 0) {
    // 1차 재시도: 앞쪽 토큰들로 검색
    const retryKeyword = tokens.slice(0, Math.max(3, tokens.length - 2)).join(" ");
    const retryResponse = await callJusoAPI(retryKeyword);
    
    if (retryResponse && parseInt(retryResponse.results.common.totalCount, 10) > 0 && retryResponse.results.juso) {
      const trimmedParts = tokens.slice(3);
      const foundResult = retryResponse.results.juso[0];
      return processFoundAddress(foundResult, trimmedParts, tokens, false, "medium");
    }
    
    // 2차 재시도: 도로명 주소 패턴 추출 시도 (시/도 + 구/군 + 도로명 + 번호)
    const roadAddressPattern = extractRoadAddressPattern(expanded);
    if (roadAddressPattern) {
      const roadRetryResponse = await callJusoAPI(roadAddressPattern);
      if (roadRetryResponse && parseInt(roadRetryResponse.results.common.totalCount, 10) > 0 && roadRetryResponse.results.juso) {
        const foundResult = roadRetryResponse.results.juso[0];
        const standardAddress = foundResult.roadAddrPart1;
        // 도로명 주소는 찾았지만 건물명 확인 불가 - WARNING으로 처리
        return {
          status: "warning",
          standardAddress,
          fullAddress: rawAddress.trim(),
          warningMessage: "도로명 주소는 확인되었으나 건물명 확인 불가 - 상세주소 확인 필요",
          reasonCode: "W_BUILDING_NOT_CONFIRMED",
        };
      }
    }
    
    // 3차 재시도: 괄호, 특수문자 제거 후 재검색
    const cleanedAddress = expanded
      .replace(/\([^)]*\)/g, '')  // 괄호 및 내용 제거
      .replace(/[,\-]/g, ' ')     // 콤마, 하이픈을 공백으로
      .replace(/\s+/g, ' ')       // 중복 공백 제거
      .trim();
    
    if (cleanedAddress !== expanded) {
      const cleanedTokens = cleanedAddress.split(" ").filter(t => t.length > 0);
      const cleanedRetryResponse = await callJusoAPI(cleanedAddress);
      
      if (cleanedRetryResponse && parseInt(cleanedRetryResponse.results.common.totalCount, 10) > 0 && cleanedRetryResponse.results.juso) {
        const foundResult = cleanedRetryResponse.results.juso[0];
        return processFoundAddress(foundResult, cleanedTokens, tokens, false, "medium");
      }
      
      // 정리된 주소에서 도로명 패턴 추출 재시도
      const cleanedRoadPattern = extractRoadAddressPattern(cleanedAddress);
      if (cleanedRoadPattern) {
        const cleanedRoadResponse = await callJusoAPI(cleanedRoadPattern);
        if (cleanedRoadResponse && parseInt(cleanedRoadResponse.results.common.totalCount, 10) > 0 && cleanedRoadResponse.results.juso) {
          const foundResult = cleanedRoadResponse.results.juso[0];
          return {
            status: "warning",
            standardAddress: foundResult.roadAddrPart1,
            fullAddress: rawAddress.trim(),
            warningMessage: "도로명 주소는 확인되었으나 건물명/상세주소 확인 불가",
            reasonCode: "W_BUILDING_NOT_CONFIRMED",
          };
        }
      }
    }
    
    return {
      status: "invalid",
      errorMessage: "건물을 찾을 수 없습니다 (배송 불가)",
      reasonCode: "E_BASE_NOT_FOUND",
    };
  }

  const multipleResults = totalCount > 1;
  let selectionConfidence: "high" | "medium" | "low" = "high";
  let foundResult = response.results.juso![0];
  
  if (multipleResults) {
    const scored = response.results.juso!.map(juso => {
      let score = 0;
      const roadAddr = juso.roadAddrPart1.toLowerCase();
      for (const token of tokens) {
        if (roadAddr.includes(token.toLowerCase())) {
          score += 10;
        }
      }
      if (juso.bdNm && rawAddress.includes(juso.bdNm)) {
        score += 20;
      }
      return { juso, score };
    });
    
    scored.sort((a, b) => b.score - a.score);
    foundResult = scored[0].juso;
    
    if (scored[0].score < 20 || (scored.length > 1 && scored[0].score - scored[1].score < 10)) {
      selectionConfidence = "low";
    } else {
      selectionConfidence = "medium";
    }
  }

  const trimmedParts = tokens.filter(t => {
    const standardLower = foundResult.roadAddrPart1.toLowerCase();
    return !standardLower.includes(t.toLowerCase());
  });

  return processFoundAddress(foundResult, trimmedParts, tokens, multipleResults, selectionConfidence);
}

async function processFoundAddress(
  foundResult: JusoItem,
  trimmedParts: string[],
  tokens: string[],
  multipleResults: boolean,
  selectionConfidence: "high" | "medium" | "low"
): Promise<AddressValidationInternalResult> {
  const standardAddress = foundResult.roadAddrPart1;
  const zipCode = foundResult.zipNo;
  const buildingName = foundResult.bdNm;
  const bdKdcd = foundResult.bdKdcd;

  let detailAddress = trimmedParts.length > 0 ? trimmedParts.join(" ") : "";
  
  if (!detailAddress) {
    detailAddress = extractDetailAddress(tokens, standardAddress);
  }
  
  const normalizedDetailAddress = detailAddress ? normalizeDetailAddress(detailAddress) : "";
  
  const fullAddress = detailAddress 
    ? `${standardAddress} ${detailAddress}` 
    : standardAddress;

  console.log(`[Address Validation] Standard: "${standardAddress}", Detail: "${detailAddress}"`);

  if (hasInvalidCharacters(detailAddress)) {
    console.log(`[Address Validation] Status: WARNING - 잘못된 문자 발견`);
    return {
      status: "warning",
      standardAddress,
      detailAddress,
      normalizedDetailAddress,
      fullAddress,
      zipCode,
      buildingName,
      warningMessage: "상세주소에 사용할 수 없는 문자가 포함되어 있습니다",
      reasonCode: "E_DETAIL_INVALID_CHARS",
    };
  }

  const isApt = isApartmentBuilding(bdKdcd, buildingName);
  const forbiddenCheck = hasForbiddenWord(detailAddress, isApt);
  if (forbiddenCheck.found) {
    console.log(`[Address Validation] Status: WARNING - 금칙어 발견: ${forbiddenCheck.word}`);
    return {
      status: "warning",
      standardAddress,
      detailAddress,
      normalizedDetailAddress,
      fullAddress,
      zipCode,
      buildingName,
      warningMessage: "상세주소에 부적절한 표현이 포함되어 있습니다",
      reasonCode: "E_DETAIL_FORBIDDEN",
    };
  }

  if (hasMixedMemo(detailAddress)) {
    console.log(`[Address Validation] Status: WARNING - 메모/전화번호 혼입`);
    return {
      status: "warning",
      standardAddress,
      detailAddress,
      normalizedDetailAddress,
      fullAddress,
      zipCode,
      buildingName,
      warningMessage: "상세주소에 배송메모나 전화번호가 섞여있습니다",
      reasonCode: "W_DETAIL_MIXED_MEMO",
    };
  }

  if (hasUnrealisticValue(detailAddress)) {
    console.log(`[Address Validation] Status: WARNING - 비현실적 값`);
    return {
      status: "warning",
      standardAddress,
      detailAddress,
      normalizedDetailAddress,
      fullAddress,
      zipCode,
      buildingName,
      warningMessage: "동/호수 값이 비현실적입니다",
      reasonCode: "W_DETAIL_SUSPECT_UNIT",
    };
  }

  const detailValidation = await validateDetailAddress(detailAddress, bdKdcd, buildingName);
  if (!detailValidation.isValid) {
    console.log(`[Address Validation] Status: WARNING - ${detailValidation.warningMessage}`);
    return {
      status: "warning",
      standardAddress,
      detailAddress,
      normalizedDetailAddress,
      fullAddress,
      zipCode,
      buildingName,
      warningMessage: detailValidation.warningMessage,
      reasonCode: detailValidation.reasonCode,
    };
  }

  if (multipleResults && selectionConfidence === "low") {
    console.log(`[Address Validation] Status: WARNING - 다건 결과, 낮은 확신도`);
    return {
      status: "warning",
      standardAddress,
      detailAddress,
      normalizedDetailAddress,
      fullAddress,
      zipCode,
      buildingName,
      warningMessage: "여러 건물이 검색되어 자동 선택되었습니다. 주소를 확인해주세요.",
      reasonCode: "W_BASE_AMBIGUOUS",
    };
  }

  console.log(`[Address Validation] Status: VALID`);
  return {
    status: "valid",
    standardAddress,
    detailAddress,
    normalizedDetailAddress,
    fullAddress,
    zipCode,
    buildingName,
    reasonCode: "OK_STD",
  };
}

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { addresses } = req.body as ValidateAddressesRequest;

    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({
        success: false,
        message: "주소 목록이 필요합니다",
      });
    }

    const results: AddressValidationResult[] = [];
    let validCount = 0;
    let warningCount = 0;
    let invalidCount = 0;
    let islandRemoteCount = 0;
    let lengthExceededCount = 0;

    const batchSize = 5;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async ({ rowIndex, address, phone }) => {
          const result = await validateAddress(address);
          
          const isIslandRemote = result.standardAddress 
            ? isIslandRemoteArea(result.standardAddress) 
            : false;
          
          const isLengthExceeded = result.fullAddress 
            ? isAddressLengthExceeded(result.fullAddress) 
            : false;
          
          const phoneResult = phone ? formatPhoneNumber(phone) : null;
          
          let warningMessages: string[] = [];
          if (result.warningMessage) {
            warningMessages.push(result.warningMessage);
          }
          if (isLengthExceeded) {
            warningMessages.push(`주소 길이 초과 (${result.fullAddress?.length}자 > ${MAX_ADDRESS_LENGTH}자)`);
          }
          
          const validationResult: AddressValidationResult = {
            rowIndex,
            originalAddress: address,
            status: result.status,
            standardAddress: result.standardAddress,
            detailAddress: result.detailAddress,
            normalizedDetailAddress: result.normalizedDetailAddress,
            fullAddress: result.fullAddress,
            zipCode: result.zipCode,
            buildingName: result.buildingName,
            warningMessage: warningMessages.length > 0 ? warningMessages.join(" / ") : undefined,
            errorMessage: result.errorMessage,
            reasonCode: result.reasonCode,
            isIslandRemote,
            isLengthExceeded,
            originalPhone: phone,
            formattedPhone: phoneResult?.formatted,
            phoneModified: phoneResult?.modified,
          };

          if (result.status === "valid") validCount++;
          else if (result.status === "warning") warningCount++;
          else invalidCount++;
          
          if (isIslandRemote) islandRemoteCount++;
          if (isLengthExceeded) lengthExceededCount++;

          return validationResult;
        })
      );

      results.push(...batchResults);

      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const response: ValidateAddressesResponse = {
      success: true,
      results,
      validCount,
      warningCount,
      invalidCount,
      islandRemoteCount,
      lengthExceededCount,
    };

    return res.json(response);
  } catch (error) {
    console.error("[Address Validation] Validation error:", error);
    return res.status(500).json({
      success: false,
      message: "주소 검증 중 오류가 발생했습니다",
    });
  }
});

router.get("/health", async (_req: Request, res: Response) => {
  try {
    if (!JUSO_API_KEY) {
      return res.json({
        success: false,
        status: "error",
        message: "주소 검증 API 키가 설정되지 않았습니다",
        apiKeyConfigured: false,
        aiEnabled: isAIEnabled(),
      });
    }

    const testAddress = "강남구 테헤란로 123";
    const response = await callJusoAPI(testAddress);

    if (!response) {
      return res.json({
        success: false,
        status: "error",
        message: "API 호출 실패",
        apiKeyConfigured: true,
        aiEnabled: isAIEnabled(),
      });
    }

    const totalCount = parseInt(response.results.common.totalCount, 10);
    const errorCode = response.results.common.errorCode;

    if (errorCode !== "0" && totalCount === 0) {
      return res.json({
        success: false,
        status: "error",
        message: response.results.common.errorMessage || "API 오류",
        apiKeyConfigured: true,
        errorCode,
        aiEnabled: isAIEnabled(),
      });
    }

    const hasResults = totalCount > 0 && response.results.juso && response.results.juso.length > 0;

    return res.json({
      success: true,
      status: "ok",
      message: hasResults 
        ? "주소 검증 API가 정상적으로 작동 중입니다" 
        : "API 응답은 성공했으나 테스트 주소 결과 없음",
      apiKeyConfigured: true,
      aiEnabled: isAIEnabled(),
      testAddress,
      testResultCount: totalCount,
      sampleResult: hasResults ? {
        roadAddress: response.results.juso![0].roadAddrPart1,
        zipCode: response.results.juso![0].zipNo,
        buildingName: response.results.juso![0].bdNm,
      } : null,
    });
  } catch (error) {
    console.error("[Address Validation] Health check error:", error);
    return res.status(500).json({
      success: false,
      status: "error",
      message: "API 상태 확인 중 오류 발생",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "검색어가 필요합니다",
      });
    }

    if (!JUSO_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "주소 검증 API 키가 설정되지 않았습니다",
      });
    }

    const response = await callJusoAPI(query.trim());

    if (!response) {
      return res.status(500).json({
        success: false,
        message: "API 호출 실패",
      });
    }

    const totalCount = parseInt(response.results.common.totalCount, 10);

    if (totalCount === 0 || !response.results.juso) {
      return res.json({
        success: true,
        results: [],
        message: response.results.common.errorMessage || "검색 결과가 없습니다",
      });
    }

    const results = response.results.juso.map(item => ({
      roadAddress: item.roadAddrPart1,
      roadAddressPart2: item.roadAddrPart2,
      jibunAddress: item.jibunAddr,
      zipCode: item.zipNo,
      buildingName: item.bdNm,
      sido: item.siNm,
      sigungu: item.sggNm,
      eupmyeondong: item.emdNm,
      roadName: item.rn,
    }));

    return res.json({
      success: true,
      results,
      totalCount,
    });
  } catch (error) {
    console.error("[Address Validation] Search error:", error);
    return res.status(500).json({
      success: false,
      message: "주소 검색 중 오류가 발생했습니다",
    });
  }
});

// 개별 주소 검증을 위한 exported 함수 (엑셀 업로드 통합용)
export async function validateSingleAddress(rawAddress: string): Promise<{
  status: AddressStatus;
  standardAddress?: string;
  detailAddress?: string;
  fullAddress?: string;
  zipCode?: string;
  buildingName?: string;
  warningMessage?: string;
  errorMessage?: string;
  reasonCode?: string;
}> {
  const result = await validateAddress(rawAddress);
  return {
    status: result.status,
    standardAddress: result.standardAddress,
    detailAddress: result.detailAddress,
    fullAddress: result.fullAddress,
    zipCode: result.zipCode,
    buildingName: result.buildingName,
    warningMessage: result.warningMessage,
    errorMessage: result.errorMessage,
    reasonCode: result.reasonCode,
  };
}

// ==========================================
// 주소 학습 데이터 관리 API (관리자용)
// ==========================================

// 학습 데이터 목록 조회
router.get("/learning", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || "";
    const offset = (page - 1) * limit;

    let query = db.select().from(addressLearningData);
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(addressLearningData);

    if (search) {
      const searchCondition = or(
        ilike(addressLearningData.originalDetailAddress, `%${search}%`),
        ilike(addressLearningData.correctedDetailAddress, `%${search}%`),
        ilike(addressLearningData.errorPattern, `%${search}%`)
      );
      query = query.where(searchCondition) as typeof query;
      countQuery = countQuery.where(searchCondition) as typeof countQuery;
    }

    const [data, totalResult] = await Promise.all([
      query.orderBy(desc(addressLearningData.updatedAt)).limit(limit).offset(offset),
      countQuery
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("[Address Learning] List error:", error);
    return res.status(500).json({
      success: false,
      message: "학습 데이터 조회 중 오류가 발생했습니다"
    });
  }
});

// 학습 데이터 추가 (수동 등록)
router.post("/learning", async (req: Request, res: Response) => {
  try {
    const { 
      originalDetailAddress, 
      correctedDetailAddress, 
      buildingType = "general",
      errorPattern,
      problemDescription,
      patternRegex,
      solutionDescription,
      autoAnalyze = false
    } = req.body;

    if (!originalDetailAddress || !correctedDetailAddress) {
      return res.status(400).json({
        success: false,
        message: "원본 주소와 교정 주소는 필수입니다"
      });
    }

    // 자동으로 교정 유형 추론
    const correctionType = inferCorrectionType(originalDetailAddress, correctedDetailAddress);

    // AI 자동 분석 옵션이 활성화된 경우
    let aiAnalysisResult: any = null;
    if (autoAnalyze && isAIEnabled()) {
      try {
        console.log('🤖 AI 자동 분석 시작...');
        const addressToAnalyze = buildingType !== "general" 
          ? `[${buildingType}] ${originalDetailAddress}` 
          : originalDetailAddress;
        aiAnalysisResult = await analyzeAddressPattern(addressToAnalyze);
        console.log('✅ AI 자동 분석 완료:', aiAnalysisResult?.errorPattern);
      } catch (aiError) {
        console.error('AI 자동 분석 실패:', aiError);
      }
    }

    // AI 분석 결과가 있으면 병합
    const finalData = {
      originalDetailAddress,
      correctedDetailAddress,
      buildingType,
      correctionType,
      confidenceScore: "0.95",
      occurrenceCount: 1,
      successCount: 0,
      userConfirmed: true,
      errorPattern: errorPattern || aiAnalysisResult?.errorPattern || correctionType,
      problemDescription: problemDescription || aiAnalysisResult?.problemDescription,
      patternRegex: patternRegex || aiAnalysisResult?.patternRegex,
      solutionDescription: solutionDescription || aiAnalysisResult?.solution,
      similarPatterns: aiAnalysisResult?.similarPatterns ? JSON.stringify(aiAnalysisResult.similarPatterns) : null,
      extractedMemo: aiAnalysisResult?.extractedMemo,
      analyzedAt: aiAnalysisResult ? new Date() : null,
      aiModel: aiAnalysisResult ? 'claude-sonnet-4' : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [inserted] = await db.insert(addressLearningData).values(finalData).returning();

    return res.json({
      success: true,
      message: autoAnalyze && aiAnalysisResult 
        ? "학습 데이터가 AI 분석과 함께 등록되었습니다" 
        : "학습 데이터가 등록되었습니다",
      data: inserted,
      aiAnalyzed: !!aiAnalysisResult
    });
  } catch (error) {
    console.error("[Address Learning] Create error:", error);
    return res.status(500).json({
      success: false,
      message: "학습 데이터 등록 중 오류가 발생했습니다"
    });
  }
});

// 학습 데이터 수정
router.put("/learning/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));
    const { 
      originalDetailAddress, 
      correctedDetailAddress, 
      buildingType,
      errorPattern,
      problemDescription,
      patternRegex,
      solutionDescription,
      confidenceScore
    } = req.body;

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
      userConfirmed: true
    };

    if (originalDetailAddress) updateData.originalDetailAddress = originalDetailAddress;
    if (correctedDetailAddress) updateData.correctedDetailAddress = correctedDetailAddress;
    if (buildingType) updateData.buildingType = buildingType;
    if (errorPattern) updateData.errorPattern = errorPattern;
    if (problemDescription !== undefined) updateData.problemDescription = problemDescription;
    if (patternRegex !== undefined) updateData.patternRegex = patternRegex;
    if (solutionDescription !== undefined) updateData.solutionDescription = solutionDescription;
    if (confidenceScore !== undefined) updateData.confidenceScore = String(confidenceScore);

    // 교정 유형 다시 추론
    if (originalDetailAddress && correctedDetailAddress) {
      updateData.correctionType = inferCorrectionType(originalDetailAddress, correctedDetailAddress);
    }

    const [updated] = await db
      .update(addressLearningData)
      .set(updateData)
      .where(eq(addressLearningData.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "학습 데이터를 찾을 수 없습니다"
      });
    }

    return res.json({
      success: true,
      message: "학습 데이터가 수정되었습니다",
      data: updated
    });
  } catch (error) {
    console.error("[Address Learning] Update error:", error);
    return res.status(500).json({
      success: false,
      message: "학습 데이터 수정 중 오류가 발생했습니다"
    });
  }
});

// 학습 데이터 삭제
router.delete("/learning/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id));

    const [deleted] = await db
      .delete(addressLearningData)
      .where(eq(addressLearningData.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "학습 데이터를 찾을 수 없습니다"
      });
    }

    return res.json({
      success: true,
      message: "학습 데이터가 삭제되었습니다"
    });
  } catch (error) {
    console.error("[Address Learning] Delete error:", error);
    return res.status(500).json({
      success: false,
      message: "학습 데이터 삭제 중 오류가 발생했습니다"
    });
  }
});

// AI로 주소 패턴 분석 요청
router.post("/learning/analyze", async (req: Request, res: Response) => {
  try {
    const { originalDetailAddress, buildingType = "general" } = req.body;

    if (!originalDetailAddress) {
      return res.status(400).json({
        success: false,
        message: "분석할 주소가 필요합니다"
      });
    }

    if (!isAIEnabled()) {
      return res.status(400).json({
        success: false,
        message: "AI 기능이 활성화되지 않았습니다. ANTHROPIC_API_KEY를 설정해주세요."
      });
    }

    // AI 패턴 분석 실행 (buildingType을 주소에 포함시켜 전달)
    const addressToAnalyze = buildingType !== "general" 
      ? `[${buildingType}] ${originalDetailAddress}` 
      : originalDetailAddress;
    const analysis = await analyzeAddressPattern(addressToAnalyze);

    if (!analysis) {
      return res.status(500).json({
        success: false,
        message: "AI 분석에 실패했습니다"
      });
    }

    // 분석 결과 저장
    await savePatternAnalysis(analysis);

    return res.json({
      success: true,
      message: "AI 분석이 완료되었습니다",
      analysis
    });
  } catch (error) {
    console.error("[Address Learning] AI analyze error:", error);
    return res.status(500).json({
      success: false,
      message: "AI 분석 중 오류가 발생했습니다"
    });
  }
});

// 주소 패턴 테스트 (학습된 패턴으로 변환 테스트)
router.post("/learning/test", async (req: Request, res: Response) => {
  try {
    const { testAddress, buildingType = "general" } = req.body;

    const testAddressStr = String(testAddress || "").trim();
    const buildingTypeStr = String(buildingType || "general");

    if (!testAddressStr) {
      return res.status(400).json({
        success: false,
        message: "테스트할 주소가 필요합니다"
      });
    }

    // 1. 정규식 패턴 매칭 시도
    const patternMatch = await findByPattern(testAddressStr, buildingTypeStr);
    if (patternMatch) {
      return res.json({
        success: true,
        matched: true,
        method: "pattern_regex",
        original: testAddressStr,
        corrected: patternMatch.correctedDetailAddress,
        pattern: patternMatch.errorPattern,
        confidence: patternMatch.confidence
      });
    }

    // 2. 학습된 유사 패턴 매칭
    const learnedMatch = await findLearnedPattern(testAddressStr, buildingTypeStr);
    if (learnedMatch.found) {
      return res.json({
        success: true,
        matched: true,
        method: "learned_similarity",
        original: testAddressStr,
        corrected: learnedMatch.corrected,
        confidence: learnedMatch.confidence,
        occurrenceCount: learnedMatch.occurrenceCount
      });
    }

    return res.json({
      success: true,
      matched: false,
      original: testAddressStr,
      message: "매칭되는 패턴이 없습니다. AI 분석을 통해 새 패턴을 학습할 수 있습니다."
    });
  } catch (error) {
    console.error("[Address Learning] Test error:", error);
    return res.status(500).json({
      success: false,
      message: "패턴 테스트 중 오류가 발생했습니다"
    });
  }
});

// 엑셀 파일 업로드하여 컬럼 미리보기 (오류주소 학습용)
router.post("/learning/upload/preview", excelUpload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "파일이 없습니다" });
    }

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "빈 파일입니다" });
    }

    const headers = rows[0] as string[];
    const sampleData = rows.slice(1, 6).map((row, idx) => {
      const obj: Record<string, any> = { _rowIndex: idx + 2 };
      headers.forEach((header, colIdx) => {
        obj[header] = row[colIdx] || "";
      });
      return obj;
    });

    return res.json({
      success: true,
      columns: headers.map((name, index) => ({ index, name })),
      sampleData,
      totalRows: rows.length - 1,
      sheetName
    });
  } catch (error) {
    console.error("[Address Learning] Excel preview error:", error);
    return res.status(500).json({
      success: false,
      message: "엑셀 파일 처리 중 오류가 발생했습니다"
    });
  }
});

// 엑셀 파일의 주소들을 AI로 분석하여 학습 (일괄 처리)
router.post("/learning/upload/process", excelUpload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "파일이 없습니다" });
    }

    const { addressColumn, buildingType = "apartment" } = req.body;
    const addressColumnIndex = parseInt(addressColumn);

    if (isNaN(addressColumnIndex)) {
      return res.status(400).json({ success: false, message: "주소 컬럼을 선택해주세요" });
    }

    if (!isAIEnabled()) {
      return res.status(400).json({ 
        success: false, 
        message: "AI 기능이 비활성화되어 있습니다. ANTHROPIC_API_KEY를 설정해주세요." 
      });
    }

    const XLSX = await import("xlsx");
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (rows.length <= 1) {
      return res.status(400).json({ success: false, message: "데이터가 없습니다" });
    }

    const results: Array<{
      rowIndex: number;
      originalAddress: string;
      status: 'success' | 'skipped' | 'error';
      message?: string;
      pattern?: string;
    }> = [];

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const address = String(row[addressColumnIndex] || "").trim();

      if (!address || address.length < 3) {
        results.push({
          rowIndex: i + 1,
          originalAddress: address || "(빈 값)",
          status: 'skipped',
          message: "주소가 너무 짧거나 비어있음"
        });
        skippedCount++;
        continue;
      }

      try {
        const existing = await db
          .select()
          .from(addressLearningData)
          .where(eq(addressLearningData.originalDetailAddress, address))
          .limit(1);

        if (existing.length > 0) {
          results.push({
            rowIndex: i + 1,
            originalAddress: address,
            status: 'skipped',
            message: "이미 학습된 주소"
          });
          skippedCount++;
          continue;
        }

        console.log(`🤖 [${i}/${rows.length - 1}] AI 분석 중: "${address}"`);
        
        const addressToAnalyze = buildingType !== "general" 
          ? `[${buildingType}] ${address}` 
          : address;
        const aiResult = await analyzeAddressPattern(addressToAnalyze);

        if (aiResult && aiResult.errorPattern) {
          const correctionType = inferCorrectionType(address, aiResult.correctedAddress || address);
          
          await db.insert(addressLearningData).values({
            originalDetailAddress: address,
            correctedDetailAddress: aiResult.correctedAddress || address,
            buildingType,
            correctionType,
            confidenceScore: "0.95",
            occurrenceCount: 1,
            successCount: 0,
            userConfirmed: true,
            errorPattern: aiResult.errorPattern,
            problemDescription: aiResult.problemDescription,
            patternRegex: aiResult.patternRegex,
            solutionDescription: aiResult.solution,
            similarPatterns: aiResult.similarPatterns ? JSON.stringify(aiResult.similarPatterns) : null,
            extractedMemo: aiResult.extractedMemo,
            analyzedAt: new Date(),
            aiModel: 'claude-sonnet-4',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          results.push({
            rowIndex: i + 1,
            originalAddress: address,
            status: 'success',
            pattern: aiResult.errorPattern,
            message: aiResult.problemDescription
          });
          successCount++;
        } else {
          results.push({
            rowIndex: i + 1,
            originalAddress: address,
            status: 'skipped',
            message: "AI가 오류 패턴을 감지하지 못함 (정상 주소일 수 있음)"
          });
          skippedCount++;
        }

        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (err) {
        console.error(`[${i}] 분석 오류:`, err);
        results.push({
          rowIndex: i + 1,
          originalAddress: address,
          status: 'error',
          message: err instanceof Error ? err.message : "분석 실패"
        });
        errorCount++;
      }
    }

    return res.json({
      success: true,
      message: `${successCount}개 학습 완료, ${skippedCount}개 건너뜀, ${errorCount}개 오류`,
      summary: {
        total: rows.length - 1,
        success: successCount,
        skipped: skippedCount,
        error: errorCount
      },
      results
    });

  } catch (error) {
    console.error("[Address Learning] Excel process error:", error);
    return res.status(500).json({
      success: false,
      message: "엑셀 처리 중 오류가 발생했습니다"
    });
  }
});

// 학습 데이터 통계
router.get("/learning/stats", async (req: Request, res: Response) => {
  try {
    const [totalResult] = await db.select({ count: sql<number>`count(*)` }).from(addressLearningData);
    const [confirmedResult] = await db.select({ count: sql<number>`count(*)` }).from(addressLearningData).where(eq(addressLearningData.userConfirmed, true));
    const [aiAnalyzedResult] = await db.select({ count: sql<number>`count(*)` }).from(addressLearningData).where(sql`${addressLearningData.aiModel} IS NOT NULL`);

    return res.json({
      success: true,
      stats: {
        total: Number(totalResult?.count || 0),
        userConfirmed: Number(confirmedResult?.count || 0),
        aiAnalyzed: Number(aiAnalyzedResult?.count || 0),
        aiEnabled: isAIEnabled()
      }
    });
  } catch (error) {
    console.error("[Address Learning] Stats error:", error);
    return res.status(500).json({
      success: false,
      message: "통계 조회 중 오류가 발생했습니다"
    });
  }
});

export default router;
