import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import { prisma } from '../services/db.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { SECURITY_QUESTION_KEYS } from '../../../shared/src/securityQuestions.ts';

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

    const token = signToken({ userId: user.id, email: user.email });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
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

    const token = signToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
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
      select: { id: true, email: true, username: true, createdAt: true },
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
