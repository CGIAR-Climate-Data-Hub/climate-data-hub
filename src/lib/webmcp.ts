// Expose the site's machine-readable endpoints to WebMCP-capable browsers.

import { SITE_NAME } from "@/site.config";

const text = (t: string) => ({ content: [{ type: "text", text: t }] });

const fetchText = async (url: string) => {
  const res = await fetch(url);
  return text(
    res.ok ? await res.text() : `Error ${res.status} fetching ${url}`,
  );
};

const tools = [
  {
    name: "search_datasets",
    description: `Search the ${SITE_NAME} catalog for datasets matching a query. Returns matching datasets as JSON with id, name, description, and url.`,
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search terms, e.g. a variable, region, or topic",
        },
      },
      required: ["query"],
    },
    execute: async ({ query }: { query: string }) => {
      const res = await fetch("/catalog.json");
      const { dataset } = (await res.json()) as {
        dataset: { name: string; description: string; url: string }[];
      };
      const words = query.toLowerCase().split(/\s+/);
      const hits = dataset
        .filter((d) => {
          const blob = JSON.stringify(d).toLowerCase();
          return words.every((w) => blob.includes(w));
        })
        .slice(0, 10)
        .map((d) => ({
          id: d.url.split("/").filter(Boolean).pop(),
          name: d.name,
          description: d.description,
          url: d.url,
        }));
      return text(JSON.stringify(hits, null, 2));
    },
  },
  {
    name: "get_dataset_metadata",
    description:
      "Fetch a dataset's full CDH metadata record as JSON — variables, dimensions, assets, licensing — by its catalog id (from search_datasets).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    execute: ({ id }: { id: string }) =>
      fetchText(`/catalog/${encodeURIComponent(id)}.json`),
  },
  {
    name: "list_agent_skills",
    description:
      "List the Hub's installable agent skills (Agent Skills format) with descriptions, download URLs, and digests.",
    inputSchema: { type: "object", properties: {} },
    execute: () => fetchText("/.well-known/agent-skills/index.json"),
  },
];

const modelContext = (
  document as Document & {
    modelContext?: { registerTool(tool: unknown): Promise<void> };
  }
).modelContext;

if (modelContext) {
  void Promise.allSettled(tools.map((tool) => modelContext.registerTool(tool)));
}
