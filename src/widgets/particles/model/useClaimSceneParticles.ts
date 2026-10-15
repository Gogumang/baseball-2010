import { useEffect } from 'react'
import { claimSceneParticles } from '@/widgets/particles/model/sceneParticles'

/**
 * 이 부품이 서 있는 동안 장면 파티클 관리자 [0x1400068] 를 쥔다 — 경기 장면 부품(타석 · 수비 판)이 원본 틱 차례
 * (갱신 → 그리기 → 프레임 끝 0x6de84 · 0x6dd69)로 직접 굴리고 그리는 동안 앱 층(`SceneParticleLayer`)이 같은 그림에 또 굴리지 않게 한다.
 */
export function useClaimSceneParticles(isClaiming = true): void {
  useEffect(() => {
    if (!isClaiming) return undefined
    return claimSceneParticles()
  }, [isClaiming])
}
