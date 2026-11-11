import { describe, expect, it } from 'vitest'
import { analyzeCentralAngle, centralPreset, CENTRAL_PRESETS, createCentralTriangle } from './centralAngleGeometry'
import type { TrianglePoints } from './triangleGeometry'

describe('angle at the center', () => {
  it('selects the intercepted minor, straight, and reflex angles, and the subtraction case', () => {
    const expected = [120, 180, 240, 60]
    CENTRAL_PRESETS.forEach((kind, index) => {
      const proof = analyzeCentralAngle(centralPreset(kind))
      if (!proof.valid) throw new Error(proof.reason)
      expect(proof.central * 180 / Math.PI).toBeCloseTo(expected[index], 10)
      expect(proof.inscribed * 180 / Math.PI).toBeCloseTo(expected[index] / 2, 10)
      expect(proof.add).toBe(kind !== 'Subtract angles')
    })
  })

  it('independently measures the doubled pieces and the sum or difference for every seed and either orientation', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const points = createCentralTriangle(seed)
      const reflected: TrianglePoints = [points[0], points[2], points[1]]
      for (const triangle of [points, reflected]) {
        const proof = analyzeCentralAngle(triangle)
        if (!proof.valid) throw new Error(proof.reason)
        expect(proof.central).toBeCloseTo(2 * proof.inscribed, 12)
        expect(proof.firstCentral).toBeCloseTo(2 * proof.alpha, 12)
        expect(proof.secondCentral).toBeCloseTo(2 * proof.beta, 12)
        expect(proof.inscribed).toBeCloseTo(proof.add ? proof.alpha + proof.beta : Math.abs(proof.alpha - proof.beta), 12)
        expect(proof.central).toBeCloseTo(proof.add ? proof.firstCentral + proof.secondCentral
          : Math.abs(proof.firstCentral - proof.secondCentral), 12)
      }
    }
  })

  it('handles a zero piece when the diameter endpoint coincides with A', () => {
    const proof = analyzeCentralAngle([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }])
    if (!proof.valid) throw new Error(proof.reason)
    expect(proof.alpha).toBe(0)
    expect(proof.firstCentral).toBe(0)
    expect(proof.central).toBeCloseTo(2 * proof.inscribed, 12)
  })

  it('reports invalid, repeated, and off-circle vertices explicitly', () => {
    expect(analyzeCentralAngle([{ x: 1, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }]).valid).toBe(false)
    expect(analyzeCentralAngle([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]).valid).toBe(false)
    expect(analyzeCentralAngle([{ x: NaN, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]).valid).toBe(false)
  })
})
