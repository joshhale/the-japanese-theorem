import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { referenceSum } from '../src/geometry'

async function openSangaku(page: Page) {
  await page.getByRole('tab', { name: '算額' }).click()
  await expect(page.getByRole('tabpanel', { name: '算額' })).toBeVisible()
}

async function diagonalKeys(drawing: Locator) {
  return drawing.getByTestId('sangaku-diagonal').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-edge')).sort())
}

async function drawingGeometry(drawing: Locator) {
  return drawing.evaluate((root) => {
    const outer = root.querySelector('.circumcircle, [data-testid="sangaku-circumcircle"]')
    const polygon = root.querySelector('.polygon-boundary, [data-testid="sangaku-polygon"]')
    const points = polygon?.getAttribute('points')
    if (!outer || !points) throw new Error('Expected a circumcircle and polygon')
    const radius = Number(outer.getAttribute('r'))
    const x = Number(outer.getAttribute('cx'))
    const y = Number(outer.getAttribute('cy'))
    return {
      vertices: points.split(' ').map((point) => {
        const [px, py] = point.split(',').map(Number)
        return { x: (px - x) / radius, y: (py - y) / radius }
      }),
      circles: [...root.querySelectorAll('[data-testid="sangaku-incircle"]')].map((circle) => {
        const triangle = circle.getAttribute('data-triangle')
        if (!triangle) throw new Error('Expected incircle triangle indices')
        return { x: (Number(circle.getAttribute('cx')) - x) / radius,
          y: (Number(circle.getAttribute('cy')) - y) / radius,
          radius: Number(circle.getAttribute('r')) / radius, triangle: triangle.split('-').map(Number) }
      }),
    }
  })
}

