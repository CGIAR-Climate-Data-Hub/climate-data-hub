// Machine-readable catalog index: every record as schema.org/Dataset JSON-LD
// inside one DataCatalog document — the target of each record page's
// includedInDataCatalog. Per-record raw metadata stays at /catalog/<id>.json;
// asset/file discovery stays with the STAC catalog.

import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { currentReleases, datasetJsonLd } from "@/lib/catalog";
import { SITE_DESCRIPTION, SITE_PUBLISHER_NAME } from "@/site.config";

export const GET: APIRoute = async ({ site }) => {
  const catalogUrl = new URL("/catalog/", site).href;
  const entries = currentReleases(await getCollection("catalog"));
  const datasets = entries.map((entry) => {
    const { "@context": _, ...dataset } = datasetJsonLd(
      entry.data,
      new URL(`/catalog/${entry.data.id}/`, site).href,
      catalogUrl,
    );
    return dataset;
  });

  const doc = {
    "@context": "https://schema.org",
    "@type": "DataCatalog",
    "@id": catalogUrl,
    name: `${SITE_PUBLISHER_NAME} Catalog`,
    description: SITE_DESCRIPTION,
    url: catalogUrl,
    dataset: datasets,
  };

  return new Response(JSON.stringify(doc, null, 2), {
    headers: { "Content-Type": "application/ld+json" },
  });
};
