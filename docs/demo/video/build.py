#!/usr/bin/env python3
"""시연 영상 만들기: 장면 그림(PIL) + 내레이션(macOS say) → ffmpeg 로 합친다.

    python3 docs/demo/video/build.py [결과.mp4]

- 장면과 대사는 같은 폴더의 scenes.py 에 있다. 기획서(접수양식 1~6번) 순서를 따른다.
- 화면 그림은 docs/demo/shots/ (에뮬레이터 캡처), 삽화는 docs/demo/video/art/ (Higgsfield 로 만든 그림).
- 필요한 것: macOS(say, 한국어 음성 Yuna), ffmpeg, Python Pillow.
- 중간 파일은 임시 폴더에 만든다. 저장소에는 결과 영상을 넣지 않는다.
"""

import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from scenes import SCENES

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "..", "shots")
ART = os.path.join(HERE, "art")

W, H = 1920, 1080
FPS = 30
VOICE = "Yuna"
# 말 빠르기(분당 단어 수). 기본값은 설명 영상으로는 느리다.
RATE = "180"
# 장면 앞뒤로 두는 숨 고르는 시간(초)
LEAD, TAIL = 0.4, 0.6
FADE = 0.3

# 앱 디자인 토큰(src/shared/ui/theme.ts 주간 값)과 같은 색을 쓴다.
PRIMARY = (21, 112, 239)
TINT = (232, 241, 254)
INK = (17, 24, 39)
INK2 = (75, 85, 99)
INK3 = (95, 102, 115)
BG = (244, 245, 247)
SURFACE = (255, 255, 255)
LINE = (229, 231, 235)

FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"
REGULAR, MEDIUM, SEMIBOLD, BOLD = 0, 2, 4, 6


def font(size, weight=REGULAR):
    return ImageFont.truetype(FONT, size, index=weight)


def wrap(draw, text, fnt, width):
    """띄어쓰기에서만 줄을 바꾼다 (한글 단어가 중간에 잘리지 않게)."""
    lines, line = [], ""
    for word in text.split(" "):
        trial = word if not line else line + " " + word
        if draw.textlength(trial, font=fnt) <= width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def shadowed(canvas, box, radius, fill=SURFACE):
    """연한 그림자가 있는 둥근 카드."""
    x0, y0, x1, y1 = box
    pad = 60
    shadow = Image.new("RGBA", (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (pad, pad + 10, pad + x1 - x0, pad + y1 - y0 + 10), radius, fill=(17, 24, 39, 46)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    canvas.alpha_composite(shadow, (x0 - pad, y0 - pad))
    ImageDraw.Draw(canvas).rounded_rectangle(box, radius, fill=fill)


def paste_rounded(canvas, image, xy, radius):
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *image.size), radius, fill=255)
    canvas.paste(image, xy, mask)


def chrome(canvas, scene, index, total):
    """모든 장면 공통: 왼쪽 위 기획서 항목, 오른쪽 위 안내, 아래 진행 막대."""
    draw = ImageDraw.Draw(canvas)
    section = scene.get("section")
    if section:
        fnt = font(26, SEMIBOLD)
        width = int(draw.textlength(section, font=fnt)) + 44
        draw.rounded_rectangle((80, 26, 80 + width, 72), 23, fill=TINT)
        draw.text((102, 49), section, font=fnt, fill=PRIMARY, anchor="lm")
    note = scene.get("note")
    if note:
        draw.text((W - 80, 49), "※ " + note, font=font(24, MEDIUM), fill=INK3, anchor="rm")
    else:
        draw.text((W - 80, 49), "BodyFit AI", font=font(26, BOLD), fill=INK3, anchor="rm")
    draw.rectangle((0, H - 8, W, H), fill=LINE)
    draw.rectangle((0, H - 8, int(W * (index + 1) / total), H), fill=PRIMARY)


