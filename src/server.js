import 'dotenv/config';
import bcrypt from 'bcryptjs';
import app from './app.js';
import { connectDB } from './config/db.js';
import Admin from './models/Admin.js';
import SiteSetting from './models/SiteSetting.js';
import { migrateLegacySiteContent } from './utils/siteContent.js';

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to a random value at least 32 characters long.');
  await connectDB();
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const email = process.env.ADMIN_EMAIL.toLowerCase().trim();
    const existing = await Admin.findOne({ email });
    if (!existing) await Admin.create({ email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12) });
    if (process.env.ADMIN_PASSWORD === 'change-this-before-running') console.warn('Change the example admin password before exposing this server.');
  } else {
    console.warn('No ADMIN_EMAIL/ADMIN_PASSWORD configured. Set both to create the initial admin user.');
  }
  await SiteSetting.updateOne({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true });
  await migrateLegacySiteContent();
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => console.log(`Mehndi Creations API listening on http://localhost:${port}`));
}

start().catch((error) => { console.error('Startup failed:', error.message); process.exit(1); });
