import type { Collection, HallOfFameResult, HallOfFameSide } from '@/entities/collection/model/collection'
import { BATTER_EDITION_MODE } from '@/pages/ending/lib/endingLayout'
import type { EndingWalkInLook } from '@/pages/ending/lib/endingLayout'
import type { HallOfFameNariPlayer } from './otherSlices'

export interface EndingScreenProps {
  readonly playerName: string
  readonly endingIndex: number
  /** 본 이벤트 번호 — 연애 이벤트 300~303 이 연애 엔딩(9 + c)과 제작진 인물을 고른다 (0x87c7c) */
  readonly seenEventIds?: readonly string[]
  /** 엔딩 보너스(0이면 부상·방출 엔딩) */
  readonly bonusGamePoint: number
  /**
   * 보너스를 이미 받았나 — 커리어 S+0x7b. 키 0x1220c(12276~12284)는 S+0x7b ≠ 0 이거나 보너스가 0 이면 보너스 팝업 0x2b 없이
   * 등록 팝업 0x2d 를 띄운다. 141 로 이어하기(0x1c154 의 S+0x50 == 6)로 다시 들어온 엔딩이 이 길이다.
   */
  readonly isBonusReceived?: boolean
  /**
   * 보너스 팝업 0x2b 를 닫을 때 (0x1bbc4 의 1bbf4~1bc70) — 전역 G += 보너스 · 0x22c7d 통계 · 전역기록 저장 · S+0x7b = 1 ·
   * 커리어 저장(141 진입이 메모리에 쓴 S+0x50 = 6 째)을 부르는 쪽이 한다
   */
  readonly onBonusReceived?: () => void
  readonly isContinuable: boolean
  /**
   * 명예의 전당 등록 목록 (나리 상태 145) — StrMODE[215] "예" 로 들어간다. `onRegister(칸)` 은 고른 빈 칸(없으면 첫 빈 칸)으로
   * 등록을 해 보고 결과를 돌려준다 (G 20000 · 통계는 부르는 쪽).
   */
  readonly hallOfFame: {
    readonly collection: Collection
    readonly edition: HallOfFameSide
    readonly nari: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
    readonly onRegister: (slot: number | null) => HallOfFameResult['kind']
    /**
     * 완료 창(꼬리표 0x30)을 닫았을 때 0x1ca4c 가 여는 히든 17(전광판 "고대의전광판") — 열고 알림을 띄웠으면 참이고
     * 그 창을 닫을 때 `then` 을 부른다 (`SpecialScreen` 등록 모드의 같은 이름 머리말)
     */
    readonly openRegisteredHidden?: (then: () => void) => boolean
    /**
     * 전역 G(`mgr+0x64`) — 상태 145 그리기 0x15d54 는 목록 0x63b15(…, 6, 1, [this+0x2c], −1) 뒤에 머리띠 객체
     * 0x7f4ec([this+0xe0]) = `0x54d95(skin, 제목, 바닥)` 을 부르고, 그 칸은 매 틱 0x16a34 → 0x16928 이 세운다:
     * 상태 0x76·0x6d·0x65·0x80 이 아니면 기본 갈래 0x169ea 로 `0x7f53c(hdr, [this+0xcc] == 4 ? 8 : 9, 5, 0)` —
     * 타자편(모드 4)은 제목 8 "나만의리그 + 타자편", 투수편(모드 3)은 9 "… + 투수편", 바닥 5 = 되돌아가기만.
     * 제목이 −1 이 아니라 G포인트도 그린다(0x550dc). 넘기면 그 머리띠를, 안 넘기면 예전 띠(제목 0, G 없음)를 그린다.
     */
    readonly gamePoint?: number
  }
  /** 5000 G포인트로 이어하기. 모자라면 false */
  readonly onContinue: () => boolean
  /**
   * 엔딩을 떠나 메인 메뉴로 — `isRegistered` 는 명예의 전당에 등록하고 떠나는가. 모드 저장 지우기(0x62dbe 의 0x224ec)는 등록이 된
   * 그 순간이라 `hallOfFame.onRegister` 를 넘기는 쪽이 '등록' 결과에서 한다.
   * 팝업 0x2d · 0x32 의 "아니오" · 145 의 "나중에 등록" · G 부족 팝업 2 의 "아니오" 는 등록 없이 떠난다(저장을 안 건드린다).
   */
  readonly onFinish: (isRegistered: boolean) => void
  /**
   * 선수의 생김새 (레코드 +0xb, 0x63a5c) — 걸어 들어오는 그림과 제작진의 선수 애니·팔레트를 고른다.
   * 안 주면 **타격형 황인 타자**로 본다 — 애니 바탕 0 · 팔레트 2 로, 원본이 그 비트에서 뽑는 값과 같다.
   */
  readonly walkInLook?: EndingWalkInLook
  /** 띠 창 배경의 시간대를 고를 한국 시각 (`BAND_BACKGROUND` 머리말). 안 주면 장면에 들어설 때 잡은 시각(`useSceneHour`) */
  readonly hour?: number
  /** 이어하기 100 진입(1c24e S+0x50 ∈ {6, 7})으로 들어왔다 — 단계 0 의 남은 판에 상태 1 의 덮기가 얹힌다 */
  readonly isResumed?: boolean
}

/** 안 주었을 때의 생김새 — 모두 0 (타자편 · 타격형 · 우타 · 황인) */
export const DEFAULT_WALK_IN_LOOK: EndingWalkInLook = {
  mode: BATTER_EDITION_MODE,
  typeIndex: 0,
  handIndex: 0,
  skinIndex: 0,
}

export const NO_EVENTS: readonly string[] = []
