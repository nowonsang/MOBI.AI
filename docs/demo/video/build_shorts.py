#!/usr/bin/env python3
"""세로형 요약 영상(숏폼, 1080×1920) 만들기: scenes_short.py + voice-short/ → ffmpeg.

    python3 docs/demo/video/build_shorts.py [결과.mp4]

가로 판(build.py)과 색·글꼴·합치는 방법은 같다. 숏폼답게 장면을 바로 넘기고, 장면마다 천천히 확대하고,
큰 문구에서 한 구절만 강조색으로 칠한다. 위아래 가장자리는 숏폼 앱의 버튼·설명에 가려지므로 비워 둔다.
"""

import os
import sys

from PIL import Image, ImageDraw

from build import (
    ART, BG, BOLD, HERE, INK, INK2, INK3, LINE, MEDIUM, PRIMARY, SEMIBOLD, SHOTS, SURFACE,
    build, font, paste_rounded, shadowed,
)
from scenes_short import SCENES

W, H = 1080, 1920
SIDE = 60
# 어두운 장면의 바탕과 그 위 강조색 (src/shared/ui/theme.ts 의 야간 값)
DARK = (14, 17, 22)
ON_DARK = (230, 233, 238)
ACCENT_ON_DARK = (92, 157, 255)
MUTED_ON_DARK = (160, 170, 186)
# 에뮬레이터 캡처에서 앱 창이 차지하는 영역 (왼쪽, 위, 오른쪽, 아래 비율)
APP_AREA = (534 / 1600, 56 / 900, 1.0, 812 / 900)
# 대사 앞뒤 쉬는 시간(초)과 장면마다 확대하는 비율
LEAD, TAIL, ZOOM = 0.15, 0.3, 0.03


def rich_lines(draw, text, fnt, width):
    """*별표 사이* 는 강조. 줄바꿈 글자와 띄어쓰기에서만 줄을 바꾸고, 줄마다 (글자, 강조 여부) 목록을 돌려준다."""
    lines = []
    for paragraph in text.split("\n"):
        words, strong = [], False
        for chunk in paragraph.split("*"):
            words += [(word, strong) for word in chunk.split(" ") if word]
            strong = not strong
        line = []
        for word in words:
            trial = " ".join(w for w, _ in line + [word])
            if line and draw.textlength(trial, font=fnt) > width:
                lines.append(line)
                line = []
            line.append(word)
        if line:
            lines.append(line)
    return lines


def rich(draw, text, fnt, y, fill, accent, step, width=W - SIDE * 2):
    """가운데 맞춘 여러 줄 글. 다음 줄의 y 를 돌려준다."""
    space = draw.textlength(" ", font=fnt)
    for line in rich_lines(draw, text, fnt, width):
        total = sum(draw.textlength(word, font=fnt) for word, _ in line) + space * (len(line) - 1)
        x = (W - total) / 2
        for word, strong in line:
            draw.text((x, y), word, font=fnt, fill=accent if strong else fill, anchor="lm")
            x += draw.textlength(word, font=fnt) + space
        y += step
    return y


