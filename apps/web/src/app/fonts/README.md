# Source Serif 4 (self-hosted)

The website's only typeface, served from here instead of Google Fonts so a
build never needs the network (fetching it from Google failed builds at random,
locally and in CI).

- Files: the Latin subset, weights 400 and 600, upright and italic, as WOFF2.
  They match what `next/font/google` served before (`subsets: ['latin']`,
  `weight: ['400', '600']`, `style: ['normal', 'italic']`).
- Source: `@fontsource/source-serif-4` 5.3.1 on npm (the `files/` folder), which
  repackages Adobe's Source Serif 4 from Google Fonts.
- Licence: SIL Open Font License 1.1, in `OFL.txt` (it allows bundling the font
  with the app).

Loaded in `../layout.tsx` with `next/font/local`. To add a weight, copy the
matching `source-serif-4-latin-<weight>-<style>.woff2` from that package and add
it to the `src` list there.
