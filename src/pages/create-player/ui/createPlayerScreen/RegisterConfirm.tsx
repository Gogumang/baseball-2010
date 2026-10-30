import { MessageBox, PressArea } from '@/shared/ui'
import { OK_PRESS_RECT, pressKey } from './createPlayerAssets'

/**
 * OK 칸과 확인 상자.
 * ⚠️ 웹 자리: OK — 원본 등록 화면에는 OK 그림 자리가 없다(OK 키는 줄을 하나 내리고 피부 줄에서 확인 0x67, 0x16f28).
 * 바닥띠 왼쪽 표시 자리(왼쪽 소프트키 자리, 이 화면 바닥 5 는 비워 둔다)를 투명 누름 칸으로 빌려 OK 키를 보낸다.
 * 확인(상태 0x67)은 화면을 갈아 끼우지 않는다 — 지금 화면 위에 StrMODE[2] 메시지 상자(0xbbef8)만 얹는다.
 * 예전 웹판은 빈 화면으로 바꿔 끼워 화면 대부분이 검게 남았다.
 */
export function RegisterConfirm({ isConfirming, onAnswer }: { readonly isConfirming: boolean; readonly onAnswer: (isYes: boolean) => void }) {
  if (!isConfirming) return <PressArea label="OK" rect={OK_PRESS_RECT} onPress={() => pressKey('Enter')} />
  return <MessageBox text="!C이대로 결정 하시겠습니까?" buttons={['예', '아니오']} onAnswer={(index) => onAnswer(index === 0)} />
}
