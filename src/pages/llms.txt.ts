// llms.txt — a compact, AI-readable map of the site, generated from the collections.

import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { currentReleases } from "@/lib/catalog";
import { allTutorials } from "@/lib/collections";
import { SITE_PUBLISHER_NAME, SKILLS_SITE } from "@/site.config";

export const GET: APIRoute = async ({ site }) => {
  const abs = (path: string) => new URL(path, site).href;
  const catalog = currentReleases(await getCollection("catalog"));
  const wikis = await getCollection("wikis");
  const tutorials = await allTutorials();
  const useCases = await getCollection("useCases");

  const line = (title: string, url: string, desc: string) =>
    `- [${title.replaceAll("[", "\\[").replaceAll("]", "\\]")}](${abs(url)}): ${desc.trim().replace(/\s+/g, " ")}`;

  const md = `# ${SITE_PUBLISHER_NAME}

> A curated catalog of quality-assured climate and agricultural datasets, described consistently, openly licensed, and published in cloud-native formats. Use the catalog to discover datasets, inspect metadata, cite original publishers, and access Zarr, Cloud-Optimized GeoTIFF, and Parquet assets plus STAC metadata directly.

The Hub also provides practical tutorials and wiki documentation for finding, evaluating, accessing, and using its datasets.

For an expanded, single-file representation of the Hub's documentation and dataset metadata, see [llms-full.txt](${abs("/llms-full.txt")}).

Each dataset record has stable machine-readable JSON metadata and embedded schema.org/Dataset markup. Cite datasets using the citation on each record page, which preserves credit to the original publisher.

Links below use plain Markdown where available. Dataset and Markdown-authored page twins live at the page URL plus index.md.

## Datasets

${catalog.map((c) => line(c.data.title, `/catalog/${c.data.id}/index.md`, c.data.description)).join("\n")}

## Documentation

${wikis.map((w) => line(w.data.title, `/wikis/${w.id}/${w.filePath?.endsWith(".md") ? "index.md" : ""}`, w.data.description)).join("\n")}

## Tutorials

${tutorials.map((t) => line(t.data.title, `/tutorials/${t.id}/${t.filePath?.endsWith(".md") ? "index.md" : ""}`, t.data.description)).join("\n")}

## Use cases

${useCases.map((u) => line(u.data.title, `/in-use/${u.id}/${u.filePath?.endsWith(".md") ? "index.md" : ""}`, u.data.description)).join("\n")}

## Reference

- [Catalog](${abs("/catalog/")}): Browse and filter all datasets
- [Catalog index](${abs("/catalog.json")}): Machine-readable schema.org DataCatalog of every record (per-record raw metadata at /catalog/<id>.json)
- [For AI & agents](${abs("/ai/")}): Agent skills and every machine-readable endpoint, documented
- [Agent skills docs](${SKILLS_SITE}): Ready-made skills (open Agent Skills format) that teach assistants Hub workflows, with install guides
- [FAQ](${abs("/faq/")}): Access, licensing, formats, and contributing
- [About](${abs("/about/")}): What the Hub is and who runs it
- [Contribute](${abs("/contribute/")}): How to submit a dataset
`;

  return new Response(md, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
