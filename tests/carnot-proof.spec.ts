import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { analyzeTriangle } from '../src/triangleGeometry'
import type { TrianglePoints } from '../src/triangleGeometry'

async function openProof(page: Page) {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Carnot proof' }).click()
}

async function pointsIn(page: Page): Promise<TrianglePoints> {
  const points = await page.locator('.carnot-proof-vertex').evaluateAll((nodes) =>
    nodes.map((node) => ({ x: (Number(node.getAttribute('cx')) - 320) / 205, y: (Number(node.getAttribute('cy')) - 320) / 205 })))
  if (points.length !== 3) throw new Error('Expected three proof vertices')
  return [points[0], points[1], points[2]]
}

async function actualGeometry(page: Page) {
  const geometry = analyzeTriangle(await pointsIn(page))
  if (!geometry.valid) throw new Error(geometry.reason)
  return geometry
}

async function expectActualTotals(page: Page) {
  const geometry = await actualGeometry(page)
  const sum = geometry.sides.reduce((total, side) => total + side.signedDistance, 0)
  await expect(page.getByTestId('carnot-proof-sum')).toHaveText(sum.toFixed(6))
  await expect(page.getByTestId('carnot-proof-radii')).toHaveText((geometry.outer.radius + geometry.inner.radius).toFixed(6))
}

test('navigates the fourth tab accessibly and preserves its construction and proof state', async ({ page }) => {
  await page.goto('/')
  const first = page.getByRole('tab', { name: 'Japanese Theorem' })
  const fourth = page.getByRole('tab', { name: 'Carnot proof' })
  await first.focus()
  await first.press('End')
  await expect(fourth).toBeFocused()
  await page.getByRole('slider', { name: 'Proof triangle seed' }).fill('15')
  await page.getByRole('button', { name: '4 Collect the tiles' }).click()
  await page.getByRole('button', { name: 'r pieces', exact: true }).click()
  const points = await pointsIn(page)
  await fourth.focus()
  await fourth.press('ArrowRight')
  await expect(first).toBeFocused()
  await first.press('ArrowLeft')
  await expect(fourth).toBeFocused()
  await expect(page.getByRole('slider', { name: 'Proof triangle seed' })).toHaveValue('15')
  await expect(page.getByRole('button', { name: '4 Collect the tiles' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'r pieces', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await pointsIn(page)).toEqual(points)
})

test('walks through all constructions and compares the two area decompositions', async ({ page }, testInfo) => {
  await openProof(page)
  await expect(page.getByTestId('carnot-radius-projection')).toBeVisible()
  await page.getByRole('button', { name: '2 Project a side' }).click()
  await expect(page.getByTestId('carnot-side-projection')).toBeVisible()
  for (const [focus, label] of ['a / A', 'b / B', 'c / C'].entries()) {
    await page.getByRole('radio', { name: label, exact: true }).check()
    const geometry = await actualGeometry(page)
    const parts = await page.getByTestId('carnot-side-part').evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute('data-value'))))
    expect(parts[0] + parts[1]).toBeCloseTo(geometry.sides[focus].length, 10)
  }
  await page.getByRole('button', { name: '3 Measure area twice' }).click()
  await expect(page.getByTestId('carnot-proof-area')).toHaveCount(3)
  const geometry = await actualGeometry(page)
  const weighted = geometry.sides.reduce((sum, side) => sum + side.length * side.signedDistance, 0)
  const perimeter = geometry.sides.reduce((sum, side) => sum + side.length, 0)
  await expect(page.getByTestId('carnot-weighted-area')).toHaveText(weighted.toFixed(6))
  await expect(page.getByTestId('carnot-inradius-area')).toHaveText((perimeter * geometry.inner.radius).toFixed(6))
  await page.getByRole('group', { name: 'Area center', exact: true }).getByRole('radio', { name: 'I', exact: true }).check()
  await expect(page.locator('[data-testid="carnot-proof-area"][data-signed="negative"]')).toHaveCount(0)
  await page.getByRole('button', { name: '5 Cancel the perimeter' }).click()
  await expectActualTotals(page)
  await expect(page.getByRole('img', { name: 'Length comparison of R plus r and the signed Carnot distances' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('carnot-proof-desktop.png'), fullPage: true })
})

test('uses true signed tile areas, correct projection pairs, and linked geometry highlighting', async ({ page }) => {
  await openProof(page)
  await page.getByRole('button', { name: '4 Collect the tiles' }).click()
  const geometry = await actualGeometry(page)
  const tiles = await page.getByTestId('carnot-area-tile').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.querySelector('rect')
    if (!rect) throw new Error('Tile must have a rectangle')
    return { area: Number(node.getAttribute('data-area')), pixels: Number(rect.getAttribute('width')) * Number(rect.getAttribute('height')) }
  }))
  expect(tiles).toHaveLength(9)
  const areaScale = tiles[0].pixels / Math.abs(tiles[0].area)
  tiles.forEach((tile, index) => {
    expect(tile.area).toBeCloseTo(geometry.sides[index % 3].length * geometry.sides[Math.floor(index / 3)].signedDistance, 10)
    expect(tile.pixels / Math.abs(tile.area)).toBeCloseTo(areaScale, 7)
  })
  await page.getByRole('button', { name: 'r pieces', exact: true }).click()
  await expect(page.locator('[data-testid="carnot-area-tile"][opacity="1"]')).toHaveCount(3)
  await page.getByRole('button', { name: 'R pieces', exact: true }).click()
  for (const [focus, label] of ['a / A', 'b / B', 'c / C'].entries()) {
    await page.getByRole('radio', { name: label, exact: true }).check()
    const pair = await page.locator('[data-testid="carnot-area-tile"][opacity="1"]').evaluateAll((nodes) =>
      nodes.reduce((sum, node) => sum + Number(node.getAttribute('data-area')), 0))
    expect(pair).toBeCloseTo(geometry.sides[focus].length * geometry.outer.radius, 10)
  }
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.getByTestId('carnot-area-tile').first().focus()
  await expect(page.getByTestId('carnot-proof-distance').first().locator('line')).toHaveAttribute('stroke-width', '4')
})

