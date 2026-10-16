/**
 * 장면별로 미리 받을 스프라이트 — 폴더와 프레임 번호.
 *
 * **측정에서 뽑은 목록이다** (r109): 빌드를 띄워 팀선택→경기·경기 6분·홈런더비를 돌리며 장면마다 실제로 요청된
 * PNG·JSON 을 모았다(첫 팀·첫 타자 기준). 목록에 없는 그림은 예전처럼 부르는 순간 받는다(늦은 로딩) —
 * 목록이 모자라도 틀린 그림이 나오지는 않고, 늦게 뜰 뿐이다.
 *
 * `json` 은 같은 폴더의 JSON(합성 프레임 원점 origins·애니 표 animations·팔레트 palette)이다.
 * `…/frames/index` 는 팔레트 갈아 끼우기가 쓰는 번호 지도 PNG 다.
 *
 * **선수 그림은 여기 없다** (r111): 타자(몸통 폼 · 장비 · 마타자) · 투수(마투수 · 장비) · 루 주자 · 수비수는 그리기 코드에서
 * 계산한다 — `widgets/batting-stage/lib/stageSpritePreload` · `pages/defense/lib/defenseSpritePreload`, 연결은
 * `app/model/gameSpritePreload`. 아래 측정 목록에 남은 batter_* · pitcher · defender 칸은 첫 팀 · 첫 타자 몫이라 그쪽과 겹쳐도 된다
 * (같은 주소는 한 번만 받는다).
 *
 * r111 에 나리(나만의리그) 타자편 · 투수편 · 미션 흐름을 지연 80ms 로 돌려 `nariMenu`(관리 · 순위 · 경기 준비) ·
 * `afterGame`(경기 끝 판 · 결과 · 이벤트)을 더했다. 로딩 판 그림(loadingbar)은 어느 경기에나 먼저 뜨므로 `common` 에 넣었다.
 */
import type { SpriteFolderPreload } from '@/shared/lib/sprite/spritePreload'

export type SpriteSceneKey =
  | 'common'
  | 'teamSelect'
  | 'gameEntry'
  | 'gameAtBat'
  | 'gamePlay'
  | 'homeRunDerbySelect'
  | 'homeRunDerby'
  | 'nariMenu'
  | 'afterGame'
  | 'missionSelect'

