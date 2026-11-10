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

async function renderedArc(page: Page, testId: string, center: { x: number; y: number }) {
  const path = await page.getByTestId(testId).locator('path').getAttribute('d')
  const values = path?.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number)
  if (!values || values.length !== 9) throw new Error('Expected an SVG circular arc')
  const start = Math.atan2(values[1] - center.y, values[0] - center.x)
  const end = Math.atan2(values[8] - center.y, values[7] - center.x)
  const positive = (angle: number) => (angle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  const sweep = values[6] === 1 ? positive(end - start) : -positive(start - end)
  return { start, sweep, large: values[5] }
}

test('navigates the fourth tab accessibly and preserves its construction and proof state', async ({ page }) => {
  await page.goto('/')
  const first = page.getByRole('tab', { name: 'Japanese Theorem' })
  const fourth = page.getByRole('tab', { name: 'Carnot proof' })
  await first.focus()
  await first.press('End')
  await expect(fourth).toBeFocused()
  await page.getByRole('slider', { name: 'Proof triangle seed' }).fill('15')
  await page.getByRole('button', { name: '5 Collect the terms' }).click()
  await page.getByTestId('carnot-expansion-term').first().click()
  const points = await pointsIn(page)
  await fourth.focus()
  await fourth.press('ArrowRight')
  await expect(first).toBeFocused()
  await first.press('ArrowLeft')
  await expect(fourth).toBeFocused()
  await expect(page.getByRole('slider', { name: 'Proof triangle seed' })).toHaveValue('15')
  await expect(page.getByRole('button', { name: '5 Collect the terms' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('carnot-r-collection')).toHaveAttribute('data-highlighted', 'true')
  expect(await pointsIn(page)).toEqual(points)
})

test('shows the central angle and its two correct halves before introducing the cosine', async ({ page }, testInfo) => {
  await openProof(page)
  await expect(page.getByTestId('carnot-proof-incircle')).toHaveCount(0)
  await expect(page.getByTestId('carnot-proof-distance')).toHaveCount(0)
  await expect(page.getByTestId('carnot-radius-projection')).toHaveCount(0)
  async function expectAngleConstruction(focus: number) {
    const points = await pointsIn(page)
    const geometry = await actualGeometry(page)
    const at = points[focus]
    const u = { x: points[(focus + 1) % 3].x - at.x, y: points[(focus + 1) % 3].y - at.y }
    const v = { x: points[(focus + 2) % 3].x - at.x, y: points[(focus + 2) % 3].y - at.y }
    const angle = Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y)
    const center = { x: 320 + geometry.outer.x * 205, y: 320 + geometry.outer.y * 205 }
    const central = await renderedArc(page, 'carnot-central-angle', center)
    await expect(page.getByTestId('carnot-central-angle').locator('text')).toHaveCount(0)
    expect(Math.abs(central.sweep)).toBeCloseTo(2 * angle, 8)
    if (Math.abs(2 * angle - Math.PI) > 1e-8) expect(central.large).toBe(2 * angle > Math.PI ? 1 : 0)
    const orientation = Math.sign((points[1].x - points[0].x) * (points[2].y - points[0].y)
      - (points[1].y - points[0].y) * (points[2].x - points[0].x))
    const outward = { x: -orientation * geometry.sides[focus].normal.x, y: -orientation * geometry.sides[focus].normal.y }
    expect(Math.cos(central.start + central.sweep / 2)).toBeCloseTo(outward.x, 8)
    expect(Math.sin(central.start + central.sweep / 2)).toBeCloseTo(outward.y, 8)
    for (const id of ['carnot-half-angle-first', 'carnot-half-angle-second']) {
      const arc = await renderedArc(page, id, center)
      expect(Math.abs(arc.sweep)).toBeCloseTo(Math.min(angle, Math.PI - angle), 8)
    }
    const radii = await page.getByTestId('carnot-equal-radius').evaluateAll((nodes) => nodes.map((node) => {
      const line = node.querySelector('line')
      if (!(line instanceof SVGLineElement)) throw new Error('Expected a radius')
      return Math.hypot(line.x2.baseVal.value - line.x1.baseVal.value, line.y2.baseVal.value - line.y1.baseVal.value)
    }))
    expect(radii).toHaveLength(2)
    radii.forEach((radius) => expect(radius).toBeCloseTo(geometry.outer.radius * 205, 3))
    const midpoint = page.getByTestId('carnot-chord-midpoint').locator('circle')
    expect(Number(await midpoint.getAttribute('cx'))).toBeCloseTo(320 + geometry.sides[focus].midpoint.x * 205, 8)
    expect(Number(await midpoint.getAttribute('cy'))).toBeCloseTo(320 + geometry.sides[focus].midpoint.y * 205, 8)
  }
  await expectAngleConstruction(0)
  await page.screenshot({ path: testInfo.outputPath('carnot-central-angle.png'), fullPage: true })
  for (const [focus, label] of ['a / A', 'b / B', 'c / C'].entries()) {
    await page.getByRole('radio', { name: label, exact: true }).check()
    await expectAngleConstruction(focus)
  }
  await page.getByRole('button', { name: 'Obtuse', exact: true }).click()
  await expectAngleConstruction(1)
  await expect(page.getByTestId('carnot-half-angle-first').locator('text')).toHaveText('θ')
  await page.getByRole('button', { name: 'Right', exact: true }).click()
  await expectAngleConstruction(1)
  await expect(page.getByTestId('carnot-chord-midpoint').locator('text')).toHaveText('M = O')
  await page.getByRole('button', { name: 'Acute', exact: true }).click()
  const vertex = page.getByRole('button', { name: 'Carnot proof vertex C', exact: true })
  await vertex.focus()
  await vertex.press('Shift+ArrowLeft')
  await expectAngleConstruction(0)
  await page.getByRole('button', { name: 'Construction lines', exact: true }).click()
  await expect(page.getByTestId('carnot-central-construction')).toHaveCount(0)
  await expect(page.getByTestId('carnot-chord-midpoint')).toHaveCount(0)
})

test('isolates the right triangle and links each side substitution to its own cosine explanation', async ({ page }, testInfo) => {
  await openProof(page)
  for (const [angle, focus] of [['B', 1], ['C', 2]] as const) {
    await page.getByRole('button', { name: '3 Project a side' }).click()
    await page.getByRole('radio', { name: 'a / A', exact: true }).check()
    await page.getByRole('button', { name: `Explain cos ${angle}`, exact: true }).click()
    await expect(page.getByRole('button', { name: '2 Read the cosine' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('radio', { name: ['a / A', 'b / B', 'c / C'][focus], exact: true })).toBeChecked()
    await expect(page.getByTestId('carnot-central-construction')).toHaveCount(0)
    await expect(page.getByTestId('carnot-equal-radius')).toHaveCount(0)
    await expect(page.getByTestId('carnot-radius-projection')).toBeVisible()
    await expect(page.getByTestId('carnot-proof-distance')).toHaveCount(1)
    await expect(page.getByTestId('carnot-proof-incircle')).toHaveCount(0)
    const geometry = await actualGeometry(page)
    expect(Number(await page.getByTestId('carnot-proof-distance').getAttribute('data-value')))
      .toBeCloseTo(geometry.sides[focus].signedDistance, 10)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('carnot-cosine-mobile.png'), fullPage: true })
})

test('keeps construction labels clear and distance labels outside the right triangle', async ({ page }) => {
  await openProof(page)
  await page.getByRole('button', { name: '2 Read the cosine' }).click()
  for (const kind of ['Acute', 'Obtuse', 'Right']) {
    await page.getByRole('button', { name: kind, exact: true }).click()
    for (const [focus, label] of ['a / A', 'b / B', 'c / C'].entries()) {
      await page.getByRole('radio', { name: label, exact: true }).check()
      await expect(page.getByTestId('carnot-proof-distance').locator('tspan')).toHaveText('abc'[focus])
      await expect.poll(() => page.locator('.carnot-proof-diagram').evaluate((svg, index) => {
        const side = svg.querySelectorAll('[data-testid="carnot-proof-side-label"]')[index]?.getBoundingClientRect()
        const midpoint = svg.querySelector('[data-testid="carnot-chord-midpoint"] text')?.getBoundingClientRect()
        if (!side || !midpoint) throw new Error('Both side and midpoint labels must be visible')
        return side.right < midpoint.left || midpoint.right < side.left
          || side.bottom < midpoint.top || midpoint.bottom < side.top
      }, focus), { message: `${kind} triangle: ${label} must not overlap M` }).toBe(true)
      const { leg, offset } = await page.getByTestId('carnot-proof-distance').evaluate((group) => {
        const line = group.querySelector('line')
        const text = group.querySelector('text')
        if (!line || !text) throw new Error('Expected a distance segment and label')
        const o = { x: Number(line.getAttribute('x1')), y: Number(line.getAttribute('y1')) }
        const m = { x: Number(line.getAttribute('x2')), y: Number(line.getAttribute('y2')) }
        return {
          leg: { x: m.x - o.x, y: m.y - o.y },
          offset: { x: Number(text.getAttribute('x')) - (o.x + m.x) / 2,
            y: Number(text.getAttribute('y')) - (o.y + m.y) / 2 },
        }
      })
      const side = (await actualGeometry(page)).sides[focus]
      const alongChord = { x: (side.end.x - side.start.x) / side.length, y: (side.end.y - side.start.y) / side.length }
      expect(Number.isFinite(offset.x) && Number.isFinite(offset.y)).toBe(true)
      expect(offset.x * alongChord.x + offset.y * alongChord.y).toBeGreaterThan(0)
      expect(offset.x * alongChord.y - offset.y * alongChord.x).toBeCloseTo(0, 6)
      const legLength = Math.hypot(leg.x, leg.y)
      if (legLength > 1e-6) expect((offset.x * leg.x + offset.y * leg.y) / legLength).toBeCloseTo(0, 6)
    }
  }
  const points = await pointsIn(page)
  const readLabels = () => page.getByTestId('carnot-proof-side-label').evaluateAll((nodes) =>
    nodes.map((node) => [Number(node.getAttribute('x')), Number(node.getAttribute('y'))]))
  const expanded = await readLabels()
  await page.getByRole('button', { name: 'Construction lines', exact: true }).click()
  const normal = await readLabels()
  expect(normal.slice(0, 2)).toEqual(expanded.slice(0, 2))
  expect(normal[2]).not.toEqual(expanded[2])
  await page.getByRole('button', { name: '3 Project a side' }).click()
  await page.getByRole('button', { name: 'Construction lines', exact: true }).click()
  expect(await readLabels()).toEqual(normal)
  expect(await pointsIn(page)).toEqual(points)
})

test('walks through all constructions and compares the two area decompositions', async ({ page }, testInfo) => {
  await openProof(page)
  await expect(page.getByTestId('carnot-central-construction')).toBeVisible()
  await page.getByRole('button', { name: '2 Read the cosine' }).click()
  await expect(page.getByTestId('carnot-radius-projection')).toBeVisible()
  await expect(page.getByTestId('carnot-central-construction')).toHaveCount(0)
  await page.getByRole('button', { name: '3 Project a side' }).click()
  await expect(page.getByTestId('carnot-side-projection')).toBeVisible()
  for (const [focus, label] of ['a / A', 'b / B', 'c / C'].entries()) {
    await page.getByRole('radio', { name: label, exact: true }).check()
    const geometry = await actualGeometry(page)
    const parts = await page.getByTestId('carnot-side-part').evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute('data-value'))))
    expect(parts[0] + parts[1]).toBeCloseTo(geometry.sides[focus].length, 10)
  }
  await page.getByRole('button', { name: '4 Measure area twice' }).click()
  await expect(page.getByTestId('carnot-proof-area')).toHaveCount(3)
  const geometry = await actualGeometry(page)
  const weighted = geometry.sides.reduce((sum, side) => sum + side.length * side.signedDistance, 0)
  const perimeter = geometry.sides.reduce((sum, side) => sum + side.length, 0)
  await expect(page.getByTestId('carnot-weighted-area')).toHaveText(weighted.toFixed(6))
  await expect(page.getByTestId('carnot-inradius-area')).toHaveText((perimeter * geometry.inner.radius).toFixed(6))
  await expect(page.getByRole('tabpanel', { name: 'Carnot proof' })).not.toContainText(/\b(?:P|Pr)\b/)
  await expect(page.locator('[data-testid="carnot-proof-area"][data-signed="negative"]')).toHaveCount(0)
  await page.getByRole('button', { name: '5 Collect the terms' }).click()
  await expect(page.getByRole('group', { name: 'Carnot proof steps' }).getByRole('button')).toHaveCount(5)
  await expectActualTotals(page)
  await expect(page.getByRole('img', { name: 'Length comparison of R plus r and the signed Carnot distances' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('carnot-proof-desktop.png'), fullPage: true })
})

