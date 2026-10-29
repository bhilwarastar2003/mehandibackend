import { Router } from 'express';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { requireAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { saveImage, deleteImage } from '../utils/imageStorage.js';
import Admin from '../models/Admin.js';
import Design from '../models/Design.js';
import Category from '../models/Category.js';
import Enquiry from '../models/Enquiry.js';
import SiteSetting from '../models/SiteSetting.js';
import HeroSlide from '../models/HeroSlide.js';
import Service from '../models/Service.js';
import Testimonial from '../models/Testimonial.js';
import StoryCard from '../models/StoryCard.js';
import { getSiteSettings, replaceContentItems } from '../utils/siteContent.js';

const router = Router();
router.use(requireAdmin);

router.post('/images', upload.single('image'), async (req, res) => {
  const image = await saveImage(req.file);
  res.status(201).json({ url: image.url });
});

router.patch('/password', async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 12 || newPassword.length > 200) return res.status(400).json({ message: 'New password must be 12–200 characters.' });
  const admin = await Admin.findById(req.admin._id);
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) return res.status(400).json({ message: 'Current password is incorrect.' });
  admin.passwordHash = await bcrypt.hash(newPassword, 12);
  await admin.save();
  res.json({ message: 'Password updated.' });
});

router.get('/dashboard', async (_req, res) => {
  const [designs, published, categories, enquiries, recent] = await Promise.all([
    Design.countDocuments(), Design.countDocuments({ status: 'published' }), Category.countDocuments(), Enquiry.countDocuments({ status: 'new' }),
    Design.find().sort({ createdAt: -1 }).limit(5).populate('categoryId', 'name').lean(),
  ]);
  res.json({ designs, published, categories, enquiries, recent });
});

router.get('/designs', async (_req, res) => res.json(await Design.find().populate('categoryId', 'name slug').sort({ createdAt: -1 }).lean()));
router.post('/designs', upload.single('image'), async (req, res) => {
  const payload = parseDesign(req.body);
  const imageUrl = String(req.body?.imageUrl || '').trim();
  if (!req.file && !isSafeImageUrl(imageUrl)) return res.status(400).json({ message: 'Choose an image file or enter a valid https image URL.' });
  const image = req.file ? await saveImage(req.file) : null;
  try {
    const finalImageUrl = image?.url || imageUrl;
    const design = await Design.create({ ...payload, imageUrl: finalImageUrl, thumbnailUrl: finalImageUrl });
    res.status(201).json(design);
  } catch (error) { if (image) await deleteImage(image.url); throw error; }
});
router.patch('/designs/:id', upload.single('image'), async (req, res) => {
  const design = await Design.findById(req.params.id);
  if (!design) return res.status(404).json({ message: 'Design not found.' });
  const payload = parseDesign(req.body, true);
  Object.assign(design, payload);
  const oldImage = design.imageUrl;
  if (req.file) {
    const image = await saveImage(req.file);
    design.imageUrl = image.url;
  } else if (req.body.imageUrl !== undefined) {
    const imageUrl = String(req.body.imageUrl || '').trim();
    if (imageUrl && !isSafeImageUrl(imageUrl)) return res.status(400).json({ message: 'Image URL must be https:// or a local upload path.' });
    design.imageUrl = imageUrl;
  }
  design.thumbnailUrl = design.imageUrl;
  await design.save();
  if (oldImage && oldImage !== design.imageUrl) await deleteImageIfUnused(oldImage);
  res.json(design);
});
router.delete('/designs/:id', async (req, res) => {
  const design = await Design.findByIdAndDelete(req.params.id);
  if (!design) return res.status(404).json({ message: 'Design not found.' });
  await deleteImageIfUnused(design.imageUrl);
  res.json({ message: 'Design deleted.' });
});

