import { STARTER_ROLE } from '@/entities/pitcher-career/model/pitcherStoryScene/skills/pitcherSkills'
import { toInt16, toInt8, toUint8 } from '@/entities/pitcher-career/model/pitcherStoryScene/signedReads'
import { equippedPitcherAbilityOf, pitcherYearlyStatsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { isBugFixed } from '@/shared/config/bugfixes'

/** 0xca7b5 — 0 쪽 버림 나눗셈 */
const OUTS_PER_INNING = 3
/** +0x1ca MVP 비트 0~12 */
const MVP_BIT_COUNT = 13

/** 0xa4d51 — +0x1ca 비트 0~12 가운데 켜진 수 */
export function mvpSeasonCountOf(bits: number): number {
  let count = 0
  for (let bit = 0; bit < MVP_BIT_COUNT; bit += 1) if ((bits & (1 << bit)) !== 0) count += 1
  return count
}

/** 아웃 칸(s16)을 이닝으로 — 0 쪽 버림 */
export const inningsOf = (outs: number) => Math.trunc(toInt16(outs) / OUTS_PER_INNING)

/**
 * 칸 하나의 이번 시즌 훈련 수 — `u8 S+0x4b+s − s8 S+0x6b+s` (0xad87e~0xad88a, 깃털 0xad91a 도 같은 읽기).
 * 고침(bugfixes.json B-70, 기본 켬): 참 값끼리 — 사본 128 이상에서 s8 로 음수가 되는 원본 버그를 걷는다
 */
export function seasonTrainingByteCountOf(career: PitcherCareer, menuId: string): number {
  const count = career.trainingCounts[menuId] ?? 0
  const copy = career.seasonStartTrainingCounts[menuId] ?? 0
  if (isBugFixed('B-70')) return count - copy
  return toUint8(count) - toInt8(copy)
}

/** 통산 합에 넣을 해들 — 지난 해 기록(`yearlyStats`)이 연차만큼 없는 옛 저장은 통산(`careerStats`) 한 줄 */
function savesWinsRowsOf(career: PitcherCareer) {
  const years = pitcherYearlyStatsOf(career)
  const pastYears = career.season - 1
  return years.length >= pastYears ? [...years.slice(0, pastYears), career.stats] : [career.careerStats]
}

/**
 * 투수 통산 `0x9da28` 의 +4(Σ +0x24 세이브) · +0xe(Σ s8 +0x2e 승) — 지난 해 0x1fa78(i)(i < 연차idx)와 이번 해 0x1fbd0 을 s32 로
 * 더해 strh, 조건은 ldrh 뒤 s16 으로 읽는다.
 */
export function pitcherSavesPlusWinsOf(career: PitcherCareer): number {
  const rows = savesWinsRowsOf(career)
  const saves = toInt16(rows.reduce((total, row) => total + toInt16(row.saves), 0))
  const wins = toInt16(rows.reduce((total, row) => total + toInt8(row.wins), 0))
  return saves + wins
}

/** 0xb63c0(내 투수 레코드 0x1fbd0) — 마투수가 아니면 폼(2×타입 + 손) & 1 = 손(1 좌완) (b63c0~b640e) */
export const isLeftHandedPitcher = (career: PitcherCareer) => (career.handIndex & 1) === 1

/**
 * 지난 해 i(0부터)의 연도 기록 0x1fa78(i). 옛 저장의 모자란 칸은 불러올 때 `migratePitcherYearlyStats` 가 앞에 채운다 — 하나만
 * 모자라면 통산 − 이번 해로 되살리고, 둘 이상이면 해마다 나눈 값이 남아 있지 않아 합을 가장 최근 칸에 두고 앞 칸은 0 이다.
 * 이사를 안 거친 값(시험)에서 칸이 없으면 0 으로 본다
 */
function pitcherYearOf(career: PitcherCareer, yearIndex: number) {
  const row = pitcherYearlyStatsOf(career)[yearIndex]
  if (row === undefined) return { wins: 0, saves: 0 }
  return { wins: toInt8(row.wins), saves: toInt16(row.saves) }
}

/** 투지 — 보직 0 이면 그 해 s8 +0x2e(승), 그 밖은 s16 +0x24(세이브) + 승 (0xad668~0xad790 · 0xada22~0xadace) */
export function fightingValueOf(career: PitcherCareer, yearIndex: number): number {
  const year = pitcherYearOf(career, yearIndex)
  return career.role === STARTER_ROLE ? year.wins : year.saves + year.wins
}

/**
 * 조건 20 의 `평균실효` — `Σ i=0..3 0xb6415(0x1fc75(저장, 모드), i, 1)` 를 4 로 0 쪽 버림 나눗셈(asrs #2 앞 음수면 +3).
 * 모드 3 레코드라 투수 능력치 넷의 실효값(장비 · 스킬 보정 — `equippedPitcherAbilityOf`)이다.
 */
export function averageEquippedPitcherAbilityOf(career: PitcherCareer): number {
  const ability = equippedPitcherAbilityOf(career)
  return Math.trunc(PITCHER_ABILITY_ORDER.reduce((sum, key) => sum + ability[key], 0) / 4)
}
