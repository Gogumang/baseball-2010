import { createCareer, gainGamePoint, type RookieProfile } from '@/entities/career/model/playerCareer'
import { BATTER_LEAGUE_MODE, skillEquipStatEventsOf } from '@/entities/collection/model/annalsStats'
import type { CareerScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom, savedCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { newPlayerAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { useSetUpNariScene } from '@/app/model/careerSession/state/useSceneSetUp'

/** 선수 등록 · 초기화 · 보상 G (그림마다 새 함수 — 옛 꼴 그대로) */
export function useCareerLifecycleActions(scope: CareerScope) {
  const { atoms, saveGame, wallet, recordStat, setScreen } = scope
  const setUpNariScene = useSetUpNariScene(scope)
  return {
    /**
     * 보상 G — 미션 클리어(0x4ef72)·홈런더비 결과(0x4f6cc) 둘 다 원본은 **전역 +0x64** 에 쌓는다.
     * 지갑이 있으면 거기로 넣는다: 육성 선수가 안 올라온 화면에서도 G가 사라지지 않는다.
     * (지갑이 없는 자리는 예전처럼 커리어에 쌓고, 선수가 없으면 버린다.)
     */
    gainGamePoint: (amount: number) => {
      if (wallet !== undefined) return wallet.gain(amount)
      atoms.set(rawCareerAtom, (current) => (current === null ? current : gainGamePoint(current, amount)))
    },

    startNewCareer: (name: string, profile: RookieProfile) => {
      // 104 등록 확정 0x10fb4 — 전역기록 +0x40 + 모드 = 1 · +0x4c + 모드 = 0 (0x112b2 · 0x112c0)
      atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
      saveGame.clear()
      // 104 → 100 — 나리 장면이 새로 선다(커서 0 · mgr+0x304 = 1 — 새 선수라 본 표시는 비어 있다)
      setUpNariScene()
      const created = createCareer(name, profile)
      atoms.set(rawCareerAtom, created)
      // 104 → 100 진입 끝 0x1c3be 가 이전 상태 104 를 보고 새 선수 플래그를 켠다 → 105 첫 틀에 오프닝 451
      atoms.set(newPlayerAtom, true)
      // 0x112d0~0x112dc 0xa4bd8(P, 0) · (P, 8) — 얻자마자 0xa4b04 → 0xb663c 가 켠 스킬 비트(+0xf4)도 세운다.
      // 새 선수는 장착 비교 고리(`useEquippedSkillStat`)가 견주지 않으니(앞이 없거나 다른 선수) 여기서 적는다
      skillEquipStatEventsOf(BATTER_LEAGUE_MODE, [], created.equippedSkillIds).forEach(recordStat)
      setScreen({ kind: '관리' })
    },

    /** 환경설정 [나만의리그 초기화] — 저장을 지운다. 모드 저장 지우기 0x224ec(저장, 4) 가 +0x44 · +0x50 = 0 (0x225fa · 0x22602) */
    resetCareer: () => {
      atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
      saveGame.clear()
      atoms.set(savedCareerAtom, null)
      atoms.set(rawCareerAtom, null)
    },
  }
}