def render_punch(scene):
    canvas = Image.new("RGBA", (W, H), DARK + (255,))
    draw = ImageDraw.Draw(canvas)
    lines = scene["lines"]
    size = 118 if len(lines) <= 2 else 100
    step = int(size * 1.32)
    y = (H - step * len(lines)) // 2 + step // 2 - 40
    if scene.get("art"):
        image = Image.open(os.path.join(ART, scene["art"])).convert("RGB")
        art_size = (W - SIDE * 2, (W - SIDE * 2) * 9 // 16)
        paste_rounded(canvas, image.resize(art_size, Image.LANCZOS), (SIDE, 400), 36)
        y = 400 + art_size[1] + 170
    for line in lines:
        y = rich(draw, line, font(size, BOLD), y, ON_DARK, ACCENT_ON_DARK, step)
    if scene.get("sub"):
        rich(draw, scene["sub"], font(48, MEDIUM), y + 30, MUTED_ON_DARK, MUTED_ON_DARK, 68)
    return canvas


def render_title(scene):
    canvas = Image.new("RGBA", (W, H), PRIMARY + (255,))
    draw = ImageDraw.Draw(canvas)
    draw.text((W // 2, 760), scene["title"], font=font(160, BOLD), fill=SURFACE, anchor="mm")
    y = 960
    for line in scene["lines"]:
        y = rich(draw, line, font(72, SEMIBOLD), y, SURFACE, SURFACE, 100)
    if scene.get("foot"):
        rich(draw, scene["foot"], font(30), 1500, (214, 228, 252), (214, 228, 252), 46, 860)
    return canvas


def render_text(scene):
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    image = Image.open(os.path.join(ART, scene["art"])).convert("RGB")
    size = (W - SIDE * 2, (W - SIDE * 2) * 9 // 16)
    top = 430
    shadowed(canvas, (SIDE, top, SIDE + size[0], top + size[1]), 32)
    paste_rounded(canvas, image.resize(size, Image.LANCZOS), (SIDE, top), 32)
    draw = ImageDraw.Draw(canvas)
    y = rich(draw, scene["title"], font(88, BOLD), top + size[1] + 150, INK, PRIMARY, 112)
    y += 30
    for bullet in scene["bullets"]:
        y = rich(draw, "✓ " + bullet, font(46, MEDIUM), y, INK2, INK2, 66) + 20
    return canvas


def render_shot(scene):
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    draw = ImageDraw.Draw(canvas)
    number, name = scene["step"]
    # 단계 표시: 번호 동그라미 + 이름
    label = font(46, BOLD)
    pill = int(draw.textlength(name, font=label)) + 150
    x = (W - pill) // 2
    draw.rounded_rectangle((x, 300, x + pill, 396), 48, fill=PRIMARY)
    draw.ellipse((x + 14, 314, x + 82, 382), fill=SURFACE)
    draw.text((x + 48, 348), str(number), font=font(42, BOLD), fill=PRIMARY, anchor="mm")
    draw.text((x + 104, 348), name, font=label, fill=SURFACE, anchor="lm")

    head = font(80, BOLD)
    count = len(rich_lines(draw, scene["title"], head, W - SIDE * 2))
    rich(draw, scene["title"], head, 580 - (count - 1) * 52, INK, PRIMARY, 104)

    image = Image.open(os.path.join(SHOTS, scene["shot"])).convert("RGB")
    # 캡처에는 차량 화면 전체가 들어 있다. 세로 화면에서 글자가 읽히게 앱 창 부분만 잘라 쓴다.
    w, h = image.size
    image = image.crop((int(w * APP_AREA[0]), int(h * APP_AREA[1]), int(w * APP_AREA[2]), int(h * APP_AREA[3])))
    size = (W - 40, (W - 40) * image.size[1] // image.size[0])
    top = 760
    shadowed(canvas, (20, top, 20 + size[0], top + size[1]), 24)
    paste_rounded(canvas, image.resize(size, Image.LANCZOS), (20, top), 24)
    draw = ImageDraw.Draw(canvas)
    # 다섯 단계 가운데 어디인지
    for i in range(5):
        cx = W // 2 + (i - 2) * 44
        draw.ellipse((cx - 9, top + size[1] + 50, cx + 9, top + size[1] + 68), fill=PRIMARY if i < number else LINE)
    if scene.get("note"):
        rich(draw, "※ " + scene["note"], font(30, MEDIUM), top + size[1] + 126, INK3, INK3, 44)
    return canvas


RENDER = {"punch": render_punch, "title": render_title, "text": render_text, "shot": render_shot}


def render_scene(scene, index, total):
    canvas = RENDER[scene["kind"]](scene)
    draw = ImageDraw.Draw(canvas)
    dark = scene["kind"] == "punch"
    if scene["kind"] != "title":
        draw.text((W // 2, 220), "BodyFit AI", font=font(40, BOLD), fill=ACCENT_ON_DARK if dark else PRIMARY, anchor="mm")
    return canvas


if __name__ == "__main__":
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "bodyfit-shorts.mp4")
    build(SCENES, render_scene, os.path.join(HERE, "voice-short"), out, lead=LEAD, tail=TAIL, fade=0, zoom=ZOOM)
