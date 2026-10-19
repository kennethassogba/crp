from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
font_path = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
for size in [192, 512]:
    image = Image.new("RGB", (size, size), "#000000")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(font_path, round(size * .39))
    box = draw.textbbox((0, 0), "Fin", font=font)
    draw.text(((size - box[2]) / 2, (size - box[3] - box[1]) / 2), "Fin", font=font, fill="#eeeff1")
    image.save(root / "public" / f"icon-{size}.png")
(root / "public" / "docs").mkdir(exist_ok=True)
shutil.copy(root / "docs" / "data-access.json", root / "public" / "docs" / "data-access.json")
