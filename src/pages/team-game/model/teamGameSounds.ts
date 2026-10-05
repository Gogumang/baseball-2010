import { BURST_SOUND } from '@/entities/burst-mission/model/burstMissionJudge'
import type { BurstResolution } from '@/entities/burst-mission/model/burstMissionSession'
import { BURST_START_SOUND } from '@/features/play-game/model/gameSounds'

/**
 * 경기 **진행**에서 나는 소리 — `features/play-game/model/gameSounds` 의 `gameStepSoundIdsOf`
 * 와 규칙이 같다. 원본은 어느 모드든 같은 경기 장면(0x104)이라 자리도 하나다.
 *
 * ⚠️ 저쪽 함수는 나만의리그 진행기 타입(`GameProgress`)을 받게 돼 있어 팀경기·투수편 진행 상태를
 * 그대로 못 넘긴다. 그래서 **정말로 보는 칸만** 적은 이 모양으로 다시 적었고, 번호는 저쪽 상수를
 * 그대로 가져다 쓴다 — 한쪽을 고치면 다른 쪽도 같이 고쳐야 한다.
 *
 * 근거: docs/re/L-sound-effects.md 1-F · docs/re/R10-game-states.md (상태 0x18) ·
 *       docs/re/K-bursts-special.md 4절.
 */
export interface SoundStepProgress {
  readonly game: {
    readonly half: unknown
    readonly inning: number
    readonly isFinished: boolean
  }
  readonly burst: { readonly current: unknown } | null
  readonly lastBurstResolution: BurstResolution | null
}

/**
 * 진행 한 걸음 사이에 울릴 번호들 — 원본이 나는 순서대로 담는다.
 *
 * 1. **돌발 판정** (0x8f414 → 0x8e5b8): 성공 36 · 실패 32 · 무효 37.
 * 2. **돌발 발동** 42 (0x8f000): 새 돌발이 떴을 때.
 *
 * 공수 교대 징글 13(0x4f7ac)은 **판이 서서 OK 를 기다릴 때만** 틱 2 에 난다 — 반 이닝이 바뀔 때마다가
 * 아니다(자동진행 중계 0x21 로 빠지면 안 난다). 그래서 판을 띄우는 `TeamGameScreen` 이 낸다.
 */
export function stepSoundIdsOf(
  before: SoundStepProgress,
  after: SoundStepProgress,
): readonly number[] {
  const ids: number[] = []

  const resolution = after.lastBurstResolution
  if (resolution !== null && resolution !== before.lastBurstResolution && resolution.judgement !== null) {
    ids.push(BURST_SOUND[resolution.judgement])
  }

  if (before.burst?.current == null && after.burst?.current != null) ids.push(BURST_START_SOUND)

  return ids
}

/**
 * **"Time!" 22** — `#` 교체 화면(경기 상태 0xb)에 **들어설 때**. 투수 교체와 **대타가 같은 화면**이라
 * (진입 함수가 하나뿐이다) 대타 쪽도 이 소리로 들어간다.
 *
 * 원본 상태 0xb 진입 `0x3ae08` 은 마지막에 조건 없이 `play(소리, 0x16, -1, 0)` 를 부른다
 * (0x3af06; 상태→진입 함수 표는 docs/re/I-controls.md 1절 "0xb 0x3ae08(교체)").
 * 같은 22 를 트는 다른 자리는 타석 준비 0xf 진입 `0x3d954` 에서 CPU 대타(`0xac228`, 3da70)나 CPU 투수 교체
 * (`0xac428`, 3da3e)가 걸려 교체 연출 0x16 으로 넘어갈 때(3da88 `0x6ea6d(소리, 0x16, −1, 0)` → 3da94 상태 0x16)다.
 * CPU 대타 쪽은 `pinchHitSoundIdsOf` 가 잇는다. CPU 투수 교체 쪽은 웹이 사람 장면에서 그 판정을 안 돌려
 * (`teamGameFlow.prepareAtBat` 주석) 아직 없다.
 *
 * ⚠️ L 노트가 0x3ae08 을 "경기 중 창" 으로 적어 두었지만 **경기 중 메뉴('\*', 0x3c158)에서는
 *    안 난다** — 0x3c158 이 트는 것은 소리 크기 미리듣기 5 뿐이다 (L 1-F).
 */
export const PITCHER_CHANGE_SOUND = 22

/* ── 투수 등판음 14 / 15 / 26 (경기 상태 0xe, 예약 0x38c34) ───────────────────── */

/** 보통 등판 */
export const PITCHER_ENTRY_SOUND = 14
/** 득점권(2·3루)에 주자를 두고 올라올 때 */
export const PITCHER_ENTRY_CRISIS_SOUND = 15
/** 마선수가 올라올 때 */
export const ACE_ENTRY_SOUND = 26

export interface PitcherEntrySoundInput {
  /** 올라오는 투수가 마투수인가 — 원본 `0xb633c(레코드) = 레코드[0xa] & 0x40` 이다 */
  readonly isAce: boolean
  readonly bases: { readonly second: boolean; readonly third: boolean }
}

