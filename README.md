# CGIAR Climate Data Hub

## Development

```sh
bun install
bun run dev     # dev server at localhost:4321
bun run build   # static build to dist/
bun run check   # lint + format (Biome)
```

### Architecture blueprint as a PDF

`src/content/wikis/architecture.md` is the technical blueprint deliverable. It
renders on the site at `/wikis/architecture/`, and
[Quarto](https://quarto.org) turns the same file into a PDF:

```sh
quarto render src/content/wikis/architecture.md --to typst \
  -o architecture.pdf --metadata validate-yaml=false
```

Typst ships with Quarto, so this needs no LaTeX. The `--metadata` flag is
needed because Quarto type-checks its own `section:` key, which the site uses
for the wiki sidebar group — passing it on the command line keeps print
concerns out of the content file. If the PDF grows its own options (a printed
date, `toc`, a template), put them in a `print.yml` and pass
`--metadata-file print.yml` instead; Quarto doesn't read the site's `updated:`
field.

Keep diagrams as image references (`![…](./diagram.svg)`) rather than inline
`<svg>` — Pandoc drops raw HTML on the way to PDF — and use absolute URLs for
links you want clickable in print.
### Lighthouse CI

`bun run lh` builds the site with the bundled example records and skills,
then audits the URLs configured in `lighthouserc.json`. Reports are written
to the gitignored `.lighthouseci/` directory; each run replaces the previous
results. Open the latest local report with:

```sh
bun run lh:open
```

Pull requests to `main` run the same checks and attach the reports to the
Lighthouse workflow as a downloadable artifact. The `robots-txt` audit is
skipped because the pinned Lighthouse version does not yet recognize the valid
`Content-Signal` directive used by the site.

### Commit hooks

Lint/format checks run as git hooks via
[prek](https://github.com/j178/prek) — a drop-in
[pre-commit](https://pre-commit.com) replacement; both read the same
`.pre-commit-config.yaml`, so use whichever you have:

```sh
prek install          # or: pre-commit install
```

On commit this runs Biome (JS/TS/Astro/CSS), ruff (Python snippets and
notebooks), air (R snippets), and basic file hygiene checks.

## Catalog records

Dataset records are **not** in this repo — the `catalog` collection is
fetched at build time from
[`cdh-catalog`](https://github.com/CGIAR-Climate-Data-Hub/cdh-catalog)'s
`records/` directory (that repo triggers a site rebuild when records change).
To point a local session elsewhere, use shell environment variables
(`.env` files don't reach the loader):

```sh
# A local checkout — offline, previews uncommitted records
RECORDS_DIR=../cdh-catalog/records bun run dev

# A branch of cdh-catalog (e.g. an open data PR)
RECORDS_REF=my-branch bun run dev

# A different repo, e.g. a fork (composes with RECORDS_REF)
RECORDS_REPO=you/cdh-catalog bun run dev
```

Unset, builds fetch `cdh-catalog@main`. If the records fetch fails, the
previously loaded records are kept, so offline dev keeps working — unless
`REQUIRE_RECORDS` is set (the deploy workflow's guard), in which case a
build that would produce an empty catalog fails instead.

No records checked out? `bun run dev:example` runs the site against the
bundled fixtures in `examples/records/` — a populated catalog for frontend
work without cloning `cdh-catalog`. The fixtures are dev-only: nothing uses
them unless `RECORDS_DIR` points at them.

Don't commit record YAML to this repo — `src/content/catalog/` is
gitignored and anything in it is ignored by the build; records belong in
`cdh-catalog`.

## Licensing

- **Website content** (text, documentation, images) is licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Source code** is licensed under [MIT](./LICENSE).
- **Datasets** are licensed individually — see the `license` field of each
  catalog record.