router.get('/categories', async (_req, res) => res.json(await Category.find().sort({ sortOrder: 1, name: 1 }).lean()));
router.post('/categories', upload.single('image'), async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (name.length < 2 || name.length > 80) return res.status(400).json({ message: 'Category name must be 2–80 characters.' });
  const slug = slugify(String(req.body?.slug || name), { lower: true, strict: true });
  if (!slug) return res.status(400).json({ message: 'Enter a valid category slug.' });
  const imageUrl = String(req.body?.imageUrl || '').trim();
  if (!req.file && imageUrl && !isSafeImageUrl(imageUrl)) return res.status(400).json({ message: 'Category image URL must be https:// or a local upload path.' });
  let image;
  try {
    if (req.file) image = await saveImage(req.file);
    const category = await Category.create({ name, slug, description: String(req.body?.description || '').slice(0, 500), coverImage: image?.url || imageUrl, active: req.body?.active !== false, sortOrder: Number(req.body?.sortOrder) || 0 });
    res.status(201).json(category);
  } catch (error) { if (image) await deleteImage(image.url); throw error; }
});
router.patch('/categories/:id', upload.single('image'), async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  if (req.body.name !== undefined) category.name = String(req.body.name).trim().slice(0, 80);
  if (req.body.slug !== undefined) category.slug = slugify(String(req.body.slug), { lower: true, strict: true });
  if (req.body.description !== undefined) category.description = String(req.body.description).slice(0, 500);
  if (req.body.active !== undefined) category.active = req.body.active === true || req.body.active === 'true';
  if (req.body.sortOrder !== undefined) category.sortOrder = Number(req.body.sortOrder) || 0;
  const oldImage = category.coverImage;
  if (req.file) { const image = await saveImage(req.file); category.coverImage = image.url; }
  else if (req.body.imageUrl !== undefined) {
    const imageUrl = String(req.body.imageUrl || '').trim();
    if (imageUrl && !isSafeImageUrl(imageUrl)) return res.status(400).json({ message: 'Category image URL must be https:// or a local upload path.' });
    category.coverImage = imageUrl;
  }
  await category.save();
  if (oldImage && oldImage !== category.coverImage) await deleteImageIfUnused(oldImage);
  res.json(category);
});
router.delete('/categories/:id', async (req, res) => {
  if (await Design.exists({ categoryId: req.params.id })) return res.status(409).json({ message: 'Move or delete designs in this category first.' });
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  await deleteImageIfUnused(category.coverImage);
  res.json({ message: 'Category deleted.' });
});

