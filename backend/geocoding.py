import asyncio
import csv
import io

import httpx

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
_semaphore = asyncio.Semaphore(10)


async def geocode_address(
    client: httpx.AsyncClient, address: str, api_key: str
) -> dict:
    """Geocode a single address using Google Geocoding API."""
    async with _semaphore:
        resp = await client.get(
            GEOCODE_URL, params={"address": address, "key": api_key}
        )
        resp.raise_for_status()
        data = resp.json()

    if data["status"] != "OK" or not data["results"]:
        raise ValueError(f"Geocoding failed for '{address}': {data['status']}")

    result = data["results"][0]
    loc = result["geometry"]["location"]
    return {
        "address": address,
        "formatted_address": result["formatted_address"],
        "lat": loc["lat"],
        "lng": loc["lng"],
    }


async def geocode_entries(
    entries: list[dict], api_key: str
) -> list[dict]:
    """Geocode a list of address entries concurrently with rate limiting.
    Each entry is {address, title, description}."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [geocode_address(client, e["address"], api_key) for e in entries]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    geocoded = []
    errors = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            errors.append({"address": entries[i]["address"], "error": str(result)})
        else:
            result["title"] = entries[i].get("title", "")
            result["description"] = entries[i].get("description", "")
            geocoded.append(result)

    return {"geocoded": geocoded, "errors": errors}


def parse_csv_addresses(content: str) -> list[dict]:
    """Extract addresses (with optional title/description) from CSV content."""
    reader = csv.DictReader(io.StringIO(content))

    # Find columns (case-insensitive)
    address_col = None
    title_col = None
    desc_col = None
    if reader.fieldnames:
        for col in reader.fieldnames:
            lower = col.strip().lower()
            if lower in ("address", "addr", "location", "street"):
                address_col = col
            elif lower in ("title", "name"):
                title_col = col
            elif lower in ("description", "desc", "notes"):
                desc_col = col

    if address_col is None:
        if reader.fieldnames:
            address_col = reader.fieldnames[0]
        else:
            raise ValueError("CSV has no columns")

    entries = []
    for row in reader:
        val = row[address_col].strip()
        if val:
            entry = {
                "address": val,
                "title": row.get(title_col, "").strip() if title_col else "",
                "description": row.get(desc_col, "").strip() if desc_col else "",
            }
            entries.append(entry)

    if not entries:
        raise ValueError("No addresses found in CSV")

    return entries
