import { FrameSprite, RawScreen } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { HalfInningCards } from '@/widgets/game-scene/ui/HalfInningCards'
import type { HalfInningCardsAt } from '@/widgets/game-scene/ui/HalfInningCards'
import { roundPlateRectsOf } from '@/widgets/scoreboard-frame/lib/scoreboardFrameLayout'
import { LineScoreBoard } from '@/widgets/line-score/ui/LineScoreBoard'
import { LINE_SCORE_AT } from '@/widgets/line-score/lib/lineScoreLayout'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import type { MissionAutoRelayStep } from '@/entities/mission/model/missionAutoRelay'
import * as styles from '@/pages/auto-play-relay/ui/AutoPlayRelayScreen.css'

/** "공격팀(%s)" 의 %s — st[0x31 + st[9]] == 0(사람 칸)이면 "PLAYER"(0xd0724), 아니면 "COM"(0xd072c) */
export const OFFENSE_LABEL = { player: 'PLAYER', computer: 'COM' } as const

/** 화면 240×320 — W · H */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/**
 * **기준 칸** — 425bc `0x94a65(out, game_ui 프레임 19, 0, 4)` = `boxes.json` "019" 상자 4 (14, 213, 212, 57) — 교대 판 0x4fe9c 와 같은
 * 칸(`HALF_INNING_CARDS_SPAN`). 0x4258c 는 그 **폭**(+4)으로 가로 자리를, **높이**(+6 — `ldrsh [sp, #0x92]`)로 띠 · 글의 y 를 잡는다.
 */
const BASE_BOX = { width: 212, height: 57 } as const

/** 점수판 0x41c18(경기, W/2 − 폭/2, 10, 0) 자리 (42812~4283a) — `LINE_SCORE_AT.autoRelay` */
export const SCOREBOARD_AT = { x: SCREEN_WIDTH / 2 - BASE_BOX.width / 2, y: 10 } as const

/** 두 팀 판 — 0x420dc(경기, W/2 − 폭/2 − 6, H − 0x46) → 0x42364(경기, W/2 + 0x24, H − 0x46) 차례 (4283e~4289a) */
export const RELAY_CARDS_AT: HalfInningCardsAt = {
  pitcherX: SCREEN_WIDTH / 2 - BASE_BOX.width / 2 - 6,
  dueUpX: SCREEN_WIDTH / 2 + 0x24,
  y: SCREEN_HEIGHT - 0x46,
}

/** "공격팀(%s)" 띠 — 0x6b7d4(gfx, W/2 − 폭/2, 높이 + 0xf, 폭, 0x12, 1, 0xB4122352) (428b8~428e2) */
export const OFFENSE_BAND = {
  x: SCREEN_WIDTH / 2 - BASE_BOX.width / 2,
  y: BASE_BOX.height + 0xf,
  width: BASE_BOX.width,
  height: 0x12,
} as const

/** 띠 글 — 0xba269(글, W/2 − 폭/2 + 5, 높이 + 0x13, 폭, −1, 0) 왼쪽 맞춤 노랑 (42974~429aa) */
export const OFFENSE_TEXT_AT = { x: OFFENSE_BAND.x + 5, y: BASE_BOX.height + 0x13 } as const

/**
 * 공격 팀 이름 그림 — img_text 프레임 0xb6bdd(st, st[9]) + 0x41 을 오른쪽 끝 (W/2 + 폭/2 − 그림폭 − 5, 높이 + 0x13) 에
 * (0x913e5 팔레트 0 · 0xba815 크기 · 0xba759, 429ae~42a16)
 */
export const OFFENSE_TEAM_RIGHT = SCREEN_WIDTH / 2 + BASE_BOX.width / 2 - 5
const TEAM_NAME_BASE_FRAME = 0x41

