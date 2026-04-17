import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../services/db.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { SECURITY_QUESTION_KEYS, SECURITY_QUESTIONS } from '../../../shared/src/securityQuestions.ts';

// ── Recovery rate limiting (5 attempts per hour per identifier) ───────────────
const recoverAttempts = new Map<string, { count: number; windowStart: number }>();
const RECOVER_LIMIT = 5;
const RECOVER_WINDOW_MS = 60 * 60 * 1000;

function checkRecoverLimit(key: string): boolean {
  const now = Date.now();
  const entry = recoverAttempts.get(key);
  if (!entry || now - entry.windowStart > RECOVER_WINDOW_MS) {
    recoverAttempts.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RECOVER_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Reset tokens (in-memory, 15-minute TTL) ───────────────────────────────────
const resetTokens = new Map<string, { userId: string; expires: number }>();
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

export const authRouter = Router();

// Register with email/password + two security questions
authRouter.post('/register', async (req, res) => {
  try {
    const { email, username, password, securityQuestions } = req.body;

    if (!email || !username || !password) {
      res.status(400).json({ error: 'Email, username, and password are required' });
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscores only)' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    if (!Array.isArray(securityQuestions) || securityQuestions.length !== 2) {
      res.status(400).json({ error: 'Exactly two security questions are required' });
      return;
    }

    const [sq1, sq2] = securityQuestions as Array<{ questionKey: string; answer: string }>;

    if (!sq1?.questionKey || !sq1?.answer?.trim() || !sq2?.questionKey || !sq2?.answer?.trim()) {
      res.status(400).json({ error: 'Each security question must have a question and a non-empty answer' });
      return;
    }

    if (!SECURITY_QUESTION_KEYS.has(sq1.questionKey) || !SECURITY_QUESTION_KEYS.has(sq2.questionKey)) {
      res.status(400).json({ error: 'Invalid security question key' });
      return;
    }

    if (sq1.questionKey === sq2.questionKey) {
      res.status(400).json({ error: 'Security questions must be distinct' });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      res.status(409).json({
        error: existing.email === email ? 'Email already registered' : 'Username already taken',
      });
      return;
    }

    const [passwordHash, answerHash1, answerHash2] = await Promise.all([
      bcryptjs.hash(password, 12),
      bcryptjs.hash(sq1.answer.trim().toLowerCase(), 10),
      bcryptjs.hash(sq2.answer.trim().toLowerCase(), 10),
    ]);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          stats: { create: {} },
        },
      });

      await tx.securityQuestion.createMany({
        data: [
          { userId: newUser.id, questionKey: sq1.questionKey, answerHash: answerHash1 },
          { userId: newUser.id, questionKey: sq2.questionKey, answerHash: answerHash2 },
        ],
      });

      return newUser;
    });

    const token = signToken({ userId: user.id, email: user.email, role: 'user' });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: 'user' },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login with username or email + password
authRouter.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Username/email and password are required' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
    });

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcryptjs.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    let role = user.role ?? 'user';
    const adminEmails = new Set(
      (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)
    );
    if (adminEmails.has(user.email) && role === 'user') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
      role = 'admin';
    }

    const token = signToken({ userId: user.id, email: user.email, role });

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
authRouter.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Step 1 — identify account and return security question prompts
authRouter.post('/recover/identify', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      res.status(400).json({ error: 'Identifier is required' });
      return;
    }

    if (!checkRecoverLimit(identifier.toLowerCase().trim())) {
      res.status(429).json({ error: 'Too many recovery attempts. Please try again later.' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
      include: { securityQuestions: true },
    });

    if (!user || user.securityQuestions.length === 0) {
      res.status(404).json({ error: 'No account found with that identifier' });
      return;
    }

    const questions = user.securityQuestions.map(sq => ({
      key: sq.questionKey,
      question: SECURITY_QUESTIONS.find(q => q.key === sq.questionKey)?.question ?? sq.questionKey,
    }));

    res.json({ questions });
  } catch (err) {
    console.error('Recover identify error:', err);
    res.status(500).json({ error: 'Recovery failed' });
  }
});

// Step 2 — verify answers and return a short-lived reset token
authRouter.post('/recover/verify', async (req, res) => {
  try {
    const { identifier, answers } = req.body;
    if (!identifier || !Array.isArray(answers) || answers.length !== 2) {
      res.status(400).json({ error: 'Identifier and two answers are required' });
      return;
    }

    if (!checkRecoverLimit(identifier.toLowerCase().trim())) {
      res.status(429).json({ error: 'Too many recovery attempts. Please try again later.' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
      include: { securityQuestions: true },
    });

    if (!user || user.securityQuestions.length === 0) {
      res.status(401).json({ error: 'Incorrect answers' });
      return;
    }

    const [a1, a2] = answers as Array<{ questionKey: string; answer: string }>;
    const sq1 = user.securityQuestions.find(sq => sq.questionKey === a1?.questionKey);
    const sq2 = user.securityQuestions.find(sq => sq.questionKey === a2?.questionKey);

    if (!sq1 || !sq2 || !a1?.answer?.trim() || !a2?.answer?.trim()) {
      res.status(401).json({ error: 'Incorrect answers' });
      return;
    }

    const [match1, match2] = await Promise.all([
      bcryptjs.compare(a1.answer.trim().toLowerCase(), sq1.answerHash),
      bcryptjs.compare(a2.answer.trim().toLowerCase(), sq2.answerHash),
    ]);

    if (!match1 || !match2) {
      res.status(401).json({ error: 'Incorrect answers' });
      return;
    }

    const token = randomBytes(32).toString('hex');
    resetTokens.set(token, { userId: user.id, expires: Date.now() + RESET_TOKEN_TTL_MS });

    res.json({ resetToken: token });
  } catch (err) {
    console.error('Recover verify error:', err);
    res.status(500).json({ error: 'Recovery failed' });
  }
});

// Step 3 — use reset token to set a new password
authRouter.post('/recover/reset', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      res.status(400).json({ error: 'Reset token and new password are required' });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const entry = resetTokens.get(resetToken);
    if (!entry || Date.now() > entry.expires) {
      resetTokens.delete(resetToken);
      res.status(401).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcryptjs.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash },
    });

    resetTokens.delete(resetToken);
    res.json({ success: true });
  } catch (err) {
    console.error('Recover reset error:', err);
    res.status(500).json({ error: 'Password reset failed' });
  }
});
