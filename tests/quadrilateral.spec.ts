import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { incircle } from '../src/geometry'
import type { QuadrilateralPoints } from '../src/quadrilateralGeometry'

async function openProof(page: Page) {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Quadrilateral proof' }).click()
}

async function pointsIn(page: Page, diagonal = 'AC'): Promise<QuadrilateralPoints> {
  const points = await page.getByTestId(`proof-${diagonal}`).locator('.proof-vertex-dot').evaluateAll((nodes) =>
    nodes.map((node) => ({ x: (Number(node.getAttribute('cx')) - 320) / 247, y: (Number(node.getAttribute('cy')) - 320) / 247 })))
  if (points.length !== 4) throw new Error('Expected four quadrilateral vertices')
  return [points[0], points[1], points[2], points[3]]
}

async function expectActualSums(page: Page) {
  const points = await pointsIn(page)
  const sumAC = incircle(points, [0, 1, 2]).radius + incircle(points, [0, 2, 3]).radius
  const sumBD = incircle(points, [0, 1, 3]).radius + incircle(points, [1, 2, 3]).radius
  await expect(page.getByTestId('proof-sum-AC')).toHaveText(sumAC.toFixed(6))
  if (await page.getByTestId('proof-sum-BD').count()) {
    await expect(page.getByTestId('proof-sum-BD')).toHaveText(sumBD.toFixed(6))
  }
  expect(sumAC).toBeCloseTo(sumBD, 10)
  return { sumAC, sumBD }
}

async function dragVertex(page: Page, name: string, angle: number, release = true) {
  const vertex = page.getByRole('button', { name: `Quadrilateral AC vertex ${name}`, exact: true })
  await vertex.focus()
  const box = await vertex.locator('.vertex-hit').boundingBox()
  if (!box) throw new Error('Vertex not visible')
  const target = await page.getByTestId('proof-AC').locator('svg').evaluate((node, value) => {
    const matrix = (node as SVGSVGElement).getScreenCTM()
    if (!matrix) throw new Error('Diagram has no screen transform')
    const point = new DOMPoint(320 + Math.cos(value) * 247, 320 + Math.sin(value) * 247).matrixTransform(matrix)
    return { x: point.x, y: point.y }
  }, angle)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x, target.y, { steps: 10 })
  if (release) await page.mouse.up()
}

test('navigates the proof tabs and preserves their independent states', async ({ page }) => {
  await page.goto('/')
  const first = page.getByRole('tab', { name: 'Japanese Theorem' })
  const third = page.getByRole('tab', { name: 'Quadrilateral proof' })
  const fourth = page.getByRole('tab', { name: 'Carnot proof' })
  await page.getByRole('slider', { name: 'Fan vertex', exact: true }).fill('3')
  await first.focus()
  await first.press('End')
  await expect(fourth).toBeFocused()
  await fourth.press('ArrowLeft')
  await expect(third).toBeFocused()
  await expect(third).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('slider', { name: 'Quadrilateral seed' }).fill('19')
  await page.getByRole('button', { name: '4 Compare the sums' }).click()
  await third.focus()
  await third.press('ArrowRight')
  await expect(fourth).toBeFocused()
  await fourth.press('ArrowRight')
  await expect(first).toBeFocused()
  await expect(page.getByRole('slider', { name: 'Fan vertex', exact: true })).toHaveValue('3')
  await first.press('ArrowLeft')
  await expect(fourth).toBeFocused()
  await fourth.press('ArrowLeft')
  await expect(third).toBeFocused()
  await expect(page.getByRole('slider', { name: 'Quadrilateral seed' })).toHaveValue('19')
  await expect(page.getByTestId('proof-conclusion')).toBeVisible()
  await third.press('ArrowLeft')
  await expect(page.getByRole('tab', { name: "Carnot's Theorem" })).toBeFocused()
  await page.getByRole('tab', { name: "Carnot's Theorem" }).press('Home')
  await expect(first).toBeFocused()
})

