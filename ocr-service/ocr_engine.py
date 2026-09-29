#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MediAssist AI OCR Engine
========================
Image preprocessing + Tesseract OCR via pytesseract. Pure-Python module;
no framework dependency (decouples from Flask for testability). Exposed
through the Flask app in this directory.

Preprocessing pipeline:
    1. Orient / correct EXIF using Pillow (ImageOps.exif_transpose)
    2. Convert to RGB, strip alpha
    3. Upscale if image is small (improves Tesseract recognition)
    4. Grayscale
    5. Noise reduction (median filter)
    6. Auto contrast + sharpening
    7. Adaptive binarisation (foreground text vs background)
"""

import io
import os
import platform
import re
import shutil
import subprocess
import logging

from PIL import Image, ImageOps, ImageFilter, ImageEnhance

logger = logging.getLogger("mediassist-ocr-engine")

OCRUnavailableError = type("OCRUnavailableError", (RuntimeError,), {})
OCRProcessingError = type("OCRProcessingError", (RuntimeError,), {})

# Tesseract executable. Auto-detect on common MSYS2 / Windows layouts, allow
# override via the TESSERACT_CMD environment variable.
DEFAULT_TESSERACT_CANDIDATES = [
    os.environ.get("TESSERACT_CMD"),
    r"C:\msys64\mingw64\bin\tesseract.exe",
    r"C:\msys64\usr\bin\tesseract.exe",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "tesseract",  # fallback to PATH lookup
]
TESSERACT_CMD = next(
    (c for c in DEFAULT_TESSERACT_CANDIDATES if c and os.path.exists(c) or (c == "tesseract" and shutil.which("tesseract"))),
    None,
)
SETUP_HINT = (
    "Tesseract is required for OCR. Install it, e.g. on the MSYS2 environment:\n"
    "    pacman -S mingw-w64-x86_64-tesseract-ocr mingw-w64-x86_64-tesseract-data-eng\n"
    "or set TESSERACT_CMD to your tesseract.exe path (Windows)."
)

MAX_DIM = 1800  # cap longest edge before OCR to bound runtime


def _find_tesseract():
    if TESSERACT_CMD == "tesseract":
        return shutil.which("tesseract")
    return TESSERACT_CMD


class _TesseractBridge:
    """Thin lazy wrapper around pytesseract so the module imports cleanly
    even when neither pytesseract nor tesseract is installed."""

    def __init__(self):
        self._available = None
        self._module = None
        self._exe = None

    @property
    def available(self):
        if self._available is None:
            path = _find_tesseract()
            if path and os.path.exists(path):
                self._exe = path
                try:
                    import pytesseract  # noqa: F401
                    self._module = pytesseract
                    pytesseract.pytesseract.tesseract_cmd = path
                    self._available = True
                except Exception:
                    self._available = False
            else:
                self._available = False
        return self._available

    def run(self, engine_method, *args, **kwargs):
        if not self.available:
            raise OCRUnavailableError(SETUP_HINT)
        return self._module.pytesseract.__getattribute__(  # engine bound to tesseract_cmd
            engine_method.replace("image", "image").replace("get", "get")
        )(*args, **kwargs)


_engine = _TesseractBridge()


def get_version_info():
    """Return dict with tesseract version, path and installed languages."""
    if not _engine.available:
        return {
            "version": "none",
            "builtin": False,
            "path": _find_tesseract(),
            "languages": [],
            "available": False,
        }
    try:
        version = _engine.run("get_tesseract_version")
        langs = _engine.run("get_languages") if hasattr(_engine._module, "get_languages") else []
    except Exception:
        version, langs = "unknown", []
    return {
        "version": str(version).split("\n")[0] if version else "unknown",
        "builtin": True,
        "path": _engine._exe,
        "languages": sorted(langs),
        "available": True,
    }


def preprocess(image_bytes):
    """Return a preprocessed PNG blob ready for Tesseract."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img).convert("RGB")
    except Exception as exc:
        raise OCRProcessingError(f"Image could not be opened/decoded: {exc}") from exc

    # Upscale small images with high-quality filter
    w, h = img.size
    longest = max(w, h)
    if longest < 1100:
        scale = 1100 / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    elif longest > MAX_DIM:
        scale = MAX_DIM / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Grayscale
    img = img.convert("L")

    # Noise reduction
    img = img.filter(ImageFilter.MedianFilter(3))

    # Auto contrast + brightness boost for faint ink
    img = ImageOps.autocontrast(img, cutoff=2)
    img = ImageEnhance.Contrast(img).enhance(1.3)
    img = ImageEnhance.Sharpness(img).enhance(1.4)

    # Adaptive threshold: binarise on a local window to handle uneven light
    from PIL import ImageDraw
    arr = _to_array(img)
    binarised = _adaptive_threshold(arr)
    out = Image.fromarray(binarised, "L")

    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()


