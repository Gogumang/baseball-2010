/**
 * 수비(인플레이) 화면 **그림 미리 받기 목록** — 동작 → 프레임 식(`fielderActionFrameOf` · `runnerFrameOf`)을 돌려 계산한다.
 *
 * 타구가 뜨는 순간 수비 화면이 열리고 야수가 곧바로 뛰므로, 그 전에(경기 장면이 서 있는 동안 유휴로) 받아 둔다.
 * `defender.pzx` 125장 가운데 동작 표가 실제로 내는 칸(주자 000~016 · 야수 날값 + 17)만 받는다.
 * 마선수 수비 그림은 실린 마선수만 — 타자 마선수는 야수 + 17 · 주자 칸, 투수 마선수(투수 자리)는 날값 그대로다(`fielderSpriteOf`).
 */
import { mergeSpritePreloads } from '@/shared/lib/sprite/spritePreload'
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'
import {
  ACE_BATTER_DEFENDER_FRAMES,
  ACE_PITCHER_DEFENDER_FRAMES,
  BALL_FRAMES,
  BALL_GROUND_FRAME,
  ballFrameOf,
  DEADLY_EFFECT_FRAMES,
  DEFENDER_FRAMES,
  DEFENSE_BACKGROUND_URL,
  FIELDER_FRAME_OFFSET,
  fielderActionFrameOf,
  runnerFrameOf,
} from '@/pages/defense/lib/defenseView'
import { FIELDER_ACTION, RUNNER_ACTION } from '@/shared/config/original/defenseAnimations'

/** 한 번짜리 동작의 가장 긴 것(점프 캐치 16틱)보다 넉넉히 — 표는 마지막 칸에서 멈춘다 */
const ACTION_TICK_SPAN = 24
const BASES = [0, 1, 2, 3]
/** 투수 마선수 수비 그림 장 수 (`ACE_PITCHER_DEFENDER_FRAMES` 주석) */
const ACE_PITCHER_DEFENDER_FRAME_COUNT = 38

/** 야수 동작 표가 낼 수 있는 **날값** 프레임 전부 */
export function fielderRawFramesOf(): number[] {
  const frames = new Set<number>()
  for (const action of Object.values(FIELDER_ACTION)) {
    for (let tick = 0; tick < ACTION_TICK_SPAN; tick += 1) frames.add(fielderActionFrameOf(action, tick))
  }
  return [...frames].sort((a, b) => a - b)
}

/** 주자 동작 표가 낼 수 있는 프레임 전부 (주자 칸 000~016) */
export function runnerRawFramesOf(): number[] {
  const frames = new Set<number>()
  for (const action of Object.values(RUNNER_ACTION)) {
    for (let tick = 0; tick < ACTION_TICK_SPAN; tick += 1) addRunnerFramesOfTick(frames, action, tick)
  }
  return [...frames].sort((a, b) => a - b)
}

/** 한 동작 · 한 틱에서 베이스 넷 · 나아가기/돌아가기가 낼 수 있는 칸 */
function addRunnerFramesOfTick(frames: Set<number>, action: number, tick: number) {
  for (const base of BASES) for (const isAdvancing of [true, false]) frames.add(runnerFrameOf(action, tick, base, isAdvancing))
}

/** 공 그림 — 땅(004)부터 가장 큰 칸까지 (수비 화면의 공은 늘 보통 공이다) */
function ballFrames(): number[] {
  const frames = new Set<number>()
  for (let height = 0; height <= 20 * 2000; height += 2000) frames.add(ballFrameOf(height))
  frames.add(BALL_GROUND_FRAME)
  return [...frames].sort((a, b) => a - b)
}

function indexFolderOf(folder: string): string {
  return `${folder}/index`
}

/**
 * 경기 진입 때 바로 받을 몫 — 바탕과 **서 있기 · 달리기** 칸(동작 0~4, 보통 야수 · 주자).
 * 경기 첫 판(DUE UP · 수비 위치 걷기)과 첫 타구가 이 칸부터 그린다. 나머지 동작(포구 · 송구 · 다이빙 …)은 `defenseSpritePreloadsOf` 가 뒤에서.
 */
