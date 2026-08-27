// Shared shaping of CDH catalog records for cards, facets, and JSON-LD.
import type { CollectionEntry } from "astro:content";
import formatVocab from "@/assets/format-vocab.json";
import {
  commodity,
  commodityWithParents,
  geography,
  geographyBboxes,
  geographyWithParents,
  isCommodityGroup,
  VOCAB_URL,
} from "@/lib/vocab";
import { SITE_PUBLISHER_NAME } from "@/site.config";

const VIA = `Accessed through the ${SITE_PUBLISHER_NAME}`;
const formatsById = new Map(
  formatVocab.concepts.map((format) => [format.id, format]),
);

// STAC catalogs are derived from these records by the publishing pipeline,
// so records never store STAC URLs — the site assumes this layout instead.
// If the pipeline publishes elsewhere, this is the one place to change.
const STAC_ROOT = "https://digital-atlas.s3.amazonaws.com/cdh/stac";

export function stacCollectionUrl(id: string) {
  return `${STAC_ROOT}/${id}/collection.json`;
}

// Resolve an asset template's placeholders to their valid dimension values.
// {variable} is the one special placeholder backed by variable names.
export function resolveTemplate(d: CatalogRecord, template: string) {
  const fields = [
    ...new Set([...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1])),
  ].map((name) => ({
    name,
    values:
      d.dimensions.find((dimension) => dimension.name === name)?.values
      ?? (name === "variable"
        ? d.variables.map((variable) => variable.name)
        : []),
  }));
  if (!fields.every((field) => field.values.length > 0)) return undefined;
  const file = fields.reduce(
    (resolved, field) =>
      resolved.replaceAll(`{${field.name}}`, field.values[0]),
    template,
  );
  return { fields, file };
}

// Fill every placeholder with its first valid value to name one real file.
export function exampleTemplateFile(d: CatalogRecord, template: string) {
  return resolveTemplate(d, template)?.file;
}

export function humanize(slug: string) {
  return slug.charAt(0).toUpperCase() + slug.slice(1).replaceAll("-", " ");
}

// Prefix match, so parameterised types ("…vnd.zarr; version=3") resolve
export const formatConcept = (mediaType?: string) =>
  formatVocab.concepts.find((f) => mediaType?.startsWith(f.media_type));

// Human label for an asset's format ("Cloud-Optimized GeoTIFF"), falling
// back to the bare media type for formats outside the vocab
export const formatLabel = (mediaType?: string) =>
  formatConcept(mediaType)?.label ?? mediaType?.split(";")[0];

// One-line guidance per format ("best for …"), from the same vocab
export const formatBestFor = (mediaType?: string) =>
  formatConcept(mediaType)?.best_for;

// Stable facet token: vocab id, else the bare media subtype ("csv")
export const formatId = (mediaType?: string) =>
  formatConcept(mediaType)?.id ?? mediaType?.split(";")[0]?.split("/").pop();

export const formatIdLabel = (id: string) =>
  formatsById.get(id)?.label ?? id.toUpperCase();

// Canonical UN M49 label ("Sub-Saharan Africa"), falling back for unknown ids
export function geoLabel(id: string) {
  return geography(id)?.label ?? humanize(id);
}

export function commodityLabel(id: string) {
  return commodity(id)?.label ?? humanize(id);
}

// Version chain per the standard (§4.7): records link backward via
// previous_version; successors come from inverting those edges. Returns the
// record's full chain newest-first. Chain integrity (dangling ids, forks,
// cycles) is validated at catalog submission, not here — a bad edge just
// ends the walk.
export function versionChain(
  id: string,
  entries: CollectionEntry<"catalog">[],
) {
  const byId = new Map(entries.map((e) => [e.data.id, e]));
  const successor = new Map(
    entries.flatMap((e) =>
      e.data.previous_version
        ? [[e.data.previous_version, e.data.id] as const]
        : [],
    ),
  );

  // Walk forward to the newest release, then collect backward from there
  const seen = new Set([id]);
  let head = id;
  while (successor.has(head) && !seen.has(successor.get(head) as string)) {
    head = successor.get(head) as string;
    seen.add(head);
  }
  const chain: CollectionEntry<"catalog">[] = [];
  const visited = new Set<string>();
  let cursor: string | undefined = head;
  while (cursor && byId.has(cursor) && !visited.has(cursor)) {
    visited.add(cursor);
    chain.push(byId.get(cursor) as CollectionEntry<"catalog">);
    cursor = byId.get(cursor)?.data.previous_version;
  }
  return chain;
}

