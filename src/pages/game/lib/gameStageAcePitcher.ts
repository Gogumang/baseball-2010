import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { opponentMoundAcePlayerOf } from '@/features/play-game/model/gameFlow'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames } from '@/widgets/batting-stage/model/stageRefs'

/**
 * **나리 타자편 타석 마운드의 마투수 그림** (`BattingStage.acePitcher`) — 마선수 대결 투수(`aceOpponent`)뿐 아니라 142 가 상대 명부
 * 8번 칸에 넣은 마투수(`0xb88c8`)가 마운드에 서도 ace/pitcher_* 그림이다. 원본 타석 교대 0x47cc8 482d4~482da 가 `0xb63a0(투수)` 를
 * 모드를 안 가리고 적재 0x793b0 에 넘기고, 793c2 가 순번 ≥ 0 이면 점프표 0xd3d64 로 마투수 그림을 연다 (`opponentMoundAcePlayerOf`).
 * 예전엔 `aceOpponent` 만 봐서 8번 칸 마투수가 소개 판엔 제 이름으로 서고 그림은 평범한 투수로 던졌다(r229)
 */
export function gameStageAcePitcherOf(progress: GameProgress): AcePitcherFrames | null {
  const ace = opponentMoundAcePlayerOf(progress)
  return ace === null ? null : acePitcherFramesOf(ace)
}
