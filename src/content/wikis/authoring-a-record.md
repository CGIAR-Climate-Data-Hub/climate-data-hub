---
title: Authoring a metadata record
description: "What goes in a CDH record, field by field — and the three ways to produce one: the AI skill, the web editor, or hand-written YAML."
section: Data standards
updated: 2026-08-25
order: 1
---

Every dataset in the Hub is one YAML record in the
[catalog repository](https://github.com/CGIAR-Climate-Data-Hub/cdh-catalog).
The record is the dataset as far as the Hub is concerned: it drives the catalog
page, the search index, the citation block, and the code examples.

This page is the reference for what a record contains. For the submission
process — fork, PR, review — see [Contribute a dataset](/contribute/); for who
approves it, see [Governance](/wikis/governance/).

## Three ways to write one

All three produce the same YAML and are validated the same way. Pick by how
much of the dataset you already have documented.

### The AI skill

`cdh-record-authoring` drafts a record from a dataset description, filling
required fields and the datacube conventions below. It gets you a structurally
valid draft in one pass; it cannot know your provenance, funding, or
appropriate-use caveats, so treat its output as a first draft and expect to
supply those by hand.

Install and usage instructions live on the
[skills site](https://cgiar-climate-data-hub.github.io/skills/getting-started/)
— that documentation is maintained alongside the skill itself, so it is the
authority, not this page.

### The web editor

> **TODO** — link the editor and describe its flow, in particular where it hands
> off to a pull request and whether it validates before submitting.

### By hand

Copy an existing record from the catalog repo, or start from the template in the
record-authoring skill's `references/record-template.md`. Validate before you
open a PR:

```sh
uvx check-jsonschema \
  --schemafile spec/schemas/profiles/cdh.schema.json my-record.yaml
```

CI runs the same check, so a local pass means the structural half of review is
already done.

## Required fields

Only five fields are mandatory. A record with just these validates — it will
simply produce a thin catalog page.

| Field | Notes |
| --- | --- |
| `id` | Stable identifier; also the catalog URL. Never reuse or rename. |
| `title` | Human-readable dataset name. |
| `description` | Rendered as the page lede. Markdown is supported. |
| `license` | SPDX identifier. See [Governance](/wikis/governance/) for what's accepted. |
| `resource_type` | What kind of resource this is. |

## Fields that make a record useful

Optional to the validator, expected in review — the
[pre-submission checklist](/contribute/) is effectively this list.

- **`contact[]`** — `name`, `organization`, `roles`, `email`, `url`. Roles carry
  the meaning (`custodian`, `licensor`, `producer`); **order does not**. Never
  rely on position to signal who is primary.
- **`citation`** — `title`, `authors`, `date`, `publisher`, `url`. Rendered
  copy-ready on the dataset page, so reusers cite what you put here.
- **`doi`** — always points at the citable identifier, whether minted by the Hub
  or inherited from the original publisher.
- **`spatial`** — `bbox` (one, or a list per the datacube extension),
  `geography`, `crs`, and `resolution[]`.
- **`temporal`** — either `{date}` for a static reference year ("represents
  2020", not "covers 2020") or `{start_date, end_date}` for a span. Dates are
  ISO 8601 and may be reduced precision (`2020`, `2020-06`); a reduced-precision
  `end_date` is inclusive through the end of that period. `end_date: null` means
  ongoing.
- **`keywords[]`** — bare strings, or `{term, scheme, uri}` when the term comes
  from a controlled vocabulary.
- **`cdh.not_recommended_for[]`** — `{use, reason, use_instead}`. The most
  valuable field in the record and the one most often left empty. It is what
  stops someone using a dataset at the wrong scale.

## Assets and distributions

`assets[]` is how the data is actually reached. Each asset takes a `name`,
`locations[]` (a `url` plus optional `title`), and usually `media_type`,
`file_size`, `roles`, and `nodata`.

Two conventions the site depends on:

- **The first asset of a given format drives the code example** on the dataset
  page. Put the canonical distribution first.
- **`media_type` must match a concept id** in the site's format vocabulary,
  which is what selects the quickstart and subset snippets.

## Datacube conventions

For gridded data, `dimensions[]` and `variables[]` describe the cube.

- **The first dimension listed is the primary one** — the site treats it as the
  axis a user slices along first.
- Temporal dimensions take `step` as an ISO 8601 duration between slices.
- `values[]` may be bare numbers in the standard (years); the site coerces them
  to strings.
- `variables[]` want `unit` and `data_type` — the code examples read them.
- Latitude descends, and x/y coordinate names follow the
  [cloud-optimization conventions](/wikis/cloud-optimizing-data/).

Categorical variables add `classes[]` to map values to labels; projection
datasets add the `climate` block (`mip_era`, `models[]`, `scenarios[]`,
`baseline`, `bias_adjustment`, `downscaling`).

## Versioning

Versions are **fields, never folders**. A new version is a new record with
`previous_version` pointing back; the superseded record stays in place with
`deprecated: true` so existing citations keep resolving. `series` is a different
axis — a family of related datasets (MapSPAM, say), not a version chain.
