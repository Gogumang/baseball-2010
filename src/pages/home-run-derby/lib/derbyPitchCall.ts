import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { pitchCallSoundIdOf } from '@/features/play-at-bat/model/atBatSounds'

/**
 * **홈런더비의 판정 코드와 심판 콜** — 홈런더비도 일반 경기와 같은 판정 길을 탄다 (직접 떴다):
 * ```
 * 0x9d57c  공 판정 v:  사구면 4 · 스트라이크(헛스윙 포함)면 st[4] > 1 ? 5 : 1 · 볼이면 st[5] > 2 ? 3 : 2
 * 0x3dfac  표 0xcffb4[v − 1]:
 *   v1 0x3e134  0xa5e00 … ; 3e14a 모드(+0x1104) == 7 이면 st[4]++ 를 건너뛴다     ← 스트라이크는 안 센다
 *   v2 0x3e156  st[5]++                                         ← 볼은 모드를 안 본다 (원본 버그 그대로)
 *   v3 0x3e1ae  st[5]++ → v4 로 흘러든다
 *   v4 0x3e1b4  0xaf020(공격 팀, 0) · 0xb0cb8(플레이, 2)
 *   → 3e1da st[0xc] = v · 메시지 0xbba(v)
 * 0x51a56  (화면) 0xbba 처리 — 모드 검사 없이 v 로 소리를 고른다 (`pitchCallSoundIdOf` 표: 18 · 16 · 24 · 23)
 * ```
 * 볼카운트 st[4] · st[5] 를 지우는 곳은 상태 0xd 진입 0x48d50 의 0x48e9c(`0xb6764`) 뿐이다 — 홈런더비의 0xd 는 첫 공 앞 ·
 * 마투수 단계가 오를 때 · 보너스 게임을 열 때다. 그래서 더비에서는:
 * - 스트라이크 · 헛스윙은 st[4] 가 늘 0 이라 늘 v1 → **18** "Strike!" (39 · 삼진 21 은 안 난다).
 * - 볼은 마지막 0xd 뒤 셋째까지 v2 → **16**, 넷째부터는 st[5] > 2 라 v3 → **24** "Base on balls!" (볼 수는 계속 오른다).
 * - 사구는 v4 → **23** (진동 200ms 는 타석 화면이 낸다 — `pitchVibration`).
 * 볼넷 뒤 함성 29 는 공격 팀이 CPU 일 때만이라(0x51adc) 사람이 치는 더비에선 없다.
 * 파울 · 맞은 공은 판(0x17)이 콜을 낸다 — 여기서는 null.
 */
export interface DerbyPitchCall {
  /** 이 공을 먹인 뒤의 볼 수 st[5] */
  readonly balls: number
  /** 0x9d57c 의 판정 코드 — 1 스트라이크 · 2 볼 · 3 볼넷 · 4 사구. 판정 스위치를 안 타는 공(맞은 공)은 null */
  readonly judgment: 1 | 2 | 3 | 4 | null
  /** 심판 콜 번호 (없으면 null) */
  readonly soundId: number | null
}

/** 볼넷 판정 문턱 — 0x9d5ac `cmp r3,#2 ; bgt` → v3 */
const WALK_BALLS_ABOVE = 2

export function derbyPitchCallOf(resolution: PitchResolution, balls: number): DerbyPitchCall {
  switch (resolution.kind) {
    case '사구':
      return { balls, judgment: 4, soundId: pitchCallSoundIdOf(resolution, { balls, strikes: 0, outcome: null }) }
    case '스트라이크':
      // 0x3e14a — 모드 7 은 st[4]++ 를 건너뛰어 스트라이크 수가 늘 0 이다
      return { balls, judgment: 1, soundId: pitchCallSoundIdOf(resolution, { balls, strikes: 1, outcome: null }) }
    case '볼': {
      const isWalk = balls > WALK_BALLS_ABOVE
      const after = balls + 1
      return {
        balls: after,
        judgment: isWalk ? 3 : 2,
        soundId: pitchCallSoundIdOf(resolution, { balls: after, strikes: 0, outcome: isWalk ? { kind: '볼넷' } : null }),
      }
    }
    case '파울':
    case '타구':
      return { balls, judgment: null, soundId: null }
  }
}

/**
 * **맞지 않은 공의 대기 갱신 수** — 상태 0x12 갱신 0x4e6d4(0x4e6de~0x4e730): st[0xb](판정 코드) ∈ {3, 4, 5} 면 0x1f(31),
 * 아니면 0xf(15). 상태 틱(+0x2c)이 이 값에 닿아야 0xae24c(또는 벤치 클리어링 굴림)로 간다.
 */
export function derbyNoContactWaitFramesOf(judgment: DerbyPitchCall['judgment']): number {
  return judgment === 3 || judgment === 4 ? 31 : 15
}
