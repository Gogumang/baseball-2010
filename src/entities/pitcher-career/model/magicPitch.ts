/**
 * 마구 (binary.mod 0xb6d2c 구질 칸 · 0x50da8 사람 고르기 · 0x344dc CPU 고르기 · 0x3de10 공에 싣기 ·
 * 0x9e944 pitch.zt1 레코드 고르기 · 0x34d6c 타격 보정 · 0xaebe4 한 경기 횟수 — H2 1-2·2·3절).
 *
 * **마구는 구질 22 하나다.** 파이어·웨이브·썬더·샤이닝·캐넌·미라지 볼은 구질 번호가 따로 없고
 * 투수 레코드 **+0x18 (1~4)** 로만 갈린다. 마투수는 +0x18 = 5~9 다.
 * 육성 투수가 볼 수 있는 이름이 **여섯 가지**인 까닭은, 번호 4 가 **폼/2** 에 따라
 * 샤이닝(폼 0·1) · 캐넌(2·3) · 미라지(4·5) 로 이름과 궤적 레코드만 갈리기 때문이다 —
 * 효과와 횟수는 셋 다 같은 "번호 4" 다.
 *
 * 공개 이름 모음 — 하위 폴더 (`magicPitch/`): `names`(구질 22 · 이름 StrCOMMON · 레코드 0x9e944 · 더비 0x344ea · 성질) ·
 * `strength`(한 경기 횟수 0xd84ff · 0xd8509 · 타격 보정 0x34d6c) · `speed`(표시 구속 0xcfda8 · 0x34a24) ·
 * `ballKind`(공 그림 경기+0x1080 · 공+0x10 B-01)
 */
export {
  ACE_MAGIC_PITCH_NAMES,
  canSelectMagicPitch,
  derbyPitchTypeOf,
  MAGIC_PITCH_NAMES,
  MAGIC_PITCH_SLOT,
  MAGIC_PITCH_TRAITS,
  MAGIC_PITCH_TYPE_NUMBER,
  magicPitchNameOf,
  magicPitchRecordIndexOf,
} from '@/entities/pitcher-career/model/magicPitch/names'
export {
  magicPitchCorrectionOf,
  magicPitchCountOf,
  NO_MAGIC_PITCH_CORRECTION,
  SPIRIT_SKILL_BONUS,
} from '@/entities/pitcher-career/model/magicPitch/strength'
export { MAGIC_SPEED_RANGES, magicPitchDisplaySpeedOf, magicSpeedRowOf } from '@/entities/pitcher-career/model/magicPitch/speed'
export {
  ballMagicNumberAfterPitch,
  ballMagicNumberOfPitch,
  FIRE_BALL_FIRST_PATH_INDEX,
  MAGIC_BALL_KIND_BY_NUMBER,
  magicBallKindAtPath,
  magicBallKindOf,
} from '@/entities/pitcher-career/model/magicPitch/ballKind'
