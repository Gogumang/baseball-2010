import { useEffect, useRef, useState } from 'react'
import { MenuList } from '@/shared/ui'
import type { MenuItem } from '@/shared/ui'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
import { SPEAKER_NAMES } from '@/shared/config/original/eventMeta'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { EventReward } from '@/entities/story/model/eventReward'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { EventPortraits } from '@/widgets/event-portraits/ui/EventPortraits'
import { useEventPlayback } from '@/pages/story/model/useEventPlayback'
import { isStepHeld, useScreenEffect } from '@/pages/story/model/useScreenEffect'
import type { MatchCommand, SystemCommand } from '@/pages/story/model/useEventPlayback'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import * as styles from '@/pages/story/ui/StoryScreen.css'
import { YearGoalWindow } from '@/pages/story/ui/YearGoalWindow'
import { EventDialogueBox } from '@/pages/story/ui/EventDialogueBox'
import { speakerPrefixOf } from '@/pages/story/lib/eventDialogue'
import { SYSTEM_YEAR_GOAL_WINDOW } from '@/pages/story/lib/yearGoalWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { SCREEN_HEIGHT } from '@/pages/story/lib/eventDialogue'
import { INITIAL_EVENT_BACKDROP, drawEventBackdrop, portraitBaseYOf } from '@/pages/story/lib/eventBackdrop'
import type { EventBackdropState } from '@/pages/story/lib/eventBackdrop'

/** 화자 번호 1 은 플레이어 이름으로 바꾼다. */
const PLAYER_SPEAKER = 1
/** 대사 fmt 9 는 %s 자리에 팀 이름을 넣는다 (그 밖에는 선수 이름). */
const TEAM_NAME_FORMAT = 9

/**
 * 공용 알림 · 질문 창 0x74ef4(창 [0x140005c], 글 [mgr+0xba], 종류, 0, 0, 0) 의 버튼 — 화면에는 `ui/popup.pzx` 그림이 나간다.
 * 종류 1(알림)은 프레임 0 "OK" 하나 · 종류 2(예아니오)는 1 "예" · 2 "아니오"(0x750f8~0x75140).
 */
const NOTICE_BUTTONS = ['OK'] as const
const YES_NO_BUTTONS = ['예', '아니오'] as const

/** 0x8b5ac 가 틀마다 0x7fbc4 로 그리는 마지막 say — 대사 상자 객체의 글([dlg+0xa8])은 다음 say · 선택지가 쓸 때까지 남는다 */
interface ShownSay {
  readonly key: string
  readonly raw: string
  readonly replacements: readonly string[]
}

interface StoryScreenProps {
  readonly events: readonly OriginalEvent[]
  readonly event: OriginalEvent
  readonly playerName: string
  readonly teamName: string
  /** 주인공 초상화 팔레트 — 피부 0 황인 · 1 백인 · 2 흑인 (event_char_0.mpl, C-1) */
  readonly skinIndex?: number
  /** 0 타격형 · 1 장타형. 장타형이면 초상화 애니가 **+8** 이다 (V2 정정) */
  readonly battingTypeIndex?: number
  readonly onComplete: (rewards: readonly EventReward[], viewedEventIds: readonly number[]) => void
  /** 경기 명령 — 마선수 대결로 나간다 */
  readonly onMatch: (command: MatchCommand, carry: StoryCarry) => void
  /** 대결에서 돌아온 결과 이벤트라면 앞 이벤트가 모은 보상·기록 */
  readonly carried?: StoryCarry
  /**
   * 이벤트 번호별 `%s` 자리 글 — 원본이 그 이벤트에만 따로 서식을 쓰는 곳 (380 연봉 제시액 0x8bc4c).
   * undefined 를 돌려주면 기본(이름·팀). 안 넘기면 늘 기본이다.
   */
  readonly replacementsFor?: (eventId: number) => readonly string[] | undefined
  /**
   * system 3·4 — 타이틀(0x8b3bc)·MVP(0x8b23c) 발표 창의 글. null 이면 그 명령은 예전처럼 지나간다.
   * 나만의리그 두 편이 시상 판정으로 채운다 (`pages/story/lib/awardWindows`).
   */
  readonly systemWindowTextOf?: (command: SystemCommand) => string | null
  /**
   * system 1 — **올해의 목표 창**(0x8d304 → 0x741a1 · 그리기 0x86fdc)의 값. 연초 115 · 392 가 연다.
   * 창을 그릴 때 부른다(원본도 틀마다 커리어를 읽어 그린다). 안 넘기면 그 명령은 예전처럼 지나간다.
   */
  readonly yearGoalWindowOf?: () => YearGoalWindowSource
  /**
   * 환경설정 진동(저장 +0x3b) — 명령 5 화면효과 1·2 의 500ms 진동(0x3a44)이 이 칸을 본다.
   * 안 넘기면 켠 것으로 본다(원본 기본값 켬).
   */
  readonly isVibrationOn?: boolean
  /**
   * 시즌모드(0x7b999) — 말하는 이 1(선수)의 이름 머리말을 안 붙인다(0x8bab8 의 0x8bafe: 시즌이면 빈 이름).
   */
  readonly isSeasonMode?: boolean
  /**
   * 장면 [gfx+0x174] 이 0x70 · 0x71 — 외출 지도(112) · 장소(113) · 대결결과(140, 진입 0x10df8 이 0x7e84c(gfx, 0x70)) 뒤에 뜬 이벤트.
   * 대화창 0x8b5ac 가 밑그림으로 지도를 깔고, 초상화 바닥 y 가 H − 0x44 = 252 다(0x7fdee). 그 밖(관리 · 연초 · 시즌 …)은 135.
   * 안 넘기면 거짓.
   */
  readonly isOverOutingMap?: boolean
}

