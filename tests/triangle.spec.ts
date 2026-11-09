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
  const vertex = await page.getByRole('button', { name: `Triangle vertex ${name}`, exact: true })
    .locator('.triangle-vertex-hit').boundingBox()
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
  await moveVertex(page, 'A', 250, 250)
  await expect(page.getByTestId('circumradius')).not.toHaveText('—')
  await expect(page.getByTestId('triangle-incircle')).toHaveCount(1)
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
