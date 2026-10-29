import mongoose from 'mongoose';

const heroSlideSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subtitle: { type: String, trim: true, maxlength: 500, default: '' },
  imageUrl: { type: String, required: true },
  buttonLabel: { type: String, trim: true, maxlength: 80, default: 'Explore the collection' },
  buttonUrl: { type: String, trim: true, maxlength: 500, default: '/gallery' },
  order: { type: Number, default: 0 },
  visible: { type: Boolean, default: true },
}, { timestamps: true });

heroSlideSchema.index({ visible: 1, order: 1, createdAt: 1 });
export default mongoose.model('HeroSlide', heroSlideSchema);