test('recalculates both actual inradius sums for every quadrilateral seed', async ({ page }) => {
  await openProof(page)
  const initial = await page.getByTestId('proof-sum-AC').textContent()
  for (let seed = 1; seed <= 25; seed++) {
    await page.getByRole('slider', { name: 'Quadrilateral seed' }).fill(String(seed))
    await expectActualSums(page)
    const points = await pointsIn(page)
    expect(await pointsIn(page, 'BD')).toEqual(points)
    if (seed === 7) {
      const signedLines = await page.getByTestId('proof-AC').getByTestId('proof-boundary-distance').evaluateAll((nodes) =>
        nodes.filter((node) => Number(node.getAttribute('data-value')) < -1e-8)
          .map((node) => node.querySelector('line')?.getAttribute('stroke-dasharray')))
      expect(signedLines.length).toBeGreaterThan(0)
      expect(signedLines.every((dash) => dash === '5 4')).toBe(true)
    }
  }
  expect(await page.getByTestId('proof-sum-AC').textContent()).not.toBe(initial)
})

test('walks through signed cancellation and compares independent totals and segment lengths', async ({ page }, testInfo) => {
  await openProof(page)
  await expect(page.locator('.proof-triangle-name')).toHaveCount(4)
  await expect(page.getByTestId('proof-conclusion')).toHaveCount(0)
  await page.getByRole('button', { name: '2 Add each pair' }).click()
  await expect(page.getByTestId('proof-cancellation-AC')).toBeVisible()
  await expect(page.locator('.proof-term.cancelled')).toHaveCount(0)
  const contributions = await page.getByTestId('proof-diagonal-distance').evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-value'))))
  expect(contributions[0] + contributions[1]).toBeCloseTo(0, 10)
  expect(contributions[2] + contributions[3]).toBeCloseTo(0, 10)
  await page.getByRole('button', { name: '3 Cancel the diagonal' }).click()
  await expect(page.locator('.proof-term.cancelled')).toHaveCount(4)
  await expect(page.locator('.proof-cancel-mark')).toHaveCount(2)
  await page.getByRole('button', { name: '4 Compare the sums' }).click()
  await expect(page.getByTestId('proof-conclusion')).toBeVisible()
  const { sumAC, sumBD } = await expectActualSums(page)
  await expect(page.getByTestId('proof-final-AC')).toHaveText(sumAC.toFixed(6))
  await expect(page.getByTestId('proof-final-BD')).toHaveText(sumBD.toFixed(6))
  const boundary = await page.getByTestId('proof-AC').getByTestId('proof-boundary-distance').evaluateAll((nodes) =>
    nodes.reduce((sum, node) => sum + Number(node.getAttribute('data-value')), 0))
  await expect(page.getByTestId('proof-boundary-result')).toHaveText((boundary - 2).toFixed(6))
  const segments = await page.getByTestId('proof-radius-segment').evaluateAll((nodes) => nodes.map((node) => {
    if (!(node instanceof SVGLineElement)) throw new Error('Expected a line')
    return { start: node.x1.baseVal.value, end: node.x2.baseVal.value }
  }))
  const points = await pointsIn(page)
  const radii = [[0, 1, 2], [0, 2, 3], [0, 1, 3], [1, 2, 3]].map(([a, b, c]) => incircle(points, [a, b, c]).radius)
  const scale = (segments[0].end - segments[0].start) / radii[0]
  segments.forEach((segment, index) => expect((segment.end - segment.start) / scale).toBeCloseTo(radii[index], 5))
  expect(segments[1].end).toBeCloseTo(segments[3].end, 4)
  await page.screenshot({ path: testInfo.outputPath('quadrilateral-desktop.png'), fullPage: true })
})

test('toggles layers and links boundary highlighting across both diagrams', async ({ page }) => {
  await openProof(page)
  const layers = [
    { name: 'Incircles and inradii', selector: '[data-testid="proof-incircle"]', initial: 4, toggled: 0 },
    { name: 'Boundary distances', selector: '[data-testid="proof-boundary-distance"]', initial: 8, toggled: 0 },
    { name: 'Diagonal contributions', selector: '[data-testid="proof-diagonal-distance"]', initial: 4, toggled: 0 },
    { name: 'Circumradius R', selector: '.proof-outer-radius', initial: 0, toggled: 2 },
  ]
  for (const layer of layers) {
    await expect(page.locator(layer.selector)).toHaveCount(layer.initial)
    const button = page.getByRole('button', { name: layer.name, exact: true })
    await button.click()
    await expect(page.locator(layer.selector)).toHaveCount(layer.toggled)
    await expectActualSums(page)
    await button.click()
  }
  await page.getByRole('button', { name: /^Distance AB:/ }).first().focus()
  const matching = page.locator('[data-testid="proof-boundary-distance"][data-edge="0-1"] line')
  await expect(matching).toHaveCount(2)
  for (const line of await matching.all()) await expect(line).toHaveAttribute('stroke-width', '4')
  await page.getByRole('radio', { name: 'AC', exact: true }).check()
  await expect(page.getByTestId('proof-AC')).toBeVisible()
  await expect(page.getByTestId('proof-BD')).toHaveCount(0)
  await page.getByRole('radio', { name: 'BD', exact: true }).check()
  await expect(page.getByTestId('proof-BD')).toBeVisible()
})

