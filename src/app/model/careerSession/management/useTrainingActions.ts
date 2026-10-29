import { NARI_STATE } from '@/app/model/screenBgm'
import { blockReasonOf, runTraining, specialSwingCostOf } from '@/entities/career/model/training'
import { trainingBlockTextOf, trainingOutcomeLinesOf } from '@/entities/career/model/trainingText'
import { recoverAfterRest, restBlockReasonOf } from '@/entities/career/model/outing'
import { INJURY_FOLLOW_UP_NOTICE, rollTrainingInjury } from '@/entities/career/model/condition'
import { BATTER_LEAGUE_MODE, leagueUsageOf } from '@/entities/collection/model/annalsStats'
import { trainingDetailChangesOf } from '@/pages/management/lib/detailPopup'
import { BATTING_TYPE_NAMES } from '@/pages/management/lib/basicInfoLayout'
import { TRAINING_MENUS } from '@/shared/config/trainingMenus'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import * as uiAtoms from '@/app/model/careerSession/atoms/uiAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { useReenterManagement } from '@/app/model/careerSession/management/useReenterManagement'

const trainingMenuOf = (menuId: string) => TRAINING_MENUS.find((candidate) => candidate.id === menuId)

/** [트레이닝] · [휴식] 결과 창과 관리 화면 알림 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useTrainingActions(scope: CareerScope) {
  const { atoms, random, recordStat } = scope
  const career = useShownCareer(scope)
  const managementDetail = useCareerValue(atoms, uiAtoms.managementDetailAtom)
  const reenterManagement = useReenterManagement(scope)
  return {
    /**
     * [트레이닝] 하위 메뉴 — 연출이 끝난 뒤 불린다 (훈련 결과 0x17f5c).
     *
     * 칸 0~3(능력치 훈련)은 상세 결과 창(0x872a1)을 띄우고, 창의 키 처리(0x1d63c → 0x1b4c4)가 닫힐 때 부상을 굴린다.
     * **필살타법(칸 4)은 다른 길이다** — `0x18bd8` `[sp+0x40](칸) == 4` 면 결과 글([sp+0xfc]: StrMODE[87] 또는 [86]
     * `!N` 사기)을 **알림 창** `0xbbef8(글, 1, 코드 4, 1)`(OK 한 개)에 띄우고 곧장 공통 끝(0x18d66)으로 간다.
     * 그 창이 닫히면 상태 125 의 틀 `0x18dd8` 이 "팝업 닫힘 · 코드 4 · 결과 0/0x14" 를 보고 **105(관리 화면)** 로만 간다.
     * 부상 굴림 0x1b4c4 는 상세 창 콜백(0x1d63c)에서만 불리므로 **필살타법 뒤에는 부상을 굴리지 않는다.**
     * (0x1b4c4 안의 "칸 == 4 면 필살 확률" 갈래는 그래서 원본에서도 안 걸린다 — 그대로 둔다.)
     */
    runTrainingMenu: (menuId: string) => {
      const menu = trainingMenuOf(menuId)
      if (career === null || menu === undefined) return
      const outcome = runTraining(career, menu, random)
      const trained = outcome.career
      atoms.set(rawCareerAtom, trained)
      const changes = trainingDetailChangesOf(outcome)
      const messages = trainingOutcomeLinesOf(outcome, BATTING_TYPE_NAMES[career.battingTypeIndex])
      // 필살타법 — 상세 창 대신 알림 창 하나(관리 화면 알림 상자, [확인] → 관리 화면).
      // 비용은 훈련 적용 0xa3bac 종류 4 가 G 를 빼고 0xa3cac `0x22c29(모드 4 → 1, |비용|)` 로 적는다
      if (changes === null) {
        recordStat({ kind: 'G사용', usage: leagueUsageOf(BATTER_LEAGUE_MODE), amount: specialSwingCostOf(career) })
        // 알림 창이 닫히면 125 틀 0x18dd8 이 105 로 — 그 105 진입(`dismissManagementNotice`)
        atoms.set(uiAtoms.specialSwingNoticeAtom, true)
        return atoms.set(uiAtoms.managementNoticeAtom, messages.join('!N'))
      }
      // 변화량 칸은 굴린 값 그대로 — 훈련 칸 [sp+0x34] · 사기 칸 −[sp+0x38] (0x18d0e~0x18d38).
      // 이 창은 칸 0~3 에서만 뜬다 — 0x1b4c4 가 보는 칸은 4 가 아니다
      atoms.set(uiAtoms.managementDetailAtom, {
        before: career,
        after: trained,
        messages,
        changes,
        afterClose: { kind: '훈련', isSpecialSwing: false },
      })
    },

    /** 결과 창을 닫는다 — 훈련은 부상(0x1b4c4), 휴식은 회복(0x1b308)을 이때 굴린다 */
    closeManagementDetail: () => {
      if (career === null || managementDetail === null) return
      const { afterClose } = managementDetail
      atoms.set(uiAtoms.managementDetailAtom, null)
      // 창을 닫으면 125(훈련 0x1b5b8) · 127(휴식 0x1b466)이 `0xbcb49(0x69)` 로 105 에 다시 들어온다 — 진입 · 자동 훑기
      reenterManagement(afterClose.kind === '훈련' ? NARI_STATE.훈련결과 : NARI_STATE.휴식)
      if (afterClose.kind === '훈련') {
        const injury = rollTrainingInjury(career, afterClose.isSpecialSwing, random)
        atoms.set(rawCareerAtom, injury.career)
        atoms.set(uiAtoms.injuryNoticeAtom, injury.notice !== null)
        return atoms.set(uiAtoms.managementNoticeAtom, injury.notice ?? '')
      }
      const recovery = recoverAfterRest(career, random)
      atoms.set(rawCareerAtom, recovery.career)
      atoms.set(uiAtoms.managementNoticeAtom, recovery.recoveries.join(' · '))
    },

    /** 관리 화면 알림 상자 [확인] — 알림은 여기서만 지운다 (화면이 기억하면 같은 문구가 다시 안 뜬다) */
    dismissManagementNotice: () => {
      // 부상 0x28 을 닫았다 — 1af3c~1af7e 가 곧바로 0x29 StrMODE[212] 를 띄운다
      if (atoms.get(uiAtoms.injuryNoticeAtom)) {
        atoms.set(uiAtoms.injuryNoticeAtom, false)
        return atoms.set(uiAtoms.managementNoticeAtom, INJURY_FOLLOW_UP_NOTICE)
      }
      atoms.set(uiAtoms.managementNoticeAtom, '')
      // 필살타법 결과 알림이면 125 틀 0x18dd8 이 105 로 — 105 진입
      if (!atoms.get(uiAtoms.specialSwingNoticeAtom)) return
      atoms.set(uiAtoms.specialSwingNoticeAtom, false)
      reenterManagement(NARI_STATE.훈련결과)
    },

    isRestBlocked: () => career === null || restBlockReasonOf(career) !== null,

    showTrainingBlocked: (menuId: string) => {
      const menu = trainingMenuOf(menuId)
      if (career === null || menu === undefined) return
      const reason = blockReasonOf(career, menu)
      if (reason !== null) atoms.set(uiAtoms.managementNoticeAtom, trainingBlockTextOf(reason, menu.name))
    },

    isTrainingBlocked: (menuId: string) => {
      const menu = trainingMenuOf(menuId)
      return career === null || menu === undefined || blockReasonOf(career, menu) !== null
    },
  }
}