export function defenseEntrySpritePreloadsOf(): SpriteFolderPreload[] {
  const fielder = new Set<number>()
  for (const action of [FIELDER_ACTION.stand, FIELDER_ACTION.runDown, FIELDER_ACTION.runUp, FIELDER_ACTION.runLeft, FIELDER_ACTION.runRight]) {
    for (let tick = 0; tick < 4; tick += 1) fielder.add(fielderActionFrameOf(action, tick) + FIELDER_FRAME_OFFSET)
  }
  const frames = [...runnerRawFramesOf(), ...fielder]
  return mergeSpritePreloads([
    { folder: DEFENDER_FRAMES, frames, json: ['animations.json', 'origins.json'], framesListedIn: DEFENDER_FRAMES },
    { folder: indexFolderOf(DEFENDER_FRAMES), frames, framesListedIn: DEFENDER_FRAMES },
    { folder: DEFENDER_FRAMES.replace(/\/frames$/, ''), frames: [], json: ['palette.json'] },
  ])
}

/** 실린 마선수 (순번 0~4) */
export interface DefenseAces {
  readonly batters?: readonly number[]
  readonly pitchers?: readonly number[]
}

/** 수비 화면 그림 전부 — 바탕(잔디 팔레트) · 보통 야수 · 주자(팀 팔레트) · 공 · 번쩍임 · 실린 마선수 */
export function defenseSpritePreloadsOf(aces: DefenseAces = {}): SpriteFolderPreload[] {
  const fielderFrames = fielderRawFramesOf().map((frame) => frame + FIELDER_FRAME_OFFSET)
  const defenderFrames = [...runnerRawFramesOf(), ...fielderFrames]
  const backgroundCut = DEFENSE_BACKGROUND_URL.lastIndexOf('/')
  const backgroundFolder = DEFENSE_BACKGROUND_URL.slice(0, backgroundCut)
  const backgroundFrame = Number(DEFENSE_BACKGROUND_URL.slice(backgroundCut + 1).replace('.png', ''))
  const requests: SpriteFolderPreload[] = [
    { folder: backgroundFolder, frames: [backgroundFrame], json: ['palette.json'] },
    { folder: indexFolderOf(backgroundFolder), frames: [backgroundFrame] },
    { folder: DEFENDER_FRAMES, frames: defenderFrames, json: ['animations.json', 'origins.json'], framesListedIn: DEFENDER_FRAMES },
    { folder: indexFolderOf(DEFENDER_FRAMES), frames: defenderFrames, framesListedIn: DEFENDER_FRAMES },
    { folder: DEFENDER_FRAMES.replace(/\/frames$/, ''), frames: [], json: ['palette.json'] },
    { folder: BALL_FRAMES, frames: ballFrames(), json: ['origins.json'], framesListedIn: BALL_FRAMES },
    { folder: DEADLY_EFFECT_FRAMES, frames: 'all', json: ['animations.json', 'origins.json'] },
  ]
  for (const order of new Set(aces.batters ?? [])) {
    const folder = ACE_BATTER_DEFENDER_FRAMES[order]
    if (folder !== undefined) requests.push({ folder, frames: defenderFrames, json: ['animations.json', 'origins.json'], framesListedIn: folder })
  }
  for (const order of new Set(aces.pitchers ?? [])) {
    const folder = ACE_PITCHER_DEFENDER_FRAMES[order]
    // 투수 마선수 그림은 38장(000~037)뿐이다 — 투수 자리 동작이 안 내는 뒤 칸은 받지 않는다
    if (folder !== undefined) {
      requests.push({
        folder,
        frames: fielderRawFramesOf().filter((frame) => frame < ACE_PITCHER_DEFENDER_FRAME_COUNT),
        json: ['origins.json'],
        framesListedIn: folder,
      })
    }
  }
  return mergeSpritePreloads(requests)
}
