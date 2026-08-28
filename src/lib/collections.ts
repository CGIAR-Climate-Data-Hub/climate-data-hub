// Shared ordering/grouping for the docs collections.
import { type CollectionEntry, getCollection } from "astro:content";

// Markdown tutorials and notebook tutorials share a schema and render the
// same way — every consumer treats them as one collection.
export async function allTutorials() {
  return [
    ...(await getCollection("tutorials")),
    ...(await getCollection("notebookTutorials")),
  ];
}

export const WIKI_SECTIONS = [
  // Sidebar groups render in this order — hub-level docs lead
  "The Hub",
  "Data standards",
  "Methods",
  "Concepts",
  "Reference",
] as const;

export function groupWikis(entries: CollectionEntry<"wikis">[]) {
  return WIKI_SECTIONS.map((section) => ({
    section,
    entries: entries
      .filter((e) => e.data.section === section)
      .sort(
        (a, b) =>
          (a.data.order ?? 99) - (b.data.order ?? 99)
          || a.data.title.localeCompare(b.data.title),
      ),
  })).filter((g) => g.entries.length > 0);
}
