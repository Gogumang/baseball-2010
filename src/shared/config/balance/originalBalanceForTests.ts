import { ORIGINAL_BALANCE_VALUES } from '@/shared/config/balance/originalBalance'
import { setBalanceValuesForTests } from '@/shared/config/balance/balance'

/**
 * 시험 준비 파일(vitest `setupFiles`) — 시험은 **원본 판정값 그대로** 돈다. `balance.json` 을 고쳐도
 * 판정 · 난수 차례 · soak 시험이 흔들리지 않아야 한다.
 * 값을 바꿔 보는 시험은 `setBalanceValuesForTests({ 항목: 값 })` 로 켜고 끝나면 이 값으로 되돌린다.
 */
setBalanceValuesForTests(ORIGINAL_BALANCE_VALUES)
