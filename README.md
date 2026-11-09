# The Japanese Theorem

A browser-based geometry notebook built with React, TypeScript, Vite, and SVG.
The first exploration demonstrates the invariant sum of triangle inradii in a
fixed convex cyclic polygon.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

## Explore

- Choose 3 to 40 vertices and one of 25 deterministic seeds for vertex placement
  and triangulation.
- Show or hide incircles. Hover or focus a summand to highlight its triangle.
- Drag between nonadjacent vertices to force a diagonal. Crossing forced
  diagonals are removed; compatible ones stay. Remove individual diagonals using
  their chips or clear them all.
- Keyboard alternative: Tab to a vertex, press Enter or Space, then repeat at
  the other endpoint. Escape cancels the selection.
- Changing either seed or the vertex count clears forced diagonals.

All lengths are in units of the circumradius, R = 1. Every render calculates
each triangle's actual incenter and inradius from its side lengths and area,
then sums those radii. The displayed total is never substituted with an
invariant or a cached result. A separate fan triangulation provides a numerical
cross-check. Individual terms are rounded to four decimals and the total to six;
more than 20 terms are abbreviated to the first and last nine.

Changing the vertex placement changes the polygon and can change the total.
Changing only its triangulation preserves the total. Seeds need not give unique
triangulations, especially for polygons with few vertices.

The notebook has one working tab. The disabled future-tab placeholder is
deliberate; further explorations are not implemented yet.

## Validate

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Geometry tests cover every supported vertex count and all 625 seed pairs,
tangency, area coverage, and evolving forced constraints. Browser tests cover
live totals, drag and keyboard interactions, constraint replacement, resets,
visibility, limits, and mobile layout.
