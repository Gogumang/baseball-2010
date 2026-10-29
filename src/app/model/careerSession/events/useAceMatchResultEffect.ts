import { useEffect } from 'react'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { useSetUpNariScene } from '@/app/model/careerSession/state/useSceneSetUp'

/**
 * 140 진입 0x10df8 — 결과 이벤트를 틀며 대기 칸(g[0xec] · g[0xee] · g[0x11f] · g[0x144])을 지우고 전역기록을 저장한다(10f72).
 * 웹은 결과 이벤트('대결결과')가 열리는 자리면 어디서 왔든(대결을 마치고 · 105 진입에서) 칸을 지운다 — 열린 커밋 뒤에.
 */
export function useAceMatchResultEffect(scope: CareerScope): void {
  const { atoms, screen } = scope
  const setUpNariScene = useSetUpNariScene(scope)
  const isAceMatchResultScreen = screen.kind === '이벤트' && screen.context === '대결결과'
  useEffect(() => {
    if (!isAceMatchResultScreen) return
    atoms.get(portsMirrorAtom).current.aceMatchPending.clear()
    // 대결(미션 장면)을 마치면 나리 장면 0x106 이 새로 선다(0xf684) — 105 진입에서 140 으로 온 길은 이어하기가 이미 세웠다(다시 해도 같다)
    setUpNariScene()
  }, [atoms, isAceMatchResultScreen, setUpNariScene])
}
