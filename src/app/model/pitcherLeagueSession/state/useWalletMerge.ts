import { useEffect } from 'react'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { legacyGamePointAtom, walletMergedAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'

/**
 * **투수 G 이사** — 옛 투수 저장은 G를 `career.gamePoint` 안에 들고 있었다(시즌모드와 달리
 * 저장에 실제로 들어 있다). 원본은 G가 전역 한 칸(`mgr[+0x64]`)이라 투수편만의 G가 애초에
 * 있을 수 없다 — 웹이 나눠 둔 탓에 생긴 주머니라, 지갑으로 합칠 때 **타자편 몫에 더한다.**
 *
 * ⚠️ **왜 더하나** (타자편 이사와 겹치는 자리):
 *   두 주머니 다 신인 지급분이 0 에서 시작한다 (`BALANCE.rookie.gamePoint === 0`). 그러니
 *   타자편 B = (번 것 − 쓴 것), 투수편 P = (번 것 − 쓴 것) 이고, 원본처럼 한 칸이었다면
 *   그 칸 값은 정확히 **B + P** 다. 어느 한쪽을 이기게 하면 다른 쪽에서 번 G가 통째로 사라진다.
 *   (원본에 두 값이 따로 있던 적이 없으므로 "어느 쪽이 진짜냐"는 물음 자체가 웹의 사정이다.)
 *
 * 표식 칸(`mergeStore`)을 따로 두는 까닭: 이사를 마치면 커리어 칸은 지갑의 그림자라
 * 저장만 봐서는 이미 옮겼는지 알 수 없다. 저장 형식 번호는 **올리지 않는다.**
 *
 * ⚠️ `?무한G` 면 지갑이 쓰기를 안 받는다 — 그대로 진행하면 표식만 서고 G가 사라지므로 **미룬다.**
 */
export function useWalletMerge({ atoms, wallet, mergeStore }: PitcherScope): void {
  const legacyGamePoint = usePitcherValue(atoms, legacyGamePointAtom)
  useEffect(() => {
    if (wallet === null || mergeStore === null || atoms.get(walletMergedAtom)) return
    if (isInfiniteGamePointOn()) return
    const done = (mergeStore.load() as { merged?: boolean } | null)?.merged === true
    atoms.set(walletMergedAtom, true)
    if (done) return
    // 표식을 먼저 적는다 — 중간에 다시 띄워도 두 번 더해지지 않는다
    mergeStore.save({ merged: true })
    if (legacyGamePoint !== 0) wallet.gain(legacyGamePoint)
  }, [atoms, mergeStore, wallet, legacyGamePoint])
}
