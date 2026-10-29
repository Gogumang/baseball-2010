import {
  type BenchClearingField,
  type BenchClearingWalkState,
  FieldWalkView,
  benchClearingCamera,
  screenOffsetOf,
} from '@/widgets/game-scene/ui/benchClearingScene/otherSlices'

/** 마선수 그림이 있으면 그 칸만 넘긴다 */
const acesOf = (aces: BenchClearingField['defenseAces']) => (aces === undefined ? {} : { aceSprites: aces })

/**
 * 그리기 0x43228 — 투수판에 맞춘 수비 운동장 위에 수비 줄 · 공격 줄을 그리기 목록 차례로
 */
export function BenchClearingFieldView({ field, walk }: { readonly field: BenchClearingField; readonly walk: BenchClearingWalkState }) {
  return (
    <FieldWalkView
      offset={screenOffsetOf(benchClearingCamera())}
      grassPalette={field.grassPalette ?? null}
      rows={[
        // 43240 0x43010(장면, [+0xf20], +0x111c, 0) — 수비 줄
        { walkers: walk.fielders, teamIndex: field.defenseTeam ?? null, ...acesOf(field.defenseAces) },
        // 43252 0x43010(장면, [+0x177c], +0x1758, 1) — 공격 줄
        { walkers: walk.offense, teamIndex: field.offenseTeam ?? null, ...acesOf(field.offenseAces) },
      ]}
    />
  )
}
