import { balanceNumber } from '@/shared/config/balance'
import { abilityGradeOf } from '@/entities/fielding/model/fieldGeometry'

/** 송구 공 속도 (0xa0fc4). g = 등급 + 1, 선수가 없으면 g = 2. 940 · 8 은 숨은 판정값 표 `fielding.throwSpeedBase` · `fielding.throwSpeedPerGrade` */
export function throwSpeedOf(defenseGrade: number, teamBonus = 0): number {
  return balanceNumber('fielding.throwSpeedBase') + balanceNumber('fielding.throwSpeedPerGrade') * (defenseGrade + 1) + teamBonus
}

/** 악송구 보정 +0xe4 = cfg+0x2c(2) − 등급 + 8 = 10 − 등급 (0xb0fb4) */
export function throwErrorBiasOf(defenseGrade: number): number {
  return 10 - defenseGrade
}

/**
 * **판 시작 0xb0fb4 가 선수를 찾지 않는 칸 — 투수(칸 0).** 직접 재역어셈:
 * ```
 * b1018  칸 i = 0..8:
 * b1032    cmp r4,#0 ; beq b1062          ; i == 0 → 선수 찾기(b103e 고리)를 건너뛴다 — r5(선수) = 0
 * b106a    r0 = 2 ; 선수 있으면 r0 = 0xbbe98(0xb570d(ctx, 2, 선수, 90, 1)) + 1     ; g
 * b108c    사거리 +0x8c = g × cfg+0x28 · 송구 속도 v = cfg+0x1a(940) + cfg+0x2a(8) × g  → 0xa0fc4(야수, v)
 * b10a2    r0 = 2 ; 선수 있으면 r0 = 0xbbe98(...)                                    ; **+1 이 없다**
 * b10c4    악송구 보정 +0xe4 = cfg+0x2c(2) − r0 + 8
 * b1184    선수를 찾은 칸만 야수+0xec = 선수                                         ; 칸 0 은 안 쓴다
 * ```
 * 그래서 칸 0 은 **어느 모드든** 송구 속도 g = 2(= 940 + 16), 악송구 보정 8 이다(둘 다 r5 로 세고 +0xec 는 안 본다).
 * 능력치 하나로는 이 둘을 나타낼 수 없다(g = 2 는 등급 1, 보정 8 은 등급 2 의 값) — 송구 쪽은 이 칸의 능력치를 **읽지 않는다**.
 *
 * 그러나 야수+0xec 는 이 함수가 칸 0 에 쓰지 않을 뿐 비우지도 않는다 — **공수 교대 판 0x3fac4** 가 3fe0a~3fe4c 에서 야수 아홉
 * ([장면+0x111c+4i])마다 수비 팀(팀[st[0xa]], 3fd3c~3fd4e) 레코드 차례로 자리 니블 == i + 1 인 첫 선수를 +0xec 에 넣는다 —
 * 칸 0 은 니블 1 = **지명타자**다. +0xec 를 읽는 펌블(b41e4 → 표 0xd87d4[등급]) · 레이저(66a94 → 66aba 등급) 굴림은 그래서
 * 투수 칸이면 그 지명타자의 수비로 돈다(`recordPlayerAbilityOf`).
 * 0x3fac4 는 공수 교대 판이 서서 OK 를 기다릴 때만 불려(4fb20 — 가드 3fad0 · 3fade · 3fae8) 판이 안 선 반 이닝 뒤에는 앞 판의 값이 남고,
 * 장면을 만든 뒤 첫 판 앞에는 0(new 의 memset)이다 — 진행기가 그 칸을 장면 동안 들고(`entities/fielding/model/fielderRecords`)
 * 능력치 배열의 칸 0 에 그 레코드의 수비를, 비었으면 null 을 넣는다.
 */
export const UNSEARCHED_FIELDER_SLOT = 0

/** 선수 없는 칸의 악송구 보정 — b10a2 r0 = 2 → cfg+0x2c(2) − 2 + 8 */
export const NO_PLAYER_THROW_ERROR_BIAS = 8

/**
 * 판 시작 0xb0fb4 가 찾은 **선수 수비 능력치** — 칸 0(투수)은 선수가 없어 `null` 이다(`UNSEARCHED_FIELDER_SLOT`).
 * 악송구(`rollThrowError` — 보정 +0xe4 는 b10a2 의 r5)가 `null` 을 "선수 없음"(보정 8)으로 읽는다.
 * 펌블 · 레이저는 +0xec 를 보므로 `recordPlayerAbilityOf` 를 쓴다.
 */
