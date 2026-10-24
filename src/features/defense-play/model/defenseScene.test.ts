import { describe, expect, it } from 'vitest'
import {
  DEFENSE_SCENE_START,
  drawDefenseScene,
  enterDefenseScene,
  fireLaser,
  turnOnDeadlyFlash,
  type DefenseScene,
} from '@/features/defense-play/model/defenseScene'
import { postJudgeMessage } from '@/features/defense-play/model/laserPresentation'

const 야수 = { x: 20_000, y: 0, z: 26_000 }
const 맥락 = { holderSlot: 4, holder: 야수, holderAction: 0x11 }

/** 그림을 n 번 그린다 — 그림마다의 결과를 모은다 */
function 그리기(scene: DefenseScene, draws: number) {
  const rows = []
  let current = scene
  for (let draw = 0; draw < draws; draw += 1) {
    const drawn = drawDefenseScene(current, 맥락)
    rows.push(drawn)
    current = drawn.scene
  }
  return { rows, scene: current }
}

describe('필살 점프 캐치 연출 B 0x441c4 (점프표 0xd0040)', () => {
  it('단계 0 이 +0x1997 = 0 · 1~5 대기 · 6 줌 · 7 에서 deadly_effect 0 · 1 · 2 · 3 을 그리고 끝 비트에 +0x1998 (+0x1999 는 안 선다)', () => {
    const 켬 = turnOnDeadlyFlash(DEFENSE_SCENE_START, { jump: true, slide: false })
    expect(켬).toMatchObject({ jumpFlash: true, effectStep: 0 })
    const { rows, scene } = 그리기(켬, 13)
    expect(rows[0].scene.popup.shown).toBe(false)
    expect(rows.map((row) => row.flash?.step ?? null)).toEqual([null, null, null, null, null, null, null, 0, 1, 2, 3, null, null])
    // 줌은 단계 6 의 그림부터 110 · 110 · 105 · 100
    expect(rows.map((row) => row.zoom?.percent ?? null)).toEqual([null, null, null, null, null, null, 110, 110, 105, 100, null, null, null])
    // 끝 그림이 멈춤을 풀고 플레이 칸들을 내린다
    expect(rows[10]).toMatchObject({ unpaused: true, flashEnded: true })
    expect(scene).toMatchObject({ effectStep: -1, jumpFlash: false })
    expect(scene.popup).toMatchObject({ bigOutArmed: true, bigOutRecord: false })
    // 그리는 점은 공 가진 야수 (x, z − y), B 는 화면에서 y − 50 (`flashOffsetOf`)
    expect(rows[7].flash).toEqual({ kind: 'b', step: 0, x: 20_000, z: 26_000 })
  })

  it('deadly_effect 애니 0 은 되감지 않는다 — 같은 경기 두 번째 필살 포구는 끝 칸 3 을 한 그림만 그리고 곧바로 끝난다', () => {
    const 첫번 = 그리기(turnOnDeadlyFlash(DEFENSE_SCENE_START, { jump: true, slide: false }), 12).scene
    const 다음판 = enterDefenseScene(첫번, true)
    const { rows, scene } = 그리기(turnOnDeadlyFlash(다음판, { jump: true, slide: false }), 9)
    expect(rows.map((row) => row.flash?.step ?? null)).toEqual([null, null, null, null, null, null, null, 3, null])
    expect(rows[7].flashEnded).toBe(true)
    expect(scene.popup.bigOutArmed).toBe(true)
  })
})

