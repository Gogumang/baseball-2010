import { clearSceneParticles } from '@/entities/particle/model/sceneParticleManager'
import { resetSceneResultCode } from '@/widgets/batting-stage/model/sceneResultCodeStore'
import { resetSceneCloudClock } from '@/widgets/batting-stage/model/sceneCloudClock'

/**
 * **경기 장면 객체(0x104)를 내린다** — 장면을 나가는 길이 모두 여기로 모인다:
 * ```
 * 0x332b8  장면 소멸: 332dc~332e2 0x6dee4([0x1400068]) — 파티클 관리자를 비운다(굴림 없음) · 332ec 0x8fc70(효과 칸)
 * 0x3c0b8  0x1a(홈런더비 결과) 갱신: 페이드가 끝나 0x103 으로 넘길 때 3c110~3c11e +0x57 = 0 · 0x6dee4
 * 0x4b100  0x19(정산) 갱신: 0x103 으로 나갈 때 4b3aa~4b3b8 +0x57 = 0 · 0x6dee4
 * ```
 * 구장 [장면+0xf10] 도 장면과 함께 사라지고 다음 장면의 상태 7 이 새로 만든다 — 구름 셈을 되돌린다(`sceneCloudClock`).
 * 다음 경기 장면은 장면 전환 0x3874 가 new(0x1b80)(0 채움)로 새로 세우므로 [장면+0xfd4] 도 0 에서 시작한다(`sceneResultCodeStore`).
 * 앱은 경기 장면 화면이 다 내려갈 때, 홈런더비는 같은 화면에서 장면을 새로 세울 때(결과 창 [예] · 다시하기 — 0x27) 부른다.
 */
export function leaveGameSceneObject(): void {
  clearSceneParticles()
  resetSceneResultCode()
  resetSceneCloudClock()
}
