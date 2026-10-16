/**
 * 타석 장면 **선수 그림 미리 받기 목록** — 측정이 아니라 그리기 코드에서 계산한다.
 *
 * 타자 · 투수 그림이 쓰는 폴더와 프레임은 자세표(`batterPoseFramesOf` · `pitcherPoseFramesOf`)와
 * 겹 규칙(`batterLayersOf` · `aceBatterLayersOf` · `pitcherLayersOf`)이 정한다. 그 함수를 그대로 돌려
 * "이 선수가 타석에 서면 그릴 수 있는 그림 전부"를 모은다 — 몸통 폼(타격형 balancer · 장타형 sluger)·장비 등급·
 * 마선수 순번이 바뀌어도 목록이 따라온다. 폴더를 통째로 받지 않고 자세표에 있는 프레임만 받는다.
 *
 * 팔레트를 갈아 끼우는 겹(몸통 · 헬멧 · 등급 색 장비)은 번호 지도(`frames/index/NNN.png`)와 `palette.json` 도 같이 받는다.
 * 받은 그림은 공용 캐시(`spriteCache`)에 붙들리므로 `placedFrame` 이 첫 그림부터 쓴다. 아무도 기다리지 않는다.
 */
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { indexMapUrl, paletteUrl } from '@/shared/lib/sprite/paletteSwap'
import { frameUrl, mergeSpritePreloads } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import {
  aceBatterLayersOf,
  batterFrameAt,
  aceBatterPoseFramesOf,
  batterLayersOf,
  batterPoseFramesOf,
  layerPaletteIndexOf,
  NO_EQUIPMENT,
  NO_PITCHER_EQUIPMENT,
  pitcherLayersOf,
} from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment, BatterLayer, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { RUNNER_FRAMES, aceRunnerFramesOf } from '@/widgets/batting-stage/lib/baseRunners'
import { pitcherPoseFramesOf } from '@/widgets/batting-stage/lib/stageScenery'

/** 일반 타자 몸통 폼 둘 — 0 타격형(balancer) · 1 장타형(sluger) (`bodyTypeOf`) */
export const BATTER_BODY_TYPES = [0, 1] as const

/** 루 주자 그림 = 주자 칸 프레임 0 · 1 (애니 0 · 1 · 2 가 흔드는 칸 — `baseRunners`) */
const RUNNER_POSE_FRAMES = [0, 1]

/** `./sprites/x/frames/003.png` 의 폴더 → 그 폴더의 번호 지도 폴더 (`indexMapUrl`) */
function indexFolderOf(folder: string): string {
  const url = indexMapUrl(frameUrl(folder, 0))
  return url.slice(0, url.lastIndexOf('/'))
}

/** 팔레트 JSON 이 놓인 폴더와 이름 (`paletteUrl`) */
function paletteRequestOf(folder: string): SpriteFolderPreload {
  const url = paletteUrl(frameUrl(folder, 0))
  const cut = url.lastIndexOf('/')
  return { folder: url.slice(0, cut), frames: [], json: [url.slice(cut + 1)] }
}

/** 겹 목록 → 폴더별 미리 받기. `isRecolored` 인 겹은 번호 지도 · 팔레트도 같이 */
function layerPreloadsOf(layers: readonly BatterLayer[], isRecolored: (layer: BatterLayer) => boolean): SpriteFolderPreload[] {
  const requests: SpriteFolderPreload[] = []
  for (const layer of layers) {
    requests.push({ folder: layer.folder, frames: [layer.frame], json: ['origins.json'], framesListedIn: layer.folder })
    if (isRecolored(layer)) {
      requests.push(
        { folder: indexFolderOf(layer.folder), frames: [layer.frame], framesListedIn: layer.folder },
        paletteRequestOf(layer.folder),
      )
    }
  }
  return mergeSpritePreloads(requests)
}

/** 몸통 · 헬멧은 늘(피부 × 15 + 팀 · 팀), 장비는 등급 색 줄이 있을 때 칠한다 (`layerPaletteIndexOf`) */
const isBatterLayerRecolored = (layer: BatterLayer) => layerPaletteIndexOf(layer, 0, 0) !== null

/**
 * 일반 타자 한 명 — 몸통 폼의 대기 · 스윙 · 번트 프레임마다 겹(그림자 · 몸통 · 헬멧 · 배트 · 잔상 · 장비) 전부.
 * `equipment` 를 안 주면 맨몸(기본 배트)이다.
 */
export function batterSpritePreloadsOf(bodyType: number, equipment: BatterEquipment = NO_EQUIPMENT): SpriteFolderPreload[] {
  const layers = batterPoseFramesOf(bodyType).flatMap((frame) => batterLayersOf(frame, bodyType, equipment, true))
  return layerPreloadsOf(layers, isBatterLayerRecolored)
}

/**
 * 일반 타자가 **타석에 막 섰을 때** 그리는 겹만 — 대기 자세(`batterFrameAt`, 스윙 · 번트 없음) 한 바퀴.
 * 경기 진입 화면이 첫 그림부터 쓰는 몫이라 바로 받고, 스윙 · 번트 칸은 `batterSpritePreloadsOf` 로 뒤에서 받는다.
 */
export function batterStanceSpritePreloadsOf(bodyType: number): SpriteFolderPreload[] {
  const frames = new Set<number>()
  for (let tick = 0; tick < IDLE_CYCLE_TICKS; tick += 1) frames.add(batterFrameAt({ tick, swingTick: null, isBunting: false, bodyType }))
  return layerPreloadsOf([...frames].flatMap((frame) => batterLayersOf(frame, bodyType)), isBatterLayerRecolored)
}

/** 대기 자세 한 바퀴를 넉넉히 덮는 틱 (칸마다 4틱 × 최대 5칸) */
const IDLE_CYCLE_TICKS = 4 * 5

