import { LayeredFrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { DefenseViewState } from '@/entities/fielding/model/defenseView/defenseViewState'
import * as styles from '@/pages/defense/ui/DefenseScreen.css'
import { ActorSprite } from './ActorSprite'
import { popupPointOf, type ScreenOf } from './defenseProjection'

/** 판정 글자 그림 (game_judge.pzx, 게임+0x101c) */
const JUDGE_FRAMES = assetUrl('./sprites/game_judge/frames')
/** 0x46844 의 큰 OUT 은 자리에서 60 위 (468e2 `subs r3, #0x3c`) */
const BIG_OUT_RAISE = 60
/** 0x46844 의 보통 판정 글자는 자리에서 30 위 (468c8 `subs r2, #0x1e`) */
const JUDGE_TEXT_RAISE = 30

/** 판정 글자 한 장 — 0x67 겹은 아래 수비 화면에 더한다 */
function JudgeTextSprite({ frame }: { readonly frame: number }) {
  const origins = useFrameOrigins(JUDGE_FRAMES)
  return <LayeredFrameSprite folder={JUDGE_FRAMES} frame={frame} origins={origins} x={0} y={0} />
}

/** 결과 판 0x46844 — 보통 판정 글자(0x393b4)를 (x + dx, y − 30 + dy) 에 */
export function DefenseJudgeText({ state, screenOf }: { readonly state: DefenseViewState; readonly screenOf: ScreenOf }) {
  const judgeText = state.judgeText ?? null
  if (judgeText === null) return null
  const point = popupPointOf(state, screenOf, judgeText.holderSlot)
  return (
    <div
      className={styles.actor}
      style={{ left: point.x + judgeText.dx, top: point.y - JUDGE_TEXT_RAISE + judgeText.dy }}
      data-testid="defense-judge-text"
      data-frame={judgeText.frame}
    >
      {/* 0x393b4 → 0xbe8a5 효과 [sp+8] = 0 (393f6) — 0xc9f98 이 파트 효과를 따른다: 애니 0 · 9 의 0x67 파트(칸 20 · 21 · 23 · 24 ·
        26 · 28 · 29)는 화면에 더한다(`LayeredFrameSprite` — plus-lighter) */}
      <JudgeTextSprite frame={judgeText.frame} />
    </div>
  )
}

/** 결과 판 0x46844 — 레이저 · 필살 포구 연출 뒤 아웃(코드 13)이면 game_judge 애니 2 "큰 OUT" 을 (x, y − 60) 에 */
export function DefenseBigOut({ state, screenOf }: { readonly state: DefenseViewState; readonly screenOf: ScreenOf }) {
  const bigOut = state.bigOut ?? null
  if (bigOut === null) return null
  const point = popupPointOf(state, screenOf, bigOut.holderSlot)
  return (
    <div className={styles.actor} style={{ left: point.x, top: point.y - BIG_OUT_RAISE }} data-testid="defense-big-out" data-frame={bigOut.frame}>
      <ActorSprite folder={JUDGE_FRAMES} frame={bigOut.frame} />
    </div>
  )
}