test('expands nine terms and collects every hovered, focused, or selected group', async ({ page }) => {
  await openProof(page)
  await page.getByRole('button', { name: '5 Collect the terms', exact: true }).click()
  await expect(page.locator('.carnot-proof-explanation > :first-child')).toHaveAttribute('data-testid', 'carnot-expanded-product')
  const terms = page.getByTestId('carnot-expansion-term')
  const highlighted = page.locator('[data-testid="carnot-expansion-term"][data-highlighted="true"]')
  const readGroup = () => highlighted.evaluateAll((nodes) =>
    nodes.map((node) => `${node.getAttribute('data-row')},${node.getAttribute('data-col')}`).sort())
  await expect(terms).toHaveCount(9)
  await expect(page.locator('.carnot-expansion-plus')).toHaveText(['=', '+', '+', '+', '+', '+', '+', '+', '+'])
  const boxes = await terms.evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect()
    return { x: box.x, y: box.y }
  }))
  for (let index = 0; index < 9; index++) {
    expect(boxes[index].y).toBeCloseTo(boxes[Math.floor(index / 3) * 3].y, 3)
    expect(boxes[index].x).toBeCloseTo(boxes[index % 3].x, 3)
    if (index % 3) expect(boxes[index].x).toBeGreaterThan(boxes[index - 1].x)
    if (index >= 3) expect(boxes[index].y).toBeGreaterThan(boxes[index - 3].y)
  }
  const geometry = await actualGeometry(page)
  const perimeter = geometry.sides.reduce((sum, side) => sum + side.length, 0)
  for (let index = 0; index < 9; index++) {
    await terms.nth(index).hover()
    const row = Math.floor(index / 3)
    const col = index % 3
    const diagonal = row === col
    const expected = diagonal ? ['0,0', '1,1', '2,2'] : [`${row},${col}`, `${col},${row}`].sort()
    expect(await readGroup()).toEqual(expected)
    await expect(highlighted.first()).toHaveCSS('opacity', '1')
    await expect(page.locator('[data-testid="carnot-expansion-term"][data-dimmed="true"]').first()).toHaveCSS('opacity', '0.3')
    const sum = await highlighted.evaluateAll((nodes) => nodes.reduce((total, node) => total + Number(node.getAttribute('data-value')), 0))
    if (diagonal) {
      await expect(page.getByTestId('carnot-r-collection')).toHaveAttribute('data-highlighted', 'true')
      expect(sum).toBeCloseTo(perimeter * geometry.inner.radius, 10)
    } else {
      const side = [0, 1, 2].find((candidate) => candidate !== row && candidate !== col)
      if (side === undefined) throw new Error('An off-diagonal pair must correspond to one side')
      await expect(page.getByTestId('carnot-projection-pair').nth(side)).toHaveAttribute('data-highlighted', 'true')
      expect(sum).toBeCloseTo(geometry.sides[side].length * geometry.outer.radius, 10)
    }
  }
  await page.locator('#carnot-expansion-help').hover()
  await expect(highlighted).toHaveCount(0)
  await terms.nth(1).focus()
  expect(await readGroup()).toEqual(['0,1', '1,0'])
  await terms.nth(1).press('Enter')
  await expect(page.getByRole('radio', { name: 'c / C', exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Show all terms', exact: true }).click()
  await expect(highlighted).toHaveCount(0)
  await terms.nth(2).click()
  await page.locator('#carnot-expansion-help').hover()
  expect(await readGroup()).toEqual(['0,2', '2,0'])
  await page.getByRole('button', { name: 'Show all terms', exact: true }).click()
  for (const kind of ['Obtuse', 'Right']) {
    await page.getByRole('button', { name: kind, exact: true }).click()
    const actual = await actualGeometry(page)
    const values = await terms.evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-value'))))
    expect(values).toHaveLength(9)
    values.forEach((value, index) => {
      expect(value).toBeCloseTo(actual.sides[index % 3].length * actual.sides[Math.floor(index / 3)].signedDistance, 10)
    })
    expect(values.filter((value) => kind === 'Obtuse' ? value < -1e-8 : Math.abs(value) < 1e-8)).toHaveLength(3)
    await expectActualTotals(page)
  }
  await expect(page.getByTestId('carnot-collected-groups')).toContainText('r(a + b + c)')
  await expect(page.getByTestId('carnot-collected-sum')).toContainText('(a + b + c)R')
  await expect(page.getByTestId('carnot-factored-equality')).toContainText('(a + b + c)(r + R)')
  await expect(page.getByTestId('carnot-final-identity')).toContainText('= r + R')
})

test('uses true signed tile areas, correct projection pairs, and linked geometry highlighting', async ({ page }) => {
  await openProof(page)
  await page.getByRole('button', { name: '5 Collect the terms' }).click()
  await page.getByText('Geometric tile view', { exact: true }).click()
  const geometry = await actualGeometry(page)
  const tiles = await page.getByTestId('carnot-area-tile').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.querySelector('rect')
    if (!rect) throw new Error('Tile must have a rectangle')
    return { area: Number(node.getAttribute('data-area')), pixels: Number(rect.getAttribute('width')) * Number(rect.getAttribute('height')),
      inner: node.getAttribute('data-inner') === 'true', color: getComputedStyle(rect).fill }
  }))
  expect(tiles).toHaveLength(9)
  const areaScale = tiles[0].pixels / Math.abs(tiles[0].area)
  tiles.forEach((tile, index) => {
    expect(tile.area).toBeCloseTo(geometry.sides[index % 3].length * geometry.sides[Math.floor(index / 3)].signedDistance, 10)
    expect(tile.pixels / Math.abs(tile.area)).toBeCloseTo(areaScale, 7)
  })
  expect(new Set(tiles.filter((tile) => !tile.inner).map((tile) => tile.color)).size).toBe(3)
  await expect(page.getByTestId('carnot-collected-sum')).toContainText('(a + b + c)r')
  await expect(page.getByTestId('carnot-collected-sum')).toContainText('(a + b + c)R')
  await page.getByRole('button', { name: 'r pieces', exact: true }).click()
  await expect(page.locator('[data-testid="carnot-area-tile"][opacity="1"]')).toHaveCount(3)
  await page.getByRole('button', { name: 'R pieces', exact: true }).click()
  await expect(page.locator('[data-testid="carnot-area-tile"][opacity="1"]')).toHaveCount(2)
  for (const [focus, label] of ['a / A', 'b / B', 'c / C'].entries()) {
    await page.getByRole('button', { name: 'All', exact: true }).click()
    const identity = page.getByTestId('carnot-projection-pair').nth(focus)
    await identity.click()
    await expect(identity).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('radio', { name: label, exact: true })).toBeChecked()
    await expect(page.getByRole('button', { name: 'R pieces', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-testid="carnot-area-tile"][opacity="1"]')).toHaveCount(2)
    const pair = await page.locator('[data-testid="carnot-area-tile"][opacity="1"]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.querySelector('rect')
        if (!rect) throw new Error('Tile must have a rectangle')
        return { area: Number(node.getAttribute('data-area')), color: getComputedStyle(rect).fill }
      }))
    expect(pair.reduce((sum, tile) => sum + tile.area, 0)).toBeCloseTo(geometry.sides[focus].length * geometry.outer.radius, 10)
    const color = await identity.evaluate((node) => getComputedStyle(node).color)
    expect(pair.every((tile) => tile.color === color)).toBe(true)
  }
  await page.getByRole('button', { name: 'Revisit Step 3 for side c', exact: true }).click()
  await expect(page.getByRole('button', { name: '3 Project a side', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('radio', { name: 'c / C', exact: true })).toBeChecked()
  await expect(page.getByTestId('carnot-side-projection')).toBeVisible()
  await page.getByRole('button', { name: '5 Collect the terms', exact: true }).click()
  await expect(page.getByTestId('carnot-projection-pair').nth(2)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-testid="carnot-area-tile"][opacity="1"]')).toHaveCount(2)
  await page.getByText('Geometric tile view', { exact: true }).click()
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await page.getByTestId('carnot-area-tile').first().focus()
  await expect(page.getByTestId('carnot-proof-distance').first().locator('line')).toHaveAttribute('stroke-width', '4')
})

