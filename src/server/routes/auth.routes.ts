/** Account routes: register, sign in, sign out, and "who am I". */

import { Router } from 'express';

import { db } from '../db';
import {
  attachUser,
  clearSessionCookie,
  createSession,
  currentSessionToken,
  destroySession,
  hashPassword,
  setSessionCookie,
  verifyPassword,
  type AuthedRequest,
} from '../auth';

export const authRouter = Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

authRouter.post('/register', async (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();
  const name = String(req.body?.name ?? '').trim();
  const password = String(req.body?.password ?? '');

  if (!name) {
    res.status(400).json({ error: 'Please tell us your name.' });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'That email address does not look right.' });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists.' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const result = db
    .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .run(email, name, passwordHash);

  const userId = Number(result.lastInsertRowid);
  setSessionCookie(res, createSession(userId));
  res.status(201).json({ user: { id: userId, email, name } });
});

authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? '');

  const row = db
    .prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
    .get(email) as { id: number; email: string; name: string; password_hash: string } | undefined;

  // Same message and roughly the same work either way, so the response does not
  // reveal whether an account exists for this address.
  const ok = row ? await verifyPassword(password, row.password_hash) : false;
  if (!row || !ok) {
    res.status(401).json({ error: 'Email or password is incorrect.' });
    return;
  }

  setSessionCookie(res, createSession(row.id));
  res.json({ user: { id: row.id, email: row.email, name: row.name } });
});

authRouter.post('/logout', (req, res) => {
  const token = currentSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', attachUser, (req: AuthedRequest, res) => {
  res.json({ user: req.user ?? null });
});
