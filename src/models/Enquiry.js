import mongoose from 'mongoose';

const enquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  email: { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
  eventDate: { type: Date, default: null },
  eventType: { type: String, trim: true, maxlength: 100, default: '' },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  referenceImage: { type: String, default: '' },
  status: { type: String, enum: ['new', 'contacted', 'booked', 'closed'], default: 'new' },
  notes: { type: String, maxlength: 2000, default: '' },
}, { timestamps: true });

export default mongoose.model('Enquiry', enquirySchema);
