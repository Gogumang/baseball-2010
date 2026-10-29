import { beforeEach, describe, expect, it, vi } from 'vitest'

/** 그리기 호출을 줄마다 적는다 — 그림 · 다른 모듈의 그리기는 이름만 */
const calls = vi.hoisted(() => [] as string[])

vi.mock('@/widgets/batting-stage/lib/spriteLoader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  sprite: (url: string) => ({ src: url, width: 10, height: 6 }),
  placedFrame: (folder: string, index: number) => ({ image: { src: `${folder}#${index}`, width: 8, height: 4 }, offsetX: -2, offsetY: -3 }),
  frameAnimations: () => [[{ frame: 0, delay: 1 }]],
  drawFrameAt: (_context: unknown, folder: string, index: number, x: number, y: number) => calls.push(`frame ${folder}#${index} ${x},${y}`),
  warmRecoloredFrames: () => true,
}))
vi.mock('@/widgets/batting-stage/lib/renderScenery', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  drawScenery: (_context: unknown, state: { offsetY: number }) => calls.push(`scenery ${state.offsetY}`),
}))
vi.mock('@/widgets/batting-stage/lib/renderHud', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  drawHud: () => calls.push('hud'),
}))
vi.mock('@/widgets/particles/lib/renderParticles', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  drawParticles: () => calls.push('particles'),
}))
vi.mock('@/shared/lib/pixelEffect/pixelEffect', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  recoloredImageOf: (image: { src: string }, effect: number) => ({ src: `${image.src}~${effect}` }),
}))
vi.mock('@/widgets/batting-stage/lib/renderHomeRunBanner', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  drawHomeRunTextFrame: () => calls.push('homerun-text'),
  drawHomeRunBanner: () => calls.push('homerun-banner'),
}))

