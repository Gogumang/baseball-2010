import { createContext, useContext } from 'react'

/**
 * **공용 창 [0x140005c] 이 떠 있는가** — 히든 오픈 알림(0x62368 → 0x74ef5)처럼 앱이 모든 화면 위에 얹는 창.
 *
 * 장면 틀마다 0x754f9(창, 키)가 [창+9](떠 있음)이면 참을 돌려주고, 장면이 그때 건너뛰는 것은 장면마다 다르다 (직접 떴다):
 * ```
 * 경기 장면 0x52c50  52cc6 참이면 52ef2 로 — 상태 바꿈 0xbc9c9(틱 [장면+0x2c] +1 · 진입) · 키 0x498d4 · 상태 갱신표 0xd0530 을
 *                    모두 건너뛰고 그리기(0x457cc · 0x41230 · 그리기표 0xd05a0)만 한다
 * 나리 0x1cdec       1d070 참이면 상태 키 표 0xcc7e0 만 건너뛴다 — 상태 바꿈 · 진입(ce0e~) · 갱신(1d1b2~) · 그리기는 돈다
 * 시즌 0xe9ac        ec70 참이면 상태 키 표 0xcbf6c 만 건너뛴다
 * 메인 메뉴 0x32634  3263e 참이면 하위 상태 키 표 0xcefa4 만 건너뛴다 ([메뉴+0xe0] = 그 값)
 * 미션 고르기 0x1ea98 1eaac 참이면 0x1e99c(장면, 상태, 2) 를 건너뛴다 ([장면+0xa2] = 그 값)
 * ```
 * 키는 창(`MessageBox`)이 잡는 단계에서 다 가져가므로 웹은 따로 막을 것이 없고, 경기 장면만 이 값으로 갱신을 멈춘다
 * (`BattingStage` — 정산 0x19 갱신 0x4b100 의 결과 배경 +0x17e2 가라앉음).
 */
export const CommonWindowOpenContext = createContext(false)

export function useIsCommonWindowOpen(): boolean {
  return useContext(CommonWindowOpenContext)
}
