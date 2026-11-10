import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { analyzeTriangle, createFreeTriangle } from '../src/triangleGeometry'
import type { TrianglePoints } from '../src/triangleGeometry'

async function openTriangle(page: Page) {
  await page.goto('/')
  await page.getByRole('tab', { name: 'The incircle' }).click()
}

async function trianglePoints(page: Page): Promise<TrianglePoints> {
  const points = await page.locator('.triangle-vertex-dot').evaluateAll((nodes) =>
    nodes.map((node) => ({ x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) })))
  if (points.length !== 3) throw new Error('Triangle must have three vertices')
  return [points[0], points[1], points[2]]
}

async function moveVertex(page: Page, name: string, x: number, y: number, release = true) {
  const control = page.getByRole('button', { name: `Triangle vertex ${name}`, exact: true })
  await control.focus()
  const vertex = await control.locator('.triangle-vertex-hit').boundingBox()
  const target = await page.locator('.triangle-diagram').evaluate((svg, point) => {
    const screen = new DOMPoint(point.x, point.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!)
    return { x: screen.x, y: screen.y }
  }, { x, y })
  if (!vertex) throw new Error('Triangle vertex not visible')
  await page.mouse.move(vertex.x + vertex.width / 2, vertex.y + vertex.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 12 })
  if (release) await page.mouse.up()
}

async function expectSegmentComparison(page: Page) {
  const geometry = analyzeTriangle(await trianglePoints(page))
  if (!geometry.valid) throw new Error(geometry.reason)
  const readSegments = (testId: string) => page.getByTestId(testId).evaluateAll((nodes) => nodes.map((node) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected a line segment')
    return { start: node.x1.baseVal.value, end: node.x2.baseVal.value, y1: node.y1.baseVal.value, y2: node.y2.baseVal.value }
  }))
  const radii = await readSegments('radius-sum-segment')
  const distances = await readSegments('distance-sum-segment')
  expect(radii).toHaveLength(2)
  expect(distances).toHaveLength(3)
  const scale = (radii[0].end - radii[0].start) / geometry.outer.radius
  expect(scale).toBeGreaterThan(0)
  expect((radii[1].end - radii[1].start) / scale).toBeCloseTo(geometry.inner.radius, 3)
  expect(radii[0].end).toBeCloseTo(radii[1].start, 8)
  expect(distances[0].start).toBeCloseTo(radii[0].start, 8)
  distances.forEach((segment, index) => {
    expect(segment.y1).toBe(segment.y2)
    expect(segment.y1).toBeGreaterThan(radii[0].y1)
    expect((segment.end - segment.start) / scale).toBeCloseTo(geometry.sides[index].signedDistance, 3)
    if (index > 0) expect(segment.start).toBeCloseTo(distances[index - 1].end, 8)
  })
  expect(distances[2].end).toBeCloseTo(radii[1].end, 8)
  return distances
}

test('switches tabs accessibly and preserves independent construction states', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('slider', { name: 'Fan vertex', exact: true }).fill('4')
  const originalSum = await page.getByTestId('radius-sum').textContent()
  const firstTab = page.getByRole('tab', { name: 'The invariant' })
  await firstTab.focus()
  await firstTab.press('ArrowRight')
  await expect(page.getByRole('tabpanel', { name: 'The incircle' })).toBeVisible()
  await page.getByRole('slider', { name: 'Triangle seed' }).fill('12')
  await page.getByRole('button', { name: 'Angle bisectors', exact: true }).click()
  await page.getByRole('tab', { name: 'The invariant' }).click()
  await expect(page.getByTestId('radius-sum')).toHaveText(originalSum!)
  await expect(page.getByRole('slider', { name: 'Fan vertex', exact: true })).toHaveValue('4')
  await page.getByRole('tab', { name: 'The incircle' }).click()
  await expect(page.getByRole('slider', { name: 'Triangle seed' })).toHaveValue('12')
  await expect(page.getByTestId('angle-bisector')).toHaveCount(3)
})