router.get('/settings', async (_req, res) => res.json(await getSiteSettings()));
router.patch('/settings', async (req, res) => {
  const previous = await getSiteSettings();
  const allowed = ['brandName', 'logoUrl', 'logoWidth', 'logoHeight', 'logoDesktopWidth', 'logoDesktopHeight', 'logoTabletWidth', 'logoTabletHeight', 'logoMobileWidth', 'logoMobileHeight', 'heroTitle', 'heroSubtitle', 'heroImageUrl', 'backgroundImageUrl', 'bookingBannerImageUrl', 'bookingBannerBackgroundColor', 'heroButtonLabel', 'heroButtonUrl', 'aboutTitle', 'aboutText', 'aboutImageUrl', 'phone', 'email', 'whatsappUrl', 'whatsappNumber', 'address', 'instagramUrl', 'facebookUrl', 'seoTitle', 'seoDescription'];
  const update = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) update[key] = req.body[key];
  const content = {};
  for (const key of ['services', 'testimonials', 'storyCards']) if (req.body?.[key] !== undefined) content[key] = req.body[key];
  for (const key of ['logoWidth', 'logoHeight', 'logoDesktopWidth', 'logoDesktopHeight', 'logoTabletWidth', 'logoTabletHeight', 'logoMobileWidth', 'logoMobileHeight']) {
    if (update[key] !== undefined && (!Number.isInteger(Number(update[key])) || Number(update[key]) < 20 || Number(update[key]) > 200)) return res.status(400).json({ message: `${key} must be a whole number between 20 and 200 pixels.` });
    if (update[key] !== undefined) update[key] = Number(update[key]);
  }
  if (update.whatsappNumber !== undefined) {
    const digits = String(update.whatsappNumber).replace(/\D/g, '');
    if (digits && (digits.length < 8 || digits.length > 15)) return res.status(400).json({ message: 'WhatsApp number must include the country code and contain 8 to 15 digits.' });
    update.whatsappNumber = digits;
  }
  for (const key of ['whatsappUrl', 'instagramUrl', 'facebookUrl', 'heroButtonUrl']) {
    if (update[key] !== undefined && !isSafeLink(String(update[key]), key === 'heroButtonUrl')) return res.status(400).json({ message: `${key} must be a valid https URL${key === 'heroButtonUrl' ? ' or an internal path beginning with /' : ''}.` });
  }
  for (const key of ['logoUrl', 'heroImageUrl', 'aboutImageUrl', 'backgroundImageUrl', 'bookingBannerImageUrl']) {
    if (update[key] !== undefined && update[key] && !isSafeImageUrl(String(update[key]))) return res.status(400).json({ message: `${key} must be an https URL or local upload path.` });
  }
  if (update.bookingBannerBackgroundColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(String(update.bookingBannerBackgroundColor))) return res.status(400).json({ message: 'Booking banner color must be a six-digit hex color.' });
  if (content.services) {
    if (!Array.isArray(content.services) || content.services.length > 30) return res.status(400).json({ message: 'Services must be a list of up to 30 items.' });
    for (const service of content.services) {
      if (!service || typeof service !== 'object' || typeof service.name !== 'string' || !service.name.trim() || service.name.length > 120) return res.status(400).json({ message: 'Each service needs a name of up to 120 characters.' });
      if (service.description && String(service.description).length > 1200) return res.status(400).json({ message: 'Service descriptions must be 1,200 characters or fewer.' });
      if (service.ctaUrl && !isSafeLink(String(service.ctaUrl), true)) return res.status(400).json({ message: 'Service links must be https URLs or internal paths beginning with /.' });
      if (service.imageUrl && !isSafeImageUrl(String(service.imageUrl))) return res.status(400).json({ message: 'Service images must use an https URL or local upload path.' });
    }
  }
  if (content.testimonials) {
    if (!Array.isArray(content.testimonials) || content.testimonials.length > 30) return res.status(400).json({ message: 'Testimonials must be a list of up to 30 items.' });
    for (const item of content.testimonials) {
      if (!item || typeof item !== 'object' || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100) return res.status(400).json({ message: 'Each testimonial needs a client name of up to 100 characters.' });
      if (typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 1200) return res.status(400).json({ message: 'Each review must be 1–1,200 characters.' });
      if (item.imageUrl && !isSafeImageUrl(String(item.imageUrl))) return res.status(400).json({ message: 'Testimonial images must use an https URL or local upload path.' });
    }
  }
  if (content.storyCards) {
    if (!Array.isArray(content.storyCards) || content.storyCards.length > 20) return res.status(400).json({ message: 'Our Story can contain up to 20 cards.' });
    for (const card of content.storyCards) {
      if (!card || typeof card !== 'object' || typeof card.title !== 'string' || !card.title.trim() || card.title.length > 120) return res.status(400).json({ message: 'Each story card needs a title of up to 120 characters.' });
      if (typeof card.text !== 'string' || !card.text.trim() || card.text.length > 2000) return res.status(400).json({ message: 'Each story card needs text of up to 2,000 characters.' });
      if (card.imageUrl && !isSafeImageUrl(String(card.imageUrl))) return res.status(400).json({ message: 'Story card images must use an https URL or local upload path.' });
    }
  }
  for (const key of ['brandName', 'heroTitle', 'heroSubtitle', 'aboutTitle', 'aboutText', 'phone', 'email', 'address', 'seoTitle', 'seoDescription']) {
    if (typeof update[key] === 'string') update[key] = update[key].slice(0, key.endsWith('Text') || key === 'aboutText' ? 4000 : 300);
  }
  await SiteSetting.findOneAndUpdate({ key: 'main' }, { $set: update, $setOnInsert: { key: 'main' } }, { upsert: true, new: true, runValidators: true });
  if (content.services) await replaceContentItems(Service, content.services);
  if (content.testimonials) await replaceContentItems(Testimonial, content.testimonials);
  if (content.storyCards) await replaceContentItems(StoryCard, content.storyCards);
  const settings = await getSiteSettings();
  const currentImageUrls = new Set([settings.logoUrl, settings.heroImageUrl, settings.aboutImageUrl, settings.backgroundImageUrl, settings.bookingBannerImageUrl, ...settings.services.map((service) => service.imageUrl), ...settings.testimonials.map((item) => item.imageUrl), ...settings.storyCards.map((card) => card.imageUrl)].filter(Boolean));
  const previousImageUrls = [previous?.logoUrl, previous?.heroImageUrl, previous?.aboutImageUrl, previous?.backgroundImageUrl, previous?.bookingBannerImageUrl, ...(previous?.services || []).map((service) => service.imageUrl), ...(previous?.testimonials || []).map((item) => item.imageUrl), ...(previous?.storyCards || []).map((card) => card.imageUrl)].filter(Boolean);
  await Promise.all([...new Set(previousImageUrls)].filter((url) => !currentImageUrls.has(url)).map((url) => deleteImageIfUnused(url).catch(() => {})));
  res.json(settings);
});

