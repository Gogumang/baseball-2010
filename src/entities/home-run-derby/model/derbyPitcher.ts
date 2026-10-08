import { derbyAcePitcherOf, pitcherAbilityOf } from '@/entities/game/model/aceOpponent'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { DERBY_MAGIC_PITCH_TYPE, DERBY_ORDINARY_PITCH_TYPE } from '@/entities/home-run-derby/model/derbyRules'
import { PITCHERS_PER_TEAM, teamPitchers } from '@/entities/team/model/teamRoster'
import { masterGameAbilityOf } from '@/entities/mission/model/missionCpuTeam'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'

/** `0xaebb0` 의 모드 7 갈래 — 홈런더비 투수 체력%는 늘 100 */
const HOME_RUN_DERBY_STAMINA_PERCENT = 100

/**
 * 홈런더비 상대 투수 (H-2 · S13 5절).
 *
 * - 단계 0: **상대 팀(마스터 팀 v)의 투수 칸 2** — 아래 `DERBY_ORDINARY_PITCHER_ROW`. 구질 1 고정 (0x344dc)
 * - 단계 s ≥ 1: 마투수 표 `0xcfce8 = [1, 2, 3, 4]` 의 `s−1` 번째 레코드를 상대 투수로 0x30 바이트
 *   통째로 복사하고 **구질 22(마구)만** 던진다 (0x48d50). 표 차례 = 파일 줄 차례가 **확정**이라
 *   단계 1~4 = 레오니 · 붕붕머신 · 발렌타인 · 드래고나이고 **싸이커는 안 나온다**.
 *   대응표는 이미 `entities/game/model/aceOpponent` 의 `derbyAcePitcherOf` 가 들고 있다.
 */

/**
 * **단계 0 투수 = 마스터 팀 v 의 투수 줄 2** (직접 떴다 — 경기 초기화 0x39fdc 모드 7 갈래):
 * ```
 * 3a454  v = rand(0, 9) ; v == 내 팀이면 9                       ; `rollDerbySceneStart`
 * 3a500  0xb891c(장면[0x228], 7, 내 팀, −1) · 3a520 0xb891c(장면[0x22c], 7, v, −1)
 *        → 0xb8680 모드 7 → 0xb8728 → 0x1f8c1 마스터 명부 (팀 객체 바이트 0..0xd = 0 — 지금 투수 칸 team[0] = 0)
 * 3a524  0xb8c94(팀 1, 0, 2) · 3a538 0xb8c94(팀 0, 0, 2)        ; 0xb5e98(…, 0, 2, 1) — 두 팀 모두 투수 0 ↔ 2
 * ```
 * 수비 팀(팀 1)의 지금 투수 `0xae83c` = `0xb89dc(팀, team[0] = 0)` 이 맞바꾼 뒤의 칸 0 = 마스터 줄 2 다.
 * 결과 진입 0x4f696 `0x20094(앱, 5)` → 0x1ff98 이 마스터 명부를 되돌린다(웹은 명부를 고치지 않아 할 일이 없다).
 */
export const DERBY_ORDINARY_PITCHER_ROW = 2

/** 원본 0~999 를 투구 엔진 0~100 칸으로 — 미션 마운드 `missionCpuMoundPitcherAbilityOf` 와 같은 나눗셈 */
const ENGINE_DIVISOR = 10

/**
 * **단계 0 투수의 능력치** — 투구 판정들(0x34968 · 0x4dbac · 0xab214)이 읽는 0xb570c 는 b5728 에서 0xb6415(P, k, 1)
 * (장비 · 스킬 보정 = `masterGameAbilityOf`)로 시작하고, 모드 갈래(b573a~)는 2 · 3 · 4 만 타며, 피로(0xb58e6)는 체력%
 * 0xaebb0 이 모드 7 이면 100 이라 안 깎는다. 폼 · 보유 구질 · 마구 번호는 같은 줄의 +0xb · +0x1c · +0x18
 * (`ROSTER_PITCHER_REPERTOIRES`, 전역 번호 팀 × 8 + 줄). 구질은 따로 1 로 고정된다(`pitchType`).
 */
function ordinaryDerbyPitcherOf(opponentTeamId: number): { readonly name: string | null; readonly ability: PitcherAbility } {
  const row = teamPitchers(opponentTeamId)[DERBY_ORDINARY_PITCHER_ROW]
  if (row === undefined) return { name: null, ability: LEGACY_ORDINARY_DERBY_PITCHER }
  const control = masterGameAbilityOf(row, true, 0)
  const velocity = masterGameAbilityOf(row, true, 1)
  const breaking = masterGameAbilityOf(row, true, 2)
  const repertoire = ROSTER_PITCHER_REPERTOIRES[opponentTeamId * PITCHERS_PER_TEAM + DERBY_ORDINARY_PITCHER_ROW]
  return {
    name: row.name,
    ability: {
      control: Math.round(control / ENGINE_DIVISOR),
      velocity: Math.round(velocity / ENGINE_DIVISOR),
      breaking: Math.round(breaking / ENGINE_DIVISOR),
      gameAbility: { beforeFatigue: { control, velocity, breaking } },
      staminaPercent: HOME_RUN_DERBY_STAMINA_PERCENT,
      ...(repertoire === undefined
        ? {}
        : { repertoire: { form: repertoire.form, pitchMask: repertoire.pitchMask, magicId: repertoire.magicId } }),
    },
  }
}

