import { useEffect } from 'react'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom, walletBridgeAtom } from '@/app/model/careerSession/atoms/careerAtoms'

/**
 * **커리어 칸 ↔ 지갑 다리.**
 *
 * 원본은 G가 전역 한 칸이라 다리가 필요 없지만, 웹판은 상점·경기 보상·이벤트가 전부
 * `PlayerCareer` 를 통째로 갈아 끼우는 식이라 커리어 칸을 아직 못 없앴다. 그래서 **나중에
 * 바뀐 쪽이 이기게** 이어 둔다 — 지갑이 주인이고, 커리어 칸은 저장 호환용 그림자다.
 *
 * - 커리어 쪽 G가 움직였으면(상점 구매·경기 보상·이벤트) 그 값을 지갑으로 옮긴다.
 * - 그 밖에 둘이 어긋나면 **지갑이 이긴다.** 선수를 불러오거나 새로 등록한 참에 옛 저장에
 *   남은 값이 지갑을 되돌리는 것을 막는다 (원본도 선수 등록·모드 초기화로 G가 줄지 않는다).
 *
 * 두 주인을 커밋 뒤에 맞춘다 — 어느 쪽이 바뀌었는지는 앞 커밋 값(`walletBridgeAtom`)과 견줘야 안다.
 */
/** 다리 한 걸음 — 커리어 쪽 G 가 움직였나(커리어가 이김), 둘이 어긋났나(지갑이 이김), 그대로인가 */
type WalletBridgeStep = '커리어' | '지갑' | '그대로'

function walletBridgeStepOf(previousCareer: number | null, careerPoint: number | null, walletBalance: number): WalletBridgeStep {
  if (careerPoint === null) return '그대로'
  if (previousCareer !== null && careerPoint !== previousCareer) return '커리어'
  return careerPoint === walletBalance ? '그대로' : '지갑'
}

export function useWalletBridge({ atoms, wallet }: CareerScope): void {
  const rawCareer = useCareerValue(atoms, rawCareerAtom)
  const walletBalance = wallet?.balance ?? 0
  const setWalletBalance = wallet?.setBalance
  useEffect(() => {
    if (setWalletBalance === undefined) return
    const careerPoint = rawCareer?.gamePoint ?? null
    const step = walletBridgeStepOf(atoms.get(walletBridgeAtom).career, careerPoint, walletBalance)
    if (step === '커리어' && careerPoint !== null) {
      atoms.set(walletBridgeAtom, { career: careerPoint, wallet: careerPoint })
      setWalletBalance(careerPoint)
      return
    }
    if (step === '지갑') {
      atoms.set(walletBridgeAtom, { career: walletBalance, wallet: walletBalance })
      atoms.set(rawCareerAtom, (current) => (current === null ? current : { ...current, gamePoint: walletBalance }))
      return
    }
    atoms.set(walletBridgeAtom, { career: careerPoint, wallet: walletBalance })
  }, [atoms, rawCareer, walletBalance, setWalletBalance])
}