// Current releases only: deprecated snapshots stay reachable through their
// successor's version chain, never through indexes or feeds.
export function currentReleases(entries: CollectionEntry<"catalog">[]) {
  return entries.filter((e) => !e.data.deprecated);
}

// A URL that targets a Hub record page — relative or absolute — resolves to
// its record id. Callers must check the id against the catalog; that lookup
// is the real guard against false positives.
export function hubRecordId(url: string) {
  return url.match(/^(?:https?:\/\/[^/]+)?\/catalog\/([^/]+)\/?$/)?.[1];
}

// The licensor's organization (a required role in the standard) is
// credited as the record's "source" — cards, page header, and rail alike
export const licensor = (d: CatalogRecord) =>
  d.contact.find((c) => c.roles.includes("licensor"))?.organization;

// M49 chain depth of the most specific tag (kenya → 5, africa → 2) to a
// coverage scale; sub-regions at depths 3-4 both read as regional
function scaleOf(tags: string[]) {
  const depth = Math.max(0, ...tags.map((g) => geographyWithParents(g).length));
  if (depth === 0) return undefined;
  if (depth === 1) return "global";
  if (depth === 2) return "continental";
  return depth <= 4 ? "regional" : "national";
}

export function summarize(entry: CollectionEntry<"catalog">) {
  const d = entry.data;
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    type: d.spatial ? ("spatial" as const) : ("tabular" as const),
    license: d.license,
    source: licensor(d),
    // Distribution formats of the data assets, as facet tokens
    formats: [...new Set(d.data.flatMap((a) => formatId(a.media_type) ?? []))],
    access: d.access && d.access !== "open" ? "restricted" : "open",
    keywords: d.keywords.map((k) => (typeof k === "string" ? k : k.term)),
    coverage: d.spatial?.geography.map(geoLabel).join(", ") || undefined,
    // Short form for card meta rows — full label lives on the detail page
    resolution: d.spatial?.resolution[0]?.label?.split(" (")[0],
    temporal: temporalText(d.temporal)?.main,
    domains: d.cdh?.domain ?? [],
    // Tags plus their broader concepts, so filtering by a group rolls up;
    // the group tier of the closure feeds the facet
    commodities: [...new Set(d.commodities.flatMap(commodityWithParents))],
    commodityGroups: [
      ...new Set(
        d.commodities.flatMap(commodityWithParents).filter(isCommodityGroup),
      ),
    ],
    // Tags plus their M49 ancestors, so filtering by a region rolls up —
    // except the "world" root, which stays only when explicitly tagged:
    // the catalog filter reads world as "global, matches every region",
    // and every chain of ancestors ends at world
    geographies: [
      ...new Set((d.spatial?.geography ?? []).flatMap(geographyWithParents)),
    ].filter(
      (g) => g !== "world" || (d.spatial?.geography ?? []).includes("world"),
    ),
    // Coverage scale from the most specific tag's M49 chain depth:
    // world → global, a continent → continental, sub-regions → regional,
    // countries → national. Untagged records carry no scale.
    scale: scaleOf(d.spatial?.geography ?? []),
    // Explicit extent, else derived from geography tags for spatial search
    bboxes:
      normalizeBboxes(d.spatial?.bbox)
      ?? geographyBboxes(d.spatial?.geography ?? []),
    series: d.series?.name,
    updated: d.updated ?? d.created ?? "",
  };
}

export type DatasetSummary = ReturnType<typeof summarize>;

export type CatalogRecord = CollectionEntry<"catalog">["data"];

// Canonical deeds for the common licenses — friendlier than the spdx.org
// legal text, and the identifiers schema.org consumers recognize
const LICENSE_URLS: Record<string, string> = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
};

// One rule for page links and JSON-LD alike: the canonical deed when known,
// else the spdx.org page for simple SPDX ids. Submission also accepts
// compound expressions ("Apache-2.0 OR MIT", "… WITH …") and custom
// LicenseRef-* — neither has a page, so those render as plain text.
export function licenseUrl(license: string) {
  if (LICENSE_URLS[license]) return LICENSE_URLS[license];
  return /^(?!LicenseRef-)[A-Za-z0-9.+-]+$/.test(license)
    ? `https://spdx.org/licenses/${license}.html`
    : undefined;
}

// Records store one bbox or a list of them; normalize to a list.
export function normalizeBboxes(bbox?: number[] | number[][]) {
  if (!bbox || bbox.length === 0) return undefined;
  return (Array.isArray(bbox[0]) ? bbox : [bbox]) as number[][];
}