test('shares the configured polygon and provides a white, monochrome presentation without notebook controls', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('slider', { name: 'Vertices', exact: true }).fill('11')
  await page.getByRole('slider', { name: 'Vertex placement', exact: true }).fill('19')
  const expected = await drawingGeometry(page.getByRole('tabpanel', { name: 'Japanese Theorem' }).locator('.geometry'))
  await openSangaku(page)
  await expect(page.getByRole('tablist')).toHaveCount(0)
  await expect(page.getByRole('slider')).toHaveCount(0)
  await expect(page.getByRole('button')).toHaveCount(4)
  await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  for (const name of ['left', 'right']) {
    const drawing = page.getByRole('button', { name: `Retriangulate ${name} polygon`, exact: true })
    const actual = await drawingGeometry(drawing)
    expect(actual.vertices).toHaveLength(11)
    actual.vertices.forEach((point, index) => {
      expect(point.x).toBeCloseTo(expected.vertices[index].x, 12)
      expect(point.y).toBeCloseTo(expected.vertices[index].y, 12)
    })
    await expect(drawing.getByTestId('sangaku-incircle')).toHaveCount(9)
    await expect(drawing.getByTestId('sangaku-diagonal')).toHaveCount(8)
    await expect(drawing.locator('text')).toHaveCount(0)
    const strokes = await drawing.locator('circle, line, polygon').evaluateAll((nodes) =>
      [...new Set(nodes.map((node) => getComputedStyle(node).stroke))])
    expect(strokes).toEqual(['rgb(0, 0, 0)'])
  }
  await page.getByRole('button', { name: '丸山良寛の定理', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Japanese Theorem' })).toBeFocused()
  await expect(page.getByRole('slider', { name: 'Vertices', exact: true })).toHaveValue('11')
  await expect(page.getByRole('slider', { name: 'Vertex placement', exact: true })).toHaveValue('19')
})

test('changes only the clicked drawing, with actual tangent incircles and retained notebook state', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Vertex A', exact: true }).press('Enter')
  await page.getByRole('button', { name: 'Vertex D', exact: true }).press('Enter')
  await expect(page.getByTestId('forced-edge')).toHaveCount(1)
  const originalSum = await page.getByTestId('radius-sum').textContent()
  const notebookEdges = await page.getByTestId('diagonal').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-edge')).sort())
  await openSangaku(page)
  const drawings = ['left', 'right'].map((side) => page.getByRole('button', { name: `Retriangulate ${side} polygon`, exact: true }))
  const original = await drawingGeometry(drawings[0])
  expect(await diagonalKeys(drawings[0])).not.toEqual(await diagonalKeys(drawings[1]))
  for (let turn = 0; turn < 10; turn++) {
    const index = turn % 2
    const before = await Promise.all(drawings.map(diagonalKeys))
    await drawings[index].click()
    await expect.poll(() => diagonalKeys(drawings[index])).not.toEqual(before[index])
    expect(await diagonalKeys(drawings[1 - index])).toEqual(before[1 - index])
    expect(await diagonalKeys(drawings[0])).not.toEqual(await diagonalKeys(drawings[1]))
    const { vertices, circles } = await drawingGeometry(drawings[index])
    expect(vertices).toEqual(original.vertices)
    expect(circles).toHaveLength(vertices.length - 2)
    for (const circle of circles) {
      const points = circle.triangle.map((vertex) => vertices[vertex])
      const orientation = Math.sign((points[1].x - points[0].x) * (points[2].y - points[0].y)
        - (points[1].y - points[0].y) * (points[2].x - points[0].x))
      expect(circle.radius).toBeGreaterThan(0)
      for (let side = 0; side < 3; side++) {
        const a = points[side]
        const b = points[(side + 1) % 3]
        const cross = (b.x - a.x) * (circle.y - a.y) - (b.y - a.y) * (circle.x - a.x)
        expect(cross * orientation).toBeGreaterThan(0)
        expect(Math.abs(cross) / Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(circle.radius, 10)
      }
    }
    expect(circles.reduce((sum, circle) => sum + circle.radius, 0)).toBeCloseTo(referenceSum(vertices), 10)
  }
  const finalEdges = await Promise.all(drawings.map(diagonalKeys))
  await page.screenshot({ path: testInfo.outputPath('sangaku-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: '丸山良寛の定理', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove diagonal A-D', exact: true })).toBeVisible()
  await expect(page.getByTestId('forced-edge')).toHaveCount(1)
  await expect(page.getByTestId('radius-sum')).toHaveText(originalSum!)
  expect(await page.getByTestId('diagonal').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-edge')).sort()))
    .toEqual(notebookEdges)
  await page.getByRole('slider', { name: 'Triangulation', exact: true }).fill('20')
  await openSangaku(page)
  expect(await Promise.all(drawings.map(diagonalKeys))).toEqual(finalEdges)
})

test('supports keyboard entry, independent keyboard retriangulation, and return to tab 01', async ({ page }) => {
  await page.goto('/')
  const theorem = page.getByRole('tab', { name: 'Japanese Theorem' })
  await theorem.focus()
  await theorem.press('Home')
  await expect(page.getByRole('tabpanel', { name: '算額' })).toBeFocused()
  await page.keyboard.press('Tab')
  const left = page.getByRole('button', { name: 'Retriangulate left polygon', exact: true })
  const right = page.getByRole('button', { name: 'Retriangulate right polygon', exact: true })
  await expect(left).toBeFocused()
  const before = await diagonalKeys(left)
  await left.press('Enter')
  await expect.poll(() => diagonalKeys(left)).not.toEqual(before)
  const afterEnter = await diagonalKeys(left)
  await left.press('Space')
  await expect.poll(() => diagonalKeys(left)).not.toEqual(afterEnter)
  await left.press('Tab')
  await expect(right).toBeFocused()
  await right.press('Tab')
  const lineup = page.getByRole('button', { name: 'Toggle incircle line-up', exact: true })
  await expect(lineup).toBeFocused()
  await lineup.press('Enter')
  await expect(lineup).toHaveAttribute('aria-pressed', 'true')
  await lineup.press('Space')
  await expect(lineup).toHaveAttribute('aria-pressed', 'false')
  await lineup.press('Tab')
  const explore = page.getByRole('button', { name: '丸山良寛の定理', exact: true })
  await expect(explore).toBeFocused()
  await explore.press('Enter')
  await expect(theorem).toBeFocused()
  await expect(theorem).toHaveAttribute('aria-selected', 'true')
})

test('toggles bare, diameter-adjacent rows of exact incircle copies and updates them after retriangulation', async ({ page }, testInfo) => {
  await page.goto('/')
  await openSangaku(page)
  const toggle = page.getByRole('button', { name: 'Toggle incircle line-up', exact: true })
  const drawings = ['left', 'right'].map((side) =>
    page.getByRole('button', { name: `Retriangulate ${side} polygon`, exact: true }))
  const originalEdges = await Promise.all(drawings.map(diagonalKeys))
  const originalBounds = await drawings[0].boundingBox()
  const viewport = page.viewportSize()
  if (!originalBounds || !viewport) throw new Error('Expected a visible diagram and viewport')
  const centerY = originalBounds.y + originalBounds.height / 2
  expect(centerY).toBeGreaterThan(viewport.height * 0.3)
  expect(centerY).toBeLessThan(viewport.height * 0.5)
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(toggle.locator('svg')).toHaveCount(0)
  await expect(toggle).toHaveCSS('border-width', '0px')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(toggle.locator('svg *:not(g):not(circle)')).toHaveCount(0)
  expect(await drawings[0].boundingBox()).toEqual(originalBounds)
  expect(await Promise.all(drawings.map(diagonalKeys))).toEqual(originalEdges)

  for (let turn = 0; turn < 5; turn++) {
    if (turn > 0) {
      const drawing = drawings[turn % 2]
      const previous = await diagonalKeys(drawing)
      await drawing.click()
      await expect.poll(() => diagonalKeys(drawing)).not.toEqual(previous)
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    }
    const geometry = await page.locator('.sangaku-comparison').evaluate((root) => {
      const readCircle = (circle: Element) => {
        const bounds = circle.getBoundingClientRect()
        return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
          radius: bounds.width / 2, sourceRadius: Number(circle.getAttribute('r')),
          triangle: circle.getAttribute('data-triangle') }
      }
      return {
        originals: [...root.querySelectorAll('.sangaku-diagram')].map((drawing) =>
          [...drawing.querySelectorAll('[data-testid="sangaku-incircle"]')].map(readCircle)),
        rows: [...root.querySelectorAll('.sangaku-lineup-toggle g')].map((row) =>
          [...row.querySelectorAll('circle')].map(readCircle)),
      }
    })
    expect(geometry.rows).toHaveLength(2)
    geometry.rows.forEach((row, index) => {
      const expected = [...geometry.originals[index]].sort((a, b) =>
        index === 0 ? b.radius - a.radius : a.radius - b.radius)
      expect(row.map((circle) => circle.triangle)).toEqual(expected.map((circle) => circle.triangle))
      row.forEach((circle, position) => {
        expect(circle.sourceRadius).toBeCloseTo(expected[position].sourceRadius, 12)
        // Separate SVG viewports can round their dimensions to different subpixels.
        expect(circle.radius).toBeCloseTo(expected[position].radius, 2)
        expect(circle.y).toBeCloseTo(row[0].y, 3)
        if (position > 0) {
          expect(circle.x - circle.radius).toBeCloseTo(row[position - 1].x + row[position - 1].radius, 3)
        }
      })
    })
    const [top, bottom] = geometry.rows
    expect(top[0].x - top[0].radius).toBeCloseTo(bottom[0].x - bottom[0].radius, 3)
    expect(top.at(-1)!.x + top.at(-1)!.radius).toBeCloseTo(bottom.at(-1)!.x + bottom.at(-1)!.radius, 3)
    for (const a of top) {
      for (const b of bottom) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius)
      }
    }
  }
  await page.screenshot({ path: testInfo.outputPath('sangaku-lineup-desktop.png'), fullPage: true })
  const finalEdges = await Promise.all(drawings.map(diagonalKeys))
  await toggle.click()
  await expect(toggle.locator('svg')).toHaveCount(0)
  expect(await Promise.all(drawings.map(diagonalKeys))).toEqual(finalEdges)
})