/**
 * **투수 교체로 새 투수가 마운드에 설 때 나는 소리** — 원본 `0x38b64` 의 투수 가지 (직접 떴다).
 *
 * ```
 * 38b90: 경기 상태 [obj+0x1c] != 0xe 면 아무것도 안 한다
 * 38ba2: [obj+0x195c] 비트1 이 꺼져 있으면 안 한다        ; 투수 소개 예약
 * 38bae: r6 = 0xae83c([obj+0x224])                      ; **수비 팀**의 마운드 투수 레코드
 * 38bf2: 0xb633c(r6)  != 0  → 0x38c2c  소리 0x1a = 26    ; 레코드[0xa] & 0x40 = 마선수
 * 38bfc: 0xa97a0([obj+0x20c], 2) != 0 → 0x38c1c 소리 0xf = 15   ; 2루에 주자
 * 38c10: 0xa97a0([obj+0x20c], 3) != 0 → 0x38c1c 소리 0xf = 15   ; 3루에 주자
 * 38c24:                              그 밖 소리 0xe = 14
 * 38c34: 0x6e498(소리, 번호, 0)                          ; 예약 = 한 칸 덮어쓰기
 * ```
 *
 * **언제 서는가 — 확정.** `+0x1959`·`+0x195c` 비트1 을 켜는 곳은 **경기 상태 0x16(교체 연출)
 * 진입 `0x3d458` 하나**뿐이고, 그 조건은 `0xae9a0(수비팀, 0)` = **`team[+0x290]`(투수 교체 예약)**
 * 이다 (0x3d58c). 같은 함수가 곧바로 `0xaebe4`(교체 확정)를 부른다 (0x3d634).
 * 곧 이 소리는 **교체를 확정한 투수가 올라올 때만** 나고 경기 첫 선발에는 안 난다 —
 * 예약 칸이 비어 있어 0x16 을 지나지 않기 때문이다.
 * (문서 R2 8절이 "투수 첫 등장(유력)" 으로 적어 둔 자리를 여기서 확정으로 바꿨다.)
 *
 * 같은 함수의 **타자 가지**(인자 3 이 0 — 타자 그리기 0x49e64 가 49f76 에서 부른다, `+0x195c` 비트0 =
 * 0x3d458 의 대타 예약 `0xae9a0(공격팀, 1)` 가지)도 번호를 **똑같이** 26/15/14 로 고른다 — 공격 팀 타자
 * `0xae89d([게임+0x220])`(38c4c)를 보고, 예약이 아니라 즉시(38cd4 `0x6ea6d`)다. → `pinchHitSoundIdsOf`.
 *
 * ⚠️ **웹이 안 이은 자리**: CPU 투수 교체는 웹에서 *자동으로 넘기는 타석* 안에서만 일어나는데,
 * 원본의 그 자리는 간이 엔진(`0xc1ba4`)이라 연출·소리가 없다. 그래서 `#` 로 사람이 바꾼
 * 교체에만 이었다.
 */
export function pitcherEntrySoundIdOf(input: PitcherEntrySoundInput): number {
  if (input.isAce) return ACE_ENTRY_SOUND
  return input.bases.second || input.bases.third ? PITCHER_ENTRY_CRISIS_SOUND : PITCHER_ENTRY_SOUND
}

/* ── 대타 교체 소리 (교체 연출 상태 0x16 을 지날 때) ─────────────────────────────── */

/** 사람 경기 장면에서 지난 대타 교체 한 번 — `TeamGameProgress.scenePinchHit` 과 같은 모양 */
export interface ScenePinchHitCue {
  readonly serial: number
  readonly by: '사람' | 'CPU'
  readonly incomingIsAce: boolean
}

export interface PinchHitSoundProgress {
  readonly scenePinchHit: ScenePinchHitCue | null
  readonly game: { readonly bases: { readonly second: boolean; readonly third: boolean } }
}

/**
 * **대타가 교체 연출(상태 0x16)을 지나 타석에 설 때 나는 소리** — 원본 순서대로.
 *
 * 1. CPU 대타면 먼저 **"Time!" 22**: 0xf 진입 `0x3d954` 가 `0xac228` 참을 받자마자 `0x6ea6d(소리, 0x16, −1, 0)`
 *    (3da88) 를 부르고 상태 0x16 을 예약한다 (3da94). 사람 대타는 이 22 를 `#` 교체 창 진입(0x3ae08)에서 이미
 *    냈다 — 화면(`TeamGameScreen`)이 창을 열 때 낸다 — 그래서 여기서는 안 낸다.
 * 2. 0x16 진입 `0x3d458` 이 대타 예약을 보고 `+0x195c` 비트0(마선수면 5)·`+0x1959` 를 세우고 → 0xd → 0xe 에서
 *    타자 그리기 `0x49e64` → `0x38b64(…, 0)` 타자 가지가 **들어온 타자**로 26/15/14 를 즉시 낸다
 *    (마선수 26 · 2루나 3루 주자 15 · 그 밖 14 — 투수 가지와 같은 고르기, `pitcherEntrySoundIdOf`).
 *
 * 사람 장면을 안 지난 CPU 대타(간이 엔진 0xc1ba4)는 연출도 소리도 없다 — 진행기가 `scenePinchHit` 을 안 바꾼다.
 * ⚠️ 0x38b64 는 `[게임+0xf10]+0x64 == 0` 일 때만 낸다(38b78) — 그 칸의 뜻은 안 읽었다.
 */
export function pinchHitSoundIdsOf(
  before: PinchHitSoundProgress,
  after: PinchHitSoundProgress,
): readonly number[] {
  const cue = after.scenePinchHit
  if (cue === null || cue === before.scenePinchHit) return []
  const entry = pitcherEntrySoundIdOf({ isAce: cue.incomingIsAce, bases: after.game.bases })
  return cue.by === 'CPU' ? [PITCHER_CHANGE_SOUND, entry] : [entry]
}
