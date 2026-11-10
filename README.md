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

## Japanese Theorem tab

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

## Carnot's Theorem tab

The second tab starts with three seeded points, not a prescribed circle. Drag
vertices A, B, and C freely, or focus a vertex and use arrow keys (Shift for
larger steps). All tabs retain their state when switching.

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

## Quadrilateral proof tab

Compare diagonals AC and BD of the same cyclic quadrilateral, side by side or
individually. Choose one of 25 seeds, or drag a vertex around the circumcircle.
Vertices cannot cross their neighbors. Arrow keys move a focused vertex;
Shift moves faster, and Escape restores a cancelled drag.

The four proof steps apply Carnot to each triangle, add each pair of equations,
cancel the opposite signed diagonal contributions, and compare what remains:

```text
2R + r_ABC + r_ACD = d_AB + d_AD + d_BC + d_CD
2R + r_ABD + r_BCD = d_AB + d_AD + d_BC + d_CD
```

Boundary distances are signed toward the quadrilateral's interior, not taken as
absolute lengths. This remains valid when the circumcenter lies outside.
Matching colors link terms to distances in both diagrams; hover or focus a term
to highlight it. Incircles, boundary distances, diagonal contributions, and the
circumradius segment can be toggled independently.
Triangle view selects First, Second, or Both within each visible quadrilateral.
It filters shading, incircles, and distance annotations, without changing the
triangulation, proof equations, or computed totals.

The final step compares both actual inradius sums and the independently computed
boundary-distance sum minus 2R, with radius segments on a common scale. None of
these totals is substituted for another. All lengths use R = 1.

## Carnot proof tab

The fourth tab proves Carnot's theorem through signed projections and areas.
It follows the elementary projection-and-area argument in
[Alexander Bogomolny's Carnot's Theorem, Proof 1](https://www.cut-the-knot.org/proofs/carnot.shtml),
with an original nine-tile visualization of the final addition.

1. Project a radius to see `d_a = R cos A`, including an obtuse angle's
   negative projection. Matching angle marks and a directed axis explain the sign.
2. Project a side: `a = c cos B + b cos C`, hence `aR = c d_b + b d_c`.
   Change the focus side to obtain all three identities.
3. Measure the triangle's area using O and I as alternate centers:
   `a d_a + b d_b + c d_c = 2 area = Pr`.
4. Split three strips of width `P = a + b + c` into nine actual-area tiles.
   The three diagonal tiles sum to `Pr`. The other six pair up through the
   side-projection identities and sum to `PR`. Hatched tiles are subtracted.
5. Divide `P(d_a + d_b + d_c) = P(r + R)` by the positive perimeter P.

Choose 25 seeds or explicit acute, right, and obtuse examples. Drag vertices
around the unit circle, or use arrow keys (Shift for larger movements). Escape
cancels a drag. Incircle, circumcircle, signed distances, and construction lines
can be toggled. Hover or focus a tile to find its base and height in the diagram.
Tile widths and absolute heights share a true length scale; signs are preserved
in all computations. The final segment comparison reuses the second tab's
construction with independently calculated totals.

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
Quadrilateral tests cover signed diagonal cancellation, external circumcenters,
cyclic vertex movement, proof steps, linked highlighting, and independent totals.
Carnot-proof tests verify every intermediate projection and area identity, signed
tile dimensions, right and obtuse examples, movement, and four-tab navigation.
