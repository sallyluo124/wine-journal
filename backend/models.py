from pydantic import BaseModel
from typing import Optional
from datetime import date


class TastingEntry(BaseModel):
    id: Optional[int] = None
    wine_name: str
    producer: str
    vintage: Optional[int] = None
    color: str  # red | white | rosé | orange | sparkling
    aromas: list[str]
    acidity: int    # 1–5
    tannin: int     # 1–5
    body: int       # 1–5
    alcohol: int    # 1–5
    rating: int     # 1–5
    notes: str = ""
    tasted_on: date = date.today()
    country: str = ""
    region: str = ""
    village: str = ""
    grapes: list[str] = []
