from pathlib import Path

from PIL import Image

src = Path(r"D:\Laravel\crm\Trackbookcrm.png")
img = Image.open(src).convert("RGBA")

android = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
base = Path(r"D:\Laravel\crm\CRM_Mobile\android\app\src\main\res")
for folder, size in android.items():
    out = base / folder / "ic_launcher.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.resize((size, size), Image.Resampling.LANCZOS).save(out, "PNG")
    print("android", out, size)

pub = Path(r"D:\Laravel\crm\CRM_Frontend\public")
pub.mkdir(parents=True, exist_ok=True)
img.resize((512, 512), Image.Resampling.LANCZOS).save(pub / "trackbook-crm.png", "PNG")
img.resize((192, 192), Image.Resampling.LANCZOS).save(pub / "icon-192.png", "PNG")
img.resize((512, 512), Image.Resampling.LANCZOS).save(pub / "icon-512.png", "PNG")
icos = [img.resize((s, s), Image.Resampling.LANCZOS) for s in (16, 32, 48)]
icos[0].save(pub / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
print("web icons ok")

fa = Path(r"D:\Laravel\crm\CRM_Mobile\assets\brand")
fa.mkdir(parents=True, exist_ok=True)
img.resize((512, 512), Image.Resampling.LANCZOS).save(fa / "trackbook_crm.png", "PNG")
print("flutter asset ok")
