import { useEffect, useMemo, useState } from 'react'
import type { EventCommand } from '@/shared/config/original/eventTypes'
import { EventPortraits } from '@/widgets/event-portraits/ui/EventPortraits'
import { eventPortraitCastOf } from '@/pages/story/lib/eventPortraitCast'
import { useEventPlayback } from '@/pages/story/model/useEventPlayback'
import { isStepHeld, useScreenEffect } from '@/pages/story/model/useScreenEffect'
import type { ScreenEffectFrame } from '@/entities/story/model/screenEffect'
import { useEventSounds } from '@/pages/story/model/useEventSounds'
import * as styles from '@/pages/story/ui/StoryScreen.css'
import { SCREEN_HEIGHT } from '@/pages/story/lib/eventDialogue'
import { INITIAL_EVENT_BACKDROP, clearsDialogueBeforeMatch, drawEventBackdrop, portraitBaseYOf } from '@/pages/story/lib/eventBackdrop'
import type { EventBackdropFill, EventBackdropState } from '@/pages/story/lib/eventBackdrop'
import { useWholeScreenOffset } from '@/shared/lib/screenShake/useWholeScreenOffset'
import type { DialogueBoxContent, StoryScreenProps } from './storyScreen/storyScreenProps'
import { currentRewardOf, rewardNoticeOfContext, storyWindowTextOf } from './storyScreen/storyLines'
import type { ShownReward } from './storyScreen/storyLines'
import { useDialogueBoxContent } from './storyScreen/useDialogueBoxContent'
import { StoryDialogue } from './storyScreen/StoryDialogue'
import { rewardWindowsOf, systemWindowsOf, yesNoWindowOf } from './storyScreen/storyWindows'