router.get('/slides', async (_req, res) => res.json(await HeroSlide.find().sort({ order: 1, createdAt: 1 }).lean()));
router.post('/slides', upload.single('image'), async (req, res) => {
  const title = String(req.body?.title || '').trim();
  if (title.length < 2 || title.length > 120) return res.status(400).json({ message: 'Slide title must be 2–120 characters.' });
  const imageUrl = String(req.body?.imageUrl || '').trim();
  if (!req.file && !isSafeImageUrl(imageUrl)) return res.status(400).json({ message: 'Choose an image file or enter a valid https image URL.' });
  if (await HeroSlide.countDocuments() >= 12) return res.status(400).json({ message: 'You can add up to 12 home slides.' });
  const buttonUrl = String(req.body?.buttonUrl || '/gallery').trim();
  if (!isSafeLink(buttonUrl, true)) return res.status(400).json({ message: 'Button link must be https:// or an internal path beginning with /.' });
  const image = req.file ? await saveImage(req.file) : null;
  try {
    const slide = await HeroSlide.create({ title, subtitle: String(req.body?.subtitle || '').slice(0, 500), imageUrl: image?.url || imageUrl, buttonLabel: String(req.body?.buttonLabel || 'Explore the collection').slice(0, 80), buttonUrl, order: Number(req.body?.order) || 0, visible: req.body?.visible !== 'false' });
    res.status(201).json(slide);
  } catch (error) { if (image) await deleteImage(image.url); throw error; }
});
router.patch('/slides/:id', upload.single('image'), async (req, res) => {
  const slide = await HeroSlide.findById(req.params.id);
  if (!slide) return res.status(404).json({ message: 'Slide not found.' });
  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (title.length < 2 || title.length > 120) return res.status(400).json({ message: 'Slide title must be 2–120 characters.' });
    slide.title = title;
  }
  if (req.body.subtitle !== undefined) slide.subtitle = String(req.body.subtitle).slice(0, 500);
  if (req.body.buttonLabel !== undefined) slide.buttonLabel = String(req.body.buttonLabel).slice(0, 80);
  if (req.body.buttonUrl !== undefined) {
    const buttonUrl = String(req.body.buttonUrl).trim();
    if (!isSafeLink(buttonUrl, true)) return res.status(400).json({ message: 'Button link must be https:// or an internal path beginning with /.' });
    slide.buttonUrl = buttonUrl;
  }
  if (req.body.order !== undefined) slide.order = Number(req.body.order) || 0;
  if (req.body.visible !== undefined) slide.visible = req.body.visible === true || req.body.visible === 'true';
  const oldImage = slide.imageUrl;
  if (req.file) { const image = await saveImage(req.file); slide.imageUrl = image.url; }
  else if (req.body.imageUrl !== undefined && req.body.imageUrl) {
    const imageUrl = String(req.body.imageUrl).trim();
    if (!isSafeImageUrl(imageUrl)) return res.status(400).json({ message: 'Image URL must be https:// or a local upload path.' });
    slide.imageUrl = imageUrl;
  }
  await slide.save();
  if (oldImage && oldImage !== slide.imageUrl) await deleteImageIfUnused(oldImage);
  res.json(slide);
});
router.delete('/slides/:id', async (req, res) => {
  const slide = await HeroSlide.findByIdAndDelete(req.params.id);
  if (!slide) return res.status(404).json({ message: 'Slide not found.' });
  await deleteImageIfUnused(slide.imageUrl);
  res.json({ message: 'Slide deleted.' });
});

