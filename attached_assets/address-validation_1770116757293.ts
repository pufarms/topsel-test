import { Router, Request, Response } from "express";
import { 
  normalizeDetailAddressWithAI, 
  isAIEnabled,
  type AIEnhancementResult 
} from './ai-address-enhancer';
import {
  saveAddressCorrection,
  findLearnedPattern,
  inferCorrectionType,
  findByPattern
} from './address-learning';
import { matchAndConvertByPattern } from './ai-pattern-analyzer';

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

interface JusoAPIResponse {
  results: {
    common: {
      totalCount: string;
      errorCode: string;
      errorMessage: string;
    };
    juso: Array<{
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
    }> | null;
  };
}

const FORBIDDEN_WORDS = [
  "미정", "몰라", "unknown", "모름", "나중에",
  "추후", "확인요", "테스트", "test",
  "ㅇㅇ", "ㅁㅁ", "ㄴㄴ", "asdf", "qwer", "zxcv"
];

// "상세주소 없음" 같은 명시적 표현은 비아파트 건물에서 허용
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

// 동+호 모두 필수인 건물 유형 (아파트만)
const STRICT_APT_KEYWORDS = ["아파트", "APT", "공동주택", "연립", "다세대"];

// 호만 있어도 되는 건물 유형 (빌라, 오피스텔 등)
// 주의: "빌"은 너무 일반적이라 "삼환나우빌아파트" 같은 이름에 잘못 매칭됨 → 제외
const RELAXED_APT_KEYWORDS = ["빌라", "주상복합", "오피스텔", "타운하우스", "타워", "맨션", "팰리스", "빌딩", "레지던스", "하이츠"];

// 모든 공동주택 키워드 (도서산간 등 판단용)
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

// 아파트(동+호 필수) 여부 판정
// bdKdcd="1"은 공동주택(아파트)를 의미
function isStrictApartmentBuilding(bdKdcd: string, bdNm: string): boolean {
  // API에서 공동주택 코드로 판정된 경우
  if (bdKdcd === "1") {
    return true;
  }
  
  // 건물명에 "아파트" 등 strict 키워드가 있으면 무조건 strict
  if (bdNm && STRICT_APT_KEYWORDS.some(keyword => bdNm.includes(keyword))) {
    return true;
  }
  
  return false;
}

// 빌라/오피스텔 등 (호만 있어도 됨) 여부 판정
function isRelaxedApartmentBuilding(bdKdcd: string, bdNm: string): boolean {
  // 이미 아파트로 판정되면 relaxed 아님
  if (isStrictApartmentBuilding(bdKdcd, bdNm)) return false;
  
  if (!bdNm) return false;
  
  // RELAXED 키워드 체크
  if (RELAXED_APT_KEYWORDS.some(keyword => bdNm.includes(keyword))) return true;
  
  // "~빌"로 끝나는 경우도 relaxed (예: 삼성진빌, 금강빌라 등)
  if (bdNm.endsWith("빌")) return true;
  
  return false;
}

// 어떤 유형이든 공동주택인지 판정 (레거시 호환용)
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
    // 일반 건물은 상세주소 없어도 경고만 (단독주택 등)
    return { isValid: true };
  }
  
  // 아파트: 동+호 또는 호만 (소규모 아파트)
  if (isStrictApt) {
    const hasPatternA = matchPatternA(detailAddress);
    const hasPatternB = matchPatternB(detailAddress);
    
    if (hasPatternA || hasPatternB) {
      return { isValid: true };
    }
    
    const hasDong = hasDongPattern(detailAddress);
    const hasHo = hasHoPattern(detailAddress);
    
    // 동+호 모두 있으면 OK
    if (hasDong && hasHo) {
      return { isValid: true };
    }
    
    // 호만 있는 경우 - 소규모 아파트로 간주하여 허용
    // (소규모 아파트는 동이 없이 호만 있는 경우가 많음)
    if (hasHo && !hasDong) {
      return { isValid: true };
    }
    
    // 동만 있는 경우 - 호 누락 경고
    if (hasDong && !hasHo) {
      return {
        isValid: false,
        warningMessage: "아파트: 호수가 누락된 것으로 보입니다 (예: 202호)",
        reasonCode: "W_DETAIL_MISSING_HO",
      };
    }
    
    // 동도 호도 없는 경우
    return {
      isValid: false,
      warningMessage: "아파트: 동/호수 정보를 확인해주세요",
      reasonCode: "W_DETAIL_MISSING_UNIT",
    };
  }
  
  // 빌라/오피스텔 등: 호만 있어도 OK
  if (isRelaxedApt) {
    if (matchPatternA(detailAddress) || matchPatternB(detailAddress) || matchPatternC(detailAddress)) {
      return { isValid: true };
    }
    if (hasHoPattern(detailAddress) || hasFloorOrHoPattern(detailAddress)) {
      return { isValid: true };
    }
    // 호 정보가 없어도 설명이 있으면 OK (예: "합정건축 다음집입니다")
    if (detailAddress.length >= 2) {
      return { isValid: true };
    }
    return {
      isValid: false,
      warningMessage: "상세주소(호)가 누락되었습니다",
      reasonCode: "W_DETAIL_MISSING_UNIT",
    };
  }
  
  // 일반 건물: 상세주소가 있으면 OK
  return { isValid: true };
}