export function fielderAbilityOf(defenseAbilities: readonly (number | null)[], slot: number, fallback: number): number | null {
  if (slot === UNSEARCHED_FIELDER_SLOT) return null
  return defenseAbilities[slot] ?? fallback
}

/**
 * 야수 **+0xec 선수**의 수비 능력치 — 펌블(b41e4) · 레이저(66a94)가 읽는 칸. 칸 1~8 은 판 시작 b1184 가, 칸 0 은 공수 교대 판
 * 0x3fac4 가 넣은 지명타자다(`UNSEARCHED_FIELDER_SLOT` 머리말). 능력치 배열의 칸 0 은 진행기가 든 그 레코드의 값이고
 * **null 은 +0xec 가 0** 인 칸이다 — 펌블은 표 대신 0(b41e4 beq b4224), 레이저는 굴리지 않는다(66aa6). 칸이 아예 없으면 `fallback`.
 */
export function recordPlayerAbilityOf(defenseAbilities: readonly (number | null)[], slot: number, fallback: number): number | null {
  const ability = defenseAbilities[slot]
  return ability === undefined ? fallback : ability
}

/**
 * **수비 팀 보너스** — 판 시작 0xb0fb4 의 b10d0~b10f2 (직접 재역어셈):
 * ```
 * b0fd0    팀레코드 = 0xb8680(팀[st[0xa]])      ; [sp+0x24] — 수비 팀의 레코드(명부). 0xb570c 에도 같은 값을 넘긴다
 * b0ff4    [sp+0x14] = 전역 모드 0x1552d10 ∈ {1, 2, 8, 9}
 * b10d0    [sp+0x14] 면:  b = 0xbbe98(s16 팀레코드+8)          ; 팀 능력치 셋째 칸 '집중'의 등급 0~7
 * b10e6      사거리 +0x8c 값 += b      ; (+0x8c 는 읽는 곳이 없다 — P2 1c, 웹에 칸이 없다)
 * b10f2      송구 속도 v += b          ; 940 + 8·g 를 다 센 **뒤** — 0xa0fc4(야수, v) 가 +0xd4 · +0xdc = v, +0xd8 = v·130/100
 * ```
 * 악송구 보정 +0xe4(b10c4)는 이 갈래 **앞**에 이미 sp+8 에 적혀 보너스를 안 받는다. 칸 0(투수)도 고리 안이라 같이 받는다 —
 * g = 2 고정(b106a)으로 센 940 + 16 에 b 를 더한다. 팀레코드 +4·+6·+8·+0xa = 투구·타격·집중·근성(구단정보 0x7bf9c 표 0xd48b8).
 */
export const DEFENSE_TEAM_BONUS_MODES: readonly number[] = [1, 2, 8, 9]

/** b10d0 — 모드가 1·2·8·9 면 `0xbbe98(팀 집중)`, 아니면 0 */
export function defenseTeamBonusOf(mode: number, teamConcentration: number): number {
  if (!DEFENSE_TEAM_BONUS_MODES.includes(mode)) return 0
  return abilityGradeOf(teamConcentration)
}

/**
 * **주자 속도의 팀 등급** — 주자 만들기 0xa93ac 의 a9482~a94a4 (직접 재역어셈):
 * ```
 * a946c    v = 0xb570c(팀레코드, 3, 선수, 90) × cfg[+0x16](=7) / 100     ; 주루 능력치
 * a9482    m = 전역 모드 0x1552d10
 * a9488    m == 2 || m == 1 || m == 8 이면:  v += 0xbbe98(s16 팀레코드+0xa)   ; 팀 능력치 넷째 칸 '근성'의 등급 0~7
 * a94a4    주자+0xa4 = v                ; 달리기 속도 vt64 0xa092c = cfg[+0x14](300) + 주자+0xa4
 * ```
 * 팀레코드(셋째 인자)는 **주자의 팀**이다 — 루 위 주자 0xa9a10(a9a3e `0xb8680(팀)`, 주자 = `0xae8b8(팀, 루)`) ·
 * 타자주자 0x46418(4650e, 타자 = `0xae89c(팀)`) 모두 공격 팀을 넘긴다. 수비 보너스(b10d0, 1·2·8·9)와 달리 **모드 9 가 빠진다**.
 */
export const RUNNER_TEAM_GRADE_MODES: readonly number[] = [1, 2, 8]

/** a9488 — 모드가 1·2·8 이면 `0xbbe98(공격 팀 근성)`, 아니면 0 */
export function runnerTeamGradeOf(mode: number, teamGrit: number): number {
  if (!RUNNER_TEAM_GRADE_MODES.includes(mode)) return 0
  return abilityGradeOf(teamGrit)
}
