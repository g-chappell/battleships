import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// vi.hoisted runs before vi.mock factories (which are hoisted to top of file)
const { mockUser, mockTxUser, mockTxSecQ, mockTransaction } = vi.hoisted(() => {
  const mockTxUser = { create: vi.fn() };
  const mockTxSecQ = { createMany: vi.fn() };
  const mockTransaction = vi.fn().mockImplementation((fn: (tx: any) => any) =>
    fn({ user: mockTxUser, securityQuestion: mockTxSecQ })
  );
  return {
    mockUser: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    mockTxUser,
    mockTxSecQ,
    mockTransaction,
  };
});

vi.mock('../services/db.ts', () => ({
  prisma: {
    user: mockUser,
    $transaction: mockTransaction,
  },
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import { authRouter } from '../routes/auth.ts';
import { signToken } from '../middleware/auth.ts';
import bcryptjs from 'bcryptjs';

// ─── Test server setup ────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);

  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/auth`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve()))
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: hash returns predictable values
  vi.mocked(bcryptjs.hash).mockResolvedValue('$hashed$' as never);
  // Default: transaction creates user successfully
  mockTxUser.create.mockResolvedValue({
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
  });
  mockTxSecQ.createMany.mockResolvedValue({ count: 2 });
  // Restore transaction default implementation after vi.clearAllMocks
  mockTransaction.mockImplementation((fn: (tx: any) => any) =>
    fn({ user: mockTxUser, securityQuestion: mockTxSecQ })
  );
});

// Valid security questions payload for reuse
const validSqs = [
  { questionKey: 'first_pet', answer: 'Fluffy' },
  { questionKey: 'birth_city', answer: 'London' },
];

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates a user and returns 201 with token and user on success', async () => {
    mockUser.findFirst.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { token: string; user: { id: string; email: string; username: string } };
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user).toEqual({ id: 'user-123', email: 'test@example.com', username: 'testuser' });
  });

  it('hashes the password with cost factor 12 and stores the hash', async () => {
    mockUser.findFirst.mockResolvedValue(null);

    await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'mypassword', securityQuestions: validSqs }),
    });

    expect(bcryptjs.hash).toHaveBeenCalledWith('mypassword', 12);
    expect(mockTxUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: '$hashed$' }),
      })
    );
  });

  it('hashes both security answers with cost factor 10, lowercased', async () => {
    mockUser.findFirst.mockResolvedValue(null);

    await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        securityQuestions: [
          { questionKey: 'first_pet', answer: 'Fluffy' },
          { questionKey: 'birth_city', answer: 'LONDON' },
        ],
      }),
    });

    expect(bcryptjs.hash).toHaveBeenCalledWith('fluffy', 10);
    expect(bcryptjs.hash).toHaveBeenCalledWith('london', 10);
  });

  it('stores both security question records via transaction', async () => {
    mockUser.findFirst.mockResolvedValue(null);

    await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(mockTxSecQ.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'user-123', questionKey: 'first_pet', answerHash: '$hashed$' },
        { userId: 'user-123', questionKey: 'birth_city', answerHash: '$hashed$' },
      ],
    });
  });

  it('returns 400 when email is missing', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when username is missing', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when username is too short (fewer than 3 characters)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'ab', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/3.{0,5}20 characters/i);
  });

  it('returns 400 when username is too long (more than 20 characters)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'a'.repeat(21), password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/3.{0,5}20 characters/i);
  });

  it('returns 400 when username contains invalid characters (spaces)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'user name', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/letters, numbers, underscores/i);
  });

  it('returns 400 when username contains invalid characters (hyphens)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'user-name', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/letters, numbers, underscores/i);
  });

  it('accepts username with underscores at boundary lengths (3 and 20)', async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockTxUser.create.mockResolvedValueOnce({ id: 'u1', email: 'test@example.com', username: 'a_b' });

    const res3 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'a_b', password: 'password123', securityQuestions: validSqs }),
    });
    expect(res3.status).toBe(201);

    mockUser.findFirst.mockResolvedValue(null);
    mockTxUser.create.mockResolvedValueOnce({ id: 'u2', email: 'other@example.com', username: 'a'.repeat(20) });

    const res20 = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'other@example.com', username: 'a'.repeat(20), password: 'password123', securityQuestions: validSqs }),
    });
    expect(res20.status).toBe(201);
  });

  it('returns 400 when email has no @ symbol', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid email format/i);
  });

  it('returns 400 when email has no domain part after @', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid email format/i);
  });

  it('returns 400 when email has no TLD (no dot after domain)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@domain', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid email format/i);
  });

  it('accepts a valid email format with subdomain', async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockTxUser.create.mockResolvedValue({ id: 'user-123', email: 'user@mail.example.com', username: 'testuser' });

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@mail.example.com', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(201);
  });

  it('returns 400 when password is shorter than 6 characters', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'abc', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/6 characters/i);
  });

  it('returns 400 when password is exactly 5 characters (boundary)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'abc12', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(400);
  });

  it('accepts password of exactly 6 characters (boundary)', async () => {
    mockUser.findFirst.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'abc123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(201);
  });

  // ─── Security question validation ─────────────────────────────────────────

  it('returns 400 when securityQuestions is missing', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/two security questions/i);
  });

  it('returns 400 when securityQuestions has only one entry', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com', username: 'testuser', password: 'password123',
        securityQuestions: [{ questionKey: 'first_pet', answer: 'Fluffy' }],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/two security questions/i);
  });

  it('returns 400 when securityQuestions has three entries', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com', username: 'testuser', password: 'password123',
        securityQuestions: [
          { questionKey: 'first_pet', answer: 'Fluffy' },
          { questionKey: 'birth_city', answer: 'London' },
          { questionKey: 'first_job', answer: 'Baker' },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/two security questions/i);
  });

  it('returns 400 when a security answer is empty', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com', username: 'testuser', password: 'password123',
        securityQuestions: [
          { questionKey: 'first_pet', answer: '' },
          { questionKey: 'birth_city', answer: 'London' },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/non-empty answer/i);
  });

  it('returns 400 when a security answer is whitespace only', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com', username: 'testuser', password: 'password123',
        securityQuestions: [
          { questionKey: 'first_pet', answer: '   ' },
          { questionKey: 'birth_city', answer: 'London' },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/non-empty answer/i);
  });

  it('returns 400 when a question key is not in the predefined bank', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com', username: 'testuser', password: 'password123',
        securityQuestions: [
          { questionKey: 'unknown_question', answer: 'some answer' },
          { questionKey: 'birth_city', answer: 'London' },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid security question key/i);
  });

  it('returns 400 when both questions have the same key (duplicate)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com', username: 'testuser', password: 'password123',
        securityQuestions: [
          { questionKey: 'first_pet', answer: 'Fluffy' },
          { questionKey: 'first_pet', answer: 'Rover' },
        ],
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/distinct/i);
  });

  it('returns 409 with email conflict message when email is already registered', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'existing-user',
      email: 'test@example.com',
      username: 'otheruser',
    });

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'newuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/email already registered/i);
  });

  it('returns 409 with username conflict message when username is already taken', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'existing-user',
      email: 'other@example.com',
      username: 'testuser',
    });

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/username already taken/i);
  });

  it('returns 500 when DB throws during user lookup', async () => {
    mockUser.findFirst.mockRejectedValue(new Error('DB connection failed'));

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(500);
  });

  it('returns 500 when transaction throws during user creation', async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockTransaction.mockRejectedValueOnce(new Error('Insert failed'));

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'password123', securityQuestions: validSqs }),
    });

    expect(res.status).toBe(500);
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('returns 200 with token and user when logging in with email', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$hashed$',
    });
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never);

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'test@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; user: { id: string; email: string; username: string } };
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user).toEqual({ id: 'user-123', email: 'test@example.com', username: 'testuser' });
  });

  it('returns 200 with token and user when logging in with username', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$hashed$',
    });
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never);

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; user: { id: string; email: string; username: string } };
    expect(body.user).toEqual({ id: 'user-123', email: 'test@example.com', username: 'testuser' });
  });

  it('queries DB with OR clause matching both username and email', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$hashed$',
    });
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never);

    await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'testuser', password: 'password123' }),
    });

    expect(mockUser.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ username: 'testuser' }, { email: 'testuser' }] },
    });
  });

  it('calls bcrypt.compare with the provided password and stored hash', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$stored_hash$',
    });
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never);

    await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'testuser', password: 'mypassword' }),
    });

    expect(bcryptjs.compare).toHaveBeenCalledWith('mypassword', '$stored_hash$');
  });

  it('returns 400 when identifier is missing', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'testuser' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 401 with generic error when user does not exist', async () => {
    mockUser.findFirst.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'unknown', password: 'password123' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid credentials');
  });

  it('returns 401 with generic error when password is incorrect', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$hashed$',
    });
    vi.mocked(bcryptjs.compare).mockResolvedValue(false as never);

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'testuser', password: 'wrongpassword' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid credentials');
  });

  it('returns 401 when user has no password hash (e.g. created via another auth method)', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: null,
    });

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 500 when DB throws unexpectedly', async () => {
    mockUser.findFirst.mockRejectedValue(new Error('DB down'));

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(500);
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

describe('GET /auth/me', () => {
  it('returns 200 with user data for a valid Bearer token', async () => {
    const token = signToken({ userId: 'user-123', email: 'test@example.com' });
    mockUser.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { user: { id: string; email: string; username: string } };
    expect(body.user.id).toBe('user-123');
    expect(body.user.email).toBe('test@example.com');
    expect(body.user.username).toBe('testuser');
  });

  it('queries the DB by the userId from the JWT payload', async () => {
    const token = signToken({ userId: 'user-456', email: 'other@example.com' });
    mockUser.findUnique.mockResolvedValue({
      id: 'user-456',
      email: 'other@example.com',
      username: 'otheruser',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(mockUser.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-456' } })
    );
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await fetch(`${baseUrl}/me`);
    expect(res.status).toBe(401);
  });

  it('returns 401 when the token is invalid', async () => {
    const res = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: 'Bearer invalid.token.value' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when the Authorization header is malformed (no Bearer prefix)', async () => {
    const token = signToken({ userId: 'user-123', email: 'test@example.com' });
    const res = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: token },
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when user no longer exists in DB', async () => {
    const token = signToken({ userId: 'deleted-user', email: 'deleted@example.com' });
    mockUser.findUnique.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/not found/i);
  });

  it('returns 500 when DB throws unexpectedly', async () => {
    const token = signToken({ userId: 'user-123', email: 'test@example.com' });
    mockUser.findUnique.mockRejectedValue(new Error('DB down'));

    const res = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(500);
  });
});
