import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { screenEffectFrameAt } from '@/entities/story/model/screenEffect'
import { ENDING_STAGE, endingStageZeroCoverOpacityAt } from '@/pages/ending/lib/endingLayout'

/** 엔딩 뒤 원문 문구 */
export const TEXT = {
  bonus: '!C엔딩 보너스 획득!N[!cFFFF00%d G포인트!cFFFFFF]', // StrMODE[214]
  ask: '!C나만의 리그 선수를!N[!cFFFF00명예의 전당!cFFFFFF]에!N등록 하시겠습니까?', // StrMODE[215]
  continue: '!C!cFFFF005000 G포인트!cFFFFFF를 소모하여 현재!N상태에서 이어하시겠습니까? ', // StrMODE[221]
  /** StrMODE[65] "G포인트가 부족합니다. 구매 페이지로 이동하시겠습니까?" — 141 틀 0x1bbc4 1bd68~1bd80 `0x702b5(…, 0x41)` · 팝업 (2, 2) */
  shortage: ORIGINAL_MODE_TEXT[65] ?? '',
}

/** '이어하기' — 팝업 0x32 예를 받아 이어하기로 넘어갔다(창 없이 엔딩 판만 — 방출이면 141 이 새 시즌 효과기 끝을 기다리며 그린다) */
export type Phase = '엔딩' | '제작진' | '보너스' | '이어하기질문' | '이어하기' | '등록질문' | '등록목록' | '부족질문'

interface Question {
  readonly text: string
  readonly onYes: () => void
  readonly onNo: () => void
}

/**
 * 이 틀의 단계 (`ENDING_STAGE` 머리말 — 화면 효과기 0xbdae8 의 아홉 틀을 기다린다): 0 은 아무것도 안 그리고, 1 은 검정에서 밝아지며 엔딩,
 * 키가 단계 2 로 엔딩을 어둡게 덮은 뒤 3 이 제작진을 밝힌다(틀 수 n 을 0 으로). `creditsAt` = 단계 2 → 3 의 틀(키를 안 받았으면 null)
 */
export function endingStageOf(tick: number, creditsAt: number | null): 0 | 1 | 2 | 3 {
  if (tick < ENDING_STAGE.firstStageAt) return 0
  if (creditsAt === null) return 1
  return tick < creditsAt ? 2 : 3
}

/** 단계 0 의 남은 판 덮개 — 진입 0x12300 이 건 종류 1(어두워짐), 이어하기로 들어왔으면 상태 1 의 덮기가 얹힌다 */
export function stageZeroCoverAt(tick: number, isResumed: boolean): number {
  return endingStageZeroCoverOpacityAt(tick, isResumed, (k) => screenEffectFrameAt('검정에서밝아짐', '검정', k)?.overlay?.opacity ?? 0)
}

/**
 * 이 틀의 효과기 덮개 — 단계 0 은 진입 0x12300 이 건 종류 1(어두워짐)이 남은 앞 화면 위에, 단계 1 은 종류 2(밝아짐),
 * 단계 2 는 종류 1(어두워짐), 단계 3 은 n = 0 부터 다시 종류 2
 */
export function endingEffectAt(stage: 0 | 1 | 2 | 3, tick: number, leavingAt: number | null, creditsAt: number | null) {
  if (stage === 0) return screenEffectFrameAt('검정에서밝아짐', '검정', tick)
  if (stage === 1) return screenEffectFrameAt('검게어두워짐', '검정', tick - ENDING_STAGE.firstStageAt)
  if (stage === 2 && leavingAt !== null) return screenEffectFrameAt('검정에서밝아짐', '검정', tick - leavingAt)
  if (stage === 3 && creditsAt !== null) return screenEffectFrameAt('검게어두워짐', '검정', tick - creditsAt)
  return null
}

/**
 * 지금 묻는 팝업 — 이어하기 0x32 · 등록 0x2d · G 부족 팝업 2. 그 밖의 단계면 null.
 * 이어하기 예: G < 5000 이면 StrMODE[65] 팝업 2(1bd60~1bd84), 아니면 창이 닫히고 방출 이어하기(0x1b768, 1be26)는 141 이 엔딩 판을
 * 그리며 효과기 끝을 기다린다(1beb4~1beea). 팝업 0x2d (0x1bbc4): 예 → 상태 145 등록 목록 · 아니오 → +0x278 = 1 → 곧장 메인 메뉴
 * (StrMODE[219] 는 목록의 취소다). 팝업 2 (1be58~1beae): 예 → 139 G포인트 충전(웹에 결제가 없어 충전 없이 141 로 돌아온 길) · 아니오 → 메인 메뉴
 */
export function endingQuestionOf(phase: Phase, onContinue: () => boolean, setPhase: (phase: Phase) => void, onFinish: () => void): Question | null {
  if (phase === '이어하기질문') {
    return { text: TEXT.continue, onYes: () => setPhase(onContinue() ? '이어하기' : '부족질문'), onNo: onFinish }
  }
  if (phase === '등록질문') return { text: TEXT.ask, onYes: () => setPhase('등록목록'), onNo: onFinish }
  if (phase === '부족질문') return { text: TEXT.shortage, onYes: () => setPhase('엔딩'), onNo: onFinish }
  return null
}
