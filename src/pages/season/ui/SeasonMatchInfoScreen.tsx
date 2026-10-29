import type { ReactNode } from 'react'
import { RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import type { PlayerSide } from '@/entities/game/model/gameState'
import {
  IMG_TEXT_FRAME,
  MatchInfoPhase,
  MatchInfoPressAreas,
  SLT_FRAME,
  isPrepareBobOn,
  pressKey,
  useMatchInfoEntry,
  type MatchInfoLine,
} from './seasonMatchInfoScreen/otherSlices'
import { useSeasonMatchInfoKeys } from './seasonMatchInfoScreen/useSeasonMatchInfoKeys'

export interface SeasonMatchInfoScreenProps {
  /** 다섯 줄 값 — `seasonMatchInfoLines` (0x5dcc0 시즌 갈래) */
  readonly lines: readonly MatchInfoLine[]
  /** rec+0 — 왼쪽(PLAYER) 엠블럼. 국가대항전이면 대한민국(10) */
  readonly myTeamId: number
  /** rec+4 — 오른쪽(COM) 엠블럼 */
  readonly opponentTeamId: number
  /** 사람이 맡는 측 — 선공 꼬리표 자리 */
  readonly playerSide: PlayerSide
  /** 머리띠 G포인트 (전역 +0x64) */
  readonly gamePoint?: number
  /** OK/'5' — 경기 시작 (0x847e → 0xe1) */
  readonly onStart: () => void
  /** '0' — 경기진행 설정 창 열고 닫기 (0x857a) */
  readonly onOpenSettings: () => void
  /** CLR — 국가대항전이면 0xf4, 아니면 0xd7 (0x844e) */
  readonly onCancel: () => void
  /** '4'/왼 → 유저 팀(true) · '6'/오른 → CPU 팀(false) 엔트리 편집 0xe0 (this+0x120) */
  readonly onOpenEntry?: (isUserTeam: boolean) => void
  /** 바탕 — 0xdd 진입 0x6548 의 무대를 0x5fd04 가 흐려 떠 둔 그림(공통 앞그림 0xb810 의 `0x581dc(스킨, 0, 0)`). 없으면 바탕 없음 */
  readonly stage?: MatchInfoStadiumState | null
  /** [skin+0x2ba] — 경기진행 설정 창이 열렸나. 바닥띠가 4 / 0x44 로 갈린다 (0xb3cc~0xb3da) */
  readonly isSettingsOpen?: boolean
  /** 경기진행 설정 창 0x6042c — 그림 0xb398 이 공용 목록 다음 **머리띠 0x54d94 앞**에 그린다(화면 판 안에 그려야 해서 이 칸으로 받는다) */
  readonly settingsWindow?: ReactNode
  /**
   * 0x63b15 넷째 인자 — `[장면+0x28] ≠ 0xe0`(이전 상태가 엔트리 편집 0xe0 이 아님, 0xb39a~0xb3a6). 참이면 머리띠가 미끄러져
   * 내려오는 다섯 그림 동안 본문을 비우고, 파랑 배너 둘이 네 그림 동안 들어온 뒤 본문이 선다(`pages/management/lib/matchInfoEntry`).
   * 0xe0 에서 돌아오면 거짓 — 머리띠도 안 미끄러진다. 안 주면 거짓.
   * 키 0x83cc 는 맨 앞에서 [[0x1552cfc]+0xe4] == 0 이면 아무것도 안 한다(0x83de) — 머리띠 · 배너 · 값 줄 펼침이 끝날 때까지 키를 안 받는다.
   */
  readonly isEntryAnimated?: boolean
}

/**
 * **시즌 경기정보 0xdd** — 그림 `0xb398` = 공용 목록 `0x63b15(skin, 0, **4**, …)` + 경기진행 설정 창
 * `0x6042c` + 머리띠 `0x54d95(skin, 5 "경기정보", 설정 창이 열렸으면 4 아니면 0x44)`.
 * 목록 k 4 는 일반모드 경기정보(메인 메뉴 상태 22)와 **같은 배치**라 그 좌표(`prepareLayout`)를 그대로 쓰고,
 * 값 줄만 시즌 갈래(`seasonMatchInfoLines`)다. 키는 `0x83cc` (`entities/season-mode/model/preGameFlow.ts`).
 *
 * 좌·우('4'/'6') 키는 **엔트리 편집 0xe0**(편집기 0x55864)으로 간다 — '4' 는 this+0x120 = 1 유저 팀,
 * '6' 은 0 CPU 팀(보기 전용).
 */
export function SeasonMatchInfoScreen({
  lines,
  myTeamId,
  opponentTeamId,
  playerSide,
  gamePoint = 0,
  onStart,
  onOpenSettings,
  onCancel,
  onOpenEntry,
  stage = null,
  isSettingsOpen = false,
  settingsWindow,
  isEntryAnimated = false,
}: SeasonMatchInfoScreenProps) {
  const { phase, valueRows, areValueCellsHidden, isKeyReady } = useMatchInfoEntry(isEntryAnimated)
  const sltOrigins = useFrameOrigins(SLT_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)

  useSeasonMatchInfoKeys({ isKeyReady, isSettingsOpen, onStart, onOpenSettings, onCancel, onOpenEntry })

  // 공용 목록 깜빡 [sp+0xd4] — 꼬리표 2px · 화살 1px · 노랑 반원 (0x63b4a)
  const isBob = isPrepareBobOn(useUpdateCounter())
  const board = { lines, myTeamId, opponentTeamId, playerSide, sltOrigins, imgTextOrigins, isBob, valueRows, areValueCellsHidden }

  return (
    <RawScreen>
      <MatchInfoStadiumBackdrop stage={stage} />
      <MatchInfoPhase phase={phase} {...board} testIdPrefix="시즌경기정보" />
      {/* 바닥띠 "0경기설정" 표시 = '0'. 설정 창이 떠 있으면 키가 창으로 가므로 공 · 엠블럼 칸을 안 세운다 */}
      {!isSettingsOpen && <MatchInfoPressAreas hasEntry={onOpenEntry !== undefined} />}
      {settingsWindow}
      {/* 머리띠(제목 12 "경기정보")·바닥띠 — 원본 공용 목록 k 4 도 이 둘을 얹는다 (P6 1-1 · 2a-6). 바닥띠의 "되돌아가기" 가 원본 소프트키다 */}
      {/* 바닥 = [skin+0x2ba](설정 창) ? 4 : 0x44 (0xb3cc~0xb3da) — 0x44 = "0경기설정"(깜박임) + 되돌아가기 · 4 = 되돌아가기만 */}
      <ScreenFrame
        title="경기정보"
        gamePoint={gamePoint}
        onBack={onCancel}
        footer={isSettingsOpen ? 0x4 : 0x44}
        slides={isEntryAnimated}
        footerPresses={{ [FOOTER_BITS.gameSettings]: { label: '0 경기설정', onPress: () => pressKey('0') } }}
      />
    </RawScreen>
  )
}
