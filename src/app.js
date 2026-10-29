import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import publicRoutes from './routes/publicRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
app.use(cookieParser());
const here = path.dirname(fileURLToPath(import.meta.url));
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'], imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc: ["'self'", ...clientOrigin.split(',').map((value) => value.trim())], objectSrc: ["'none'"], baseUri: ["'self'"],
  } },
}));
app.use(cors({ origin: clientOrigin.split(',').map((value) => value.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'));
app.use('/uploads', express.static(path.resolve(here, '../uploads'), { maxAge: '7d', immutable: true, dotfiles: 'deny' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', publicRoutes);
app.use('/api/admin', authRoutes);
app.use('/api/admin', adminRoutes);
app.use((_req, res) => res.status(404).json({ message: 'The requested resource was not found.' }));
app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.status || (error.name === 'ValidationError' ? 400 : error.code === 11000 ? 409 : error.name === 'CastError' ? 400 : 500);
  res.status(status).json({ message: status >= 500 ? 'Something went wrong. Please try again.' : error.message });
});

export default app;
