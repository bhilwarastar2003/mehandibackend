import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloudinary, cloudinaryConfigured } from '../config/cloudinary.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(here, '../../uploads');
const mimeExtensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

export async function saveImage(file) {
  if (!file) throw Object.assign(new Error('Choose an image to upload.'), { status: 400 });
  if (cloudinaryConfigured) {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'mehndi-creations', resource_type: 'image' }, (error, value) => error ? reject(error) : resolve(value));
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: result.public_id, provider: 'cloudinary' };
  }
  if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('Configure Cloudinary before enabling production uploads.'), { status: 503 });
  await mkdir(uploadDir, { recursive: true });
  const filename = `${randomUUID()}.${mimeExtensions[file.mimetype]}`;
  await writeFile(path.join(uploadDir, filename), file.buffer, { flag: 'wx' });
  return { url: `/uploads/${filename}`, publicId: filename, provider: 'local' };
}

export async function deleteImage(url) {
  if (!url) return;
  if (cloudinaryConfigured && url.includes('res.cloudinary.com')) {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
    if (match) await cloudinary.uploader.destroy(match[1], { resource_type: 'image' });
    return;
  }
  const filename = path.basename(url);
  if (filename !== url.replace(/^.*\//, '')) return;
  await unlink(path.join(uploadDir, filename)).catch(() => {});
}
