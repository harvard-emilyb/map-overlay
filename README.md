# Map Overlay

A web application for plotting locations onto historical map images. Upload an old map, align it to real-world coordinates using control points, then geocode addresses and see them placed on the historical map.

## Features

- **Upload historical maps** -- JPG, PNG, GIF, or WebP up to 50MB
- **Guided control point wizard** -- align your map to real-world coordinates by clicking matching landmarks on the historical map and Google Maps (minimum 3 points)
- **Geocode addresses** -- enter manually or upload a CSV with address, title, and description columns
- **Customizable markers** -- pick color and size with a live preview
- **Per-location labels** -- toggle address name and lat/long display for each marker
- **Download** -- export the map with markers as a full-resolution PNG
- **Save & share** -- generate a shareable link for a read-only view of your map
- **Docker ready** -- deploy anywhere with Docker

## Prerequisites

- Python 3.9+
- A Google Cloud API key with these APIs enabled:
  - **Maps JavaScript API**
  - **Geocoding API**
  - **Places API**

## Installation

```bash
# Clone the repo
git clone https://github.com/harvard-emilyb/map-overlay.git
cd map-overlay

# Create a virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Add your Google API key
cp .env.example .env
# Edit .env and set GOOGLE_API_KEY=your-key-here
```

## Running

```bash
source .venv/bin/activate
uvicorn app:app --reload
```

Open http://localhost:8000 in your browser.

## Running with Docker

```bash
# Make sure your .env file has GOOGLE_API_KEY set, then:
docker compose up -d --build
```

The app will be available at http://localhost:8000.

## Usage

1. **Upload** a historical map image
2. **Set control points** -- click a recognizable landmark on the historical map, then click the same spot on Google Maps. Repeat at least 3 times with non-collinear points. You can remove and redo any point.
3. **Add addresses** -- type them one at a time (with optional title and description) or upload a CSV. Download a CSV template from the app.
4. **View map** -- switch to the map view to see your locations plotted. Toggle labels and coordinates per location.
5. **Download or share** -- export as PNG or save and get a shareable link.

## CSV Format

The CSV should have an `address` column. `title` and `description` columns are optional.

```csv
address,title,description
"123 Main St, Boston, MA",Old Library,Built in 1893
"456 Oak Ave, Cambridge, MA",Town Hall,Renovated 1920
```

## Project Structure

```
map-overlay/
  app.py              # FastAPI application and API endpoints
  backend/
    geocoding.py      # Google Geocoding API integration
    transform.py      # Affine transformation (numpy)
    models.py         # Pydantic request/response models
  static/
    css/style.css     # Styles
    js/               # Frontend modules (app, maps, control points, geocoding)
    uploads/          # Uploaded map images
    saved/            # Saved map JSON files
  templates/
    index.html        # Main application page
    view.html         # Shared read-only view page
```
