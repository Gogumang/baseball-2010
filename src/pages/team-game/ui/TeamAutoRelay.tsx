import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { MessageBox } from '@/shared/ui'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { activeSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import type { TeamAutoRelay as TeamAutoRelayState, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { TeamRelayFigures } from '@/pages/team-game/ui/TeamRelayFigures'
import { AUTO_RELAY_SPEED_MAX, autoRelaySpeed } from '@/pages/team-game/model/autoRelaySpeed'
import { AutoPlayRelayScreen, DEFENSE_BACKGROUND_URL } from './teamAutoRelay/otherSlices'
import {
  AUTO_RELAY_BGM,
  AUTO_RELAY_STOP_QUESTION,
  CHANGE_IMAGE,
  GAME_POPUP_DIM_OPACITY,
  GAME_UI_FRAMES,
  IMG_TEXT_FRAMES,
  changeImagePosition,
  gameUiImageSrc,
  imageStyle,
} from './teamAutoRelay/relayLayout'
import { RelaySpeedPanel } from './teamAutoRelay/RelaySpeedPanel'
import { useRelayKeys } from './teamAutoRelay/useRelayKeys'
import { useRelayState } from './teamAutoRelay/useRelayState'
import { useRelayTick } from './teamAutoRelay/useRelayTick'

/** 진입 0x3abf0 — v ≠ 2 면 배경음 33 */
function useRelayEntryBgm(audio: SoundPort): void {
  useEffect(() => {
    if (autoRelaySpeed() !== AUTO_RELAY_SPEED_MAX) audio.playBgm(AUTO_RELAY_BGM)
  }, [audio])
}

interface TeamAutoRelayProps {
  readonly progress: TeamGameProgress
  /** 0xc2198 → 0xc262c 한 번 (`useTeamGame.actions.stepAutoRelay`) — null 이면 중계 끝 */
  readonly onStep: () => TeamAutoRelayState | null
  /** CLR 중단 질문에 예 (`stopAutoRelay`) */
  readonly onStop: () => void
  readonly sideTeams: readonly [number, number]
  readonly humanSide: 0 | 1
  /** 시즌 홈 경기 잔디 팔레트 — 배경(수비 운동장)을 그 벌로 칠한다 */
  readonly grassPalette?: number | null
  /**
   * 경기 중 메뉴 자동진행(0x3c8da → 0x21)으로 들어섰으면 그 타석의 0xd 진입 0x48d50 이 48e90 0x47cc8 로 실은 마선수 그림 —
   * 이 길은 0x47cc8 을 안 거친다(`teamRelayEntryFiguresOf`). 안 주면(0x18 → 0x21 길) 들어설 때 다시 싣는다.
   */
  readonly entryLoadedRunnerAce?: number | null
  /**
   * 기록 달성 알림 0x4e35c — 0x21 에도 프레임 0x52c50 이 53066 에서 그린다(0x17 말고는 늘). 중계 그리기(상태 그리기 표) 위,
   * CLR 질문 창(0x746cd) 아래 자리에 얹는다 (r297)
   */
  readonly recordAlert?: ReactNode
  /** CLR 중단 질문 창이 섰다 · 내렸다 — 창이 서 있는 동안 알림 폭 · 시간이 안 오른다(52cc6 → 0x4e35c 그리기만) */
  readonly onAskingChange?: (isAsking: boolean) => void
}

/**
 * **팀경기(모드 1 · 2 · 8 · 9) 자동진행 중계 — 경기 상태 0x21 을 틱마다 한 칸씩 굴린다** (2026-10-08 직접 뜸).
 *
 * 갱신 0x48480 (매 그림):
 * ```
 * 484a4  v = 전역 +0xbc; v ≠ 2 && 장면틱 % ((2 − v) × 4) ≠ 0 → 끝          ; 0 은 8틱 · 1 은 4틱마다
 * 484ea  sim+0x9c ≠ 0 → sim+0x9d −= 1; > 0 → 끝                            ; "CHANGE" 연출 대기
 * 4850c  r = 0xc2198(sim, 1) → 참이면 0xc262c, 거짓이면 +0x1784 = 0 · 상태 0x18 · 0x6e418 배경음 끔
 * ```
 그리기 0x4258c (2026-10-08 직접 다시 뜸):
 * - 모드 ∈ {1,2,8,9} **· v ≠ 2** (`[sp+0x5c]`, 42608~42620) 일 때만: 운동장 그림(주자 · 투수 · 포수 · 타자 — `TeamRelayFigures`).
 * - 모드 ∈ {1,2,8,9} 면 **v 를 안 보고**(42ab2 · 42bbe 는 모드만 본다): game_ui 프레임 92 (안내 띠) · 프레임 33 (효과 1, 0xc) ·
 *   img_text 프레임 386 · 깜빡이는(장면틱 % 8 ≤ 4) 좌우 화살표 그림 97(왼쪽은 효과 0x11 좌우 뒤집기) · 속도 세모 그림 97 세 개
 *   (효과 1, 6 으로 깐 위에 i ≤ v 만 효과 0 으로 한 번 더, 42e7c~42efa). 그래서 v = 2 에서도 속도 칸이 보여 ←/'4' 로 내릴 수 있다.
 * - 모드를 안 보고: sim+0x9d 를 **그림마다** 1 줄이고(42b30) 아직 > 0 이면 그림 93 "CHANGE" 를 가운데에.
 * - 배경은 그 앞 0x41230 이 깐다(`AutoPlayRelayScreen` — 투수판에 맞춘 수비 운동장).
 * 키 0x3e25c (sim[0] ≠ 0 · 모드 ∈ {1,2,8,9}): ←/'4' 속도 −1 · →/'6' 속도 +1 · CLR → StrGAME[6] 질문(코드 0x1e) → 예면 중단.
 * 진입 0x3abf0: 모드 ∈ {1,2,8,9} · v ≠ 2 면 배경음 33.
 *
 * **질문 창이 떠 있는 동안** (프레임 0x52c50, 2026-10-08 직접 뜸): 52cc6 `0x754f9(창, 키)` 가 [창+9] ≠ 0 이면 늘 1 이라 52ef2 로
 * 건너뛴다 — 장면 틱 0xbc9c8(52cd4) · 진입 · 키 0x498d4 · 갱신 0x48480 · 0xaada4 가 모두 안 돈다(펼침 · 닫힘 동안도). 그리기는
 * 52efe 가 `[+0x24f](경기 장면 1) && [창+9] && [+0x250] == 0` 이면 건너뛰는데, 창을 연 0x74ef4 가 +0x250 = 1 을 걸고 같은 그림 끝의
 * 창 그리기 0x746cc(53078)가 지운다 — 곧 CLR 을 받은 그림은 키(창 열기) → 갱신 → 그리기를 평소대로 마치고, 그 뒤 그림부터
 * 장면이 멈춘다(틱 · sim+0x9d · 깜빡임 그대로). 예/아니오가 다 닫힌 뒤 다음 그림부터 다시 돈다 — 예면 프레임 머리 52c9e 가
 * 닫히는 동안 sim+0xa0 = 0 · 0xc0ea8(sim, 1) 을 걸어 다음 갱신(속도 칸 · CHANGE 대기를 지나는)의 0xc2198 이 거짓이다.
 * ⚠️ CLR 그림의 갱신이 마침 중계를 끝내면(0x18) 원본은 창이 다음 장면 위에 남아 예 → sim+0x9f = 1 이 되지만, 웹은 중계 화면과
 * 함께 창이 내려간다(미이식).
 *
 */
export function TeamAutoRelay({
  progress,
  onStep,
  onStop,
  sideTeams,
  humanSide,
  grassPalette = null,
  entryLoadedRunnerAce,
  recordAlert = null,
  onAskingChange,
}: TeamAutoRelayProps) {
  const state = useRelayState(progress, entryLoadedRunnerAce, onAskingChange)
  const audio = activeSound()
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  /** 배경 운동장 — `AutoPlayRelayScreen` 과 같은 칠한 그림(같은 캐시) */
  const fieldUrl = useRecoloredSprite(DEFENSE_BACKGROUND_URL, grassPalette)
  useRelayEntryBgm(audio)
  const keyLatch = useRelayKeys(state)
  const onTick = useRelayTick(state, onStep, audio)
  const { speed, isAsking, setAsking } = state

  const overlay = (
    <>
      <RelaySpeedPanel
        speed={speed}
        sceneTick={state.sceneTick}
        isAsking={isAsking}
        gameUiOrigins={gameUiOrigins}
        textOrigins={textOrigins}
        fieldUrl={fieldUrl}
      />
      {state.isChangeShown && (
        <img
          alt="CHANGE"
          data-testid="중계-CHANGE"
          src={gameUiImageSrc(CHANGE_IMAGE)}
          style={imageStyle(changeImagePosition.x, changeImagePosition.y)}
        />
      )}
      {recordAlert}
      {isAsking && (
        <MessageBox
          text={AUTO_RELAY_STOP_QUESTION}
          dimOpacity={GAME_POPUP_DIM_OPACITY}
          // 경기 장면 [창+0x24f] = 1 → 답한 갱신에 폭 0 — 줄임 없이 다음 갱신에 닫힌다
          closesWithoutShrink
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            setAsking(false)
            if (index === 0) onStop()
          }}
        />
      )}
    </>
  )

  return (
    <AutoPlayRelayScreen
      step={state.shown}
      onTick={onTick}
      isPaused={isAsking}
      keyLatch={keyLatch}
      sideTeams={sideTeams}
      humanSide={humanSide}
      overlay={overlay}
      grassPalette={grassPalette}
      // 운동장 그림은 v ≠ 2 일 때만 (`[sp+0x5c]`)
      field={speed === AUTO_RELAY_SPEED_MAX ? null : <TeamRelayFigures figures={state.figures} />}
    />
  )
}
