from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from models import TastingEntry
import database
import json
import os
import anthropic

app = FastAPI(title="Wine Journal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

database.init_db()


def get_client():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not set")
    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


def strip_code_fences(text: str) -> str:
    if "```" in text:
        return "\n".join(l for l in text.splitlines() if not l.startswith("```"))
    return text


@app.post("/tastings", response_model=TastingEntry, status_code=201)
def create_tasting(entry: TastingEntry):
    return database.insert_tasting(entry)


@app.get("/tastings", response_model=list[TastingEntry])
def list_tastings():
    return database.fetch_all()


@app.get("/tastings/{tasting_id}", response_model=TastingEntry)
def get_tasting(tasting_id: int):
    entry = database.fetch_one(tasting_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Tasting not found")
    return entry


@app.patch("/tastings/{tasting_id}", response_model=TastingEntry)
def update_tasting(tasting_id: int, entry: TastingEntry):
    result = database.update_tasting(tasting_id, entry)
    if not result:
        raise HTTPException(status_code=404, detail="Tasting not found")
    return result


@app.delete("/tastings/{tasting_id}", status_code=204)
def delete_tasting(tasting_id: int):
    if not database.delete_tasting(tasting_id):
        raise HTTPException(status_code=404, detail="Tasting not found")


@app.get("/lookup")
def lookup_wine(wine_name: str = Query(...), producer: str = Query(...)):
    try:
        client = get_client()
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": (
                    f'Wine: "{wine_name}", Producer: "{producer}". '
                    'Reply with ONLY a JSON object with keys "country", "region", "village", "grapes". '
                    '"grapes" is a list of grape variety names (e.g. ["Cabernet Sauvignon","Merlot"]). '
                    'Use the appellation/village name for "village". '
                    'Use "" for unknown string fields, [] for unknown grapes. '
                    'Example: {"country":"France","region":"Bordeaux","village":"Margaux","grapes":["Cabernet Sauvignon","Merlot","Cabernet Franc"]}'
                ),
            }],
        )
        text = strip_code_fences(response.content[0].text.strip())
        data = json.loads(text)
        return {
            "country": str(data.get("country", "")),
            "region":  str(data.get("region",  "")),
            "village": str(data.get("village", "")),
            "grapes":  [str(g) for g in data.get("grapes", [])],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


AROMA_OPTIONS = [
    "Black Cherry", "Cherry", "Raspberry", "Strawberry", "Plum", "Blackcurrant",
    "Citrus", "Lemon", "Grapefruit", "Green Apple", "Peach", "Apricot", "Pineapple",
    "Violet", "Rose", "Jasmine", "Elderflower", "Honey",
    "Mushroom", "Tobacco", "Leather", "Truffle", "Wet Stone", "Pepper", "Dried Leaves",
    "Herbs", "Eucalyptus", "Grass",
    "Vanilla", "Toasted Oak", "Cedar", "Smoke", "Cocoa", "Butter", "Toast",
]


@app.get("/detect")
def detect_wine_profile(
    wine_name: str = Query(...),
    producer: str = Query(""),
    country: str = Query(""),
    region: str = Query(""),
    grapes: str = Query(""),
):
    try:
        client = get_client()
        parts = [f'Wine: "{wine_name}"']
        if producer: parts.append(f'Producer: "{producer}"')
        origin = ", ".join(filter(None, [region, country]))
        if origin: parts.append(f'Origin: {origin}')
        if grapes: parts.append(f'Grapes: {grapes}')
        parts.append(
            f'Available aromas: {json.dumps(AROMA_OPTIONS)}. '
            'Reply with ONLY a JSON object with keys: '
            '"aromas" (array of 3–6 from the available list that best describe this wine), '
            '"acidity" (1–5 int), "tannin" (1–5 int), "body" (1–5 int), "alcohol" (1–5 int). '
            'Use typical values for this wine style. No explanation.'
        )
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": " ".join(parts)}],
        )
        text = strip_code_fences(response.content[0].text.strip())
        data = json.loads(text)
        valid = set(AROMA_OPTIONS)
        return {
            "aromas":  [a for a in data.get("aromas", []) if a in valid],
            "acidity": max(1, min(5, int(data.get("acidity", 3)))),
            "tannin":  max(1, min(5, int(data.get("tannin", 3)))),
            "body":    max(1, min(5, int(data.get("body", 3)))),
            "alcohol": max(1, min(5, int(data.get("alcohol", 3)))),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pairings")
def get_pairings(data: dict):
    wine_name = data.get("wine_name", "Unknown wine")
    producer  = data.get("producer", "")
    color     = data.get("color", "")
    country   = data.get("country", "")
    region    = data.get("region", "")
    aromas    = data.get("aromas", [])
    acidity   = int(data.get("acidity", 3))
    tannin    = int(data.get("tannin", 3))
    body      = int(data.get("body", 3))
    alcohol   = int(data.get("alcohol", 3))

    def level(v): return "low" if v <= 2 else "high" if v >= 4 else "medium"

    lines = [f"Wine: {wine_name}"]
    if producer: lines.append(f"Producer: {producer}")
    if color:    lines.append(f"Style: {color}")
    origin = ", ".join(filter(None, [region, country]))
    if origin:   lines.append(f"Origin: {origin}")
    grapes = data.get("grapes", [])
    if grapes:   lines.append(f"Grapes: {', '.join(grapes)}")
    if aromas:   lines.append(f"Aromas: {', '.join(aromas)}")
    lines.append(
        f"Structure: acidity {level(acidity)}, tannin {level(tannin)}, "
        f"body {level(body)}, alcohol {level(alcohol)}"
    )
    lines.append(
        "\nRecommend 5–6 specific food pairings for this wine. "
        "Be concise and precise — name actual dishes, not just categories. "
        "Format as a short bullet list. No preamble."
    )

    prompt = "\n".join(lines)

    def stream():
        client = get_client()
        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        ) as s:
            for text in s.text_stream:
                yield text

    return StreamingResponse(stream(), media_type="text/plain")


