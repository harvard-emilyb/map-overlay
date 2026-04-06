import json
import os
import re
import uuid

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from PIL import Image

from backend.geocoding import geocode_address, geocode_entries, parse_csv_addresses
from backend.models import AddressInput, TransformRequest, TransformResponse, TransformedPoint
from backend.transform import apply_transform, compute_affine_coefficients

load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

UPLOAD_DIR = "static/uploads"
SAVED_DIR = "static/saved"
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB
MAX_SAVE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAP_ID_RE = re.compile(r"^[a-f0-9]{10}$")


def get_api_key() -> str:
    key = os.getenv("GOOGLE_API_KEY")
    if not key or key == "your-google-api-key-here":
        raise HTTPException(status_code=500, detail="Google API key not configured")
    return key


def validate_map_id(map_id: str) -> str:
    if not MAP_ID_RE.match(map_id):
        raise HTTPException(status_code=400, detail="Invalid map ID")
    return map_id


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    api_key = os.getenv("GOOGLE_API_KEY", "")
    return templates.TemplateResponse("index.html", {"request": request, "api_key": api_key})


@app.post("/api/upload-map")
async def upload_map(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed. Use JPG, PNG, GIF, or WebP.")

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 50MB.")

    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(content)

    img = Image.open(filepath)
    width, height = img.size

    return {
        "url": f"/static/uploads/{filename}",
        "width": width,
        "height": height,
    }


@app.post("/api/geocode")
async def geocode_single(input: AddressInput):
    api_key = get_api_key()
    async with httpx.AsyncClient(timeout=30.0) as client:
        result = await geocode_address(client, input.address, api_key)
    return result


@app.post("/api/geocode-csv")
async def geocode_csv(file: UploadFile = File(...)):
    api_key = get_api_key()

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    entries = parse_csv_addresses(text)
    results = await geocode_entries(entries, api_key)
    return results


@app.post("/api/transform", response_model=TransformResponse)
async def transform(req: TransformRequest):
    if len(req.control_points) < 3:
        raise HTTPException(status_code=400, detail="Need at least 3 control points")

    try:
        coeffs = compute_affine_coefficients(req.control_points)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    points = []
    for loc in req.locations:
        px, py = apply_transform(coeffs, loc.lat, loc.lng)
        points.append(TransformedPoint(
            address=loc.address,
            formatted_address=loc.formatted_address,
            lat=loc.lat,
            lng=loc.lng,
            px=px,
            py=py,
        ))

    return TransformResponse(
        points=points,
        x_residual=coeffs["x_residual"],
        y_residual=coeffs["y_residual"],
    )


@app.post("/api/save")
async def save_map(request: Request):
    body = await request.body()
    if len(body) > MAX_SAVE_SIZE:
        raise HTTPException(status_code=400, detail="Save data too large")

    data = json.loads(body)
    map_id = uuid.uuid4().hex[:10]
    filepath = os.path.join(SAVED_DIR, f"{map_id}.json")
    with open(filepath, "w") as f:
        json.dump(data, f)

    return {"id": map_id}


@app.get("/api/saved/{map_id}")
async def get_saved(map_id: str):
    validate_map_id(map_id)
    filepath = os.path.join(SAVED_DIR, f"{map_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Map not found")

    with open(filepath) as f:
        data = json.load(f)
    return data


@app.get("/view/{map_id}", response_class=HTMLResponse)
async def view_map(request: Request, map_id: str):
    validate_map_id(map_id)
    filepath = os.path.join(SAVED_DIR, f"{map_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Map not found")

    return templates.TemplateResponse("view.html", {"request": request, "map_id": map_id})