test('switches the area triangles and heights with the incircle', async ({ page }) => {
  await openProof(page)
  await page.getByRole('button', { name: '4 Measure area twice' }).click()
  const incircle = page.getByRole('button', { name: 'Incircle', exact: true })
  for (const kind of ['Acute', 'Obtuse', 'Right']) {
    await page.getByRole('button', { name: kind, exact: true }).click()
    const points = await pointsIn(page)
    const geometry = await actualGeometry(page)
    for (const center of ['I', 'O', 'I'] as const) {
      if (await incircle.getAttribute('aria-pressed') !== String(center === 'I')) await incircle.click()
      await expect(page.getByTestId('carnot-proof-incircle')).toHaveCount(center === 'I' ? 1 : 0)
      await expect(page.getByTestId('carnot-inradius-height')).toHaveCount(center === 'I' ? 3 : 0)
      if (center === 'I') {
        for (const height of await page.getByTestId('carnot-inradius-height').locator('line').all()) {
          await expect(height).toHaveCSS('stroke-dasharray', '4px, 5px')
        }
      }
      const triangles = await page.getByTestId('carnot-proof-area').evaluateAll((nodes) =>
        nodes.map((node) => ({
          points: node.getAttribute('points')?.split(' ').map((point) => point.split(',').map(Number)),
          signed: node.getAttribute('data-signed'),
        })))
      expect(triangles).toHaveLength(3)
      for (const [index, triangle] of triangles.entries()) {
        const side = geometry.sides[index]
        const expected = [center === 'I' ? geometry.inner : geometry.outer, side.start, side.end]
        expect(triangle.points).toHaveLength(3)
        expected.forEach((point, vertex) => {
          expect(triangle.points?.[vertex][0]).toBeCloseTo(320 + point.x * 205, 6)
          expect(triangle.points?.[vertex][1]).toBeCloseTo(320 + point.y * 205, 6)
        })
        expect(triangle.signed).toBe(center === 'O' && side.signedDistance < -1e-8 ? 'negative' : 'positive')
      }
      expect(await pointsIn(page)).toEqual(points)
    }
  }
})

