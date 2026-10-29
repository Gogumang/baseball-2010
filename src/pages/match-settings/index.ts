/**
 * **경기진행 설정 창**(원본 갱신 0x5fef4 · 키 0x5ffcc · 그리기 0x6042c)의 공개 API.
 *
 * 근거: `docs/re/J-modes-rules.md` J-3 · `docs/re/_raw/notes/R4-lineup-screens.md` 4절.
 *
 * 창은 상태를 저장하지 않는다 — 지금 설정을 받고, 확인창에서 '예' 를 누르면
 * 바뀐 `MatchProgressSettings` 를 `onConfirm` 으로 돌려준다. 저장 칸(모드 칸 m 은
 * 일반 0 · 시즌 1 · 대전 2)에 되쓰는 일은 부르는 쪽이 한다.
 *
 * 쓰는 곳:
 * - 일반모드 경기정보(상태 22)에서 '0'
 * - 시즌 경기 직전(상태 0xdd)에서 '0', 그리고 **한 번도 안 봤으면 저절로 열린다** (R13 4절)
 *
 * 시즌 세션은 이 창이 돌려준 설정을 시즌 저장 `matchSettings`(전역 +0x12c+1 자리, 새 시즌이 넘겨받는다)에 담아
 * `TeamGameOptions.settings` 로 넘긴다 — 한 번도 안 고쳤으면 생성자 0x9f26c 의 기본값(이닝 · 전체) `SEASON_DEFAULT_MATCH_SETTINGS`
 * (`src/app/model/useSeasonSession.ts`).
 */
export { MatchSettingsWindow } from '@/pages/match-settings/ui/MatchSettingsWindow'
