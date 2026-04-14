import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer } from 'http';
import type { Server } from 'http';
import type { AddressInfo } from 'net';

// vi.hoisted runs before vi.mock factories (which are hoisted to top of file)
const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../services/db.ts', () => ({
  prisma: { user: mockUser },
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
  // Default: hash returns a predictable value
  vi.mocked(bcryptjs.hash).mockResolvedValue('$hashed$' as never);
});

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates a user and returns 201 with token and user on success', async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockUser.create.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
    });

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { token: string; user: { id: string; email: string; username: string } };
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user).toEqual({ id: 'user-123', email: 'test@example.com', username: 'testuser' });
  });

  it('hashes the password with cost factor 12 and stores the hash', async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockUser.create.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
    });

    await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'mypassword' }),
    });

    expect(bcryptjs.hash).toHaveBeenCalledWith('mypassword', 12);
    expect(mockUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: '$hashed$' }),
      })
    );
  });

  it('returns 400 when email is missing', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when username is missing', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when password is missing', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when email has no @ symbol', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid email format/i);
  });

  it('returns 400 when email has no domain part after @', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@', username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid email format/i);
  });

  it('returns 400 when email has no TLD (no dot after domain)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@domain', username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid email format/i);
  });

  it('accepts a valid email format with subdomain', async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockUser.create.mockResolvedValue({
      id: 'user-123',
      email: 'user@mail.example.com',
      username: 'testuser',
    });

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@mail.example.com', username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(201);
  });

  it('returns 400 when password is shorter than 6 characters', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'abc' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/6 characters/i);
  });

  it('returns 400 when password is exactly 5 characters (boundary)', async () => {
    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'abc12' }),
    });

    expect(res.status).toBe(400);
  });

  it('accepts password of exactly 6 characters (boundary)', async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockUser.create.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
    });

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'abc123' }),
    });

    expect(res.status).toBe(201);
  });

  it('returns 409 with email conflict message when email is already registered', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'existing-user',
      email: 'test@example.com',   // same email
      username: 'otheruser',
    });

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'newuser', password: 'password123' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/email already registered/i);
  });

  it('returns 409 with username conflict message when username is already taken', async () => {
    mockUser.findFirst.mockResolvedValue({
      id: 'existing-user',
      email: 'other@example.com',  // different email
      username: 'testuser',        // same username
    });

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', username: 'testuser', password: 'password123' }),
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
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(500);
  });

  it('returns 500 when DB throws during user creation', async () => {
    mockUser.findFirst.mockResolvedValue(null);
    mockUser.create.mockRejectedValue(new Error('Insert failed'));

    const res = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', username: 'testuser', password: 'password123' }),
    });

    expect(res.status).toBe(500);
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('returns 200 with token and user on correct credentials', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$hashed$',
    });
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never);

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { token: string; user: { id: string; email: string; username: string } };
    expect(body.token).toBeDefined();
    expect(typeof body.token).toBe('string');
    expect(body.user).toEqual({ id: 'user-123', email: 'test@example.com', username: 'testuser' });
  });

  it('calls bcrypt.compare with the provided password and stored hash', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$stored_hash$',
    });
    vi.mocked(bcryptjs.compare).mockResolvedValue(true as never);

    await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'mypassword' }),
    });

    expect(bcryptjs.compare).toHaveBeenCalledWith('mypassword', '$stored_hash$');
  });

  it('returns 400 when email is missing', async () => {
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
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/required/i);
  });

  it('returns 401 when user does not exist', async () => {
    mockUser.findUnique.mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it('returns 401 when password is incorrect', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: '$hashed$',
    });
    vi.mocked(bcryptjs.compare).mockResolvedValue(false as never);

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrongpassword' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid/i);
  });

  it('returns 401 when user has no password hash (e.g. created via another auth method)', async () => {
    mockUser.findUnique.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: null,
    });

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 500 when DB throws unexpectedly', async () => {
    mockUser.findUnique.mockRejectedValue(new Error('DB down'));

    const res = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
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
