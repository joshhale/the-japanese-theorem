import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/')
  await page.getByRole('tab', { name: 'Angle at the center' }).click()
}

async function vertices(page: Page) {
  return page.getByTestId('central-vertex').evaluateAll((nodes) =>
    nodes.map((node) => ({ x: Number(node.getAttribute('cx')), y: Number(node.getAttribute('cy')) })))
}

async function expectMeasurements(page: Page) {
  const [a, b, c] = await vertices(page)
  const angle = (p: typeof a, q: typeof a, r: typeof a) => {
    const u = { x: q.x - p.x, y: q.y - p.y }
    const v = { x: r.x - p.x, y: r.y - p.y }
    return Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y)))))
  }
  const positive = (value: number) => (value % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  const start = Math.atan2(a.y - 320, a.x - 320)
  const ab = positive(Math.atan2(b.y - 320, b.x - 320) - start)
  const ac = positive(Math.atan2(c.y - 320, c.x - 320) - start)
  const sweep = ac < ab ? ab - 2 * Math.PI : ab
  await expect(page.getByTestId('central-angle-value')).toHaveText(`${(Math.abs(sweep) * 180 / Math.PI).toFixed(6)}°`)
  await expect(page.getByTestId('inscribed-angle-value')).toHaveText(`${(angle(c, a, b) * 180 / Math.PI).toFixed(6)}°`)
  return { sweep, c }
}

async function arcSweep(page: Page, id: string, center: { x: number; y: number }) {
  const path = await page.getByTestId(id).locator('path').getAttribute('d')
  const values = path?.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number)
  if (!values || values.length !== 9) throw new Error('Expected a circular arc')
  const start = Math.atan2(values[1] - center.y, values[0] - center.x)
  const end = Math.atan2(values[8] - center.y, values[7] - center.x)
  const positive = (value: number) => (value % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI)
  return values[6] ? positive(end - start) : -positive(start - end)
}

test('navigates tab 05 with the keyboard and preserves both the proof and notebook state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('slider', { name: 'Vertex placement', exact: true }).fill('19')
  const first = page.getByRole('tab', { name: 'Japanese Theorem' })
  const fifth = page.getByRole('tab', { name: 'Angle at the center' })
  await first.focus()
  await first.press('End')
  await expect(fifth).toBeFocused()
  await page.getByRole('button', { name: 'Subtract angles', exact: true }).click()
  await page.getByRole('button', { name: '4 Combine the pieces' }).click()
  const original = await vertices(page)
  await fifth.focus()
  await fifth.press('ArrowRight')
  await page.getByRole('button', { name: '丸山良寛の定理', exact: true }).click()
  await expect(first).toBeFocused()
  await expect(page.getByRole('slider', { name: 'Vertex placement', exact: true })).toHaveValue('19')
  await first.press('End')
  expect(await vertices(page)).toEqual(original)
  await expect(page.getByRole('button', { name: '4 Combine the pieces' })).toHaveAttribute('aria-pressed', 'true')
})

test('draws the correct intercepted arcs for minor, straight, reflex, and subtraction examples', async ({ page }, testInfo) => {
  await open(page)
  for (const [name, central] of [['Minor arc', 120], ['Semicircle', 180], ['Reflex angle', 240], ['Subtract angles', 60]] as const) {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByTestId('central-angle-value')).toHaveText(`${central.toFixed(6)}°`)
    await expect(page.getByTestId('inscribed-angle-value')).toHaveText(`${(central / 2).toFixed(6)}°`)
    const { sweep, c } = await expectMeasurements(page)
    expect(await arcSweep(page, 'central-main-angle', { x: 320, y: 320 })).toBeCloseTo(sweep, 10)
    expect(Math.abs(await arcSweep(page, 'central-inscribed-angle', c))).toBeCloseTo(Math.abs(sweep) / 2, 10)
    expect(await arcSweep(page, 'central-intercepted-arc', { x: 320, y: 320 })).toBeCloseTo(sweep, 10)
    if (name === 'Reflex angle') {
      await expect(page.getByRole('region', { name: 'Proof of the angle-at-the-center theorem' })).toContainText('reflex angle')
      await page.screenshot({ path: testInfo.outputPath('central-reflex.png'), fullPage: true })
    }
  }
})

