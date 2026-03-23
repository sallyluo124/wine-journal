import { useState, useRef } from "react";
import "./WinePairing.css";

const FOOD_CATEGORIES = [
  { label: "Meat & Poultry", items: ["Steak", "Lamb Chops", "Roast Pork", "Chicken", "Duck", "Veal", "Beef Burger"] },
  { label: "Seafood",         items: ["Salmon", "Tuna", "Oysters", "Lobster", "White Fish", "Shellfish", "Sushi"] },
  { label: "Pasta & Pizza",   items: ["Tomato Pasta", "Cream Pasta", "Pizza", "Risotto", "Lasagna"] },
  { label: "Cheese",          items: ["Aged Cheddar", "Brie", "Blue Cheese", "Goat Cheese", "Parmesan", "Gruyère"] },
  { label: "Vegetables",      items: ["Mushrooms", "Asparagus", "Artichoke", "Roasted Vegetables", "Salad"] },
  { label: "Desserts",        items: ["Dark Chocolate", "Fruit Tart", "Cheesecake", "Crème Brûlée", "Tiramisu"] },
  { label: "Snacks & Boards", items: ["Charcuterie", "Olives", "Mixed Nuts", "Bruschetta"] },
  { label: "Cuisine Style",   items: ["Indian / Spicy", "Thai", "Japanese", "Mexican", "Middle Eastern", "French"] },
];

async function streamTo(endpoint, body, onChunk) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error();
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

function toggle(setter) {
  return (item) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item); else next.add(item);
      return next;
    });
}

function SelectedChips({ items, onRemove }) {
  if (!items.size) return null;
  return (
    <div className="pairing-selected">
      {[...items].map((item) => (
        <span key={item} className="pairing-chip">
          {item}
          <button type="button" className="pairing-chip-remove" onClick={() => onRemove(item)}>×</button>
        </span>
      ))}
    </div>
  );
}

function ScanBox({ label, preview, scanLoading, scanError, onFileChange, fileRef }) {
  return (
    <div className="scan-menu-box">
      <div className="scan-menu-box-label">{label}</div>
      <label className="scan-upload-btn scan-upload-btn--compact">
        {preview ? "Change" : "📷 Photo"}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </label>
      {preview && <img src={preview} className="scan-preview scan-preview--small" alt={`${label} preview`} />}
      {scanLoading && <p className="scan-status scan-status--loading">Scanning…</p>}
      {scanError   && <p className="scan-status scan-status--error">{scanError}</p>}
    </div>
  );
}

