import { useTouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import type { TouchKeyOffer } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { CommonPanel, FrameSprite } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { colorStepCoverOpacityOf } from '@/shared/lib/stepCover/stepCover'
import { SETTLEMENT_BAND, SETTLEMENT_LOSE_DIM_STEP, SETTLEMENT_RESULT_SPRITE, SETTLEMENT_TITLE_BAR } from '@/pages/team-game/lib/settlementBoard'
import { MISSION_RESULT_TITLE, MISSION_RESULT_WINDOW } from '@/pages/mission-play/lib/missionResultBoard'
import * as styles from '@/pages/mission-play/ui/MissionResultBoard.css'
import { SettlementEffectCanvas } from '@/widgets/batting-stage/ui/SettlementEffectCanvas'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { MissionResultBoardProps } from '@/pages/mission-play/ui/missionResultBoard/missionResultBoardProps'
import { useMissionResultAnswer } from '@/pages/mission-play/ui/missionResultBoard/useMissionResultAnswer'
import { MissionPointBox } from '@/pages/mission-play/ui/missionResultBoard/MissionPointBox'
import { MissionRetryBox } from '@/pages/mission-play/ui/missionResultBoard/MissionRetryBox'

export type { MissionResultBoardProps } from '@/pages/mission-play/ui/missionResultBoard/missionResultBoardProps'

const GAME_UI = assetUrl('./sprites/game_ui')
const GAME_UI_FRAMES = assetUrl('./sprites/game_ui/frames')
const RESULT_FRAMES = assetUrl('./sprites/result/frames')
const IMG_TEXT_FRAMES = assetUrl('./sprites/img_text/frames')
const POPUP_FRAMES = assetUrl('./sprites/popup/frames')
const imageSrc = (folder: string, image: number) => `${folder}/${String(image).padStart(3, '0')}.png`

/** 마선수 대결 끝 — CLR(Escape) */
const ACE_DUEL_END_OFFER: TouchKeyOffer = { key: 'Escape', label: '대결 끝' }

/**
 * **미션 결과 판** (경기 상태 0x19 그리기 0x4a384 의 모드 5·6 갈래 · 키 0x407f0) — 좌표·흐름은 `lib/missionResultBoard` 머리말.
 * 앞부분(실패 덮개 · 띠 · game_ui 프레임 8 · YOU WIN/LOSE)은 팀경기 정산 판과 같은 그림이라 그 자리 값을 쓴다.
 * 배경(0x4a384 첫머리의 구름 0x78448 · 0x40ff0(장면, +0x17e2))은 밑에 깔린 타석 캔버스가 결과 배경으로 그린다 — 판은 그 위
 * 240×320 에 겹친다.
 */
export function MissionResultBoard({ isSuccess, aceMatch, earnedGamePoint, heldGamePoint, onExit, effectLayers }: MissionResultBoardProps) {
  const gameUiOrigins = useFrameOrigins(GAME_UI_FRAMES)
  const resultOrigins = useFrameOrigins(RESULT_FRAMES)
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const popupOrigins = useFrameOrigins(POPUP_FRAMES)
  const flags = { flag11f: aceMatch?.flag11f ?? false, flag176: aceMatch?.flag176 ?? false }
  const isAce = flags.flag11f || flags.flag176
  // 마선수 대결에서 깃발이 하나만 서면 OK(판 전체 칸 — 다시)와 CLR(대결 끝)이 갈린다. 판에 CLR 글자 자리가 없어 '대결 끝' 상황 버튼으로
  // 낸다(r186 — 늘 있던 뒤로 버튼을 걷었다). Escape 키 사건이라 아래 듣는 곳과 같은 길이다
  useTouchKeyOffer(isAce && !(flags.flag11f && flags.flag176) ? ACE_DUEL_END_OFFER : null)
  const [answer, act] = useMissionResultAnswer(flags, onExit)

  return (
    <div className={styles.layer} data-testid="미션-결과-판">
      {/* 4a404 실패 — 색 덮기 검정 단계 8 */}
      {!isSuccess && <div className={styles.fill} style={{ background: '#000000', opacity: colorStepCoverOpacityOf(SETTLEMENT_LOSE_DIM_STEP) }} />}
      {/* 4a452 효과 틱 0x901a0 — 정산 비(종류 0)를 덮개 위 · 띠 아래에 그린다 */}
      {effectLayers !== undefined && <SettlementEffectCanvas canvasRef={effectLayers.rain} />}
      {/* 4a448 — 띠 · game_ui 프레임 8 · result 0 "YOU WIN" / 1 "YOU LOSE" */}
      <div
        className={styles.block}
        style={{
          left: SETTLEMENT_BAND.x,
          top: SETTLEMENT_BAND.y,
          width: SETTLEMENT_BAND.width,
          height: SETTLEMENT_BAND.height,
          background: SETTLEMENT_BAND.color,
        }}
      />
      <FrameSprite
        folder={GAME_UI_FRAMES}
        frame={SETTLEMENT_TITLE_BAR.frame}
        origins={gameUiOrigins}
        x={SETTLEMENT_TITLE_BAR.centerX - (SETTLEMENT_TITLE_BAR.width >> 1)}
        y={SETTLEMENT_TITLE_BAR.y}
      />
      <span data-testid="미션-결과-그림" data-frame={isSuccess ? SETTLEMENT_RESULT_SPRITE.winFrame : SETTLEMENT_RESULT_SPRITE.loseFrame}>
        <FrameSprite
          folder={RESULT_FRAMES}
          frame={isSuccess ? SETTLEMENT_RESULT_SPRITE.winFrame : SETTLEMENT_RESULT_SPRITE.loseFrame}
          origins={resultOrigins}
          x={SETTLEMENT_RESULT_SPRITE.x}
          y={SETTLEMENT_RESULT_SPRITE.y}
        />
      </span>

      {/* 4a576 마선수 대결(g[0x11f] · g[0x176])은 여기서 끝 */}
      {!isAce && (
        <>
          {/* 4a5f4 공용 판 0x55e61(skin, W/2, H/2, 176, 152, 0, 0x22, 위 띠 0x10, 0, 0, 0) */}
          <CommonPanel
            x={MISSION_RESULT_WINDOW.x}
            y={MISSION_RESULT_WINDOW.y}
            width={MISSION_RESULT_WINDOW.width}
            height={MISSION_RESULT_WINDOW.height}
            topBand={0x10}
            testId="미션-결과-창"
          />
          <img
            className={styles.sprite}
            alt="RESULT"
            src={imageSrc(GAME_UI, MISSION_RESULT_TITLE.image)}
            style={{ left: MISSION_RESULT_TITLE.x, top: MISSION_RESULT_TITLE.y }}
          />

          <MissionPointBox earnedGamePoint={earnedGamePoint} heldGamePoint={heldGamePoint} textOrigins={textOrigins} />
          <MissionRetryBox answer={answer} popupOrigins={popupOrigins} onPick={(picked) => act('확인', picked)} />
        </>
      )}
      {isAce && (
        // 원본에 없는 웹 단추 — OK 와 같다
        <button
          type="button"
          className={styles.hitArea}
          aria-label="확인"
          style={{ left: 0, top: 0, width: 240, height: 320 }}
          onClick={() => act('확인', answer)}
        />
      )}
      {/* 프레임 끝 0x6dd69 — 파티클(밤 성공 불꽃)은 판까지 다 그린 뒤 맨 위 (누르기는 밑의 단추로 흘린다) */}
      {effectLayers !== undefined && <SettlementEffectCanvas canvasRef={effectLayers.particles} />}
    </div>
  )
}
