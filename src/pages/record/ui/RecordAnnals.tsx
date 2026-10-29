import { RawScreen, CommonPanel } from '@/shared/ui'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { PANEL } from '@/pages/record/lib/recordAnnalsLayout'
import { NICKNAME_PAGE_TOTALS, PANEL_FULL_HEIGHT, panelTopOf } from '@/pages/record/lib/annalsGrid'
import * as styles from '@/pages/record/ui/RecordAnnals.css'
import { SCREEN } from '@/pages/record/ui/recordAnnals/annalsAssets'
import type { RecordAnnalsProps } from '@/pages/record/ui/recordAnnals/recordAnnalsProps'
import { useRecordAnnals } from '@/pages/record/ui/recordAnnals/useRecordAnnals'
import { AnnalsTabBar } from '@/pages/record/ui/recordAnnals/AnnalsTabBar'
import { AnnalsPager } from '@/pages/record/ui/recordAnnals/AnnalsPager'
import { ProgressTabBody } from '@/pages/record/ui/recordAnnals/ProgressTabBody'
import { SkillTabBody } from '@/pages/record/ui/recordAnnals/SkillTabBody'
import { ListTabBody } from '@/pages/record/ui/recordAnnals/ListTabBody'
import { NameRows } from '@/pages/record/ui/recordAnnals/NameRows'
import { TotalRow } from '@/pages/record/ui/recordAnnals/TotalRow'
import { ownedNicknameCountOf } from '@/pages/record/ui/recordAnnals/nicknameOwnership'

/** 판 안 그림 자르기 — 높이 ≤ 211 동안은 (24, 160 − h/2 + 5, 192, h − 10) 로 잘린다 (0x2e42e~0x2e452) */
function contentClipOf(panelHeight: number) {
  if (panelHeight >= PANEL_FULL_HEIGHT) return undefined
  return {
    clipPath:
      `inset(${panelTopOf(panelHeight) + 5}px ${SCREEN.width - PANEL.x - PANEL.width}px ` +
      `${SCREEN.height - (panelTopOf(panelHeight) + panelHeight - 5)}px ${PANEL.x}px)`,
  }
}

const isListTab = (tab: number) => tab === 0 || tab === 4

/**
 * 기록연감 (메인 메뉴 상태 30, 그리기 0x2e29c — P6 2c 확정).
 *
 * 탭 다섯(기록·진행·스킬·닉네임·통계)이 192×212 판 위에 놓인다.
 *   진행(엔딩)·스킬은 **41×25 칸 격자 4열**, 닉네임은 **164×18 줄 8개**다.
 *
 * 탭 이름·커서의 x 는 탭 막대 프레임의 **박스**가 정한다(0x94a65) — slt_frame 프레임 4~8 의
 * 박스 0 `(2/31/60/89/118, 2, 72, 17)` 을 읽어 확정했다(S12 1절). 간격은 29 다.
 * 원본은 **고른 탭의 이름 하나만** img_text 로 그리고, 안 고른 탭은 막대 그림 안의 아이콘이다.
 *
 * 탭 0 기록 셀 0~39 는 **달성 횟수**(`[mgr+0xc8]+4+n`, 0x22df0 — 경기 끝 0x22e10 이 올린다)를 노랑 오른쪽 맞춤으로
 * 찍고(`RecordCounts`), 셀 40~47(스페셜기록 쪽)은 달성 표시 `+0x106+k` 가 서 있으면 slt_frame 71 을 그린다(`AchievementMarks`).
 * 탭 4 통계는 칸 번호(쪽 × 8 + 줄)마다 이름·값이 정해진 `lib/statCells.ts` 대로 그린다. 값은 웹이 쌓는
 * GP 아이템 구매 수·사용처별 소모 GP 만 있고, 플레이 시간·우승 횟수·획득 GP 는 비운다.
 * 아이템·GP 쪽(2~7)은 숫자 키로 **"1212123"** 을 쳐야 열린다 (`typeSecretDigit`, 0x2b7a0).
 *   센 수·열림 표시는 메인 메뉴 객체에 있어(만들 때 0x234d4 만 지운다) 들어올 때(0x2407c) 버퍼만 비운다 — `secretCode` prop.
 *
 * 키 처리는 원본 갱신 0x2b7a0 그대로다(`lib/annalsGrid.ts`): 들어오면 **탭 막대에 초점**이 있어 ←→ 가 탭을 바꾸고,
 * OK·↓ 로 본문에 들어가 ←→ 는 쪽(진행·스킬은 같은 줄 안 커서 감기), ↑↓ 는 커서 — 진행·스킬은 보이는 3줄 창이
 * 커서를 따라 한 줄씩 움직인다. 취소는 본문 → 탭 막대 → 닫기. 탭 아이콘·칸 누르기는 웹 덧붙임이다.
 */
export function RecordAnnals(props: RecordAnnalsProps) {
  const { collection, gamePoint = 0, underlay } = props
  const state = useRecordAnnals(props)
  const { tab, page, panelHeight, frames, textFrames } = state
  return (
    <RawScreen>
      {underlay}
      {/* 판 (24, 160 − h/2, 192, h) — 들어올 때 32 에서 그림마다 커진다 (0x2fb94).
          0x55e60(skin, W/2, H/2, 192, h, 0, 정렬 0x22, 위 띠 0x10, 0, 0, 0) (0x2e40a~0x2e42a) */}
      <CommonPanel x={PANEL.x} y={panelTopOf(panelHeight)} width={PANEL.width} height={panelHeight} topBand={0x10} />
      <div className={styles.content} style={contentClipOf(panelHeight)}>
        <AnnalsTabBar state={state} />
        <AnnalsPager tab={tab} page={page} isPanelOpen={state.isPanelOpen} />
        {tab === 1 && <ProgressTabBody state={state} collection={collection} />}
        {tab === 2 && <SkillTabBody state={state} collection={collection} />}
        {tab === 3 && <NameRows frames={frames} textFrames={textFrames} page={page} scroll={state.nicknameScroll} owned={collection.titles} />}
        {isListTab(tab) && <ListTabBody state={state} collection={collection} />}
        {/* 합계 줄(프레임 15 · 이미지 0x26 · img_text 0x10d)은 탭 3(0x2f834~0x2f8ca) · 탭 4(0x2fa60~0x2faf6)에만 있다 —
          탭 2 그리기(0x2efa4~0x2f4ec)는 이 셋을 안 그리고, 함께 쓰는 0x2fb8e 호출은 합계가 아니라 스킬 설명이다.
          탭 3 은 쪽(갈래)마다 얻은 수 [skin+0x124] / 칸 수 — "!C!cffff00%d/%d" (0x2f8ee~0x2f8fa) */}
        {tab === 3 && (
          <TotalRow
            frames={frames}
            textFrames={textFrames}
            value={`${ownedNicknameCountOf(page, collection.titles)}/${NICKNAME_PAGE_TOTALS[page] ?? 0}`}
          />
        )}
      </div>

      {/* 머리띠·바닥 — 그리기 꼬리 0x2fc1e `0x54d95(skin, 0, 5)` (판 자르기를 푼 뒤라 안 잘린다).
          들어옴 0x2407c 가 [skin+0x84] = 0 이라(위 stopSkinFrameSlide) 미끄러지지 않는다. 되돌아가기는 CLR 과 같은 일 */}
      <ScreenFrame title="2010프로야구" gamePoint={gamePoint} footer={5} slides={false} onBack={() => state.isPanelOpen && state.pressClear()} />
    </RawScreen>
  )
}