test('toggles every construction layer independently and keeps the live readouts', async ({ page }) => {
  await openTriangle(page)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const originalR = await page.getByTestId('circumradius').textContent()
  const layers = [
    { name: 'Circumcircle', selector: '[data-testid="triangle-circumcircle"]', count: 1, on: true },
    { name: 'Incircle', selector: '[data-testid="triangle-incircle"]', count: 1, on: true },
    { name: 'Perpendicular bisectors', selector: '[data-testid="perpendicular-bisector"]', count: 3, on: false },
    { name: 'Angle bisectors', selector: '[data-testid="angle-bisector"]', count: 3, on: false },
    { name: 'Centers O and I', selector: '.circumcenter-marker, .incenter-marker', count: 2, on: true },
    { name: 'Radius segments R and r', selector: '.outer-radius, .inner-radius', count: 2, on: false },
    { name: 'Carnot distances', selector: '[data-testid="carnot-distance"]', count: 3, on: false },
  ]
  for (const layer of layers) {
    const toggle = page.getByRole('button', { name: layer.name, exact: true })
    await expect(page.locator(layer.selector)).toHaveCount(layer.on ? layer.count : 0)
    await toggle.click()
    await expect(page.locator(layer.selector)).toHaveCount(layer.on ? 0 : layer.count)
    await expect(toggle).toHaveAttribute('aria-pressed', String(!layer.on))
    await toggle.click()
  }
  await expect(page.getByTestId('circumradius')).toHaveText(originalR!)
  expect(errors).toEqual([])
})

test('shows live segment sums with shared scale whenever the Carnot panel is shown', async ({ page }) => {
  await openTriangle(page)
  const chart = page.getByRole('img', { name: 'Length comparison of R plus r and the signed Carnot distances' })
  await expect(chart).toHaveCount(0)
  await page.getByRole('button', { name: 'Carnot distances', exact: true }).click()
  await expect(chart).toBeVisible()
  await expect(page.getByRole('button', { name: 'Radius segments R and r', exact: true })).toHaveAttribute('aria-pressed', 'false')
  const initial = await expectSegmentComparison(page)
  expect(initial.every((segment) => segment.end > segment.start)).toBe(true)
  expect(new Set(initial.map((segment) => segment.y1)).size).toBe(1)
  await page.getByRole('button', { name: 'Radius segments R and r', exact: true }).click()
  expect(await expectSegmentComparison(page)).toEqual(initial)
  const radiusColors = await page.locator('.outer-radius line, .inner-radius line').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).stroke))
  expect(await page.getByTestId('radius-sum-segment').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).stroke))).toEqual(radiusColors)
  await page.getByRole('slider', { name: 'Triangle seed' }).fill('12')
  expect(await expectSegmentComparison(page)).not.toEqual(initial)
  await page.setViewportSize({ width: 390, height: 844 })
  await expectSegmentComparison(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Carnot distances', exact: true }).click()
  await expect(chart).toHaveCount(0)
})

test('shows negative Carnot segments pointing left in any position and handles a zero distance', async ({ page }) => {
  await openTriangle(page)
  await page.getByRole('button', { name: 'Carnot distances', exact: true }).click()
  const obtuse = [{ x: 250, y: 380 }, { x: 100, y: 400 }, { x: 500, y: 400 }]
  for (let negative = 0; negative < 3; negative++) {
    await page.getByRole('button', { name: 'Reset triangle', exact: true }).click()
    for (let index = 0; index < 3; index++) {
      const point = obtuse[(index - negative + 3) % 3]
      await moveVertex(page, 'ABC'[index], point.x, point.y)
    }
    const segments = await expectSegmentComparison(page)
    expect(segments.filter((segment) => segment.end < segment.start)).toHaveLength(1)
    expect(new Set(segments.map((segment) => segment.y1)).size).toBe(3)
    expect(segments[negative].end).toBeLessThan(segments[negative].start)
    const negativeLine = page.getByTestId('distance-sum-segment').nth(negative)
    await expect(negativeLine).toHaveAttribute('marker-end', /carnot-sum-arrow/)
    const diagramColors = await page.locator('[data-testid="carnot-distance"] > line').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).stroke))
    expect(await page.getByTestId('distance-sum-segment').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).stroke))).toEqual(diagramColors)
  }
  await page.getByRole('button', { name: 'Reset triangle', exact: true }).click()
  await moveVertex(page, 'A', 100, 100)
  await moveVertex(page, 'B', 100, 400)
  await moveVertex(page, 'C', 500, 400)
  const right = await expectSegmentComparison(page)
  expect(right[1].end).toBeCloseTo(right[1].start, 8)
  await expect(page.getByTestId('distance-sum-segment').nth(1)).not.toHaveAttribute('marker-end')
})

