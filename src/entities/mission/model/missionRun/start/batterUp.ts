import { MISSION_NARI_RECORD, battingRecordAt } from '@/entities/mission/model/missionGame'
import type { MissionRun } from '@/entities/mission/model/missionRun/types'

/**
 * **지금 사람 칸 팀 타석에 미션 타자가 섰나** — 사건 기록 0xa57f8 은 코드 ≤ 0x13(안타 · 타점 · 타석 7 · 스윙 9 · 도루 0x10 …)을
 * `0xa56dc(R, 0xae89c(공격 팀), 1)` — 지금 타자가 R 의 선수(미션 타자)일 때만 R 에 넣는다(a5844~a584c). 타자 미션의 다른 타순은 사람 칸 팀
 * 마스터 줄이라 목표 · 타석 · 스윙 칸에 안 든다. 투수 미션은 늘 참(이 칸을 안 쓴다).
 */
export function isMissionBatterUp(run: Pick<MissionRun, 'mission' | 'game'>): boolean {
  if (run.mission.side !== '타자') return true
  return battingRecordAt(run.game.humanBatting) === MISSION_NARI_RECORD
}

/**
 * **미션 첫 반 이닝이 사람 몫인가** — 곧 첫 0x18 판이 서서 OK 를 기다리고 판 굴림 36(0x3fac4)이 도는가 (직접 재역어셈).
 * ```
 * 상태 8 끝 48bf0  모드 ∉ {1,2,3,4} → +0x197c = 0xf · 경기+0x24(상태 9 의 3fa4c 가 넣은 0x18) 예약 — 인트로 0xc 를 안 지난다
 *        48c86  모드 5 · 6 → 0xaae7c(ctx, 0xd, 0x18, 1)(마선수 다시 끼우기) · 0x47cc8 · 0xaae7c(ctx, 0xd, 0x18, 0)(시작 상황 aaf10)
 *               — 둘 다 0x18 **앞**이다. 마타자(모드 5)는 CPU 공격 팀에, 마투수(모드 6)는 CPU 수비 팀에 들어 아래 판정 대상이 아니다
 * 0x18 진입 0x3ac90  0xb6b6c — 시작 아웃 ≤ 2 라 뒤집지 않는다(0xb67d0 은 st[4] · st[5] · st[6] 을 안 지운다)
 * 0x4f928 틱 0  이전 상태 8 ≠ 0x21 → +0x1784 = 0 · 0xc2198(sim, 1) 거짓이면 판이 서고 4fb20 0x3fac4
 * 0xc2198      r = 0xc1e04(sim) || sim[1] || sim+0x94 — 시뮬 초기화 0xc0dac 가 sim+0x94 = 0(c0e06) · sim[1] = 0(c0e18 ← 3fa06 r4 = 0)
 * 0xc1e04      모드 5 c1e3e · 6 c1e6a: [ctx+0xa8] ≠ 0(모든 미션)이라 `!0xc1d38(sim)`
 * 0xc1d38      모드 5 c1d6a: 수비 팀 지금 투수 0xae8e8 이 육성 0xb6389(+0xa & 0x80) · 명예 0xb6349 면 사람
 *              모드 6 c1dae: 공격 팀 0xae944(교체 예약 +0x291 이 없으면 지금 타자 0xae89c)가 그렇다면 사람
 * ```
 * - 투수 미션(마선수 대결 투수편 포함, 모드 5): 공격 = 다른 칸(aa6ac), 수비 = 사람 칸. 0xaa57c aa81c 0xb8820 이 0x1fbd0 투수를
 *   명부에 넣고 aa842~aa878 이 첫 육성 · 명예 투수를 0xb5e98(…, 0, i, 1)로 0번(선발)에 세운다 → **늘 사람**.
 *   (aa7a4: g[0x11f]/g[0x176] 이고 g[0xf6] == 2(시즌)면 이 설치를 건너뛰지만 웹 대결은 나리 3 · 4 뿐이다)
 * - 타자 미션(마선수 대결 타자편 포함, 모드 6): 공격 = 사람 칸, aa7e8 이 미션 타자를 시작 타순 칸에 바꿔 넣고 aa88c 가
 *   팀+0x32 = 같은 시작 타순 → 지금 타자가 미션 타자(`isMissionBatterUp`).
 */
export function missionFirstHalfIsHuman(run: Pick<MissionRun, 'mission' | 'game'>): boolean {
  if (run.mission.side === '투수') return true
  return isMissionBatterUp(run)
}
