import { Panel } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  GAMES_PER_SEASON, hasPitcherSkill, isPitcherSkillEquipped, seasonEarnedRunAverageOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_ROLE_LABELS, pitcherRoleChoiceOf } from '@/entities/pitcher-career/model/pitcherRegistration'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import {
  gamesUntilNextStartOf,
  todayAssignmentOf,
} from '@/pages/pitcher-league/model/pitcherGameOptions'
import {
  HELPLESSNESS_SKILL_ID, LUCK_SKILL_ID, StatusIconRow, statusIconFramesFrom,
} from '@/pages/management/ui/StatusIconRow'
import type { StatusIconState } from '@/pages/management/ui/StatusIconRow'
import * as styles from '@/pages/pitcher-league/ui/PitcherManagementScreen.css'

/**
 * 관리 화면 상태판 — 원본 0x7d34c(상태판) + 기본정보 카드 0x15e20 이 보여 주는 값들 중
 * **투수편에서 뜻이 있는 것**만 모았다.
 *
 * 투수편에만 있는 줄이 셋이다:
 *   - **보직** (`+0xb & 3`) — 등판·강판·능력 한계가 이 값으로 갈린다 (`pitcherRole.ts`)
 *   - **스태미나** (`+0x2c`, 0~10000) — 경기 사이에 이어지고 시즌 시작에만 10000 으로 돌아간다 (P1 3절)
 *   - **등판 예고** — 선발은 날짜 카운터 g 가 짝수인 날마다, 구원은 매 경기 8회 (StrHOWTO[11], P1 1절)
 *
 * ⚠️ **원본 배치 미해독 — 근사**: 원본 상태판은 인기도·소지금·평판·연봉 네 칸과 사기 막대를 정해진
 * 좌표에 그리지만(타자편 `managementLayout` STATUS_BOXES), 투수 카드(mode_ui 프레임 1)의 칸 이름 그림은
 * 문서에 없다. 여기서는 공용 판에 줄로만 세운다.
 */

interface PitcherStatusBoardProps {
  readonly career: PitcherCareer
}

function Row({ label, value, isDuty = false }: { label: string; value: string; isDuty?: boolean }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={isDuty ? styles.dutyValue : styles.infoValue}>{value}</span>
    </div>
  )
}

/** 경기 번호 = 치른 경기 + 1, 시즌을 다 치렀으면 45 (0x7d120) */
function seasonGameOf(gamesPlayed: number): number {
  return Math.min(gamesPlayed + 1, GAMES_PER_SEASON)
}

/** 방어율 — 0xb6ce8 은 ×100 정수라 소수점 둘째 자리까지 되돌린다 */
function earnedRunAverageTextOf(career: PitcherCareer): string {
  return (seasonEarnedRunAverageOf(career.stats) / 100).toFixed(2)
}

/** 다음 선발까지 남은 경기 — 구원은 매 경기 8회라 예고가 없다 (P1 1-3) */
export function nextStartTextOf(career: PitcherCareer): string {
  if (career.role === PITCHER_ROLE.relief) return '매 경기 8회'
  return gamesUntilNextStartOf(career) === 0 ? '오늘' : `${gamesUntilNextStartOf(career)}경기 뒤`
}

/**
 * 상태 아이콘 줄의 조건 — 투수편(모드 3)도 0x7d34c 의 같은 줄을 탄다. 모드 갈림은 시즌(모드 2, 0x7b998) 하나뿐이라
 * 행운 91 · 이글아이 85 · 질병 86 · 부상 87 · 무력감 88 다섯을 타자편과 똑같이 본다.
 * 이글아이 칸은 선수 +0x54 를 보지만, 문서상 그 칸을 올리는 곳은 타자 GP 칸 9(이글아이)·시즌 GP 칸 4 뿐이고
 * 투수편 GP 칸 9 는 십전대보탕(스태미나 100%)이다 (K 104·536줄, P4 6절). 그래서 투수 커리어엔 그 칸이 없고 0 으로 둔다.
 */
export function pitcherStatusIconStateOf(career: PitcherCareer): StatusIconState {
  return {
    isLuckEquipped: isPitcherSkillEquipped(career, LUCK_SKILL_ID),
    eagleEyeGamesRemaining: 0,
    isSick: career.isSick,
    isInjured: career.isInjured,
    hasHelplessness: hasPitcherSkill(career, HELPLESSNESS_SKILL_ID),
  }
}

export function PitcherStatusBoard({ career }: PitcherStatusBoardProps) {
  const team = TEAMS[career.teamId]?.name ?? ''
  const iconState = pitcherStatusIconStateOf(career)
  return (
    <>
      {statusIconFramesFrom(iconState).length > 0 && (
        <div className={styles.statusIconRow}>
          {/* 줄 상자가 이미 박스 11 의 y 자리라 세로 원점을 −45 로 되돌린다 */}
          <StatusIconRow state={iconState} originY={-45} />
        </div>
      )}
      <Panel heading={`${career.name} · ${team}`}>
        <Row label="연차" value={`${career.season}년차`} />
        <Row label="경기" value={`${seasonGameOf(career.gamesPlayed)}/${GAMES_PER_SEASON}`} />
        <Row label="보직" value={PITCHER_ROLE_LABELS[pitcherRoleChoiceOf(career.role)] ?? ''} isDuty />
        {/* 오늘 등판 · 다음 선발 — 등판 판정 0xa4f60 이 보는 것과 같은 값이다 */}
        <Row label="오늘 등판" value={todayAssignmentOf(career)} isDuty />
        <Row label="다음 선발" value={nextStartTextOf(career)} isDuty />
        <Row label="스태미나" value={`${staminaPercentOf(career.stamina)}%`} />
      </Panel>

      <Panel heading="상태">
        <Row label="사기" value={`${career.morale}`} />
        <Row label="인기도" value={`${career.popularity}`} />
        <Row label="평판" value={`${career.reputation}`} />
        <Row label="소지금" value={`${career.money}만원`} />
        <Row label="연봉" value={`${career.salary}만원`} />
        {/* 무승부는 원본에 없다(정산 4f072 는 승/패 둘뿐, d73367e) — "N무" 를 걷었다 */}
        <Row label="팀 전적" value={`${career.wins}승 ${career.losses}패`} />
        <Row label="방어율" value={earnedRunAverageTextOf(career)} />
        {career.isInjured && <Row label="부상" value={`${career.injuryRemaining}경기`} />}
        {career.isSick && <Row label="질병" value={career.illnessName ?? ''} />}
      </Panel>
    </>
  )
}
