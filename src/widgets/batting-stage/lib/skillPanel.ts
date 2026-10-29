/**
 * **경기 스킬 표시 판 (장면 +0x19b0 ~ +0x19c0)** — 타석이 서면(0xd) 타자 · 투수가 장착한 스킬 가운데 지금 걸리는 것의 이름을
 * 화면 가장자리에 미끄러져 들어오는 판으로 20 그림 동안 보이고, 그 타자가 전국구 · 먹튀면 관중 함성 29 를 낸다 (2026-10-14 직접 떴다).
 *
 * ```
 * 세우기   0xd 진입 0x48d50  48f9a 0x445cc(장면) → [+0x19bc] = 타자 비트 · 48f9e 0x3d160(장면) → [+0x19c0] = 투수 비트
 *          48fa4  [+0x19c0] ≠ 0 || [+0x19bc] ≠ 0 → +0x19b0 = 1(함성 검사) · +0x19b4 = 20(수명) · +0x19b8 = 0(틱)
 *          0xf 진입 0x3d954  3dd4e  st[4](스트라이크) == 2 && 0xb62b4(수비 투수, 11) → [+0x19c0] = 0x800 · 같은 세 칸 (타자 비트는 그대로)
 * 그리기   0x4c4bc 의 4cad4 → 0x4b5b4 — 상태 0xf · 0x10 · 0x11 만(4b5ca), 0x33c98(야외 상태)면 안 그림
 *          [+0x19b4] ≤ 0 → 두 비트 · 틱 = 0 하고 끝(4b62c~4b67a)
 *          밀림 r5 = 47 − (sin(틱 == 0 ? 90 : 110)·47 >> 16) · r4 = 47 − (sin(min(틱·16, 110))·47 >> 16) − r5
 *          x = 0xb63c0(지금 타자) ? −r4 : W + r4 − 47   ; 두 판이 같은 x · 틱 0 이면 화면 밖 → 7 그림째 제자리(살짝 넘쳤다 돈다)
 *          [+0x19b8] += 1
 *          타자 판 (y = H − 22 부터 위로) · 타자 아이콘 · 투수 판 (y = H − 133) · 투수 아이콘 · 애니 7 · 8 한 칸 · 함성 검사
 *          [+0x19b4] −= 1 (4c47c)
 * ```
 * 판 한 장 (타자 4b7e0~4bae2 · 투수 4bcd6~4c00a, 비트가 0 이면 통째로 건너뜀):
 * ```
 * game_ui 프레임 61(줄, 47×3)을 (x, y) · y −= 높이(3)
 * 칸 = 6 줄까지(셈 > 5 면 다음 무리로): 무리 A 비트 20~17 · B 5~2 — 주황 프레임 60 / C 23~8(17~20 빼고) · D 7~0(2~5 빼고) — 파랑 59
 *      프레임을 (x, y), 글 = StrCOMMON[0x37 + 비트](타자 · 투수 0~7 공통 스킬) / [0x47 + 비트](투수 8~23 — 투수 스킬 번호 비트 + 16)
 *      을 프레임 59 의 상자 0 (4, −14, 41, 13) + (x, y) 가운데(0xba411 정렬 0x22) · y −= 프레임 59 높이(15)
 * game_ui 프레임 58 "SKILL"(49×11)을 (x, y)
 * ```
 * 무리는 0x5f350(skin, 비트)의 갈래 — 비트 0·1·8~16 좋음(1) · 2~5·17~20 나쁨(2) · 6·7·21~23 특수(4). 나쁜 것이 먼저 주황으로 선다.
 *
 * 아이콘 (타자 4bae6~4bcd4 · 투수 4c00e~4c206): 칸 (x0, y0, 40, 12), 비트 23 → 0 을 보며 셋까지(셈 > 2 면 끝)
 * ```
 * 그림 = 0x4b550(장면, 비트, 타자?) — game_ui 이미지(74 히트 · 75 파워 · 76 수비 · 78 제구 · 79 구속 · 80 변화 · 81 체력, 없으면 −1)
 * 위 = 0x5f350 & 1 || 0x5f350 & 4                     ; 좋음 · 특수 → 애니 7(위 화살표), 나쁨 → 애니 8(아래 화살표)
 * 앞 칸에 같은 그림이 있으면 새 칸을 안 세우고(그 칸 = 0 · 위 = 1 로 지움) 앞 칸의 위를 (앞 위 && 새 위)로   ; 4bbe8~4bc2c
 * 그리기: 그림 > 0 인 칸만 — 애니(7|8)를 (x0, y0) · 그림을 칸 오른쪽 맞춤 세로 가운데(0xb9d35 정렬 0x24) · y0 −= 15
 * 타자 칸 (W/2 − 20, H − 96) · 투수 칸 (투수 앵커 x − 20, 앵커 y − (0xb6c20(st, st[0xa]) ? 0x34 : 0x4e))
 * ```
 * 함성 29 (4c26a~4c3a2, `[+0x19b0] ≠ 0` 인 첫 그림 한 번):
 * ```
 * 측 = st[9] ≠ 0 ? 1 : 0 · 칸 = 0xb6394(타자) = rec[0xa] & 0x1f
 * b = ldrb [스킨 + 측·2 + 0x44c] & (1 << 칸)          ; 낮은 바이트만 — 칸 8 이상은 늘 0 (원본 그대로)
 * 0xb62b4(타자, 2) && b → halfword ^= 1 << 칸 · 29 / 아니면 0xb62b4(투수, 2)(값 버림) · 0xb62b4(타자, 1) && b → 같은 끄기 · 29
 *                        / 아니면 0xb62b4(투수, 1)(값 버림)
 * [+0x19b0] = 0
 * ```
 * 비트 칸은 경기 장면 초기화 0x3301c 가 두 측 모두 0x3ff 로 채우고, 교체 연출 0x16 진입 0x3d458 의 대타 가지 3d562
 * 0x668cc(스킨, 공격 팀, 0)이 다시 세운다(`restoreCheerBit`) — 대타 확정 0xaebe4(3d56c)보다 앞이라 0xae89c(공격 팀)은 아직
 * **나가는 타자**다(사람 대타 · 사람 수비 타석의 CPU 대타 모두, `SubstitutionScene.cheerRestore`).
 *
 * 사람이 치는 타석(`BattingStage`)과 사람이 던지는 타석(`PitcherSideStage`)이 같은 판을 그린다 — 0xd 진입 0x48d50 ·
 * 0x445cc · 0x3d160 · 그리기 0x4c4bc → 0x4b5b4 · 함성 4c26a 어디에도 조작(0x33fe4) · 모드 갈래가 없다(모드 7 만 비트 0).
 * 사람이 던지면 타자 판은 CPU 타자의 것, 투수 아이콘 칸은 사람 수비 y − 0x4e 다.
 */

