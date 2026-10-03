import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';

/**
 * "Continue with Google" for customers (OAuth 2.0 authorization code flow with PKCE, OpenID Connect ID token).
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET. Without them the button is hidden and the routes send people back to /login.
 */
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const GOOGLE_COOKIE = 'pal_google';
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const b64url = (b: Buffer) => b.toString('base64url');

export function newFlow() {
  const verifier = b64url(randomBytes(32));
  return { state: b64url(randomBytes(16)), nonce: b64url(randomBytes(16)), verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) };
}

export function authUrl(redirectUri: string, f: { state: string; nonce: string; challenge: string }) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile',
    state: f.state, nonce: f.nonce, code_challenge: f.challenge, code_challenge_method: 'S256', prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export interface GoogleProfile { email: string; name: string; sub: string }

/** Swaps the one-time code for tokens and verifies the signed ID token. Returns null unless Google says the email is verified. */
export async function finish(code: string, verifier: string, redirectUri: string, nonce: string): Promise<GoogleProfile | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, cache: 'no-store',
    body: new URLSearchParams({ code, code_verifier: verifier, redirect_uri: redirectUri, grant_type: 'authorization_code',
      client_id: process.env.GOOGLE_CLIENT_ID as string, client_secret: process.env.GOOGLE_CLIENT_SECRET as string }),
  });
  if (!res.ok) { console.error('[google token]', res.status, (await res.text()).slice(0, 200)); return null; }
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) return null;
  const { payload } = await jwtVerify(id_token, jwks, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: process.env.GOOGLE_CLIENT_ID as string });
  if (payload.nonce !== nonce || payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) return null;
  const email = payload.email.toLowerCase();
  const name = (typeof payload.name === 'string' && payload.name.trim()) || email.split('@')[0];
  return { email, name: name.slice(0, 120), sub: payload.sub };
}
