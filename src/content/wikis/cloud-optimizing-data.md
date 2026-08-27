---
title: Cloud-optimizing data
description: Converting rasters to COG and cubes to Zarr so Hub datasets can be read by range request — the layout conventions, the tooling, and how to validate the result.
section: Data standards
updated: 2026-08-25
order: 2
---

The Hub distributes data in formats that can be read **without downloading the
whole file**. A client issues HTTP range requests for the bytes covering its
area or time slice. That single property is what makes the catalog's code
examples one-liners instead of download scripts, and it is why format
conversion is a submission requirement rather than a nicety.

Two formats cover almost everything:

- **Cloud-Optimized GeoTIFF (COG)** — single-variable rasters, one file per
  layer.
- **Zarr** — multidimensional cubes: time series, ensembles, anything with more
  than x/y.

If a dataset is one map, it is a COG. If it has a third dimension, it is Zarr.

## Converting

> **TODO** — name the CDH tool (repo + install), show the one-line invocation
> for COG and for Zarr, and say what it does beyond the underlying libraries.

The tool wraps the standard libraries and applies the layout conventions below.
When you need to work underneath it — an unusual source format, or a conversion
the wrapper does not cover — the equivalents are `rio-cogeo` for rasters and
`xarray.to_zarr` for cubes, in which case the conventions are on you to get
right.

## Layout conventions

These are what let a generic client read a Hub dataset without special-casing
it. The converter applies them; if you convert by hand, apply them yourself.

- **One array per first dimension.** The cube is chunked so that slicing along
  the primary axis is a contiguous read.
- **Coordinates are named `x` and `y`** (or `lon`/`lat` where geographic), so
  code examples can index without inspecting the store.
- **Latitude descends** — north at the top, matching raster convention. An
  ascending y axis silently flips maps in most plotting code.
- **Chunk for the expected access pattern.** Time series read across time;
  maps read across space. Chunks in the low megabytes: too small and a read is
  all overhead, too large and a subset pulls data nobody wanted.

The record's `dimensions[]` must describe the store as it actually is — the
first dimension listed is the primary one. See
[Authoring a metadata record](/wikis/authoring-a-record/).

## Validating

> **TODO** — the validator command, and whether CI runs it on the data itself or
> only on the record.

A useful independent check is to read a subset over HTTPS exactly as the catalog
page's code example would, from a machine that has never seen the file. If that
returns data in a second or two without pulling the whole store, the
optimization worked. If it hangs or downloads gigabytes, something in the
chunking or the header layout is wrong.

## Hosting

Range requests only work if the server supports them. The bucket must serve
`Accept-Ranges` and permit cross-origin reads, or every browser-based client
fails while `curl` appears to work fine.
