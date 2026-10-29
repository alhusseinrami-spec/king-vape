// Product photos uploaded by admins: only real PNG, JPEG or WebP files are kept, under a name made from their content.
import { createHash } from 'node:crypto';
import { fail } from './http.js';
import { writeBinary } from './store.js';

export const MAX_PHOTO = 2500000;

export function sniff(b) {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export async function savePhoto(buf) {
  if (!buf.length) fail(400, 'bad_image');
  const type = sniff(buf);
  if (!type) fail(415, 'bad_image');
  const id = createHash('sha256').update(buf).digest('hex').slice(0, 32);
  await writeBinary('img/' + id, buf, type);
  return { id, url: '/api/photo?i=' + id };
}
