import mongoose from 'mongoose';

const storyCardSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  imageUrl: { type: String, default: '' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

storyCardSchema.index({ sortOrder: 1, createdAt: 1 });
export default mongoose.model('StoryCard', storyCardSchema);