test('marks perpendicular intersections and equal half-angles while vertices move and the view changes', async ({ page }) => {
  await openTriangle(page)
  await page.getByRole('button', { name: 'Perpendicular bisectors', exact: true }).click()
  await page.getByRole('button', { name: 'Angle bisectors', exact: true }).click()

  async function checkMarkers() {
    await expect(page.getByTestId('bisector-right-angle')).toHaveCount(3)
    await expect(page.getByTestId('equal-angle-indicator')).toHaveCount(6)
    const squares = await page.getByTestId('bisector-right-angle').evaluateAll((nodes) => nodes.map((node) => {
      if (!(node instanceof SVGPathElement)) throw new Error('Expected an SVG path')
      const midpoint = node.parentElement!.querySelector('circle')!
      const origin = { x: Number(midpoint.getAttribute('cx')), y: Number(midpoint.getAttribute('cy')) }
      const length = node.getTotalLength()
      const a = node.getPointAtLength(0)
      const b = node.getPointAtLength(length / 2)
      const c = node.getPointAtLength(length)
      const u = { x: a.x - origin.x, y: a.y - origin.y }
      const v = { x: c.x - origin.x, y: c.y - origin.y }
      return {
        cosine: (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)),
        ratio: Math.hypot(u.x, u.y) / Math.hypot(v.x, v.y),
        cornerError: Math.hypot(b.x - origin.x - u.x - v.x, b.y - origin.y - u.y - v.y),
      }
    }))
    for (const square of squares) {
      expect(square.cosine).toBeCloseTo(0, 4)
      expect(square.ratio).toBeCloseTo(1, 4)
      expect(square.cornerError).toBeLessThan(0.001)
    }
    const angles = await page.getByTestId('equal-angle-indicator').evaluateAll((nodes) => nodes.map((node) => {
      const line = node.parentElement!.querySelector('line')!
      const origin = { x: Number(line.getAttribute('x1')), y: Number(line.getAttribute('y1')) }
      return [...node.querySelectorAll<SVGPathElement>('.angle-arc')].map((path) => {
        const from = path.getPointAtLength(0)
        const to = path.getPointAtLength(path.getTotalLength())
        const ax = from.x - origin.x
        const ay = from.y - origin.y
        const bx = to.x - origin.x
        const by = to.y - origin.y
        return { angle: Math.atan2(Math.abs(ax * by - ay * bx), ax * bx + ay * by), radius: Math.hypot(ax, ay) }
      })
    }))
    for (let index = 0; index < angles.length; index += 2) {
      angles[index].forEach((arc, marker) => {
        expect(arc.angle).toBeGreaterThan(0)
        expect(arc.angle).toBeLessThan(Math.PI / 2)
        expect(arc.angle).toBeCloseTo(angles[index + 1][marker].angle, 4)
        expect(arc.radius).toBeCloseTo(angles[index + 1][marker].radius, 3)
      })
    }
  }

  await checkMarkers()
  const before = await page.getByTestId('bisector-right-angle').first().getAttribute('d')
  await moveVertex(page, 'A', 320, 590)
  await checkMarkers()
  await expect(page.getByTestId('bisector-right-angle').first()).not.toHaveAttribute('d', before!)
  await page.getByRole('button', { name: 'Fit circles', exact: true }).click()
  await checkMarkers()
  await page.getByRole('button', { name: 'Perpendicular bisectors', exact: true }).click()
  await expect(page.getByTestId('bisector-right-angle')).toHaveCount(0)
  await expect(page.getByTestId('equal-angle-indicator')).toHaveCount(6)
  await page.getByRole('button', { name: 'Angle bisectors', exact: true }).click()
  await expect(page.getByTestId('equal-angle-indicator')).toHaveCount(0)
})