/** 원작 이벤트. 대사마다 원본이 정한 인물·표정·자리로 초상화를 띄운다. */
export function StoryScreen(props: StoryScreenProps) {
  const { events, event, onComplete, onMatch, carried, yearGoalWindowOf, onSystemWindowConfirm } = props
  // 대본이 적어 둔 표정 전부 — 주인공 초상화의 표정 애니를 미리 칠한다(`eventPortraitCastOf`)
  const upcomingPortraits = useMemo(() => eventPortraitCastOf(events, event), [events, event])
  /** 막는 효과(id 4~7)를 다 기다린 걸음 — 그 걸음의 멈출 명령이 돈다 (0x8b564) */
  const [releasedKey, setReleasedKey] = useState<string | null>(null)
  const {
    step,
    isReleased,
    rewardNotice,
    portraits,
    next,
    skip,
    jump: jumpToEvent,
    clearPortraits,
    leftEventIds,
  } = useEventPlayback(
    events,
    event,
    onComplete,
    onMatch,
    carried,
    storyWindowTextOf(props.systemWindowTextOf, yearGoalWindowOf),
    (current) => isStepHeld(current, releasedKey),
    rewardNoticeOfContext(props.rewardNoticeContext),
    onSystemWindowConfirm,
    props.onReward,
  )
  // 0x8b5ac 의 효과 칠 — [mgr+0x2c4](마지막 명령 5 id) · [mgr+0x2c8](칠 색). 재생은 0x8a380 이 비운 값으로 시작한다
  const [backdrop, setBackdrop] = useState<EventBackdropState>(INITIAL_EVENT_BACKDROP)
  /** 0x7f7cc 로 상자 높이를 0 으로 내린 횟수 — 상자에 넘기는 열쇠 (첫 say 0x8d1f2 · 화면효과 6 · 7 의 '끝' 0x8b6d0~0x8b6ea) */
  const [lowerCount, setLowerCount] = useState(0)
  /**
   * 이벤트를 실은 횟수 — 재생 시작과 선택지 · 예아니오로 옮길 때마다 0x8be20 이 [mgr+0x2c0] = 0 으로 둔다.
   * 그 이벤트의 첫 say(0x8d1f2)만 상자를 내렸다 다시 올린다.
   */
  const [eventLoads, setEventLoads] = useState(0)
  /** 대사 상자 글 칸 — say · 선택지 명령이 돌 때 쓴다 (아래) */
  const [heldBox, setBox] = useState<DialogueBoxContent | null>(null)
  const jump = (eventId: number) => {
    setEventLoads((count) => count + 1)
    jumpToEvent(eventId)
  }
  // '끝'(+0x10 = 2) 그리기만 [mgr+0x2c8] 을 바꾸고, id 6 · 7 이면 글 · 초상화 · 상자를 처음으로 돌린다.
  // 처음으로 돌리는 것은 대사 상자 객체(0x7f7d4 · 0x7f7a8 · 0x7f7cc — 모두 [mgr+0xb4])뿐이다 — 공용 창 [0x140005c] 는 안 건드린다.
  // id 6 · 7 은 끝날 때까지 다음 명령을 막으므로(0x8b564) 이 돌리기는 늘 뒤 명령(대사 · 알림 · 예아니오 · 경기)보다 먼저다.
  const onEffectorEnd = (endedId: number, nextCommand: EventCommand | null) => {
    // 0x8d9c2 — 갱신이 먼저: id 6 바로 뒤가 경기 명령이면 초상화 · 높이 · 글 칸 셋을 비운다. 같은 틀의 '끝' 그리기는
    // 칸 0 이 비어 상자도 초상화도 안 그린다(0x7fbe0)
    if (clearsDialogueBeforeMatch(endedId, nextCommand)) setBox((held) => (held === null ? held : { ...held, slots: [] }))
    const ended = drawEventBackdrop({ effectId: endedId, fill: null }, '끝')
    setBackdrop((previous) => drawEventBackdrop({ ...previous, effectId: endedId }, '끝').state)
    if (!ended.resetsDialogue) return
    clearPortraits()
    setLowerCount((count) => count + 1)
  }
  // 명령 5 화면효과 — 흔들기 오프셋·덮개 (효과기 0xbd844)
  const screenEffect = useScreenEffect(step, props.isVibrationOn ?? true, onEffectorEnd, setReleasedKey)
  // 명령 6 소리 — 지나온 명령이 도는 틀에 (0x8d470)
  useEventSounds(step)
  const effect = screenEffect.frame
  useWholeScreenOffset(screenOffsetOf(effect))
  // 막는 효과를 기다리는 동안은 멈출 명령이 아직 돌지 않았다 — 앞 say 상자 · 초상화가 그대로다
  const command = isReleased ? step.command : null

  const effectId = screenEffect.lastEffectId ?? backdrop.effectId
  const passedEffectId = screenEffect.lastEffectId
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- [mgr+0x2c4] 는 레이아웃 단계의 '끝' 그리기(useScreenEffect → onEffectorEnd)가 먼저 적고 이 효과가 뒤에 적어야 원본 차례와 같다 — 렌더 중으로 옮기면 차례가 뒤집힌다
    if (passedEffectId !== null) setBackdrop((previous) => ({ ...previous, effectId: passedEffectId }))
  }, [passedEffectId, step])
  // '끝' 의 바뀐 색은 위에서 이미 들였으니 이 그리기는 '없음' 처럼 남은 색만 본다
  const backdropDraw = drawEventBackdrop({ effectId, fill: backdrop.fill }, screenEffect.phase === '끝' ? '없음' : screenEffect.phase)
  const portraitBaseY = portraitBaseYOf(props.isOverOutingMap ?? false, backdropDraw.isEffectFill)
  const commandKey = `${step.cursor.eventId}:${step.cursor.commandIndex}`
  const [box, selectedChoice, setSelectedChoice] = useDialogueBoxContent(step, isReleased, props, heldBox, setBox, eventLoads, setLowerCount)
  /**
   * 보상 창(알림 · 스킬) — 기다림 0x8daa0 은 답 0 · 0x14 를 받은 **그 갱신에** [mgr+8] = 1 로 다음 명령으로 넘긴다(스킬 창 키
   * 0x8e054 도 0x742a9 로 닫기 시작하며 같은 갱신에). 창은 닫힘 애니(240 → 120 → 60)를 마저 돌고 그동안 다음 명령이 겹쳐 돈다 —
   * 넘긴 뒤에도 다 닫힐 때까지 이 칸에 남겨 그린다. 다음 명령이 또 보상 창이면 공용 창이 새로 서므로 그쪽이 덮는다.
   */
  const [closingReward, setClosingReward] = useState<ShownReward | null>(null)
  const currentReward = currentRewardOf(command, rewardNotice, commandKey)
  /** 키를 받은 그 갱신 — 닫히는 창을 남겨 두고 다음 명령으로 (0x8daa0 · 0x8e054) */
  const answerReward = () => {
    if (currentReward === null) return
    setClosingReward(currentReward)
    next()
  }
  /** 다 닫혔다 — 남겨 둔 창을 걷는다 (새 보상 창이 섰으면 그것은 그대로) */
  const finishRewardWindow = (key: string) => setClosingReward((closing) => (closing?.key === key ? null : closing))
  /** system 창의 답 0 — 0x7fe90(목표 창 봤음 · 저장) 뒤 다음 명령 (창이 다 닫히면 0x8d91c 가 넘긴다) */
  const closeSystemWindow = () => {
    onSystemWindowConfirm?.()
    next()
  }

  return (
    // 흔들기(종류 9)는 그린 화면 버퍼를 통째로 옮긴다(0xba888) — 밑그림 · 이야기 판 · 창 모두 (`useWholeScreenOffset`)
    <div className={styles.overlay}>
      {backdropFillOf(backdropDraw.fill)}

      {/* 초상화 바닥 y — 0x7fbc4 끝 0x7fdee (외출 지도 · 효과 칠 252, 그 밖 135) */}
      <div className={styles.portraitLayer} data-testid="event-portrait-layer" style={{ bottom: SCREEN_HEIGHT - portraitBaseY }}>
        <EventPortraits
          portraits={portraits}
          height={styles.PORTRAIT_HEIGHT}
          skinIndex={props.skinIndex}
          battingTypeIndex={props.battingTypeIndex}
          upcomingPortraits={upcomingPortraits}
        />
      </div>

      {box !== null && (
        <StoryDialogue
          box={box}
          command={command}
          step={step}
          isReleased={isReleased}
          selectedChoice={selectedChoice}
          setSelectedChoice={setSelectedChoice}
          lowerCount={lowerCount}
          props={props}
          next={next}
          skip={skip}
          leftEventIds={leftEventIds}
          jump={jump}
        />
      )}

      {/*
        창(목표 창 · 알림 · 보상 · 예아니오)은 say 상자 **위**다 — 0x8b5ac 가 틀마다 0x7fbc4 로 앞 상자를 먼저 그리고 창은 그 뒤
        공용 창 그리기가 덮는다. 상자 판(zIndex 30) 위로 한 겹 올려, 뒤 어둡게가 상자까지 덮고 상자 누름 칸이 창 누름을 가로채지 않게 한다
      */}
      <div className={styles.windowLayer}>
        {systemWindowsOf(command, commandKey, yearGoalWindowOf, closeSystemWindow)}
        {rewardWindowsOf(currentReward ?? closingReward, answerReward, finishRewardWindow)}
        {yesNoWindowOf(command, commandKey, jump)}
      </div>

      {effectCoverOf(effect)}
    </div>
  )
}

/** 0x6a734 — 밑그림 위 · 상자와 초상화 아래에 화면 전체를 칠한다 ([mgr+0x2c8]) */
function backdropFillOf(fill: EventBackdropFill | null) {
  if (fill === null) return false
  return <div className={styles.backdropFill} data-testid="event-backdrop-fill" style={{ background: fill === '흰색' ? '#FFFFFF' : '#000000' }} />
}

/** 화면 전체 덮개 — 검정 덮기 (16 − 단계)/16 · 색 덮기 (단계 + 1)/16 (`screenEffect` 머리말) */
function effectCoverOf(effect: ScreenEffectFrame | null) {
  const overlay = effect?.overlay
  if (overlay == null) return false
  return (
    <div
      className={styles.effectCover}
      data-testid="screen-effect-cover"
      style={{ background: overlay.color === '흰색' ? '#FFFFFF' : '#000000', opacity: overlay.opacity }}
    />
  )
}

const screenOffsetOf = (effect: ScreenEffectFrame | null) => effect?.offset ?? null
