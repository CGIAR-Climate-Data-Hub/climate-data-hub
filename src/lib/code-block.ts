// Build-time replacement for the old Layout.astro runtime script: wraps every
// shiki block in the .code-block header chrome (language label + copy button)
// so pages ship the finished markup. Only the copy *click* stays client-side
// (Layout.astro) — clipboard access has no declarative equivalent.
import type { Element, ElementContent, Properties } from "hast";
import type { ShikiTransformer } from "shiki";

const el = (
  tagName: string,
  properties: Properties,
  children: ElementContent[] = [],
): Element => ({ type: "element", tagName, properties, children });

const icon = (name: string, children: Element[]) =>
  el(
    "svg",
    {
      ariaHidden: "true",
      className: [name],
      fill: "none",
      height: 13,
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: 2,
      viewBox: "0 0 24 24",
      width: 13,
    },
    children,
  );

// Both icons ship in the button; .copied (toggled on click) swaps them in CSS.
const copyIcon = () =>
  icon("ic-copy", [
    el("rect", { height: 12, rx: 2, width: 12, x: 9, y: 9 }),
    el("path", {
      d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
    }),
  ]);
const checkIcon = () =>
  icon("ic-check", [el("path", { d: "M20 6 9 17l-5-5" })]);

/** Pass a label to override the displayed language (e.g. "BibTeX"). */
export function codeHeader(label?: string): ShikiTransformer {
  return {
    name: "code-header",
    root(root) {
      const head = el("div", { className: ["code-head"] }, [
        el("span", { className: ["mono", "code-lang"] }, [
          { type: "text", value: label ?? this.options.lang ?? "code" },
        ]),
        el(
          "button",
          { ariaLabel: "Copy code", className: ["code-copy"], type: "button" },
          [copyIcon(), checkIcon()],
        ),
      ]);
      root.children = [
        el("div", { className: ["code-block"] }, [
          head,
          ...(root.children as ElementContent[]),
        ]),
      ];
    },
  };
}

/**
 * One shiki config for every render path: `markdown.shikiConfig` in
 * astro.config.mjs and the satteri renderer on catalog pages. `<Code>`
 * components share it via `theme={shikiConfig.theme}` plus a labelled
 * `codeHeader(...)` of their own.
 */
export const shikiConfig = {
  theme: "github-light-high-contrast" as const,
  transformers: [codeHeader()],
};