export { batterSkillPanelBitsOf, pitcherSkillPanelBitsOf, skillBitsOfIds } from '@/widgets/batting-stage/lib/skillPanel/skillPanelBits'
export type { SkillPanelSituation } from '@/widgets/batting-stage/lib/skillPanel/skillPanelBits'
export {
  SKILL_PANEL_LIFETIME,
  TWO_STRIKE_PITCHER_BITS,
  SKILL_PANEL_IDLE,
  enterAtBatSkillPanel,
  enterPitchSkillPanel,
} from '@/widgets/batting-stage/lib/skillPanel/skillPanelState'
export {
  SKILL_ROW_TEXT_BOX,
  skillCategoryOf,
  skillPanelXOf,
  skillRowTextOf,
  skillPanelSheetOf,
} from '@/widgets/batting-stage/lib/skillPanel/skillPanelSheet'
export { skillIconSlotsOf, pitcherIconOriginOf, skillArrowEntryOf } from '@/widgets/batting-stage/lib/skillPanel/skillPanelIcons'
export { skillPanelViewOf, stepSkillPanel } from '@/widgets/batting-stage/lib/skillPanel/skillPanelView'
export type { SkillPanelView } from '@/widgets/batting-stage/lib/skillPanel/skillPanelView'
export {
  SKILL_CHEER_SOUND_ID,
  SKILL_CHEER_BITS_START,
  createSkillPanelScene,
  skillCheerOf,
  restoreCheerBit,
} from '@/widgets/batting-stage/lib/skillPanel/skillPanelCheer'
export type { SkillPanelScene } from '@/widgets/batting-stage/lib/skillPanel/skillPanelCheer'
export { drawSkillPanel } from '@/widgets/batting-stage/lib/skillPanel/drawSkillPanel'
