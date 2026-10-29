import type { BatterAbility } from '@/entities/pitching/model/simulateBatter/otherSlices'
import { UNWIRED_SITUATION } from '@/entities/pitching/model/simulateBatter/defaults'
import { truncated } from '@/entities/pitching/model/simulateBatter/truncated'
import type { BatterSituation, CpuSwingChoice } from '@/entities/pitching/model/simulateBatter/types'
import type { Pitch } from '@/entities/pitching/model/pitch'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { battingPatternChoiceOf, battingPatternOdds } from '@/shared/config/original/battingPatterns'
import { isInsideStrikeZone } from '@/shared/lib/geometry/coordinate'
import type { Coordinate } from '@/shared/lib/geometry/coordinate'

/**
 * 공 도착점 구역 0x341ec — 0·1 존 안 · 2 존을 사방 20px 넓힌 띠 · 3 그 밖.
 * 원본은 화면 픽셀로 잰다: 존 = (226,310,33,33) (0xcfb7c), 띠 = 사방 +20.
 * 웹 존 좌표는 존 반폭(16.5px)이 1 이므로 띠 경계는 (16.5+20)/16.5 이다.
 * (0 = 한가운데 16×16 은 여기서 1 과 똑같이 다루므로 나누지 않는다 — 둘 다 "무조건 진행")
 */
const NEAR_ZONE_LIMIT = (16.5 + 20) / 16.5

type SwingZone = '존' | '띠' | '밖'

function swingZoneOf(plate: Coordinate): SwingZone {
  if (isInsideStrikeZone(plate)) return '존'
  if (Math.abs(plate.x) <= NEAR_ZONE_LIMIT && Math.abs(plate.y) <= NEAR_ZONE_LIMIT) return '띠'
  return '밖'
}

/** 쫓아가기 문턱 — 존 밖 250 − h/4 · 띠 2000 − 3h/2. 존 안은 늘 진행이라 굴리지 않는다 */
const CHASE_THRESHOLD: Readonly<Record<SwingZone, ((hit: number) => number) | null>> = {
  존: null,
  띠: (hit) => 2000 - truncated((hit * 3) / 2),
  밖: (hit) => 250 - truncated(hit / 4),
}

/** 존 밖 공을 쫓아가나 — 원본 비교는 `rand > 문턱` 이면 그만둔다 = 같으면 쫓는다. 존 밖일 때만 한 번 굴린다 */
function rollChase(zone: SwingZone, hit: number, random: RandomPort): boolean {
  const threshold = CHASE_THRESHOLD[zone]
  if (threshold === null) return true
  const givesUp = random.rand(0, 10000) > threshold(hit)
  return !givesUp
}

/**
 * CPU 타자가 휘두르는가, 휘두른다면 표에서 무엇을 뽑았나 — 원본 0x34334
 * (사람이 투구할 때만 도는 길, 부르는 곳 0x51f26). 지켜보면 null.
 *
 * ```
 * choice = 0x9f224(0x9f190(pat, S, B, O, 주자))   ; rand(0,100) 한 번
 *   r < c0 → 0 치기 · r < c0+c1 → 1 번트 · 그 밖 2 지켜보기
 * if choice >= 2: 끝                              ; 지켜보기
 * zone = 0x341ec(공 도착점)
 * if zone == 3 and rand(0,10000) >  250 − h/4  : 끝
 * if zone == 2 and rand(0,10000) > 2000 − 3h/2 : 끝
 * → 그 밖에는 휘두른다
 * ```
 * 난수는 **표 뽑기 한 번은 늘**, **존 밖이고 휘두를 마음이 있을 때만 한 번 더** 돈다.
 *
 * **실투**(0x33cbc → `[+0xf98].byte8`, `mistakePitch.ts`)면 표 굴림 **뒤에** choice 를 0(치기)으로
 * 덮는다 (0x34376~0x3438e). 표 굴림은 그대로 하고, 존 밖이면 쫓아가기 굴림도 그대로 한다 —
 * 실투가 "무조건 휘두른다" 는 뜻은 아니다.
 *
 * h 는 **경기용 히트** `0xb570d(ctx=0xb8681(팀), 0, 타자, 1, 90, 1)` 다 (0x343be~0x343d4 —
 * 지켜보기면 부르지 않는다). 셋째 인자 1 은 보정 적용, 다섯째 90 은 체력 인자라 피로 감소가 없다
 * (P7 G1) — 장비·스킬·질병·부상·사기·팀 보정이 붙은 값이다. 이 모듈은 넘겨받은 `ability.hit` 를
 * 그 값으로 믿는다: 타이밍 0x340f8 도 같은 식으로 다시 부른다(0x3413e).
 * ⚠️ 부르는 쪽이 날 레코드 히트를 넘기면 원본과 달라진다 (`pitchAgainstBatter` 주석 참고).
 */
export function cpuSwingChoiceOf(
  pitch: Pitch,
  ability: BatterAbility,
  random: RandomPort,
  situation: BatterSituation = UNWIRED_SITUATION,
  isMistakePitch = false,
): CpuSwingChoice | null {
  const odds = battingPatternOdds(situation.strikes, situation.balls, situation.outs, situation.hasRunner)
  // 0x9f224 — rand(0,100), 위끝 제외
  const drawn = battingPatternChoiceOf(odds, random.rand(0, 100))
  // 0x34376 — 실투면 뽑은 것을 버리고 0(치기)
  const choice = isMistakePitch ? '치기' : drawn
  if (choice === '지켜보기') return null
  return rollChase(swingZoneOf(pitch.plate), ability.hit, random) ? choice : null
}

/** CPU 타자가 휘두르는가 — `cpuSwingChoiceOf` 에서 치기·번트를 가리지 않은 것 */
export function willSwing(
  pitch: Pitch,
  ability: BatterAbility,
  random: RandomPort,
  situation: BatterSituation = UNWIRED_SITUATION,
  isMistakePitch = false,
): boolean {
  return cpuSwingChoiceOf(pitch, ability, random, situation, isMistakePitch) !== null
}
