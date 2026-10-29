import type { RandomPort } from '@/shared/api/random/randomPort'
import type { BattedBallPattern } from '@/shared/config/original/battedBallPatterns'
import { createPatternDeck, drawPattern, randomPattern, type PatternDeck } from '@/entities/batting/model/battedBallOutcome/deck'
import { rollSceneEffectInit } from '@/entities/batting/model/battedBallOutcome/sceneEffectInit'

/**
 * **경기 장면 하나의 패턴 덱** (장면 +0x19cc) — 장면 초기화 `0x3e340` 의 `3ed76` 이 `0xb08e8` 로 **한 번** 만들고(섞기 0xb0614),
 * 그 장면의 모든 타석 — 사람 타석 · CPU 타자(투수편 · 팀경기 수비 · 투수 미션) — 이 같은 덱에서 꺼낸다(0x51490 · 커서 0xb0938).
 * 상태 7(0x3e340)은 경기 시작마다 한 번이고 상태 9 의 시뮬 초기화 rand(0, 2)(`rollSimulatorInit`)보다 앞이다.
 *
 * 웹은 장면 상태를 한 객체로 들고 다니지 않아(세션 · 진행기 · 타석 화면이 따로 돈다) 장면 덱을 **그 장면의 난수 객체에 묶어** 둔다 —
 * 경기를 여는 진행기가 `openScenePatternDeck(random)` 을 부르고, 같은 난수로 도는 타석 화면 · CPU 타자가 `scenePatternDeckOf(random)`
 * 로 되찾는다. 덱은 원본처럼 고쳐 쓰는 한 칸이다(`deck` 을 갈아 끼운다).
 *
 * **덱 뒤의 효과 객체 굴림 (직접 뜬 것)**: 같은 0x3e340 의 3ef6e 가 덱 섞기(3ed76) 뒤 곧은 길(갈래 없음)에서
 * `0x90190([0x1400064], 0, 0)` 을 부른다 — `rollSceneEffectInit` 이 그 굴림을 원본 차례대로 돈다(경기 시작마다 1202 번).
 */
export interface ScenePatternDeck {
  deck: PatternDeck
}

const SCENE_DECKS = new WeakMap<RandomPort, ScenePatternDeck>()

/** 장면 초기화 0x3e340 의 3ed76 → 0xb08e8 — 새 덱을 섞어 이 난수의 장면 덱으로 둔다(앞 장면의 덱은 버린다) */
export function openScenePatternDeck(random: RandomPort): ScenePatternDeck {
  const scene: ScenePatternDeck = { deck: createPatternDeck(random) }
  SCENE_DECKS.set(random, scene)
  // 3ef6e — 덱 섞기(3ed76) 바로 뒤 · 상태 9 굴림 앞
  rollSceneEffectInit(random)
  return scene
}

/** 이 난수로 연 장면 덱 — 장면을 열지 않았으면 undefined */
export function scenePatternDeckOf(random: RandomPort): ScenePatternDeck | undefined {
  return SCENE_DECKS.get(random)
}

/**
 * 장면 덱에서 다음 패턴 (0x51490 · 0xb0938) — 장면 덱이 없으면 웹 전용 `randomPattern`(굴림 하나)으로 대신한다.
 */
export function drawScenePattern(code: number, random: RandomPort): BattedBallPattern {
  const scene = scenePatternDeckOf(random)
  if (scene === undefined) return randomPattern(code, random)
  const drawn = drawPattern(scene.deck, code)
  scene.deck = drawn.deck
  return drawn.pattern
}
