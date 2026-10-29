import type { useMissionSession } from '@/app/model/useMissionSession'
import type { OriginalMission } from '@/shared/config/original/missions'
import { missionResultHeldOf } from '@/pages/mission-play/lib/missionResultBoard'

/*
 * **마선수 대결의 경기 중 "나가기"** — 확정 (0x40140 · 0xa5368 · SYS 8 0x8d764~0x8d846 · 105 진입 0x11b46~0x11bbe · 0x10df8 직접 뜸):
 * ```
 * 40140  전역 모드 0x1552d14 = 장면+0x1104 · "예"이고 모드 5·6 이면 0xa5368(미션, 0)([obj+0xbc] = 0 만 — a538e → a5452)
 *        0x140006c = 4 · 0xbc291(…, 0x103)(메인 메뉴 처음 단) · 0xbdae9 소리 밀기 — g[0x11f] · g[0x176] · g[0x144] · g[0x177] 을
 *        읽지도 쓰지도 않고 저장(0x22755)도 없다
 * ```
 * 결과 바이트는 SYS 8 이 미리 적어 둔 값이 남는다 — 타자편 g[0x144] = 0(8d7c4~8d7cc), 투수편 g[0x177] = 0x7b971 반환(투수편 갈래에서
 * 거짓 → 0). 플래그(g[0x11f] / g[0x176])도 1 로 남아, **그 편 나리에 다시 들어올 때** 105 진입이 상태 0x70(112) → 0x8c(140)으로
 * 가고 0x10df8 이 결과(0 = 짐)로 resultEvents[1] 을 0x8bdc9 로 부른 뒤 칸들을 지운다(타자편 10ebe~10f0c · 투수편 10f0e~).
 * 그 사이 보통 미션도 플래그를 본다(0xaa57c aa6e0 사람 칸 팀 · 0x4ef3e G 건너뜀 · 결과 판 대결 꼴 · 0x4ea0c 가 결과 바이트를 덮어씀).
 * 웹: 그 대기는 전역기록 모델(`entities/mode-save` 의 `aceMatchPending` — SYS 8 자리에서 저장)이 편마다 들고, 105 진입(타자편
 * `useCareerSession` · 투수편 `usePitcherLeagueSession` 의 도착 고리 — 투수편 화면이 서 있을 때만)이 부상 엔딩 다음에 진 결과
 * 이벤트를 띄우며 지운다. 선수를 지우고 새로 만들어도 남는다. 나가기는 보통 미션처럼 메인 메뉴로 간다 — 타자편
 * `quitBatterMission`, 투수편 `quitPitcherMission` + 투수편 세션 `quitAceMatch`.
 * 대기가 서 있는 동안의 보통 미션도 원본대로 대결 꼴이다 — 사람 칸 팀 0xaa57c aa6e0 · 명예 선수 대신 나리 선수(0x1fc20 · 0x1fbd0) ·
 * G 건너뜀 0x4ef3e · 결과 판 대결 꼴 0x4a384 · 결과 바이트 덮어쓰기 0x4ea0c 4efc6~4f018 · 판을 닫으면 g[0xf6] 의 나리 편으로
 * (0x407f0 4090c · 0x4b100 4b344) — `useMissionSession` 의 `aceMatchHold` · `onReturnToNari`, App 이 그 편으로 들어간다.
 */
/**
 * 마선수 대결의 전역 기록 칸 — 타자편 대결은 SYS 8 이 g[0x11f] = 1, 투수편 대결은 g[0x176] = 1 을 적는다.
 * 결과 판 0x4a384 는 둘 중 하나라도 서면 앞부분만 그리고, 0x4ea0c 는 G 보상을 건너뛴다.
 */
export const BATTER_ACE_MATCH_FLAGS = { flag11f: true, flag176: false } as const
export const PITCHER_ACE_MATCH_FLAGS = { flag11f: false, flag176: true } as const

type AceMatchFlags = { readonly flag11f: boolean; readonly flag176: boolean }

/** 판의 대결 꼴 칸 — 이 판이 세운 칸(대결)과 대기 칸 g[0x11f] · g[0x176] 의 합. 둘 다 없으면 보통 판 */
function aceMatchFlagsOf(
  hold: { readonly batter: boolean; readonly pitcher: boolean },
  ownFlags: AceMatchFlags | undefined,
): AceMatchFlags | undefined {
  if (ownFlags === undefined) return hold.batter || hold.pitcher ? { flag11f: hold.batter, flag176: hold.pitcher } : undefined
  return { flag11f: ownFlags.flag11f || hold.batter, flag176: ownFlags.flag176 || hold.pitcher }
}

/**
 * 결과 판의 번 G · 보유 G (0x4ea0c 가 더한 뒤 — 세션이 판이 설 때 더했다). 판의 대결 꼴은 전역 칸 g[0x11f] · g[0x176] 을 그대로 본다 —
 * 대기가 서 있으면 보통 미션 판도 대결 꼴이다(0x4a384 · 0x407f0 · 0x4ef3e). 대결이면 그 편 칸은 SYS 8 이 세웠다.
 */
export function resultBoardOf(
  session: ReturnType<typeof useMissionSession>,
  mission: OriginalMission,
  status: string,
  gamePoint: number | undefined,
  ownFlags?: AceMatchFlags,
) {
  const aceMatch = aceMatchFlagsOf(session.aceMatchHold, ownFlags)
  const earnedGamePoint = session.resultEarnedGamePointOf(mission, status, aceMatch !== undefined)
  return {
    earnedGamePoint,
    // 정산 진입 0x4ea0c 가 G 를 더한 뒤다 — 세션이 판이 설 때 이미 지갑에 더했다(`useMissionSession` 정산 고리)
    ...(gamePoint === undefined ? {} : { heldGamePoint: missionResultHeldOf(gamePoint, 0) }),
    ...(aceMatch === undefined ? {} : { aceMatch }),
  }
}
