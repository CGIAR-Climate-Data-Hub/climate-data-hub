// Content-collection loader for executed Jupyter notebooks: markdown cells
// pass through, code cells become fenced blocks, and saved outputs become
// figures (PNG), tables (HTML), or text blocks. Outputs that need a runtime
// (Plotly, widgets) are skipped — publish those tutorials as exported HTML
// instead. Tutorial frontmatter lives in the notebook's metadata under the
// "cdh" key, with the same fields as a markdown tutorial.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Loader } from "astro/loaders";

interface Output {
  text?: string | string[];
  traceback?: string[];
  data?: Record<string, string | string[]>;
}

interface Cell {
  cell_type: string;
  source: string | string[];
  outputs?: Output[];
}

// Notebook JSON stores text as line arrays
const text = (s?: string | string[]) =>
  Array.isArray(s) ? s.join("") : (s ?? "");

// Terminal colour codes in stream/traceback output
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function cellToMd(cell: Cell) {
  if (cell.cell_type === "markdown") return text(cell.source);
  if (cell.cell_type !== "code" || !text(cell.source).trim()) return "";

  const parts = [`\`\`\`python\n${text(cell.source).trimEnd()}\n\`\`\``];
  for (const out of cell.outputs ?? []) {
    const png = out.data?.["image/png"];
    const html = out.data?.["text/html"];
    const plain = out.text ?? out.data?.["text/plain"] ?? out.traceback;
    // Rich reprs (pandas, xarray) save html + a png snapshot: prefer the
    // real markup. Script-bearing html (Plotly …) falls through to the png.
    // Blank lines are collapsed so markdown treats the chunk as one raw
    // HTML block instead of re-parsing (and mangling) its tail. Rich machine
    // representations stay out of search; prose and source code remain
    // indexed.
    if (html && !text(html).includes("<script")) {
      const repr = text(html)
        .trim()
        .replace(/\n\s*\n/g, "\n");
      parts.push(
        `<div class="notebook-output" data-pagefind-ignore>\n${repr}\n</div>`,
      );
    } else if (png) {
      parts.push(
        `![Cell output](data:image/png;base64,${text(png).replaceAll("\n", "")})`,
      );
    } else if (plain) {
      parts.push(
        `\`\`\`\n${text(plain).replaceAll(ansi, "").trimEnd()}\n\`\`\``,
      );
    }
  }
  return parts.join("\n\n");
}

export function notebooks(dir: string): Loader {
  return {
    name: "notebooks",
    async load({ store, parseData, renderMarkdown, logger }) {
      store.clear();
      for (const file of await readdir(dir)) {
        if (!file.endsWith(".ipynb")) continue;
        const id = file.replace(/\.ipynb$/, "").toLowerCase();
        const nb = JSON.parse(await readFile(join(dir, file), "utf8"));
        if (!nb.metadata?.cdh) {
          logger.warn(`${file} has no "cdh" metadata block — skipped`);
          continue;
        }
        const data = await parseData({ id, data: nb.metadata.cdh });
        const md = (nb.cells as Cell[]).map(cellToMd).filter(Boolean);
        const rendered = await renderMarkdown(md.join("\n\n"));
        // renderMarkdown leaves headings empty; the ToC needs them
        rendered.metadata ??= {};
        rendered.metadata.headings = [
          ...rendered.html.matchAll(
            /<h([1-6]) id="([^"]+)"[^>]*>(.*?)<\/h\1>/g,
          ),
        ].map((m) => ({
          depth: Number(m[1]),
          slug: m[2],
          text: m[3].replace(/<[^>]+>/g, ""),
        }));
        store.set({ id, data, filePath: join(dir, file), rendered });
      }
    },
  };
}