// recordUrl appends an "accessed through" clause pointing at the hub's
// record page; omit it where only the original citation belongs (JSON-LD).
export function citationText(d: CatalogRecord, recordUrl?: string) {
  const c = d.citation;
  if (!c) return undefined;
  const authors = c.authors.join(", ");
  const link = d.doi ? `https://doi.org/${d.doi}` : c.url;
  return [
    authors,
    c.date && `(${c.date})`,
    `${c.title}.`,
    // The version pins the citation: the current release's Hub URL rolls
    // forward to newer releases, so the text must record what was used
    d.version && `Version ${d.version}.`,
    c.publisher && `${c.publisher}.`,
    link,
    recordUrl && `${VIA}, ${recordUrl}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

// One text citation per style — the same fields shuffled per convention.
// citationText (above) stays the generic form used in JSON-LD.
export function citationFormats(d: CatalogRecord, recordUrl?: string) {
  const c = d.citation;
  if (!c) return [];
  const authors = c.authors.join(", ");
  const year = (c.date ?? "").slice(0, 4);
  const link = d.doi ? `https://doi.org/${d.doi}` : c.url;
  const via = recordUrl ? `${VIA}, ${recordUrl}.` : undefined;
  const join = (parts: (string | false | undefined)[]) =>
    parts.filter(Boolean).join(" ");
  return [
    {
      id: "apa",
      label: "APA",
      text: join([
        authors,
        year && `(${year}).`,
        `${c.title}`,
        d.version ? `(Version ${d.version}) [Data set].` : "[Data set].",
        c.publisher && `${c.publisher}.`,
        link,
        via,
      ]),
    },
    {
      id: "harvard",
      label: "Harvard",
      text: join([
        authors,
        year && `(${year})`,
        `${c.title} [Data set].`,
        d.version && `Version ${d.version}.`,
        c.publisher && `${c.publisher}.`,
        link && `Available at: ${link}.`,
        via,
      ]),
    },
    {
      id: "chicago",
      label: "Chicago",
      text: join([
        // Initials already end with a period — don't double it
        authors && (authors.endsWith(".") ? authors : `${authors}.`),
        year && `${year}.`,
        `“${c.title}.”`,
        d.version && `Version ${d.version}.`,
        c.publisher && `${c.publisher}.`,
        link && `${link}.`,
        via,
      ]),
    },
  ];
}

export function bibtex(d: CatalogRecord, recordUrl?: string) {
  const c = d.citation;
  if (!c) return undefined;
  const key = `${d.id.replaceAll("-", "_")}_${(c.date ?? "").slice(0, 4)}`;
  const lines = [
    `  title     = {${c.title}}`,
    c.authors.length > 0 && `  author    = {${c.authors.join(" and ")}}`,
    c.date && `  year      = {${c.date.slice(0, 4)}}`,
    d.version && `  version   = {${d.version}}`,
    c.publisher && `  publisher = {${c.publisher}}`,
    d.doi ? `  doi       = {${d.doi}}` : c.url && `  url       = {${c.url}}`,
    recordUrl && `  note      = {${VIA}, ${recordUrl}}`,
  ].filter(Boolean);
  return `@misc{${key},\n${lines.join(",\n")}\n}`;
}

const STEP_LABELS: Record<string, string> = {
  P1Y: "annual",
  P1M: "monthly",
  P10D: "10-daily",
  P1D: "daily",
  PT1H: "hourly",
};

// "P3M" → "every 3 months" (steps are pipeline-validated ISO 8601 durations)
function stepLabel(step: string) {
  if (STEP_LABELS[step]) return STEP_LABELS[step];
  const m =
    step.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(\d+)H)?$/) ?? [];
  const parts = ["year", "month", "day", "hour"].flatMap((unit, i) =>
    m[i + 1] ? `${m[i + 1]} ${unit}${+m[i + 1] > 1 ? "s" : ""}` : [],
  );
  return `every ${parts.join(" ")}`;
}