@app.post("/scan-label")
def scan_label(data: dict):
    image_data = data.get("image")
    media_type = data.get("media_type", "image/jpeg")
    if not image_data:
        raise HTTPException(status_code=400, detail="No image provided")
    try:
        client = get_client()
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_data},
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a wine bottle label or wine menu entry. "
                            "Extract the wine information. "
                            'Reply with ONLY a JSON object with keys: '
                            '"wine_name", "producer", "vintage", "country", "region", "village", "grapes". '
                            '"grapes" is an array of grape variety names. '
                            '"vintage" is an integer year or null. '
                            'Use "" for unknown strings, [] for unknown grapes, null for unknown vintage. '
                            'Example: {"wine_name":"Pommard Les Rugiens","producer":"Domaine Lejeune",'
                            '"vintage":2018,"country":"France","region":"Burgundy","village":"Pommard",'
                            '"grapes":["Pinot Noir"]}'
                        ),
                    },
                ],
            }],
        )
        text = strip_code_fences(response.content[0].text.strip())
        d = json.loads(text)
        return {
            "wine_name": str(d.get("wine_name", "")),
            "producer":  str(d.get("producer",  "")),
            "vintage":   d.get("vintage"),
            "country":   str(d.get("country",   "")),
            "region":    str(d.get("region",    "")),
            "village":   str(d.get("village",   "")),
            "grapes":    [str(g) for g in d.get("grapes", [])],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scan-menu")
def scan_menu(data: dict):
    image_data = data.get("image")
    media_type = data.get("media_type", "image/jpeg")
    if not image_data:
        raise HTTPException(status_code=400, detail="No image provided")
    try:
        client = get_client()
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_data},
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a food or wine menu. Extract all food dishes and items listed. "
                            "Return ONLY a JSON array of strings, each a concise dish or food item name. "
                            'Example: ["Grilled Salmon", "Beef Tenderloin", "Caesar Salad"]. '
                            "No explanation, no other text."
                        ),
                    },
                ],
            }],
        )
        text = strip_code_fences(response.content[0].text.strip())
        items = json.loads(text)
        return {"items": [str(i) for i in items if i]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/scan-wine-menu")
def scan_wine_menu(data: dict):
    image_data = data.get("image")
    media_type = data.get("media_type", "image/jpeg")
    if not image_data:
        raise HTTPException(status_code=400, detail="No image provided")
    try:
        client = get_client()
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_data},
                    },
                    {
                        "type": "text",
                        "text": (
                            "This is a wine list or wine menu. Extract all wines listed. "
                            "Return ONLY a JSON array of strings, each being a wine name "
                            "(include producer and vintage if shown). "
                            'Example: ["Château Margaux 2018", "Puligny-Montrachet 2020"]. '
                            "No explanation, no other text."
                        ),
                    },
                ],
            }],
        )
        text = strip_code_fences(response.content[0].text.strip())
        items = json.loads(text)
        return {"items": [str(i) for i in items if i]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/wine-food-pairings")
def wine_food_pairings(data: dict):
    wines = data.get("wines", [])
    if not wines:
        raise HTTPException(status_code=400, detail="No wines provided")
    wine_list = ", ".join(wines)
    prompt = (
        f"I'm looking at a wine list and considering: {wine_list}.\n\n"
        "For each wine, briefly describe its style and suggest 3–4 ideal food pairings. "
        "Be specific — name actual dishes. Format as a numbered list by wine. No preamble."
    )

    def stream():
        client = get_client()
        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        ) as s:
            for text in s.text_stream:
                yield text

    return StreamingResponse(stream(), media_type="text/plain")