test('handles obtuse and right examples without hiding negative or zero contributions', async ({ page }) => {
  await openProof(page)
  await page.getByRole('button', { name: 'Obtuse', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'b / B', exact: true })).toBeChecked()
  const geometry = await actualGeometry(page)
  expect(geometry.sides.filter((side) => side.signedDistance < -1e-8)).toHaveLength(1)
  await expect(page.getByTestId('carnot-proof-distance').nth(1).locator('line')).toHaveAttribute('stroke-dasharray', '6 4')
  await page.getByRole('button', { name: '2 Project a side' }).click()
  await page.getByRole('radio', { name: 'a / A', exact: true }).check()
  const parts = await page.getByTestId('carnot-side-part').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-value'))))
  expect(parts.some((value) => value < 0)).toBe(true)
  expect(parts[parts.length - 1]).toBeLessThan(0)
  await page.getByRole('button', { name: '3 Measure area twice' }).click()
  await expect(page.locator('[data-testid="carnot-proof-area"][data-signed="negative"]')).toHaveCount(1)
  await page.getByRole('radio', { name: 'I', exact: true }).check()
  await expect(page.locator('[data-testid="carnot-proof-area"][data-signed="negative"]')).toHaveCount(0)
  await page.getByRole('button', { name: '5 Cancel the perimeter' }).click()
  await expect(page.getByTestId('carnot-negative-tile')).toHaveCount(3)
  await expectActualTotals(page)
  const segments = await page.getByRole('tabpanel', { name: 'Carnot proof' }).getByTestId('distance-sum-segment').evaluateAll((nodes) => nodes.map((node) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected a segment')
    return node.x2.baseVal.value - node.x1.baseVal.value
  }))
  expect(segments.filter((length) => length < 0)).toHaveLength(1)
  await page.getByRole('button', { name: 'Right', exact: true }).click()
  await expectActualTotals(page)
  const right = await actualGeometry(page)
  expect(Math.abs(right.sides[1].signedDistance)).toBeLessThan(1e-10)
  await expect(page.getByTestId('carnot-negative-tile')).toHaveCount(0)
  await page.getByRole('tab', { name: "Carnot's Theorem" }).click()
  await page.getByRole('button', { name: 'Carnot distances', exact: true }).click()
  const ids = await page.locator('marker[id]').evaluateAll((nodes) => nodes.map((node) => node.id))
  expect(new Set(ids).size).toBe(ids.length)
})

test('recalculates live totals for every seed and supports dragging, keyboard movement, and cancellation', async ({ page }) => {
  await openProof(page)
  await page.getByRole('button', { name: '5 Cancel the perimeter' }).click()
  for (let seed = 1; seed <= 25; seed++) {
    await page.getByRole('slider', { name: 'Proof triangle seed' }).fill(String(seed))
    await expectActualTotals(page)
  }
  const original = await pointsIn(page)
  const vertex = page.getByRole('button', { name: 'Carnot proof vertex A', exact: true })
  await vertex.focus()
  await vertex.press('Shift+ArrowRight')
  const moved = await pointsIn(page)
  expect(moved[0]).not.toEqual(original[0])
  expect(moved.slice(1)).toEqual(original.slice(1))
  await expectActualTotals(page)
  const box = await vertex.locator('.vertex-hit').boundingBox()
  if (!box) throw new Error('Vertex must be visible')
  const angle = Math.atan2(moved[0].y, moved[0].x) + 0.1
  const target = await page.locator('.carnot-proof-diagram').evaluate((node, value) => {
    const matrix = (node as SVGSVGElement).getScreenCTM()
    if (!matrix) throw new Error('Expected a diagram transform')
    const p = new DOMPoint(320 + Math.cos(value) * 205, 320 + Math.sin(value) * 205).matrixTransform(matrix)
    return { x: p.x, y: p.y }
  }, angle)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 8 })
  expect((await pointsIn(page))[0]).not.toEqual(moved[0])
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await pointsIn(page)).toEqual(moved)
  await page.getByRole('button', { name: 'Reset to seed' }).click()
  expect(await pointsIn(page)).toEqual(original)
})

test('keeps the proof and its controls usable at phone widths', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await openProof(page)
  await page.getByRole('button', { name: 'Obtuse', exact: true }).click()
  await page.getByRole('button', { name: '5 Cancel the perimeter' }).click()
  await expectActualTotals(page)
  for (const [label, selector] of [
    ['Circumcircle', '.carnot-proof-diagram .circumcircle'],
    ['Incircle', '[data-testid="carnot-proof-incircle"]'],
    ['Signed distances', '[data-testid="carnot-proof-distance"]'],
  ]) {
    const count = await page.locator(selector).count()
    expect(count).toBeGreaterThan(0)
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.locator(selector)).toHaveCount(0)
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.locator(selector)).toHaveCount(count)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('carnot-proof-mobile.png'), fullPage: true })
  await page.setViewportSize({ width: 320, height: 700 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  expect(errors).toEqual([])
})