export const SPRITE_PRELOAD_SCENES: Readonly<Record<SpriteSceneKey, readonly SpriteFolderPreload[]>> = {
  /** 앱 첫 진입 유휴 시간 — 어느 화면에서나 자주 쓰는 숫자(num)·글자(img_text)·공용 창(popup·game_frame·game_ui) — PNG 171장 */
  common: [
    { folder: './sprites/game_frame', frames: [4, 5, 8, 12, 13] },
    { folder: './sprites/game_frame/frames', frames: [6, 9], json: ['origins.json'] },
    { folder: './sprites/game_ui', frames: [6, 13, 14, 15, 21, 22, 30, 75, 79, 81, 97] },
    {
      folder: './sprites/game_ui/frames',
      frames: [
        0, 1, 2, 4, 5, 7, 8, 9, 10, 16, 20, 21, 22, 36, 37, 40, 46, 47, 48, 49,
        50, 51, 52, 53, 54, 55, 58, 59, 61, 70, 77, 90, 91,
      ],
      json: ['animations.json', 'origins.json'],
    },
    {
      folder: './sprites/img_text/frames',
      frames: [
        6, 9, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 54, 55,
        56, 57, 65, 157, 158, 159, 173, 174, 175, 176, 177, 178, 179, 180, 181, 183, 184, 185, 190, 191,
        192, 204, 205, 243, 244, 247, 248, 249, 252, 253, 255, 256, 257, 260, 316, 317, 318, 319, 357, 361,
        399, 400, 401, 403, 404, 405, 406,
      ],
      json: ['origins.json'],
    },
    {
      folder: './sprites/num',
      frames: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
        31, 32, 33, 34, 35, 36, 37, 38, 39, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 80,
        81, 83, 84, 85, 86, 88, 89, 101,
      ],
    },
    { folder: './sprites/popup/frames', frames: [2, 4, 5, 6, 8], json: ['origins.json'] },
    /** 경기 · 미션 · 더비 로딩 판 — 판(0)과 달리는 선수(애니 0 = 1~4). 판이 떠 있는 동안에는 칸이 받기보다 빨리 넘어가 늦으면 판 내내 빈다 */
    { folder: './sprites/loadingbar/frames', frames: [0, 1, 2, 3, 4], json: ['animations.json', 'origins.json'] },
  ],
  /** 팀선택 화면(메인메뉴에서 유휴로) — slt_frame·team_logo — PNG 39장 */
  teamSelect: [
    { folder: './sprites/game_frame', frames: [5] },
    { folder: './sprites/img_text/frames', frames: [6, 9, 45, 46, 157, 159, 204, 205], json: ['origins.json'] },
    { folder: './sprites/main_ui/frames', frames: [7], json: ['origins.json'] },
    { folder: './sprites/num', frames: [20, 21, 22, 23, 24, 25, 26, 28, 29] },
    { folder: './sprites/popup/frames', frames: [4, 5, 8], json: ['origins.json'] },
    { folder: './sprites/slt_frame', frames: [0, 1, 3, 9, 17, 116, 117] },
    { folder: './sprites/team_logo', frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  ],
  /** 경기 장면 진입 — 구장·하늘·관중·타자/투수 대기 자세·전광판 (팀선택·로딩 판에서) — PNG 149장 */
  gameEntry: [
    { folder: './sprites/ace_icon', frames: [0, 5, 10] },
    { folder: './sprites/attack', frames: [0] },
    { folder: './sprites/attack_sky_cloud/frames', frames: [0, 1, 2], json: ['origins.json'] },
    { folder: './sprites/batter_balancer', frames: [], json: ['palette.json'] },
    { folder: './sprites/batter_balancer/frames', frames: [0, 1, 2, 3, 14, 15, 16, 17], json: ['origins.json'] },
    { folder: './sprites/batter_balancer/frames/index', frames: [0, 1, 2, 3, 14, 15, 16, 17] },
    { folder: './sprites/batter_batter/frames', frames: [0, 1, 2, 3], json: ['origins.json'] },
    { folder: './sprites/batter_helmet', frames: [], json: ['palette.json'] },
    { folder: './sprites/batter_helmet/frames', frames: [0, 1, 2, 3], json: ['origins.json'] },
    { folder: './sprites/batter_helmet/frames/index', frames: [0, 1, 2, 3] },
    { folder: './sprites/batter_medica', frames: [24] },
    { folder: './sprites/batter_shadow/frames', frames: [0, 1, 2, 3], json: ['origins.json'] },
    { folder: './sprites/board_ani/frames', frames: [0], json: ['origins.json'] },
    { folder: './sprites/fence/frames', frames: [0], json: ['origins.json'] },
    { folder: './sprites/game_frame', frames: [4, 8, 12] },
    { folder: './sprites/game_frame/frames', frames: [6, 9], json: ['origins.json'] },
    { folder: './sprites/game_ui', frames: [13, 14, 15] },
    { folder: './sprites/game_ui/frames', frames: [0, 1, 2, 4, 8, 16, 21, 22, 90, 91], json: ['origins.json'] },
    {
      folder: './sprites/img_text/frames',
      frames: [
        37, 38, 39, 40, 41, 42, 43, 44, 47, 48, 49, 50, 51, 52, 55, 56, 65, 157, 158, 159,
        177, 180, 185, 190, 191, 192, 316, 317, 318, 319, 357, 399, 400, 401, 403, 404, 405, 406,
      ],
      json: ['origins.json'],
    },
    { folder: './sprites/num', frames: [1, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31] },
    { folder: './sprites/pitcher/frames', frames: [0, 22], json: ['origins.json'] },
    { folder: './sprites/pitcher_psyker', frames: [12] },
    { folder: './sprites/popup/frames', frames: [2, 6], json: ['origins.json'] },
    { folder: './sprites/ppl/frames', frames: [0], json: ['origins.json'] },
    { folder: './sprites/sky_effect_light/frames', frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], json: ['animations.json', 'origins.json'] },
    /** 하늘 조명의 시간대 팔레트 (구름 palette.json 은 gamePlay 에 있다) */
    { folder: './sprites/sky_effect_light', frames: [], json: ['palette.json'] },
    { folder: './sprites/slt_frame', frames: [0, 1, 3, 6, 7, 8, 9, 10, 17, 18, 19, 20, 40, 116, 117, 122] },
    { folder: './sprites/slt_frame/frames', frames: [0, 15], json: ['origins.json'] },
    { folder: './sprites/stadium_symbol', frames: [0] },
    { folder: './sprites/team_logo', frames: [0] },
    { folder: './sprites/team_logo_ini', frames: [0] },
    { folder: './sprites/team_s_icon', frames: [0] },
    /**
     * r111 측정 — 로딩 판 · 인트로 뒤 첫 판(0x18 DUE UP · 점수판 틀): 큰 숫자 51~59 · 판 틀 · 두 팀 머리글자 로고.
     * 경기마다 팀이 달라 머리글자 로고는 15팀 모두
     */
    { folder: './sprites/game_ui', frames: [0, 33, 34] },
    { folder: './sprites/game_ui/frames', frames: [17, 31, 32], json: ['origins.json'] },
    { folder: './sprites/img_text/frames', frames: [186, 187], json: ['origins.json'] },
    { folder: './sprites/num', frames: [51, 52, 53, 54, 55, 56, 57, 58, 59] },
    { folder: './sprites/team_logo_ini', frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  ],
  /** 타석 진행 — 공·스윙·투구·판정 글자 (로딩 판에서 gameEntry 다음) — PNG 128장 */
  gameAtBat: [
    { folder: './sprites/ball/frames', frames: [2, 3, 4, 5, 6, 7, 8, 9], json: ['origins.json'] },
    { folder: './sprites/batter_balancer/frames', frames: [6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 24, 25, 26], json: ['origins.json'] },
    { folder: './sprites/batter_balancer/frames/index', frames: [6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 24, 25, 26] },
    { folder: './sprites/batter_batter/frames', frames: [6, 7, 8, 9, 10, 11, 12], json: ['origins.json'] },
    { folder: './sprites/batter_ghost/frames', frames: [2, 3], json: ['origins.json'] },
    { folder: './sprites/batter_helmet/frames', frames: [6, 7, 8, 9, 10, 11, 12], json: ['origins.json'] },
    { folder: './sprites/batter_helmet/frames/index', frames: [6, 7, 8, 9, 10, 11, 12] },
    { folder: './sprites/batter_shadow/frames', frames: [6, 7, 8, 9, 10, 11, 12], json: ['origins.json'] },
    { folder: './sprites/game_judge/frames', frames: [18, 19, 20, 21, 22, 23, 24], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/game_ui/frames', frames: [1, 2, 4, 20, 58, 59, 61], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/img_text/frames', frames: [49, 55, 56, 157, 158, 178, 180, 316, 317, 318, 319], json: ['origins.json'] },
    { folder: './sprites/num', frames: [22, 23, 24, 25, 26, 27, 28, 29, 32, 61, 62, 63, 64, 67, 68, 69] },
    {
      folder: './sprites/pitcher/frames',
      frames: [
        3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 25, 26, 27, 28, 30, 31,
      ],
      json: ['origins.json'],
    },
    { folder: './sprites/player_effect/frames', frames: [38, 39, 40, 41], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/slt_pitch/frames', frames: [73], json: ['origins.json'] },
  ],
  /** 경기 진행 — 수비수·수비 판·중계·투구 선택 (경기 장면에서 유휴로) — PNG 365장 */
  gamePlay: [
    { folder: './sprites/attack_sky_cloud', frames: [], json: ['palette.json'] },
    { folder: './sprites/ball/frames', frames: [2, 3, 4, 5, 6, 7, 8, 9, 10], json: ['origins.json'] },
    { folder: './sprites/batter_balancer/frames', frames: [6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 24, 25, 26], json: ['origins.json'] },
    { folder: './sprites/batter_balancer/frames/index', frames: [6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 24, 25, 26] },
    {
      folder: './sprites/batter_batter/frames',
      frames: [
        6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25,
      ],
      json: ['origins.json'],
    },
    { folder: './sprites/batter_ghost/frames', frames: [0, 1, 2, 3], json: ['origins.json'] },
    {
      folder: './sprites/batter_helmet/frames',
      frames: [
        6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25,
      ],
      json: ['origins.json'],
    },
    {
      folder: './sprites/batter_helmet/frames/index',
      frames: [
        6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25,
      ],
    },
    {
      folder: './sprites/batter_shadow/frames',
      frames: [
        6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25,
      ],
      json: ['origins.json'],
    },
    { folder: './sprites/batter_sluger', frames: [], json: ['palette.json'] },
    {
      folder: './sprites/batter_sluger/frames',
      frames: [
        0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 20, 21, 23, 24,
      ],
      json: ['origins.json'],
    },
    {
      folder: './sprites/batter_sluger/frames/index',
      frames: [
        0, 1, 2, 3, 4, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 20, 21, 23, 24,
      ],
    },
    { folder: './sprites/defender', frames: [], json: ['palette.json'] },
    {
      folder: './sprites/defender/frames',
      frames: [
        0, 1, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
        35,
      ],
      json: ['animations.json', 'origins.json'],
    },
    {
      folder: './sprites/defender/frames/index',
      frames: [
        0, 1, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,
        35,
      ],
    },
    { folder: './sprites/defense', frames: [0], json: ['palette.json'] },
    { folder: './sprites/game_judge/frames', frames: [6, 7, 18, 19, 20, 21, 22, 23, 24, 35, 36, 37, 38], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/game_ui', frames: [6, 21, 22, 75, 79, 81, 97] },
    {
      folder: './sprites/game_ui/frames',
      frames: [
        1, 2, 4, 5, 7, 9, 10, 20, 22, 36, 37, 46, 47, 48, 49, 50, 51, 52, 53, 54,
        55, 58, 59, 61, 70, 77,
      ],
      json: ['animations.json', 'origins.json'],
    },
    { folder: './sprites/gpoint', frames: [2, 5, 11] },
    {
      folder: './sprites/img_text/frames',
      frames: [
        49, 54, 55, 56, 57, 157, 158, 173, 174, 175, 176, 177, 178, 179, 180, 181, 183, 184, 255, 316,
        317, 318, 319, 361,
      ],
      json: ['origins.json'],
    },
    {
      folder: './sprites/num',
      frames: [
        2, 3, 4, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37, 38,
        39, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
      ],
    },
    {
      folder: './sprites/pitcher/frames',
      frames: [
        3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 25, 26, 27, 28, 30, 31,
      ],
      json: ['origins.json'],
    },
    { folder: './sprites/player_effect/frames', frames: [15, 16, 17, 18, 19, 20, 38, 39, 40, 41, 50], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/sky_effect_light/frames', frames: [9, 10], json: ['origins.json'] },
    { folder: './sprites/slt_pitch', frames: [22, 24, 26, 33] },
    {
      folder: './sprites/slt_pitch/frames',
      frames: [
        0, 1, 6, 7, 8, 12, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 35, 36,
        37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 73,
      ],
      json: ['animations.json', 'boxes.json', 'origins.json'],
    },
  ],
  /** 홈런더비 선택 화면 — PNG 60장 */
  homeRunDerbySelect: [
    { folder: './sprites/batter_balancer', frames: [], json: ['palette.json'] },
    { folder: './sprites/batter_balancer/frames', frames: [0, 1, 2, 3, 4, 14, 15, 16, 17, 18], json: ['origins.json'] },
    { folder: './sprites/batter_balancer/frames/index', frames: [0, 1, 2, 3, 4, 14, 15, 16, 17, 18] },
    { folder: './sprites/batter_batter/frames', frames: [0, 1, 2, 3, 4], json: ['origins.json'] },
    { folder: './sprites/batter_helmet', frames: [], json: ['palette.json'] },
    { folder: './sprites/batter_helmet/frames', frames: [0, 1, 2, 3, 4], json: ['origins.json'] },
    { folder: './sprites/batter_helmet/frames/index', frames: [0, 1, 2, 3, 4] },
    { folder: './sprites/game_frame', frames: [13] },
    { folder: './sprites/img_text/frames', frames: [41, 42, 43, 44, 159], json: ['origins.json'] },
    { folder: './sprites/num', frames: [20, 21, 23, 24, 26, 28, 29] },
    { folder: './sprites/slt_frame', frames: [0, 1, 3, 9, 17, 22, 24, 28, 31, 115, 117] },
    { folder: './sprites/team_logo', frames: [0] },
  ],
  /** 홈런더비 로딩→타석·진행 — PNG 201장 */
  homeRunDerby: [
    { folder: './sprites/attack', frames: [0] },
    { folder: './sprites/attack_sky_cloud', frames: [], json: ['palette.json'] },
    { folder: './sprites/attack_sky_cloud/frames', frames: [0, 1, 2], json: ['origins.json'] },
    { folder: './sprites/ball/frames', frames: [2, 3, 4, 5, 6, 7, 8, 9], json: ['origins.json'] },
    { folder: './sprites/batter_balancer', frames: [], json: ['palette.json'] },
    {
      folder: './sprites/batter_balancer/frames',
      frames: [
        0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 20, 21, 22, 24, 25,
        26,
      ],
      json: ['origins.json'],
    },
    { folder: './sprites/batter_balancer/frames/index', frames: [6, 7, 8, 9, 10, 11, 12, 20, 21, 22, 24, 25, 26] },
    { folder: './sprites/batter_batter/frames', frames: [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12], json: ['origins.json'] },
    { folder: './sprites/batter_ghost/frames', frames: [2, 3], json: ['origins.json'] },
    { folder: './sprites/batter_helmet', frames: [], json: ['palette.json'] },
    { folder: './sprites/batter_helmet/frames', frames: [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12], json: ['origins.json'] },
    { folder: './sprites/batter_helmet/frames/index', frames: [6, 7, 8, 9, 10, 11, 12] },
    { folder: './sprites/batter_shadow/frames', frames: [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12], json: ['origins.json'] },
    { folder: './sprites/board_ani/frames', frames: [0], json: ['origins.json'] },
    { folder: './sprites/fence/frames', frames: [0], json: ['origins.json'] },
    { folder: './sprites/game_judge/frames', frames: [18, 19, 20, 21, 22, 23, 24], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/game_ui', frames: [30] },
    { folder: './sprites/game_ui/frames', frames: [1, 2, 4, 5, 20, 40, 90], json: ['origins.json'] },
    { folder: './sprites/gpoint', frames: [1, 9, 10, 11] },
    {
      folder: './sprites/img_text/frames',
      frames: [
        49, 55, 57, 157, 158, 176, 180, 243, 244, 247, 248, 249, 252, 253, 256, 257, 260, 316, 317, 318,
        319,
      ],
      json: ['origins.json'],
    },
    { folder: './sprites/loadingbar/frames', frames: [0, 1, 2, 3, 4], json: ['animations.json', 'origins.json'] },
    {
      folder: './sprites/num',
      frames: [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21, 23, 25, 26, 27, 28, 29, 38, 61,
        64, 65, 66, 67, 68, 80, 81, 83, 84, 85, 86, 88, 89, 101,
      ],
    },
    {
      folder: './sprites/pitcher/frames',
      frames: [
        0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 22, 25, 26, 27, 28, 30, 31,
      ],
      json: ['origins.json'],
    },
    { folder: './sprites/player_effect/frames', frames: [38, 39, 40, 41], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/popup/frames', frames: [2, 6], json: ['origins.json'] },
    { folder: './sprites/ppl/frames', frames: [0], json: ['origins.json'] },
    { folder: './sprites/slt_pitch/frames', frames: [73], json: ['origins.json'] },
    { folder: './sprites/team_s_icon', frames: [11] },
    { folder: './sprites/trainning/frames', frames: [0, 2, 11], json: ['origins.json'] },
  ],
  /**
   * 나리 관리 화면 · 다음경기 순위 · 경기 준비 (타자편 · 투수편 공통) — r111 측정. 메인메뉴에서 유휴로, 관리 화면에서 바로.
   * 관리 명령 칸(icon_selected · command_label 0~5 칸 = 선수정보~다음경기)과 순위표 글자 · 숫자.
   */
  nariMenu: [
    { folder: './sprites/event_char_0', frames: [], json: ['palette.json'] },
    { folder: './sprites/event_char_0/frames', frames: [31, 32, 33], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/game_frame', frames: [9, 10] },
    { folder: './sprites/gpoint/frames', frames: [0, 1, 2, 3, 4, 5], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/img_text/frames', frames: [66, 67, 68, 69, 70, 71, 72, 73, 74, 84, 302, 327, 331, 332], json: ['origins.json'] },
    {
      folder: './sprites/management',
      frames: [],
      names: [
        'command_label_89', 'command_label_90', 'command_label_91', 'command_label_92', 'command_label_93', 'command_label_94',
        'icon_selected_0', 'icon_selected_1', 'icon_selected_2', 'icon_selected_3', 'icon_selected_4', 'icon_selected_5',
        'label_navy_136', 'label_navy_215', 'label_navy_216', 'label_navy_234', 'label_navy_235', 'label_yellow_334', 'label_yellow_335',
      ],
    },
    { folder: './sprites/mode_back', frames: [], json: ['palette.json'] },
    /** 관리 화면 바탕 — 시간대(0~2)마다 칸이 다르다 */
    { folder: './sprites/mode_back/frames', frames: [0, 1, 2], json: ['origins.json'] },
    { folder: './sprites/mode_back/frames/index', frames: [0, 1, 2] },
    { folder: './sprites/mode_icon', frames: [0, 1, 2, 3, 4, 5] },
    { folder: './sprites/mode_ui/frames', frames: [11, 14, 19], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/num', frames: [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 106, 127] },
    { folder: './sprites/team_s_icon', frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    /**
     * r124 측정 — 투수편 관리 첫 판: 머리띠 제목 "나만의리그투수편"(game_frame 11) · 스태미나 딱지(img_text 396) ·
     * 가운데 무대 투수 인물(event_char_0 합성 4~6). 메뉴에서 곧바로 들어가면 첫 0.5초에 이 셋이 비었다
     */
    { folder: './sprites/game_frame', frames: [11] },
    { folder: './sprites/img_text/frames', frames: [396], json: ['origins.json'] },
    { folder: './sprites/event_char_0/frames', frames: [4, 5, 6], json: ['animations.json', 'origins.json'] },
  ],
  /** 경기 끝 판 · 정산 결과 · 결과 뒤 이벤트(나리) — r111 측정. 경기 장면이 서 있는 동안 유휴로 */
  afterGame: [
    { folder: './sprites/event_char_0/frames', frames: [116, 117, 118, 119], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/game_ui', frames: [12, 78] },
    { folder: './sprites/game_ui/frames', frames: [93, 94], json: ['origins.json'] },
    { folder: './sprites/gpoint', frames: [1, 3, 10] },
    { folder: './sprites/img_text/frames', frames: [58, 87, 148, 167, 329, 359, 388, 389], json: ['origins.json'] },
    { folder: './sprites/mode_ui/frames', frames: [21, 22, 23, 58, 59, 62, 84], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/num', frames: [72, 73, 103] },
    { folder: './sprites/result/frames', frames: [1], json: ['animations.json', 'origins.json'] },
    { folder: './sprites/team_logo_ini', frames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    /** 미션 첫 판(미션 목표) — 로딩 판 뒤 곧바로 뜬다 */
    { folder: './sprites/num', frames: [82, 100] },
    { folder: './sprites/trainning', frames: [8, 17] },
    { folder: './sprites/trainning/frames', frames: [12], json: ['origins.json'] },
  ],
  /** 미션 고르기 화면(메인메뉴에서 유휴로) — r111 측정. 관리 화면과 같은 칸(mode_icon · mode_ui · num)은 `nariMenu` 가 받는다 */
  missionSelect: [
    /**
     * 머리띠 제목 "미션모드" — 선수 고르기(0x54d95(skin, 11, 5, 0) 제목 11) · 미션 목록(제목 12/13) 둘 다 game_frame 18 이다.
     * r124 측정: 메뉴에 10초 머물러 이 목록을 다 받아 두어도 선수 고르기 첫 0.5초에 이것 하나가 비었다(21프레임)
     */
    { folder: './sprites/game_frame', frames: [18] },
    { folder: './sprites/img_text/frames', frames: [88, 258], json: ['origins.json'] },
    { folder: './sprites/slt_frame', frames: [21, 23, 30, 51, 113] },
    { folder: './sprites/slt_frame/frames', frames: [0, 1, 15], json: ['origins.json'] },
  ],
}
