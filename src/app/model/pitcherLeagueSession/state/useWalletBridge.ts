import { useEffect } from 'react'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom, walletBridgeAtom, walletLastSeenAtom, type WalletPair } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { usePitcherSaveWriters } from '@/app/model/pitcherLeagueSession/state/usePitcherSaveWriters'

/** 다리 한 걸음 — 커리어 쪽 G 가 움직였나(커리어가 이김), 둘이 어긋났나(지갑이 이김), 그대로인가 */
type WalletBridgeStep = '커리어' | '지갑' | '그대로'

function walletBridgeStepOf(previous: WalletPair, seen: WalletPair): WalletBridgeStep {
  if (seen.career === null) return '그대로'
  if (previous.career !== null && seen.career !== previous.career) return '커리어'
  return seen.career === seen.wallet ? '그대로' : '지갑'
}

const isSamePair = (left: WalletPair | null, right: WalletPair) => left !== null && left.career === right.career && left.wallet === right.wallet

/**
 * **커리어 칸 ↔ 지갑 다리** — 타자편(`useCareerSession`)과 같은 모양이다.
 *
 * 원본은 G가 전역 한 칸이라 다리가 필요 없지만, 웹은 구질 훈련·지옥훈련·엔딩 보너스가 전부
 * `PitcherCareer` 를 통째로 갈아 끼우는 식이라 커리어 칸을 아직 못 없앴다. 그래서 **나중에
 * 바뀐 쪽이 이기게** 이어 둔다 — 지갑이 주인이고, 커리어 칸은 저장 호환용 그림자다.
 *
 * - 커리어 쪽 G가 움직였으면(훈련 비용·기록 달성 보상·엔딩 보너스) 그 값을 지갑으로 옮긴다.
 * - 그 밖에 둘이 어긋나면 **지갑이 이긴다.** 선수를 불러온 참에 저장에 남은 옛 값이 지갑을
 *   되돌리는 것을 막는다 (이사는 `useWalletMerge` 가 딱 한 번만 한다).
 *
 * ⚠️ **칭호 부여 고리 뒤에 둔다** — 뒤에 두고 **직전 값을 받아** 고치면(`commitWith`) 칭호도 G도 둘 다 남는다.
 * ⚠️ **같은 짝을 두 번 보면 아무것도 안 한다** (`walletLastSeenAtom`) — `StrictMode` 가 고리를 다시 붙일 때 두 번째 바퀴가
 *    **옛 커리어 값**을 들고 돌아 "선수 쪽이 움직였다" 로 잘못 읽는 것을 막는다.
 * ⚠️ `?무한G` 면 다리를 놓지 않는다 — 지갑이 늘 99999 라 그대로 두면 저장에 99999 가 적혀 스위치를 끈 뒤에도 값이 안 돌아온다.
 */
export function useWalletBridge(scope: PitcherScope): void {
  const { atoms, wallet } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const { commitWith } = usePitcherSaveWriters(scope)
  const walletBalance = wallet?.balance ?? 0
  const setWalletBalance = wallet?.setBalance
  useEffect(() => {
    if (setWalletBalance === undefined || isInfiniteGamePointOn()) return
    const seen: WalletPair = { career: career === null ? null : career.gamePoint, wallet: walletBalance }
    if (isSamePair(atoms.get(walletLastSeenAtom), seen)) return
    atoms.set(walletLastSeenAtom, seen)
    const step = walletBridgeStepOf(atoms.get(walletBridgeAtom), seen)
    if (step === '커리어' && seen.career !== null) {
      atoms.set(walletBridgeAtom, { career: seen.career, wallet: seen.career })
      setWalletBalance(seen.career)
      return
    }
    if (step === '지갑') {
      atoms.set(walletBridgeAtom, { career: walletBalance, wallet: walletBalance })
      commitWith((current) => ({ ...current, gamePoint: walletBalance }))
      return
    }
    atoms.set(walletBridgeAtom, seen)
  }, [atoms, career, commitWith, setWalletBalance, walletBalance])
}