def _to_array(img):
    import numpy as np
    return np.array(img)


def _adaptive_threshold(gray):
    """Local-mean binarisation: ~ white background, black text."""
    import numpy as np
    h, w = gray.shape
    block = max(11, (min(h, w) // 24) | 1)  # nearest odd block
    if h <= block or w <= block:
        return (gray > 128).astype(np.uint8) * 255

    # Integral image for O(1) local means
    int_img = gray.astype(np.float64)
    integral = np.zeros((h + 1, w + 1), dtype=np.float64)
    integral[1:, 1:] = np.cumsum(np.cumsum(int_img, axis=0), axis=1)

    half = block // 2
    out = np.empty_like(gray, dtype=np.uint8)
    for y in range(h):
        y0 = max(0, y - half)
        y1 = min(h, y + half + 1)
        for x in range(w):
            x0 = max(0, x - half)
            x1 = min(w, x + half + 1)
            total = integral[y1, x1] - integral[y0, x1] - integral[y1, x0] + integral[y0, x0]
            count = (y1 - y0) * (x1 - x0)
            mean = total / count
            out[y, x] = 255 if gray[y, x] > mean - 8 else 0
    return out


def _detect_language(image_png):
    """Best-effort script detection via Tesseract's OSD. Returns list."""
    try:
        from pytesseract import pytesseract
        osd = pytesseract.image_to_osd(image_png, config="--oem 3 --psm 0")
        script = re.search(r"Script:\s*(\w+)", osd)
        return [script.group(1).lower().replace(" ", "") ] if script else []
    except Exception:
        return []


def extract_text(image_bytes, filename="upload.png", lang="eng"):
    """Run OCR and return {text, confidence, languages_detected, raw}."""
    png = preprocess(image_bytes)
    if not _engine.available:
        raise OCRUnavailableError(SETUP_HINT)

    langs_detected = _detect_language(png)
    requested = lang or "eng"

    try:
        raw = _engine.run("image_to_data", Image.open(io.BytesIO(png)), lang=requested,
                          config="--oem 3 --psm 6", output_type="dict")
    except OCRUnavailableError:
        raise
    except Exception as exc:
        raise OCRProcessingError(f"Tesseract OCR failed: {exc}") from exc

    # Assemble text + confidence from the _data dict
    conf_total, conf_count, words = 0, 0, []
    for level, text_piece, conf in zip(raw.get("level", []), raw.get("text", []), raw.get("conf", [])):
        tp = (text_piece or "").strip()
        if not tp:
            continue
        if not tp.isdigit():
            # Include recognized words
            pass
        words.append(conf)
    # Simpler: use image_to_string for the returned text to preserve line breaks
    try:
        full_text = _engine.run("image_to_string", Image.open(io.BytesIO(png)), lang=requested,
                                config="--oem 3 --psm 6")
    except Exception as exc:
        raise OCRProcessingError(f"Tesseract text extraction failed: {exc}") from exc

    text = (full_text or "").strip()
    # Per-word confidence from _data
    confidences = [int(c) for c in raw.get("conf", []) if str(c).lstrip("-").isdigit() and int(c) >= 0]
    confidence = round(sum(confidences) / len(confidences), 1) if confidences else 0.0

    return {
        "text": text,
        "confidence": confidence,
        "languages_detected": langs_detected,
        "raw": {"avg_word_conf": confidence, "word_conf_list": confidences[:50]},
    }
