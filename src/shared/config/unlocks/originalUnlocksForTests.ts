import { ORIGINAL_UNLOCK_CONFIG, setUnlockConfigForTests } from '@/shared/config/unlocks/unlocks'

/**
 * 시험 준비 파일(vitest `setupFiles`) — 시험은 **원본 잠금 그대로** 돈다. 지금까지의 시험(잠긴 칸 그림 · 오픈 팝업 · soak 의
 * 해금 기록 왕복)은 원본 조건을 전제로 짜였고, `unlocks.json` 을 고쳐도 흔들리지 않아야 한다.
 * 해금 표를 보는 시험은 `setUnlockConfigForTests(UNLOCK_CONFIG)` 로 켜고 끝나면 이 값으로 되돌린다.
 */
setUnlockConfigForTests(ORIGINAL_UNLOCK_CONFIG)
