import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from './db';
import { AppError } from './errors';
import { can, isStaff, type Permission } from './rbac';

const COOKIE = 'pal_session';
const MAX_AGE = 60 * 60 * 24 * 7;
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set to at least 32 characters');
  return new TextEncoder().encode(s);
};

export interface SessionUser { id: string; email: string; name: string; role: Role }

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function assertStrongPassword(pw: string) {
  if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    throw new AppError(422, 'WEAK_PASSWORD', 'Password must be at least 8 characters and include a letter and a number.', { password: 'Use 8+ characters with a letter and a number.' });
  }
}

export async function startSession(user: SessionUser) {
  const token = await new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime(`${MAX_AGE}s`).sign(secret());
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE });
}
export function endSession() { cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 }); }

/** Current user from the signed cookie, re-checked against the database so deactivated users lose access immediately. */
export async function getUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const u = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, email: true, name: true, role: true, isActive: true } });
    if (!u || !u.isActive) return null;
    return { id: u.id, email: u.email, name: u.name, role: u.role };
  } catch { return null; }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  return u;
}
export async function requireStaff(perm?: Permission): Promise<SessionUser> {
  const u = await requireUser();
  if (!isStaff(u.role)) throw new AppError(403, 'FORBIDDEN', 'You do not have access to the admin area.');
  if (perm && !can(u.role, perm)) throw new AppError(403, 'FORBIDDEN', 'Your role does not allow this action.');
  return u;
}
export async function requireCustomer() {
  const u = await requireUser();
  const customer = await prisma.customer.findUnique({ where: { userId: u.id } });
  if (!customer) throw new AppError(403, 'NO_CUSTOMER', 'No customer profile for this account.');
  return { user: u, customer };
}

// Simple in-memory login throttle (per server instance). Use Redis or your host's WAF for multi-instance deployments.
const attempts = new Map<string, { n: number; t: number }>();
export function throttle(key: string, max = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.t > windowMs) { attempts.set(key, { n: 1, t: now }); return; }
  a.n++;
  if (a.n > max) throw new AppError(429, 'RATE_LIMIT', 'Too many attempts. Please wait a few minutes and try again.');
}
export const clearThrottle = (key: string) => attempts.delete(key);
