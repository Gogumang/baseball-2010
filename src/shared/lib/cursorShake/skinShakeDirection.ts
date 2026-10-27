import { cursorShakeDirectionOfKey } from '@/shared/lib/cursorShake/cursorShake'
import type { CursorShakeDirection } from '@/shared/lib/cursorShake/cursorShake'

/**
 * **까딱임 방향 칸 [skin+0x8c]** — 앱에 하나 (Q-10, 2026-10-27 직접 떴다).
 *
 * 스킨은 앱 초기화 0x2ed8 이 한 번 만들어(0x53b25 → 0x5390c) 메인 메뉴 [this+0x120] · 나리 · 시즌 장면이 같은 객체를 든다
 * (`skinFrameSlide` 머리말). 0x5390c 의 539f8~539fe 가 [skin+0x8c] = 0(← 방향)으로 두고, 그 뒤로 이 칸을 쓰는 곳은 0x5550c 하나다:
 * ```
 * 5550e  키 −3(←) → 0 · −4(→) → 1 · −1(↑) → 2 · −2(↓) → 3 을 [skin+0x8c] 에 — 그 밖의 키는 안 적는다 (지우는 곳도 없다)
 * ```
 * 그래서 화면을 건너 마지막 화살표가 남는다 — 앱을 켠 뒤 화살표를 한 번도 안 눌렀으면 0(←)이다.
 * 0x5550d 를 부르는 곳은 저마다 키 처리기다(r323 · r325 전수 — 풀 xref 25개 중 0x2ac00 의 2af18 은 풀 자료라 실제 부름은 24곳).
 * 날 키 = [장면+0x40] 그대로(숫자키는 안 적힌다) · 격자 키 = 숫자키 꼴 1 격자 vt+0x18(0x6c299 → 0x6c031, 표 0xd2e7c)이 바꾼 키(숫자키도 방향):
 * ```
 * 메인 메뉴 하위 4 · 5 · 9   0x29454 29518 · 0x28cb0 28e58 · 0x28ad4 28b82  날 키(앞 칸 · 뒤 칸 갈래)  useMainMenu
 * 스페셜 목록 6              0x28b9c 28c88                  날 키                       SpecialScreen
 * 환경설정 8 · 32 · 33        0x29550 2958a · 0x288ac 288e4 · 0x2c6d8 2c706  격자 키      SettingsScreen
 * 경기 중 설정               0x3c158 3cae0(격자 [+0xf94])   격자 키                       SettingsScreen(경기 중)
 * 기록연감 30                0x2b7a0 2b85c(본문 초점)       격자 키                       RecordAnnals
 * 미션 고르기                0x1daa4 1dacc                  격자 키                       MissionSelectScreen
 * 팀 고르기 다섯             0x8250 828c · 0x8da4 8de0 · 0x14114 1414a · 0x29b38 29b66 · 0x29c98 29cc6  격자 키  TeamSelectScreen
 * 경기정보 시즌 0xdd · 일반 22  0x83cc 8410 · 0x311a8 312de(설정 창 [skin+0x2ba] 이 닫혔을 때)  날 키  SeasonMatchInfoScreen · MatchInfoScreen
 * 마선수 21 · 시즌 0xd7        0x29df8 29e52 · 0xa248 a4fe(팝업 0x5fb25 이 안 가져갔을 때)  날 키  AceSelectScreen
 * 마선수 레벨업 28            0x2af20 2af7c(같은 팝업 뒤)    격자 키                       AceSelectScreen
 * 선공 · 구장 20             0x2896c 289c4(단계 0 날 키) · 28a44(단계 1 구장 격자 키)   FirstBatStadiumScreen
 * 에디트 29                  0x2b2e0 2b33c(하위 0 격자 키) · 2b44a(하위 1 엔트리 창, 날 키)  SpecialEditScreen
 * 공용 목록 0x62568          625be(16 · 17 · 27 · 시즌 0xe2 · 나리 145 — 창이 없으면 격자 키, 창이 떠 있으면 날 키)
 *                                                           SpecialScreen 명예의 전당 격자 · MessageBox `onRawKey`
 * 도움말 뷰어 0x637d0        637f0(메인 7 0x2cd54 · 경기 중 0x3ca36 — 격자 [skin+0x454] 숫자키 꼴 1)  격자 키  HelpScreen
 * 데이터 관리 34             0x28808 28838                  격자 키 — 웹에 없는 화면(환경설정 칸 5 는 안내만)이라 없음
 * ```
 * 읽는 곳: 스페셜 설명 판 0x252c6 · 환경설정 0x59462 · 기록연감 · 공용 격자 0x7a571(`gridCursorBounce`).
 */
let direction: CursorShakeDirection = 'left'

/** 지금 [skin+0x8c] */
export function skinShakeDirection(): CursorShakeDirection {
  return direction
}

/** 0x5550c(skin, 키) — 화살표만 적는다. 적었으면 그 방향, 아니면 null */
export function noteSkinShakeKey(key: string): CursorShakeDirection | null {
  const noted = cursorShakeDirectionOfKey(key)
  if (noted !== null) direction = noted
  return noted
}

/** 격자가 숫자키를 방향으로 바꾼 뒤 넘기는 곳(환경설정 · 기록연감 · 미션 고르기) — 방향을 곧장 적는다 */
export function noteSkinShakeDirection(next: CursorShakeDirection): void {
  direction = next
}

/** 시험 — 앱을 새로 켠 것처럼(0x5390c) */
export function resetSkinShakeDirectionForTest(): void {
  direction = 'left'
}