/**
 * 중계 글 칸 — 0x7c×0x12 칸을 ((W − 0x7c) >> 1, ((H − 0x12) >> 1) + 0x2d) 에 0xba0bd(둥글기 1, 0xB4122352),
 * 글 `"!C!cffff00%s"`(0xd0744) 는 0xba269(글, 칸x, 칸y + 4, 0x7c, −1, 0) 가운데 노랑 (42a1a~42aae, sim+0xc4 ≠ 0 일 때만)
 */
export const RELAY_BOX = {
  x: (SCREEN_WIDTH - 0x7c) >> 1,
  y: ((SCREEN_HEIGHT - 0x12) >> 1) + 0x2d,
  width: 0x7c,
  height: 0x12,
} as const

const IMG_TEXT_FRAMES = './sprites/img_text/frames'

interface AutoPlayRelayScreenProps {
  /** 마지막으로 굴린 틱의 중계 칸 (`useMissionSession.autoRelayStep`) — 아직 안 굴렸으면 null */
  readonly step: MissionAutoRelayStep | null
  /**
   * 갱신 0x48480 한 번 — 틱마다 부른다. 부르는 쪽(세션 `stepAutoRelay`)이 0xc2198 → 0xc262c 한 번을 굴리고, 0xc2198 이 거짓이면
   * (자동진행 끝) 상태 0x18 로 넘긴다(+0x1784 = 0, 미션은 판 없이 곧장 0xd — 이 화면이 내려간다).
   */
  readonly onTick: () => void
  /** 두 측 팀 (경기[0x28 + 칸] — 0xaa57c 가 세운 사람 칸 · 다른 칸 팀) */
  readonly sideTeams: readonly [number, number]
  /** 사람 칸 (st[0x31 + 칸] == 0 인 측) */
  readonly humanSide: 0 | 1
  /**
   * 미션 타자(0x1fc20 — 명예 타자 또는 나리 타자편 저장 선수)의 이름 — DUE UP 줄이 그 선수 칸(`dueUpIsMissionBatter`)이면
   * 0xb62c0 이 기록 +1 의 이름을 그린다. 안 넘기면 그 줄 이름을 비운다.
   */
  readonly missionBatterName?: string | null
}

/**
 * **자동진행 중계 화면 (경기 장면 상태 0x21)** — 미션(모드 5·6) 갈래. 머리말은 `entities/mission/model/missionAutoRelay`.
 *
 * - 갱신 0x48480: 모드 5·6 은 속도 칸(전역 +0xbc)을 안 보고 **매 틱 0xc262c 한 번**(타석 하나 또는 교체 틱 하나) — `onTick` 이 그 틱을
 *   굴린다(세션 `stepAutoRelay`). 마지막 틱 다음 틱에 0xc2198 이 거짓을 내 0x18 로 간다 — 세션이 판을 넘기면 이 화면이 내려간다.
 *   중계 도중 제한 시간이 다 되면 다음 틱을 안 굴린다(남은 타석은 안 굴린다).
 * - 키 0x3e25c 는 모드 ∈ {1,2,8,9} 에서만 — 미션은 속도 ←→ · CLR 중단 질문(StrGAME[6])이 없다. 배경음 0x21(진입 0x3abf0)도 없다.
 * - 그리기 0x4258c: 작은 다이아몬드 · 투수/포수/타자 그림 · 아래 안내 띠 · 속도 칸 3개는 모드 ∈ {1,2,8,9} && v ≠ 2 에서만이라
 *   미션은 점수판 0x41c18(경기, x, 10, 0) · 두 팀 판 0x420dc · 0x42364(H − 70) · "공격팀(%s)" 띠 + 공격 팀 이름 그림(img_text
 *   `팀 + 0x41`) · 중계 글(sim+0xc4 ≠ 0 일 때만)을 그린다.
 * - 제한 시간은 이 동안에도 흐른다(0xaada4 — 부르는 세션의 타이머가 그대로 돈다).
 *
 * - 자리(0x4258c, 직접 떴다): 기준 칸 = game_ui 프레임 19 상자 4(폭 212 · 높이 57). 점수판 0x41c18 (14, 10) · 두 팀 판
 *   PITCHER (8, 250) → DUE UP (156, 250) · 띠 (14, 72, 212×18) · 띠 글 (19, 76) · 팀 이름 그림 오른쪽 끝 221 · 중계 칸 (58, 196, 124×18).
 *   띠 · 글의 y 는 기준 칸의 **높이**(57)에서 잡는다(원본 그대로 — `ldrsh [sp, #0x92]`).
 *
 * - 점수판 0x41c18 은 `widgets/line-score` — 이닝별 칸 st[0x6c..] 은 틱 꼴이 싣는다(`MissionAutoRelayStep.inningRuns`), 깜빡임의
 *   틱은 이 상태에 들어와 돈 틱 [장면+0x2c](`useSceneTick`). 중계 칸이 이닝별 칸을 안 들면(목록 꼴) 점수판을 안 그린다.
 *
 * ⚠️ 미이식(그림): 배경(운동장 전경)은 안 그린다.
 */