/** 타석에 막 섰을 때 — 두 몸통 폼의 대기 자세 · 평범한 투수 선 자세(0 + 덧그림) · 루 주자 */
export function stageEntrySpritePreloadsOf(): SpriteFolderPreload[] {
  return mergeSpritePreloads(
    ...BATTER_BODY_TYPES.map(batterStanceSpritePreloadsOf),
    layerPreloadsOf(pitcherLayersOf(0), () => false),
    runnerSpritePreloadsOf(),
  )
}

/** 마타자 한 명 (순번 0~4) — 몸통 한 장 겹(구운 색)과 경기 카드의 서 있는 그림 */
export function aceBatterSpritePreloadsOf(aceOrder: number): SpriteFolderPreload[] {
  const layers = aceBatterPoseFramesOf(aceOrder).flatMap((frame) => aceBatterLayersOf(frame, aceOrder))
  const still = ACE_BATTERS[aceOrder]?.stillUrl
  return mergeSpritePreloads(layerPreloadsOf(layers, () => false), still === undefined ? [] : [stillRequestOf(still)])
}

/** 평범한 투수 — 투구 · 대기 프레임과 덧그림(+0x16), 장비 겹 */
export function pitcherSpritePreloadsOf(equipment: PitcherEquipment = NO_PITCHER_EQUIPMENT): SpriteFolderPreload[] {
  const layers = pitcherPoseFramesOf(null).flatMap((frame) => pitcherLayersOf(frame, equipment))
  return layerPreloadsOf(layers, (layer) => layer.gradePaletteRow !== undefined)
}

/** 마투수 한 명 (순번 0~4) — 그 순번 줄의 투구 프레임과 경기 카드의 서 있는 그림 */
export function acePitcherSpritePreloadsOf(aceOrder: number): SpriteFolderPreload[] {
  const player = ACE_PITCHERS[aceOrder]
  if (player === undefined) return []
  const frames = pitcherPoseFramesOf(aceOrder).filter((frame) => frame < player.frameCount)
  return mergeSpritePreloads(
    [{ folder: player.framesUrl, frames, json: ['origins.json'], framesListedIn: player.framesUrl }],
    [stillRequestOf(player.stillUrl)],
  )
}

/** 루 주자 — 보통 주자(defender, 팀 팔레트)와 실린 마타자 주자(ace/defender_*, 구운 색) */
export function runnerSpritePreloadsOf(aceBatterOrders: readonly number[] = []): SpriteFolderPreload[] {
  const requests: SpriteFolderPreload[] = [
    { folder: RUNNER_FRAMES, frames: RUNNER_POSE_FRAMES, json: ['animations.json', 'origins.json'], framesListedIn: RUNNER_FRAMES },
    { folder: indexFolderOf(RUNNER_FRAMES), frames: RUNNER_POSE_FRAMES, framesListedIn: RUNNER_FRAMES },
    paletteRequestOf(RUNNER_FRAMES),
  ]
  for (const order of aceBatterOrders) {
    const folder = aceRunnerFramesOf(true, order)
    if (folder !== null) requests.push({ folder, frames: RUNNER_POSE_FRAMES, json: ['animations.json', 'origins.json'], framesListedIn: folder })
  }
  return mergeSpritePreloads(requests)
}

/** 통짜 그림 한 장 (`./sprites/batter_medica/024.png`) */
function stillRequestOf(url: string): SpriteFolderPreload {
  const cut = url.lastIndexOf('/')
  return { folder: url.slice(0, cut), frames: [Number(url.slice(cut + 1).replace('.png', ''))] }
}

/** 한 경기의 타석 장면에 설 수 있는 선수들 */
export interface StageCast {
  /** 일반 타자 몸통 폼 — 안 주면 둘 다(상대 명단 폼을 몰라도 빠지지 않게) */
  readonly bodyTypes?: readonly number[]
  /** 장비를 입은 타자(사람 선수) — 몸통 폼과 장비. 맨몸 겹은 `bodyTypes` 가 이미 받는다 */
  readonly equippedBatters?: readonly { readonly bodyType: number; readonly equipment: BatterEquipment }[]
  /** 장비를 입은 투수(사람 투수 · 니블 있는 마운드 투수) */
  readonly pitcherEquipments?: readonly PitcherEquipment[]
  /** 두 팀에 실린 마타자 순번 (0~4) */
  readonly aceBatters?: readonly number[]
  /** 두 팀에 실린 마투수 순번 (0~4) */
  readonly acePitchers?: readonly number[]
}

const isAceOrder = (order: number) => Number.isInteger(order) && order >= 0 && order <= 4

/** 타석 장면 선수 그림 전부 — 타자 · 투수 · 루 주자 */
export function stageCastSpritePreloadsOf(cast: StageCast = {}): SpriteFolderPreload[] {
  const aceBatters = [...new Set(cast.aceBatters ?? [])].filter(isAceOrder)
  const acePitchers = [...new Set(cast.acePitchers ?? [])].filter(isAceOrder)
  return mergeSpritePreloads(
    ...(cast.bodyTypes ?? BATTER_BODY_TYPES).map((bodyType) => batterSpritePreloadsOf(bodyType)),
    ...(cast.equippedBatters ?? []).map(({ bodyType, equipment }) => batterSpritePreloadsOf(bodyType, equipment)),
    pitcherSpritePreloadsOf(),
    ...(cast.pitcherEquipments ?? []).map((equipment) => pitcherSpritePreloadsOf(equipment)),
    ...aceBatters.map(aceBatterSpritePreloadsOf),
    ...acePitchers.map(acePitcherSpritePreloadsOf),
    runnerSpritePreloadsOf(aceBatters),
  )
}
