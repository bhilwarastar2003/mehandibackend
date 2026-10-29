import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import slugify from 'slugify';
import Design from '../models/Design.js';
import Category from '../models/Category.js';
import Enquiry from '../models/Enquiry.js';
import HeroSlide from '../models/HeroSlide.js';
import { getSiteSettings } from '../utils/siteContent.js';

const router = Router();
const enquiryLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many enquiries. Please try again later.' } });

router.get('/designs', async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const filter = { status: 'published' };
  if (req.query.category) {
    const category = await Category.findOne({ slug: String(req.query.category), active: true }).select('_id');
    if (!category) return res.json({ items: [], page, pages: 0, total: 0 });
    filter.categoryId = category._id;
  }
  if (req.query.search) filter.$or = [
    { title: { $regex: escapeRegex(String(req.query.search).slice(0, 80)), $options: 'i' } },
    { description: { $regex: escapeRegex(String(req.query.search).slice(0, 80)), $options: 'i' } },
    { tags: { $regex: escapeRegex(String(req.query.search).slice(0, 80)), $options: 'i' } },
  ];
  const [items, total] = await Promise.all([
    Design.find(filter).populate('categoryId', 'name slug').sort({ featured: -1, sortOrder: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Design.countDocuments(filter),
  ]);
  res.json({ items, page, pages: Math.ceil(total / limit), total });
});

router.get('/designs/:slug', async (req, res) => {
  const design = await Design.findOne({ slug: req.params.slug, status: 'published' }).populate('categoryId', 'name slug').lean();
  if (!design) return res.status(404).json({ message: 'Design not found.' });
  const related = await Design.find({ status: 'published', categoryId: design.categoryId?._id, _id: { $ne: design._id } }).sort({ featured: -1, createdAt: -1 }).limit(3).populate('categoryId', 'name slug').lean();
  res.json({ design, related });
});

router.get('/categories', async (_req, res) => res.json(await Category.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean()));
router.get('/slides', async (_req, res) => res.json(await HeroSlide.find({ visible: true }).sort({ order: 1, createdAt: 1 }).lean()));
router.get('/settings', async (_req, res) => res.json(await getSiteSettings()));

router.get('/sitemap.xml', async (_req, res) => {
  const base = (process.env.SITE_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
  const [designs, categories] = await Promise.all([
    Design.find({ status: 'published' }).select('slug updatedAt').lean(),
    Category.find({ active: true }).select('slug').lean(),
  ]);
  const urls = ['', '/gallery', '/services', '/about', '/contact', ...categories.map((item) => `/gallery?category=${encodeURIComponent(item.slug)}`), ...designs.map((item) => `/design/${encodeURIComponent(item.slug)}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeXml(`${base}${url}`)}</loc></url>`).join('')}</urlset>`;
  res.type('application/xml').send(xml);
});

router.post('/enquiries', enquiryLimit, async (req, res) => {
  const { name, phone, email = '', eventDate, eventType = '', message, referenceImage = '', website } = req.body || {};
  // Honeypot field; bots receive success without storing a record.
  if (website) return res.status(201).json({ message: 'Thank you. Your enquiry has been received.' });
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) return res.status(400).json({ message: 'Please enter your name.' });
  if (typeof phone !== 'string' || !/^[+\d()\s.-]{7,30}$/.test(phone)) return res.status(400).json({ message: 'Please enter a valid phone number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (typeof message !== 'string' || message.trim().length < 5 || message.length > 2000) return res.status(400).json({ message: 'Please add a short message.' });
  const doc = await Enquiry.create({ name: name.trim(), phone: phone.trim(), email: String(email).trim(), eventDate: eventDate || null, eventType: String(eventType).slice(0, 100), message: message.trim(), referenceImage: String(referenceImage).slice(0, 1000) });
  res.status(201).json({ message: 'Thank you. Your enquiry has been received.', id: doc._id });
});

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escapeXml(value) { return value.replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]); }
export default router;
