/**
 * **나만의리그 142 경기 준비(매치업)** — 진입 `0x1c46c` · 키 `0x13c30` · 그림 `0x15d98` (직접 떴다, 장면 0x106 모드 3·4 공용).
 *
 * 진입 0x1c46c 의 마선수 넣기 (1c55c~1c668):
 * ```
 * 1c55c  이전 상태 == 143(0x8f) 이거나 장면+0x288 ≠ 0 → 아래를 건너뛴다          ; +0x288 = 이 장면에서 한 번 (장면 셋업 0xfb7c 가 0)
 * 1c574  g = (s8)S+0xb2 ; g ≠ 0 → 상대 0xb8c80 (로테이션) …                      ; 웹 `leagueGamePitchersOf` · `pitcherLeagueGameSetupOf`
 * 1c5fe  S+0x12c(국가대항전) == 0 이면:
 * 1c60c    b = 0x9f604(저장)        ← 굴림 1  내 마타자 — 열린 마타자(저장 +0x35..+0x39) 중 균등
 * 1c61a    p = 0x9f650(저장)        ← 굴림 2  내 마투수 — 열린 마투수(저장 +0x30..+0x34) 중 균등
 * 1c62e    0xb88c8(내 팀, p) · 0xb8870(내 팀, b)
 * 1c640    0xb88c8(상대, 0x66968(p))   ← 굴림 3  상대 마투수
 * 1c656    0xb8870(상대, 0x66994(b))   ← 굴림 4  상대 마타자
 * 1c668  장면+0x288 = 1
 * ```
 * 그래서 **장면이 새로 설 때마다(이어하기 · 경기 뒤) 처음 142 에 들어설 때 한 번** 넷을 굴린다. 109 로 물러났다 다시
 * 들어와도 안 굴린다 — 0xb88c8 은 `0xb8680(팀)` 이 돌려주는 명부(모드 3·4 → 0x1f989 = 저장 블록 [g+0xb8]/[g+0xbc] 의
 * 나리 팀 레코드)에 `0xb521d` 로 마선수를 넣고, 그것을 빼는 코드가 없어 다시 세운 팀 객체(0xb891c)에도 남는다(확정).
 * 0x9f604·0x9f650 은 열린 수가 0 이어도 `bfa55(0, 0)` 을 부른다(개수 검사 없음, 0x9f630·0x9f67c).
 *
 * 키 0x13c30 (머리띠가 다 내려왔을 때만 — 전역 +0xe4):
 * ```
 * −5 · '5'   저장 [모드+0x4c] = 1 · 저장(0x1f1b9 · 0x1fd45 · 0x1fded · 0x22755) · 밀기(1, 0, 5, 1500) → 144 → 경기 장면
 *            ([모드+0x4c] = 전역기록 0x1f1d9 의 "그 모드 경기 중간 저장됨" — 모드 3·4 칸 +0x4f · +0x50 은 0x327b8 의 모드 3·4
 *            갈래가 읽는다: [14]·[최근게임] 에서 `+0x40+m && +0x4c+m` 이면 0x213c0(앱, m, 0) → 곧장 경기 장면 0x104.
 *            89a6b81 의 "읽는 곳이 없다" 정정 — `NariGameMatch` 머리글)
 * −16        0xbd59d · S+0x12c → 135 · S+0xb4 → 128 · 그 밖 109
 * −3 · '4'   장면+0x164 = 1 · 밀기(8, 0, 4, 1000) → 143 (엔트리 편집)
 * −4 · '6'   장면+0x164 = 0 · 밀기(8, 0, 3, 1000) → 143
 * 그 밖      목록 [+0xa0] vt+0x18
 * ```
 * 그림 0x15d98: 공용 목록 `0x63b15([+0xd8], [+0xa0], 4, 이전 ≠ 143, 틀 수, −1)` — k 4 경기정보(일반모드·시즌 0xdd 와 같은 배치)
 * + 머리띠 0x7f4ed (틀 0x16928 의 142 갈래: 제목 8 타자편 / 9 투수편 · 바닥 5).
 */
export { NO_NARI_ACE, rollNariMatchAces, type NariMatchAces, type NariOpenedAces } from './nariMatchPrepare/matchAces'
export { nariGameMatchOfSave, nariMatchCancelTargetOf, type NariGameMatch, type NariGameSavePort } from './nariMatchPrepare/gameMatchSave'
export { rollNariMatchInfoStage, rollNariMatchStadium } from './nariMatchPrepare/matchStage'
export { batterMatchInfoOf, cupMatchInfoOf, nariMatchInfoLines, type NariMatchScreenData } from './nariMatchPrepare/matchInfo'
