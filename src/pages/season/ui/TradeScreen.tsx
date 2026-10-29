import { MessageBox, RawScreen } from '@/shared/ui'
import { SkinBackdrop, TeamSelectScreen } from './tradeScreen/otherSlices'
import type { TradeScreenProps } from './tradeScreen/tradeScreenProps'
import { useTradeScreen } from './tradeScreen/useTradeScreen'
import { TradeConfirm, TradeFrame, TradeListWindow, TradePopups } from './tradeScreen/TradeScreenParts'

/**
 * 트레이드 한 바퀴 — 상태 **0xe4**(팀 고르기) → **0xe5**(영입할 선수, StrMODE[163])
 * → **0xe6**(보상할 선수, [164]) → **0xe7**(확인·진행, [171]).
 * 성공률·비용은 `docs/re/J-modes-rules.md` 4-4 확정(0xcf24)이고 `playerTrade.ts` 가 들고 있다.
 *
 * 네 칸은 원본에서도 **한 장면 객체의 필드**로 이어져 있어 여기서도 한 화면이 단계만 바꿔 가며 든다(`tradeScreen/useTradeState`).
 * 팀 고르기 진입 0x4774 는 그 20바이트를 0 으로 지운다 — 보통 트레이드는 요청 플래그가 늘 0 이다.
 *
 * **CPU 요청으로 들어오면** (직접 떴다 — 진입 0x5cd0·0x5b28, 키 0x7104·0x727c·0xc66c):
 * ```
 * 0xe5 진입  알림 [204] · 목록 커서 = 요청 상대 칸(+0x150)
 * 0xe5 키   위·아래·'2'·'8' → 키 −3 으로 바꿔 목록에 넘긴다(커서가 안 움직인다)
 *           확인 → 0xe6 (나리 검사 [165] 없음)     취소 → [216] 예/아니오 — 예면 플래그 0 · 0xce
 * 0xe6 진입  알림 [205] · 커서 = 요청 내 칸(+0x14c)
 * 0xe6 키   위·아래 같은 막기 · 확인 → this+0x160 = 0 · 0xe7 (나리·명전 검사 없음) · 취소 → 0xe5
 * 0xe7 키   비용 칸 이동을 안 받는다(기본 진행 0G 그대로) · 확인 → [171] · 취소 → 0xe6
 * 0xcf24   뽑기 bfa55(1,101) 는 하고, 실패여도 플래그가 서 있으면 성공 · SR+0x56 = 1 · 저장
 * 0xc7ba   결과 알림 확인 → 플래그 0 · 0xc9 (보통 트레이드도 같다)
 * ```
 *
 * **팀 고르기(0xe4)** 는 선수 등록 쪽 `TeamSelectScreen` 을 그대로 빌려 쓴다
 * 키 0x8250 이 칸 == SR+1(내 팀)이면 아무것도 안 하고 칸 > 9 면 히든 힌트를 띄우므로 칸 번호는 15팀 격자 그대로다
 * (내 팀 칸은 그림 0xa14c → 칸 그리기 0x7a570 이 로고 위를 검정 덮기 단계 7 로 어둡게 한다 — `TeamSelectScreen.coveredTeamId`).
 *
 * 0xe5 · 0xe6 은 엔트리 목록 창 0x5cfec(`EntryListWindow` — 기본 표 · 보기 전용)과 머리띠 0x54d95(제목 탭 ? 7 : 6),
 * 0xe7 은 확인 판 0xd4e8(`TradeConfirmWindow` — mode_ui 프레임 70 · 71 박스)과 머리띠 0x7f4ed("시즌모드")다.
 * ⚠️ 웹 커서: 목록 커서는 예전 시즌 목록 커서(`useSeasonCursor`)를 그대로 쓰고 윗줄만 0x6c2bd 대로 셈한다.
 * 요청 중 위·아래를 바꿔 넣는 키 −3 은 보기 전용 편집기의 왼쪽 갈래(0x559f8)라 끝 코드만 적고 아무도 안 읽는다 —
 * 곧 커서가 안 움직일 뿐이다(`lockedCursorOf` 주석).
 */
export function TradeScreen(props: TradeScreenProps) {
  const m = useTradeScreen(props)
  const { gamePoints } = props
  if (m.step.kind === '팀' && m.notice === null) {
    return (
      <TeamSelectScreen
        title="시즌모드"
        gamePoint={gamePoints}
        openedHiddenIds={m.openedHiddenIds}
        // 그림 0xa14c — 공용 목록 0x63b15 의 마지막 인자 (s8)[[this+0xa0]+1] = 내 팀: 그 칸 로고를 검정 덮기 단계 7 로 어둡게
        coveredTeamId={m.record.teamId}
        onSelect={m.chooseTeam}
        onSelectLocked={m.chooseTeam}
        onCancel={props.onBack}
        overlay={m.hiddenHint !== null && <MessageBox text={m.hiddenHint} buttons={['확인']} onAnswer={() => m.setHiddenHint(null)} />}
      />
    )
  }
  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xe4~0xe7 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      {m.isListShown && <TradeListWindow m={m} />}
      <TradeConfirm m={m} />
      <TradePopups m={m} onFinish={props.onFinish} />
      <TradeFrame m={m} gamePoints={gamePoints} />
    </RawScreen>
  )
}
