"""시연 영상(짧은 판)의 장면과 대사. 문제 → 해결 → 동작 순서 → 안심 → 마무리.

기획서 순서를 그대로 따르는 긴 판은 scenes_full.py 에 있다.
kind: title(제목 화면) / text(글 + 삽화) / shot(에뮬레이터 화면)
say: 내레이션. 음성 합성이 읽기 좋게 영어·숫자는 한글로 풀어 쓴다.
note: 실제와 다르게 보일 수 있는 장면에 꼭 넣는 안내 (docs/demo/README.md).
"""

EMULATOR = "Pleos Connect 에뮬레이터에서 실행한 실제 앱 화면"
DEMO_MODE = "에뮬레이터에는 시트 모터가 없어 시연 모드로 보여 줍니다"
SAMPLE = "에뮬레이터 카메라는 고정 사진이라 예시 기록으로 보여 줍니다"

SCENES = [
    {
        "kind": "text",
        "title": "탈 때마다 다시 맞추는 시트",
        "art": "share-car.png",
        "bullets": ["가족이 타고 난 차", "처음 타는 렌터카"],
        "say": "가족이 타고 난 차. 오늘도 시트부터 다시 맞추고 계신가요?",
    },
    {
        "kind": "text",
        "title": "겨우 맞춘 자세도 달리다 보면 무너져요",
        "art": "slouch.png",
        "bullets": ["그 자세가 정말 편했는지는 아무도 확인하지 않아요"],
        "say": "겨우 맞춘 자세도, 한 시간쯤 달리면 어느새 무너져 있습니다.",
    },
    {
        "kind": "title",
        "title": "BodyFit AI",
        "lines": ["한 번 맞추고 끝이 아니라,", "탈 때마다 더 편해지는 시트"],
        "say": "바디핏 에이아이. 한 번 맞추고 끝이 아니라, 탈 때마다 더 편해지는 시트입니다.",
    },
    {
        "kind": "shot",
        "note": EMULATOR,
        "shot": "02-register-form.png",
        "title": "키와 몸무게만 넣으면",
        "say": "키와 몸무게만 넣으세요.",
    },
    {
        "kind": "shot",
        "note": EMULATOR,
        "shot": "06-seat-recommend.png",
        "title": "내 체형에 맞는 자세를 바로 추천",
        "say": "내 체형에 맞는 자세를 바로 추천하고,",
    },
    {
        "kind": "shot",
        "note": DEMO_MODE,
        "shot": "08-auto-progress.png",
        "title": "버튼 한 번으로 시트가 맞춰져요",
        "say": "버튼 한 번이면, 시트가 알아서 맞춰집니다.",
    },
    {
        "kind": "shot",
        "note": "주행 중 화면을 가리는 것은 차량이 하는 일입니다",
        "shot": "15-driving-blocked.png",
        "title": "달리는 동안에는 조용히 지켜보기만",
        "say": "달리는 동안에는 아무것도 묻지 않습니다. 자세가 흐트러지는 순간만, 조용히 지켜봅니다.",
    },
    {
        "kind": "shot",
        "note": SAMPLE,
        "shot": "17-posture-report.png",
        "title": "37분쯤부터 자세가 앞으로 쏠렸어요",
        "say": "그리고 주차하면 알려 줍니다. 삼십칠 분쯤부터, 자세가 앞으로 쏠렸어요.",
    },
    {
        "kind": "shot",
        "note": EMULATOR,
        "shot": "19-learned-reason.png",
        "title": "다음에는 더 편한 자세로",
        "say": "한 번만 누르면, 다음 추천은 더 편한 자세로 바뀝니다.",
    },
    {
        "kind": "shot",
        "note": EMULATOR,
        "shot": "13-climate-diff.png",
        "title": "온도와 무드등도 평소대로",
        "say": "온도와 무드등도, 평소 설정 그대로.",
    },
    {
        "kind": "shot",
        "note": EMULATOR,
        "shot": "21-qr-export.png",
        "title": "처음 타는 차에서도 내 자세",
        "say": "처음 타는 렌터카에서도, 큐알 코드 하나로 내 자세를 가져옵니다.",
    },
    {
        "kind": "text",
        "title": "안전하게, 내 차 안에서만",
        "art": "private.png",
        "bullets": [
            "시트는 주차 중에, 확인한 뒤에만 움직여요",
            "카메라 영상은 저장하지 않아요",
            "기록은 차 안에만 남아요",
        ],
        "say": "시트는 주차 중에, 확인한 뒤에만 움직입니다. 카메라 영상은 저장하지 않고, 기록은 차 안에만 남습니다.",
    },
    {
        "kind": "title",
        "title": "BodyFit AI",
        "lines": ["탈수록 내 자세에 가까워지는 시트"],
        "foot": "화면은 모두 Pleos Connect 에뮬레이터(v2.1.0)에서 실제 앱을 실행해 찍었습니다",
        "say": "탈수록, 내 자세에 가까워집니다. 바디핏 에이아이.",
    },
]
