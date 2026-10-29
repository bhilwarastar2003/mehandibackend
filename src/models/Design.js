import mongoose from 'mongoose';

const designSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true, maxlength: 3000, default: '' },
  imageUrl: { type: String, required: true },
  thumbnailUrl: { type: String, default: '' },
  altText: { type: String, trim: true, maxlength: 200, default: '' },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  tags: [{ type: String, trim: true, maxlength: 40 }],
  externalUrl: { type: String, trim: true, maxlength: 500, default: '' },
  featured: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

designSchema.index({ status: 1, categoryId: 1, sortOrder: 1, createdAt: -1 });
export default mongoose.model('Design', designSchema);
