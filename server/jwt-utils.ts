import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "topsel-jwt-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface JwtPayload {
  userId: string;
  username: string;
  userType: "user" | "member";
  grade?: string;
  companyName?: string;
  iat?: number;
  exp?: number;
}

export function generateToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
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

export const JWT_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};