export function AutoPlayRelayScreen({ step, onTick, sideTeams, humanSide, missionBatterName }: AutoPlayRelayScreenProps) {
  // 틱 n(1부터)은 n 번째 0x48480 갱신 — 굴림은 부르는 쪽이 그 틱에 한다
  const tick = useSceneTick(() => onTick())
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  if (step === null) return <RawScreen>{null}</RawScreen>

  const offenseTeam = sideTeams[step.offenseSide]
  const label = step.offenseSide === humanSide ? OFFENSE_LABEL.player : OFFENSE_LABEL.computer
  const teamFrame = TEAM_NAME_BASE_FRAME + offenseTeam
  const teamFrameWidth = textOrigins?.[String(teamFrame).padStart(3, '0')]?.width ?? 0
  const cards = step.cards
  return (
    <RawScreen>
      {/* 점수판 0x41c18(경기, 14, 10) — 이닝별 점수 줄 */}
      {step.inningRuns !== undefined && (
        <LineScoreBoard
          {...LINE_SCORE_AT.autoRelay}
          inning={step.inning}
          offenseSide={step.offenseSide}
          inningRuns={step.inningRuns}
          totals={step.scores}
          isGameOver={cards?.gameOver ?? false}
          tick={tick}
          sideTeams={sideTeams}
        />
      )}
      {cards !== undefined && (
        <HalfInningCards
          at={RELAY_CARDS_AT}
          isGameOver={cards.gameOver}
          data={{
            battingSide: step.offenseSide,
            count: { strikes: cards.strikes, balls: cards.balls, outs: cards.outs },
            pitcherName: cards.pitcherName,
            currentOrder: cards.currentOrder,
            dueUpNames: cards.dueUpNames.map((name, row) =>
              cards.dueUpIsMissionBatter?.[row] === true ? missionBatterName ?? null : name),
          }}
        />
      )}
      <div
        className={styles.offenseBand}
        style={{ left: OFFENSE_BAND.x, top: OFFENSE_BAND.y, width: OFFENSE_BAND.width, height: OFFENSE_BAND.height }}
      />
      <div className={styles.offenseText} style={{ left: OFFENSE_TEXT_AT.x, top: OFFENSE_TEXT_AT.y }}
        data-testid="중계-공격팀" data-team={offenseTeam}>
        공격팀({label})
      </div>
      <FrameSprite folder={IMG_TEXT_FRAMES} frame={teamFrame} origins={textOrigins}
        x={OFFENSE_TEAM_RIGHT - teamFrameWidth} y={OFFENSE_TEXT_AT.y} />
      {step.line !== null && (
        <>
          {roundPlateRectsOf(RELAY_BOX).map((rect, part) => (
            <span key={part} className={styles.relayPlate}
              style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} />
          ))}
          <div className={styles.relayLine} style={{ left: RELAY_BOX.x, top: RELAY_BOX.y + 4, width: RELAY_BOX.width }}
            data-testid="중계-글">
            {step.line}
          </div>
        </>
      )}
    </RawScreen>
  )
}