/**
 * 구질 1 만 든 비트마스크 — `pitchListOf`(0xb6d2c) 가 레코드 +0x1c 비트마스크의 비트 `t−1` 을
 * 구질 `t` 로 읽으므로 비트 0 하나만 세우면 목록이 [1,0,0,0,0,0] 이 된다.
 */
const FASTBALL_ONLY_MASK = 1 << (DERBY_ORDINARY_PITCH_TYPE - 1)

/**
 * 상대 팀을 모를 때(난수 없이 띄운 예전 시험 — 장면 시작 굴림이 없어 v 가 없다)의 자리값. 원본에는 이 길이 없다.
 */
const LEGACY_ORDINARY_DERBY_PITCHER: PitcherAbility = {
  control: 60,
  velocity: 60,
  breaking: 60,
  repertoire: { form: 0, pitchMask: FASTBALL_ONLY_MASK, magicId: 0 },
}

export interface DerbyPitcher {
  readonly stage: number
  /** 단계 0 이면 null — 상대 팀 마스터 투수다 */
  readonly ace: AcePlayer | null
  /** 소개 판(0x44944)이 그리는 투수 이름 — 마투수 이름 또는 상대 팀 투수 줄 2 의 이름. 모르면 null */
  readonly name: string | null
  readonly ability: PitcherAbility
  /** 원본이 이 단계에서 던지는 구질 번호 — 0 단계 1, 그 위는 22(마구) */
  readonly pitchType: number
}

/**
 * 단계 → 상대 투수.
 *
 * `opponentTeamId` 는 장면 시작 굴림 3a454 가 고른 상대 팀 v (`rollDerbySceneStart`). 단계 0 투수가 그 팀의 줄 2 다.
 *
 * `aceLevels`(마선수 레벨 열 칸 `mgr[0x13a..0x143]`)를 넘기면 마투수 능력치에 **레벨 배율**을 곱한다.
 * 난입(0x48d50)이 마투수 레코드를 0x30 바이트 통째로 복사하므로 `+0xa = 0x60 + 순번` 도 따라온다 —
 * 실효 능력치 0xb6414 는 모드를 안 가리고 `0xb633c`(+0xa 비트 6 = 마선수)·`0xb6394`(순번)로
 * `v · 0xd88aa[mgr[0x13a + 순번]] / 100` (b6438~b6466) 을 먹인다. 투구 판정들(0xab214 · 0x34334 …)은
 * 상대 투수 능력치를 0xb570c → 0xb6414 로 읽으니 홈런더비(모드 7)의 마투수도 같은 배율을 탄다.
 * 안 넘기면 배율 없이 날 값이다.
 *
 * 구질(`pitchType`)은 0x344dc 의 모드 7 갈래(0x344ea~0x34504)가 **굴림 없이** 정한다 —
 * `state([0x1552d0c])+0x38`(등장한 마투수 수) > 0 ? 22 : 1. 타석 화면(`BattingStage` 의 `derbyPitchType`)이 이 값을
 * `selectPitch` 에 넘긴다. 마구면 제구 등급 5(0x4dbac)·실투 굴림 없음·마구 공 그림·공+0x10 이 일반 갈래와 같은 길로 간다.
 * 남은 마구 횟수는 줄지 않는다 — 0x345fc 가 모드 7 에서 소모 0x34894 앞에 끝난다(`magicPitchGame`).
 */
export function derbyPitcherOf(
  stage: number,
  aceLevels?: Readonly<Record<number, number>>,
  opponentTeamId?: number,
): DerbyPitcher {
  // 구질은 단계만 보고 갈린다 — `0x344dc` 가 `단계 > 0 ? 0x16 : 1` 이다
  const pitchType = stage > 0 ? DERBY_MAGIC_PITCH_TYPE : DERBY_ORDINARY_PITCH_TYPE
  const ace = derbyAcePitcherOf(stage)
  if (ace === null) {
    const ordinary =
      opponentTeamId === undefined
        ? { name: null, ability: LEGACY_ORDINARY_DERBY_PITCHER }
        : ordinaryDerbyPitcherOf(opponentTeamId)
    return { stage, ace: null, name: ordinary.name, ability: ordinary.ability, pitchType }
  }
  // 홈런더비(모드 7)는 0xaebb0 이 늘 100 — 피로(0xb58e6, 55 이상 그대로)도 지친 제구 등급도 없다
  return {
    stage,
    ace,
    name: ace.name,
    ability: pitcherAbilityOf(ace, aceLevels, HOME_RUN_DERBY_STAMINA_PERCENT),
    pitchType,
  }
}
