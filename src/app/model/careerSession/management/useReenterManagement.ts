import { useCallback } from 'react'
import { restartsManagementBgmFrom } from '@/app/model/screenBgm'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { managementReentryCountAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'

/**
 * 화면이 '관리' 인 채 105 에 다시 들어온다 — 하위 메뉴 106 · 107 · 110 취소 (0x11910 진입 · 0x1cf9c 자동 훑기).
 * `from` 은 105 로 다시 들어오는 원본 앞 상태 — 0x1aec4 의 배경음 4 목록에 들면(125 훈련 결과) 배경음 4 를 처음부터 다시 튼다
 * (`restartsManagementBgmFrom`). 하위 메뉴 106 · 107 · 110 취소 · 127 휴식은 목록 밖이다
 */
export function useReenterManagement({ atoms }: CareerScope): (from?: number) => void {
  return useCallback(
    (from?: number) => {
      atoms.set(managementReentryCountAtom, (count) => count + 1)
      if (from !== undefined && restartsManagementBgmFrom(from)) atoms.get(portsMirrorAtom).current.onManagementBgmRestart()
    },
    [atoms],
  )
}
