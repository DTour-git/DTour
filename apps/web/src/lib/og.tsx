import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The Broadsheet share card: logo and wordmark, an optional kicker (e.g. the board) and the title, in Source Serif 4. */
export async function ogImage(title: string, kicker?: string) {
  const dir = join(process.cwd(), 'src/app');
  const [font, icon] = await Promise.all([readFile(join(dir, 'fonts/SourceSerif4-SemiBold.ttf')), readFile(join(dir, 'icon.svg'))]);
  const mark = `data:image/svg+xml;base64,${icon.toString('base64')}`;
  const text = title.length > 140 ? `${title.slice(0, 139)}…` : title;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Source Serif 4',
        width: '100%',
        height: '100%',
        background: '#f3f2f2',
        color: '#201e1d',
        borderTop: '3px solid #201e1d',
        padding: '56px 72px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mark} width={72} height={72} alt="" />
        <div style={{ display: 'flex', fontSize: 44 }}>DTour</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
        {kicker && (
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 3, textTransform: 'uppercase', color: '#605d5d', marginBottom: 20 }}>
            {kicker}
          </div>
        )}
        <div style={{ display: 'block', fontSize: 64, lineHeight: 1.12, lineClamp: 3 }}>{text}</div>
      </div>
    </div>,
    { ...size, fonts: [{ name: 'Source Serif 4', data: font, weight: 600, style: 'normal' }] },
  );
}
