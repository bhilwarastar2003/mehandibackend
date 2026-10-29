import mongoose from 'mongoose';

const testimonialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  quote: { type: String, required: true, trim: true, maxlength: 1200 },
  event: { type: String, trim: true, maxlength: 120, default: '' },
  imageUrl: { type: String, default: '' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

testimonialSchema.index({ sortOrder: 1, createdAt: 1 });
export default mongoose.model('Testimonial', testimonialSchema);
