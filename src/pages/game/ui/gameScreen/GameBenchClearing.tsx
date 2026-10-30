import { benchClearingFieldOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import { BenchClearingScene } from '@/widgets/game-scene/ui/BenchClearingScene'
import { sceneFieldPaletteOf, type SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { gameBenchOffenseOf, gameFieldTeamsOf } from '@/pages/game/lib/gameFieldTeams'
import type { GameScreenProps } from './gameScreenProps'

type BenchClearing = NonNullable<GameProgress['pendingBenchClearing']>

interface GameBenchClearingProps {
  readonly progress: GameProgress
  readonly career: PlayerCareer
  readonly benchClearing: BenchClearing
  readonly sceneStadium: SceneStadium | null | undefined
  readonly walkerSeats: GameScreenProps['walkerSeats']
  readonly random: RandomPort
  readonly onDone: (reachedTargetTick: boolean) => void
}

/** 사구 뒤 벤치 클리어링 (상태 0x1e) — 타석이 붙들린 채 연출이 돈다. 공용 키 '*'·도루도 0x1e 에서는 안 열린다 */
export function GameBenchClearing({ progress, career, benchClearing, sceneStadium = null, walkerSeats, random, onDone }: GameBenchClearingProps) {
  /** 운동장 전경 · 벤치 클리어링의 두 팀 — 레코드 타자 배열 차례 · 지금 투수 마선수 (`gameFieldTeamsOf`) */
  const fieldTeams = gameFieldTeamsOf(career, progress)
  return (
    <BenchClearingScene
      // 그리기 0x43228 — 진입 굴림 45 번으로 선 18명 (사구를 맞은 타자는 나다)
      field={benchClearingFieldOf({
        entryRolls: benchClearing.entryRolls,
        half: progress.game.half,
        playerSide: progress.game.playerSide,
        ourTeamId: progress.ourTeamId,
        opponentTeamId: progress.opponentTeamId,
        batterHand: career.battingSide,
        bases: progress.game.bases,
        grassPalette: sceneFieldPaletteOf(sceneStadium),
        // 마선수 그림 0x79b48 — 공격 줄은 내 팀(사구를 맞은 타자는 나 — 마선수가 아니다), 수비 줄은 상대 팀
        defenseAces: fieldTeams.opponent.aces,
        // 수비 줄 +0xec — 이 장면에서 마지막으로 적힌 값(1회초 판 · 내 타석의 수비 판 시작)
        defenseSeats: walkerSeats?.benchDefense ?? null,
        // 사구를 맞은 지금 타자는 내 선수 — 마선수가 아니라 3a97e 의 맞바꿈이 없다. 루 위 마선수 주자는 3aa1a
        offenseAces: gameBenchOffenseOf(fieldTeams.ours, progress),
      })}
      // 틱 10 의 수비 목표 굴림 8 번(0x401d4)을 화면이 그 틱에 낸다 — 끝에서 다시 굴리지 않는다(onDone 이 거짓)
      random={random}
      onDone={onDone}
    />
  )
}
