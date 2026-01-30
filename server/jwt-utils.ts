import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (!JWT_SECRET) {
  console.error("⚠️ JWT_SECRET 환경변수가 설정되지 않았습니다. JWT 인증이 비활성화됩니다.");
}

export interface JwtPayload {
  userId: string;
  username: string;
  userType: "user" | "member";
  grade?: string;
  companyName?: string;
  iat?: number;
  exp?: number;
}

export function generateToken(payload: Omit<JwtPayload, "iat" | "exp">): string | null {
  if (!JWT_SECRET) {
    console.warn("JWT_SECRET이 없어 토큰을 생성할 수 없습니다.");
    return null;
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string): JwtPayload | null {
  if (!JWT_SECRET) {
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch (error) {
    return null;
  }
}

const isProduction = process.env.NODE_ENV === "production";

export const JWT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "strict" as const : "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};
