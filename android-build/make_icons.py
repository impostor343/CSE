# Replaces the default Capacitor launcher icons with the app's own icon. Never fails the build.
import os, sys
try:
    from PIL import Image
    res = 'android/app/src/main/res'
    src = Image.open('icons/icon-maskable-512.png').convert('RGBA')
    legacy = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    fg = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    n = 0
    for d, px in legacy.items():
        for name in ('ic_launcher.png', 'ic_launcher_round.png'):
            p = f'{res}/mipmap-{d}/{name}'
            if os.path.exists(p): src.resize((px, px), Image.LANCZOS).save(p); n += 1
    for d, px in fg.items():
        p = f'{res}/mipmap-{d}/ic_launcher_foreground.png'
        if os.path.exists(p): src.resize((px, px), Image.LANCZOS).save(p); n += 1
    print('icons replaced:', n)
except Exception as e:
    print('icon step skipped:', e); sys.exit(0)
