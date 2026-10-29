import { SLIDING_SOUND_EFFECT, SLIDING_SPEED_BONUS, autoSlideRunnerIndexes } from '@/entities/defense-controls/model/sliding'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { slidingRunnerOf } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **4b. 자동 슬라이딩** (0x52670 → 0xaf8fc → 제어기 vt10 = 0xb030c) — 원본은 경기 장면 슬롯 2 에서 자동 진루(0x52660) **바로 뒤**,
 * CPU 송구 결정(0x526ae) 앞에 매 틱 돈다. 사람/CPU·주루 설정 갈림이 없다. 슬라이딩시킨 주자가 하나라도 있으면 그 자리에서 효과음 10
 * (0x5267e `ble` → 0x5268c request(10)) — 사람 키와 달리 +0x31c 잠금도, 소리 재생 중 검사도 없다.
 *
 * 원본 그대로: 0xb030c 는 `주자+0x7c == 계획[+0xf]` 를 **mod 4 없이** 견준다(b0368~b036c).
 * 홈으로 가는 주자의 목표 루는 4(루 표 [4] = 홈 사본)이고 송구 목표 홈은 0 이라 **홈 송구로는 자동
 * 슬라이딩이 걸리지 않는다.** 고친 길(`bugfixes.json` B-57)은 `autoSlideRunnerIndexes` 가 주자 목표 4 를 0 으로 읽는다.
 *
 * **근사**: 원본 T = 계획[5](1구간 틱) − 공+0x68 이다. 웹은 송구 도착 틱 하나만 들고 있어
 * `송구 도착 틱 − 지금 틱` 을 쓴다(중계 송구면 원본은 첫 구간만 본다). "공.vt18() 거짓" 은
 * 송구가 날아가는 중으로 읽었다(R3 3-3). 메시지 처리기 0x519a4 의 같은 호출은 웹에 메시지 큐가 없어 뺐다.
 */
export function runAutoSlide(s: DefensePlayState, t: TickFrame): void {
  if (s.play.finished) return
  const throwInFlight = s.throwArrivalTick >= 0 && t.tick < s.throwArrivalTick
  const slid = autoSlideRunnerIndexes({
    isThrowInFlight: throwInFlight,
    throwTargetBase: throwInFlight ? s.throwBase : NONE,
    throwArrivalTicks: s.throwArrivalTick - t.tick,
    runners: s.runners.map(slidingRunnerOf),
  })
  for (const index of slid) {
    const runner = s.runners[index]
    runner.state = { ...runner.state, sliding: true, speed: runner.state.speed + SLIDING_SPEED_BONUS }
  }
  if (slid.length === 0) return
  t.slidingSoundThisTick = true
  t.tickSounds.push({ kind: 'sound', soundId: SLIDING_SOUND_EFFECT })
  s.log.push(`${t.tick}틱 자동 슬라이딩 — 주자 ${slid.join('·')}`)
}
