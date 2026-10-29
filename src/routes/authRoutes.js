import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';
import { requireAdmin, requireAllowedOrigin } from '../middleware/auth.js';

const router = Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many sign in attempts. Try again later.' } });
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', path: '/', maxAge: 24 * 60 * 60 * 1000 });

router.post('/login', requireAllowedOrigin, loginLimit, async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  if (!email || !password || email.length > 200 || password.length > 200) return res.status(400).json({ message: 'Enter your email and password.' });
  const admin = await Admin.findOne({ email });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  const token = jwt.sign({ sub: admin._id.toString(), role: admin.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
  res.cookie('adminToken', token, cookieOptions()).json({ admin: { email: admin.email, role: admin.role } });
});

router.post('/logout', requireAllowedOrigin, (_req, res) => res.clearCookie('adminToken', cookieOptions()).json({ message: 'Signed out.' }));
router.get('/me', requireAdmin, (req, res) => res.json({ admin: { email: req.admin.email, role: req.admin.role } }));
export default router;
