import mongoose from 'mongoose';
import SiteSetting from '../models/SiteSetting.js';
import Service from '../models/Service.js';
import Testimonial from '../models/Testimonial.js';
import StoryCard from '../models/StoryCard.js';

const contentModels = [
  ['services', Service],
  ['testimonials', Testimonial],
  ['storyCards', StoryCard],
];

export async function getSiteSettings() {
  const [settings, services, testimonials, storyCards] = await Promise.all([
    SiteSetting.findOne({ key: 'main' }).lean(),
    Service.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    Testimonial.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
    StoryCard.find().sort({ sortOrder: 1, createdAt: 1 }).lean(),
  ]);
  return { ...(settings || {}), services, testimonials, storyCards };
}

export async function replaceContentItems(Model, items) {
  const ids = [];
  const operations = items.map((item, sortOrder) => {
    const id = mongoose.isValidObjectId(item?._id) ? new mongoose.Types.ObjectId(item._id) : new mongoose.Types.ObjectId();
    ids.push(id);
    const fields = { ...item, sortOrder };
    delete fields._id;
    delete fields.__v;
    delete fields.createdAt;
    delete fields.updatedAt;
    return { updateOne: { filter: { _id: id }, update: { $set: fields, $setOnInsert: { _id: id } }, upsert: true } };
  });
  if (operations.length) await Model.bulkWrite(operations, { ordered: true });
  await Model.deleteMany(ids.length ? { _id: { $nin: ids } } : {});
}

export async function migrateLegacySiteContent() {
  const settings = await SiteSetting.findOne({ key: 'main' }).lean();
  if (!settings) return;
  for (const [field, Model] of contentModels) {
    const legacyItems = Array.isArray(settings[field]) ? settings[field] : [];
    if (!legacyItems.length) continue;
    const operations = legacyItems.map((item, sortOrder) => {
      const id = mongoose.isValidObjectId(item?._id) ? new mongoose.Types.ObjectId(item._id) : new mongoose.Types.ObjectId();
      const fields = { ...item, sortOrder };
      delete fields._id;
      delete fields.__v;
      return { updateOne: { filter: { _id: id }, update: { $setOnInsert: { ...fields, _id: id } }, upsert: true } };
    });
    await Model.bulkWrite(operations, { ordered: true });
  }
  await SiteSetting.collection.updateOne({ key: 'main' }, { $unset: { services: '', testimonials: '', storyCards: '' } });
}