/** 원작 이벤트. 대사마다 원본이 정한 인물·표정·자리로 초상화를 띄운다. */
export function StoryScreen({
  events, event, playerName, teamName, skinIndex, battingTypeIndex, onComplete, onMatch, carried, replacementsFor,
  systemWindowTextOf, yearGoalWindowOf, isVibrationOn = true, isSeasonMode = false, isOverOutingMap = false,
}: StoryScreenProps) {
  // 목표 창도 재생기가 멈추는 창이다 — 글 대신 빈 글로 세워 두고 아래에서 창을 그린다
  const windowTextOf = systemWindowTextOf === undefined && yearGoalWindowOf === undefined
    ? undefined
    : (command: SystemCommand) =>
      command.sub === SYSTEM_YEAR_GOAL_WINDOW && yearGoalWindowOf !== undefined ? '' : (systemWindowTextOf?.(command) ?? null)
  /** 막는 효과(id 4~7)를 다 기다린 걸음 — 그 걸음의 멈출 명령이 돈다 (0x8b564) */
  const [releasedKey, setReleasedKey] = useState<string | null>(null)
  const { step, isReleased, portraits, next, jump, clearPortraits } = useEventPlayback(
    events, event, onComplete, onMatch, carried, windowTextOf, (current) => isStepHeld(current, releasedKey),
  )
  // 0x8b5ac 의 효과 칠 — [mgr+0x2c4](마지막 명령 5 id) · [mgr+0x2c8](칠 색). 재생은 0x8a380 이 비운 값으로 시작한다
  const [backdrop, setBackdrop] = useState<EventBackdropState>(INITIAL_EVENT_BACKDROP)
  /** 0x8b6d0~0x8b6ea 로 글 · 상자를 처음으로 돌린 횟수 — 상자를 새로 세우는 열쇠 */
  const [dialogueResets, setDialogueResets] = useState(0)
  /** 0x7f7cc 로 상자 높이가 0 이 된 뒤 아직 say 상자가 오르지 않았는가 */
  const isRisePendingRef = useRef(false)
  // '끝'(+0x10 = 2) 그리기만 [mgr+0x2c8] 을 바꾸고, id 6 · 7 이면 글 · 초상화 · 상자를 처음으로 돌린다.
  // 처음으로 돌리는 것은 대사 상자 객체(0x7f7d4 · 0x7f7a8 · 0x7f7cc — 모두 [mgr+0xb4])뿐이다 — 공용 창 [0x140005c] 는 안 건드린다.
  // id 6 · 7 은 끝날 때까지 다음 명령을 막으므로(0x8b564) 이 돌리기는 늘 뒤 명령(대사 · 알림 · 예아니오 · 경기)보다 먼저다.
  const onEffectorEnd = (endedId: number) => {
    const ended = drawEventBackdrop({ effectId: endedId, fill: null }, '끝')
    setBackdrop((previous) => drawEventBackdrop({ ...previous, effectId: endedId }, '끝').state)
    if (!ended.resetsDialogue) return
    clearPortraits()
    isRisePendingRef.current = true
    setDialogueResets((count) => count + 1)
  }
  // 명령 5 화면효과 — 흔들기 오프셋·덮개 (효과기 0xbd844)
  const screenEffect = useScreenEffect(step, isVibrationOn, onEffectorEnd, setReleasedKey)
  const effect = screenEffect.frame
  // 막는 효과를 기다리는 동안은 멈출 명령이 아직 돌지 않았다 — 앞 say 상자 · 초상화가 그대로다
  const command = isReleased ? step.command : null

  const effectId = screenEffect.lastEffectId ?? backdrop.effectId
  const passedEffectId = screenEffect.lastEffectId
  useEffect(() => {
    if (passedEffectId !== null) setBackdrop((previous) => ({ ...previous, effectId: passedEffectId }))
  }, [passedEffectId, step])
  // '끝' 의 바뀐 색은 위에서 이미 들였으니 이 그리기는 '없음' 처럼 남은 색만 본다
  const backdropDraw = drawEventBackdrop(
    { effectId, fill: backdrop.fill }, screenEffect.phase === '끝' ? '없음' : screenEffect.phase,
  )
  const portraitBaseY = portraitBaseYOf(isOverOutingMap, backdropDraw.isEffectFill)

  // 0x8bab8 — 말하는 이 [명령+0x20]: 1 은 선수 이름(시즌모드면 빈 머리말) · 2~24 는 StrMODE[말하는 이 + 91] · 그 밖 없음
  const speakerName =
    command?.op !== 'say' || command.speaker === 0
      ? null
      : command.speaker === PLAYER_SPEAKER
        ? (isSeasonMode ? null : playerName)
        : (SPEAKER_NAMES[command.speaker] ?? null)
  const replacements =
    replacementsFor?.(step.cursor.eventId) ??
    (command?.op === 'say' && command.format === TEAM_NAME_FORMAT ? [teamName] : [playerName, teamName])
  /** 이 재생에서 say 를 이미 그렸는가 — 첫 say 만 상자가 올라온다 (114 진입 0x8be20 이 [mgr+0x2c0] = 0, 0x8d1f2 가 1) */
  const hasShownSayRef = useRef(false)
  const isFirstSay = command?.op === 'say' && !hasShownSayRef.current
  const isSayRising = isFirstSay || (command?.op === 'say' && isRisePendingRef.current)
  // system · 예아니오는 대사 상자의 글을 건드리지 않는다 — 0x8b924 는 관리자 버퍼 [mgr+0xba] 에 쓰고(say 글은 0x7b818 이
  // 돌려주는 상자 쪽 글 0xbc965), 0x8b5ac 는 창이 떠 있는 동안에도 틀마다 0x7fbc4 로 앞 say 상자를 그린다.
  const lastSayRef = useRef<ShownSay | null>(null)
  if (command?.op === 'say') {
    lastSayRef.current = {
      key: `${step.cursor.eventId}:${step.cursor.commandIndex}`,
      raw: `${speakerPrefixOf(speakerName)}${command.text}`,
      replacements,
    }
  }
  // 선택지(0x8d22c)는 0x8ba2c 로 상자 글을 선택지 줄로 바꾼다 — 웹은 선택지를 따로 그리므로 앞 say 를 잊는다.
  // ⚠️ 미해결: 선택지 뒤 say 없이 창이 뜨면 원본은 상자에 선택지 줄을 남긴다 — 원본 데이터에는 그런 차례가 없다.
  if (command?.op === 'choice') lastSayRef.current = null
  useEffect(() => {
    if (command?.op !== 'say') return
    hasShownSayRef.current = true
    isRisePendingRef.current = false
  }, [command, dialogueResets])

  const menu: MenuItem[] | null =
    command?.op === 'choice'
      ? command.choices.map((choice) => ({ id: String(choice.gotoEvent), label: stripGameMarkup(choice.text) }))
      : null
  const isYearGoalWindow = command?.op === 'system' && command.sub === SYSTEM_YEAR_GOAL_WINDOW && yearGoalWindowOf !== undefined
  /**
   * 0x8cf64 명령 2(system) 하위 0(0x8b924) · 3(0x8b3bc) · 4(0x8b23c) · 5(0x8b1b8) 는 글을 [mgr+0xba] 에 채워 공용 창
   * 0x74ef4(…, 종류 1) 을 띄운다(0x8d404~0x8d414). 명령 3(예아니오, 0x8d426) 은 하위 0 일 때만 0x8b924 → 0x74ef4(…, 종류 2).
   * 창은 대사 상자 밖 — 화면 가운데 공용 판이다(`MessageBox`). 창이 닫히면(0x8d91c · 0x8d954 → [창+9] == 0 → 0x8dac2) 다음 명령.
   */
  const noticeText = command?.op === 'system' && !isYearGoalWindow ? (command.text ?? null) : null
  // 앞 say 상자는 창 밑에 남는다 — 키는 창 것이다(0x8b804 는 지금 명령이 say · 선택지일 때만 받는다)
  const shownSay = !isReleased ||
    command?.op === 'say' || command?.op === 'yesno' || noticeText !== null || isYearGoalWindow ? lastSayRef.current : null

  return (
    <div className={styles.overlay}
      // 흔들기(종류 9)는 원본이 화면 전체 그리기 원점을 옮긴다(0xba888) — 웹은 이 이야기 판만 옮긴다 (근사)
      style={effect === null || (effect.offset.x === 0 && effect.offset.y === 0)
        ? undefined
        : { transform: `translate(${effect.offset.x}px, ${effect.offset.y}px)` }}>
      {backdropDraw.fill !== null && (
        // 0x6a734 — 밑그림 위 · 상자와 초상화 아래에 화면 전체를 칠한다 ([mgr+0x2c8])
        <div className={styles.backdropFill} data-testid="event-backdrop-fill"
          style={{ background: backdropDraw.fill === '흰색' ? '#FFFFFF' : '#000000' }} />
      )}

      {/* 초상화 바닥 y — 0x7fbc4 끝 0x7fdee (외출 지도 · 효과 칠 252, 그 밖 135) */}
      <div className={styles.portraitLayer} data-testid="event-portrait-layer"
        style={{ bottom: SCREEN_HEIGHT - portraitBaseY }}>
        <EventPortraits portraits={portraits} height={styles.PORTRAIT_HEIGHT}
          skinIndex={skinIndex} battingTypeIndex={battingTypeIndex} />
      </div>

      {shownSay !== null && (
        <EventDialogueBox key={`${shownSay.key}:${dialogueResets}`}
          raw={shownSay.raw} replacements={shownSay.replacements}
          // 0x7f7cc 로 높이 0 이 된 상자는 창 밑이든 다음 say 든 다시 오른다
          slideIn={isSayRising || isRisePendingRef.current} onAdvance={next} isActive={command?.op === 'say'} />
      )}

      {isYearGoalWindow && <YearGoalWindow values={yearGoalWindowOf()} onClose={next} />}

      {noticeText !== null && (
        // 0x74ef4 종류 1 — 알림. CLR 도 0(0x751c2~0x751ec: 키 −16 → 0)
        <MessageBox key={`${step.cursor.eventId}:${step.cursor.commandIndex}`}
          text={noticeText} buttons={NOTICE_BUTTONS} onAnswer={next} />
      )}

      {command?.op === 'yesno' && (
        // 0x74ef4 종류 2 — 0x749d5 를 안 불러 처음 커서는 [예]. CLR 은 1 [아니오](0x7514a~0x75174: 키 −16 → 1).
        // 답 0 → [mgr+0x2bc] = 예 이벤트([명령+8]) · 1 → 아니오 이벤트([명령+0xa]) (0x8d954~0x8d9a2)
        <MessageBox key={`${step.cursor.eventId}:${step.cursor.commandIndex}`}
          text={command.text} buttons={YES_NO_BUTTONS}
          onAnswer={(answer) => jump(answer === 0 ? command.yesEvent : command.noEvent)} />
      )}

      {menu !== null && (
        // 원본 선택지는 대사 창 안 글줄이라 화살표·판이 없고 고른 줄만 노랑이다 (0x7fd22, R14 3-4)
        <MenuList items={menu} cursorStyle="선택지" onSelect={(id) => jump(Number(id))} />
      )}

      {effect?.overlay != null && (
        // 화면 전체 덮개 — 검정 덮기 (16 − 단계)/16 · 색 덮기 (단계 + 1)/16 (`screenEffect` 머리말)
        <div className={styles.effectCover} data-testid="screen-effect-cover"
          style={{
            background: effect.overlay.color === '흰색' ? '#FFFFFF' : '#000000',
            opacity: effect.overlay.opacity,
          }} />
      )}
    </div>
  )
}
