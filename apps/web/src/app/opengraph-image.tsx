import { ogImage, size as imageSize, contentType as imageType } from '@/lib/og';

export const alt = 'DTour: the campus, all in one place';
export const size = imageSize;
export const contentType = imageType;

export default function Image() {
  return ogImage('The campus, all in one place.');
}
