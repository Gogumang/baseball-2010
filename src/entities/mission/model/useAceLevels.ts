import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import { aceLevelRecordOf, levelUpAceSave, normalizeAceLevelSave } from '@/entities/mission/model/aceLevel'
import type { AceLevelSave } from '@/entities/mission/model/aceLevel'

export interface AceLevelSession {
  readonly save: AceLevelSave
  /** 칸 번호(0~4 마투수 · 5~9 마타자) → 레벨 0~4 */
  readonly levels: Readonly<Record<number, number>>
  /**
   * 한 칸을 한 단계 올리고 저장한다 (0x5fbee). G 판정·빼기는 부르는 쪽 몫이다 —
   * 화면이 `aceLevelUpOutcomeOf` 로 모자람을 먼저 거른다.
   */
  readonly levelUp: (slot: number) => void
}

/**
 * 마선수 레벨 열 칸(`mgr[0x13a..0x143]`)을 들고 있는 전역 저장 고리.
 *
 * 저장이 없던 시절의 세이브는 `normalizeAceLevelSave` 가 모두 0(Lv1)으로 채운다 —
 * 원본 새 저장 기본값(0x9f26c → 0x9f2e2~0x9f2fa)과 같다.
 */
export function useAceLevels(store: JsonStorePort): AceLevelSession {
  const [save, setSave] = useState<AceLevelSave>(() => normalizeAceLevelSave(store.load()))

  useEffect(() => {
    store.save(save)
  }, [save, store])

  const levelUp = useCallback((slot: number) => setSave((previous) => levelUpAceSave(previous, slot)), [])
  const levels = useMemo(() => aceLevelRecordOf(save), [save])

  return { save, levels, levelUp }
}