test('links cyclic vertex dragging, keyboard changes, cancellation and reset', async ({ page }) => {
  await openProof(page)
  const original = await pointsIn(page)
  const angle = Math.atan2(original[0].y, original[0].x)
  await dragVertex(page, 'A', angle + 0.15)
  const moved = await pointsIn(page)
  expect(moved[0]).not.toEqual(original[0])
  expect(moved.slice(1)).toEqual(original.slice(1))
  moved.forEach((point) => expect(Math.hypot(point.x, point.y)).toBeCloseTo(1, 10))
  expect(await pointsIn(page, 'BD')).toEqual(moved)
  await expectActualSums(page)
  await dragVertex(page, 'A', angle + 0.25, false)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await pointsIn(page)).toEqual(moved)
  const vertex = page.getByRole('button', { name: 'Quadrilateral BD vertex C', exact: true })
  await vertex.focus()
  await vertex.press('Shift+ArrowLeft')
  expect((await pointsIn(page))[2]).not.toEqual(moved[2])
  await expectActualSums(page)
  await page.getByRole('button', { name: 'Reset quadrilateral' }).click()
  expect(await pointsIn(page)).toEqual(original)
})

test('filters each diagram to the selected triangle without changing geometry, signs or totals', async ({ page }) => {
  await openProof(page)
  const triangleView = page.getByRole('group', { name: 'Triangle view', exact: true })
  const triangulationView = page.getByRole('group', { name: 'Triangulation view', exact: true })
  await expect(triangleView.getByRole('radio', { name: 'Both', exact: true })).toBeChecked()
  const originalPoints = await pointsIn(page)
  const originalSum = await page.getByTestId('proof-sum-AC').textContent()
  const circles = await page.getByTestId('proof-incircle').locator('circle:first-child').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('r')))
  const contributions = await page.getByTestId('proof-diagonal-distance').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-value')))
  for (const [view, index] of [['First', 0], ['Second', 1]] as const) {
    await triangleView.getByRole('radio', { name: view, exact: true }).check()
    for (const [diagonal, pair] of [['AC', 0], ['BD', 1]] as const) {
      const diagram = page.getByTestId(`proof-${diagonal}`)
      await expect(diagram.getByTestId('proof-incircle')).toHaveCount(1)
      await expect(diagram.getByTestId('proof-triangle-shading')).toHaveCount(1)
      await expect(diagram.getByTestId('proof-incircle').locator('circle').first()).toHaveAttribute('r', circles[pair * 2 + index]!)
      const distance = diagram.getByTestId('proof-diagonal-distance')
      await expect(distance).toHaveCount(1)
      await expect(distance).toHaveAttribute('data-value', contributions[pair * 2 + index]!)
      await expect(distance.locator('text')).toHaveText(index === 0 ? '+δ' : '−δ')
      const edges = await diagram.getByTestId('proof-boundary-distance').evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-edge')).sort())
      const firstEdges = diagonal === 'AC' ? ['0-1', '1-2'] : ['0-1', '0-3']
      const secondEdges = diagonal === 'AC' ? ['0-3', '2-3'] : ['1-2', '2-3']
      expect(edges).toEqual(index === 0 ? firstEdges : secondEdges)
    }
    expect(await pointsIn(page)).toEqual(originalPoints)
    await expect(page.getByTestId('proof-sum-AC')).toHaveText(originalSum!)
    await expect(page.locator('.proof-triangle-name')).toHaveCount(4)
    await expectActualSums(page)
  }
  await page.getByRole('button', { name: '3 Cancel the diagonal' }).click()
  await expect(page.locator('.proof-cancel-mark')).toHaveCount(0)
  await expect(page.locator('.proof-diagonal-distances.cancelled')).toHaveCount(0)
  await page.getByRole('button', { name: 'Boundary distances', exact: true }).click()
  await expect(page.getByTestId('proof-boundary-distance')).toHaveCount(0)
  await page.getByRole('button', { name: 'Boundary distances', exact: true }).click()
  await expect(page.getByTestId('proof-boundary-distance')).toHaveCount(4)
  for (const diagonal of ['AC', 'BD', 'Both']) {
    await triangulationView.getByRole('radio', { name: diagonal, exact: true }).check()
    await expect(triangleView.getByRole('radio', { name: 'Second', exact: true })).toBeChecked()
    await expect(page.getByTestId('proof-incircle')).toHaveCount(diagonal === 'Both' ? 2 : 1)
  }
  await page.getByRole('slider', { name: 'Quadrilateral seed' }).fill('6')
  await expect(page.getByTestId('proof-incircle')).toHaveCount(2)
  await expectActualSums(page)
  await triangleView.getByRole('radio', { name: 'Both', exact: true }).check()
  await expect(page.getByTestId('proof-incircle')).toHaveCount(4)
  await expect(page.getByTestId('proof-boundary-distance')).toHaveCount(8)
  await expect(page.getByTestId('proof-diagonal-distance')).toHaveCount(4)
  await expect(page.locator('.proof-cancel-mark')).toHaveCount(2)
})

