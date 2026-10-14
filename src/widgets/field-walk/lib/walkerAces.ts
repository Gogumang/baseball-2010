import {
  ACE_BATTER_DEFENDER_FRAMES,
  ACE_PITCHER_DEFENDER_FRAMES,
  DEFENDER_FRAMES,
  FIELDER_FRAME_OFFSET,
  fielderActionFrameOf,
} from '@/pages/defense/lib/defenseView'
import type { FieldWalker } from '@/widgets/field-walk/lib/fieldWalker'

/**
 * **운동장 전경 · 벤치 클리어링의 마선수 그림** — 줄 그리기 0x43010(직접 뜸 2026-10-14)이 칸마다 0x79b48(그림, a, b, 프레임, …) 을 부른다:
 * ```
 * 43030  줄 팀 = 공격 줄이면 팀[st[9]], 수비 줄이면 팀[st[0xa]]
 * 430f0  a = 칸 0 이고 0xb633c(0xae83c(줄 팀)) — 줄 팀의 **지금 투수**가 마선수
 * 4310c  b = 걷는 사람 +0xec(선수 레코드) 가 있고 0xb633c(+0xec) — 그 레코드가 마선수
 * 79b48  a → 그림 +0x28(투수 마선수, 프레임 날값) · 아니고 b → 그림 +0x1c(타자 마선수, 프레임 + 0x11) · 아니면 +0xc(보통 · 팀 팔레트 +0x10)
 * ```
 * 그림 객체는 줄마다 하나이고(교대 판: 수비 줄 [+0x177c] · 공격 줄 [+0xf20], 벤치 클리어링은 거꾸로), 싣는 곳(0x3fac4 3ff38~3ffdc ·
 * 0x3a5f0 3a6c6~3a716)이 그 줄 팀의 지금 투수가 마선수면 +0x28 에 그 번호 그림을, 레코드 타자 배열에서 처음으로 +0xa & 0x40 인 선수
 * (0xb8a50)가 있으면 +0x1c 에 **그 첫 마타자 번호** 그림을 싣는다 — 한 줄의 타자 마선수는 누구든 그 팀 첫 마타자 그림으로 그려진다(원본 그대로).
 *
 * +0xec 는 교대 판 0x3fac4(3fe1a~3ff36)가 칸 i 마다 줄 팀 레코드 타자 배열을 차례로 훑어 자리 니블(+0x1c & 0xf)이 i + 1 인 **첫** 레코드로 적는다
 * — 칸 0(투수)에는 니블 1(지명)인 레코드가 든다. 그래서 칸 0 은 a 가 거짓이면 지명 레코드가 마타자일 때 타자 마선수 그림이 된다(원본 그대로).
 */
export interface WalkTeamAces {
  /** 줄 팀의 지금 투수(0xae83c)의 마투수 번호 0~4 — 마투수가 아니면 null (a 갈래) */
  readonly pitcherAce: number | null
  /** 줄 팀 레코드 타자 배열 차례 — 자리 니블(+0x1c & 0xf, 0 = 벤치)과 마타자 번호(아니면 null) */
  readonly records: readonly { readonly position: number; readonly ace: number | null }[]
}

/** 한 사람의 마선수 그림 — 투수 마선수(+0x28) · 타자 마선수(+0x1c) */
export interface WalkerAceSprite {
  readonly kind: 'pitcher' | 'batter'
  readonly index: number
}

const FIELDER_COUNT = 9
const ACE_INDEX_MAXIMUM = 4

const isAceIndex = (index: number | null | undefined): index is number =>
  index != null && index >= 0 && index <= ACE_INDEX_MAXIMUM

/**
 * 칸 i 의 +0xec — 레코드 차례로 자리 니블이 i + 1 인 첫 레코드 (0x3fac4 · 0x40008 · 0xb0fb4 가 같은 훑기).
 * ⚠️ 미확인 근사: 맞는 레코드가 없으면 원본은 +0xec 를 안 덮어 앞 장면 값이 남는다 — 웹은 비운다.
 */
export function walkerRecordsOf<T extends { readonly position: number }>(records: readonly T[]): readonly (T | null)[] {
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) =>
    records.find((record) => (record.position & 0xf) === slot + 1) ?? null)
}

/** 교대 판 한 줄의 칸별 마선수 그림 (a · b 갈래) — 없으면 null(보통 그림) */
export function walkAceSpritesOf(team: WalkTeamAces | null | undefined): readonly (WalkerAceSprite | null)[] {
  if (team == null) return Array.from({ length: FIELDER_COUNT }, () => null)
  return walkAceSpritesOfRecords(team.pitcherAce, walkerRecordsOf(team.records), team.records)
}

/**
 * +0xec 가 이미 정해진 줄의 칸별 마선수 그림 — `seated[i]` 는 칸 i 의 +0xec 레코드(없으면 null), `roster` 는 그림을 싣는
 * 0xb8a50 이 훑는 그 팀 레코드 타자 배열이다.
 */
export function walkAceSpritesOfRecords(
  pitcherAce: number | null,
  seated: readonly ({ readonly ace: number | null } | null)[],
  roster: readonly { readonly ace: number | null }[],
): readonly (WalkerAceSprite | null)[] {
  const firstAce = roster.find((record) => isAceIndex(record.ace))?.ace ?? null
  return Array.from({ length: FIELDER_COUNT }, (_unused, slot) => {
    if (slot === 0 && isAceIndex(pitcherAce)) return { kind: 'pitcher', index: pitcherAce }
    const record = seated[slot] ?? null
    // b — 그림 +0x1c 가 없으면(첫 마타자를 못 찾음) 0x79b48 이 아무것도 안 그린다 — 웹은 보통 그림으로 둔다
    if (record !== null && isAceIndex(record.ace) && isAceIndex(firstAce)) return { kind: 'batter', index: firstAce }
    return null
  })
}

/** 0x79b48 의 그림판과 프레임 — 투수 마선수는 날값, 타자 마선수 · 보통은 + 0x11 */
export function walkerSpriteOf(walker: FieldWalker, ace: WalkerAceSprite | null): { readonly folder: string; readonly frame: number } {
  const raw = fielderActionFrameOf(walker.action, walker.actionTick)
  if (ace?.kind === 'pitcher') return { folder: ACE_PITCHER_DEFENDER_FRAMES[ace.index], frame: raw }
  if (ace?.kind === 'batter') return { folder: ACE_BATTER_DEFENDER_FRAMES[ace.index], frame: raw + FIELDER_FRAME_OFFSET }
  return { folder: DEFENDER_FRAMES, frame: raw + FIELDER_FRAME_OFFSET }
}
