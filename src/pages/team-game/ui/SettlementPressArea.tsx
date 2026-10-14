import { PressArea } from '@/shared/ui'
import { SETTLEMENT_INFO_BAR } from '@/pages/team-game/lib/settlementBoard'

/**
 * **정산 판(상태 0x19, 키 0x407f0) 마우스 길** — 원본은 키패드뿐이라 웹 단추 대신 투명 누름 칸을 얹는다.
 * 바닥 "0:INFO" 줄 위 화면 전체가 OK 다 — 기본 화면이면 정산을 나가고('0' 이 아닌 키), 기록 판이 열려 있으면 닫는다.
 * 키는 window 로 보내 판(`SettlementBoard`)의 키 처리를 그대로 탄다. "0:INFO" 그림 자리('0')는 판이 제 누름 칸을 둔다.
 */
export function SettlementPressArea() {
  return (
    <PressArea label="확인" rect={{ x: 0, y: 0, width: 240, height: SETTLEMENT_INFO_BAR.y }}
      onPress={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))} />
  )
}
