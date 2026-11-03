# 生成桌面 EXE 图标（desktop/app.ico）
# 用法：python desktop/make_icon.py
from PIL import Image, ImageDraw, ImageFont
import os

SIZE = 512
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
dr = ImageDraw.Draw(img)

# 圆角深色底 + 渐变
pad = 24
bg = Image.new("RGBA", (SIZE - pad * 2, SIZE - pad * 2), (0, 0, 0, 0))
bd = ImageDraw.Draw(bg)
for y in range(bg.height):
    t = y / max(1, bg.height - 1)
    r = int(12 + (30 - 12) * t)
    g = int(20 + (22 - 20) * t)
    b = int(38 + (52 - 38) * t)
    bd.line([(0, y), (bg.width, y)], fill=(r, g, b, 255))
# 霓虹描边
bd.rounded_rectangle([0, 0, bg.width - 1, bg.height - 1], radius=110,
                     outline=(34, 211, 238, 210), width=6)
bg.putalpha(bg.split()[3])
img.paste(bg, (pad, pad), bg)

# 文字 2632?
font_candidates = [
    r"C:\Windows\Fonts\seguisb.ttf",
    r"C:\Windows\Fonts\segoeuib.ttf",
    r"C:\Windows\Fonts\arialbd.ttf",
]
font = None
for path in font_candidates:
    if os.path.exists(path):
        font = ImageFont.truetype(path, 190)
        break
if font is None:
    font = ImageFont.load_default()

text = "2632"
bbox = dr.textbbox((0, 0), text, font=font)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
# 渐变文字：青色 -> 紫色（逐像素裁剪）
text_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
td = ImageDraw.Draw(text_img)
td.text(((SIZE - w) / 2 - bbox[0], (SIZE - h) / 2 - bbox[1] - 24), text, font=font, fill=(255, 255, 255, 255))
mask = text_img.split()[3]
grad = Image.new("RGBA", img.size)
gd = ImageDraw.Draw(grad)
for y in range(SIZE):
    t = y / SIZE
    gd.line([(0, y), (SIZE, y)], fill=(int(103 + (196 - 103) * t), int(232 + (181 - 232) * t), int(249 + (253 - 249) * t), 255))
img.paste(grad, (0, 0), mask)

# 粉色问号
qfont = ImageFont.truetype(font.path if hasattr(font, "path") else font_candidates[0], 110)
qb = dr.textbbox((0, 0), "?", font=qfont)
qw = qb[2] - qb[0]
dr.text((SIZE / 2 + w / 2 - qw + 6, SIZE / 2 - h / 2 + 34), "?", font=qfont, fill=(244, 114, 182, 255))

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.ico")
img.save(out, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("written", out)
