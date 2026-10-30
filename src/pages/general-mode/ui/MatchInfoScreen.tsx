import type { ReactNode } from 'react'
import { PressArea, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { FOOTER_BITS } from '@/widgets/screen-frame/lib/screenFrameLayout'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import type { MatchInfoStadiumState } from '@/widgets/batting-stage/lib/renderScenery'
import { MATCH_INFO_LAYOUT, MATCH_INFO_PLAY_BALL_PRESS_RECT, matchInfoLogoPressRectOf, isPrepareBobOn } from '@/pages/general-mode/lib/prepareLayout'
import { generalModeMatchInfoLines } from '@/pages/general-mode/lib/matchInfoLines'
import type { CpuMatchInfo } from '@/pages/general-mode/lib/matchInfoLines'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'
import { IMG_TEXT_FRAME, SLT_FRAME, generalMatchInfoFooterOf, pressKey } from './matchInfoScreen/matchInfoFigure'
import { MatchInfoRows } from './matchInfoScreen/MatchInfoRows'
import { MatchInfoTeams } from './matchInfoScreen/MatchInfoTeams'
import { MatchInfoEntryBanners, useMatchInfoEntry } from './matchInfoScreen/otherSlices'
import { useMatchInfoKeys } from './matchInfoScreen/useMatchInfoKeys'

export interface MatchInfoScreenProps {
  readonly setup: GeneralModeSetup
  /** 빠른실행으로 들어왔는가 (메뉴+0x14c) — `*` 재선택이 이때만 나온다 */
  readonly isQuickStart?: boolean
  /** 경기진행 설정 창이 떠 있는가 (skin+0x2ba) — 바닥이 되돌아가기(4)만 남는다 */
  readonly isSettingsOpen?: boolean
  /**
   * 경기진행 설정 창 0x6042c — 그림 0x2e0c4 가 목록(4/5) 다음 **머리띠 0x54d95 앞**(2e124 → 2e1be)에 그린다.
   * 화면 판(240×320) 안에 그려야 해서 부르는 쪽이 창을 이 칸으로 넘긴다
   */
  readonly settingsWindow?: ReactNode
  /** `*` 재굴림이 도는 중인가 (skin+0xf4) — 그동안 키를 전부 버린다(0x312b6) */
  readonly isRespinning?: boolean
  /** 머리띠 G포인트 — 들고 있는 곳에서만 넘긴다 (팀 고르기 화면과 같은 규칙) */
  readonly gamePoint?: number
  /** OK/'5' — 경기 시작 (저장을 쓰고 경기 장면 0x104 로) */
  readonly onStart: () => void
  /** '0' — 경기진행 설정 창. **일반모드에서만** 열린다 (0x31432) */
  readonly onOpenSettings: () => void
  /** '*' — 빠른실행 결정사항 다시 굴리기 */
  readonly onRespin: () => void
  readonly onCancel: () => void
  /** '4'/왼 → 유저 팀(메뉴+0xec = 1) · '6'/오른 → CPU 팀(0) 엔트리 편집 상태 23 */
  readonly onOpenEntry?: (isUserTeam: boolean) => void
  /** 유저 팀 "선발" — 0x30f20 의 0↔k 뒤(엔트리 편집이 고쳤으면 그것)의 투수 0번 */
  readonly userStarterName?: string | null
  /** CPU 칸 — 0x30f20 이 세운 AI 팀의 선발·마선수 */
  readonly cpuMatchInfo?: CpuMatchInfo | null
  /**
   * 바탕 — 22 진입 0x314b0 의 무대를 0x5fd04 가 흐려 떠 둔 그림(그리기 0x2e0c4 의 `0x581dc(스킨, 0, 0)`). 없으면 바탕 없음
   */
  readonly stage?: MatchInfoStadiumState | null
  /**
   * 0x63b15 넷째 인자 — `[메뉴+0x28] ≠ 0x17`(이전 상태가 23 엔트리 편집이 아님, 0x2e0fa). 참이면 머리띠가 미끄러져 내려오는
   * 다섯 그림 동안 본문을 비우고, 파랑 배너 둘이 네 그림 동안 들어온 뒤 본문이 선다 (`pages/management/lib/matchInfoEntry`).
   * 23 에서 돌아오면 거짓 — 머리띠도 안 미끄러지고 본문이 곧바로 선다. 안 주면 거짓.
   * 갱신 0x311a8 은 맨 앞에서 [[0x1552cfc]+0xe4] == 0 이면 아무것도 안 한다(0x311b2) — 머리띠 · 배너 · 값 줄 펼침이 끝날 때까지 키를 안 받는다.
   */
  readonly isEntryAnimated?: boolean
}

/**
 * **경기정보** — 메인 메뉴 하위 상태 **22**, 공용 목록 `0x63b15` 의 **k = 4**
 * (진입 0x314b0 · 갱신 0x311a8 · 본문 0x64d30. P6 2a-6 좌표 확정 · R4 2d 값 확정).
 *
 * 다섯 줄(순위·승패·선발·마투수·마타자)을 유저(왼쪽 x 16)·CPU(오른쪽 x 144)로 두 벌 적는다.
 * **일반모드는 순위·승패가 늘 "-"** 다 — 저장 레코드를 아예 읽지 않는다.
 *
 * 키 (R4 3b):
 *   - OK → 경기 시작   ·   `0` → 경기진행 설정 (일반모드만)   ·   `*` → 빠른실행 재굴림
 *   - CLR → 빠른실행이면 모드 목록으로, 아니면 마선수(상태 21) 의 마타자 단계로
 *
 *   - '4'/왼 → 유저 팀 · '6'/오른 → CPU 팀(보기 전용) **엔트리 편집**(상태 23, 편집기 0x55864)
 */
/** 넘기지 않은 화면 표지는 거짓 */
function matchInfoFlagsOf(props: MatchInfoScreenProps) {
  return {
    isQuickStart: props.isQuickStart ?? false,
    isSettingsOpen: props.isSettingsOpen ?? false,
    isRespinning: props.isRespinning ?? false,
    isEntryAnimated: props.isEntryAnimated ?? false,
  }
}

export function MatchInfoScreen(props: MatchInfoScreenProps) {
  const { setup, onStart, onOpenSettings, onRespin, onCancel, onOpenEntry } = props
  const { isQuickStart, isSettingsOpen, isRespinning, isEntryAnimated } = matchInfoFlagsOf(props)
  const { phase, valueRows, areValueCellsHidden, isKeyReady } = useMatchInfoEntry(isEntryAnimated, isRespinning)
  const sltOrigins = useFrameOrigins(SLT_FRAME)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT_FRAME)
  const lines = generalModeMatchInfoLines(setup, props.userStarterName ?? null, props.cpuMatchInfo ?? null)
  useMatchInfoKeys({ isQuickStart, isRespinning, isSettingsOpen, onStart, onOpenSettings, onRespin, onCancel, onOpenEntry }, isKeyReady)

  // 공용 목록 깜빡 [sp+0xd4] — 꼬리표 2px · 화살 1px · 노랑 반원 (0x63b4a)
  const isBob = isPrepareBobOn(useUpdateCounter())

  return (
    <RawScreen>
      <MatchInfoStadiumBackdrop stage={props.stage ?? null} />
      {phase.kind === '배너' && <MatchInfoEntryBanners offset={phase.offset} testId="경기정보-배너" />}
      {phase.kind === '본문' && (
        <>
          <MatchInfoTeams setup={setup} isBob={isBob} sltOrigins={sltOrigins} imgTextOrigins={imgTextOrigins} />
          <MatchInfoRows
            lines={lines}
            valueRows={valueRows}
            areValueCellsHidden={areValueCellsHidden}
            isBob={isBob}
            imgTextOrigins={imgTextOrigins}
          />
        </>
      )}

      {/*
        원본에 없던 웹 단추 셋([경기 시작] · [0 경기설정] · [* 재선택])과 키 안내 글을 걷고 **투명 누름 칸**으로 —
        누르면 그 키를 보낸다(펼침 · 재굴림 중 막기도 키 처리 그대로). 가운데 PLAY BALL 공 = OK, 두 엠블럼 = ←/→ 엔트리,
        바닥띠 "0경기설정" · "#재선택" 표시 = 그 키. 설정 창이 떠 있으면 키가 모두 창으로 가므로 칸을 안 세운다
      */}
      {!isSettingsOpen && <MatchInfoPressAreas hasEntry={onOpenEntry !== undefined} />}

      {props.settingsWindow}

      {/* 머리띠(제목 12 "경기정보")·바닥띠 — 원본 공용 목록 k 4 도 이 둘을 얹는다 (P6 1-1 · 2a-6) */}
      {/* 바닥띠의 "되돌아가기" 가 원본 소프트키다 — 따로 두었던 버튼은 없앴다 (스테이지 (0,0) 에 떨어져 있었다) */}
      <ScreenFrame
        title="경기정보"
        gamePoint={props.gamePoint ?? 0}
        onBack={onCancel}
        footer={generalMatchInfoFooterOf(isQuickStart, isRespinning, isSettingsOpen)}
        slides={isEntryAnimated}
        footerPresses={{
          [FOOTER_BITS.gameSettings]: { label: '0 경기설정', onPress: () => pressKey('0') },
          [FOOTER_BITS.reselect]: { label: '* 재선택', onPress: () => pressKey('*') },
        }}
      />
    </RawScreen>
  )
}

/** 가운데 PLAY BALL 공 = OK, 두 엠블럼 = ←/→ 엔트리(손잡이가 있을 때만) — 누르면 그 키를 보낸다 */
function MatchInfoPressAreas({ hasEntry }: { readonly hasEntry: boolean }) {
  const { anchorA, anchorB } = MATCH_INFO_LAYOUT
  return (
    <>
      <PressArea label="경기 시작" rect={MATCH_INFO_PLAY_BALL_PRESS_RECT} onPress={() => pressKey('Enter')} />
      {hasEntry && (
        <>
          <PressArea label="PLAYER 엔트리" rect={matchInfoLogoPressRectOf(anchorA)} onPress={() => pressKey('ArrowLeft')} />
          <PressArea label="COM 엔트리" rect={matchInfoLogoPressRectOf(anchorB)} onPress={() => pressKey('ArrowRight')} />
        </>
      )}
    </>
  )
}
