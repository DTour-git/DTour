import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Phosphor from '@phosphor-icons/react/dist/ssr';
import { describe, expect, it } from 'vitest';
import { Icon } from '../apps/web/src/components/Icon';
// @ts-expect-error: plain .mjs script, no type declarations
import { FILL, ICONS, OUT, render } from './gen-icons.mjs';

const webSrc = join(__dirname, '../apps/web/src');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

describe('web icon paths', () => {
  it('icon-paths.ts matches the generator (run `npm run icons`)', async () => {
    expect(readFileSync(OUT, 'utf8')).toBe(await render());
  });

  it('keeps only the duotone weight, plus fill for the FILL icons', async () => {
    const { ICON_PATHS } = await import('../apps/web/src/components/icon-paths');
    expect(Object.keys(ICON_PATHS).sort()).toEqual(Object.keys(ICONS).sort());
    for (const [name, w] of Object.entries(ICON_PATHS)) {
      expect(Object.keys(w).sort(), name).toEqual(FILL.includes(name) ? ['duotone', 'fill'] : ['duotone']);
    }
  });

  it('draws the same SVG as the Phosphor components did, for every icon and weight', () => {
    // Attributes are compared as a set: only their order differs.
    const parts = (html: string) => {
      const m = /^<svg([^>]*)>(.*)<\/svg>$/.exec(html);
      if (!m) throw new Error(`not an <svg>: ${html}`);
      return { attrs: [...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => `${a[1]}=${a[2]}`).sort(), body: m[2] };
    };
    const lib = Phosphor as unknown as Record<string, ComponentType<Record<string, unknown>>>;
    for (const [name, ph] of Object.entries(ICONS as Record<string, string>)) {
      for (const weight of FILL.includes(name) ? (['duotone', 'fill'] as const) : (['duotone'] as const)) {
        const style = { marginTop: 2 };
        const before = renderToStaticMarkup(
          createElement(lib[`${ph}Icon`], {
            size: 22,
            weight,
            color: 'red',
            style: { flex: 'none', ...style },
            className: 'k',
            'aria-hidden': true,
          }),
        );
        const after = renderToStaticMarkup(createElement(Icon, { name, size: 22, weight, color: 'red', style, className: 'k' }));
        expect(parts(after), `${name} ${weight}`).toEqual(parts(before));
      }
    }
  });

  it('every <Icon> that switches to fill has fill paths', () => {
    const used = new Set<string>();
    for (const file of sources(webSrc)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/<Icon\b([^>]*)>/g)) {
        const name = /name="([a-z-]+)"/.exec(m[1])?.[1];
        if (name && /'fill'|"fill"/.test(m[1])) used.add(name);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const name of used) expect(FILL, name).toContain(name);
  });

  it('nothing else on the website imports @phosphor-icons/react', () => {
    const hits = sources(webSrc).filter((f) => /from ['"]@phosphor-icons\/react/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
