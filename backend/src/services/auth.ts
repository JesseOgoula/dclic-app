// ============================================================
// Authentication Service — Coordinator Access Security
// ============================================================

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const SECRET_SALT = process.env.AUTH_SECRET || 'dclic-monitoring-secret-key-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Dclic#2026!Coord$Peda';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Signs a stateless authentication token with expiration and HMAC signature.
 */
export function generateAdminToken(): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${expiresAt}`;
  const hmac = crypto.createHmac('sha256', SECRET_SALT).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Validates the HMAC signature and expiration of an admin token.
 */
export function verifyAdminToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);

  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false; // Expired
  }

  const expectedSignature = crypto
    .createHmac('sha256', SECRET_SALT)
    .update(expiresAtStr)
    .digest('hex');

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  // Constant time comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Checks if the submitted password matches the coordinator password.
 */
export function checkAdminPassword(password: string): boolean {
  if (!password || typeof password !== 'string') return false;
  return password.trim() === ADMIN_PASSWORD.trim();
}

/**
 * Express middleware to protect coordinator routes.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || (req.headers['x-admin-token'] as string);
  let token = '';

  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token || !verifyAdminToken(token)) {
    res.status(401).json({
      error: 'Accès non autorisé. Authentification coordinateur requise.',
    });
    return;
  }

  next();
}
