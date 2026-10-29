import { atom } from 'jotai'
import { UNFILLED_SPECIAL_SWING } from '@/app/model/missionSession/constants/missionConstants'
import type { LastPitcherThrow } from '@/app/model/missionSession/types/missionPlayTypes'

/** 투구 칸 atom — 마지막 공 · 0x12 진입 시계 · 마구 · 스태미나 · 필살 남은 칸 */

/** 투수 미션에서 마지막으로 던진 공 — 타석 장면(`PitcherSideStage`)이 그림으로만 다시 날린다(굴림 없음) */
export const lastPitcherThrowAtom = atom<LastPitcherThrow | null>(null)
/**
 * 마지막 공의 공 도착 0x3dfac 의 낫아웃 갈래(3e0aa)가 판정 칸을 지웠나 (`clearsPitchJudgement`) — 0x12 틱 0 의 판정 글자 · 삼진 파티클이
 * 없다. 못 맞힌 공은 0x12 진입 틀에 공 도착을 돌리므로(`handleThrow`) 그 틀에 선다 — 공(`lastPitcherThrow`)과 따로 둔다
 */
export const lastPitchJudgementClearedAtom = atom(false)
/**
 * 못 맞힌 공의 0x12 진입 틀 시계(`handleThrow`) — 서 있는 동안은 공이 날거나 0x12 라 다음 공 · 견제가 없다. 미션을 나가거나 포기하면
 * 거둔다(원본도 그 틀에 닿지 않는다). 장면 시계라 공용 창이 서 있으면 함께 선다 (그림에 안 쓰는 칸)
 */
export const cancelPitcherResultEntryAtom = atom<(() => void) | null>(null)
/**
 * **필살 남은 칸** s8 팀[+0x29 + 타순] — 미션 한 판에 한 번 채우고(0xaebe4) 스윙 틱 0x4e136 이 줄인다. −1 = 안 채움.
 * 이 칸은 타자 미션의 내 타자 칸이다 — 투수 미션 상대 타자 칸은 타순마다 CPU 타선(`MissionCpuBatting.specialSwing`)이 든다.
 */
export const batterSpecialSwingStoredAtom = atom(UNFILLED_SPECIAL_SWING)
/**
 * **투수 미션 마구 남은 칸** s8 팀[+0x28] — −1 = 안 채움(팀 new 0xb891c). 0xaebe4 가 미션 투수로 채우고
 * (`modePitcherMagicRemainingOf`) 코스 확정 0x50e9c 가 줄인다. 미션 한 판(새 경기)마다 −1 로 돌아간다.
 */
export const pitcherMagicStoredAtom = atom(UNFILLED_SPECIAL_SWING)
/**
 * **투수 미션 사람 투수의 레코드 +0x2c** — null 이면 미션 경기를 세울 때 베낀 값(`ModePitcher.stamina`, 0xb8820 → 0xb521c)이다.
 * 공마다 0xa5e14 가 깎고(0x11 진입 0x3dec6 — 모드 갈래 없음) 벤치 클리어링 0x3ab7c 가 −1000 한다. 경기를 새로 세우면(다시하기 ·
 * 다음 미션) 0x20094 가 팀을 다시 싣고 0xb8820 이 저장에서 다시 베끼므로 null 로 돌아간다 — 저장의 나리 투수 +0x2c 는 안 바뀐다.
 */
export const pitcherStaminaStoredAtom = atom<number | null>(null)
/**
 * **공 객체 +0x10** — 투수 미션 사람 공에 실린 마구 번호 (0x3de10). 되돌리는 줄이 없어 마구 뒤 공에도 남는다(H2 3-4).
 * 경기 시작 0 (0x1239 new 의 0 채움은 원본 미확인 — 팀 경기 `ballMagicNumber` 와 같다).
 * 미션에서는 CPU 가 이 공을 던질 일이 없다 — 투수 미션은 사람만 던지고 타자 미션은 사람이 안 던진다.
 */
export const ballMagicNumberAtom = atom(0)
