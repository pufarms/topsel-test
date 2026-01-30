import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "./jwt-utils";

declare global {
  namespace Express {
    interface Request {
      jwtUser?: JwtPayload;
    }
  }
}

export function jwtAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.topsel_token;

  if (!token) {
    return res.status(401).json({ message: "인증 토큰이 없습니다" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
  }

  req.jwtUser = payload;
  next();
}

export function optionalJwtMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.topsel_token;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.jwtUser = payload;
    }
  }

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.jwtUser) {
      return res.status(401).json({ message: "인증이 필요합니다" });
    }

    if (!roles.includes(req.jwtUser.userType)) {
      return res.status(403).json({ message: "권한이 없습니다" });
    }

    next();
  };
}

export function requireGrade(...grades: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.jwtUser) {
      return res.status(401).json({ message: "인증이 필요합니다" });
    }

    if (req.jwtUser.userType !== "member") {
      return res.status(403).json({ message: "회원만 접근할 수 있습니다" });
    }

    if (!req.jwtUser.grade || !grades.includes(req.jwtUser.grade)) {
      return res.status(403).json({ message: "해당 등급 이상만 접근할 수 있습니다" });
    }

    next();
  };
}
