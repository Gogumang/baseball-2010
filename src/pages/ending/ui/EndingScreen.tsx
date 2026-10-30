import { RawScreen } from '@/shared/ui'
import { EndingOverlays } from './endingScreen/EndingOverlays'
import { endingEffectAt, TEXT } from './endingScreen/endingPhase'
import type { EndingScreenProps } from './endingScreen/endingProps'
import { EndingPicture } from './endingScreen/EndingPicture'
import { EndingRegisterList } from './endingScreen/EndingRegisterList'
import { NoJudgementEnding } from './endingScreen/NoJudgementEnding'
import { useEndingFlow } from './endingScreen/useEndingFlow'

/**
 * 나만의리그 엔딩 (상태 141 — 적재 0x87c7c · 그리기 0x168fc → 0x882b4 / 0x88bb4, `endingLayout.ts` 머리말).
 *
 * 엔딩 번호(판정표 0xa3a84): 0 부상 · 1 방출 · 2~9 은퇴 뒤 진로. 10~14 연애는 **본 엔딩 뒤 제작진 앞에** 붙는 글이고
 * (`romanceEndingIndexOf`), 20 은 은퇴 엔딩 글 앞의 머리말, 21 은 제작진이다.
 *
 * 키 0x1220c: 부상·방출(0·1)은 곧장 StrMODE[221] 이어하기를 묻는다. 그 밖은 단계 1 의 키가 제작진으로 넘기고,
 * 제작진(단계 > 2)의 키가 엔딩 보너스(StrMODE[214]) → 명예의 전당 등록(StrMODE[215])을 묻는다.
 * 등록은 명예의 전당 목록(상태 145, `HallOfFameScreen` 의 '등록')에서 칸을 골라 한다. 저장을 지우는 것은 등록(0x62dbe 의
 * 0x224ec)뿐이라 "나중에 등록" · 아니오로 떠나면 선수 저장이 남는다(`onFinish(false)`).
 * G포인트가 모자라면(0x32 예 — 1bd5a~1bd84: 전역 +0x64 < 5000) StrMODE[65] 팝업 2(예/아니오, 2 · 2). 그 닫힘(1be58~1beae):
 * 예(답 0) → `0xbcb49(0x8b)` 139 G포인트 충전 페이지(실제 결제 — 웹에 없다, Q) → 끝나면 앞 상태 141 로 돌아와 진입 0x12300 을 다시 밟는다.
 * 아니오(답 1) → +0x278 = 1 · 효과기 → 메인 메뉴(0x2d · 0x32 의 아니오와 같은 꼬리). 웹은 예를 결제 없이 돌아온 141 로 둔다(엔딩 그대로).
 *
 * 단계는 `endingStageOf` 머리말. 부상·방출의 키는 단계를 안 보고 곧장 이어하기를 묻는다.
 * 단계 0 은 앞 화면이 남은 화면 버퍼를 효과기 종류 1 이 어둡게 덮는다 — 웹은 내려간 앞 화면 판을 복제해 깐다(`LeftFrame`).
 */
export function EndingScreen(props: EndingScreenProps) {
  const { phase, setPhase, tick, stage, leavingAt, creditsAt, band, question, onPress } = useEndingFlow(props)
  if (props.endingIndex < 0) return <NoJudgementEnding />
  if (phase === '등록목록') return <EndingRegisterList hallOfFame={props.hallOfFame} onFinish={props.onFinish} />
  return (
    <RawScreen>
      <EndingPicture props={props} phase={phase} stage={stage} tick={tick} creditsAt={creditsAt} band={band} />
      <EndingOverlays
        onPress={onPress}
        bonusText={phase === '보너스' ? TEXT.bonus.replace('%d', String(props.bonusGamePoint)) : null}
        onBonusClosed={() => {
          props.onBonusReceived?.()
          setPhase('등록질문')
        }}
        question={question}
        effect={endingEffectAt(stage, tick, leavingAt, creditsAt)}
      />
    </RawScreen>
  )
}
