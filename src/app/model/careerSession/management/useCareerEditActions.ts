import { selectSpecialSwingNumber, setSkillEquipped } from '@/entities/career/model/playerCareer'
import { expandSkillSlots } from '@/entities/career/model/skillEquip'
import { awardTitles, equipTitle } from '@/entities/career/model/titles'
import { BATTER_LEAGUE_MODE, leagueUsageOf } from '@/entities/collection/model/annalsStats'
import type { CareerStoryScope } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { heldTitleAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import type { ManagementEntry } from '@/app/model/careerSession/management/useManagementEntry'
import { useReenterManagement } from '@/app/model/careerSession/management/useReenterManagement'

/** 선수정보 하위 상태의 커리어 고침 — 칭호 · 필살타법 번호 · 스킬 장착 · 슬롯 확장 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useCareerEditActions(scope: CareerStoryScope, { pendingTitle }: ManagementEntry) {
  const { atoms, recordStat, story } = scope
  const career = useShownCareer(scope)
  const reenterManagement = useReenterManagement(scope)
  return {
    /** 화면이 '관리' 인 채 105 에 다시 들어온다 — 하위 메뉴 106 · 107 · 110 취소 (0x11910 진입 · 0x1cf9c 자동 훑기) */
    reenterManagement,

    /** 105 관리 메뉴 확인 키(−5 · '5') — 0x12654 가 메뉴 칸을 보기 전에 mgr+0x304 = 0 (490 쿨다운 검사가 다시 선다) */
    pressManagementConfirm: story.pressManagementConfirm,

    /** 칭호 팝업 확인 0x1b1e4 — 비트·곧바로 장착(+0x1c4)·저장 · +0x270 = −1, 다음 틀에 다시 판정 */
    confirmTitle: () => {
      if (career === null || pendingTitle === null) return
      atoms.set(heldTitleAtom, null)
      atoms.set(rawCareerAtom, awardTitles(career, [pendingTitle]))
    },

    /**
     * 칭호 목록(하위 상태 129)에서 하나를 골랐다 — 키 처리 0x11f78 의 확인 갈래.
     * 원본은 선수 +0x1c4 를 바꾸고 팝업(이름 + StrMODE[138])을 띄운 뒤 곧바로 저장한다(0x1fdec).
     * 웹은 커리어가 바뀌면 저장 고리가 저장하므로 여기서는 값만 쓴다.
     */
    equipTitle: (title: string) => {
      atoms.set(rawCareerAtom, (current) => (current === null ? current : equipTitle(current, title)))
    },

    /**
     * 필살타법 창(상태 0x7b)에서 고른 번호(칸 + 1 = 1~4)를 선수 +0x18 에 쓴다 (틀 0x17bf4 의 0x17c64 `strb`).
     * 경기의 '0' 키(0x51e14)와 성공 확률(0x34c74)은 이 번호만 본다.
     */
    selectSpecialSwing: (number: number) => {
      atoms.set(rawCareerAtom, (current) => (current === null ? current : selectSpecialSwingNumber(current, number)))
    },

    /**
     * 스킬 창 대화 번호 4(장착)·3(해제) — 0x1483c `0xa4b04(P, s, on)`. 켜기 0xb663c 는 곧바로 저장(0x1f1e1)한다 — 웹은 커리어가 바뀌면 저장 고리가 돈다.
     * 켠 스킬 통계(0xb663c)는 장착 목록 비교(`useEquippedSkillStat`)가 적는다
     */
    equipSkill: (skillId: number, on: boolean) => {
      atoms.set(rawCareerAtom, (current) => (current === null ? current : setSkillEquipped(current, skillId, on)))
    },

    /**
     * 스킬 창 대화 번호 6 — 슬롯 확장 (0x1484c). G 가 모자라면 아무것도 안 바뀐다(창이 StrMODE[65] 를 띄운다).
     * G 는 `career.gamePoint` 를 깎으면 지갑 다리(`useWalletBridge`)가 전역 G 에 옮긴다.
     */
    expandSkillSlots: () => {
      if (career === null) return
      const result = expandSkillSlots(career)
      if (result.kind !== '확장') return
      atoms.set(rawCareerAtom, result.career)
      // 0x148d8 `0x22c29(모드 4 → 1, 비용)` — 타자편 소모 GP
      recordStat({ kind: 'G사용', usage: leagueUsageOf(BATTER_LEAGUE_MODE), amount: career.gamePoint - result.career.gamePoint })
    },
  }
}
