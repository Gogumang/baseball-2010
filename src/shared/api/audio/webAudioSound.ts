/**
 * WebAudio 로 `public/sounds/%03d.mp3` 를 트는 포트 구현.
 *
 * 파일은 `tools/extract_sounds.py` 가 원본 `sound/%03d.mmf`(야마하 SMAF) 에서 구워 둔 것이다.
 * 브라우저는 SMAF 를 직접 못 읽어서 미리 굽는 길을 골랐다 (docs/re/L-sound-effects.md 1-D).
 *
 * `AudioContext` 가 없는 환경(시험 DOM·서버 렌더)에서는 **아무 소리도 내지 않고 조용히 넘어간다**.
 * 소리가 안 나는 것 때문에 게임이 멈추면 안 되므로 모든 접근을 예외 삼키기(`shared/lib/safe`)로 감쌌다.
 *
 * 효과음은 배경음을 끊고 **끝나도 배경음으로 돌아오지 않는다** — 원본 그대로다 (`SoundPort` 머리 주석:
 * 틱 0x6eb18 의 되돌리기 갈래는 0x6eb30 `[+0x4c] == 0` 으로 죽어 있고, `resumeBgm` 0x6eaf0 은 통신 화면만 부른다).
 *
 * 쪼갠 파일: `webAudioOptions`(선택 · 기본 통로/받기 · 자동화 브라우저 · 크기 자르기) · `createWebAudioSound`(포트 몸통)
 */
export { createWebAudioSound } from '@/shared/api/audio/createWebAudioSound'
