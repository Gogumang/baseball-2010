import { type PitcherAbility, DEFAULT_PITCHER_ABILITY } from '@/entities/pitching/model/pitch'
import { withPitcherFightingSpirit } from '@/entities/pitching/model/pitcherGameStats'
import { pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { teamPitchers, PITCHERS_PER_TEAM } from '@/entities/team/model/teamRoster'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { gameFightingSpiritOf } from '@/features/play-game/model/gameFlow/context/fightingSpirit'
import { withRecordEquipment } from '@/features/play-game/model/gameFlow/quick/quickDefense'
import { moundAcePitcherOf } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 원본 0~999 를 타석 화면의 0~100 눈금으로 — 팀 경기 `currentPitcherAbility` 와 같은 나눗셈 */
const STAGE_PITCHER_DIVISOR = 10

/**
 * **내 타석에서 공을 던지는 상대 투수**의 타석 화면용 능력치 — 지금 마운드(`opponentMound.pitcherSlot`) 투수.
 *
 * 원본 사람 타석은 수비 팀의 현재 투수 `0xae83c(팀)` → `0xb89dc(팀, team[0])`(team[0] = 등판 칸,
 * P1 E-6)을 본다 — 공이 나갈 때(0x3de10 의 0x3de38·0xa5e14 의 0xa5e2a)도 같은 함수다. 그 칸은 CPU 교체
 * `0xac428`(사람 타석 시작 0x3da3e·간이 엔진 0xc1ce2)이 바꾸므로 교체 뒤에는 바뀐 투수가 던진다.
 * 모드 4 는 팀 능력치 보정(마스크 0x306)이 없어 로스터 밑값 그대로다 (`opponentDefenseAbilitiesOf` 와 같다).
 * 투구 AI 는 `gameAbility`(피로 앞 밑값)와 `staminaPercent`(지금 마운드 +0x2c / 100)로 피로를 먹인다 (`cpuPitchStatsOf`).
 * 폼·구질·마구는 같은 레코드의 +0xb · +0x1c · +0x18 (`ROSTER_PITCHER_REPERTOIRES`, 전역 번호 팀 × 8 + 칸).
 *
 * 마선수 대결 경기의 상대 투수(`aceOpponent` — 나리 이벤트 `match`)는 이 함수가 아니라 부르는 쪽(`app/ui/GameRoute`)이
 * `pitcherAbilityOf` 로 고른다. 142 가 8번 칸에 넣은 마투수는 아래 `moundAcePitcherOf` 가 본다.
 */
export function opponentPitcherAbilityOf(progress: GameProgress): PitcherAbility {
  const slot = progress.opponentMound.pitcherSlot
  // 142 가 상대 명부 8번 칸에 넣은 마투수가 마운드에 서면 그 레코드가 던진다 — 레벨 배율(0xb6414)·체력%(0xaebb0)
  const ace = moundAcePitcherOf(progress, false)
  // 0xb570c 스킬 14 갈래 — 상대 마운드 레코드 +0x14 비트 14 · 지금 판의 경기 상태 (`gameFightingSpiritOf`)
  const situation = gameFightingSpiritOf(progress, progress.opponentTeamId)
  if (ace !== undefined) {
    return withPitcherFightingSpirit(
      pitcherAbilityOf(ace.player, progress.aces?.levels ?? {}, staminaPercentOf(progress.opponentMound.stamina)),
      situation,
    )
  }
  const row = teamPitchers(progress.opponentTeamId)[slot]
  const repertoire = ROSTER_PITCHER_REPERTOIRES[progress.opponentTeamId * PITCHERS_PER_TEAM + slot]
  if (row === undefined) return DEFAULT_PITCHER_ABILITY
  const pitcher = withRecordEquipment(row, progress.opponentEquipment?.pitchers?.[slot], true)
  return withPitcherFightingSpirit(
    {
      control: Math.round(pitcher.ability[0] / STAGE_PITCHER_DIVISOR),
      velocity: Math.round(pitcher.ability[1] / STAGE_PITCHER_DIVISOR),
      breaking: Math.round(pitcher.ability[2] / STAGE_PITCHER_DIVISOR),
      // 투구 AI·스윙 판정(0x34968·0x4dbac·0xab214 의 ab548·ab582)은 0xb570c 를 투수 체력% 0xaebb0 로 부른다 — 모드 4 는
      // 모드 가지(0xb574a 나리 질병·부상·사기)가 내 팀 육성 선수에만 붙고 팀·코치 정액이 없어, 피로 앞 값이 로스터 밑값이다
      gameAbility: {
        beforeFatigue: { control: pitcher.ability[0], velocity: pitcher.ability[1], breaking: pitcher.ability[2] },
      },
      staminaPercent: staminaPercentOf(progress.opponentMound.stamina),
      ...(repertoire === undefined ? {} : { repertoire: { form: repertoire.form, pitchMask: repertoire.pitchMask, magicId: repertoire.magicId } }),
      // 레코드 +0x14 — 실투 판정 0x33cbc 의 투수 비트 16 · 17 · 22 (붙박이 줄 = Xls 행 그대로)
      skillBits: pitcher.skillBits,
    },
    situation,
  )
}

/**
 * **내 타석 마운드의 상대 투수 장비 니블** — 레코드 +0x19 · +0x1a 네 칸. 타석 교대 0x47cc8 이 마운드 그림(장면 +0xf1c)을 다시 실을 때
 * 0xae83c(수비 팀)가 마투수(0xb633c)가 아니면 48138~4816a 가 이 니블 − 1 로 장비 겹 0x79790 을 부른다(모드 4 도 같다).
 * 레코드는 `opponentPitcherAbilityOf` 와 같은 붙박이 표 칸(Xls 행 — 리그 열 팀은 0, 외인구단 팀 14 만 제구 니블 3)이다.
 * 마선수 대결 투수(`aceOpponent`)나 142 가 8번 칸에 넣은 마투수가 서 있으면 undefined (그림은 0x793b0 의 ace/pitcher_*)
 */
export function opponentPitcherEquipmentOf(progress: GameProgress): readonly number[] | undefined {
  if (progress.aceOpponent !== null) return undefined
  if (moundAcePitcherOf(progress, false) !== undefined) return undefined
  const slot = progress.opponentMound.pitcherSlot
  return progress.opponentEquipment?.pitchers?.[slot] ?? teamPitchers(progress.opponentTeamId)[slot]?.equipment
}

/**
 * **내 타석 마운드의 상대 투수 피부** `(rec[0xb] >> 2) & 3` — 타석 교대 0x47cc8 의 482c0~482fc 가 마운드 그림 적재 0x793b0 에 넘겨
 * 794c2 가 `pitcher.pzx` 를 피부 × 15 + 수비 팀 벌로 연다. 레코드는 `opponentPitcherEquipmentOf` 와 같은 붙박이 표 칸이다
 */
export function opponentPitcherSkinIndexOf(progress: GameProgress): number {
  const row = teamPitchers(progress.opponentTeamId)[progress.opponentMound.pitcherSlot]
  return row === undefined ? 0 : (row.profile >> 2) & 3
}

/**
 * **내 타석 마운드에 선 마투수** — 마선수 대결 투수(`aceOpponent`)나 142 가 상대 명부 8번 칸에 넣은 마투수(`0xb88c8`)가 지금
 * 마운드면 그 선수, 아니면 null. 타석 교대 0x47cc8 의 482d4~482da 가 마운드 그림 적재 0x793b0 의 둘째 스택 인자 `[sp+4]`(482ee — 호출 인자로는 여섯째)로
 * `0xb63a0(투수)`(= `0xb633c` 마선수면 `0xb6394` 순번, 아니면 −1)를 모드를 안 가리고 넘기고, 0x793b0 은 793c2 `cmp r6, #0 ; blt` 로
 * 순번 ≥ 0 이면 점프표 0xd3d64 의 `ace/pitcher_*.pzx` 마투수 그림을, 음수면 `pitcher.pzx` 평범한 투수 갈래(79454)를 연다.
 * 8번 칸 마투수 레코드는 `0xb521c` 가 XlsACE_PIT 행을 통째 베껴 +0xa = 0x60 + 순번이라 마투수 그림이다 (`BattingStage.acePitcher`)
 */
export function opponentMoundAcePlayerOf(progress: GameProgress): AcePlayer | null {
  return progress.aceOpponent ?? moundAcePitcherOf(progress, false)?.player ?? null
}

/**
 * **내 타석 마운드 투수의 체력%** — 투수 그리기 0x38d1c 의 38f68 이 `0xaebb1(수비 팀)` = trunc(지금 마운드 +0x2c / 100) 로 읽어
 * 34 이하면 지친 눈(player_effect 애니 9 · 10)을 그린다(`BattingStage.pitcherStaminaPercent`).
 * 38f56 이 투수가 마선수(0xb633d)면 건너뛰므로 마선수 대결 투수(`aceOpponent`)나 142 가 8번 칸에 넣은 마투수가 서 있으면 null.
 */
export function opponentMoundStaminaPercentOf(progress: GameProgress): number | null {
  if (progress.aceOpponent !== null) return null
  if (moundAcePitcherOf(progress, false) !== undefined) return null
  return staminaPercentOf(progress.opponentMound.stamina)
}
