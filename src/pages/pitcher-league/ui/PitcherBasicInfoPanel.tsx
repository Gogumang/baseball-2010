import { Hint, Panel, StatGrid } from '@/shared/ui'
import type { StatEntry } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  effectivePitcherAbilityOf,
  pitcherAbilityLimitsOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ABILITY_NAMES, PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { TITLE_NAMES } from '@/entities/career/model/titles'
import {
  PITCHER_HAND_LABELS,
  PITCHER_ROLE_LABELS,
  PITCHER_SKIN_LABELS,
  PITCHER_TYPE_LABELS,
  pitcherRoleChoiceOf,
} from '@/entities/pitcher-career/model/pitcherRegistration'
import * as styles from '@/pages/pitcher-league/ui/PitcherManagementScreen.css'

/**
 * 선수정보 → **기본정보** (원본 상태 **119**, 그리기 0x166cc → 기본정보 카드 0x15e20).
 *
 * 원본 카드의 정보 칸은 여덟이다 — 왼쪽 팀명·이름·타입·필살 / 오른쪽 보직·손·피부·타순
 * (`basicInfoLayout.ts` INFO_COLUMNS, 이름표 그림 81·320~326).
 * ⚠️ **추정**: 그 표는 **타자 카드(mode_ui 프레임 2)** 의 것이고 투수 카드(프레임 1)의 칸 이름 그림은
 * 문서에 없다. 투수에게 뜻이 없는 "타순" 자리에 마구를, "필살" 자리에 구질 수를 넣었다.
 *
 * 원본은 여기서 `*` 키로 칭호 목록(129), `0` 키로 능력치 상세 창(120)으로 간다.
 * 칭호 목록은 `PitcherManagementScreen` 이 타자편 창을 그대로 띄운다 — **120 은 아직 없다.**
 *
 * 장착 칭호 줄은 선수 `+0x1c4 < 0` 이면 **아예 그리지 않는다** (0x7d5cc, P3 10-1).
 */

interface PitcherBasicInfoPanelProps {
  readonly career: PitcherCareer
}

export function PitcherBasicInfoPanel({ career }: PitcherBasicInfoPanelProps) {
  const limits = pitcherAbilityLimitsOf(career)
  const effective = effectivePitcherAbilityOf(career)
  /** 선수 +0x1c4 → StrNICKNAME[번호]. 투수 번호 48~63 의 이름이 그대로 들어 있다 (P3 8절) */
  const equippedTitle = TITLE_NAMES[career.equippedTitle]

  // 능력치 세 줄 — 지금 값 / 보직 한계(0xa44f4) / 경기에 실제로 쓰이는 실효값(0xb570c)
  const abilityEntries: readonly StatEntry[] = PITCHER_ABILITY_ORDER.map((key, slot) => ({
    label: PITCHER_ABILITY_NAMES[slot],
    value: `${career.ability[key]} / ${limits[key]}`,
  }))
  const effectiveEntries: readonly StatEntry[] = PITCHER_ABILITY_ORDER.map((key, slot) => ({
    label: PITCHER_ABILITY_NAMES[slot],
    value: effective[key],
  }))

  return (
    <>
      <Panel heading="기본정보">
        <Row label="팀" value={TEAMS[career.teamId]?.name ?? ''} />
        <Row label="이름" value={career.name} />
        <Row label="타입" value={PITCHER_TYPE_LABELS[career.typeIndex] ?? ''} />
        <Row label="보직" value={PITCHER_ROLE_LABELS[pitcherRoleChoiceOf(career.role)] ?? ''} />
        <Row label="손" value={PITCHER_HAND_LABELS[career.handIndex] ?? ''} />
        <Row label="피부" value={PITCHER_SKIN_LABELS[career.skinIndex] ?? ''} />
        <Row label="마구" value={`레벨 ${career.magicLevel}`} />
        {/* 장착한 것이 없으면(−1) 원본도 이 줄을 안 그린다 (0x7d5cc) */}
        {equippedTitle !== undefined && <Row label="칭호" value={equippedTitle} />}
      </Panel>

      <Panel heading="능력치 (지금 / 한계)">
        <StatGrid entries={abilityEntries} />
        <Hint>한계는 타입이 아니라 보직으로 갈린다 — 표 0xd80be × 10 (선발 800 네 칸 / 구원 850·850·850·600)</Hint>
      </Panel>

      <Panel heading="실효 능력치">
        <StatGrid entries={effectiveEntries} />
        <Hint>장비 → 질병 → 부상 → 사기 차례로 깎인 값이다 (0xb570c)</Hint>
      </Panel>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </div>
  )
}
