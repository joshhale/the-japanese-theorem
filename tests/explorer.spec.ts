import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { edgesCross } from '../src/geometry'
import type { Edge } from '../src/geometry'

async function setSlider(page: Page, name: string, value: number) {
  const slider = page.getByRole('slider', { name, exact: true })
  await slider.fill(String(value))
}

async function dragEdge(page: Page, start: string, end: string) {
  const from = await page.getByRole('button', { name: `Vertex ${start}`, exact: true }).locator('.vertex-hit').boundingBox()
  const to = await page.getByRole('button', { name: `Vertex ${end}`, exact: true }).locator('.vertex-hit').boundingBox()
  if (!from || !to) throw new Error('Vertex not visible')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 })
  await page.mouse.up()
}

async function diagonalKeys(page: Page) {
  return page.locator('.diagonal').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-edge')!).sort())
}

test('computes the displayed sum from the live incircles, not the reference', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const initialSum = await page.getByTestId('radius-sum').textContent()
  const initialCircles = await page.getByTestId('incircle').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('r')))
  await setSlider(page, 'Triangulation', 15)
  await expect(page.getByTestId('radius-sum')).toHaveText(initialSum!)
  const changedCircles = await page.getByTestId('incircle').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('r')))
  expect(changedCircles).not.toEqual(initialCircles)
  const actual = changedCircles.reduce((sum, radius) => sum + Number(radius) / 247, 0)
  await expect(page.getByTestId('radius-sum')).toHaveText(actual.toFixed(6))
  await setSlider(page, 'Vertex placement', 12)
  await expect(page.getByTestId('radius-sum')).not.toHaveText(initialSum!)
  await page.getByRole('button', { name: 'Hide incircles' }).click()
  await expect(page.getByTestId('incircle')).toHaveCount(0)
  await expect(page.getByTestId('radius-sum')).toBeVisible()
  await page.getByRole('button', { name: 'Show incircles' }).click()
  await expect(page.getByTestId('incircle')).toHaveCount(6)
  expect(errors).toEqual([])
})

test('supports dragging, replaces crossing constraints, keeps compatible ones, and clears on seed changes', async ({ page }) => {
  await page.goto('/')
  const initialSum = await page.getByTestId('radius-sum').textContent()
  await dragEdge(page, 'A', 'D')
  await expect(page.locator('[data-edge="0-3"][data-testid="forced-edge"]')).toHaveCount(1)
  await dragEdge(page, 'A', 'F')
  await expect(page.getByTestId('forced-edge')).toHaveCount(2)
  await dragEdge(page, 'B', 'E')
  await expect(page.locator('[data-edge="0-3"][data-testid="forced-edge"]')).toHaveCount(0)
  await expect(page.locator('[data-edge="0-5"][data-testid="forced-edge"]')).toHaveCount(1)
  await expect(page.locator('[data-edge="1-4"][data-testid="forced-edge"]')).toHaveCount(1)
  await expect(page.getByRole('status', { name: 'Construction updates' })).toContainText('Replaced 1 crossing diagonal')
  await expect(page.getByTestId('radius-sum')).toHaveText(initialSum!)
  await setSlider(page, 'Triangulation', 2)
  await expect(page.getByTestId('forced-edge')).toHaveCount(0)
  await dragEdge(page, 'A', 'D')
  await setSlider(page, 'Vertex placement', 8)
  await expect(page.getByTestId('forced-edge')).toHaveCount(0)
})

test('manual insertion retains every noncrossing edge and unlocking leaves the geometry alone', async ({ page }) => {
  await page.goto('/')
  for (const [a, b] of [[0, 3], [0, 5], [1, 4], [1, 4]] as Edge[]) {
    const before = await diagonalKeys(page)
    await dragEdge(page, String.fromCharCode(65 + a), String.fromCharCode(65 + b))
    const after = await diagonalKeys(page)
    expect(after).toContain(`${a}-${b}`)
    expect(after).toHaveLength(5)
    for (const key of before) {
      const [c, d] = key.split('-').map(Number)
      expect(after.includes(key)).toBe(!edgesCross([a, b], [c, d]))
    }
    const sum = await page.getByTestId('incircle').evaluateAll((nodes) =>
      nodes.reduce((total, node) => total + Number(node.getAttribute('r')) / 247, 0))
    await expect(page.getByTestId('radius-sum')).toHaveText(sum.toFixed(6))
  }
  const edited = await diagonalKeys(page)
  await page.getByRole('button', { name: 'Remove diagonal B-E', exact: true }).click()
  expect(await diagonalKeys(page)).toEqual(edited)
  await page.getByRole('button', { name: 'Clear forced diagonals' }).click()
  expect(await diagonalKeys(page)).toEqual(edited)
  await setSlider(page, 'Triangulation', 2)
  const reset = await diagonalKeys(page)
  await page.reload()
  await setSlider(page, 'Triangulation', 2)
  expect(await diagonalKeys(page)).toEqual(reset)
})

test('supports keyboard constraints, cancellation, removing edges, and invalid sides', async ({ page }) => {
  await page.goto('/')
  const a = page.getByRole('button', { name: 'Vertex A', exact: true })
  await a.focus()
  await a.press('Enter')
  await a.press('Escape')
  await expect(a).toHaveAttribute('aria-pressed', 'false')
  await a.press('Enter')
  await page.getByRole('button', { name: 'Vertex B', exact: true }).press('Enter')
  await expect(page.getByRole('status', { name: 'Construction updates' })).toContainText('already share a polygon side')
  await expect(page.getByTestId('forced-edge')).toHaveCount(0)
  await a.press('Enter')
  await page.getByRole('button', { name: 'Vertex D', exact: true }).press('Enter')
  await expect(page.getByTestId('forced-edge')).toHaveCount(1)
  await page.getByRole('button', { name: 'Remove diagonal A-D', exact: true }).click()
  await expect(page.getByTestId('forced-edge')).toHaveCount(0)
})

test('handles minimum, maximum, ellipsis, reset, and narrow screens', async ({ page }) => {
  await page.goto('/')
  await setSlider(page, 'Vertices', 3)
  await expect(page.getByTestId('triangle')).toHaveCount(1)
  await expect(page.getByTestId('incircle')).toHaveCount(1)
  await expect(page.getByTestId('diagonal')).toHaveCount(0)
  await setSlider(page, 'Vertices', 40)
  await expect(page.getByTestId('triangle')).toHaveCount(38)
  await expect(page.getByTestId('incircle')).toHaveCount(38)
  await expect(page.locator('.ellipsis')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Radius \d+:/ })).toHaveCount(18)
  await setSlider(page, 'Vertices', 8)
  await dragEdge(page, 'A', 'D')
  await page.getByRole('button', { name: 'Clear forced diagonals' }).click()
  await expect(page.getByTestId('forced-edge')).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('slider', { name: 'Vertices', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.setViewportSize({ width: 320, height: 700 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