def render_title(scene):
    canvas = Image.new("RGBA", (W, H), PRIMARY + (255,))
    draw = ImageDraw.Draw(canvas)
    draw.text((W // 2, 360), scene["title"], font=font(150, BOLD), fill=SURFACE, anchor="mm")
    fnt = font(46, MEDIUM)
    y = 520
    for line in scene["lines"]:
        for part in wrap(draw, line, fnt, 1400):
            draw.text((W // 2, y), part, font=fnt, fill=SURFACE, anchor="mm")
            y += 68
    if scene.get("foot"):
        draw.text((W // 2, 940), scene["foot"], font=font(28), fill=(214, 228, 252), anchor="mm")
    return canvas


def render_text(scene):
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    box = (120, 120, W - 120, 1000)
    shadowed(canvas, box, 36)
    draw = ImageDraw.Draw(canvas)
    art = scene.get("art")
    text_right = box[2] - 80
    if art:
        image = Image.open(os.path.join(ART, art)).convert("RGB")
        size = (760, 428)
        image = image.resize(size, Image.LANCZOS)
        xy = (box[2] - size[0] - 60, (box[1] + box[3] - size[1]) // 2)
        paste_rounded(canvas, image, xy, 28)
        text_right = xy[0] - 60
    x = box[0] + 80
    head = font(60, BOLD)
    body = font(38, MEDIUM)
    sub = font(30)

    def layout(y, paint):
        """paint 가 False 면 높이만 잰다 (글 덩어리를 카드 가운데에 두려고)."""
        if paint:
            draw.rounded_rectangle((x, y, x + 12, y + 64), 6, fill=PRIMARY)
        for part in wrap(draw, scene["title"], head, text_right - x - 40):
            if paint:
                draw.text((x + 40, y + 32), part, font=head, fill=INK, anchor="lm")
            y += 82
        y += 40
        for bullet in scene["bullets"]:
            text, detail = bullet if isinstance(bullet, tuple) else (bullet, None)
            if paint:
                draw.ellipse((x + 6, y + 14, x + 22, y + 30), fill=PRIMARY)
            for part in wrap(draw, text, body, text_right - x - 60):
                if paint:
                    draw.text((x + 48, y + 22), part, font=body, fill=INK, anchor="lm")
                y += 54
            if detail:
                for part in wrap(draw, detail, sub, text_right - x - 60):
                    if paint:
                        draw.text((x + 48, y + 16), part, font=sub, fill=INK3, anchor="lm")
                    y += 42
            y += 30
        return y

    height = layout(0, False) - 30
    layout(box[1] + max(70, (box[3] - box[1] - height) // 2), True)
    return canvas


def render_steps(scene):
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    draw = ImageDraw.Draw(canvas)
    draw.text((W // 2, 190), scene["title"], font=font(60, BOLD), fill=INK, anchor="mm")
    if scene.get("subtitle"):
        draw.text((W // 2, 268), scene["subtitle"], font=font(34), fill=INK2, anchor="mm")
    steps = scene["steps"]
    gap, card_w, card_h = 36, 316, 430
    left = (W - (card_w * len(steps) + gap * (len(steps) - 1))) // 2
    top = 370
    for i, (name, what, how) in enumerate(steps):
        x = left + i * (card_w + gap)
        shadowed(canvas, (x, top, x + card_w, top + card_h), 28)
        draw = ImageDraw.Draw(canvas)
        draw.ellipse((x + 32, top + 34, x + 96, top + 98), fill=PRIMARY)
        draw.text((x + 64, top + 66), str(i + 1), font=font(34, BOLD), fill=SURFACE, anchor="mm")
        draw.text((x + 32, top + 150), name, font=font(40, BOLD), fill=INK, anchor="lm")
        y = top + 210
        for part in wrap(draw, what, font(30, MEDIUM), card_w - 64):
            draw.text((x + 32, y), part, font=font(30, MEDIUM), fill=PRIMARY, anchor="lm")
            y += 42
        y += 14
        for part in wrap(draw, how, font(27), card_w - 64):
            draw.text((x + 32, y), part, font=font(27), fill=INK3, anchor="lm")
            y += 38
        if i < len(steps) - 1:
            draw.text((x + card_w + gap // 2, top + card_h // 2), "›", font=font(54, BOLD), fill=INK3, anchor="mm")
    return canvas


def render_shot(scene):
    canvas = Image.new("RGBA", (W, H), BG + (255,))
    image = Image.open(os.path.join(SHOTS, scene["shot"])).convert("RGB")
    size = (1504, 846)
    image = image.resize(size, Image.LANCZOS)
    x, y = (W - size[0]) // 2, 92
    shadowed(canvas, (x, y, x + size[0], y + size[1]), 26)
    paste_rounded(canvas, image, (x, y), 26)
    draw = ImageDraw.Draw(canvas)
    draw.text((W // 2, 984), scene["title"], font=font(44, BOLD), fill=INK, anchor="mm")
    if scene.get("caption"):
        draw.text((W // 2, 1038), scene["caption"], font=font(29), fill=INK2, anchor="mm")
    return canvas


RENDER = {"title": render_title, "text": render_text, "steps": render_steps, "shot": render_shot}


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(out.stdout.strip())


def main():
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "bodyfit-demo.mp4")
    work = tempfile.mkdtemp(prefix="bodyfit-video-")
    total = len(SCENES)
    parts = []
    length = 0.0
    for index, scene in enumerate(SCENES):
        frame = os.path.join(work, f"{index:02d}.png")
        canvas = RENDER[scene["kind"]](scene)
        if scene["kind"] != "title":
            chrome(canvas, scene, index, total)
        canvas.convert("RGB").save(frame)

        # voice/NN.mp3 (고른 목소리로 미리 만든 대사)가 있으면 그것을 쓰고, 없으면 macOS 음성으로 읽는다.
        voice = os.path.join(HERE, "voice", f"{index:02d}.mp3")
        if not os.path.exists(voice):
            voice = os.path.join(work, f"{index:02d}.aiff")
            run("say", "-v", VOICE, "-r", RATE, "-o", voice, scene["say"])
        seconds = LEAD + duration(voice) + TAIL
        length += seconds

        part = os.path.join(work, f"{index:02d}.mp4")
        color = "0xF4F5F7"
        run(
            "ffmpeg", "-y", "-loop", "1", "-framerate", str(FPS), "-i", frame, "-i", voice,
            "-filter_complex",
            f"[0:v]fade=t=in:st=0:d={FADE}:color={color},"
            f"fade=t=out:st={seconds - FADE:.3f}:d={FADE}:color={color},format=yuv420p[v];"
            f"[1:a]adelay={int(LEAD * 1000)}:all=1,apad[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{seconds:.3f}",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-ac", "2",
            part,
        )
        parts.append(part)
        print(f"{index + 1:2d}/{total} {seconds:5.1f}s  {scene.get('title', '')}")

    listing = os.path.join(work, "parts.txt")
    with open(listing, "w") as file:
        file.writelines(f"file '{part}'\n" for part in parts)
    run("ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listing, "-c", "copy", "-movflags", "+faststart", out)
    print(f"{out}  ({int(length // 60)}분 {int(length % 60)}초)  frames: {work}")


if __name__ == "__main__":
    main()