test('anchors each diagonal distance at O and its perpendicular foot in every triangle view', async ({ page }) => {
  await openProof(page)
  const triangleView = page.getByRole('group', { name: 'Triangle view', exact: true })
  async function expectEndpoints() {
    const points = await pointsIn(page)
    for (const [diagonal, start, end] of [['AC', 0, 2], ['BD', 1, 3]] as const) {
      const construction = page.getByTestId(`proof-${diagonal}`).getByTestId('proof-diagonal-contributions')
      const lines = construction.locator('line')
      await expect(lines).toHaveCount(1)
      const line = await lines.evaluate((node) => {
        if (!(node instanceof SVGLineElement)) throw new Error('Expected a distance segment')
        return { x1: node.x1.baseVal.value, y1: node.y1.baseVal.value, x2: node.x2.baseVal.value, y2: node.y2.baseVal.value }
      })
      expect(line.x1).toBe(320)
      expect(line.y1).toBe(320)
      expect(line.x2).toBeCloseTo(320 + (points[start].x + points[end].x) / 2 * 247, 3)
      expect(line.y2).toBeCloseTo(320 + (points[start].y + points[end].y) / 2 * 247, 3)
      const value = Number(await construction.getByTestId('proof-diagonal-distance').first().getAttribute('data-value'))
      expect(Math.hypot(line.x2 - line.x1, line.y2 - line.y1)).toBeCloseTo(Math.abs(value) * 247, 3)
    }
  }
  for (const seed of ['5', '7']) {
    await page.getByRole('slider', { name: 'Quadrilateral seed' }).fill(seed)
    for (const view of ['Both', 'First', 'Second']) {
      await triangleView.getByRole('radio', { name: view, exact: true }).check()
      await expectEndpoints()
    }
  }
  const vertex = page.getByRole('button', { name: 'Quadrilateral AC vertex C', exact: true })
  await vertex.focus()
  await vertex.press('Shift+ArrowLeft')
  await expectEndpoints()
})

test('keeps the proof usable on mobile without horizontal overflow or browser errors', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await openProof(page)
  await page.getByRole('button', { name: '4 Compare the sums' }).click()
  await page.getByRole('group', { name: 'Triangle view', exact: true }).getByRole('radio', { name: 'First', exact: true }).check()
  await expect(page.getByTestId('proof-incircle')).toHaveCount(2)
  await expectActualSums(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('radio', { name: 'AC', exact: true }).check()
  await expect(page.getByTestId('proof-BD')).toHaveCount(0)
  await expect(page.getByTestId('proof-conclusion')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('quadrilateral-mobile.png'), fullPage: true })
  expect(errors).toEqual([])
})
