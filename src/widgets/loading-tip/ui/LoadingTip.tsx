import { useEffect, useRef, useState } from 'react'
import { MarkupText } from '@/shared/ui'
import { useAnimations, useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { animationStepAt } from '@/shared/lib/sprite/animationPlayback'
import { gameSceneTickNow, gameSceneTickOf, gameSceneTimeOf, useMarksGameScene, useMarksGameSceneLoading } from '@/shared/lib/commonWindow/commonWindow'
import { isSceneFastForward } from '@/shared/lib/scenePeek/scenePeek'
import { preloadSpriteScene, preloadSprites } from '@/shared/lib/sprite/scenePreload'
import type { SpriteSceneKey } from '@/shared/lib/sprite/scenePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import * as styles from '@/widgets/loading-tip/ui/LoadingTip.css'
import {
  LOADING_BAR, LOADING_FILL_STRIPES, loadingFillWidthOf, loadingRunnerAnchorOf, tipNumberGlyphsOf,
} from '@/widgets/loading-tip/lib/loadingTipLayout'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const rgbOf = ([red, green, blue]: readonly number[]) => `rgb(${red}, ${green}, ${blue})`

/**
 * 원작 로딩 화면 — ui/loadingbar.pzx. 배치는 그리기 0x53e04 그대로다(`lib/loadingTipLayout` 머리말, r120 직접 떴다):
 * 바탕 RGB(0x11, 0x20, 0x7f) · 프레임 0 상자를 화면 가운데((W − 170) >> 1, (H − 147) >> 1) = (35, 86) ·
 * "TIP:" 옆 팁 번호(num 90 + 숫자) · 팁 글 (10, 30) 폭 150 · 진행 막대 (10, 112) 150×10 · 막대 채움 끝에 달리는 선수(애니 0).
 *
 * **진행 칸** (0x1552cfc 객체, 2026-10-16 직접 떴다): 진입 0x39f88 이 0x54120(+0x14 = 끝, +0x10 = 0)으로 끝을 **0x24**, 모드
 * (+0x1104) == 4(나리 타자편)면 **0x25** 로 둔다(39f92~39f98). 적재 한 단계마다 0x54128(+0x10 = min(+0x10 + 1, 끝)) → 0x53e04 가
 * 판을 다시 그리고, 막대는 끝 − 지금 칸만큼 줄여 그린다(53f9c~53fc6: 폭 / 끝 · (끝 − 지금)). 상태 8 끝(48b04~48b12)은 모드 4 면 한 칸 더,
 * 아니면 0x5413c(지금 = 끝)로 막대를 다 채운다 → 막대는 1/끝 부터 끝/끝 까지 오른다(`LOADING_STEPS_*`).
 *
 * **그림 수**: 상태 7 갱신 0x3e340 · 9 갱신 0x3f584 는 출구가 하나라 한 그림에 적재를 다 하고 다음 상태를 예약한다(3efe6 · 3fa5e).
 * 상태 8 갱신 0x48658 은 상태 틱 [+0x2c] 0 · 1 두 그림에 나눠 싣고(48666~487d6) 틱 1 끝에서 다음을 예약한다(48b38) → 원본 경기
 * 틀로는 **네 그림**(7 · 9 · 8 · 8)이고, 그 사이 동기 적재마다 막대가 한 칸씩 다시 그려진다.
 * ⚠️ 근사(시간)(남김 — 단말 몫 · 바이너리 밖): 판이 떠 있는 실제 길이는 단말의 적재 시간이다(틀 수가 아니다). 웹은 적재가 비동기라 막대 한 칸을 한 그림으로 센다 —
 * 칸 수(끝 값)만 원본이다.
 *
 * **경기 장면 0x104 의 상태 7 · 9 · 8 이다** (2026-10-16 직접 떴다): 진입 표 0xd04bc[0](상태 7) → 0x52cf8 → 진입 0x39f88 이 판을 싣고,
 * 상태 7 갱신 0x3e340 · 9 0x3f584 · 8 0x48658 이 적재 한 단계마다 0x54128 → 0x53e04 로 판을 다시 그린다. 셋 다 경기 장면 프레임
 * 0x52c50 의 52cc6 게이트 **뒤**(진입 표 52cee · 갱신 표 0xd0530)라 공용 창이 서 있으면 적재 · 판 그리기가 같이 선다. 상태 7~9 는
 * 0x41230 을 안 부르고(52f28~52f32), 그리기 표 0xd05a0 은 상태 9 만 0x3e328(= 판 그리기 0x53e04)이다 — 이것도 52efe 게이트 안이다. 그래서 이 판도 경기 장면으로 센다(`useMarksGameScene` — 창이 줄임
 * 없이 닫히고 [창+0x24f]) 진행은 경기 장면 시계로 잰다. 쓰는 곳은 나리 타자편 · 팀 경기(일반 · 시즌 · 대전) · 나리 투수편 · 미션 · 더비다(시즌 0x105 의 0x75fc 판은 웹에 없다).
 */
const FOLDER = assetUrl('./sprites/loadingbar/frames')
const NUM_FOLDER = assetUrl('./sprites/num')
const RUNNER_ANIMATION = 0
/** 진행 칸 끝 — 0x39f88 의 0x24 (모드 4 가 아닌 모든 경기 장면: 팀 경기 일반 · 시즌 · 대전 · 나리 투수편 · 미션 · 마선수 대결 · 홈런더비) */
export const LOADING_STEPS_DEFAULT = 0x24
/** 진행 칸 끝 — 0x39f88 39f94~39f98: 모드 4(나리 타자편)면 0x25 */
export const LOADING_STEPS_BATTER_CAREER = 0x25

/** 로딩 판 뒤에 열릴 경기 장면 — 타석 진입·진행 그림 */
const GAME_SCENE_PRELOADS: readonly SpriteSceneKey[] = ['gameEntry', 'gameAtBat']

interface LoadingTipProps {
  readonly tip: string
  readonly onDone: () => void
  /** 진행 칸 끝 [+0x14] — `LOADING_STEPS_DEFAULT`(0x24) · 나리 타자편 `LOADING_STEPS_BATTER_CAREER`(0x25) */
  readonly steps?: number
  /**
   * 로딩 판이 떠 있는 동안 미리 받을 장면 그림. **기다리지 않는다** — 판 길이(진행 칸 수)는 그대로이고,
   * 덜 받았으면 장면에서 예전처럼 늦게 뜬다.
   */
  readonly preloadScenes?: readonly SpriteSceneKey[]
  /**
   * 장면 그림 뒤에 이어 받을 계산 목록 — 이 경기 두 팀의 선수 그림(마선수 · 사람 선수 장비 · 몸통 폼, `app/model/gameSpritePreload`).
   * 역시 기다리지 않는다.
   */
  readonly preloadRequests?: readonly SpriteFolderPreload[]
}

export function LoadingTip({
  tip, onDone, steps = LOADING_STEPS_DEFAULT, preloadScenes = GAME_SCENE_PRELOADS, preloadRequests,
}: LoadingTipProps) {
  const origins = useFrameOrigins(FOLDER)
  const animations = useAnimations(FOLDER)
  const [update, setUpdate] = useState(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // 로딩 판(상태 7 · 9 · 8)은 배경 0x41230 을 안 그린다(52f28~52f32) — 그 동안 선 창은 전광판 셈에 안 든다. 장면 표시보다 먼저 센다
  useMarksGameSceneLoading()
  useMarksGameScene()

  useEffect(() => {
    for (const scene of preloadScenes) preloadSpriteScene(scene)
    if (preloadRequests !== undefined) preloadSprites(preloadRequests)
  }, [preloadScenes, preloadRequests])

  useEffect(() => {
    // 판을 세운 경기 장면 틱부터 센다 — 같은 장면 틱 격자(`gameSceneTickOf`)
    const startTick = gameSceneTickNow()
    let handle = 0
    const tick = (now: number) => {
      const current = Math.max(0, gameSceneTickOf(gameSceneTimeOf(now)) - startTick)
      setUpdate(current)
      // 장면 바로가기가 단계를 밟는 중이면(개발 · e2e 전용 — `shared/lib/scenePeek`) 기다리지 않는다. 판은 난수를 안 굴린다
      const isFastForward = (import.meta.env.DEV || import.meta.env.MODE === 'e2e') && isSceneFastForward()
      // 칸 1 ~ 끝을 한 그림씩 그린 뒤 닫는다 — 끝(다 찬 막대)을 그린 그림 다음
      if (current >= steps || isFastForward) {
        onDoneRef.current()
        return
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [steps])

  const step = animationStepAt(animations?.[RUNNER_ANIMATION] ?? [], update)
  const frameKey = step === null ? null : String(step.frame).padStart(3, '0')
  const origin = frameKey === null ? undefined : origins?.[frameKey]
  // 0x54128 이 먼저 칸을 올린 뒤 0x53e04 가 그린다 — 첫 그림이 1/끝
  const fillWidth = loadingFillWidthOf(Math.min(steps, update + 1), steps)
  const runner = loadingRunnerAnchorOf(fillWidth)
  // 팁 번호 = +0x315 + 1 — 팁 글은 StrTIP[1 + n] 이고 73 줄이 모두 달라 글로 n 을 되찾는다
  const tipIndex = LOADING_TIPS.indexOf(tip)
  const numberGlyphs = tipIndex < 0 ? [] : tipNumberGlyphsOf(tipIndex + 1)

  return (
    <div className={styles.overlay} role="status" aria-label="로딩 중">
      <div className={styles.box}>
        <img className={styles.sprite} src={`${FOLDER}/000.png`} alt="" />
        {numberGlyphs.map((glyph) => (
          <img key={glyph.x} className={styles.sprite} data-testid="로딩-팁-번호" data-image={glyph.image}
            style={{ left: glyph.x, top: glyph.y }}
            src={`${NUM_FOLDER}/${String(glyph.image).padStart(3, '0')}.png`} alt="" />
        ))}
        <div className={styles.tipArea}>
          <MarkupText raw={tip} />
        </div>
        <div className={styles.bar} data-testid="로딩-막대"
          style={{ left: LOADING_BAR.x, top: LOADING_BAR.y, width: LOADING_BAR.width, height: LOADING_BAR.height, background: rgbOf(LOADING_BAR.rgb) }} />
        {fillWidth > 0 && LOADING_FILL_STRIPES.map((stripe) => (
          <div key={stripe.y} className={styles.bar} data-testid="로딩-채움"
            style={{ left: LOADING_BAR.x + 1, top: LOADING_BAR.y + stripe.y, width: fillWidth, height: stripe.height, background: rgbOf(stripe.rgb) }} />
        ))}
        {origin !== undefined && frameKey !== null && (
          <img
            className={styles.sprite}
            data-testid="로딩-선수"
            style={{ left: runner.x + origin.x, top: runner.y + origin.y }}
            src={`${FOLDER}/${frameKey}.png`}
            alt=""
          />
        )}
      </div>
    </div>
  )
}