describe('필살 슬라이딩 캐치 연출 C 0x44398 (점프표 0xd0060)', () => {
  it('단계 1 · 2 가 방향(+0x1996 = 야수 +0xa8)을 적고 1~4 가 줌을 다시 세운다 — 단계 5 에서 방향대로 그린다', () => {
    const { rows, scene } = 그리기(turnOnDeadlyFlash(DEFENSE_SCENE_START, { jump: false, slide: true }), 10)
    expect(rows.map((row) => row.flash?.step ?? null)).toEqual([null, null, null, null, null, 0, 1, 2, 3, null])
    expect(rows[5].flash).toMatchObject({ kind: 'c', direction: 0x11 })
    expect(rows.map((row) => row.zoom?.percent ?? null)).toEqual([null, 110, 110, 110, 110, 110, 105, 100, null, null])
    expect(scene).toMatchObject({ slideFlash: false, effectStep: -1 })
  })

  it('켜짐은 +0x1f7 이 먼저다 — 둘 다 서도 B 만 켠다(5256c → 525bc 는 else 갈래)', () => {
    expect(turnOnDeadlyFlash(DEFENSE_SCENE_START, { jump: true, slide: true })).toMatchObject({ jumpFlash: true, slideFlash: false })
  })
})

describe('레이저 연출 0x4403c 와 판을 넘는 칸', () => {
  it('단계 0 · 1 · 2 · 3 — 3 이 +0x1998 = +0x1999 = 1, 연출 단계를 같이 쓰는 B 가 서 있으면 그 단계를 이어 받는다', () => {
    const { rows, scene } = 그리기(fireLaser(DEFENSE_SCENE_START), 4)
    expect(rows.map((row) => row.laserStepZero)).toEqual([true, false, false, false])
    expect(rows[1].unpaused).toBe(true)
    expect(scene).toMatchObject({ effectStep: -1, laserRunning: false })
    expect(scene.popup).toMatchObject({ bigOutArmed: true, bigOutRecord: true, shown: false })
  })

  it('앞 판에서 남은 +0x1998 · +0x1999 — 투구가 +0x1997 = 1 로 되돌려 첫 결과 판(보통 갈래)이 지운다', () => {
    const 남음 = { ...DEFENSE_SCENE_START, popup: { ...DEFENSE_SCENE_START.popup, shown: false, bigOutArmed: true, bigOutRecord: true } }
    const 다음판 = enterDefenseScene(남음, true)
    expect(다음판.popup).toMatchObject({ shown: true, timer: -1 })
    const drawn = drawDefenseScene({ ...다음판, popup: postJudgeMessage(다음판.popup, 13, 2) }, 맥락)
    expect(drawn.bigOut).toBeNull()
    expect(drawn.judgeText?.frame).toBe(35)
    expect(drawn.scene.popup).toMatchObject({ bigOutArmed: false, bigOutRecord: false })
  })

  it('앞 판에서 남은 칸 + 이번 판 레이저 단계 0 이 메시지보다 먼저면 그 코드 13 결과 판이 남은 +0x1999 로 state[0x8b] 를 세운다', () => {
    const 남음 = { ...DEFENSE_SCENE_START, popup: { ...DEFENSE_SCENE_START.popup, shown: false, bigOutArmed: true, bigOutRecord: true } }
    let scene = fireLaser(enterDefenseScene(남음, true))
    scene = drawDefenseScene(scene, 맥락).scene // 단계 0 — +0x1997 = 0
    const drawn = drawDefenseScene({ ...scene, popup: postJudgeMessage(scene.popup, 13, 2) }, 맥락)
    expect(drawn.bigOut?.frame).toBe(35)
    expect(drawn.recordsLaserOut).toBe(true)
  })

  it('견제 판은 투구를 안 지나 +0x1997 · 큰 OUT 애니를 안 되감는다 — 결과 판 타이머만 −1', () => {
    const 남음 = { ...DEFENSE_SCENE_START, popup: { ...DEFENSE_SCENE_START.popup, timer: 4, shown: false, bigOutDraws: 7 } }
    expect(enterDefenseScene(남음, false).popup).toMatchObject({ timer: -1, shown: false, bigOutDraws: 7 })
    expect(enterDefenseScene(남음, true).popup).toMatchObject({ timer: -1, shown: true, bigOutDraws: 0 })
  })
})
