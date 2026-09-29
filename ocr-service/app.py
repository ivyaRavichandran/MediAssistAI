#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MediAssist AI - Python OCR Service
==================================
Processes prescription images with Tesseract OCR. Preprocesses the image
(grayscale, sharpening, upscaling, contrast normalisation, binarisation)
to maximise recognition accuracy, then returns the extracted text plus a
confidence score.

Run:
    pip install -r requirements.txt
    python app.py                (serves on port 5001, override with PORT)
    python app.py --port 5002    (custom port)

Endpoints:
    GET  /api/ocr/health          - service + tesseract availability + langs
    GET  /api/ocr/languages       - installed tesseract languages
    POST /api/ocr/process         - multipart "file" field -> {text, confidence}
"""

import io
import os
import logging

from flask import Flask, request, jsonify
from flask_cors import CORS

import ocr_engine

HOST = os.environ.get("OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("OCR_PORT", "5001"))
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "pdf"}

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("mediassist-ocr")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE
CORS(app)


@app.get("/api/ocr/health")
def health():
    info = ocr_engine.get_version_info()
    return jsonify({
        "status": "ok",
        "service": "MediAssist AI Python OCR",
        "method": "python-tesseract",
        "engine": info.get("engine", "tesseract"),
        "version": info.get("version", "unknown"),
        "tesseract_path": info.get("path"),
        "tesseract_available": True,
        "languages": info.get("languages", []),
        "preprocessing": ["grayscale", "sharpen", "upscale", "contrast", "binarise"]
    })


@app.get("/api/ocr/languages")
def languages():
    info = ocr_engine.get_version_info()
    return jsonify({"langs": info.get("languages", []), "default": "eng"})


@app.post("/api/ocr/process")
def process():
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No 'file' field in request", "code": "NO_FILE"}), 400

    upload = request.files["file"]
    if not upload or not upload.filename:
        return jsonify({"success": False, "error": "Empty file upload", "code": "EMPTY_FILE"}), 400

    data = upload.read()
    if not data:
        return jsonify({"success": False, "error": "File is empty", "code": "EMPTY_FILE"}), 400

    ext = upload.filename.rsplit(".", 1)[-1].lower() if "." in upload.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({
            "success": False,
            "error": "Unsupported file type",
            "code": "BAD_EXTENSION",
            "allowed": sorted(ALLOWED_EXTENSIONS)
        }), 415

    requested_lang = (request.form.get("lang") or "eng").strip()
    try:
        result = ocr_engine.extract_text(data, filename=upload.filename, lang=requested_lang)
    except ocr_engine.OCRUnavailableError as exc:
        return jsonify({"success": False, "error": str(exc), "code": "OCR_UNAVAILABLE", "hint": ocr_engine.SETUP_HINT}), 503
    except ocr_engine.OCRProcessingError as exc:
        logger.error("OCR processing failed: %s", exc)
        return jsonify({"success": False, "error": str(exc), "code": "OCR_PROCESSING_ERROR"}), 422
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected OCR failure")
        return jsonify({"success": False, "error": f"OCR internal error: {exc}", "code": "OCR_INTERNAL_ERROR"}), 500

    text = result.get("text", "")
    logger.info(
        "OCR complete: %d chars, %d words, lang=%s, confidence=%.1f%%",
        text and len(text), text and len(text.split()),
        result.get("language", "eng"), result.get("confidence", 0)
    )

    payload = {
        "success": True,
        "text": text,
        "confidence": round(result.get("confidence", 0), 1),
        "language": result.get("language", "eng"),
        "method": "python-tesseract",
        "engine": "tesseract",
        "preprocessed": True,
        "char_count": len(text) if text else 0,
        "word_count": len(text.split()) if text else 0,
        "languages_detected": result.get("languages_detected", [])
    }
    return jsonify(payload)


@app.errorhandler(413)
def file_too_large(_err):
    return jsonify({"success": False, "error": "File exceeds 10MB limit", "code": "FILE_TOO_LARGE"}), 413


@app.errorhandler(415)
def unsupported_media(_err):
    return jsonify({"success": False, "error": "Unsupported media type", "code": "BAD_EXTENSION"}), 415


@app.errorhandler(404)
def not_found(_err):
    return jsonify({"success": False, "error": "Route not found", "code": "NOT_FOUND"}), 404


@app.errorhandler(500)
def server_error(_err):
    return jsonify({"success": False, "error": "Internal server error", "code": "INTERNAL"}), 500


if __name__ == "__main__":
    logger.info("Starting MediAssist AI OCR service on http://%s:%d", HOST, PORT)
    app.run(host=HOST, port=PORT, threaded=True)