router.get('/enquiries', async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  res.json(await Enquiry.find(filter).sort({ createdAt: -1 }).lean());
});
router.patch('/enquiries/:id', async (req, res) => {
  const allowed = ['status', 'notes']; const update = {};
  for (const key of allowed) if (req.body?.[key] !== undefined) update[key] = req.body[key];
  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!enquiry) return res.status(404).json({ message: 'Enquiry not found.' });
  res.json(enquiry);
});
router.delete('/enquiries/:id', async (req, res) => {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
  if (!enquiry) return res.status(404).json({ message: 'Enquiry not found.' });
  res.json({ message: 'Enquiry deleted.' });
});

function parseDesign(body, partial = false) {
  const result = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || '').trim();
    if (title.length < 2 || title.length > 120) throw Object.assign(new Error('Title must be 2–120 characters.'), { status: 400 });
    result.title = title;
  }
  if (!partial || body.categoryId !== undefined) {
    if (!body.categoryId) throw Object.assign(new Error('Choose a category.'), { status: 400 });
    result.categoryId = body.categoryId;
  }
  for (const key of ['description', 'altText']) if (body[key] !== undefined) result[key] = String(body[key]).trim();
  if (body.externalUrl !== undefined) {
    result.externalUrl = String(body.externalUrl).trim();
    if (result.externalUrl && !isSafeLink(result.externalUrl, false)) throw Object.assign(new Error('External link must use https:// or http://.'), { status: 400 });
  }
  if (body.slug !== undefined || body.title !== undefined || !partial) {
    const slug = slugify(String(body.slug || body.title || ''), { lower: true, strict: true });
    if (!slug) throw Object.assign(new Error('Enter a valid title or slug.'), { status: 400 });
    result.slug = slug;
  }
  if (body.tags !== undefined) result.tags = String(body.tags).split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
  for (const key of ['featured', 'status', 'sortOrder']) if (body[key] !== undefined) result[key] = key === 'featured' ? body[key] === 'true' || body[key] === true : key === 'sortOrder' ? Number(body[key]) || 0 : body[key];
  return result;
}

function isSafeLink(value, allowInternal) {
  if (!value) return true;
  if (/^https:\/\//i.test(value)) return true;
  if (!allowInternal && /^http:\/\//i.test(value)) return true;
  return allowInternal && value.startsWith('/') && !value.startsWith('//') && !/[\\\u0000-\u001f]/.test(value);
}

function isSafeImageUrl(value) {
  return /^https:\/\//i.test(value) || (value.startsWith('/uploads/') && !/[\\\u0000-\u001f]/.test(value));
}

async function deleteImageIfUnused(url) {
  if (!url) return;
  const isManagedLocal = /^\/uploads\/[a-z0-9-]+\.(?:jpg|png|webp|avif)$/i.test(url);
  const isManagedCloud = /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:v\d+\/)?mehndi-creations\//i.test(url);
  if (!isManagedLocal && !isManagedCloud) return;
  const [design, category, settings, slide, service, testimonial, storyCard] = await Promise.all([
    Design.exists({ $or: [{ imageUrl: url }, { thumbnailUrl: url }] }),
    Category.exists({ coverImage: url }),
    SiteSetting.exists({ $or: [{ logoUrl: url }, { heroImageUrl: url }, { aboutImageUrl: url }, { backgroundImageUrl: url }, { bookingBannerImageUrl: url }] }),
    HeroSlide.exists({ imageUrl: url }),
    Service.exists({ imageUrl: url }),
    Testimonial.exists({ imageUrl: url }),
    StoryCard.exists({ imageUrl: url }),
  ]);
  if (!design && !category && !settings && !slide && !service && !testimonial && !storyCard) await deleteImage(url);
}

export default router;
