import crypto from 'crypto';
import { createSessionToken, setSessionCookie } from '../../../lib/auth.js';

function safeCompare(a, b) {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
        // Still run timingSafeEqual to avoid timing leaks on length
        crypto.timingSafeEqual(aBuf, aBuf);
        return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
}

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { username, password } = req.body;

    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (!validUsername || !validPassword) {
        return res.status(500).json({ message: 'Auth credentials not configured' });
    }

    if (!safeCompare(username ?? '', validUsername) || !safeCompare(password ?? '', validPassword)) {
        return res.status(401).json({ message: 'Invalid username or password' });
    }

    const token = createSessionToken(username);
    setSessionCookie(res, token);

    return res.status(200).json({ success: true });
}