test('handles obtuse and right examples without hiding negative or zero contributions', async ({ page }) => {
  await openProof(page)
  await page.getByRole('button', { name: 'Obtuse', exact: true }).click()
  await page.getByRole('button', { name: '2 Read the cosine' }).click()
  await expect(page.getByRole('radio', { name: 'b / B', exact: true })).toBeChecked()
  const geometry = await actualGeometry(page)
  expect(geometry.sides.filter((side) => side.signedDistance < -1e-8)).toHaveLength(1)
  await expect(page.getByTestId('carnot-proof-distance').locator('line')).toHaveAttribute('stroke-dasharray', '6 4')
  await page.getByRole('button', { name: '3 Project a side' }).click()
  await page.getByRole('radio', { name: 'a / A', exact: true }).check()
  const parts = await page.getByTestId('carnot-side-part').evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('data-value'))))
  expect(parts.some((value) => value < 0)).toBe(true)
  expect(parts[parts.length - 1]).toBeLessThan(0)
  await page.getByRole('button', { name: '4 Measure area twice' }).click()
  await page.getByRole('button', { name: 'Incircle', exact: true }).click()
  await expect(page.locator('[data-testid="carnot-proof-area"][data-signed="negative"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Incircle', exact: true }).click()
  await expect(page.locator('[data-testid="carnot-proof-area"][data-signed="negative"]')).toHaveCount(0)
  await page.getByRole('button', { name: '5 Collect the terms' }).click()
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
  await page.getByRole('button', { name: '5 Collect the terms' }).click()
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

