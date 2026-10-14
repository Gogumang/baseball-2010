// 임시 화면 확인용 (커밋하지 않는다)
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import { PitchingScreen } from '@/pages/pitching/ui/PitchingScreen'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_MISSIONS } from '@/entities/mission/model/missionGoal'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { DEFAULT_SETTINGS } from '@/entities/settings/model/gameSettings'

const mode = new URLSearchParams(location.search).get('m') ?? 'p'
const stamina = Number(new URLSearchParams(location.search).get('st') ?? FULL_STAMINA)
const gauge = new URLSearchParams(location.search).get('g') === '1'
const root = createRoot(document.getElementById('root')!)
if (mode === 'p') {
  root.render(
    <PitcherGameScreen
      options={{
        ourTeamId: 0, opponentTeamId: 1, playerSide: PLAYER_SIDE_LAST_BAT, role: PITCHER_ROLE.starter, positionCode: 0,
        dayCounter: 2, isPostseason: false, stats: { control: 500, velocity: 500, breaking: 500, stamina: 400 },
        staminaAbility: 400, stamina, repertoire: { pitchMask: 0b101_0111, form: 0, magicNumber: 1 }, magicCount: 4,
        teamMorale: 80, reputation: 500, gaugeSettingOn: gauge,
      }}
      random={createSeededRandom(20100901)}
      onFinish={() => {}}
      onQuit={() => {}}
      settings={DEFAULT_SETTINGS}
      onSettingsChange={() => {}}
      pitcherName="나리"
    />,
  )
} else {
  const mission = PITCHER_MISSIONS[Number(new URLSearchParams(location.search).get('i') ?? 0)]!
  root.render(
    <PitchingScreen
      run={startPitcherMission(mission)}
      repertoire={[PITCH_TYPES[0]!, PITCH_TYPES[1]!, PITCH_TYPES[2]!]}
      usesGauge={gauge}
      atBat={createAtBat()}
      bannerText=""
      onThrow={() => {}}
      onGiveUp={() => {}}
      onFinish={() => {}}
      settings={DEFAULT_SETTINGS}
      onSettingsChange={() => {}}
      stage={{ lastThrow: null, pitcherForm: 0, pitcherHand: 0, batterForm: 1, batterSkinIndex: 0, batterTeamIndex: 1 }}
      skyRow={0}
    />,
  )
}