test('drags freely, computes actual circle radii, supports keyboard movement, and restores cancelled drags', async ({ page }) => {
  await openTriangle(page)
  const original = await trianglePoints(page)
  await moveVertex(page, 'A', 320, 100)
  const moved = await trianglePoints(page)
  expect(moved[0].x).toBeCloseTo(320, 8)
  expect(moved[0].y).toBeCloseTo(100, 8)
  expect(moved[1]).toEqual(original[1])
  expect(moved[2]).toEqual(original[2])
  const geometry = analyzeTriangle(moved)
  if (!geometry.valid) throw new Error(geometry.reason)
  await expect(page.getByTestId('circumradius')).toHaveText((geometry.outer.radius / 100).toFixed(6))
  await expect(page.getByTestId('inradius')).toHaveText((geometry.inner.radius / 100).toFixed(6))
  const vertex = page.getByRole('button', { name: 'Triangle vertex A', exact: true })
  await vertex.press('ArrowRight')
  expect((await trianglePoints(page))[0].x).toBeCloseTo(323, 8)
  await vertex.press('Shift+ArrowDown')
  expect((await trianglePoints(page))[0].y).toBeCloseTo(110, 8)
  const beforeCancel = await trianglePoints(page)
  await moveVertex(page, 'A', 350, 130, false)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await trianglePoints(page)).toEqual(beforeCancel)
  await page.getByRole('button', { name: 'Reset triangle', exact: true }).click()
  expect(await trianglePoints(page)).toEqual(createFreeTriangle(7))
})

test('handles obtuse and collinear triangles honestly and fits an external circumcircle', async ({ page }) => {
  await openTriangle(page)
  await moveVertex(page, 'A', 250, 380)
  await moveVertex(page, 'B', 100, 400)
  await moveVertex(page, 'C', 500, 400)
  await page.getByRole('button', { name: 'Carnot distances', exact: true }).click()
  await expect(page.locator('[data-testid="carnot-distance"][data-sign="negative"]')).toHaveCount(1)
  const actual = Number(await page.getByTestId('carnot-sum').textContent())
  const expected = Number(await page.getByTestId('radii-sum').textContent())
  expect(actual).toBeCloseTo(expected, 6)
  await expect(page.getByRole('note')).toContainText('extends beyond')
  const before = await trianglePoints(page)
  await page.getByRole('button', { name: 'Fit circles', exact: true }).click()
  await expect(page.getByRole('note')).toHaveCount(0)
  expect(await trianglePoints(page)).toEqual(before)
  await page.getByRole('button', { name: 'Reset triangle', exact: true }).click()
  await moveVertex(page, 'A', 250, 400)
  await moveVertex(page, 'B', 100, 400)
  await moveVertex(page, 'C', 500, 400)
  await expect(page.getByRole('status', { name: 'Triangle updates' })).toContainText('collinear')
  await expect(page.getByTestId('circumradius')).toHaveText('—')
  await expect(page.getByTestId('inradius')).toHaveText('—')
  await expect(page.getByTestId('triangle-circumcircle')).toHaveCount(0)
  await expect(page.getByTestId('triangle-incircle')).toHaveCount(0)
  await expect(page.locator('.carnot-segments')).toHaveCount(0)
  await moveVertex(page, 'A', 250, 250)
  await expect(page.getByTestId('circumradius')).not.toHaveText('—')
  await expect(page.getByTestId('triangle-incircle')).toHaveCount(1)
  await expect(page.locator('.carnot-segments')).toHaveCount(1)
})

test('keeps the diagram square and the new controls usable on a phone', async ({ page }) => {
  await openTriangle(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const box = await page.locator('.triangle-diagram').boundingBox()
  if (!box) throw new Error('Diagram not visible')
  expect(box.width).toBeCloseTo(box.height, 5)
  await moveVertex(page, 'A', 320, 200)
  await expect(page.getByRole('button', { name: 'Incircle', exact: true })).toBeVisible()
  const controls = await page.getByRole('complementary', { name: 'Triangle controls' }).boundingBox()
  const toggle = await page.getByRole('button', { name: 'Perpendicular bisectors', exact: true }).boundingBox()
  if (!controls || !toggle) throw new Error('Controls not visible')
  expect(toggle.width).toBeCloseTo(controls.width, 5)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 320, height: 700 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
