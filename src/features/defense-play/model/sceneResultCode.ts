import type { PitchResolution } from '@/entities/at-bat/model/atBatState'
import { contactOfOutcome, type BattedContact } from '@/entities/batting/model/battedContact'

/**
 * **경기 +0xfd4 — 스윙 판정 결과 코드 칸** (쓰는 곳 · 지우는 곳 전수, 직접 재역어셈):
 * ```
 * 3deea   상태 0x11(투구 비행) 진입 0x3de10:  [경기+0xfd4] = 0            ; **공마다** 지운다 (fd2 · fdc · fe0 와 같이)
 * 512fa   메시지 0x6aa(공이 타자 근처) 스윙 판정:  0xab214(out = sp+0xc4, …)
 * 5130e     ldm/stm 12바이트 out → 경기+0xfcc..+0xfd7                   ; fcc 각 · fce 세기 · fd0 높이 · fd2 맞음 · fd4 결과 코드
 * 51456   맞은 공 · 코드 ∈ {0,3,9,15,18,21,24}(5136e 비트 0x1248209):  [경기+0xfd4] += 방향(0x9d729)   ; 방향까지 붙인 결과 코드
 * ```
 * 이 밖에 +0xfd4 를 쓰는 곳은 없다(리터럴 0xfd4 여섯 곳 · 0xfcc 아홉 곳 · 0xfd0 기준 접근 · memset 호출 전수 — 0x340dc 는
 * +0xfd8 부터 12바이트, 0x3e380 은 +0xfa0 부터 8바이트라 안 닿는다). 장면 객체는 할당기 0x2ac4 가 0 으로 비워(장면 공통 — F 문서, 경기 장면은 유력) 처음은 0 이다.
 *
 * **헛스윙**: 0xab214 는 맞음(out+6)만 0 으로 적고 out+8(결과 코드)을 **안 쓴다**(abe90 · abeb4 → abf7a). out 은 0x509a0 의
 * 지역 칸 sp+0xc4 라 아무도 미리 안 채워, 5130e 가 그 자리에 남아 있던 스택 값을 +0xfd4 로 옮긴다 — 원본에서도 정해지지 않는다.
 * ⚠️ 미확인(원본 미정의): 그 값은 `null` 로 둔다(파티클 · 홈런성 조건이 거르지 않는 쪽 — 이전 웹과 같다).
 * 판정(0x6aa)을 안 탄 스윙은 51308 을 안 지나 0 이 맞지만, 웹의 투구 결과(`PitchResolution`)는 두 헛스윙을 가르지 않아 같이 `null` 이다.
 *
 * 그래서 주자 판이 보는 값은:
 * - 공 도착 판(도루 · 폭투 · 포일 · 밀어내기 — 상태 0x12): **이 공**의 값. 안 휘두른 공이면 0, 헛스윙이면 정해지지 않음.
 * - 견제 판(상태 0xf → 0x17, 0x11 을 안 지난다): **앞 공**의 값 — 앞 공이 파울이면 그 파울 코드, 새 타석 첫 공 앞이면 앞 타석
 *   마지막 공(친 공이면 그 타구 코드 — 홈런이면 24~26)이 남는다. 간이 엔진 타석(0x21)은 0x11 을 안 지나 손대지 않는다.
 */
export const SCENE_RESULT_CODE_START = 0

/**
 * 공 하나가 지나간 뒤의 [경기+0xfd4] — 0x11 진입이 0 으로 지우고, 휘두른 공만 스윙 판정이 덮는다.
 * `hitCode` 는 맞은 공(파울 · 타구)의 방향까지 붙인 결과 코드. 모르면 null.
 */
export function sceneResultCodeAfterPitch(resolution: PitchResolution, hitCode?: number | null): number | null {
  if (resolution.kind === '파울' || resolution.kind === '타구') return hitCode ?? null
  // 헛스윙 — out+8 을 안 쓴 스택 값 (위 머리말)
  if (resolution.kind === '스트라이크' && resolution.isSwinging) return null
  return SCENE_RESULT_CODE_START
}

/**
 * CPU 타자의 공(`simulateBatter` 결과) 뒤의 [경기+0xfd4] — 맞은 공의 코드는 판을 돌 파울 각 공(`foulContact`)이나
 * 타구 결과에 묶인 쏜 공(`contactOfOutcome`)에서 읽는다.
 */
export function sceneResultCodeOfThrown(resolution: PitchResolution, foulContact?: BattedContact): number | null {
  const contact = foulContact ?? (resolution.kind === '타구' ? contactOfOutcome(resolution.outcome) : undefined)
  return sceneResultCodeAfterPitch(resolution, contact?.resultCode)
}
