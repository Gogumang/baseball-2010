import { PressArea } from '@/shared/ui'
import { MENU_PRESS_RECT, stealPressRectOf } from '@/features/play-game/model/stagePressAreas'
import type { SceneConfirm } from '@/features/play-game/model/useSceneConfirm'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import type { SettlementEffectLayers } from '@/widgets/batting-stage/model/stageRefs'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import { MissionResultBoard } from '@/pages/mission-play/ui/MissionResultBoard'
import { missionResultLeaveOf } from '@/pages/mission-play/lib/missionResultBoard'
import type { MissionPlayScreenProps } from './missionPlayProps'

/**
 * 0xe 그리기 0x4d9ec 의 소개 판 값 — 미션 라우트가 `missionMatchupCards` 로 지금 투수 · 타자 레코드에서 채워 넘긴다(`matchupCards`).
 * 안 넘기면(시험) 팀 글자와 이름만 — 타자 손은 레코드 +0xb 의 0xb63c0. 사람이 치므로 타자 PLAYER · 투수 COM.
 */
function missionMatchupCardsOf({ matchupCards, batterLook, opponent, batterName }: MissionPlayScreenProps) {
  return (
    matchupCards ?? {
      batterHand: batterSideOfForm(batterLook?.form ?? 0),
      pitcher: { isComputer: true, ...(opponent === null ? {} : { name: opponent.name }) },
      batter: { isComputer: false, ...(batterName === undefined ? {} : { name: batterName }) },
    }
  )
}

/** 교체 연출 0x16 (그리기 0x4da30 이 타석 그림 위에 game_ui 애니 9 "CHANGE") · 0xe 소개 판 0x44944 (0xd 두 그림 뒤, 모드 검사 없음) */
export function MissionSceneOverlays({
  props,
  isSubstituting,
  isAwaitingConfirm,
  isInConfirmState,
}: {
  readonly props: MissionPlayScreenProps
  readonly isSubstituting: boolean
  readonly isAwaitingConfirm: boolean
  readonly isInConfirmState: boolean
}) {
  const { substitutionScene = null, onSubstitutionSceneDone } = props
  return (
    <>
      {isSubstituting && substitutionScene !== null && (
        <SubstitutionSceneOverlay
          key={substitutionScene.serial}
          aceSlot={substitutionScene.aceSlot ?? null}
          onDone={() => onSubstitutionSceneDone?.()}
        />
      )}
      {isAwaitingConfirm && isInConfirmState && <SceneMatchupCards {...missionMatchupCardsOf(props)} />}
    </>
  )
}

/** 경기 상태 0x19 — 미션 결과 판 0x4a384(모드 5·6) · 키 0x407f0 */
export function MissionResultLayer({
  props,
  isOver,
  isSuccess,
  settlementLayers,
}: {
  readonly props: MissionPlayScreenProps
  readonly isOver: boolean
  readonly isSuccess: boolean
  readonly settlementLayers: SettlementEffectLayers
}) {
  const { resultBoard, onRetry, onFinish } = props
  if (!isOver) return null
  return (
    <MissionResultBoard
      isSuccess={isSuccess}
      effectLayers={settlementLayers}
      earnedGamePoint={resultBoard?.earnedGamePoint ?? 0}
      {...(resultBoard?.heldGamePoint === undefined ? {} : { heldGamePoint: resultBoard.heldGamePoint })}
      {...(resultBoard?.aceMatch === undefined ? {} : { aceMatch: resultBoard.aceMatch })}
      onExit={(exit) => {
        if (missionResultLeaveOf(exit, resultBoard?.aceMatch !== undefined) === '다시하기' && onRetry !== undefined) onRetry()
        else onFinish()
      }}
    />
  )
}

/**
 * 마우스 · 터치 길 — 투명한 누름 칸: 0xe 의 OK(화면 전체) · 도루(점수판 루 그림 자리) · '*' 메뉴("*MENU" 자리).
 * 결과 판(0x19)은 제 키(0x407f0)를 받아 여기 칸을 안 둔다.
 */
export function MissionPressAreas({
  isOver,
  isAwaitingConfirm,
  isMenuOpen,
  sceneConfirm,
  pressStar,
  stealableBases,
  stealIfFlying,
}: {
  readonly isOver: boolean
  readonly isAwaitingConfirm: boolean
  readonly isMenuOpen: boolean
  readonly sceneConfirm: SceneConfirm
  readonly pressStar: () => void
  readonly stealableBases: readonly StealBase[]
  readonly stealIfFlying: (base: StealBase, event?: Event) => void
}) {
  return (
    <>
      {isAwaitingConfirm && !isMenuOpen && (
        // 0xe — OK 하나만 받는다 (0x532b0)
        <PressArea label="확인" onPress={sceneConfirm.confirm} isDisabled={!sceneConfirm.acceptsConfirm} />
      )}
      {stealAreasOf(isOver || isAwaitingConfirm || isMenuOpen, stealableBases, stealIfFlying)}
      {!isOver && <PressArea label={isMenuOpen ? '닫기' : '메뉴'} rect={MENU_PRESS_RECT} onPress={pressStar} />}
    </>
  )
}

/**
 * 도루 누름 칸 — 사람 공격이고 앞길이 열린 주자가 있을 때 (`canStartSteal`). 목표에 도루가 없어도 키는 먹는다.
 * 끝난 미션 · 0xe 대기 · 메뉴 동안은 없다
 */
function stealAreasOf(isHidden: boolean, stealableBases: readonly StealBase[], stealIfFlying: (base: StealBase, event?: Event) => void) {
  if (isHidden || stealableBases.length === 0) return false
  return stealableBases.map((base) => (
    <PressArea key={base} label={`도루 ${base}루`} rect={stealPressRectOf(base)} onPress={(event) => stealIfFlying(base, event)} />
  ))
}