test('handles triangles, quadrilaterals, and the maximum polygon at phone width', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('slider', { name: 'Vertices', exact: true }).fill('4')
  await openSangaku(page)
  const left = page.getByRole('button', { name: 'Retriangulate left polygon', exact: true })
  const right = page.getByRole('button', { name: 'Retriangulate right polygon', exact: true })
  const originalLeft = await diagonalKeys(left)
  const originalRight = await diagonalKeys(right)
  expect(originalLeft).not.toEqual(originalRight)
  await left.click()
  await expect.poll(() => diagonalKeys(left)).not.toEqual(originalLeft)
  expect(await diagonalKeys(right)).toEqual(originalRight)
  await page.getByRole('button', { name: '丸山良寛の定理', exact: true }).click()
  await page.getByRole('slider', { name: 'Vertices', exact: true }).fill('3')
  await page.getByRole('slider', { name: 'Vertex placement', exact: true }).fill('14')
  await openSangaku(page)
  await expect(left).toBeDisabled()
  await expect(right).toBeDisabled()
  await expect(page.getByTestId('sangaku-incircle')).toHaveCount(2)
  await page.getByRole('button', { name: 'Toggle incircle line-up', exact: true }).click()
  await expect(page.getByTestId('sangaku-lineup-circle')).toHaveCount(2)
  const topCircle = await page.getByTestId('sangaku-lineup-left').locator('circle').boundingBox()
  const bottomCircle = await page.getByTestId('sangaku-lineup-right').locator('circle').boundingBox()
  if (!topCircle || !bottomCircle) throw new Error('Expected both triangle incircle copies')
  expect(topCircle.y + topCircle.height).toBeLessThan(bottomCircle.y)
  await page.getByRole('button', { name: '丸山良寛の定理', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('slider', { name: 'Vertices', exact: true }).fill('40')
  await page.getByRole('slider', { name: 'Vertex placement', exact: true }).fill('25')
  await openSangaku(page)
  await expect(page.getByTestId('sangaku-incircle')).toHaveCount(76)
  await expect(left).toBeEnabled()
  const a = await left.getByTestId('sangaku-circumcircle').boundingBox()
  const b = await right.getByTestId('sangaku-circumcircle').boundingBox()
  const button = await page.getByRole('button', { name: '丸山良寛の定理', exact: true }).boundingBox()
  if (!a || !b || !button) throw new Error('Presentation controls must be visible')
  expect(a.x + a.width).toBeLessThan(b.x)
  expect(a.y).toBeCloseTo(b.y, 3)
  expect(button.y + button.height).toBeLessThanOrEqual(844)
  expect(button.y + button.height).toBeGreaterThan(784)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const toggle = page.getByRole('button', { name: 'Toggle incircle line-up', exact: true })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(page.getByTestId('sangaku-lineup-circle')).toHaveCount(76)
  const rowBounds = await toggle.boundingBox()
  if (!rowBounds) throw new Error('Circle line-up must be visible')
  expect(rowBounds.y).toBeGreaterThan(a.y + a.height)
  expect(rowBounds.y + rowBounds.height).toBeLessThan(button.y)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('sangaku-phone.png'), fullPage: true })
})
