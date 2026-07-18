import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

if (!process.env.SESSION_SECRET) {
  // Development'da ogohlantirish — production'da ishlamasligi kerak
  console.warn("[AUTH] SESSION_SECRET o'rnatilmagan! Xavfsiz fallback ishlatilmoqda — production'da env o'rnating.");
}
const ACCESS_SECRET = process.env.SESSION_SECRET ?? `tiktoke-dev-only-${Math.random()}`;
const REFRESH_SECRET = process.env.REFRESH_SECRET ?? `tiktoke-refresh-dev-${Math.random()}`;

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    (req as Request & { user: JwtPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
