#!/usr/bin/env python3
"""세로형 요약 영상(숏폼, 1080×1920) 만들기: scenes_short.py + voice-short/ → ffmpeg.

    python3 docs/demo/video/build_shorts.py [결과.mp4]

가로 판(build.py)과 색·글꼴·합치는 방법은 같고 장면 배치만 세로로 다시 짰다.
위아래 가장자리는 숏폼 앱의 버튼·설명에 가려지므로 비워 둔다.
"""

import os
import sys

from PIL import Image, ImageDraw

from build import (
    ART, BG, BOLD, HERE, INK, INK2, INK3, LINE, MEDIUM, PRIMARY, SHOTS, SURFACE,
    build, font, paste_rounded, shadowed, wrap,
)
from scenes_short import SCENES

W, H = 1080, 1920
SIDE = 60
# 에뮬레이터 캡처에서 앱 창이 차지하는 영역 (왼쪽, 위, 오른쪽, 아래 비율)
APP_AREA = (534 / 1600, 56 / 900, 1.0, 812 / 900)


def centered(draw, text, fnt, y, fill, step, width=W - SIDE * 2):
    for part in wrap(draw, text, fnt, width):
        draw.text((W // 2, y), part, font=fnt, fill=fill, anchor="mm")
        y += step
    return y


def render_title(scene):
    canvas = Image.new("RGBA", (W, H), PRIMARY + (255,))
    draw = ImageDraw.Draw(canvas)
    draw.text((W // 2, 760), scene["title"], font=font(150, BOLD), fill=SURFACE, anchor="mm")
    y = 940
    for line in scene["lines"]:
        y = centered(draw, line, font(56, MEDIUM), y, SURFACE, 84)
    if scene.get("foot"):
        centered(draw, scene["foot"], font(30), 1500, (214, 228, 252), 46, 860)
    return canvas


def render_text(scene):
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    image = Image.open(os.path.join(ART, scene["art"])).convert("RGB")
    size = (W - SIDE * 2, (W - SIDE * 2) * 9 // 16)
    top = 480
    shadowed(canvas, (SIDE, top, SIDE + size[0], top + size[1]), 32)
    paste_rounded(canvas, image.resize(size, Image.LANCZOS), (SIDE, top), 32)
    draw = ImageDraw.Draw(canvas)
    y = centered(draw, scene["title"], font(72, BOLD), top + size[1] + 130, INK, 96)
    y += 40
    for bullet in scene["bullets"]:
        y = centered(draw, bullet, font(46, MEDIUM), y, INK2, 66) + 24
    return canvas


def render_shot(scene):
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    draw = ImageDraw.Draw(canvas)
    lines = wrap(draw, scene["title"], font(76, BOLD), W - SIDE * 2)
    centered(draw, scene["title"], font(76, BOLD), 540 - (len(lines) - 1) * 50, INK, 100)
    image = Image.open(os.path.join(SHOTS, scene["shot"])).convert("RGB")
    # 캡처에는 차량 화면 전체가 들어 있다. 세로 화면에서 글자가 읽히게 앱 창 부분만 잘라 쓴다.
    w, h = image.size
    image = image.crop((int(w * APP_AREA[0]), int(h * APP_AREA[1]), int(w * APP_AREA[2]), int(h * APP_AREA[3])))
    size = (W - 40, (W - 40) * image.size[1] // image.size[0])
    top = 700
    shadowed(canvas, (20, top, 20 + size[0], top + size[1]), 24)
    paste_rounded(canvas, image.resize(size, Image.LANCZOS), (20, top), 24)
    if scene.get("note"):
        centered(ImageDraw.Draw(canvas), "※ " + scene["note"], font(30, MEDIUM), top + size[1] + 80, INK3, 44)
    return canvas


RENDER = {"title": render_title, "text": render_text, "shot": render_shot}


def render_scene(scene, index, total):
    canvas = RENDER[scene["kind"]](scene)
    draw = ImageDraw.Draw(canvas)
    if scene["kind"] != "title":
        draw.text((W // 2, 300), "BodyFit AI", font=font(40, BOLD), fill=PRIMARY, anchor="mm")
    draw.rectangle((0, H - 10, W, H), fill=LINE)
    draw.rectangle((0, H - 10, int(W * (index + 1) / total), H), fill=PRIMARY)
    return canvas


if __name__ == "__main__":
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "bodyfit-shorts.mp4")
    build(SCENES, render_scene, os.path.join(HERE, "voice-short"), out)
