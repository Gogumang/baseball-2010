import { registerSnapshotSlot } from '@/shared/lib/dev/snapshotSlots'
/**
 * **경기 장면 객체의 결과 코드 칸 [장면+0xfd4]** — 타석 장면 부품(`BattingStage`)이 내려갔다 다시 서도(수비 판을 다녀와도) 이어지게
 * 경기 장면(0x104) 동안 하나만 둔다. 원본에서 이 칸은 장면 객체의 것이라 장면이 사는 동안 산다(2026-10-16 직접 떴다):
 * ```
 * 0x3874   장면 전환 — 0x38bc new(0x1b80)(0x1238 → 0x2ac4 자체 힙 + 0 채움) → 0x3316c 생성자 → 0x3301c   ; 장면마다 새 객체 · 처음 0
 * 3dee4    0x11 진입 0x3de10: r2 = 0xfe0 − 0xc = 0xfd4 → 3deea str r4(0) — [+0xfd4] = 0                 ; **공마다** 지운다
 * 5130e    메시지 0x6aa 스윙 판정: 0xab214 의 12 바이트 out → +0xfcc..+0xfd7(stm)                          ; fd4 = 결과 코드
 * 51456    맞은 공 · 코드 ∈ {0,3,9,15,18,21,24}: [+0xfd4] += 방향(0x9d729)
 * 0x332b8  장면 소멸 — 장면 0x104 를 나가면 객체도 사라진다(다음 경기는 새 객체)
 * ```
 * ⚠️ 정정(r100 4f484244 · R2 16절): 0x11 진입은 +0xfd4 를 **지운다**. 3deea 의 주소는 리터럴 0xfd4 가 아니라 0xfe0 − 0xc 로 만들어
 * `xval 0xfd4` 에 안 잡혔다. 그래서 홈런성 코드는 다음 0x11 진입까지만 남는다 — 그 사이 투수를 그리는 상태(0x12 · 0x13 · 0xd~0x10 ·
 * 0xb · 0x16 · 0x1b · 0x23)에서만 홈런 갈래(0x3908a)가 묵은 코드를 본다. 0xd · 0xf 진입은 투수를 상태 0 으로 되돌려(0x35650 →
 * 0x340c0) 마지막 단계 조건이 거짓이 된다.
 * 헛스윙의 정해지지 않은 값은 null 로 둔다(`features/defense-play` 의 `sceneResultCode` 머리말).
 */
let resultCode: number | null = 0

/** 지금 [장면+0xfd4] */
export function sceneResultCodeNow(): number | null {
  return resultCode
}

/** 메시지 0x6aa 의 스윙 판정(5130e · 51456)이 쓴 값 */
export function writeSceneResultCode(code: number | null): void {
  resultCode = code
}

/** 0x11 진입 0x3de10 의 3deea — 공마다 0 */
export function clearSceneResultCodeOnPitch(): void {
  resultCode = 0
}

/** 경기 장면 객체가 사라지고(0x332b8) 다음 장면이 새로 0 채움 객체(0x3874 → new)로 선다 */
export function resetSceneResultCode(): void {
  resultCode = 0
}

// 경기 중간 스냅샷(개발 · e2e 전용 — `shared/lib/dev/snapshotSlots`, 배포 빌드에서 빠진다): 결과 코드 칸
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  registerSnapshotSlot('sceneResultCode', {
    capture: () => resultCode,
    restore: (value) => {
      resultCode = value as number | null
    },
  })
}