import { renderBattingStage, type StageScene } from '@/widgets/batting-stage/lib/renderBattingStage'
import { drawMirroredAt } from '@/widgets/batting-stage/lib/renderBattingStage/mirror'
import { withCameraShift } from '@/widgets/batting-stage/lib/renderBattingStage/screen/cameraShift'
import { drawBaseRunners } from '@/widgets/batting-stage/lib/renderBattingStage/runners/drawBaseRunners'
import { drawStageResult } from '@/widgets/batting-stage/lib/renderBattingStage/result/drawResultText'
import { NO_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'

const context = new Proxy({ canvas: { width: 240, height: 320 } } as unknown as CanvasRenderingContext2D, {
  get: (target, property) =>
    property === 'canvas'
      ? Reflect.get(target, property)
      : (...args: unknown[]) =>
          calls.push(`${String(property)} ${args.map((arg) => (typeof arg === 'object' ? (arg as { src?: string }).src : arg)).join(',')}`),
  set: (_target, property, value) => calls.push(`${String(property)}=${String(value)}`) > 0,
})

const hud = {
  inning: 1,
  half: '초',
  ourScore: 0,
  opponentScore: 0,
  balls: 0,
  strikes: 0,
  outs: 0,
  bases: { first: true, second: false, third: false },
  ourLogoUrl: '',
  opponentLogoUrl: '',
  runnerRunAbilities: { first: 700 },
}
const scene: StageScene = {
  pitch: null,
  frame: -1,
  pitcherTick: null,
  tick: 0,
  resultTick: 0,
  scenery: { skyRow: 0, stadium: 0 },
  shift: 0,
  isEagleEyeEnabled: false,
  resultText: '',
  isHomeRun: false,
  homeRunTick: 0,
  swingFrame: 0,
  bodyType: 0,
  batterSkinIndex: 0,
  batterTeamIndex: 0,
  batterEquipment: NO_EQUIPMENT,
  hud,
  acePitcher: null,
}

beforeEach(() => {
  calls.length = 0
})

describe('그리기 도우미 — 효과 0x11 거울 · 0x13 카메라', () => {
  it('뒤집으면 축 x 의 두 배로 옮겨 좌우를 뒤집고, 안 뒤집으면 저장 · 되돌리기만 한다', () => {
    drawMirroredAt(context, 100, true, () => calls.push('draw'))
    drawMirroredAt(context, 100, false, () => calls.push('draw'))
    expect(calls).toEqual(['save ', 'translate 200,0', 'scale -1,1', 'draw', 'restore ', 'save ', 'draw', 'restore '])
  })

  it('카메라가 가운데면 상태를 건드리지 않고, 옮겼으면 그만큼 옮겨 그린다', () => {
    withCameraShift(context, { dx: 0, dy: 0 }, () => calls.push('draw'))
    withCameraShift(context, { dx: 3, dy: -2 }, () => calls.push('draw'))
    expect(calls).toEqual(['draw', 'save ', 'translate 3,-2', 'draw', 'restore '])
  })
})

describe('루상 주자 0x35b94', () => {
  it('쉬는 대기면 주자 다음에 주루 칸 넷을 잇는다 — 켜진 칸은 그대로, 빈 칸은 회색', () => {
    drawBaseRunners(context, { hud, side: 1, tick: 0, showsRunPips: true })
    const pips = calls.filter((call) => call.includes('097.png'))
    // 주루 능력 700 → 켜진 칸 trunc(700 / 0x14d) + 1 = 3 · 빈 칸 1 (효과 0xa 회색)
    expect(pips.filter((call) => call.includes('~'))).toHaveLength(1)
    expect(pips).toHaveLength(4)
  })

  it('도루로 출발한 루는 창도 주자도 안 그린다', () => {
    drawBaseRunners(context, { hud: { ...hud, hiddenRunnerBases: [1] }, side: 1, tick: 0, showsRunPips: false })
    expect(calls.filter((call) => call.startsWith('drawImage'))).toHaveLength(0)
  })
})

describe('판정 글자 · HOMERUN 글자', () => {
  it('부르는 쪽이 모는 글자 칸이 있으면 그것을, null 이면 홈런이 아닌 판정 글자만', () => {
    drawStageResult(context, { ...scene, homeRunFrame: { tick: 0 } as unknown as StageScene['homeRunFrame'] }, 1)
    drawStageResult(context, { ...scene, homeRunFrame: null, isHomeRun: true, resultText: '홈런' }, 1)
    drawStageResult(context, { ...scene, isHomeRun: true }, 1)
    expect(calls).toEqual(['homerun-text', 'homerun-banner'])
  })
})

describe('renderBattingStage 차례', () => {
  it('결과 배경이면 배경 · 파티클만 그리고 선수 · HUD 는 없다', () => {
    renderBattingStage(context, { ...scene, resultBackdropOffsetY: 7, particles: {} as StageScene['particles'] })
    expect(calls).toEqual(['scenery 7', 'particles'])
  })

  it('보통 그림은 배경 → 선수(카메라 안) → HUD → 파티클, HUD 를 안 그리는 상태는 HUD 를 건너뛴다', () => {
    renderBattingStage(context, { ...scene, particles: {} as StageScene['particles'] })
    const order = calls.filter((call) => ['scenery 0', 'restore ', 'hud', 'particles'].includes(call))
    expect(order.at(0)).toBe('scenery 0')
    expect(order.slice(-2)).toEqual(['hud', 'particles'])
    calls.length = 0
    renderBattingStage(context, { ...scene, omitsHud: true })
    expect(calls).not.toContain('hud')
  })

  it('홈런더비 필드 위는 캔버스를 비우고 HOMERUN 글자 · 파티클만', () => {
    renderBattingStage(context, { ...scene, isFieldPlay: true, homeRunFrame: { tick: 0 } as unknown as StageScene['homeRunFrame'] })
    expect(calls).toEqual(['clearRect 0,0,240,320', 'homerun-text'])
  })
})
