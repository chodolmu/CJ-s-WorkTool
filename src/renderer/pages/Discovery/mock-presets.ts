import type { Preset } from "@shared/types";

/** IPC 연결 전 테스트용 하드코딩 프리셋 */
export const MOCK_PRESETS: Preset[] = [
  {
    id: "game",
    name: "Game",
    description: "2D/3D 게임 프로젝트",
    discoveryQuestions: [
      {
        id: "genre",
        question: "어떤 장르의 게임을 만드시나요?",
        order: 1,
        allowFreeText: true,
        options: [
          { label: "플랫포머", value: "platformer", description: "점프하고 달리는 횡스크롤 게임" },
          { label: "퍼즐", value: "puzzle", description: "두뇌를 쓰는 퍼즐 게임" },
          { label: "RPG", value: "rpg", description: "캐릭터 성장과 스토리 중심" },
          { label: "슈팅", value: "shooting", description: "적을 쏘고 피하는 게임" },
        ],
      },
      {
        id: "game_loop",
        question: "게임의 핵심 루프는 무엇인가요?",
        order: 2,
        allowFreeText: true,
        options: [
          { label: "이동 + 장애물 피하기", value: "move_avoid" },
          { label: "퍼즐 풀기", value: "solve_puzzle" },
          { label: "전투 + 성장", value: "combat_grow" },
          { label: "생존", value: "survive" },
        ],
      },
      {
        id: "controls",
        question: "어떤 조작 방식을 사용할까요?",
        order: 3,
        allowFreeText: false,
        options: [
          { label: "키보드", value: "keyboard" },
          { label: "마우스", value: "mouse" },
          { label: "키보드 + 마우스", value: "both" },
          { label: "터치 (모바일)", value: "touch" },
        ],
      },
      {
        id: "art_style",
        question: "어떤 비주얼 스타일을 원하시나요?",
        order: 4,
        allowFreeText: true,
        options: [
          { label: "픽셀 아트", value: "pixel", description: "레트로 도트 그래픽" },
          { label: "미니멀/심플", value: "minimal", description: "단순한 도형과 색상" },
          { label: "카툰/일러스트", value: "cartoon", description: "만화풍 캐릭터와 배경" },
        ],
      },
      {
        id: "play_time",
        question: "한 판의 플레이 시간은?",
        order: 5,
        allowFreeText: false,
        options: [
          { label: "1~3분 (캐주얼)", value: "casual" },
          { label: "5~15분 (미디엄)", value: "medium" },
          { label: "30분+ (하드코어)", value: "hardcore" },
        ],
      },
      {
        id: "reference",
        question: "참고하고 싶은 게임이 있나요?",
        order: 6,
        allowFreeText: true,
        options: [
          { label: "특별히 없음", value: "none", description: "AI가 알아서 제안" },
          { label: "있음 (직접 입력)", value: "custom" },
        ],
      },
      {
        id: "must_have",
        question: "이것만큼은 꼭 있어야 한다!",
        order: 7,
        allowFreeText: true,
        options: [
          { label: "쾌적한 조작감", value: "controls_feel" },
          { label: "중독성 있는 루프", value: "addictive_loop" },
          { label: "예쁜 비주얼", value: "visuals" },
          { label: "스토리/분위기", value: "story_mood" },
        ],
      },
    ],
    agents: [],
    evaluatorCriteria: [],
    baseGuidelines: "",
  },
  {
    id: "webapp",
    name: "Web App",
    description: "웹 애플리케이션",
    discoveryQuestions: [
      {
        id: "app_type",
        question: "어떤 종류의 웹앱인가요?",
        order: 1,
        allowFreeText: true,
        options: [
          { label: "대시보드/관리자", value: "dashboard" },
          { label: "SNS/커뮤니티", value: "social" },
          { label: "이커머스/쇼핑", value: "ecommerce" },
          { label: "SaaS 도구", value: "saas" },
        ],
      },
    ],
    agents: [],
    evaluatorCriteria: [],
    baseGuidelines: "",
  },
];
