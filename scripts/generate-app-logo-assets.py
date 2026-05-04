#!/usr/bin/env python3
"""Generate ATouPay app logo assets from one building mark."""

from __future__ import annotations

import os
import struct
import zlib
from dataclasses import dataclass
from typing import Iterable, Literal, Sequence


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

PRIMARY_DARK = (10, 54, 34, 255)
PRIMARY = (15, 81, 50, 255)
SURFACE = (247, 248, 245, 255)
ACCENT = (184, 233, 134, 255)
TRANSPARENT = (0, 0, 0, 0)


@dataclass(frozen=True)
class ImageTarget:
    path: str
    size: int
    mode: Literal['full-icon', 'splash-mark', 'foreground']
    color_type: Literal['rgba', 'rgb'] = 'rgba'


def blend_pixel(buffer: bytearray, width: int, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    if x < 0 or y < 0 or x >= width:
        return

    index = (y * width + x) * 4
    sr, sg, sb, sa = color
    if sa == 255:
        buffer[index:index + 4] = bytes((sr, sg, sb, 255))
        return

    da = buffer[index + 3]
    if sa == 0:
        return

    alpha = sa / 255
    inv = 1 - alpha
    buffer[index] = round(sr * alpha + buffer[index] * inv)
    buffer[index + 1] = round(sg * alpha + buffer[index + 1] * inv)
    buffer[index + 2] = round(sb * alpha + buffer[index + 2] * inv)
    buffer[index + 3] = min(255, round(sa + da * inv))


def draw_rect(
    buffer: bytearray,
    width: int,
    height: int,
    box: tuple[float, float, float, float],
    color: tuple[int, int, int, int],
) -> None:
    x0, y0, x1, y1 = [round(value) for value in box]
    for y in range(max(0, y0), min(height, y1)):
        row = y * width * 4
        for x in range(max(0, x0), min(width, x1)):
            index = row + x * 4
            buffer[index:index + 4] = bytes(color)


def draw_rounded_rect(
    buffer: bytearray,
    width: int,
    height: int,
    box: tuple[float, float, float, float],
    radius: float,
    color: tuple[int, int, int, int],
) -> None:
    x0, y0, x1, y1 = box
    radius = max(0, radius)
    for y in range(max(0, int(y0)), min(height, int(y1))):
        for x in range(max(0, int(x0)), min(width, int(x1))):
            dx = max(x0 + radius - x, 0, x - (x1 - radius), 0)
            dy = max(y0 + radius - y, 0, y - (y1 - radius), 0)
            if dx * dx + dy * dy <= radius * radius:
                blend_pixel(buffer, width, x, y, color)


def scale_box(box: Sequence[float], scale: int, offset: float = 0) -> tuple[float, float, float, float]:
    return tuple((value + offset) * scale for value in box)  # type: ignore[return-value]


def draw_building(
    buffer: bytearray,
    width: int,
    height: int,
    scale: int,
    palette: Literal['light', 'dark'],
) -> None:
    art_scale = (width / scale) / 1024
    coordinate_scale = scale * art_scale

    if palette == 'light':
        building = SURFACE
        window = (10, 54, 34, 210)
        accent = ACCENT
    else:
        building = PRIMARY_DARK
        window = (247, 248, 245, 230)
        accent = PRIMARY

    # Coordinates are authored on a 1024x1024 artboard.
    def rr(box: Sequence[float], radius: float, color: tuple[int, int, int, int]) -> None:
        draw_rounded_rect(
            buffer,
            width,
            height,
            scale_box(box, coordinate_scale),
            radius * coordinate_scale,
            color,
        )

    rr((456, 164, 568, 258), 28, building)
    rr((412, 226, 616, 786), 36, building)
    rr((286, 398, 428, 786), 30, building)
    rr((600, 330, 742, 786), 30, building)
    rr((246, 742, 782, 842), 44, building)

    # Roofline notches keep the silhouette readable at small icon sizes.
    draw_rect(buffer, width, height, scale_box((478, 132, 546, 188), coordinate_scale), building)
    draw_rect(buffer, width, height, scale_box((328, 362, 386, 410), coordinate_scale), building)
    draw_rect(buffer, width, height, scale_box((642, 292, 700, 340), coordinate_scale), building)

    for y in (324, 414, 504, 594):
        rr((456, y, 496, y + 46), 9, window)
        rr((532, y, 572, y + 46), 9, window)

    for y in (472, 560, 648):
        rr((334, y, 376, y + 44), 9, window)
        rr((650, y - 56, 692, y - 12), 9, window)

    rr((474, 674, 554, 842), 40, window)
    rr((494, 704, 534, 842), 20, accent)


def downsample(buffer: bytearray, width: int, height: int, scale: int) -> bytearray:
    target_width = width // scale
    target_height = height // scale
    out = bytearray(target_width * target_height * 4)

    for y in range(target_height):
        for x in range(target_width):
            total = [0, 0, 0, 0]
            for sy in range(scale):
                for sx in range(scale):
                    index = ((y * scale + sy) * width + (x * scale + sx)) * 4
                    total[0] += buffer[index]
                    total[1] += buffer[index + 1]
                    total[2] += buffer[index + 2]
                    total[3] += buffer[index + 3]
            count = scale * scale
            out_index = (y * target_width + x) * 4
            out[out_index:out_index + 4] = bytes(round(channel / count) for channel in total)

    return out


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data) & 0xFFFFFFFF)


