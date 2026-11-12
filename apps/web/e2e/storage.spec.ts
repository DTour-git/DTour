import { expect, test } from '@playwright/test';
import { IMAGE_MIME_TYPES, LIBRARY_MIME_TYPES, uploadImage, uploadLibraryItem, type DB } from '@dtour/shared';
import { cleanup, signIn, signInClient } from './helpers';

const marker = `e2e-upload-${Date.now()}`;
const paths: Record<string, string[]> = { media: [], library: [] };
let sb: DB;
let uid: string;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=', 'base64');

test.beforeAll(async () => {
  sb = await signInClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Missing test member');
  uid = data.user.id;
});

test.afterAll(async () => {
  if (!sb || !uid) return;
  await cleanup('library_items', `title=eq.${marker}`);
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await sb.storage.from('library').list(`${uid}/CO201`, { offset, limit: 100 });
    expect(error).toBeNull();
    const files = data ?? [];
    paths.library.push(...files.filter((f) => f.name.includes(marker)).map((f) => `${uid}/CO201/${f.name}`));
    if (files.length < 100) break;
  }
  for (const [bucket, names] of Object.entries(paths)) {
    if (!names.length) continue;
    const { error: removeError } = await sb.storage.from(bucket).remove(names);
    expect(removeError).toBeNull();
  }
});

for (const bucket of ['media', 'library']) {
  for (const contentType of ['text/html', 'image/svg+xml']) {
    test(`${bucket} rejects a direct ${contentType} upload`, async () => {
      const path = `${uid}/${marker}-${bucket}-${contentType.replace('/', '.')}`;
      paths[bucket].push(path);
      const { error } = await sb.storage.from(bucket).upload(path, '<svg xmlns="http://www.w3.org/2000/svg"/>', { contentType });
      expect(error?.message).toMatch(/mime type.*not supported/i);
    });
  }
  test(`${bucket} accepts every supported MIME type`, async () => {
    const types = bucket === 'media' ? IMAGE_MIME_TYPES : LIBRARY_MIME_TYPES;
    for (const [index, contentType] of types.entries()) {
      const path = `${uid}/${marker}-${bucket}-${index}`;
      paths[bucket].push(path);
      const { error } = await sb.storage.from(bucket).upload(path, png, { contentType });
      expect(error, contentType).toBeNull();
    }
  });
}

test('shared image upload supports browser blobs and mobile byte buffers', async () => {
  for (const file of [new Blob([png], { type: 'image/png' }), Uint8Array.from(png).buffer]) {
    const url = await uploadImage(sb, uid, file, 'photo.png', 'image/png');
    paths.media.push(url.split('/object/public/media/')[1]);
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('image/png');
  }
});

test('library upload infers missing types and accepts Windows ZIP metadata', async () => {
  for (const [ext, contentType] of [
    ['pdf', ''],
    ['docx', 'application/octet-stream'],
    ['zip', 'application/x-zip-compressed'],
  ]) {
    const id = await uploadLibraryItem(sb, {
      userId: uid,
      subjectCode: 'CO201',
      kind: 'notes',
      title: marker,
      file: Uint8Array.from(png).buffer,
      fileName: `${marker}.${ext}`,
      contentType,
      size: png.length,
    });
    expect(id).toBeGreaterThan(0);
  }
});

test('upload helpers reject unsupported types before uploading', async () => {
  const file = new ArrayBuffer(1);
  await expect(uploadImage(sb, uid, file, 'drawing.svg', 'image/svg+xml')).rejects.toThrow('Choose a PNG');
  for (const [fileName, contentType] of [
    ['page.html', 'application/octet-stream'],
    ['fake.pdf', 'text/html'],
  ]) {
    await expect(
      uploadLibraryItem(sb, {
        userId: uid,
        subjectCode: 'CO201',
        kind: 'notes',
        title: marker,
        file,
        fileName,
        contentType,
        size: 1,
      }),
    ).rejects.toThrow('Choose a PDF');
  }
});

test('the composer explains unsupported image types', async ({ page }) => {
  await signIn(page, 'e2e.student', '/new');
  await page
    .locator(`input[accept="${IMAGE_MIME_TYPES.join(',')}"]`)
    .first()
    .setInputFiles({
      name: 'drawing.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    });
  await expect(page.getByText('Choose a PNG, JPEG, WebP, GIF or HEIC/HEIF image.', { exact: true })).toBeVisible();
});
