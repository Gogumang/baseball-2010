import { useMemo } from 'react'
import { ORIGINAL_USER_EVENTS } from '@/shared/config/original/userEvents'
import type { EventPortrait } from '@/shared/config/original/eventTypes'
import { gameSceneTickNow, isGameSceneFrozen, setGameSceneTickInterval } from '@/shared/lib/commonWindow/commonWindow'
import { runSceneKeys, useSceneKeyLatchOwner } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { EventDialogueBox } from '@/pages/story/ui/EventDialogueBox'
import { EventPortraits } from '@/widgets/event-portraits/ui/EventPortraits'
import { PORTRAIT_HEIGHT } from '@/pages/story/ui/StoryScreen.css'
import * as styles from '@/pages/pitching/ui/ManagerHookWindow.css'

/** 0x861c0 — 0xbc964(dlg+0xa8, 0xd4c70) 가 글 버퍼 머리에 붙이는 화자 머리글(원본 마크업 그대로 — "감독님" 은 #00CC00) */
const SPEAKER_PREFIX = '[!c00CC00감독님!cFFFFFF] : '

/**
 * 0x86198 861b2 `0x7f54c(dlg, &{2, 0, 0, 3}, 1)` — 초상화 하나: 인물 2(감독, 애니 기준 0xd4774[2] = 16) · 바이트 1 = 0(오른쪽) ·
 * 표정 3 → event_char_0 애니 19 (0x63a04 — 10~13 · 17~22 말고는 event_char_0)
 */
const MANAGER_PORTRAIT: readonly EventPortrait[] = [{ file: 'event_char_0', animation: 16 + 3, side: 'right' }]

/** 0x7fbc4 끝 0x7fdfe — 셋째 인자(0x50828 은 1)가 서면 초상화 바닥 y = H − 0x44 */
const PORTRAIT_BASE_Y = 320 - 0x44

interface ManagerHookWindowProps {
  /** StrUSER_EVT 번호 — 체력 ≤20% 85~87 · 체력 0% 88~90 · 4실점 91~93 · 만루 94~96 */
  readonly userEventIndex: number
  /** 확인을 누르면 상태 0x21(자동진행)로 간다 */
  readonly onConfirm: () => void
}

/**
 * 강판 뒤 감독 대사 창 — 경기 상태 **0x23** (진입 0x50754 → 0x86198, 키 0x50794, 그리기 0x50828 · R14 3절).
 *
 * ```
 * 50754  [장면+0x19a8] 이 비었으면 대화창 객체 0x7b7b8(new 0x398) — 이벤트 재생기 대사 상자와 같은 창 클래스
 * 86198  0x7f54c(창, {2, 0, 0, 3}, 1) 초상화 · 글 버퍼 = "[!c00CC00감독님!cFFFFFF] : " + 0x1552af4(StrUSER_EVT 대사) ·
 *        +0xe4 = 1(say 갈래) · 0x7f7d4 · 0x7f7cc(높이 0 · 글 찍기 처음으로) · mode_ui 적재
 * 50828  그리기: 0x38d1c · 0x49e64 · 0x35b94 · 0xbe6a1(타석 공용 묶음 — HUD 0x4c4bc 없음) → 0x7fbc4(창, 0, 1, 0)
 *        = 상자 0x7fad0(높이 +15, 장식 없음 — 넷째 인자 0) · 글 0x6ef4c(3줄 한 쪽, 3 바이트씩) · 넘김 표시 · 초상화(바닥 H − 0x44)
 * 50794  키 −5 · '5' 만: 단계 1 → 2(그 쪽을 다 보인다) · 3 → 0x7f7f4(다음 쪽) · 4 → 0x7b871 · 0x86229 · 창 소멸 · 0xc1b48 · 0x21
 * ```
 * 상자 · 쪽 나누기 · 찍기는 이벤트 재생기와 같은 0x7fbc4 라 `EventDialogueBox`(`pages/story/lib/eventDialogue`)를 그대로 쓴다.
 * 찍기는 그리기 안에서 돈다 — 상자가 다 올라온 그 그림부터 3 바이트씩. 원본은 **확인 키 하나만** 받는다(좌우 · 취소 없음 — 강판을 못 무른다).
 * 키는 받은 다음 틀의 상태 키 자리(52da2 → 52e10)에서 그 틀의 그리기보다 먼저 돈다(r167). 공용 창이 서 있으면 52efe 가 상태 그리기를
 * 건너뛰어 상자 · 찍기도 선다(경기 장면 시계).
 * (r334 정정: 예전 웹은 CSS 글꼴 11px 한 덩이 글 · 쪽 나누기 없음 · 초상화 없음 · 상자가 다 오른 다음 틀부터 찍기로 근사했다.
 * R14 3-5 의 "얼굴 그림을 쓰지 않는다" 도 틀렸다 — 0x7f54c 로 감독 초상화를 싣는다)
 *
 * 스스로 강판(`#`)은 이 창을 거치지 않고 곧장 0x21 로 간다 (P1 2-2).
 */
export function ManagerHookWindow({ userEventIndex, onConfirm }: ManagerHookWindowProps) {
  const raw = SPEAKER_PREFIX + (ORIGINAL_USER_EVENTS[userEventIndex] ?? '')
  /** 받은 키 칸 — 키 0x50794 는 받은 다음 틀의 52da2~ 상태 키 자리(52e10)에서 그 틀의 그리기(0x7fbc4 — 높이 · 찍기)보다 먼저 돈다 */
  const keyLatch = useSceneKeyLatchOwner()
  const tickInterval = useMemo(
    () => (callback: () => void) =>
      setGameSceneTickInterval(() => {
        // 공용 창이 서 있으면 경기 장면 0x52c50 이 52cc6 에서 키를, 52efe 에서 상태 그리기를 건너뛴다 — 닫히면 이어 돈다
        if (isGameSceneFrozen()) {
          keyLatch.clear()
          return
        }
        runSceneKeys(keyLatch, gameSceneTickNow())
        callback()
      }),
    [keyLatch],
  )
  return (
    <div className={styles.overlay}>
      <EventDialogueBox raw={raw} slideIn showsOrnament={false} tickInterval={tickInterval}
        deferPress={(run) => keyLatch.push(run)} onAdvance={onConfirm} />
      {/* 0x7fbc4 끝 0x7fdee — 상자 · 글 · 넘김 표시 다음에 초상화 0x7f998 */}
      <div className={styles.portraitLayer} style={{ bottom: 320 - PORTRAIT_BASE_Y, height: PORTRAIT_HEIGHT }}>
        <EventPortraits portraits={MANAGER_PORTRAIT} height={PORTRAIT_HEIGHT} />
      </div>
    </div>
  )
}