// Shared dataset Markdown for llms-full.txt and record twins.
export function datasetMd(
  d: CatalogRecord,
  site: URL | undefined,
  sectionDepth = 4,
) {
  const abs = (path: string) => new URL(path, site).href;
  const values = (v: string[]) =>
    v.length > 8
      ? `${v[0]} … ${v[v.length - 1]} (${v.length} values)`
      : v.join(", ");
  const dash = (...parts: (string | undefined)[]) =>
    parts.filter(Boolean).join(" — ");
  const temporal =
    d.temporal
    && ("date" in d.temporal
      ? d.temporal.date
      : `${d.temporal.start_date} to ${d.temporal.end_date ?? "ongoing"}`);

  const facts = [
    `URL: ${abs(`/catalog/${d.id}/`)}`,
    `Metadata (JSON): ${abs(`/catalog/${d.id}.json`)}`,
    d.data.length && `STAC collection: ${stacCollectionUrl(d.id)}`,
    `Resource type: ${d.resource_type}`,
    `License: ${d.license}`,
    d.access && dash(`Access: ${d.access}`, d.access_note),
    d.doi && `DOI: ${d.doi}`,
    temporal && `Temporal coverage: ${temporal}`,
    d.spatial?.geography.length
      && `Geography: ${d.spatial.geography.join(", ")}`,
    d.commodities.length && `Commodities: ${d.commodities.join(", ")}`,
    d.keywords.length
      && `Keywords: ${d.keywords
        .map((k) => (typeof k === "string" ? k : k.term))
        .join(", ")}`,
    d.data.length
      && `Data: ${d.data
        .map((a) => a.locations[0]?.url)
        .filter(Boolean)
        .join(" · ")}`,
    ...d.additional_links.map((l) =>
      dash(`Link: ${l.name ?? l.url}`, l.name && l.url, l.description),
    ),
  ].filter(Boolean);

  // Keep multiline record fields inside a single Markdown bullet.
  const bullets = (items: unknown[]) =>
    items
      .filter(Boolean)
      .map((i) => `- ${String(i).replace(/\s+/g, " ").trim()}`)
      .join("\n");
  const section = (title: string, items: unknown[]) => {
    const content = bullets(items);
    return content
      ? `${"#".repeat(sectionDepth)} ${title}\n\n${content}`
      : undefined;
  };

  const c = d.climate;
  const blocks = [
    bullets(facts),
    d.description.trim(),
    section(
      "Variables",
      d.variables.map((v) =>
        dash(`${v.name}${v.unit ? ` (${v.unit})` : ""}`, v.description, v.note),
      ),
    ),
    section(
      "Dimensions",
      d.dimensions.map((dim) =>
        dash(
          `${dim.name}: ${values(dim.values)}`,
          dim.step && `step ${dim.step}`,
          dim.description,
        ),
      ),
    ),
    section(
      "Classes",
      d.classes.map(
        (cl) =>
          `${cl.variable}: ${cl.values.map((v) => `${v.value} = ${v.label}`).join("; ")}`,
      ),
    ),
    d.cdh
      && section("Intended use", [
        d.cdh.domain.length && `Domains: ${d.cdh.domain.join(", ")}`,
        ...d.cdh.not_recommended_for.map((n) =>
          dash(
            `Not recommended: ${n.use}`,
            n.reason,
            n.use_instead && `use instead: ${n.use_instead}`,
          ),
        ),
      ]),
    c
      && section("Climate modeling", [
        c.mip_era && `MIP era: ${c.mip_era}`,
        c.models.length && `Models: ${c.models.join(", ")}`,
        c.scenarios.length && `Scenarios: ${c.scenarios.join(", ")}`,
        c.baseline
          && `Baseline: ${c.baseline.start_date}${c.baseline.end_date ? ` to ${c.baseline.end_date}` : ""}`,
      ]),
    d.citation && `Cite: ${citationText(d, abs(`/catalog/${d.id}/`))}`,
  ].filter(Boolean);

  return blocks.join("\n\n");
}

// Snapshot (date) or span; `step` is the time dimension's, labels the cadence
export function temporalText(t: CatalogRecord["temporal"], step?: string) {
  if (!t) return undefined;
  const year = (date: string) => date.slice(0, 4);
  if ("date" in t) return { main: year(t.date), sub: "static snapshot" };
  return {
    main: `${year(t.start_date)} – ${t.end_date ? year(t.end_date) : "present"}`,
    sub: step && stepLabel(step),
  };
}

function contactToSchemaOrg(c: CatalogRecord["contact"][number]) {
  if (c.name) {
    return {
      "@type": "Person",
      name: c.name,
      ...(c.email && { email: c.email }),
      ...(c.organization && {
        affiliation: { "@type": "Organization", name: c.organization },
      }),
    };
  }
  return {
    "@type": "Organization",
    name: c.organization,
    ...(c.url && { url: c.url }),
  };
}

