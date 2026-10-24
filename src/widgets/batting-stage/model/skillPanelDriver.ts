import { activeSound } from '@/shared/api/audio/soundPort'
import {
  SKILL_CHEER_SOUND_ID, batterSkillPanelBitsOf, createSkillPanelScene, enterAtBatSkillPanel,
  enterPitchSkillPanel, pitcherSkillPanelBitsOf, skillCheerOf, stepSkillPanel,
} from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelSituation, SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel'
import type { SkillPanelSource } from '@/widgets/batting-stage/model/stageRefs'

/** 따라잡기로 한 번에 돌리는 판 그림 수 — 탭이 쉬다 돌아와도 판이 한꺼번에 사라지지 않게 */
const SKILL_PANEL_CATCH_UP_LIMIT = 4

/** 그림 한 장마다 판을 돌리는 재료 — 사람이 치는 타석(`useStageAnimation`)과 사람이 던지는 타석(`PitcherSideStage`)이 같이 쓴다 */
export interface SkillPanelFrame {
  readonly source: SkillPanelSource
  /** 상태 0xf(구질을 고르는 대기) 인가 */
  readonly isStateF: boolean
  /** 지금 0xf 에 든 표지 — 0xf 동안 바뀌면 새 0xf 진입이다(0x10 CLR → 0xf · 0x12 → 0xf 따위) */
  readonly stateFMark: unknown
  /** 0x4b5b4 가 그리는 상태(0xf · 0x10 · 0x11, 4b5ca) 인가 */
  readonly isDrawnState: boolean
  /** 원본 틱 — 그림마다 한 번 돌리고 건너뛴 틱은 따라잡는다 */
  readonly nowTick: number
  /** 지금 타자 레코드 +0x14 비트 (`0xb62b4(타자, n)`) */
  readonly batterSkillBits: number
  /** 수비 투수 레코드 +0x14 비트 (`0xb62b4(투수, n + 16)`) */
  readonly pitcherSkillBits: number
  /** st[4] — 0xf 진입의 2 스트라이크 갈래 3dd4e */
  readonly strikes: number
  /** 0xb6394(타자) — 함성 29 의 비트 칸 */
  readonly batterRecordSlot: number
  /** 0xb63c0(지금 타자) — 판의 쪽 · 투수 앵커 */
  readonly batterHand: number
  /** 0xd 진입 0x445cc · 0x3d160 이 보는 경기 상황 — 0xd 진입을 처음 지나는 0xf 에서만 부른다 */
  readonly situation: () => SkillPanelSituation
  /**
   * 창이 선 첫 그림([창+0x250]) — 52efe 가 갱신 없이 HUD 0x4c4bc 를 한 번 더 돌려 0x4b5b4 가 한 번 더 돈다. 틱은 안 흘러 `nowTick` 은
   * 마지막 그림 그대로이고, 판을 한 번 더 돌릴 뿐 마지막으로 센 틱은 안 바꾼다(`stageRedraws`)
   */
  readonly extraDraw?: boolean
}

/** 0xf 밖이라는 표지 */
const OUTSIDE_STATE_F = Symbol('0xf 밖')

/**
 * **경기 스킬 표시 판 한 화면의 돌림** (`lib/skillPanel`) — 장면 +0x19b0 ~ +0x19c0.
 * 0xd 진입 열쇠(`source.entryKey`)가 바뀐 뒤 첫 0xf 진입에서 0x445cc · 0x3d160 으로 두 비트를 정하고(웹은 0xd · 0xe 를 따로 안 세어
 * 0xf 진입 직전에 한다 — 그 사이 상황은 안 바뀐다), 0xf 진입마다 2 스트라이크 갈래 3dd4e 를 본다. 그리기 0x4b5b4 는
 * 0xf · 0x10 · 0x11 의 그림마다 한 번 — 원본 틱으로 센다. 판을 세운 뒤 첫 그림에서 함성 29(4c26a~4c3a2)를 본다.
 * 장면 칸(`source.scene`)이 없으면 이 돌림이 사는 동안만 드는 칸을 쓴다.
 */
export function createSkillPanelDriver(): (frame: SkillPanelFrame) => SkillPanelView | null {
  let stateFMark: unknown = OUTSIDE_STATE_F
  let lastTick = -1
  let lastView: SkillPanelView | null = null
  const localScene = createSkillPanelScene()
  return (frame) => {
    const { source } = frame
    const scene = source.scene?.current ?? localScene
    if (source.entryKey !== null && source.entryKey !== undefined && source.entryKey !== scene.entryKey) {
      scene.entryKey = source.entryKey
      scene.isAtBatPending = true
    }
    if (!frame.isStateF) stateFMark = OUTSIDE_STATE_F
    else if (stateFMark !== frame.stateFMark) {
      stateFMark = frame.stateFMark
      if (scene.isAtBatPending) {
        // 0xd 진입 0x48d50 — 48f9a 0x445cc · 48f9e 0x3d160 · 48fa4
        scene.isAtBatPending = false
        const situation = frame.situation()
        scene.panel = enterAtBatSkillPanel(
          scene.panel,
          batterSkillPanelBitsOf(frame.batterSkillBits, situation),
          pitcherSkillPanelBitsOf(frame.pitcherSkillBits, situation),
        )
      }
      // 0xf 진입 0x3d954 3dd4e — st[4] == 2 && 수비 투수 비트 11
      scene.panel = enterPitchSkillPanel(scene.panel, frame.strikes, frame.pitcherSkillBits)
    }
    if (!frame.isDrawnState) {
      lastTick = -1
      return null
    }
    const steps = frame.extraDraw === true ? 1 : lastTick < 0 ? 1 : Math.min(SKILL_PANEL_CATCH_UP_LIMIT, frame.nowTick - lastTick)
    if (frame.extraDraw !== true || lastTick < 0) lastTick = frame.nowTick
    const drawSource = { batterHand: frame.batterHand, isDefenseCpu: source.isDefenseCpu ?? true }
    for (let step = 0; step < steps; step += 1) {
      const { view, next } = stepSkillPanel(scene.panel, drawSource, scene.arrowDraws)
      if (view !== null) {
        // 4c26a~4c3a2 — 판을 세운 뒤 첫 그림에서 한 번
        if (scene.panel.cheerPending) {
          const cheered = skillCheerOf(scene.cheerBits, {
            attackSide: source.attackSide,
            batterRecordSlot: frame.batterRecordSlot,
            batterSkillBits: frame.batterSkillBits,
          })
          if (cheered !== null) {
            scene.cheerBits = cheered
            activeSound().play(SKILL_CHEER_SOUND_ID)
          }
        }
        scene.arrowDraws += 1
      }
      scene.panel = next
      lastView = view
    }
    return lastView
  }
}