test('always shows O in steps 1 and 2 and follows the circumcircle in steps 3 through 5', async ({ page }) => {
  await openProof(page)
  const center = page.getByTestId('carnot-proof-circumcenter')
  const circle = page.getByRole('button', { name: 'Circumcircle', exact: true })
  for (const [index, title] of [
    '1 Halve the central angle', '2 Read the cosine', '3 Project a side',
    '4 Measure area twice', '5 Collect the terms',
  ].entries()) {
    await page.getByRole('button', { name: title, exact: true }).click()
    await expect(center.locator('circle')).toBeVisible()
    await expect(center.locator('text')).toHaveText('O')
    await circle.click()
    await expect(page.locator('.carnot-proof-diagram .circumcircle')).toHaveCount(0)
    await expect(center).toHaveCount(index < 2 ? 1 : 0)
    await circle.click()
    await expect(center).toBeVisible()
  }
  await circle.click()
  await page.getByRole('button', { name: '2 Read the cosine', exact: true }).click()
  await expect(center).toBeVisible()
  await page.getByRole('button', { name: '3 Project a side', exact: true }).click()
  await expect(center).toHaveCount(0)
})

test('keeps the proof and its controls usable at phone widths', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await openProof(page)
  await page.getByRole('button', { name: 'Obtuse', exact: true }).click()
  await page.getByRole('button', { name: '5 Collect the terms' }).click()
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
