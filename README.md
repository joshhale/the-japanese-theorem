# The Japanese Theorem

A browser-based geometry workbook for exploring the beautiful [Japanese Theorem for cyclic polygons](https://en.wikipedia.org/wiki/Japanese_theorem_for_cyclic_polygons), and understanding its proof from basic trigonometry.

It's built using React, TypeScript, Vite, and SVG.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

## Validate

```sh
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

## Walkthrough

Start with the theorem, then work backwards through its proof: reduce polygons to quadrilaterals, use Carnot's theorem, prove Carnot, and finally establish the circle-angle fact it relies on.

### 00 算額

Two triangulations of the same cyclic polygon produce different incircles. Click either drawing to rearrange its triangulation, then click underneath to reveal the circles lined up by diameter. Their sizes change, but their total width stays the same.

The Japanese Theorem says precisely this: **for a fixed cyclic polygon, every triangulation has the same sum of incircle radii.**

### 01 Japanese Theorem

Hide the incircles first. Change the vertex count to explore cyclic polygons: polygons whose vertices all lie on a circle. Change the triangulation to divide the same polygon into triangles.

Visit tab 02 to understand incircles, then return and show them. Retriangulate and watch the radius sum remain constant. Each sum is calculated from the current triangles.

To reduce the proof to quadrilaterals, choose a fan vertex and drag diagonals from it until every triangle contains that vertex. Each local diagonal flip replaces the two triangles inside a quadrilateral. You can grow the fan by flipping an edge on its boundary.

Every flip is reversible. If a quadrilateral flip preserves the radius sum, every triangulation has the same sum as the fan. We only need to prove the quadrilateral case.

### 02 Carnot's Theorem

Start with the incircle and angle bisectors. A point on an angle bisector is equally distant from its two sides, so their intersection is the center of a circle touching all three sides.

Next show the circumcircle and perpendicular bisectors. Their intersection is equally distant from all three vertices, giving the circumcenter O.

Show the Carnot distances: perpendicular distances from O to the triangle's sides. Carnot's theorem says their sum is **R + r**, the circumradius plus the inradius. Make the triangle obtuse: O moves outside, and one distance becomes negative. The signed identity still holds.

We will use this result first and prove it afterwards.

### 03 Quadrilateral proof

Compare triangulations AC and BD. Apply Carnot to each triangle in the AC view, then add the equations.

The shared diagonal contributes a distance in one triangle and its negative in the other, so it disappears. What remains is the sum of four boundary distances, equal to **2R plus the two inradii**.

Repeat for BD. The boundary distances and circumradius are unchanged, so the two sums of inradii must be equal.

That proves the quadrilateral case and, through the fan argument, the full Japanese Theorem.

### 04 Carnot proof

Collect three small facts rather than trying to remember the whole proof at once.

First, the central-angle construction gives a right triangle with angle A, hypotenuse R, and adjacent side d_a. Therefore **cos A = d_a/R**.

Next, drop an altitude onto side a. Its two projections give **a = c cos B + b cos C**. Substitute the cosine identities to obtain **aR = c d_b + b d_c**, and repeat for the other sides.

Finally, measure the triangle's area twice: using O and the signed distances, then using the incenter and height r. This gives **a d_a + b d_b + c d_c = (a+b+c)r**.

In Step 5, expand **(a+b+c)(d_a + d_b + d_c)**. Hover over the nine terms: three collect into the area identity, and the other six pair into aR, bR, and cR. Factor and cancel the perimeter to conclude **d_a + d_b + d_c = r+R**.

### 05 Angle at the center

Finish the one fact we borrowed: the angle at the center is twice the angle at the circumference standing on the same arc.

Extend CO to a diameter CD. Equal radii make OCA isosceles: its base angles are α, so its exterior angle AOD is 2α. Repeat with OCB to obtain β and 2β.

Add the pieces to get **φ = 2θ**. If the diameter lies outside the angle at C, subtract instead. The same argument also handles reflex central angles.

Return to tab 00. The changing circles now come with a reason their sums agree.
