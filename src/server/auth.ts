/**
 * Password hashing and session handling.
 *
 * Passwords are hashed with scrypt (from node:crypto) using a per-user random
 * salt — no third-party hashing dependency. Sessions are opaque random tokens
 * stored in the database and handed to the browser in an httpOnly cookie, so a
 * cross-site script cannot read them and a stolen token can be revoked
 * server-side by deleting the row.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response, NextFunction } from 'express';

import { db, pruneExpiredSessions } from './db';
import { IS_PRODUCTION, SESSION_TTL_MS } from './config';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const SESSION_COOKIE = 'hdh_session';
const KEY_LENGTH = 64;

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

/** Express request with the session user attached by `attachUser`. */
export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const derived = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  // Constant-time compare so a response cannot be timed to leak the hash.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    Date.now() + SESSION_TTL_MS,
  );
  return token;
}

export function destroySession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Minimal cookie header parser — avoids pulling in cookie-parser. */
function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

export function currentSessionToken(req: Request): string | undefined {
  return readCookie(req, SESSION_COOKIE);
}

/**
 * Looks up the session on every request and hangs the user off `req.user`.
 * Never rejects — routes that require a user use `requireAuth` below.
 */
export function attachUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = currentSessionToken(req);
  if (!token) return next();

  pruneExpiredSessions();

  const row = db
    .prepare(
      `SELECT u.id AS id, u.email AS email, u.name AS name
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
    )
    .get(token, Date.now()) as AuthUser | undefined;

  if (row) {
    req.user = { id: row.id, email: row.email, name: row.name };
  }
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'You need to be signed in to do that.' });
    return;
  }
  next();
}