export default function WinePairing() {
  const [mode, setMode] = useState(null); // null | "scan" | "browse"

  // ── Scan mode state ──
  const [foodPreview,     setFoodPreview]     = useState(null);
  const [foodScanLoading, setFoodScanLoading] = useState(false);
  const [foodScanError,   setFoodScanError]   = useState("");
  const [foodMenuItems,   setFoodMenuItems]   = useState([]);

  const [winePreview,     setWinePreview]     = useState(null);
  const [wineScanLoading, setWineScanLoading] = useState(false);
  const [wineScanError,   setWineScanError]   = useState("");
  const [wineMenuItems,   setWineMenuItems]   = useState([]);

  const [selectedFoods, setSelectedFoods] = useState(new Set());
  const [scanResult,    setScanResult]    = useState("");
  const [scanLoading,   setScanLoading]   = useState(false);

  const foodFileRef = useRef(null);
  const wineFileRef = useRef(null);

  // ── Browse mode state ──
  const [browseSelected,  setBrowseSelected]  = useState(new Set());
  const [openCategories,  setOpenCategories]  = useState(new Set());
  const [browseResult,    setBrowseResult]    = useState("");
  const [browseLoading,   setBrowseLoading]   = useState(false);

  async function handleScan(e, endpoint, setPreview, setScanLoading, setScanError, setItems) {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await new Promise((res) => {
      const r = new FileReader();
      r.onload = (ev) => res(ev.target.result);
      r.readAsDataURL(file);
    });
    setPreview(dataUrl);
    setScanError("");
    setScanLoading(true);
    setItems([]);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl.split(",")[1], media_type: file.type }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      if (!data.items?.length) setScanError("No items found in this image.");
    } catch {
      setScanError("Could not scan — is the API running?");
    } finally {
      setScanLoading(false);
      e.target.value = "";
    }
  }

  async function handleMenuPairings() {
    setScanLoading(true);
    setScanResult("");
    try {
      await streamTo("/menu-pairings", {
        foods: [...selectedFoods],
        wines: wineMenuItems,
      }, (c) => setScanResult((p) => p + c));
    } catch {
      setScanResult("Could not load recommendations — is the API running?");
    } finally {
      setScanLoading(false);
    }
  }

  async function handleBrowsePairings() {
    setBrowseLoading(true);
    setBrowseResult("");
    try {
      await streamTo("/food-pairings", { foods: [...browseSelected] }, (c) =>
        setBrowseResult((p) => p + c));
    } catch {
      setBrowseResult("Could not load recommendations — is the API running?");
    } finally {
      setBrowseLoading(false);
    }
  }

  // ── Landing ──
  if (mode === null) {
    return (
      <div className="pairing-page">
        <div className="pairing-intro">
          <h2>Find Your Perfect Wine</h2>
          <p>Choose how you'd like to discover wines for your meal.</p>
        </div>
        <div className="pairing-options">
          <button className="pairing-option-card" onClick={() => setMode("scan")}>
            <span className="pairing-option-icon">📷</span>
            <span className="pairing-option-title">Scan Menus</span>
            <span className="pairing-option-desc">
              Photo the food menu and wine list — select your dishes and we'll pick the best wines from the list
            </span>
          </button>
          <button className="pairing-option-card" onClick={() => setMode("browse")}>
            <span className="pairing-option-icon">🍽️</span>
            <span className="pairing-option-title">Browse by Food</span>
            <span className="pairing-option-desc">Pick from food categories to find your ideal wine</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Scan Menus ──
  if (mode === "scan") {
    return (
      <div className="pairing-page">
        <button className="pairing-back-btn" onClick={() => setMode(null)}>← Back</button>
        <div className="pairing-intro">
          <h2>Scan Menus</h2>
          <p>Photograph both menus, then select your dishes.</p>
        </div>

        {/* Step 1: scan both */}
        <div className="scan-menus-grid">
          <ScanBox
            label="Food Menu"
            preview={foodPreview}
            scanLoading={foodScanLoading}
            scanError={foodScanError}
            fileRef={foodFileRef}
            onFileChange={(e) => handleScan(e, "/scan-menu", setFoodPreview, setFoodScanLoading, setFoodScanError, setFoodMenuItems)}
          />
          <ScanBox
            label="Wine List"
            preview={winePreview}
            scanLoading={wineScanLoading}
            scanError={wineScanError}
            fileRef={wineFileRef}
            onFileChange={(e) => handleScan(e, "/scan-wine-menu", setWinePreview, setWineScanLoading, setWineScanError, setWineMenuItems)}
          />
        </div>

        {/* Step 2: select food items */}
        {foodMenuItems.length > 0 && (
          <div className="scan-food-select">
            <p className="scan-results-label">Select your dishes</p>
            <div className="pairing-food-grid pairing-food-grid--scan">
              {foodMenuItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`pairing-food-tag ${selectedFoods.has(item) ? "active" : ""}`}
                  onClick={() => toggle(setSelectedFoods)(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        <SelectedChips items={selectedFoods} onRemove={toggle(setSelectedFoods)} />

        {wineMenuItems.length > 0 && (
          <p className="wine-list-ref">🍷 {wineMenuItems.length} wine{wineMenuItems.length > 1 ? "s" : ""} on list</p>
        )}

        {foodMenuItems.length > 0 && (
          <button
            className="pairing-btn-find"
            onClick={handleMenuPairings}
            disabled={selectedFoods.size === 0 || scanLoading}
          >
            {scanLoading
              ? "Finding wines…"
              : selectedFoods.size === 0
              ? "Select dishes above"
              : wineMenuItems.length > 0
              ? `Find best wines from the list for ${selectedFoods.size} dish${selectedFoods.size > 1 ? "es" : ""}`
              : `Find wines for ${selectedFoods.size} dish${selectedFoods.size > 1 ? "es" : ""}`}
          </button>
        )}

        {scanResult && <div className="pairing-result">{scanResult}</div>}
      </div>
    );
  }

  // ── Browse by Food ──
  if (mode === "browse") {
    return (
      <div className="pairing-page">
        <button className="pairing-back-btn" onClick={() => setMode(null)}>← Back</button>
        <div className="pairing-intro">
          <h2>Browse by Food</h2>
          <p>Open a category and select what you're eating to get wine recommendations.</p>
        </div>

        <SelectedChips items={browseSelected} onRemove={toggle(setBrowseSelected)} />

        <div className="pairing-categories">
          {FOOD_CATEGORIES.map(({ label, items }) => {
            const count = items.filter((i) => browseSelected.has(i)).length;
            const open  = openCategories.has(label);
            return (
              <div key={label} className="pairing-category">
                <button
                  type="button"
                  className={`pairing-cat-btn ${open ? "pairing-cat-btn--open" : ""}`}
                  onClick={() => toggle(setOpenCategories)(label)}
                >
                  {label}
                  {count > 0 && <span className="pairing-cat-count">{count}</span>}
                  <span className="pairing-cat-chevron">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="pairing-food-grid">
                    {items.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`pairing-food-tag ${browseSelected.has(item) ? "active" : ""}`}
                        onClick={() => toggle(setBrowseSelected)(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          className="pairing-btn-find"
          onClick={handleBrowsePairings}
          disabled={browseSelected.size === 0 || browseLoading}
        >
          {browseLoading
            ? "Finding wines…"
            : browseSelected.size === 0
            ? "Select foods above to get started"
            : `Find wines for ${browseSelected.size} item${browseSelected.size > 1 ? "s" : ""}`}
        </button>

        {browseResult && <div className="pairing-result">{browseResult}</div>}
      </div>
    );
  }
}
