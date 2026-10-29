import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export function requireAllowedOrigin(req, res, next) {
  const allowed = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((value) => value.trim().replace(/\/$/, ''));
  if (!req.get('origin') || !allowed.includes(req.get('origin').replace(/\/$/, ''))) return res.status(403).json({ message: 'Request origin is not allowed.' });
  next();
}

export async function requireAdmin(req, res, next) {
  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const allowed = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((value) => value.trim().replace(/\/$/, ''));
      if (!req.get('origin') || !allowed.includes(req.get('origin').replace(/\/$/, ''))) return res.status(403).json({ message: 'Request origin is not allowed.' });
    }
    const token =
      req.cookies?.adminToken ||
      req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Admin sign in required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(payload.sub).select('_id email role');
    if (!admin) return res.status(401).json({ message: 'Session is no longer valid.' });
    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
}
