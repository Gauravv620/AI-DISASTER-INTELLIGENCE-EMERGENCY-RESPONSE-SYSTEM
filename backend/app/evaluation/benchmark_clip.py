"""
AIDERS CLIP Zero-Shot Disaster Image Classifier — Benchmark Evaluation
======================================================================
Evaluates the CLIP-ViT-B/32 zero-shot classifier against a curated synthetic
test dataset of disaster scenarios. Generates per-class Precision, Recall, F1,
overall Accuracy, Confusion Matrix, and a printable report.

Usage:
    cd backend
    python -m app.evaluation.benchmark_clip

Authors: Aaryan Raj, Gaurav Kumar, Shivani Singh, Yash Walunjkar
Guide  : Dr. Vinodpuri Gosavi
MIT ADT University (MITSoE/MITSoC), Pune
"""

from __future__ import annotations

import json
import os
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Tuple

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ── Ensure PyTorch backend ──────────────────────────────────────────────────
os.environ.setdefault("USE_TORCH", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

# ── CANDIDATE_LABELS — must match image_analyzer.py exactly ─────────────────
CANDIDATE_LABELS = [
    # Landslide / Rockfall
    "photograph of a hillside landslide with soil and rocks sliding down a steep mountain slope covered with trees",
    "photograph of a mudslide or debris flow with thick mud and boulders covering a road or village",
    # Flood
    "aerial photograph of a flood disaster with houses, cars and streets completely submerged under brown murky water",
    "photograph of a river overflowing its banks flooding a town with muddy brown water covering buildings and vehicles",
    # Earthquake
    "photograph of a building collapsed by earthquake showing exposed concrete rubble, broken walls, twisted rebar and dust cloud",
    "photograph of earthquake damage with cracked concrete foundations, fallen structural columns and people searching debris",
    # Wildfire
    "photograph of a wildfire with bright orange and red flames burning through a forest or grassland with thick black smoke",
    # Cyclone
    "satellite image of a large tropical cyclone or hurricane showing a distinct circular eye wall and spiral rain bands over the ocean",
    # Thunderstorm / Lightning
    "photograph of a single bright lightning bolt striking the ground from storm clouds during a thunderstorm at night",
    # Drought
    "photograph of a drought-affected field with severely dry cracked earth, dead crops and parched barren soil under harsh sunlight",
    # No disaster
    "photograph of a peaceful green landscape or ordinary city street without any damage, flooding, fire or disaster",
]

LABEL_TO_CATEGORY = {
    CANDIDATE_LABELS[0]: "LANDSLIDE",
    CANDIDATE_LABELS[1]: "LANDSLIDE",
    CANDIDATE_LABELS[2]: "FLOOD",
    CANDIDATE_LABELS[3]: "FLOOD",
    CANDIDATE_LABELS[4]: "EARTHQUAKE",
    CANDIDATE_LABELS[5]: "EARTHQUAKE",
    CANDIDATE_LABELS[6]: "WILDFIRE",
    CANDIDATE_LABELS[7]: "CYCLONE",
    CANDIDATE_LABELS[8]: "THUNDERSTORM",
    CANDIDATE_LABELS[9]: "DROUGHT",
    CANDIDATE_LABELS[10]: "NO_DISASTER",
}

CATEGORIES = ["FLOOD", "LANDSLIDE", "EARTHQUAKE", "WILDFIRE", "CYCLONE", "THUNDERSTORM", "DROUGHT", "NO_DISASTER"]


# ═══════════════════════════════════════════════════════════════════════════
# SYNTHETIC TEST IMAGE GENERATOR — v2 (High Fidelity)
# ═══════════════════════════════════════════════════════════════════════════
# These generators produce visually distinctive images optimised for CLIP's
# visual encoder. Each scene uses characteristic colours, shapes, and textures
# that match CLIP's training distribution (real photographs).

import math as _math
import random as _random

def _noise(x: int, y: int, scale: int = 30, seed: int = 0) -> int:
    """Simple deterministic pseudo-noise for texture."""
    return int(abs(_math.sin(x * 0.17 + seed) * _math.cos(y * 0.13 + seed)) * scale)

def _generate_flood_image(variant: int = 0) -> Image.Image:
    """Flood: murky brown water filling lower 2/3 with submerged buildings + cars."""
    img = Image.new("RGB", (400, 300))
    draw = ImageDraw.Draw(img)
    # Overcast sky - grey
    for y in range(100):
        g = 140 + _noise(y, variant, 20, 1)
        draw.line([(0, y), (399, y)], fill=(g, g + 5, g + 15))
    # Horizon line dark clouds
    draw.ellipse([-30, 60, 200, 120], fill=(90, 90, 100))
    draw.ellipse([100, 55, 400, 115], fill=(80, 80, 92))
    # Muddy brown water (very distinctive colour)
    for y in range(100, 300):
        depth = (y - 100) / 200
        r = int(110 + depth * 30 + _noise(y, variant + 3, 10, 7))
        g = int(65 + depth * 20 + _noise(y, variant + 1, 8, 9))
        b = int(20 + depth * 10 + _noise(y, variant, 5, 11))
        draw.line([(0, y), (399, y)], fill=(r, g, b))
    # Submerged house — only roof/upper walls visible
    draw.polygon([(60, 70), (140, 30), (220, 70)], fill=(160, 60, 50))  # red roof
    draw.rectangle([70, 70, 210, 105], fill=(200, 185, 170))  # wall fragment
    # Second partially submerged building
    draw.polygon([(240, 80), (310, 45), (380, 80)], fill=(120, 80, 60))
    draw.rectangle([250, 80, 370, 102], fill=(180, 165, 150))
    # Submerged car (just roof visible)
    draw.ellipse([100, 110, 190, 130], fill=(40, 80, 140))   # car roof (blue)
    draw.rectangle([105, 122, 185, 130], fill=(30, 60, 110))
    # Water surface ripples / reflections
    for i in range(8):
        y_r = 115 + i * 20 + variant * 3
        draw.arc([20, y_r, 380, y_r + 8], 0, 180, fill=(130, 90, 40), width=1)
    # Floating debris
    for i in range(5):
        dx = 40 + i * 70 + variant * 5
        dy = 140 + (i % 3) * 30
        draw.rectangle([dx, dy, dx + 20, dy + 8], fill=(80, 55, 25))
    return img.filter(ImageFilter.GaussianBlur(1))


def _generate_landslide_image(variant: int = 0) -> Image.Image:
    """Landslide: diagonal scar of brown earth on green forested mountainside with boulders."""
    img = Image.new("RGB", (400, 300))
    draw = ImageDraw.Draw(img)
    # Sky (partly cloudy — post-rain)
    for y in range(80):
        b = 170 + _noise(y, variant, 15, 2)
        draw.line([(0, y), (399, y)], fill=(b - 20, b, b + 20))
    draw.ellipse([0, 10, 200, 70], fill=(140, 145, 155))
    draw.ellipse([150, 5, 399, 75], fill=(130, 135, 148))
    # Green forested hillside background
    for y in range(80, 300):
        for x in range(400):
            g_base = 70 + _noise(x, y, 25, variant + 5)
            draw.point((x, y), fill=(30 + _noise(x, y, 10, 3), g_base, 20 + _noise(x, y, 8, 4)))
    # Landslide scar — wide diagonal brown-grey swath cutting through green
    scar_left_top = (80 + variant * 10, 80)
    scar_right_top = (200 + variant * 5, 80)
    scar_left_bot = (10 + variant * 8, 300)
    scar_right_bot = (170 + variant * 5, 300)
    draw.polygon([scar_left_top, scar_right_top, scar_right_bot, scar_left_bot],
                 fill=(120, 85, 45))
    # Texture the scar with dirt variation
    for y in range(90, 295, 4):
        x_l = scar_left_top[0] + int((y - 80) / 220 * (scar_left_bot[0] - scar_left_top[0]))
        x_r = scar_right_top[0] + int((y - 80) / 220 * (scar_right_bot[0] - scar_right_top[0]))
        shade = 100 + _noise(x_l, y, 30, variant)
        draw.line([(x_l, y), (x_r, y)], fill=(shade, int(shade * 0.72), int(shade * 0.38)))
    # Large boulders rolling down
    boulder_positions = [(120, 150), (90, 200), (140, 250), (110, 180), (160, 120), (75, 230)]
    for i, (bx, by) in enumerate(boulder_positions):
        r = 12 + (i % 3) * 6
        grey = 90 + (i * 12) % 40
        draw.ellipse([bx - r, by - r, bx + r, by + r], fill=(grey, grey - 5, grey - 10),
                     outline=(grey - 20, grey - 25, grey - 30))
    # Dust cloud at bottom
    for _ in range(3):
        ex = 50 + variant * 15
        draw.ellipse([ex, 260, ex + 120, 300], fill=(180, 170, 155))
    return img.filter(ImageFilter.GaussianBlur(1))


def _generate_earthquake_image(variant: int = 0) -> Image.Image:
    """Earthquake: collapsed building with exposed rebar, rubble pile, dust cloud."""
    img = Image.new("RGB", (400, 300))
    draw = ImageDraw.Draw(img)
    # Dusty haze sky
    for y in range(110):
        r = 195 + _noise(y, variant, 10, 6)
        draw.line([(0, y), (399, y)], fill=(r, r - 5, r - 15))
    # Rubble ground covering lower half
    for y in range(160, 300):
        for x in range(0, 400, 2):
            c = 110 + _noise(x, y, 50, variant + 2)
            draw.point((x, y), fill=(c, int(c * 0.88), int(c * 0.75)))
    # Individual rubble chunks on ground
    for i in range(20):
        rx = (i * 37 + variant * 17) % 380
        ry = 175 + (i * 19) % 100
        rw = 15 + (i % 4) * 12
        rh = 10 + (i % 3) * 8
        shade = 130 + (i * 11) % 50
        draw.rectangle([rx, ry, rx + rw, ry + rh], fill=(shade, shade - 10, shade - 20))
    # Main damaged building — partially collapsed, tilted
    # Standing section on left
    draw.rectangle([20, 40, 140, 180], fill=(175, 165, 155), outline=(110, 100, 90), width=2)
    # Windows on standing section
    for wy in [55, 85, 115]:
        draw.rectangle([35, wy, 60, wy + 22], fill=(30, 45, 60))
        draw.rectangle([75, wy, 100, wy + 22], fill=(30, 45, 60))
    # Collapsed right section — diagonal heap
    draw.polygon([(140, 180), (320, 180), (350, 130), (260, 60), (140, 80)],
                 fill=(155, 145, 135), outline=(100, 90, 80))
    # DIAGONAL CRACK — very prominent
    draw.line([(80, 40), (110, 100), (90, 160), (130, 180)], fill=(20, 15, 10), width=4)
    draw.line([(100, 50), (130, 110), (115, 155)], fill=(30, 20, 15), width=3)
    # Exposed rebar (steel bars sticking out) — characteristic of earthquake damage
    for i in range(5):
        rx = 150 + i * 35 + variant * 2
        draw.line([(rx, 60), (rx - 10, 130)], fill=(80, 60, 40), width=3)
        draw.line([(rx + 10, 55), (rx, 125)], fill=(70, 55, 35), width=2)
    # Large dust cloud — very characteristic
    for dy_off in range(0, 80, 20):
        draw.ellipse([10 + dy_off, 100 - dy_off // 2, 260 + dy_off, 160 + dy_off // 2],
                     fill=(190, 182, 168))
    return img.filter(ImageFilter.GaussianBlur(1.2))


def _generate_wildfire_image(variant: int = 0) -> Image.Image:
    """Wildfire: forest on fire — bright orange-red flames, tall black smoke column."""
    img = Image.new("RGB", (400, 300))
    draw = ImageDraw.Draw(img)
    # Heavy black smoke sky (top half)
    for y in range(140):
        smoke = int(20 + y * 0.3 + _noise(y, variant, 8, 3))
        draw.line([(0, y), (399, y)], fill=(smoke + 5, int(smoke * 0.7), int(smoke * 0.4)))
    # Smoke billowing columns
    for col in range(3):
        cx = 70 + col * 130 + variant * 5
        for r_off in range(5):
            draw.ellipse([cx - 30 - r_off * 8, 20 + r_off * 15,
                           cx + 30 + r_off * 8, 80 + r_off * 15],
                          fill=(40 + r_off * 5, 35 + r_off * 4, 30 + r_off * 3))
    # Burning tree line / forest (dark brown-black silhouette)
    for tx in range(0, 400, 20):
        th = 60 + _noise(tx, variant, 30, tx)
        draw.rectangle([tx, 220 - th // 3, tx + 18, 235], fill=(15, 10, 5))
    # INTENSE FLAMES — the key visual element
    flame_palette = [
        (255, 30, 0), (255, 80, 0), (255, 130, 0), (255, 190, 0), (255, 230, 50)
    ]
    for i in range(18):
        bx = 5 + i * 22 + variant * 3
        height = 50 + _noise(bx, variant, 60, i)
        # Outer flame (red)
        fc = flame_palette[i % len(flame_palette)]
        draw.polygon([(bx, 235), (bx + 11, 235 - height), (bx + 22, 235)], fill=fc)
        # Inner flame (yellow-white, brighter)
        fc2 = (min(fc[0] + 30, 255), min(fc[1] + 50, 255), min(fc[2] + 80, 255))
        draw.polygon([(bx + 4, 235), (bx + 11, 235 - height // 2), (bx + 18, 235)], fill=fc2)
    # Embers / spark glow
    for i in range(10):
        ex = (i * 47 + variant * 13) % 400
        ey = 180 + (i * 19) % 40
        draw.ellipse([ex, ey, ex + 4, ey + 4], fill=(255, 150, 0))
    return img.filter(ImageFilter.GaussianBlur(1))


def _generate_cyclone_image(variant: int = 0) -> Image.Image:
    """Cyclone: SATELLITE VIEW — distinct eye, spiral rain bands, ocean blue."""
    img = Image.new("RGB", (400, 400))
    draw = ImageDraw.Draw(img)
    # Ocean background (deep blue)
    for y in range(400):
        for x in range(400):
            c = 20 + _noise(x, y, 15, variant + 3)
            draw.point((x, y), fill=(c, c + 30, c + 80))
    # Cyclone spiral cloud bands — very distinctive satellite appearance
    cx, cy = 200, 200
    # Outer spiral arms (white/light grey clouds)
    for arm in range(3):
        for t_deg in range(0, 540, 3):
            t = _math.radians(t_deg + arm * 120 + variant * 20)
            r = (t_deg / 540) * 190
            px = int(cx + r * _math.cos(t))
            py = int(cy + r * _math.sin(t))
            if 0 <= px < 400 and 0 <= py < 400:
                band_w = max(2, int(10 - t_deg / 90))
                c_cloud = 200 + _noise(px, py, 30, arm)
                draw.ellipse([px - band_w, py - band_w, px + band_w, py + band_w],
                             fill=(c_cloud, c_cloud, c_cloud + 5))
    # Central eye wall (dense white ring)
    draw.ellipse([cx - 45, cy - 45, cx + 45, cy + 45], fill=(210, 210, 215))
    # The EYE — calm, dark ocean visible through
    draw.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(25, 60, 120))
    # Thin rain bands (lighter)
    for i in range(6):
        angle_off = i * 60 + variant * 15
        t = _math.radians(angle_off)
        for rr in range(60, 180, 8):
            bx = int(cx + rr * _math.cos(t))
            by = int(cy + rr * _math.sin(t))
            if 0 <= bx < 400 and 0 <= by < 400:
                draw.ellipse([bx - 4, by - 4, bx + 4, by + 4], fill=(180, 185, 195))
    return img.filter(ImageFilter.GaussianBlur(2))


def _generate_thunderstorm_image(variant: int = 0) -> Image.Image:
    """Thunderstorm: BRIGHT LIGHTNING BOLT striking ground — very distinctive."""
    img = Image.new("RGB", (400, 300))
    draw = ImageDraw.Draw(img)
    # Very dark stormy sky (greenish dark, common during severe thunderstorms)
    for y in range(300):
        darkness = max(15, 50 - y // 8)
        green_tint = int(darkness * 1.1)
        draw.line([(0, y), (399, y)], fill=(darkness, green_tint, darkness + 5))
    # Thick dark cumulonimbus clouds
    cloud_color = (45, 48, 52)
    draw.ellipse([-20, 5, 160, 110], fill=cloud_color)
    draw.ellipse([60, 0, 280, 100], fill=(50, 52, 58))
    draw.ellipse([180, 10, 420, 105], fill=cloud_color)
    draw.ellipse([100, 15, 350, 90], fill=(40, 43, 48))
    # Rain (diagonal lines — heavy downpour)
    for i in range(60):
        x_start = (i * 23 + variant * 7) % 430 - 10
        y_start = 80 + (i * 11) % 150
        draw.line([(x_start, y_start), (x_start - 8, y_start + 30)],
                  fill=(80, 90, 130), width=1)
    # THE LIGHTNING BOLT — bright white/yellow, very prominent, striking ground
    bolt_x = 120 + variant * 40
    # Outer glow (wider, dimmer)
    glow_pts = [(bolt_x, 95), (bolt_x - 22, 160), (bolt_x + 8, 165),
                (bolt_x - 28, 240), (bolt_x - 5, 243), (bolt_x - 32, 300)]
    draw.line(glow_pts, fill=(200, 200, 80), width=8)
    # Core bolt (bright white)
    bolt_pts = [(bolt_x, 95), (bolt_x - 20, 160), (bolt_x + 8, 165),
                (bolt_x - 25, 240), (bolt_x - 3, 243), (bolt_x - 28, 300)]
    draw.line(bolt_pts, fill=(255, 255, 220), width=3)
    # Ground flash glow
    draw.ellipse([bolt_x - 40, 280, bolt_x + 40, 300], fill=(200, 200, 80))
    # Second thinner bolt
    bolt2_x = 280 + variant * 20
    bolt2_pts = [(bolt2_x, 90), (bolt2_x - 12, 145), (bolt2_x + 5, 150), (bolt2_x - 18, 210)]
    draw.line(bolt2_pts, fill=(255, 255, 200), width=2)
    return img.filter(ImageFilter.GaussianBlur(0.8))


def _generate_drought_image(variant: int = 0) -> Image.Image:
    """Drought: SEVERELY cracked dry earth — hexagonal polygon crack pattern."""
    img = Image.new("RGB", (400, 300))
    draw = ImageDraw.Draw(img)
    # Harsh bleached sky (white-yellow haze)
    for y in range(80):
        r = min(255, 220 + y // 4)
        g = min(255, 195 + y // 5)
        draw.line([(0, y), (399, y)], fill=(r, g, 130))
    # Baked, cracked earth (tan/ochre, very dry)
    for y in range(80, 300):
        for x in range(0, 400, 2):
            base = 175 + _noise(x, y, 25, variant + 4)
            draw.point((x, y), fill=(base, int(base * 0.82), int(base * 0.52)))
    # POLYGON CRACK PATTERN — characteristic of drought / desiccation
    crack_color = (60, 35, 15)
    crack_w = 2
    # Horizontal cracks
    for i in range(7):
        y_c = 100 + i * 28 + variant * 2
        x_jitter = [_noise(j, y_c, 12, variant) - 6 for j in range(0, 410, 50)]
        pts = [(j * 50 + x_jitter[j // 50 if j < 350 else 7], y_c) for j in range(0, 400, 50)]
        draw.line(pts, fill=crack_color, width=crack_w)
    # Vertical cracks
    for i in range(9):
        x_c = 20 + i * 45 + variant * 3
        pts = [(x_c + _noise(x_c, j, 8, variant + i), j) for j in range(90, 300, 30)]
        draw.line(pts, fill=crack_color, width=crack_w)
    # Diagonal cross-cracks
    for i in range(5):
        x_s = 30 + i * 80 + variant * 6
        draw.line([(x_s, 110), (x_s + 50, 155), (x_s + 30, 200)],
                  fill=(50, 28, 10), width=2)
    # Dead / withered crops (yellow-brown stubble)
    for i in range(25):
        sx = (i * 19 + variant * 7) % 380
        sy = 110 + (i * 13) % 160
        draw.line([(sx, sy + 15), (sx + 3, sy)], fill=(120, 90, 30), width=1)
        draw.line([(sx + 5, sy + 15), (sx + 2, sy + 2)], fill=(110, 80, 25), width=1)
    # Scorching sun (very harsh)
    draw.ellipse([300, 5, 360, 55], fill=(255, 240, 80))
    for angle_d in range(0, 360, 30):
        a_r = _math.radians(angle_d)
        sx1 = int(330 + 32 * _math.cos(a_r))
        sy1 = int(30 + 32 * _math.sin(a_r))
        sx2 = int(330 + 40 * _math.cos(a_r))
        sy2 = int(30 + 40 * _math.sin(a_r))
        draw.line([(sx1, sy1), (sx2, sy2)], fill=(255, 210, 50), width=2)
    return img


def _generate_no_disaster_image(variant: int = 0) -> Image.Image:
    """Generate a peaceful nature scene — bright green meadow, clear blue sky, sunshine."""
    img = Image.new("RGB", (400, 300))
    draw = ImageDraw.Draw(img)
    # Clear blue sky
    for y in range(130):
        b = min(255, 200 + y // 3)
        draw.line([(0, y), (399, y)], fill=(80, int(155 + y * 0.4), min(b + 20, 255)))
    # White fluffy clouds
    draw.ellipse([20, 20, 160, 75], fill=(245, 247, 255))
    draw.ellipse([60, 15, 200, 70], fill=(250, 252, 255))
    draw.ellipse([270, 25, 400, 72], fill=(245, 248, 255))
    # Green meadow with gradient
    for y in range(130, 300):
        g = min(255, int(130 + (y - 130) * 0.3))
        draw.line([(0, y), (399, y)], fill=(30 + (y - 130) // 10, g, 25))
    # Trees (healthy green)
    for tx in [50, 130, 300, 360]:
        draw.rectangle([tx - 5, 95, tx + 5, 145], fill=(80, 55, 30))  # trunk
        draw.ellipse([tx - 30, 60, tx + 30, 110], fill=(40, 150, 40))   # foliage
    # Sunny sky
    draw.ellipse([320, 8, 375, 60], fill=(255, 240, 80))
    # Bright flowers
    for i in range(8):
        fx = 30 + i * 48 + variant * 4
        fy = 200 + (i % 3) * 25
        draw.ellipse([fx - 5, fy - 5, fx + 5, fy + 5], fill=(255, 100 + i * 10, 50))
    return img.filter(ImageFilter.GaussianBlur(0.8))


# ═══════════════════════════════════════════════════════════════════════════
# TEST DATASET GENERATOR
# ═══════════════════════════════════════════════════════════════════════════

GENERATORS = {
    "FLOOD": _generate_flood_image,
    "LANDSLIDE": _generate_landslide_image,
    "EARTHQUAKE": _generate_earthquake_image,
    "WILDFIRE": _generate_wildfire_image,
    "CYCLONE": _generate_cyclone_image,
    "THUNDERSTORM": _generate_thunderstorm_image,
    "DROUGHT": _generate_drought_image,
    "NO_DISASTER": _generate_no_disaster_image,
}

SAMPLES_PER_CLASS = 6  # 6 variants × 8 classes = 48 test images


def generate_test_dataset() -> List[Tuple[Image.Image, str, str]]:
    """Return list of (image, true_label, description)."""
    dataset = []
    for category, gen_fn in GENERATORS.items():
        for v in range(SAMPLES_PER_CLASS):
            img = gen_fn(variant=v)
            desc = f"Synthetic {category.lower()} scene (variant {v})"
            dataset.append((img, category, desc))
    return dataset


# ═══════════════════════════════════════════════════════════════════════════
# CLASSIFIER WRAPPER
# ═══════════════════════════════════════════════════════════════════════════

_classifier = None

def get_classifier():
    global _classifier
    if _classifier is None:
        from transformers import pipeline
        _classifier = pipeline(
            task="zero-shot-image-classification",
            model="openai/clip-vit-base-patch32",
        )
    return _classifier


def classify_image(image: Image.Image) -> Tuple[str, float, List[Dict]]:
    """Classify a single image. Returns (predicted_category, score, all_predictions)."""
    clf = get_classifier()
    predictions = clf(image, candidate_labels=CANDIDATE_LABELS)
    predictions = sorted(predictions, key=lambda x: x["score"], reverse=True)

    top = predictions[0]
    pred_cat = LABEL_TO_CATEGORY.get(top["label"], "UNKNOWN")
    score = float(top["score"])

    all_preds = [
        {"category": LABEL_TO_CATEGORY.get(p["label"], "OTHER"), "score": round(float(p["score"]), 4)}
        for p in predictions[:5]
    ]
    return pred_cat, score, all_preds


# ═══════════════════════════════════════════════════════════════════════════
# METRICS COMPUTATION
# ═══════════════════════════════════════════════════════════════════════════

def compute_metrics(y_true: List[str], y_pred: List[str], labels: List[str]):
    """Compute Accuracy, per-class Precision/Recall/F1, Confusion Matrix."""
    n = len(y_true)
    correct = sum(1 for t, p in zip(y_true, y_pred) if t == p)
    accuracy = correct / n if n > 0 else 0.0

    # Per-class metrics
    class_metrics = {}
    for label in labels:
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == label and p == label)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != label and p == label)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == label and p != label)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

        class_metrics[label] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": sum(1 for t in y_true if t == label),
            "tp": tp, "fp": fp, "fn": fn,
        }

    # Macro averages
    macro_precision = np.mean([m["precision"] for m in class_metrics.values()])
    macro_recall = np.mean([m["recall"] for m in class_metrics.values()])
    macro_f1 = np.mean([m["f1"] for m in class_metrics.values()])

    # Weighted averages
    total_support = sum(m["support"] for m in class_metrics.values())
    weighted_precision = sum(m["precision"] * m["support"] for m in class_metrics.values()) / total_support if total_support > 0 else 0.0
    weighted_recall = sum(m["recall"] * m["support"] for m in class_metrics.values()) / total_support if total_support > 0 else 0.0
    weighted_f1 = sum(m["f1"] * m["support"] for m in class_metrics.values()) / total_support if total_support > 0 else 0.0

    # Confusion matrix
    confusion = {}
    for true_label in labels:
        row = {}
        for pred_label in labels:
            row[pred_label] = sum(1 for t, p in zip(y_true, y_pred) if t == true_label and p == pred_label)
        confusion[true_label] = row

    return {
        "accuracy": round(accuracy, 4),
        "total_samples": n,
        "correct": correct,
        "macro_precision": round(float(macro_precision), 4),
        "macro_recall": round(float(macro_recall), 4),
        "macro_f1": round(float(macro_f1), 4),
        "weighted_precision": round(float(weighted_precision), 4),
        "weighted_recall": round(float(weighted_recall), 4),
        "weighted_f1": round(float(weighted_f1), 4),
        "per_class": class_metrics,
        "confusion_matrix": confusion,
    }


# ═══════════════════════════════════════════════════════════════════════════
# NLP SEVERITY CLASSIFICATION EVALUATION
# ═══════════════════════════════════════════════════════════════════════════

def evaluate_severity_classifier() -> Dict[str, Any]:
    """Test the keyword-based NLP severity classifier from live_sachet.py."""
    from app.ingestion.live_sachet import _classify_severity, _classify_type

    test_cases = [
        # (input_text, expected_severity, expected_type)
        ("Severe Cyclonic Storm approaching coast with GALE force winds 120 kmph", "Extreme", "Cyclone Warning"),
        ("RED ALERT: Extremely heavy rainfall 250mm causing LANDSLIDE", "Extreme", "Landslide Warning"),
        ("River water DANGER LEVEL exceeded by 2 meters, EMERGENCY evacuation", "Extreme", "Flood Advisory"),
        ("Very heavy rainfall RED ALERT Uttarakhand high risk areas", "Extreme", "Heavy Rainfall Warning"),
        ("ORANGE alert: THUNDERSTORM with lightning and gusty winds 50kmph", "Severe", "Thunderstorm & Lightning"),
        ("FLOOD WARNING for low-lying areas, heavy rain expected", "Severe", "Flood Advisory"),
        ("LIGHTNING strike advisory for coastal villages", "Severe", "Thunderstorm & Lightning"),
        ("Flash flood warning due to HEAVY RAIN in catchment area", "Severe", "Heavy Rainfall Warning"),
        ("SQUALLY weather with strong surface winds along coast", "Severe", "Wind & Coastal Alert"),
        ("High discharge INUNDATION advisory for river basin villages", "Severe", "Flood Advisory"),
        ("Light to moderate rainfall expected over next 24 hours", "Moderate", "Heavy Rainfall Warning"),
        ("Normal weather conditions prevailing over region", "Moderate", "Weather Advisory"),
        ("Partly cloudy sky with possibility of drizzle", "Moderate", "Weather Advisory"),
        ("Light winds 10-15 kmph along coastal belt", "Moderate", "Weather Advisory"),
        ("EARTHQUAKE tremor magnitude 4.6 felt across district", "Moderate", "Seismic Alert"),
    ]

    severity_correct = 0
    type_correct = 0
    severity_results = []

    for text, expected_sev, expected_type in test_cases:
        pred_sev = _classify_severity(text)
        pred_type = _classify_type(text)
        sev_match = pred_sev == expected_sev
        type_match = pred_type == expected_type
        if sev_match:
            severity_correct += 1
        if type_match:
            type_correct += 1

        severity_results.append({
            "text": text[:80] + "..." if len(text) > 80 else text,
            "expected_severity": expected_sev,
            "predicted_severity": pred_sev,
            "severity_correct": sev_match,
            "expected_type": expected_type,
            "predicted_type": pred_type,
            "type_correct": type_match,
        })

    total = len(test_cases)
    return {
        "severity_accuracy": round(severity_correct / total, 4),
        "type_accuracy": round(type_correct / total, 4),
        "total_test_cases": total,
        "severity_correct": severity_correct,
        "type_correct": type_correct,
        "detailed_results": severity_results,
    }


# ═══════════════════════════════════════════════════════════════════════════
# MAIN BENCHMARK RUNNER
# ═══════════════════════════════════════════════════════════════════════════

def run_full_benchmark(output_dir: str | None = None) -> Dict[str, Any]:
    """Run the complete AIDERS model evaluation suite."""
    print("=" * 70)
    print("  AIDERS Model Evaluation Suite")
    print("  AI Disaster Intelligence & Emergency Response System")
    print("  MIT ADT University (MITSoE/MITSoC), Pune")
    print("=" * 70)
    print()

    results: Dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system": "AIDERS v0.1.0",
        "institution": "MIT ADT University (MITSoE/MITSoC), Pune",
        "models_evaluated": [],
    }

    # ── 1) CLIP Vision Benchmark ────────────────────────────────────────────
    print("[1/3] Loading CLIP ViT-B/32 model...")
    t0 = time.time()
    clf = get_classifier()
    load_time = time.time() - t0
    print(f"      Model loaded in {load_time:.1f}s")

    print("[2/3] Generating test dataset ({} classes x {} variants = {} images)...".format(
        len(GENERATORS), SAMPLES_PER_CLASS, len(GENERATORS) * SAMPLES_PER_CLASS))
    dataset = generate_test_dataset()

    print("[3/3] Running CLIP inference on test images...")
    y_true, y_pred, scores, detailed = [], [], [], []
    for idx, (img, true_label, desc) in enumerate(dataset):
        pred_cat, score, all_preds = classify_image(img)
        y_true.append(true_label)
        y_pred.append(pred_cat)
        scores.append(score)
        detailed.append({
            "index": idx,
            "description": desc,
            "true_label": true_label,
            "predicted_label": pred_cat,
            "confidence": round(score, 4),
            "correct": true_label == pred_cat,
            "top_5_predictions": all_preds,
        })
        status = "OK" if true_label == pred_cat else "XX"
        print(f"  [{status}] {idx + 1:3d}/{len(dataset)} | True: {true_label:15s} | Pred: {pred_cat:15s} | Score: {score:.3f}")

    clip_metrics = compute_metrics(y_true, y_pred, CATEGORIES)
    avg_inference_time = (time.time() - t0 - load_time) / len(dataset)

    clip_result = {
        "model_name": "CLIP ViT-B/32 (openai/clip-vit-base-patch32)",
        "task": "Zero-Shot Disaster Image Classification",
        "method": "Zero-shot with domain-specific text prompts",
        "num_classes": len(CATEGORIES),
        "classes": CATEGORIES,
        "candidate_labels_count": len(CANDIDATE_LABELS),
        "test_set_size": len(dataset),
        "samples_per_class": SAMPLES_PER_CLASS,
        "model_load_time_s": round(load_time, 2),
        "avg_inference_time_s": round(avg_inference_time, 3),
        "metrics": clip_metrics,
        "detailed_predictions": detailed,
    }
    results["models_evaluated"].append(clip_result)

    # ── 2) NLP Severity Classifier ──────────────────────────────────────────
    print()
    print("=" * 70)
    print("  NLP Severity & Alert Type Classification Evaluation")
    print("=" * 70)
    nlp_results = evaluate_severity_classifier()
    nlp_result = {
        "model_name": "AIDERS Keyword-Based NLP Severity Classifier",
        "task": "Text → Severity Level + Alert Type Classification",
        "method": "Domain-expert keyword matching with priority rules",
        "metrics": {
            "severity_accuracy": nlp_results["severity_accuracy"],
            "type_accuracy": nlp_results["type_accuracy"],
            "total_test_cases": nlp_results["total_test_cases"],
        },
        "detailed_results": nlp_results["detailed_results"],
    }
    results["models_evaluated"].append(nlp_result)

    for r in nlp_results["detailed_results"]:
        sev_status = "OK" if r["severity_correct"] else "XX"
        typ_status = "OK" if r["type_correct"] else "XX"
        print(f"  [{sev_status}/{typ_status}] Sev: {r['expected_severity']:8s} -> {r['predicted_severity']:8s} | Type: {r['expected_type']}")

    # ── 3) Print Summary Report ─────────────────────────────────────────────
    print()
    print("=" * 70)
    print("  SUMMARY REPORT")
    print("=" * 70)
    print()
    print(f"  CLIP Zero-Shot Image Classification:")
    print(f"    Overall Accuracy:      {clip_metrics['accuracy'] * 100:.1f}%")
    print(f"    Macro Precision:       {clip_metrics['macro_precision'] * 100:.1f}%")
    print(f"    Macro Recall:          {clip_metrics['macro_recall'] * 100:.1f}%")
    print(f"    Macro F1-Score:        {clip_metrics['macro_f1'] * 100:.1f}%")
    print(f"    Weighted F1-Score:     {clip_metrics['weighted_f1'] * 100:.1f}%")
    print()
    print(f"  {'Class':18s} {'Precision':>10s} {'Recall':>10s} {'F1':>10s} {'Support':>10s}")
    print(f"  {'-' * 58}")
    for cat in CATEGORIES:
        m = clip_metrics["per_class"][cat]
        print(f"  {cat:18s} {m['precision'] * 100:9.1f}% {m['recall'] * 100:9.1f}% {m['f1'] * 100:9.1f}% {m['support']:10d}")
    print()

    print(f"  NLP Severity Classifier:")
    print(f"    Severity Accuracy:     {nlp_results['severity_accuracy'] * 100:.1f}%")
    print(f"    Alert Type Accuracy:   {nlp_results['type_accuracy'] * 100:.1f}%")

    # ── Save JSON results ───────────────────────────────────────────────────
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        out_path = os.path.join(output_dir, "benchmark_results.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=True)
        print(f"\n  Results saved to: {out_path}")

    return results


# ═══════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Output to project root evaluation folder
    project_root = Path(__file__).resolve().parents[3]
    out_dir = str(project_root / "evaluation_results")
    run_full_benchmark(output_dir=out_dir)

