import { playEndingContinueBgm } from '@/app/model/screenBgm'
import {
  applyEndingBonus,
  canContinueAfterEnding,
  CONTINUE_COST_GAME_POINT,
  continueAfterEnding,
  continueAfterEndingPayment,
  endingBonusOf,
  INJURY_ENDING_INDEX,
} from '@/entities/career/model/seasonFlow'
import { BATTER_LEAGUE_MODE, leagueUsageOf } from '@/entities/collection/model/annalsStats'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { isSaveErasedAtom, rawCareerAtom, savedCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { portsMirrorAtom } from '@/app/model/careerSession/atoms/portsAtoms'
import { isYearCoverHeldAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'
import { seasonFlowOf } from '@/app/model/careerSession/seasonEnd/seasonFlow'

/** 엔딩 141 · 명예의 전당 · 연차 표지 (그림마다 새 함수 — 옛 꼴 그대로) */
export function useEndingActions(scope: CareerScope) {
  const { atoms, audio, random, recordStat, saveGame, setScreen } = scope
  const career = useShownCareer(scope)
  const isYearCoverHeld = useCareerValue(atoms, isYearCoverHeldAtom)
  const { startNewSeason } = seasonFlowOf(scope)
  return {
    /**
     * 엔딩 보너스 팝업 0x2b 를 닫았다 — 141 틀 0x1bbc4 의 1bbf4~1bc70: e = 0xa3a85(S) 로 보너스 0xcc40c[e] × 1000 을 전역 G 에
     * 더하고(99999 상한) `0x22c7d(보너스, 모드)` 통계 · 전역기록 저장 · **S+0x7b = 1** · 커리어 저장(141 진입이 메모리에 쓴 S+0x50
     * = 6 째 — 다시 켜면 141 로 돌아온다, `resumePointOf`) 뒤 등록 팝업 0x2d.
     */
    receiveEndingBonus: () => {
      if (career === null || career.endingIndex === null || career.endingBonusReceived === true) return
      const endingIndex = career.endingIndex
      atoms.set(rawCareerAtom, { ...applyEndingBonus(career, endingIndex), endingBonusReceived: true })
      recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: endingBonusOf(endingIndex) })
    },

    /**
     * 부상·방출 엔딩 뒤 5000 G포인트로 이어한다 (StrMODE[221]). 모자라면 false.
     * 팝업 0x32 예(0x1bdc6~) — 판정 0xa3a85(S) 가 0(부상)이면 부상 칸을 비우고 S+0x50 = 3 · 0xbcb49(0x69) 로 곧장 105(1bddc~1be1e),
     * 아니면(방출) 새 시즌 0x1b768(1be26) — 141 은 엔딩 판을 그리며 효과기 끝을 기다려(1beb4~1beea) 137 "N년차" 표지로 간다
     */
    continueAfterEnding: () => {
      if (career === null || career.endingIndex === null) return false
      if (!canContinueAfterEnding(career, career.endingIndex)) return false
      // 팝업 0x32 예 → 0x1bdc6 `0x22c29(모드 4 → 1, 5000)`
      recordStat({ kind: 'G사용', usage: leagueUsageOf(BATTER_LEAGUE_MODE), amount: CONTINUE_COST_GAME_POINT })
      if (career.endingIndex !== INJURY_ENDING_INDEX) {
        // 1be2a~1be40 — 두 갈래가 만나 소리를 끊고 4 를 튼다. 방출은 화면이 엔딩 그대로라 여기서 (`playEndingContinueBgm`)
        playEndingContinueBgm(audio)
        startNewSeason(continueAfterEndingPayment(career), { holdsPrevious: true, afterRelease: true })
        return true
      }
      atoms.set(rawCareerAtom, continueAfterEnding(career, random))
      setScreen({ kind: '관리' })
      return true
    },

    /** 앞 상태(134 · 141)가 효과기 끝을 본 틀 — `0xbcb49(0x89)` 로 137 을 예약하고 효과기 종류 2 를 건다(1bb46~1bb64 · 1becc~1beea) */
    enterHeldYearCover: () => {
      if (!isYearCoverHeld) return
      atoms.set(isYearCoverHeldAtom, false)
      setScreen({ kind: '연차표지', afterHold: true })
    },

    /**
     * 엔딩을 본 뒤 메인 메뉴로 (직접 떴다). 커리어 저장을 지우는 곳은 **명예의 전당 등록** 하나다 — 등록 0x62d80~0x62dc0 이
     * 선수 사본(0x1f681) 뒤 `0x224ec(저장, 4)`(모드 저장 지우기 — +0x44 · +0x50 = 0, 그 편 저장 칸을 비운다)를 부른다.
     * 팝업 0x2d "아니오"(1bd04~1bd28)와 0x32 "아니오"(1be46~1beae)는 `[this+0x278] = 1` · 화면 전환만 걸고, 그 끝 1bfa2~1bfe2 도
     * 밀기 · 0x375d · [0x140006c] = 5 · 장면 0x103(메인 메뉴)뿐이다 — 저장을 안 건드린다. 145 목록의 "나중에 등록"도 메인 메뉴뿐이다.
     * 그래서 등록하지 않으면 마지막 저장(`savedCareerOf` — 보너스를 받았으면 S+0x50 = 6 · 엔딩 칸, 아니면 엔딩 칸을 비운 그 앞)이
     * 남아 이어하기가 그 자리로 돌아온다.
     */
    finishEnding: (isRegistered: boolean) => {
      // 등록했으면 저장은 등록하는 순간 지웠다 (`eraseSaveForHallOfFame`) — 여기서는 떠나기만 한다
      if (isRegistered) atoms.set(isSaveErasedAtom, false)
      atoms.set(rawCareerAtom, null)
      // 141 끝 0x1bfd4 · 145 목록 0x1ca92 — 등록 여부와 상관없이 [0x140006c] = 5: 메인 메뉴를 게임시작 목록으로 바로 연다
      setScreen({ kind: '메인메뉴', openTier: 5 })
    },

    /**
     * 명예의 전당 등록이 된 그 순간 — 0x62dbe 의 `0x224ec(저장, 4)`: 모드 저장(경기 중간 저장 칸도)을 지운다. 등록 꼬리(0x62dc4~)는
     * G − 20000 · 전역 저장 0x1f1b9 · 0x1f1e1 뿐이라 모드 저장 0x22755 를 다시 부르지 않는다 — 웹은 엔딩을 떠날 때까지 커리어가
     * 바뀌어도(지갑 다리의 G) 저장하지 않는다. 등록 완료 창에서 앱을 꺼도 저장은 없다.
     */
    eraseSaveForHallOfFame: () => {
      atoms.set(isSaveErasedAtom, true)
      atoms.get(portsMirrorAtom).current.nariGameSave?.clear()
      saveGame.clear()
      atoms.set(savedCareerAtom, null)
    },
  }
}
