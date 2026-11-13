// Decides whether an image URL stored in the database may be shown (issue #43).
// Only photos uploaded to this project's own `media` bucket are loaded: any other address would make
// every viewer's browser or phone fetch it, telling that server their IP, user agent and visit time.
// The database applies the same shape check to places (public.is_media_image_url); here the host must
// also be exactly the Supabase project this client talks to.

const MEDIA_PATH = '/storage/v1/object/public/media/';
// <uploader uuid>/<file name>, as written by uploadImage() in api.ts.
const OBJECT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

/** `url` if it is a public `media` object on the Supabase project at `supabaseUrl`, otherwise null. */
export function mediaImageUrl(url: string | null | undefined, supabaseUrl: string | null | undefined): string | null {
  if (typeof url !== 'string' || typeof supabaseUrl !== 'string') return null;
  // Compare against the origin only: supabase-js builds public URLs from it the same way.
  const origin = /^(https?:\/\/[^/?#@\\\s]+)\/*$/i.exec(supabaseUrl.trim())?.[1];
  if (!origin) return null;
  const prefix = `${origin}${MEDIA_PATH}`;
  if (url.slice(0, prefix.length).toLowerCase() !== prefix.toLowerCase()) return null;
  const object = url.slice(prefix.length);
  return OBJECT.test(object) && !object.includes('..') ? url : null;
}