@app.post("/menu-pairings")
def menu_pairings(data: dict):
    foods = data.get("foods", [])
    wines = data.get("wines", [])
    if not foods:
        raise HTTPException(status_code=400, detail="No foods provided")

    food_list = ", ".join(foods)
    if wines:
        wine_list = ", ".join(wines)
        prompt = (
            f"I'm ordering these dishes: {food_list}.\n\n"
            f"The wine list available is:\n{wine_list}\n\n"
            "From this wine list, recommend the 2–3 best matches for my meal. "
            "For each recommendation:\n"
            "- State the wine name exactly as it appears on the list\n"
            "- Explain in 1–2 sentences why it works with the dishes\n\n"
            "If no wine is a strong match, name the closest option and explain. "
            "Format as a numbered list. No preamble."
        )
    else:
        prompt = (
            f"I'm ordering: {food_list}.\n\n"
            "Recommend 3–4 wines that would pair well. "
            "For each: state the wine style and why it works. "
            "Format as a numbered list. No preamble."
        )

    def stream():
        client = get_client()
        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        ) as s:
            for text in s.text_stream:
                yield text

    return StreamingResponse(stream(), media_type="text/plain")


@app.post("/food-pairings")
def food_pairings(data: dict):
    foods = data.get("foods", [])
    if not foods:
        raise HTTPException(status_code=400, detail="No foods provided")

    food_list = ", ".join(foods)
    prompt = (
        f"I'm planning a meal featuring: {food_list}.\n\n"
        "Recommend 4–5 specific wines that pair beautifully with this selection. "
        "For each wine:\n"
        "- State the grape variety and wine style (e.g. 'Burgundy Pinot Noir')\n"
        "- Explain in 1–2 sentences why it works with these flavors\n"
        "- Mention a region or producer to look for\n\n"
        "Be specific and practical. Format as a numbered list. No preamble."
    )

    def stream():
        client = get_client()
        with client.messages.stream(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        ) as s:
            for text in s.text_stream:
                yield text

    return StreamingResponse(stream(), media_type="text/plain")
