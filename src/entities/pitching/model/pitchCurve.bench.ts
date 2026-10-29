import { test } from 'vitest'
import { pitchPathOf, projectToScreen, ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'

/**
 * 공 궤적 — 투구 하나의 월드 점 N 개(`pitchPathOf`)와 틀마다 그 점을 화면에 투영하는 일(`projectToScreen`).
 * 기준 숫자만 남긴다(기계마다 달라 실패 기준은 없다) — `pnpm bench`
 */
const 직구 = { typeNumber: 1, form: 0, speedStage: 0, target: ZONE_CENTERS[0] }
const 궤적 = pitchPathOf(직구)

test('공 궤적', async ({ bench }) => {
  await bench.compare(
    bench('궤적 만들기 (pitchPathOf)', () => {
      pitchPathOf(직구)
    }),
    bench(`궤적 전체 투영 (projectToScreen × ${궤적.length})`, () => {
      for (const point of 궤적) projectToScreen(point, 1)
    }),
  )
})