// schema.org/Dataset JSON-LD, mapped from the CDH record (Google Dataset Search friendly).
export function datasetJsonLd(
  d: CatalogRecord,
  url: string,
  catalogUrl: string,
) {
  const boxes = normalizeBboxes(d.spatial?.bbox) ?? [];
  const cite = citationText(d);
  const creators = d.contact.filter((c) => c.roles.includes("producer"));
  // Distributions stay coarse, and only URLs a consumer can fetch directly
  // (e.g. a Zarr root). Templated assets have no such URL — their prefix
  // isn't retrievable — so the STAC Collection file index represents them.
  const distributions = [
    ...d.data.flatMap((asset) =>
      asset.href_template
        ? []
        : asset.locations
            .filter((loc) => loc.url.startsWith("http"))
            .map((loc) => ({
              "@type": "DataDownload",
              name: asset.description ?? asset.name,
              contentUrl: loc.url,
              ...(asset.media_type && { encodingFormat: asset.media_type }),
              ...(asset.file_size && { contentSize: asset.file_size }),
            })),
    ),
    ...(d.data.some((a) => a.href_template)
      ? [
          {
            "@type": "DataDownload",
            name: "STAC Collection (machine-readable index of all files)",
            contentUrl: stacCollectionUrl(d.id),
            encodingFormat: "application/json",
          },
        ]
      : []),
  ];

  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": url,
    name: d.title,
    description: d.description,
    url,
    identifier: d.doi ? [`https://doi.org/${d.doi}`, d.id] : [d.id],
    ...(d.doi && { sameAs: `https://doi.org/${d.doi}` }),
    license: licenseUrl(d.license) ?? d.license,
    // "Free" in the Dataset Search sense: openly retrievable, no gate
    isAccessibleForFree: (d.access ?? "open") === "open",
    ...(d.access_note && { conditionsOfAccess: d.access_note }),
    ...(d.version && { version: d.version }),
    ...(d.created && { dateCreated: d.created }),
    ...(d.updated && { dateModified: d.updated }),
    keywords: d.keywords.map((k) =>
      typeof k === "string"
        ? k
        : {
            "@type": "DefinedTerm",
            name: k.term,
            ...(k.uri && { url: k.uri }),
            ...(k.scheme && { inDefinedTermSet: k.scheme }),
          },
    ),
    // Commodities as AGROVOC-linked subjects, via the CDH controlled vocab
    ...(d.commodities.length > 0 && {
      about: d.commodities.map((id) => {
        const c = commodity(id);
        return {
          "@type": "DefinedTerm",
          name: c?.label ?? humanize(id),
          ...(c?.code && { termCode: c.code }),
          ...(c?.uri && { url: c.uri }),
          ...(c && { inDefinedTermSet: VOCAB_URL }),
        };
      }),
    }),
    ...(creators.length > 0 && { creator: creators.map(contactToSchemaOrg) }),
    ...(d.funding.length > 0 && {
      funder: d.funding.map((f) => ({
        "@type": "Organization",
        name: f.name,
        ...(f.url && { url: f.url }),
      })),
    }),
    ...(() => {
      // Named places (with M49/ISO codes) alongside the bbox GeoShape
      const places: object[] = (d.spatial?.geography ?? []).map((g) => {
        const c = geography(g);
        return {
          "@type": "Place",
          name: c?.label ?? humanize(g),
          ...(c && {
            identifier: [
              { "@type": "PropertyValue", propertyID: "UN M49", value: c.code },
              ...(c.iso3
                ? [
                    {
                      "@type": "PropertyValue",
                      propertyID: "ISO 3166-1 alpha-3",
                      value: c.iso3,
                    },
                  ]
                : []),
            ],
          }),
        };
      });
      for (const b of boxes)
        places.push({
          "@type": "Place",
          geo: {
            "@type": "GeoShape",
            // schema.org box is "minLat minLon maxLat maxLon"
            box: `${b[1]} ${b[0]} ${b[3]} ${b[2]}`,
          },
        });
      return places.length > 0 ? { spatialCoverage: places } : {};
    })(),
    // schema.org accepts reduced-precision dates; ".." is its open-ended marker
    ...(d.temporal && {
      temporalCoverage:
        "date" in d.temporal
          ? d.temporal.date
          : `${d.temporal.start_date}/${d.temporal.end_date ?? ".."}`,
    }),
    ...(d.variables.length > 0 && {
      variableMeasured: d.variables.map((v) => ({
        "@type": "PropertyValue",
        name: v.name,
        ...(v.description && { description: v.description }),
        ...(v.unit && { unitText: v.unit }),
      })),
    }),
    ...(distributions.length > 0 && { distribution: distributions }),
    ...(cite && { citation: cite }),
    includedInDataCatalog: { "@type": "DataCatalog", "@id": catalogUrl },
  };
}
