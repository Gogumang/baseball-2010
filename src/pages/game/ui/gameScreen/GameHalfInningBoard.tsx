import { fielderNamesByPosition, halfInningFieldOf } from '@/widgets/field-walk/lib/halfInningFieldInput'
import { HalfInningBoard } from '@/widgets/game-scene/ui/HalfInningBoard'
import { humanVsComputerSidesOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { sceneFieldPaletteOf, type SceneStadium } from '@/features/play-team-game/model/sceneStadium'
import { HALF_INNING_JINGLE_TICK } from '@/features/play-game/model/halfInningBoard'
import { HALF_INNING_SOUND } from '@/features/play-game/model/gameSounds'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { activeSound } from '@/shared/api/audio/soundPort'
import { gameFieldTeamsOf } from '@/pages/game/lib/gameFieldTeams'
import { gameHalfInningCardsOf } from '@/pages/game/lib/gameHalfInningCards'
import type { GameScreenProps } from './gameScreenProps'

type OpenBoard = NonNullable<GameProgress['halfInningBoard']>

interface GameHalfInningBoardProps {
  readonly progress: GameProgress
  readonly career: PlayerCareer
  readonly board: OpenBoard
  readonly sceneStadium: SceneStadium | null | undefined
  readonly walkerSeats: GameScreenProps['walkerSeats']
  readonly onConfirm: () => void
}

/**
 * 1회초 판(상태 0x18) — 선공·1번 타자일 때만 진행기가 세운다(`gameFlow.withFirstInningBoard`, 굴림 36 개는 그때 썼다).
 * 징글 13 은 판의 틱 2 (0x4f7ac). OK → 0xae3a0 → 0xd → 첫 타석.
 */
export function GameHalfInningBoard({ progress, career, board, sceneStadium = null, walkerSeats, onConfirm }: GameHalfInningBoardProps) {
  /** 운동장 전경 · 벤치 클리어링의 두 팀 — 레코드 타자 배열 차례 · 지금 투수 마선수 (`gameFieldTeamsOf`) */
  const fieldTeams = gameFieldTeamsOf(career, progress)
  const isOurOffense = (board.half === '초' ? 0 : 1) === progress.game.playerSide
  const boardDefense = isOurOffense ? fieldTeams.opponent : fieldTeams.ours
  const boardOffense = isOurOffense ? fieldTeams.ours : fieldTeams.opponent
  return (
    <HalfInningBoard
      inning={board.inning}
      half={board.half}
      onTick={(tick) => {
        if (tick === HALF_INNING_JINGLE_TICK) activeSound().play(HALF_INNING_SOUND)
      }}
      // 점수판 틀 0x41440 의 두 측 — 내 팀 PLAYER · 상대 COM
      scoreboardSides={humanVsComputerSidesOf(progress.game.playerSide, progress.ourTeamId, progress.opponentTeamId)}
      // 두 팀 판 0x42364("DUE UP") · 0x420dc("PITCHER")
      cards={gameHalfInningCardsOf(progress, career, board.half)}
      // 운동장 전경 0x4fb8c — 타자편 판은 경기 첫 판(1회초 — 인트로 0xc 바로 뒤)뿐이라 장면이 수비 줄 · 카메라를 아직 안 옮겼다
      // (`carry` 없음 = 0x3fac4 의 자리 합 0 갈래, `lib/fieldCarry`)
      field={halfInningFieldOf({
        rolls: board.fielderRolls,
        half: board.half,
        carry: null,
        playerSide: progress.game.playerSide,
        ourTeamId: progress.ourTeamId,
        opponentTeamId: progress.opponentTeamId,
        grassPalette: sceneFieldPaletteOf(sceneStadium),
        // 이름표 — 칸 0 은 상대 마운드, 1~8 은 0x40008: 상대 팀 레코드 타자 배열 차례(나리 팀 레코드 · 대회 칸)에서 자리 니블이 칸 + 1 인 첫 선수
        fielderNames: fielderNamesByPosition(gameHalfInningCardsOf(progress, career, board.half).pitcherName, boardDefense.lineup),
        // 마선수 그림 0x79b48 — 수비 줄은 수비 팀, 공격 줄은 공격 팀 (0x3fac4 가 +0xec · 두 그림을 싣는다)
        defenseAces: boardDefense.aces,
        offenseAces: boardOffense.aces,
        seats: walkerSeats?.boardBefore ?? null,
      })}
      onConfirm={onConfirm}
    />
  )
}
