import { useEffect, useRef, useState } from 'react'
import { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
import { SPEAKER_NAMES } from '@/shared/config/original/eventMeta'
import type { EventCommand, OriginalEvent } from '@/shared/config/original/eventTypes'
import type { EventReward } from '@/entities/story/model/eventReward'
import { EventPortraits } from '@/widgets/event-portraits/ui/EventPortraits'
import { useEventPlayback } from '@/pages/story/model/useEventPlayback'
import { isStepHeld, useScreenEffect } from '@/pages/story/model/useScreenEffect'
import type { MatchCommand, SystemCommand } from '@/pages/story/model/useEventPlayback'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import * as styles from '@/pages/story/ui/StoryScreen.css'
import { YearGoalWindow } from '@/pages/story/ui/YearGoalWindow'
import { EventDialogueBox } from '@/pages/story/ui/EventDialogueBox'
import { RewardSkillWindow } from '@/pages/story/ui/RewardSkillWindow'
import { rewardNoticeOf } from '@/entities/story/model/rewardNotice'
import type { RewardNoticeContext } from '@/entities/story/model/rewardNotice'
import { speakerPrefixOf } from '@/pages/story/lib/eventDialogue'
import { SYSTEM_YEAR_GOAL_WINDOW } from '@/pages/story/lib/yearGoalWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import { EVENT_WINDOW_DIM_OPACITY, SCREEN_HEIGHT } from '@/pages/story/lib/eventDialogue'
import {
  INITIAL_EVENT_BACKDROP, clearsDialogueBeforeMatch, drawEventBackdrop, portraitBaseYOf,
} from '@/pages/story/lib/eventBackdrop'
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

/**
 * 대사 상자 객체 [mgr+0xb4] 의 글 칸(+0xa8 + 0x14k) — 0x8b5ac 가 틀마다 0x7fbc4 로 그린다. say(0x8bab8)는 칸 0 에 글을 넣고
 * [창+0xe4] = 1, 선택지(0x8ba2c)는 칸 k 에 갈래 글을 넣고 [창+0xe4] = 갈래 수다. 다음 say · 선택지가 쓸 때까지 남는다 —
 * system 창 · 예아니오 · 화면효과 · 이벤트 옮기기(0x8be20)는 안 건드린다.
 */
interface DialogueBoxContent {
  /** 칸을 쓴 명령의 열쇠 — 바뀌면 글 찍기를 처음으로(0x7f7d5) */
  readonly key: string
  /** say 면 칸 0 하나, 선택지면 갈래 글 */
  readonly slots: readonly string[]
  readonly isChoice: boolean
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
  /**
   * 보상 명령 7 의 알림 맥락(모드 · 선수 · 난수 — `rewardNoticeContextOf`). 주면 보상마다 원본 알림 창(0x8beb8 글 → 0x74ef4
   * 종류 1, 첫 종류 4 면 스킬 창 0x741a0)을 띄우고 확인까지 기다린다(0x8daa0). 종류 11 은 그 자리에서 굴린다.
   * 안 주면 예전처럼 보상은 창 없이 지나간다.
   */
  readonly rewardNoticeContext?: () => RewardNoticeContext
  /**
   * **system 창을 답 0 으로 닫았다** — 기다림 0x8d91c(0x8d928~0x8d942)가 창 [창+0x21c] == 0 이면 0x7fe90(상자)을 부른다:
   * 나리면 선수 +0x1b7(올해의 목표 창을 봤다) · 시즌모드면 기록 +0x187 = 1, 그리고 저장 0x22755([0x1400054], 1).
   * system 창은 하위와 상관없이 모두다 — 알림(0 · 3 · 4 · 5, OK · CLR 모두 답 0)과 올해의 목표 창(1, OK · '5' 가 답 0).
   * 예아니오(0x8d954) · 보상(0x8daa0)은 안 부른다. 안 넘기면 아무 일도 없다.
   */
  readonly onSystemWindowConfirm?: () => void
}

/** 원작 이벤트. 대사마다 원본이 정한 인물·표정·자리로 초상화를 띄운다. */
export function StoryScreen({
  events, event, playerName, teamName, skinIndex, battingTypeIndex, onComplete, onMatch, carried, replacementsFor,
  systemWindowTextOf, yearGoalWindowOf, isVibrationOn = true, isSeasonMode = false, isOverOutingMap = false,
  rewardNoticeContext, onSystemWindowConfirm,
}: StoryScreenProps) {
  // 목표 창도 재생기가 멈추는 창이다 — 글 대신 빈 글로 세워 두고 아래에서 창을 그린다
  const windowTextOf = systemWindowTextOf === undefined && yearGoalWindowOf === undefined
    ? undefined
    : (command: SystemCommand) =>
      command.sub === SYSTEM_YEAR_GOAL_WINDOW && yearGoalWindowOf !== undefined ? '' : (systemWindowTextOf?.(command) ?? null)
  /** 막는 효과(id 4~7)를 다 기다린 걸음 — 그 걸음의 멈출 명령이 돈다 (0x8b564) */
  const [releasedKey, setReleasedKey] = useState<string | null>(null)
  const { step, isReleased, rewardNotice, portraits, next, skip, jump: jumpToEvent, clearPortraits } = useEventPlayback(
    events, event, onComplete, onMatch, carried, windowTextOf, (current) => isStepHeld(current, releasedKey),
    rewardNoticeContext === undefined ? undefined : (items, eventId) => rewardNoticeOf(items, eventId, rewardNoticeContext()),
    () => closeSystemWindow(),
  )
  // 0x8b5ac 의 효과 칠 — [mgr+0x2c4](마지막 명령 5 id) · [mgr+0x2c8](칠 색). 재생은 0x8a380 이 비운 값으로 시작한다
  const [backdrop, setBackdrop] = useState<EventBackdropState>(INITIAL_EVENT_BACKDROP)
  /** 0x7f7cc 로 상자 높이를 0 으로 내린 횟수 — 상자에 넘기는 열쇠 (첫 say 0x8d1f2 · 화면효과 6 · 7 의 '끝' 0x8b6d0~0x8b6ea) */
  const [lowerCount, setLowerCount] = useState(0)
  /**
   * 이벤트를 실은 횟수 — 재생 시작과 선택지 · 예아니오로 옮길 때마다 0x8be20 이 [mgr+0x2c0] = 0 으로 둔다.
   * 그 이벤트의 첫 say(0x8d1f2)만 상자를 내렸다 다시 올린다.
   */
  const eventLoadsRef = useRef(0)
  /** 대사 상자 글 칸 — say · 선택지 명령이 돌 때 쓴다 (아래) */
  const boxRef = useRef<DialogueBoxContent | null>(null)
  const jump = (eventId: number) => {
    eventLoadsRef.current += 1
    jumpToEvent(eventId)
  }
  // '끝'(+0x10 = 2) 그리기만 [mgr+0x2c8] 을 바꾸고, id 6 · 7 이면 글 · 초상화 · 상자를 처음으로 돌린다.
  // 처음으로 돌리는 것은 대사 상자 객체(0x7f7d4 · 0x7f7a8 · 0x7f7cc — 모두 [mgr+0xb4])뿐이다 — 공용 창 [0x140005c] 는 안 건드린다.
  // id 6 · 7 은 끝날 때까지 다음 명령을 막으므로(0x8b564) 이 돌리기는 늘 뒤 명령(대사 · 알림 · 예아니오 · 경기)보다 먼저다.
  const onEffectorEnd = (endedId: number, nextCommand: EventCommand | null) => {
    // 0x8d9c2 — 갱신이 먼저: id 6 바로 뒤가 경기 명령이면 초상화 · 높이 · 글 칸 셋을 비운다. 같은 틀의 '끝' 그리기는
    // 칸 0 이 비어 상자도 초상화도 안 그린다(0x7fbe0)
    if (clearsDialogueBeforeMatch(endedId, nextCommand) && boxRef.current !== null) {
      boxRef.current = { ...boxRef.current, slots: [] }
    }
    const ended = drawEventBackdrop({ effectId: endedId, fill: null }, '끝')
    setBackdrop((previous) => drawEventBackdrop({ ...previous, effectId: endedId }, '끝').state)
    if (!ended.resetsDialogue) return
    clearPortraits()
    setLowerCount((count) => count + 1)
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
  // say · 선택지 명령이 도는 틀 — 상자 글 칸을 쓴다. system · 예아니오는 대사 상자의 글을 건드리지 않는다 — 0x8b924 는 관리자
  // 버퍼 [mgr+0xba] 에 쓰고(say 글은 0x7b818 이 돌려주는 상자 쪽 글 0xbc965), 0x8b5ac 는 창이 떠 있는 동안에도 틀마다
  // 0x7fbc4 로 앞 상자를 그린다 — 선택지 뒤라면 선택지 줄과 고른 줄 테두리가 그대로 남는다.
  /** [mgr+0xb9] — 선택지가 돌 때 0, 위 · 아래로 바뀐다. 다음 say · 선택지가 돌 때까지 남는다 */
  const [selectedChoice, setSelectedChoice] = useState(0)
  /** 이 이벤트 실음에서 say 를 돌렸는가 ([mgr+0x2c0]) — 값은 그때의 `eventLoadsRef` */
  const saidInLoadRef = useRef<number | null>(null)
  const commandKey = `${step.cursor.eventId}:${step.cursor.commandIndex}`
  if ((command?.op === 'say' || command?.op === 'choice') && boxRef.current?.key !== commandKey) {
    if (command.op === 'say') {
      // 0x8d1f2 — 이 이벤트의 첫 say 면 0x7f7cc(높이 0) · [mgr+0x2c0] = 1, 그다음 0x8bab8 · 0x7f7d5
      if (saidInLoadRef.current !== eventLoadsRef.current) {
        saidInLoadRef.current = eventLoadsRef.current
        if (boxRef.current !== null) setLowerCount((count) => count + 1)
      }
      boxRef.current = { key: commandKey, slots: [`${speakerPrefixOf(speakerName)}${command.text}`], isChoice: false, replacements }
    } else {
      // 0x8d22c — 0x8ba2c(칸 k = 갈래 글, [mgr+0xb9] = 0) · 0x7f7d5 · [창+0xe4] = 갈래 수 · 0x7f54c(초상화)
      boxRef.current = { key: commandKey, slots: command.choices.map((choice) => choice.text), isChoice: true, replacements: [] }
      setSelectedChoice(0)
    }
  }
  // 경기 명령(0x8d8c4~0x8d8f0)과 재생 끝(0x8d1b6 → 0x8d4e2)은 초상화 · 상자 높이 · 글 칸 셋을 비운다 — 그 틀부터 상자를 안 그린다
  const isBoxCleared = isReleased && (step.command === null || step.command.op === 'match')
  const box = boxRef.current
  const isYearGoalWindow = command?.op === 'system' && command.sub === SYSTEM_YEAR_GOAL_WINDOW && yearGoalWindowOf !== undefined
  /**
   * 0x8cf64 명령 2(system) 하위 0(0x8b924) · 3(0x8b3bc) · 4(0x8b23c) · 5(0x8b1b8) 는 글을 [mgr+0xba] 에 채워 공용 창
   * 0x74ef4(…, 종류 1) 을 띄운다(0x8d404~0x8d414). 명령 3(예아니오, 0x8d426) 은 하위 0 일 때만 0x8b924 → 0x74ef4(…, 종류 2).
   * 창은 대사 상자 밖 — 화면 가운데 공용 판이다(`MessageBox`). 창이 닫히면(0x8d91c · 0x8d954 → [창+9] == 0 → 0x8dac2) 다음 명령.
   */
  const noticeText = command?.op === 'system' && !isYearGoalWindow ? (command.text ?? null) : null
  // 상자는 창 밑에도 남는다 — 키는 창 것이다(0x8b804 는 지금 명령이 say · 선택지일 때만 받는다)
  const isBoxActive = command?.op === 'say' || command?.op === 'choice'
  const choiceCommand = command?.op === 'choice' ? command : null
  /** system 창의 답 0 — 0x7fe90(목표 창 봤음 · 저장) 뒤 다음 명령 (창이 다 닫히면 0x8d91c 가 넘긴다) */
  const closeSystemWindow = () => {
    onSystemWindowConfirm?.()
    next()
  }

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

      {box !== null && (
        // 상자 객체는 재생 내내 하나다 — 재생은 늘 높이 0 에서 시작한다(앞 재생 끝 0x8d4e2 의 0x7f7cc · 글 칸 비우기)
        <EventDialogueBox raw={isBoxCleared ? '' : (box.slots[0] ?? '')} replacements={box.replacements}
          choices={box.isChoice ? { lines: box.slots, selected: selectedChoice } : null}
          textKey={box.key} lowerKey={lowerCount} slideIn
          onAdvance={next} isActive={isBoxActive}
          // 0x8b7b0 — say 중 취소는 다음 보상 · system · 선택지 · 예아니오 · 4 · 경기 명령까지 say · 효과 · 소리를 건너뛴다
          onCancel={command?.op === 'say' ? skip : undefined}
          onChoiceMove={setSelectedChoice}
          // 0x8b8b6 — [mgr+0x2bc] = [명령+0x24 + 2 × 고른 줄] · [mgr+8] = 1 → 다음 틀에 그 이벤트를 싣는다(0x8be20)
          onChoiceConfirm={(selected) => {
            const choice = choiceCommand?.choices[selected]
            if (choice !== undefined) jump(choice.gotoEvent)
          }} />
      )}

      {isYearGoalWindow && <YearGoalWindow values={yearGoalWindowOf()} onClose={closeSystemWindow} />}

      {noticeText !== null && (
        // 0x74ef4 종류 1 — 알림. CLR 도 0(0x751c2~0x751ec: 키 −16 → 0)
        <MessageBox key={`${step.cursor.eventId}:${step.cursor.commandIndex}`}
          text={noticeText} buttons={NOTICE_BUTTONS} dimOpacity={EVENT_WINDOW_DIM_OPACITY} onAnswer={closeSystemWindow} />
      )}

      {command?.op === 'reward' && rewardNotice?.kind === '알림' && (
        // 0x8d71c — 0xbbef8(글, 1, 1, 1) → 0x74ef4 종류 1. 기다림 0x8daa0 은 답 0(OK · CLR)이면 다음 명령
        <MessageBox key={`${step.cursor.eventId}:${step.cursor.commandIndex}`}
          text={rewardNotice.text} buttons={NOTICE_BUTTONS} dimOpacity={EVENT_WINDOW_DIM_OPACITY} onAnswer={next} />
      )}

      {command?.op === 'reward' && rewardNotice?.kind === '스킬' && (
        // 0x8d6bc — 첫 종류 4 는 스킬 창 0x741a0 (그리기 0x87108 · 키 0x8e054)
        <RewardSkillWindow key={`${step.cursor.eventId}:${step.cursor.commandIndex}`}
          text={rewardNotice.text} gained={rewardNotice.gained} onClose={next} />
      )}

      {command?.op === 'yesno' && (
        // 0x74ef4 종류 2 — 0x749d5 를 안 불러 처음 커서는 [예]. CLR 은 1 [아니오](0x7514a~0x75174: 키 −16 → 1).
        // 답 0 → [mgr+0x2bc] = 예 이벤트([명령+8]) · 1 → 아니오 이벤트([명령+0xa]) (0x8d954~0x8d9a2)
        <MessageBox key={`${step.cursor.eventId}:${step.cursor.commandIndex}`}
          text={command.text} buttons={YES_NO_BUTTONS} dimOpacity={EVENT_WINDOW_DIM_OPACITY}
          onAnswer={(answer) => jump(answer === 0 ? command.yesEvent : command.noEvent)} />
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
