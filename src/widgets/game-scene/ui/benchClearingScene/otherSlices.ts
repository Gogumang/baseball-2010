/**
 * 벤치 클리어링 연출이 쓰는 **다른 조각** — 운동장 18명 걸음 · 원 닫기 단계 · 운동장 그림(`widgets/field-walk`) · 수비 카메라 화면 어긋남(`pages/defense`).
 * 조각 · 층 경계를 넘는 import 를 이 파일 한 곳에 모은다(`lint.boundaries-baseline.js` 의 예외는 이 파일 하나)
 */
export { screenOffsetOf } from '@/pages/defense/lib/defenseCamera'
export {
  BENCH_CLEARING_EXIT_TICK,
  benchClearingCamera,
  benchClearingIrisOf,
  startBenchClearingWalk,
  stepBenchClearingWalk,
} from '@/widgets/field-walk/lib/benchClearingWalk'
export type { BenchClearingField, BenchClearingWalkInput, BenchClearingWalkState } from '@/widgets/field-walk/lib/benchClearingWalk'
export { FieldWalkView } from '@/widgets/field-walk/ui/FieldWalkView'