test('shows isosceles triangles and exterior angles before adding or subtracting their doubles', async ({ page }, testInfo) => {
  await open(page)
  for (const name of ['Minor arc', 'Reflex angle', 'Subtract angles']) {
    await page.getByRole('button', { name, exact: true }).click()
    await page.getByRole('button', { name: '2 Draw a diameter' }).click()
    await expect(page.getByTestId('central-diameter')).toHaveCount(1)
    await expect(page.getByTestId('central-proof-triangle')).toHaveCount(2)
    await page.getByRole('button', { name: '3 Double each piece' }).click()
    for (const [index, label] of ['Triangle OCA', 'Triangle OCB'].entries()) {
      await page.getByRole('radio', { name: label }).check()
      await expect(page.getByTestId('central-proof-triangle')).toHaveCount(1)
      const points = await vertices(page)
      const c = points[2]
      const d = { x: 640 - c.x, y: 640 - c.y }
      const point = points[index]
      const u = { x: point.x - c.x, y: point.y - c.y }
      const v = { x: d.x - c.x, y: d.y - c.y }
      const base = Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y)
      expect(Math.abs(await arcSweep(page, 'central-exterior-angle', { x: 320, y: 320 }))).toBeCloseTo(2 * base, 10)
      if (name === 'Minor arc' && index === 0) await page.screenshot({ path: testInfo.outputPath('central-isosceles.png'), fullPage: true })
    }
    await page.getByRole('button', { name: '4 Combine the pieces' }).click()
    const exposition = page.getByRole('region', { name: 'Proof of the angle-at-the-center theorem' })
    await expect(exposition).toContainText(name === 'Subtract angles' ? 'Subtract the smaller piece' : 'Add the two pieces')
    await expectMeasurements(page)
    if (name === 'Subtract angles') await page.screenshot({ path: testInfo.outputPath('central-subtraction.png'), fullPage: true })
  }
  await page.getByRole('button', { name: 'Semicircle', exact: true }).click()
  const vertex = page.getByRole('button', { name: 'Angle vertex A', exact: true })
  await vertex.focus()
  for (let turn = 0; turn < 18; turn++) await vertex.press('Shift+ArrowRight')
  await page.getByRole('button', { name: '3 Double each piece' }).click()
  await page.getByRole('radio', { name: 'Triangle OCA' }).check()
  await expect(page.getByRole('region', { name: 'Proof of the angle-at-the-center theorem' })).toContainText('A coincides with D')
  await expect(vertex).toContainText('A = D')
  await expect(page.getByTestId('central-exterior-angle')).toHaveCount(0)
  await page.getByRole('radio', { name: 'Triangle OCB' }).check()
  await expect(page.getByTestId('central-exterior-angle')).toHaveCount(1)
  await expectMeasurements(page)
})

test('recalculates after every seed, dragging, keyboard movement, cancellation, and reset', async ({ page }) => {
  await open(page)
  for (let seed = 1; seed <= 25; seed++) {
    await page.getByRole('slider', { name: 'Angle triangle seed' }).fill(String(seed))
    await expectMeasurements(page)
  }
  const original = await vertices(page)
  const vertex = page.getByRole('button', { name: 'Angle vertex C', exact: true })
  await vertex.focus()
  await vertex.press('Shift+ArrowLeft')
  expect(await vertices(page)).not.toEqual(original)
  await expectMeasurements(page)
  await page.getByRole('button', { name: 'Reset to seed', exact: true }).click()
  expect(await vertices(page)).toEqual(original)
  await vertex.focus()
  const box = await page.locator('.central-angle-diagram').boundingBox()
  if (!box) throw new Error('Expected the angle diagram')
  const point = original[2]
  const angle = Math.atan2(point.y - 320, point.x - 320) + 0.1
  const start = { x: box.x + point.x / 640 * box.width, y: box.y + point.y / 640 * box.height }
  const end = { x: box.x + (320 + 205 * Math.cos(angle)) / 640 * box.width,
    y: box.y + (320 + 205 * Math.sin(angle)) / 640 * box.height }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 5 })
  expect(await vertices(page)).not.toEqual(original)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  expect(await vertices(page)).toEqual(original)
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(end.x, end.y, { steps: 5 })
  await page.mouse.up()
  expect(await vertices(page)).not.toEqual(original)
  await expectMeasurements(page)
})

test('fits the diagram and proof at phone widths without errors or horizontal scrolling', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page)
  await page.getByRole('button', { name: 'Subtract angles', exact: true }).click()
  await page.getByRole('button', { name: '4 Combine the pieces' }).click()
  await expectMeasurements(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('central-phone.png'), fullPage: true })
  await page.setViewportSize({ width: 320, height: 700 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  expect(errors).toEqual([])
})
