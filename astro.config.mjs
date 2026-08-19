// @ts-check

import { satteri, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { defineConfig, fontProviders } from "astro/config";

import pagefind from "astro-pagefind";

import { shikiConfig } from "./src/lib/code-block.ts";
import { headingAnchors } from "./src/lib/heading-anchors.ts";
import { SITE_URL } from "./src/site.config.ts";

// Canonical production domain. Served at the root as the org's GitHub Pages site, so there
// is no `base` (Astro defaults to "/"). To switch to a custom domain later: change SITE_URL
// in src/site.config.ts + add public/CNAME — base stays "/" the whole time.
// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  integrations: [mdx(), sitemap(), pagefind()],
  prefetch: { prefetchAll: true },
  output: "static",
  // Slashed URLs come from build.format "directory"; trailingSlash stays at
  // its default ("ignore") — "always" 404s extensioned endpoints in dev
  // (withastro/astro#10149).

  // shikiConfig is shared with the satteri renderer and <Code> components —
  // src/lib/code-block.ts. Plugin order matters: ids are assigned first, the
  // anchor wrap reads them (Astro's own ids pass re-runs after, idempotently).
  markdown: {
    processor: satteri({
      hastPlugins: [satteriHeadingIdsPlugin(), headingAnchors()],
    }),
    shikiConfig,
  },

  fonts: [
    {
      name: "Noto Sans",
      cssVariable: "--font-sans",
      provider: fontProviders.fontsource(),
      weights: [300, 400, 500, 600, 700],
      // Italic is unused in the site CSS; prose <em> synthesizes (rare)
      styles: ["normal"],
      subsets: ["latin"],
    },
    {
      // Serif ledes use 300 for the editorial light feel; headings 500-600
      name: "Noto Serif",
      cssVariable: "--font-serif",
      provider: fontProviders.fontsource(),
      weights: [300, 400, 500, 600, 700],
      // Italic is unused in the site CSS; prose <em> synthesizes (rare)
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["serif"],
    },
  ],
});
