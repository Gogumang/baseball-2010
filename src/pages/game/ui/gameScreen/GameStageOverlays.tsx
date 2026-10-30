import { BurstBand } from '@/widgets/burst-mission/ui/BurstBand'
import { burstBandRoleOf } from '@/widgets/burst-mission/lib/burstBandLayout'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import type { RecordAlertFrame } from '@/widgets/game-scene/lib/recordAlert'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import type { SubstitutionScenePlayback } from '@/features/play-game/model/useSubstitutionScene'
import type { SceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { gameMatchupCardsOf } from '@/pages/game/lib/gameMatchupCards'

interface GameStageOverlaysProps {
  readonly progress: GameProgress
  readonly career: PlayerCareer
  readonly burstRow: BurstMissionRow | null | undefined
  readonly sceneConfirm: SceneConfirm
  readonly substitution: SubstitutionScenePlayback
  readonly recordAlert: RecordAlertFrame | undefined
  readonly isMenuOpen: boolean
}

/** 타석 캔버스 위 덧그림 — 돌발 띠 · 0xe 소개 판 · 교체 연출 · 기록 달성 알림 (그리는 차례 그대로) */
export function GameStageOverlays({
  progress,
  career,
  burstRow = null,
  sceneConfirm,
  substitution,
  recordAlert,
  isMenuOpen,
}: GameStageOverlaysProps) {
  return (
    <>
      {/* 타석 공용 그리기 0x4c4bc 4c510~4c524 — 점수판 바로 뒤 돌발 띠 0x8e858 (모드 2~4 · 돌발 객체가 있을 때) */}
      <BurstBand row={burstRow} role={burstBandRoleOf(progress.game.half, progress.game.playerSide)} />
      {/*
        0xe 그리기 0x4d9ec — 0xd 두 그림 뒤 타석 장면 위에 투수·타자 소개 판 0x44944. 팀 글자는 0xb6c20: 내 팀 PLAYER · 상대 COM.
        값은 `gameMatchupCardsOf` (내 레코드 · 상대 마운드).
      */}
      {sceneConfirm.isAwaiting && sceneConfirm.isInConfirmState && <SceneMatchupCards {...gameMatchupCardsOf(progress, career)} />}
      {/* 교체 연출 0x16 — 그리기 0x4da30 이 타석 그림 위에 game_ui 애니 9 "CHANGE" 를 얹는다 */}
      {substitution.isShown && <SubstitutionSceneOverlay key={substitution.serial} aceSlot={substitution.aceSlot} onDone={substitution.finish} />}
      {/* 경기 장면 프레임 0x52c50 의 덧그림 0x4e35c — 그리기 표 다음(53066), 팝업 0x746cd 앞. 겹 `RECORD_ALERT` 라 돌발 창(장면 창)
          위, 경기 중 메뉴가 떠 있으면 메뉴 층 아래 */}
      {recordAlert !== undefined && <RecordAlertStageOverlay frame={recordAlert} isUnderMenu={isMenuOpen} />}
    </>
  )
}
