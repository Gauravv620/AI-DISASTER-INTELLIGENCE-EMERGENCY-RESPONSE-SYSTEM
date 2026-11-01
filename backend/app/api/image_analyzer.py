import os
from io import BytesIO
from functools import lru_cache

# Prefer PyTorch backend; prevent transformers from importing TensorFlow
# at module load time which causes a pyparsing/httplib2 version conflict.
os.environ.setdefault("USE_TORCH", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, UnidentifiedImageError

# NOTE: `transformers` is imported lazily inside get_classifier() below
# so that the FastAPI server starts up cleanly even when TensorFlow
# has a dependency conflict (httplib2 / pyparsing version mismatch).

router = APIRouter(tags=["AI Disaster Image Analyzer"])

MAX_IMAGE_SIZE = 10 * 1024 * 1024

CANDIDATE_LABELS = [
    # ── Landslide / Rockfall ───────────────────────────────────────────────
    "photograph of a hillside landslide with soil and rocks sliding down a steep mountain slope covered with trees",
    "photograph of a mudslide or debris flow with thick mud and boulders covering a road or village",
    # ── Flood ─────────────────────────────────────────────────────────────
    "aerial photograph of a flood disaster with houses, cars and streets completely submerged under brown murky water",
    "photograph of a river overflowing its banks flooding a town with muddy brown water covering buildings and vehicles",
    # ── Earthquake ────────────────────────────────────────────────────────
    "photograph of a building collapsed by earthquake showing exposed concrete rubble, broken walls, twisted rebar and dust cloud",
    "photograph of earthquake damage with cracked concrete foundations, fallen structural columns and people searching debris",
    # ── Wildfire ──────────────────────────────────────────────────────────
    "photograph of a wildfire with bright orange and red flames burning through a forest or grassland with thick black smoke",
    # ── Cyclone ───────────────────────────────────────────────────────────
    "satellite image of a large tropical cyclone or hurricane showing a distinct circular eye wall and spiral rain bands over the ocean",
    # ── Thunderstorm / Lightning ──────────────────────────────────────────
    "photograph of a single bright lightning bolt striking the ground from storm clouds during a thunderstorm at night",
    # ── Drought ───────────────────────────────────────────────────────────
    "photograph of a drought-affected field with severely dry cracked earth, dead crops and parched barren soil under harsh sunlight",
    # ── No disaster ───────────────────────────────────────────────────────
    "photograph of a peaceful green landscape or ordinary city street without any damage, flooding, fire or disaster",
]


@lru_cache(maxsize=1)
def get_classifier():
    # Lazy import — only runs when the first image is submitted,
    # not at server startup. Prevents the TensorFlow import chain
    # from crashing the server due to the httplib2/pyparsing conflict.
    from transformers import pipeline  # noqa: PLC0415
    return pipeline(
        task="zero-shot-image-classification",
        model="openai/clip-vit-base-patch32",
    )


def classify_image(image: Image.Image):
    predictions = get_classifier()(
        image,
        candidate_labels=CANDIDATE_LABELS,
    )

    predictions = sorted(
        predictions,
        key=lambda item: item["score"],
        reverse=True,
    )

    top = predictions[0]
    second_score = predictions[1]["score"] if len(predictions) > 1 else 0.0

    label_map = {
        CANDIDATE_LABELS[0]: "POSSIBLE_LANDSLIDE",
        CANDIDATE_LABELS[1]: "POSSIBLE_LANDSLIDE",
        CANDIDATE_LABELS[2]: "POSSIBLE_FLOOD",
        CANDIDATE_LABELS[3]: "POSSIBLE_FLOOD",
        CANDIDATE_LABELS[4]: "POSSIBLE_EARTHQUAKE_DAMAGE",
        CANDIDATE_LABELS[5]: "POSSIBLE_EARTHQUAKE_DAMAGE",
        CANDIDATE_LABELS[6]: "POSSIBLE_WILDFIRE",
        CANDIDATE_LABELS[7]: "POSSIBLE_CYCLONE",
        CANDIDATE_LABELS[8]: "POSSIBLE_THUNDERSTORM",
        CANDIDATE_LABELS[9]: "POSSIBLE_DROUGHT",
        CANDIDATE_LABELS[10]: "NO_CLEAR_DISASTER_EVIDENCE",
    }

    uncertain = top["score"] < 0.25 or (
        top["score"] - second_score < 0.03
    )

    top_score = round(float(top["score"]), 4)

    return {
        "predicted_category": label_map.get(
            top["label"], "UNCLASSIFIED"
        ),
        "matched_description": top["label"],
        "model_score": top_score,
        "confidence_score": top_score,
        "secondary_category": label_map.get(
            predictions[1]["label"], "UNCLASSIFIED"
        ) if len(predictions) > 1 else None,
        "secondary_score": round(float(second_score), 4),
        "review_required": bool(uncertain),
        "predictions": [
            {
                "description": item["label"],
                "score": round(float(item["score"]), 4),
                "category": label_map.get(item["label"], "OTHER"),
            }
            for item in predictions[:5]
        ],
        "model": "openai/clip-vit-base-patch32",
        "disclaimer": (
            "Experimental zero-shot image classification. Scores indicate CLIP "
            "semantic similarity. Must be verified by emergency responders."
        ),
    }


@router.post("/image-analyzer/analyze")
@router.post("/image-analyzer/classify")
async def analyze_disaster_image(
    file: UploadFile = File(...),
):
    allowed_types = {"image/jpeg", "image/png", "image/webp"}

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail="Upload a JPEG, PNG, or WebP image.",
        )

    contents = await file.read(MAX_IMAGE_SIZE + 1)

    if not contents:
        raise HTTPException(status_code=400, detail="The image is empty.")

    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image size must not exceed 10 MB.",
        )

    try:
        image = Image.open(BytesIO(contents))
        image.verify()

        image = Image.open(BytesIO(contents)).convert("RGB")

        if image.width * image.height > 20_000_000:
            raise HTTPException(
                status_code=413,
                detail="Image dimensions are too large.",
            )

    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid supported image.",
        )

    try:
        result = await run_in_threadpool(classify_image, image)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "The image model could not run. Check the backend logs "
                "and model download availability."
            ),
        ) from exc
    finally:
        await file.close()
