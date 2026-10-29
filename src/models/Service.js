import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1200, default: '' },
  price: { type: String, maxlength: 80, default: '' },
  imageUrl: { type: String, default: '' },
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  ctaLabel: { type: String, maxlength: 80, default: 'Enquire now' },
  ctaUrl: { type: String, maxlength: 500, default: '/contact' },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

serviceSchema.index({ sortOrder: 1, createdAt: 1 });
export default mongoose.model('Service', serviceSchema);
