import { sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import type { HomeRunDerbySession } from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { benchClearingFieldOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * 사구 뒤 벤치 클리어링(상태 0x1e) — 0x12 대기 끝 0x4e74c 굴림이 들어갔다. 출구는 0xae24c(`finishBenchClearing`).
 * 그리기 0x43228 — 모드 7 은 내 팀이 측 0(공격) · 뽑은 상대 팀이 측 1(수비, 3a476 0xb6bd5(ctx, 1, v)) · 주자 없음.
 * 지금 타자의 손 0xb63c0 = 폼 & 1 — 마스터 줄이 치면 그 줄의 폼(`batterForm`)
 */
export function DerbyBenchClearing({
  session,
  myTeamId,
  batterForm,
  random,
}: {
  readonly session: HomeRunDerbySession
  readonly myTeamId: number | undefined
  readonly batterForm: number | undefined
  readonly random: RandomPort
}) {
  return (
    <BenchClearingScene
      field={benchClearingFieldOf({
        entryRolls: session.benchClearingEntryRolls,
        half: '초',
        playerSide: 0,
        ourTeamId: myTeamId ?? 0,
        opponentTeamId: session.opponentTeamId ?? 0,
        batterHand: batterSideOfForm(batterForm ?? 0),
        bases: { first: false, second: false, third: false },
        grassPalette: sceneFieldPaletteOf(session.sceneStadium),
      })}
      // 틱 10 의 수비 목표 굴림 8 번(0x401d4)을 화면이 그 틱에 낸다 — 끝에서 다시 굴리지 않는다(onDone 이 거짓)
      random={random}
      onDone={session.finishBenchClearing}
    />
  )
}