/**
 * 룰 기반 검증 결과의 확신도 계산
 */
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

/**
 * 상세주소 검증 (AI 통합 + 학습 패턴 버전)
 */
async function validateDetailAddress(
  detailAddress: string,
  bdKdcd: string,
  bdNm: string
): Promise<DetailAddressValidation> {
  
  // 건물 유형 판정
  const isStrictApt = isStrictApartmentBuilding(bdKdcd, bdNm);
  const isRelaxedApt = isRelaxedApartmentBuilding(bdKdcd, bdNm);
  const buildingType: 'apartment' | 'villa' | 'officetel' | 'general' = 
    isStrictApt ? 'apartment' : 
    isRelaxedApt ? 'villa' : 
    'general';
  
  // STEP 0: 정규식 패턴 기반 검색 (최우선!) ⭐
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
  
  // STEP 1: 학습 패턴 검색 (기존)
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
  
  // STEP 2: 룰 기반 검증 (기존 로직)
  const ruleResult = validateDetailAddressWithRules(detailAddress, bdKdcd, bdNm);
  const ruleConfidence = calculateRuleConfidence(ruleResult);
  
  // STEP 3: AI 통합 (확신도 < 0.9일 때만)
  const AI_THRESHOLD = parseFloat(process.env.AI_CONFIDENCE_THRESHOLD || '0.9');
  
  if (isAIEnabled() && ruleConfidence < AI_THRESHOLD) {
    try {
      console.log(`🤖 AI 호출 (룰 확신도: ${ruleConfidence.toFixed(2)})`);
      
      const aiResult = await normalizeDetailAddressWithAI(
        detailAddress,
        buildingType,
        bdNm
      );
      
      // AI 결과가 더 나은 경우 사용
      if (!aiResult.hasError && aiResult.confidence > ruleConfidence) {
        console.log(`✨ AI 결과 적용 (AI 확신도: ${aiResult.confidence.toFixed(2)})`);
        
        // ★ AI 결과 자동 저장 ★
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
  
  // STEP 4: 룰 기반 결과 반환 (폴백)
  return {
    ...ruleResult,
    aiEnhanced: false,
    ruleBasedConfidence: ruleConfidence
  };
}

// "상세주소 없음" 같은 명시적 표현인지 체크
function hasExplicitNoDetailExpression(str: string): boolean {
  return EXPLICIT_NO_DETAIL_PATTERNS.some(pattern => pattern.test(str));
}

function hasForbiddenWord(str: string, isApartment: boolean): { found: boolean; word?: string } {
  // "상세주소 없음" 같은 명시적 표현은 비아파트 건물에서 허용
  if (hasExplicitNoDetailExpression(str)) {
    if (isApartment) {
      // 아파트에서 "상세주소 없음"은 여전히 경고
      return { found: true, word: "상세주소없음" };
    }
    // 비아파트 건물(주유소, 상가 등)에서는 허용
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
    // 호수는 9999까지 허용 (대형 오피스텔 등)
    if (hoNum > 9999 || hoNum === 0) {
      return true;
    }
  }
  
  const dongMatch = str.match(/(\d+)동/);
  if (dongMatch) {
    const dongNum = parseInt(dongMatch[1], 10);
    // 동 번호는 9999까지 허용 (대단지 아파트: 위례 6312동, 검단 9301동 등)
    if (dongNum > 9999 || dongNum === 0) {
      return true;
    }
  }
  
  // 단일 숫자 조합 (1-1 등)은 비현실적으로 간주하지 않음 - 소규모 건물에서 사용
  // if (/^(\d)-(\d)$/.test(str.replace(/\s+/g, ""))) {
  //   return true;
  // }
  
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
  
  // 표준주소에서 건물번호 패턴 추출 (예: "123", "123-45")
  const buildingNumPattern = /(\d+(-\d+)?)\s*$/;
  const buildingMatch = standardAddress.match(buildingNumPattern);
  const buildingNum = buildingMatch ? buildingMatch[1] : null;
  
  // 도로명 추출 (예: "테헤란로", "강남대로123길")
  const lastRoadToken = standardTokens[standardTokens.length - 1];
  
  let matchIndex = -1;
  
  // 방법 1: 건물번호로 찾기
  if (buildingNum) {
    for (let i = 0; i < originalTokens.length; i++) {
      const token = originalTokens[i];
      // 건물번호가 토큰에 포함되어 있거나 일치하는 경우
      if (token === buildingNum || token.includes(buildingNum) || 
          (token.match(/^\d+(-\d+)?$/) && token === buildingNum)) {
        matchIndex = i;
        break;
      }
    }
  }
  
  // 방법 2: 도로명으로 찾기 (건물번호로 못 찾은 경우)
  if (matchIndex === -1) {
    for (let i = 0; i < originalTokens.length; i++) {
      const token = originalTokens[i];
      // 도로명과 건물번호가 붙어있는 형태 (예: "테헤란로123")
      if (token.includes(lastRoadToken) || lastRoadToken.includes(token)) {
        matchIndex = i;
        // 건물번호가 다음 토큰에 있을 수도 있음
        if (i + 1 < originalTokens.length && /^\d+(-\d+)?$/.test(originalTokens[i + 1])) {
          matchIndex = i + 1;
        }
        break;
      }
    }
  }
  
  // 방법 3: 표준주소의 마지막 토큰으로 찾기
  if (matchIndex === -1) {
    const standardLastToken = standardTokens[standardTokens.length - 1];
    for (let i = 0; i < originalTokens.length; i++) {
      const token = originalTokens[i];
      if (token.includes(standardLastToken) || standardLastToken.includes(token)) {
        matchIndex = i;
        break;
      }
    }
  }
  
  if (matchIndex >= 0 && matchIndex < originalTokens.length - 1) {
    return originalTokens.slice(matchIndex + 1).join(" ");
  }
  
  return "";
}

interface JusoCandidate {
  item: NonNullable<JusoAPIResponse["results"]["juso"]>[0];
  score: number;
}

function scoreCandidate(
  candidate: NonNullable<JusoAPIResponse["results"]["juso"]>[0],
  originalAddress: string,
  inputTokens: string[]
): number {
  let score = 0;
  const original = originalAddress.toLowerCase();
  
  if (original.includes(candidate.rn.toLowerCase())) {
    score += 50;
  }
  
  if (original.includes(candidate.siNm.toLowerCase())) {
    score += 20;
  }
  if (original.includes(candidate.sggNm.toLowerCase())) {
    score += 20;
  }
  if (original.includes(candidate.emdNm.toLowerCase())) {
    score += 10;
  }
  
  if (candidate.bdNm) {
    const bdNmLower = candidate.bdNm.toLowerCase();
    for (const token of inputTokens) {
      if (bdNmLower.includes(token.toLowerCase()) || token.toLowerCase().includes(bdNmLower)) {
        score += 15;
        break;
      }
    }
  }
  
  return score;
}

function selectBestCandidate(
  candidates: NonNullable<JusoAPIResponse["results"]["juso"]>,
  originalAddress: string,
  inputTokens: string[]
): { candidate: JusoCandidate; confidence: "high" | "medium" | "low" } {
  const scoredCandidates: JusoCandidate[] = candidates.map(item => ({
    item,
    score: scoreCandidate(item, originalAddress, inputTokens),
  }));
  
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  const best = scoredCandidates[0];
  const second = scoredCandidates[1];
  
  let confidence: "high" | "medium" | "low" = "low";
  
  if (best.score >= 70 && (!second || best.score - second.score >= 15)) {
    confidence = "high";
  } else if (best.score >= 50) {
    confidence = "medium";
  }
  
  return { candidate: best, confidence };
}

interface RetryStrategy {
  name: string;
  transform: (tokens: string[]) => string[];
}

const RETRY_STRATEGIES: RetryStrategy[] = [
  {
    name: "remove_parentheses",
    transform: (tokens) => tokens.map(t => t.replace(/\([^)]*\)/g, "").trim()).filter(t => t.length > 0),
  },
  {
    name: "remove_building_name",
    transform: (tokens: string[]) => {
      const filtered = tokens.filter((t: string) => !ALL_APT_KEYWORDS.some((k: string) => t.includes(k)));
      return filtered.length >= 2 ? filtered : tokens;
    },
  },
  {
    name: "collapse_spaces",
    transform: (tokens) => [tokens.join("")],
  },
  {
    name: "expand_region",
    transform: (tokens) => {
      const expanded = expandRegionAbbreviation(tokens.join(" "));
      return expanded.split(" ").filter(t => t.length > 0);
    },
  },
];

async function validateAddress(rawAddress: string): Promise<{
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
}> {
  if (!JUSO_API_KEY) {
    return {
      status: "invalid",
      errorMessage: "주소 검증 API 키가 설정되지 않았습니다",
      reasonCode: "E_API_KEY_MISSING",
    };
  }

  if (!rawAddress || rawAddress.trim().length === 0) {
    return {
      status: "invalid",
      errorMessage: "주소가 비어있습니다",
      reasonCode: "E_ADDRESS_EMPTY",
    };
  }

  const cleanedAddress = normalizeAddress(rawAddress);
  const tokens = cleanedAddress.split(" ").filter(t => t.length > 0);
  
  if (tokens.length < 2) {
    return {
      status: "invalid",
      errorMessage: "주소가 너무 짧습니다",
      reasonCode: "E_ADDRESS_TOO_SHORT",
    };
  }

  console.log(`[Address Validation] Starting validation for: "${cleanedAddress}"`);

  const MAX_TRIM_ATTEMPTS = 4;
  let currentTokens = [...tokens];
  let trimmedParts: string[] = [];
  let foundResult: NonNullable<JusoAPIResponse["results"]["juso"]>[0] | null = null;
  let multipleResults = false;
  let selectionConfidence: "high" | "medium" | "low" = "high";

  for (let attempt = 0; attempt < MAX_TRIM_ATTEMPTS; attempt++) {
    if (currentTokens.length === 0) break;

    const keyword = currentTokens.join(" ");
    console.log(`[Address Validation] Trim attempt ${attempt + 1}: "${keyword}"`);

    const response = await callJusoAPI(keyword);

    if (!response) {
      return {
        status: "invalid",
        errorMessage: "API 호출 실패",
        reasonCode: "E_API_CALL_FAILED",
      };
    }

    const totalCount = parseInt(response.results.common.totalCount, 10);

    if (totalCount === 1 && response.results.juso && response.results.juso.length === 1) {
      foundResult = response.results.juso[0];
      console.log(`[Address Validation] Found exact match: "${foundResult.roadAddrPart1}"`);
      // 상세주소 추출 - extractDetailAddress 함수 사용
      const extractedDetail = extractDetailAddress(tokens, foundResult.roadAddrPart1);
      trimmedParts = extractedDetail ? extractedDetail.split(" ").filter(t => t.length > 0) : [];
      break;
    }

    if (totalCount > 1 && response.results.juso && response.results.juso.length > 0) {
      const { candidate, confidence } = selectBestCandidate(
        response.results.juso,
        cleanedAddress,
        tokens
      );
      foundResult = candidate.item;
      multipleResults = true;
      selectionConfidence = confidence;
      console.log(`[Address Validation] Multiple results (${totalCount}), selected with ${confidence} confidence: "${foundResult.roadAddrPart1}"`);
      // 상세주소 추출 - extractDetailAddress 함수 사용
      const extractedDetail = extractDetailAddress(tokens, foundResult.roadAddrPart1);
      trimmedParts = extractedDetail ? extractedDetail.split(" ").filter(t => t.length > 0) : [];
      break;
    }

    const removedToken = currentTokens.pop();
    if (removedToken) {
      trimmedParts.unshift(removedToken);
    }

    if (currentTokens.length < 2) {
      console.log(`[Address Validation] Too few tokens remaining, stopping trim search`);
      break;
    }
  }

  if (!foundResult) {
    console.log(`[Address Validation] Trying retry strategies...`);
    
    for (const strategy of RETRY_STRATEGIES) {
      const transformedTokens = strategy.transform([...tokens]);
      if (transformedTokens.length === 0) continue;
      
      const keyword = transformedTokens.join(" ");
      console.log(`[Address Validation] Retry strategy '${strategy.name}': "${keyword}"`);
      
      const response = await callJusoAPI(keyword);
      
      if (response) {
        const totalCount = parseInt(response.results.common.totalCount, 10);
        
        if (totalCount > 0 && response.results.juso && response.results.juso.length > 0) {
          if (totalCount === 1) {
            foundResult = response.results.juso[0];
          } else {
            const { candidate, confidence } = selectBestCandidate(
              response.results.juso,
              cleanedAddress,
              tokens
            );
            foundResult = candidate.item;
            selectionConfidence = confidence;
            multipleResults = true;
          }
          console.log(`[Address Validation] Found via retry strategy '${strategy.name}': "${foundResult.roadAddrPart1}"`);
          
          // 상세주소 추출 - extractDetailAddress 함수 사용
          const extractedDetail = extractDetailAddress(tokens, foundResult.roadAddrPart1);
          trimmedParts = extractedDetail ? extractedDetail.split(" ").filter(t => t.length > 0) : [];
          break;
        }
      }
    }
  }

  if (!foundResult) {
    console.log(`[Address Validation] Status: INVALID - 건물 찾기 실패`);
    return {
      status: "invalid",
      errorMessage: "건물을 찾을 수 없습니다 (배송 불가)",
      reasonCode: "E_BASE_NOT_FOUND",
    };
  }

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

export default router;
