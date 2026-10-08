import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { openScenePatternDeck } from '@/entities/batting/model/battedBallOutcome'
import { rollSceneStadium, rollStadiumNumber, sceneFieldPaletteOf } from '@/features/play-team-game/model/sceneStadium'
import { resumeTeamGame, startTeamGame } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'

/** 굴림을 (lo, hi) 로 적어 두는 난수 — 차례만 본다 */
function recorded(seed: number): { readonly random: RandomPort; readonly calls: (readonly [number, number])[] } {
  const inner = createSeededRandom(seed)
  const calls: (readonly [number, number])[] = []
  return {
    calls,
    random: {
      rand: (lo, hi) => {
        calls.push([lo, hi])
        return inner.rand(lo, hi)
      },
      rand9d: (n) => inner.rand9d(n),
    },
  }
}

const 씨앗 = 20101008

const 일반모드 = (stadiumId: number | undefined): TeamGameOptions => ({
  mode: 1,
  ourTeamId: 2,
  opponentTeamId: 5,
  playerSide: 1,
  // 0x30f20 굴림 넷은 22 진입에서 이미 돌았다
  opponentAces: { pitcher: 1, batter: 2 },
  startingPitcherSlots: { opponent: 0, ours: 0 },
  ...(stadiumId === undefined ? {} : { stadiumId }),
})

/** 상태 7(덱 · 효과)이 굴리는 수 */
function sceneOpenRollCount(): number {
  const { random, calls } = recorded(씨앗)
  openScenePatternDeck(random)
  return calls.length
}

describe('0x78664 · 0x788d4 — 구장 > 9 면 rand(0, 10)', () => {
  it('0~9 는 그대로 · 굴림 없음', () => {
    const { random, calls } = recorded(씨앗)
    expect(rollStadiumNumber(random, 9)).toBe(9)
    expect(calls).toEqual([])
  })

  it('10 이상은 rand(0, 10) 한 번', () => {
    const { random, calls } = recorded(씨앗)
    const 값 = rollStadiumNumber(random, 12)
    expect(calls).toEqual([[0, 10]])
    expect(값).toBe(createSeededRandom(씨앗).rand(0, 10))
  })
})

describe('장면 셋업 0x39fdc 모드 1 갈래 3a076 — 두 구장 객체를 st+0x30 으로', () => {
  it('구장 3 — 타석·수비 구장 3 · 팔레트 줄 = 표 0xcfd0c[3] = 2', () => {
    const { random } = recorded(씨앗)
    expect(rollSceneStadium(random, 3)).toEqual({ stadium: 3, defenseStadium: 3, paletteRow: 2 })
  })

  it('표 0xcfd0c 열 칸 — −1 은 기본색(null)', () => {
    const { random } = recorded(씨앗)
    const 줄 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((구장) => rollSceneStadium(random, 구장).paletteRow)
    expect(줄).toEqual([-1, 0, 1, 2, 0, -1, -1, 0, 1, 2])
    expect(sceneFieldPaletteOf(rollSceneStadium(random, 0))).toBeNull()
    expect(sceneFieldPaletteOf(rollSceneStadium(random, 1))).toBe(0)
  })

  it('구장 12 — 타석 → 수비 차례로 rand(0, 10) 둘. 팔레트 줄은 굴린 값이 아니라 st+0x30 첨자(표 밖)', () => {
    const { random, calls } = recorded(씨앗)
    const 구장 = rollSceneStadium(random, 12)
    const 따로 = createSeededRandom(씨앗)
    expect(calls).toEqual([[0, 10], [0, 10]])
    expect(구장.stadium).toBe(따로.rand(0, 10))
    expect(구장.defenseStadium).toBe(따로.rand(0, 10))
    expect(구장.paletteRow).toBe(0x211a1818)
    // 웹 팔레트에 없는 줄 — 그리는 쪽이 기본색으로 둔다
    expect(sceneFieldPaletteOf(구장)).toBe(0x211a1818)
  })
})

describe('startTeamGame — 3f856 0x39fdc 는 상태 7(덱 · 효과) 뒤 · 3fa0e rand(0, 2) 앞', () => {
  it('구장 0~9 는 굴림 없음 — 구장 칸을 안 넘긴 경기와 난수열이 같다', () => {
    const 넘김 = recorded(씨앗)
    const 경기 = startTeamGame(일반모드(7), 넘김.random)
    const 안넘김 = recorded(씨앗)
    startTeamGame(일반모드(undefined), 안넘김.random)

    expect(경기.sceneStadium).toEqual({ stadium: 7, defenseStadium: 7, paletteRow: 0 })
    expect(넘김.calls).toEqual(안넘김.calls)
  })

  it('구장 12 — 덱 · 효과 바로 뒤에 rand(0, 10) 둘, 이어 시뮬 초기화 rand(0, 2)', () => {
    const k = sceneOpenRollCount()
    const { random, calls } = recorded(씨앗)
    const 경기 = startTeamGame(일반모드(12), random)

    expect(calls.slice(k, k + 3)).toEqual([[0, 10], [0, 10], [0, 2]])
    expect(경기.sceneStadium?.stadium).toBeGreaterThanOrEqual(0)
    expect(경기.sceneStadium?.stadium).toBeLessThan(10)
  })

  it('시즌(모드 2)은 이 갈래가 아니다 — 구장 칸을 넘겨도 null · 굴림 없음', () => {
    const { random } = recorded(씨앗)
    const 경기 = startTeamGame({ ...일반모드(12), mode: 2 }, random)
    expect(경기.sceneStadium).toBeNull()
  })

  it('이어하기도 상태 9 를 다시 탄다 — 블록의 st+0x30 으로 또 굴린다', () => {
    const 첫 = startTeamGame(일반모드(12), createSeededRandom(씨앗))
    const 저장 = 첫.halfInningSave
    expect(저장).not.toBeNull()
    const k = sceneOpenRollCount()
    const { random, calls } = recorded(씨앗)
    if (저장 === null || 저장 === undefined) return
    const 이어 = resumeTeamGame(저장, random)

    expect(calls.slice(k, k + 3)).toEqual([[0, 10], [0, 10], [0, 2]])
    expect(이어.sceneStadium?.paletteRow).toBe(0x211a1818)
  })
})
