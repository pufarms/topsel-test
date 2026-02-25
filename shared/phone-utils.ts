export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  
  let digits = String(phone).replace(/\D/g, "");
  
  if (!digits) return "";
  
  if (digits.startsWith("82")) {
    digits = "0" + digits.slice(2);
  }
  
  if (!digits.startsWith("0")) {
    if (digits.length === 10 && digits.startsWith("10")) {
      digits = "0" + digits;
    } else if (digits.length === 10 && (digits.startsWith("11") || digits.startsWith("16") || digits.startsWith("17") || digits.startsWith("18") || digits.startsWith("19"))) {
      digits = "0" + digits;
    } else if (digits.length === 10 && (digits.startsWith("70") || digits.startsWith("80"))) {
      digits = "0" + digits;
    } else if (digits.length === 11 && digits.startsWith("50")) {
      digits = "0" + digits;
    } else if (digits.length === 9 && digits.startsWith("2")) {
      digits = "0" + digits;
    } else if (digits.length === 8 && digits.startsWith("2")) {
      digits = "0" + digits;
    } else if (digits.length >= 9 && digits.length <= 10) {
      const prefix2 = digits.slice(0, 2);
      const areaPrefixes2 = ["31", "32", "33", "41", "42", "43", "44", "51", "52", "53", "54", "55", "61", "62", "63", "64"];
      if (areaPrefixes2.includes(prefix2)) {
        digits = "0" + digits;
      }
    }
  }
  
  return formatPhoneNumber(digits);
}

function formatPhoneNumber(digits: string): string {
  if (digits.startsWith("010") || digits.startsWith("011") || 
      digits.startsWith("016") || digits.startsWith("017") || 
      digits.startsWith("018") || digits.startsWith("019")) {
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }
  
  if (digits.startsWith("070")) {
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }
  
  if (digits.startsWith("080")) {
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }
  
  if (digits.startsWith("050")) {
    if (digits.length === 12) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    if (digits.length === 11) {
      return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
  }
  
  if (digits.startsWith("060")) {
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }
  
  if (digits.startsWith("02")) {
    if (digits.length === 10) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
  }
  
  const areaCodes = ["031", "032", "033", "041", "042", "043", "044", 
                     "051", "052", "053", "054", "055", "061", "062", "063", "064"];
  const areaCode = digits.slice(0, 3);
  if (areaCodes.includes(areaCode)) {
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
  }
  
  const shortPrefixes = ["15", "16", "18"];
  if (shortPrefixes.some(p => digits.startsWith(p))) {
    if (digits.length === 8) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
  }
  
  if (digits.length >= 7 && digits.length <= 8) {
    if (digits.length === 8) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  return digits;
}
