---
title: Governance
description: How datasets are chosen, maintained, and retired — and who decides.
section: The Hub
updated: 2026-08-25
order: 2
---

> Outline only — sections below are prompts to be filled in. Keep the finished
> page to two pages; past that it stops being read.

## Scope

This page governs the **catalog**: which datasets enter, how they are kept
current, and when they are retired.

**Metadata governance is separate.** The CDH metadata standard has its own
governance process — link to it here rather than restating it, so the two can
move at different speeds.

## Who does what

Name teams, not individuals, so the page survives staff changes.

- **Who decides what enters** — the group that triages proposals and holds the
  weekly thumbs-up/down below.
- **Who runs the data infrastructure** — ownership of the pipeline, the cloud
  buckets, and the STAC/record endpoints. Say who to contact when something
  breaks, and who carries the storage cost.

## Choosing datasets

The bar a dataset has to clear: relevance to CGIAR climate work, metadata
complete against the Hub profile, a redistributable licence (below), a stable
resolvable location, documented provenance and method.

Keep this list short enough to apply consistently in a five-minute review.

## How a dataset gets in

Two tiers, deliberately — most datasets should never need a meeting.

1. **Obvious** — clears every criterion with no open questions: added directly,
   no ceremony.
2. **Everything else** — goes to the weekly meeting for a thumbs up/down.
   State the standing agenda slot, who can put an item on it, and what a
   "not yet" means in practice.

Say where a decision is recorded, so a "no" and its reason are findable a year
later.

## Maintenance commitments

What the Hub actually promises about currency: the review cadence per dataset
(annually? on upstream release?), who is responsible, and what happens when an
upstream source goes stale or vanishes.

Be honest about what can be sustained — a stated best-effort is worth more than
a yearly commitment that quietly lapses.

## Tracking updates

How a user finds out that a dataset has changed. Today the record fields carry
it — `version`, `previous_version`, and `deprecated`, with version chains
rendered on the record page — but there is **no feed or notification**. Decide
whether that gap gets filled or is written down as a known limitation.

## Licensing and attribution

The Hub only publishes data that can be legally redistributed and reused.

**Permitted licences**

- **CC-BY-4.0** — preferred for new contributions
- **CC-BY-SA-4.0** — accepted; the share-alike obligation propagates
- **CC0 / Public Domain** — accepted
- Custom or non-commercial licences are **not** accepted; talk to the
  maintainers if your source data is restricted.

The licence in the metadata record is an SPDX identifier and applies to the
distributions listed in that record, not to third-party source data, which
retains its own terms.

**Attribution** — reusers cite the dataset as given in the record's `citation`
block, which every dataset page renders copy-ready. Where a dataset is derived
from an external source, the original providers stay listed as
`licensor`/`producer` contacts and are credited alongside the Hub.

**DOIs** — datasets processed and published by the Hub get a DOI on
publication; datasets that already carry one from their original publisher keep
it. The record's `doi` field always points at the citable identifier.

## Retiring and correcting records

Grounds for retirement (licence withdrawn, superseded, found to be in error),
who authorises it, and what a reader sees afterwards. The Hub marks records
`deprecated` and links `previous_version` rather than deleting them, so cited
records stay resolvable.

## Amending this page

Who proposes a change, who approves it, and keeping `updated` current.
