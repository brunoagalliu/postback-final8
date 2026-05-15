import crypto from 'crypto';

const SESSION_COOKIE = 'admin_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret) throw new Error('SESSION_SECRET env var is not set');
    return secret;
}

export function createSessionToken(username) {
    const payload = Buffer.from(JSON.stringify({
        username,
        exp: Date.now() + SESSION_DURATION_MS,
    })).toString('base64url');

    const sig = crypto
        .createHmac('sha256', getSecret())
        .update(payload)
        .digest('hex');

    return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
    if (!token) return null;
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;

    const expected = crypto
        .createHmac('sha256', getSecret())
        .update(payload)
        .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
        return null;
    }

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null;

    return data;
}

export function getSessionFromRequest(req) {
    const raw = req.cookies?.[SESSION_COOKIE] ?? '';
    return verifySessionToken(raw);
}

export function setSessionCookie(res, token) {
    res.setHeader('Set-Cookie', [
        `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_DURATION_MS / 1000}`,
    ]);
}

export function clearSessionCookie(res) {
    res.setHeader('Set-Cookie', [
        `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
    ]);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
