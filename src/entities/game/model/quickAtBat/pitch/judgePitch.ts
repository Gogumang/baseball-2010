import { BALLS_BEFORE_WALK, STRIKES_FOR_STRIKEOUT } from '@/entities/game/model/quickAtBat/constants'
import { tiredStatsOf } from '@/entities/game/model/quickAtBat/pitch/pitchGrade'
import type { PitchJudgement, QuickAtBatPitcher } from '@/entities/game/model/quickAtBat/types'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 스트라이크존에 넣을 확률 (0xc1818).
 *   기준 = 65 − (내 육성 선수면 10) − trunc((제구 + 구속) ÷ 50)
 *   `rand(0,100) > 기준` 이면 존 안이다. 투수가 좋을수록 기준이 낮아져 스트라이크가 늘어난다.
 */
const STRIKE_ZONE_BASE = 65
/** c182a `0xb6389(투수)` = 레코드 +0xa 비트7(육성·명전 — 마선수는 비트6 이라 아니다) 이면 ×10 (c1880 `movs r3,#0xa`) */
const OWN_PLAYER_STRIKE_BONUS = 10
const PITCHER_STAT_DIVISOR = 50

/** 존 기준 — c1852·c1878 은 0xb570c 를 체력%(0xaebb0)로 부른다 */
function strikeZoneThresholdOf(pitcher: QuickAtBatPitcher): number {
  const ownBonus = pitcher.isOwnPlayer === true ? OWN_PLAYER_STRIKE_BONUS : 0
  const tired = tiredStatsOf(pitcher)
  return STRIKE_ZONE_BASE - (ownBonus + Math.trunc((tired.control + tired.velocity) / PITCHER_STAT_DIVISOR))
}

/**
 * 스윙하지 않는 투구의 판정 (0xc1818 → 0x9d57c).
 *
 * **간이 엔진에서는 사구(코드 4)가 나오지 않는다** (확정). 0x9d57c 는 state[0x12] 가 서 있을 때만 4 를
 * 돌려주는데, 이 칸에 쓰는 코드는 바이너리 전체에서 둘뿐이다 (`strb …,#0x12` 전수 검색):
 *   - 0x3dfc8 — 사람 경기 장면의 공 도착 판정 0x3dfac 가 사구 판정 0x35a20 결과를 넣는다
 *   - 0xb67f6 — 플레이 칸 지우기 0xb67d0 의 0 쓰기. 다음 타자 진입(상태 0xd 0x48d50 → 0xb68bc)과
 *     간이 엔진 쪽 0xc0ee8(→ 0xb68bc) 이 부른다
 * 간이 엔진 루프(0xc262c)는 0x3dfac 를 지나지 않으므로 이 칸이 늘 0 이다 → 판정은 1·2·3·5 만 나온다.
 * 사람 타석의 사구는 `features/play-at-bat/model/resolvePitch.isHitByPitch` 가 맡는다.
 * state[0x10](존 밖인데도 스트라이크로 치는 칸 — 9d58e `r1 == 0 && state[0x10] == 0` 일 때만 볼 쪽)은 **늘 0 이다 (확정, 2026-10 r87)**:
 * 이 칸에 0 이 아닌 값을 쓰는 곳은 사람 장면 공 도착 판정 0x3dfac 의 `state[0x10] = 스윙 객체 +0xe`(0x3dfbe, "휘둘렀나") 하나이고,
 * 간이 구역(0xc0d00~0xc2c00)에는 `strb …,#0x10` 이 없다. 0xc262c 는 타석 호출마다 머리에서 0xc0ee8 → 0xb68bc → 0xb67d0 을 불러
 * `state[0x10] = 0`(b67f0)으로 지운다.
 */
export function judgePitchOf(pitcher: QuickAtBatPitcher, strikes: number, balls: number, random: RandomPort): PitchJudgement {
  const isInsideZone = random.rand(0, 100) > strikeZoneThresholdOf(pitcher)
  if (!isInsideZone) return balls <= BALLS_BEFORE_WALK - 1 ? '볼' : '포볼'
  return strikes <= STRIKES_FOR_STRIKEOUT - 2 ? '스트라이크' : '삼진'
}
