import { drainMoraleOf } from '@/entities/game/model/simulateHalfInning'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { teamPitchers, PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import { rosterPitcherRoleOf } from '@/entities/pitching/model/pitcherChange'
import { ACE_PITCHER_SLOT } from '@/features/play-game/model/gameAces'
import { opponentQuickDefenseOf } from '@/features/play-game/model/gameFlow/quick/quickDefense'
import { moundAcePitcherOf, teamAcePitcherOf } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **지금 상대 마운드 투수의 소개 판 재료** (상태 0xe 의 0x44944 — 투수 `0xae83c(수비 팀)`).
 * - 이름 · 보직 `+0xb & 3`(로스터 칸 표) · 손 0xb63c0(폼 & 1 · 마투수 표 `pitcherHandOf`) — 레코드는 붙박이 표 칸 또는 142 가
 *   8번 칸에 넣은 마투수다. 마선수 대결 투수(`aceOpponent`)는 이름만 안다.
 * - 체력 막대 재료 — 공마다 깎는 셈(`drainPitcherForPitch`)이 쓰는 용량 X 의 칸 그대로(사기 `defense.morale` · 첫 투수 = 이미
 *   내려간 투수가 없다).
 * - `pitcherSlot` — 리그 기록표의 그 투수 칸(마투수·대결 투수면 null — 표에 칸이 없다).
 */
export function opponentMoundOf(progress: GameProgress): {
  readonly name?: string
  readonly role?: number
  readonly throwsLeft?: boolean
  readonly pitcherSlot: number | null
  /**
   * 마투수의 레코드 +0x20~+0x2b 시즌 줄 — 저장 마투수 레코드(XlsACE_PIT 행)를 통째 베낀 칸이고 기록 게이트(모드 4 0xa571c)가 마선수를
   * 늘 걸러 표의 줄 그대로다 (`AcePlayer.recordLine`). 마투수가 아니면 없다
   */
  readonly aceRecordLine?: readonly number[]
  readonly staminaAbility: number
  readonly teamMorale: number
  readonly isFirstPitcher: boolean
  readonly stamina: number
} {
  const mound = progress.opponentMound
  const defense = opponentQuickDefenseOf(progress)
  const stamina = {
    staminaAbility: defense.staminaAbilityAt(mound.pitcherSlot),
    // 상태 0xe 의 체력 막대 0x44ea0 도 그 레코드 +2 를 읽는다 — 첫 공 앞이면 앞 값 (`drainMoraleOf`)
    teamMorale: drainMoraleOf(defense, mound),
    isFirstPitcher: mound.usedSlots.length === 0,
    stamina: mound.stamina,
  }
  if (progress.aceOpponent !== null) {
    const { aceOpponent } = progress
    return {
      name: aceOpponent.name,
      // 마선수 레코드 +0xb — 아랫 2비트 보직 · 윗니블 폼(손 0xb63c0 마투수 표)
      role: aceOpponent.profile & 3,
      throwsLeft: pitcherHandOf(aceOpponent.profile >> 4, true) === 1,
      pitcherSlot: null,
      aceRecordLine: aceOpponent.recordLine,
      ...stamina,
    }
  }
  const ace = moundAcePitcherOf(progress, false)
  const aceIndex = progress.aces?.opponent?.pitcher
  if (ace !== undefined && aceIndex !== undefined) {
    const form = ACE_PITCHER_REPERTOIRES[aceIndex]?.form
    return {
      name: ace.player.name,
      role: ace.player.profile & 3,
      ...(form === undefined ? {} : { throwsLeft: pitcherHandOf(form, true) === 1 }),
      pitcherSlot: null,
      aceRecordLine: ace.player.recordLine,
      ...stamina,
    }
  }
  const pitcher = teamPitchers(progress.opponentTeamId)[mound.pitcherSlot]
  const repertoire = ROSTER_PITCHER_REPERTOIRES[progress.opponentTeamId * PITCHERS_PER_TEAM + mound.pitcherSlot]
  const role = rosterPitcherRoleOf(mound.pitcherSlot)
  return {
    ...(pitcher === undefined ? {} : { name: pitcher.name }),
    ...(role === undefined ? {} : { role }),
    ...(repertoire === undefined ? {} : { throwsLeft: pitcherHandOf(repertoire.form, false) === 1 }),
    pitcherSlot: mound.pitcherSlot,
    ...stamina,
  }
}

/** 그 팀 마운드 칸 투수의 이름 (0xae83c → 0xb62c0) — 마투수 칸 · 마선수 대결 상대 포함 */
export function moundPitcherNameAt(progress: GameProgress, isOurs: boolean, pitcherSlot: number): string | null {
  if (!isOurs) return opponentMoundOf({ ...progress, opponentMound: { ...progress.opponentMound, pitcherSlot } }).name ?? null
  if (pitcherSlot === ACE_PITCHER_SLOT) {
    const ace = teamAcePitcherOf(progress, true)
    if (ace !== undefined) return ace.player.name
  }
  return teamPitchers(progress.ourTeamId)[pitcherSlot]?.name ?? null
}
