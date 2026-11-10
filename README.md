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
- Use the Fan vertex slider below Triangulation to shade triangles containing
  the chosen vertex and highlight that vertex. `0` turns shading off. This does
  not change any edges or radii. The choice persists across seed changes;
  reducing the vertex count past the selected vertex turns shading off.
- Drag between nonadjacent vertices to force a diagonal. Only existing edges
  crossing it are removed, whether forced or random. All compatible edges stay,
  and untouched triangles keep their colors and radius labels.
- While dragging over a possible endpoint, an orange translucent overlay shows
  exactly which triangles would change. Moving away or cancelling clears the
  preview; the construction changes only on release.
- Unlock individual diagonals using their chips or clear all locks. Unlocking
  does not redraw the triangulation; changing a seed generates a fresh one.
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

## The incircle tab

The second tab starts with three seeded points, not a prescribed circle. Drag
vertices A, B, and C freely, or focus a vertex and use arrow keys (Shift for
larger steps). Both tabs retain their state when switching.

Toggle the circumcircle, incircle, perpendicular side bisectors, angle bisectors,
centers, radius segments, and Carnot distances independently. Perpendicular
bisectors meet at the circumcenter O; internal angle bisectors meet at the
incenter I. Bottom readouts calculate the circumradius R and inradius r live,
in diagram units (100 drawing-coordinate units = 1 displayed unit).

Carnot distances are signed perpendicular distances from O to the side lines.
They are negative when O and the opposite vertex are on different sides of the
line. The optional panel computes their sum independently of R + r, including
obtuse triangles. This is a construction aid, not a scripted proof walkthrough.
The Carnot panel also compares R + r with the signed distance sum as head-to-tail
segments on a common scale. Negative distances point left; staggered tracks
keep backtracking visible, and vertical connectors have no length contribution.
This comparison is shown even when radius segments in the main diagram are off.

Collinear or overlapping vertices show an explicit message and unavailable
radius readouts rather than invalid circles. Fit circles adjusts the square
view without moving the vertices or changing any lengths. Reset triangle
restores the selected seed and the original view.

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
visibility, limits, mobile layout, and triangle-layer controls. Free-triangle
tests cover circle construction, bisectors, degeneracy, fitting, and the signed
Carnot identity for acute, right, and obtuse triangles in both orientations.
