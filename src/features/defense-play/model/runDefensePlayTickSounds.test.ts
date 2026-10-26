import { describe, expect, it } from 'vitest'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { registerContact } from '@/entities/batting/model/battedContact'
import { isFairAngle } from '@/entities/batting/model/battedBallOutcome'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import {
  isDefensePlayFinished,
  startDefensePlay,
  stepDefensePlay,
  type DefensePlayInput,
  type DefenseTickSound,
} from '@/features/defense-play/model/runDefensePlay'
import { BATTED_BALL_PATTERNS, type BattedBallPattern } from '@/shared/config/original/battedBallPatterns'

const 땅볼아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
const 뜬공아웃: AtBatOutcome = { kind: '아웃', detail: '뜬공아웃' }
const 삼루타: AtBatOutcome = { kind: '안타', bases: 3 }

/** 한 틱씩 돌려 틱마다의 소리 칸(`tickSounds`)과 기록 줄을 모은다 */
function 틱소리(input: DefensePlayInput) {
  let state = startDefensePlay(input)
  const sounds: { readonly tick: number; readonly sound: DefenseTickSound }[] = []
  while (!isDefensePlayFinished(state)) {
    const tick = state.tick
    state = stepDefensePlay(state)
    for (const sound of state.tickSounds) sounds.push({ tick, sound })
  }
  return { sounds, log: state.log, trajectory: state.trajectory }
}

const 판 = (outcome: AtBatOutcome, bases: BaseState, pattern: BattedBallPattern = fixturePatternFor(outcome)): DefensePlayInput => ({
  outcome,
  trajectory: battedBallTrajectory(pattern),
  bases,
  outs: 0,
  runAbility: 500,
  defenseIsCpu: true,
})

const 번호들 = (sounds: readonly { readonly sound: DefenseTickSound }[]) =>
  sounds.flatMap(({ sound }) => (sound.kind === 'sound' ? [sound.soundId] : []))

/**
 * 판정 콜은 판 끝이 아니라 결과 코드가 선 **그 플레이 틱**에 난다 — b4562 의 메시지 0xbba 를 0xbfbac 가 곧바로(큐가 아니다)
 * 경기 장면 0x509a0 → 0x51a56 → 표 0xd0488 로 넘긴다.
 */
describe('타구 판의 판 안 소리 (`DefensePlayState.tickSounds`)', () => {
  it('주자 없는 땅볼 — 아웃이 난 그 틱에 포스 아웃 콜 20 한 번 (13 → 0x51b36)', () => {
    const { sounds, log } = 틱소리(판(땅볼아웃, EMPTY_BASES))
    const 콜 = sounds.filter(({ sound }) => sound.kind === 'sound' && sound.soundId === 20)
    expect(콜).toHaveLength(1)
    const 아웃줄 = log.find((줄) => 줄.includes('아웃') && /^\d+틱/.test(줄))
    expect(아웃줄).toBeDefined()
    expect(콜[0]!.tick).toBe(Number(아웃줄!.match(/^(\d+)틱/)![1]))
  })

  it('쥐기 판정의 태그 아웃을 같은 틱 두 번째 판정이 지운 판은 그 틱에 20 이다 (state[0x87] 은 그 자리 값)', () => {
    // 표 14 번 [10] 땅볼 — 1루수(2)가 21틱에 쥐며 타자주자를 태그한다(r176: 쥐기는 야수를 옮기지 않아 예전 [50, 409, 355] 는 한 틱 뒤 태그다.
    // 예전 표 8 [48, 427, 323, 1] 은 걸음이 맨해튼 거리(0xbfa2c)로 나뉜 뒤 태그가 포구 틱에 안 겹친다)
    const { sounds, log } = 틱소리(판(땅볼아웃, { first: false, second: true, third: false }, [45, 279, 324, 0]))
    expect(log).toContain('21틱 2번 야수가 잡았다 (종류 0)')
    expect(log).toContain('21틱 0번 주자 태그 아웃 (0xb36d0 결과 3)')
    expect(sounds).toContainEqual({ tick: 21, sound: { kind: 'sound', soundId: 20 } })
    expect(번호들(sounds)).not.toContain(62)
  })

  it('뜬공을 뜬 채로 잡으면 그 포구 틱에 62 (state[0x1f] — 쥐기 0xb2774)', () => {
    const { sounds, log } = 틱소리(판(뜬공아웃, EMPTY_BASES, [90, 250, 700, 0]))
    const 포구 = log.find((줄) => 줄.includes('잡았다'))
    expect(포구).toBeDefined()
    const 포구틱 = Number(포구!.match(/^(\d+)틱/)![1])
    expect(sounds).toContainEqual({ tick: 포구틱, sound: { kind: 'sound', soundId: 62 } })
    expect(번호들(sounds)).not.toContain(20)
  })

  it('깊은 페어 타구가 아무도 못 쥔 채 떨어지는 그 틱에 함성 60 후보 (슬롯 2 꼬리 52b62 · b4492 +0x113)', () => {
    const { sounds, trajectory } = 틱소리(판(삼루타, EMPTY_BASES))
    const 후보 = sounds.filter(({ sound }) => sound.kind === 'deepLanding')
    expect(후보).toHaveLength(1)
    expect(후보[0]!.tick).toBe(trajectory.landingTick)
  })

  it('뜬 채로 잡힌 깊은 뜬공은 함성 60 후보가 없다 (+0x113 이 안 선다)', () => {
    const { sounds } = 틱소리(판(뜬공아웃, EMPTY_BASES, [92, 895, 1017, 0]))
    expect(sounds.some(({ sound }) => sound.kind === 'deepLanding')).toBe(false)
  })

  it('파울 각 공이 파울로 닫히면 그 틱에 "Foul!" 25 (7 → 51c5c) — 함성 60 후보는 없다(공+0xac4 는 페어 각만)', () => {
    // 쏜 공(`contactOfOutcome`)이 실려야 state[0x1c](파울 각, 511b8)가 선다
    const 파울공 = Object.entries(BATTED_BALL_PATTERNS).flatMap(([code, patterns]) =>
      patterns.filter((pattern) => !isFairAngle(pattern[0])).map((pattern) => ({ pattern, resultCode: Number(code) })),
    )
    let 파울판 = 0
    for (const contact of 파울공) {
      const { sounds, log } = 틱소리(판(registerContact(땅볼아웃, contact), EMPTY_BASES, contact.pattern))
      if (!log.some((줄) => 줄.includes('판 끝 결과 코드 7'))) continue
      파울판 += 1
      expect(번호들(sounds)).toContain(25)
      expect(sounds.some(({ sound }) => sound.kind === 'deepLanding')).toBe(false)
    }
    expect(파울판).toBeGreaterThan(0)
  })
})
