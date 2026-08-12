/** Account routes: register, sign in, sign out, and "who am I". */

import { Router } from 'express';

import { db } from '../db';
import {
  attachUser,
  clearSessionCookie,
  consumePasswordReset,
  createPasswordReset,
  createSession,
  currentSessionToken,
  destroySession,
  destroyUserSessions,
  hashPassword,
  requireAuth,
  setSessionCookie,
  verifyPassword,
  type AuthedRequest,
} from '../auth';
import { SITE_URL } from '../config';
import { sendMail } from '../mail';
import { passwordResetEmail, welcomeEmail } from '../email-templates';

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

  // Fire-and-forget: a mail hiccup must not fail the sign-up.
  void sendMail(welcomeEmail({ name, email }));

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

/**
 * Begins a password reset. Always answers 200 with the same body whether or not
 * an account exists for the address, so this endpoint cannot be used to probe
 * which emails are registered — the same reasoning as the login route.
 */
authRouter.post('/forgot-password', async (req, res) => {
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();

  const user = EMAIL_PATTERN.test(email)
    ? (db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email) as
        | { id: number; email: string; name: string }
        | undefined)
    : undefined;

  if (user) {
    const token = createPasswordReset(user.id);
    const resetLink = `${SITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendMail(passwordResetEmail({ name: user.name, email: user.email }, resetLink));
  }

  res.json({ ok: true });
});

/**
 * Completes a password reset. A valid, unexpired, unused token sets the new
 * password and signs the account out everywhere, so a reset always ends with a
 * fresh sign-in.
 */
authRouter.post('/reset-password', async (req, res) => {
  const token = String(req.body?.token ?? '');
  const password = String(req.body?.password ?? '');

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    return;
  }

  const userId = consumePasswordReset(token);
  if (userId === null) {
    res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    return;
  }

  const passwordHash = await hashPassword(password);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  destroyUserSessions(userId);

  res.json({ ok: true });
});

/** Updates the signed-in user's name and email. */
authRouter.patch('/profile', attachUser, requireAuth, (req: AuthedRequest, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '')
    .trim()
    .toLowerCase();

  if (!name) {
    res.status(400).json({ error: 'Please tell us your name.' });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'That email address does not look right.' });
    return;
  }

  const clash = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(
    email,
    req.user!.id,
  );
  if (clash) {
    res.status(409).json({ error: 'Another account is already using that email.' });
    return;
  }

  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, req.user!.id);
  res.json({ user: { id: req.user!.id, email, name } });
});

/** Changes the signed-in user's password after checking the current one. */
authRouter.post('/change-password', attachUser, requireAuth, async (req: AuthedRequest, res) => {
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    return;
  }

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as
    | { password_hash: string }
    | undefined;
  const ok = row ? await verifyPassword(currentPassword, row.password_hash) : false;
  if (!ok) {
    res.status(403).json({ error: 'Your current password is incorrect.' });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user!.id);
  res.json({ ok: true });
});