def write_png(path: str, pixels: bytearray, width: int, height: int, color_type: Literal['rgba', 'rgb']) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if color_type == 'rgb':
        row_size = width * 3
        raw = bytearray((row_size + 1) * height)
        for y in range(height):
            raw[y * (row_size + 1)] = 0
            for x in range(width):
                src = (y * width + x) * 4
                dst = y * (row_size + 1) + 1 + x * 3
                raw[dst:dst + 3] = pixels[src:src + 3]
        png_color_type = 2
    else:
        row_size = width * 4
        raw = bytearray((row_size + 1) * height)
        for y in range(height):
            raw[y * (row_size + 1)] = 0
            start = y * width * 4
            raw[y * (row_size + 1) + 1:y * (row_size + 1) + 1 + row_size] = pixels[start:start + row_size]
        png_color_type = 6

    data = b'\x89PNG\r\n\x1a\n'
    data += png_chunk(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, png_color_type, 0, 0, 0))
    data += png_chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    data += png_chunk(b'IEND', b'')
    with open(path, 'wb') as output:
        output.write(data)


def render_target(target: ImageTarget) -> None:
    scale = 3 if target.size >= 512 else 4
    width = target.size * scale
    height = target.size * scale
    buffer = bytearray(TRANSPARENT * (width * height))

    if target.mode == 'full-icon':
        draw_rect(buffer, width, height, (0, 0, width, height), PRIMARY_DARK)
        draw_building(buffer, width, height, scale, 'light')
    elif target.mode == 'splash-mark':
        inset = round(target.size * 0.08) * scale
        draw_rounded_rect(
            buffer,
            width,
            height,
            (inset, inset, width - inset, height - inset),
            target.size * 0.17 * scale,
            PRIMARY_DARK,
        )
        draw_building(buffer, width, height, scale, 'light')
    else:
        draw_building(buffer, width, height, scale, 'dark')

    pixels = downsample(buffer, width, height, scale)
    write_png(os.path.join(ROOT, target.path), pixels, target.size, target.size, target.color_type)


TARGETS: Iterable[ImageTarget] = (
    ImageTarget('assets/icon.png', 1024, 'full-icon'),
    ImageTarget('ios/ATouPayDev/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png', 1024, 'full-icon', 'rgb'),
    ImageTarget('android/app/src/main/res/mipmap-mdpi/ic_launcher.webp', 48, 'full-icon'),
    ImageTarget('android/app/src/main/res/mipmap-hdpi/ic_launcher.webp', 72, 'full-icon'),
    ImageTarget('android/app/src/main/res/mipmap-xhdpi/ic_launcher.webp', 96, 'full-icon'),
    ImageTarget('android/app/src/main/res/mipmap-xxhdpi/ic_launcher.webp', 144, 'full-icon'),
    ImageTarget('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.webp', 192, 'full-icon'),
    ImageTarget('android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.webp', 108, 'foreground'),
    ImageTarget('android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.webp', 162, 'foreground'),
    ImageTarget('android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.webp', 216, 'foreground'),
    ImageTarget('android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.webp', 324, 'foreground'),
    ImageTarget('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.webp', 432, 'foreground'),
    ImageTarget('android/app/src/main/res/drawable-mdpi/splashscreen_logo.png', 288, 'splash-mark'),
    ImageTarget('android/app/src/main/res/drawable-hdpi/splashscreen_logo.png', 432, 'splash-mark'),
    ImageTarget('android/app/src/main/res/drawable-xhdpi/splashscreen_logo.png', 576, 'splash-mark'),
    ImageTarget('android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png', 864, 'splash-mark'),
    ImageTarget('android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png', 1152, 'splash-mark'),
)


def main() -> None:
    for target in TARGETS:
        render_target(target)
        print(f'generated {target.path}')


if __name__ == '__main__':
    main()
