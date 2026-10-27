import { trackCellForSnapshot } from '@/shared/lib/dev/snapshotSlots'
import { useEffect } from 'react'

/**
 * **이름 칸 덧그림 표지 [skin+0x333]** — 앱에 하나 (r166, 직접 떴다).
 *
 * 스킨은 앱에 하나인 전역 [0x1552cfc] 다(`shared/lib/skinStepCounter` 머리말). 리터럴 0x333 을 읽는 LDR 을 전수(re.py xval 0x333)하면
 * 이 칸에 쓰는 곳은 모두 **1** 을 적는다 — 0 으로 되돌리는 곳은 스킨을 만들 때의 0 채움(0x1238 → 0x2ac4) 뿐이다:
 * ```
 * 0x5870 · 0x5980 · 0x5b28 · 0x5cd0 · 0x63dc   시즌 엔트리 진입들 (5918 · 5ab0 · 5c0a · 5dca · 64f6)
 * 0x16af8                                      나리 143 경기 전 엔트리 보기 (16c10)
 * 0x2648c                                      일반모드 엔트리 (265f2)
 * 0x37904 · 0x37e5c                            경기 중 교체 창의 지금 선수 칸 · 벤치 목록 그리기 (37a4a · 37bfa · 38044 · 3819c)
 * 0x571da                                      이름 칸 덧그림 — 읽기만 (571e6)
 * ```
 * 스페셜 에디트 0x2b2e0 은 이 칸을 안 세워 앞 화면이 남긴 값으로 그린다 — 부팅 뒤 위 화면을 한 번도 안 거쳤으면 0, 거쳤으면 1.
 */
const flag = { value: 0 }
// 경기 중간 스냅샷(개발 · e2e 전용 — `shared/lib/dev/snapshotSlots`, 배포 빌드에서 빠진다)
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') trackCellForSnapshot('skinNameBars.flag', flag)

/** 지금 [skin+0x333] */
export const skinNameBarsValue = () => flag.value

/** 위 표의 화면이 이 칸에 1 을 적는다 */
export const markSkinNameBars = () => {
  flag.value = 1
}

/** 앱을 새로 띄운 것과 같다 — 시험용 */
export const resetSkinNameBars = () => {
  flag.value = 0
}

/** 선 화면이 [skin+0x333] = 1 을 적는다 (`when` 이 참일 때) */
export function useMarkSkinNameBars(when = true) {
  useEffect(() => {
    if (when) markSkinNameBars()
  }, [when])
}
