import { useState, useEffect, useRef } from "react";
import "./TastingForm.css";

const COLORS = ["Red", "White", "Rosé", "Orange", "Sparkling"];

const RED_SHADES = [
  { key: "ruby",   label: "Ruby",   hex: "#a31515" },
  { key: "garnet", label: "Garnet", hex: "#6b1a1a" },
  { key: "purple", label: "Purple", hex: "#6b2d8b" },
  { key: "brick",  label: "Brick",  hex: "#b5451b" },
];

const WHITE_SHADES = [
  { key: "pale straw", label: "Pale Straw", hex: "#f9f4c8", dark: true },
  { key: "straw",      label: "Straw",      hex: "#e8d060", dark: true },
  { key: "yellow",     label: "Yellow",     hex: "#c8aa00", dark: true },
  { key: "gold",       label: "Gold",       hex: "#c8960c", dark: true },
  { key: "amber",      label: "Amber",      hex: "#c87820" },
];

const RED_KEYS   = new Set(["red",   ...RED_SHADES.map((s) => s.key)]);
const WHITE_KEYS = new Set(["white", ...WHITE_SHADES.map((s) => s.key)]);

function colorFamily(color) {
  if (RED_KEYS.has(color))   return "red";
  if (WHITE_KEYS.has(color)) return "white";
  return color;
}

const AROMA_CATEGORIES = [
  { label: "Fruit",   aromas: ["Black Cherry", "Cherry", "Raspberry", "Strawberry", "Plum", "Blackcurrant", "Citrus", "Lemon", "Grapefruit", "Green Apple", "Peach", "Apricot", "Pineapple"] },
  { label: "Floral",  aromas: ["Violet", "Rose", "Jasmine", "Elderflower", "Honey"] },
  { label: "Earthy",  aromas: ["Mushroom", "Tobacco", "Leather", "Truffle", "Wet Stone", "Pepper", "Dried Leaves"] },
  { label: "Herbal",  aromas: ["Herbs", "Eucalyptus", "Grass"] },
  { label: "Oak",     aromas: ["Vanilla", "Toasted Oak", "Cedar", "Smoke", "Cocoa", "Butter", "Toast"] },
];

const SLIDERS = [
  { key: "acidity",  label: "Acidity",  lo: "Low", hi: "High" },
  { key: "tannin",   label: "Tannin",   lo: "Silky", hi: "Grippy" },
  { key: "body",     label: "Body",     lo: "Light", hi: "Full" },
  { key: "alcohol",  label: "Alcohol",  lo: "Low", hi: "High" },
];

const EMPTY_FORM = {
  wine_name: "",
  producer: "",
  vintage: "",
  color: "",
  aromas: [],
  acidity: 3,
  tannin: 3,
  body: 3,
  alcohol: 3,
  rating: 0,
  notes: "",
  tasted_on: new Date().toISOString().slice(0, 10),
  country: "",
  region: "",
  village: "",
  grapes: [],
};

export default function TastingForm({ onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState(null); // null | "saving" | "ok" | "error"
  const [lookupStatus, setLookupStatus] = useState("idle"); // "idle" | "loading" | "error"
  const [grapeInput, setGrapeInput] = useState("");
  const [pairings, setPairings] = useState({ loading: false, text: "" });
  const [mode, setMode] = useState(null); // null | "manual" | "auto"
  const [detectStatus, setDetectStatus] = useState("idle"); // "idle" | "loading" | "error"
  const [openAromaCategories, setOpenAromaCategories] = useState(
    () => new Set(AROMA_CATEGORIES.map((c) => c.label))
  );
  const [manualAromas, setManualAromas] = useState(new Set());
  const [autoAromas,   setAutoAromas]   = useState(new Set());
  const [manualStructure, setManualStructure] = useState({}); // { acidity: n, … }
  const [autoStructure,   setAutoStructure]   = useState({}); // { acidity: n, … }
  const [labelScanLoading, setLabelScanLoading] = useState(false);
  const [labelScanError,   setLabelScanError]   = useState("");
  const labelFileRef = useRef(null);

  // Computed union — used in place of form.aromas for save/pairings/display
  const allAromas = [...new Set([...manualAromas, ...autoAromas])];

  // Auto-detect origin + grapes when wine name + producer are filled
  useEffect(() => {
    if (form.wine_name.length < 2 || form.producer.length < 2) {
      setLookupStatus("idle");
      return;
    }
    setLookupStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ wine_name: form.wine_name, producer: form.producer });
        const res = await fetch(`/lookup?${params}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setForm((f) => ({
          ...f,
          country: data.country,
          region:  data.region,
          village: data.village,
          grapes:  data.grapes ?? [],
        }));
        setLookupStatus("idle");
      } catch {
        setLookupStatus("error");
      }
    }, 900);
    return () => { clearTimeout(timer); setLookupStatus("idle"); };
  }, [form.wine_name, form.producer]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setWineField(field, value) {
    setForm((f) => ({
      ...f,
      [field]: value,
      color: "",
      rating: 0,
      notes: "",
      country: "",
      region: "",
      village: "",
      grapes: [],
      acidity: 3,
      tannin: 3,
      body: 3,
      alcohol: 3,
    }));
    setManualAromas(new Set());
    setAutoAromas(new Set());
    setManualStructure({});
    setAutoStructure({});
    setPairings({ loading: false, text: "" });
    setMode(null);
  }

  function toggleAroma(aroma) {
    setManualAromas((prev) => {
      const next = new Set(prev);
      if (next.has(aroma)) next.delete(aroma); else next.add(aroma);
      return next;
    });
  }

  function addGrape(raw) {
    const val = raw.trim().replace(/,$/, "").trim();
    if (!val) return;
    setForm((f) => ({
      ...f,
      grapes: f.grapes.includes(val) ? f.grapes : [...f.grapes, val],
    }));
    setGrapeInput("");
  }

  function removeGrape(grape) {
    setForm((f) => ({ ...f, grapes: f.grapes.filter((g) => g !== grape) }));
  }

  async function handleGetPairings() {
    setPairings({ loading: true, text: "" });
    try {
      const res = await fetch("/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wine_name: form.wine_name,
          producer:  form.producer,
          color:     form.color,
          country:   form.country,
          region:    form.region,
          grapes:    form.grapes,
          aromas:    allAromas,
          acidity:   parseInt(form.acidity),
          tannin:    parseInt(form.tannin),
          body:      parseInt(form.body),
          alcohol:   parseInt(form.alcohol),
        }),
      });
      if (!res.ok) throw new Error();
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setPairings({ loading: false, text });
      }
    } catch {
      setPairings({ loading: false, text: "Could not load — is the backend running and ANTHROPIC_API_KEY set?" });
    }
  }


  async function handleLabelScan(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLabelScanLoading(true);
    setLabelScanError("");
    try {
      const dataUrl = await new Promise((res) => {
        const r = new FileReader();
        r.onload = (ev) => res(ev.target.result);
        r.readAsDataURL(file);
      });
      const res = await fetch("/scan-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl.split(",")[1], media_type: file.type }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm((f) => ({
        ...f,
        wine_name: data.wine_name || f.wine_name,
        producer:  data.producer  || f.producer,
        vintage:   data.vintage   ? String(data.vintage) : f.vintage,
        country:   data.country   || f.country,
        region:    data.region    || f.region,
        village:   data.village   || f.village,
        grapes:    data.grapes?.length ? data.grapes : f.grapes,
      }));
    } catch {
      setLabelScanError("Could not read label — is the API running?");
    } finally {
      setLabelScanLoading(false);
      e.target.value = "";
    }
  }

  async function handleDetect() {
    setMode("auto");
    if (!form.wine_name) return;
    setDetectStatus("loading");
    try {
      const params = new URLSearchParams({
        wine_name: form.wine_name,
        producer:  form.producer,
        country:   form.country,
        region:    form.region,
        grapes:    form.grapes.join(", "),
      });
      const res = await fetch(`/detect?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAutoAromas(new Set(data.aromas));
      setAutoStructure({ acidity: data.acidity, tannin: data.tannin, body: data.body, alcohol: data.alcohol });
      // Default any untouched slider to 3 as the user's pick
      setManualStructure((prev) => {
        const next = { ...prev };
        for (const { key } of SLIDERS) {
          if (next[key] == null) next[key] = 3;
        }
        return next;
      });
      setForm((f) => ({
        ...f,
        acidity: data.acidity,
        tannin:  data.tannin,
        body:    data.body,
        alcohol: data.alcohol,
      }));
      setDetectStatus("idle");
    } catch {
      setDetectStatus("error");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/tastings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          aromas:  [...manualAromas],
          vintage: form.vintage ? parseInt(form.vintage) : null,
          acidity: manualStructure.acidity ?? 3,
          tannin:  manualStructure.tannin  ?? 3,
          body:    manualStructure.body    ?? 3,
          alcohol: manualStructure.alcohol ?? 3,
          rating:  parseInt(form.rating),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      setStatus("ok");
      setForm(EMPTY_FORM);
      setGrapeInput("");
      setPairings({ loading: false, text: "" });
      setManualAromas(new Set());
      setAutoAromas(new Set());
      setManualStructure({});
      setAutoStructure({});
      onSaved?.(saved);
      setTimeout(() => setStatus(null), 2500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="tasting-form" onSubmit={handleSubmit} noValidate>
      <h2>New Tasting</h2>

      {/* ── Wine info ── */}
      <section className="section">
        <div className="row-2">
          <label>
            Wine name *
            <div className="input-clearable">
              <input
                type="text"
                required
                value={form.wine_name}
                onChange={(e) => setWineField("wine_name", e.target.value)}
              />
              {form.wine_name && (
                <button type="button" className="input-clear-btn" onClick={() => setWineField("wine_name", "")}>×</button>
              )}
            </div>
          </label>
          <label>
            Producer
            <div className="input-clearable">
              <input
                type="text"
                value={form.producer}
                onChange={(e) => setWineField("producer", e.target.value)}
              />
              {form.producer && (
                <button type="button" className="input-clear-btn" onClick={() => setWineField("producer", "")}>×</button>
              )}
            </div>
          </label>
        </div>
        {/* Origin */}
        <div className="location-row">
          <p className="section-label">
            Origin
            {lookupStatus === "loading" && <span className="lookup-hint"> detecting…</span>}
            {lookupStatus === "error"   && <span className="lookup-error"> ⚠ lookup failed — check ANTHROPIC_API_KEY</span>}
          </p>
          <div className="row-3">
            <label>
              Country
              <input type="text" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </label>
            <label>
              Region
              <input type="text" value={form.region} onChange={(e) => set("region", e.target.value)} />
            </label>
            <label>
              Village / Appellation
              <input type="text" value={form.village} onChange={(e) => set("village", e.target.value)} />
            </label>
          </div>
        </div>

        <div className="row-2">
          <label>
            Vintage
            <input
              type="number"
              min="1900"
              max={new Date().getFullYear()}
              value={form.vintage}
              onChange={(e) => set("vintage", e.target.value)}
            />
          </label>
          <label>
            Date tasted
            <input
              type="date"
              value={form.tasted_on}
              onChange={(e) => set("tasted_on", e.target.value)}
            />
          </label>
        </div>

        {/* Grapes */}
        <div className="grapes-row">
          <p className="section-label">Grape varieties</p>
          <div className="grape-tag-input">
            {form.grapes.map((g) => (
              <span key={g} className="grape-tag">
                {g}
                <button type="button" className="grape-tag-remove" onClick={() => removeGrape(g)}>×</button>
              </span>
            ))}
            <input
              className="grape-text-input"
              value={grapeInput}
              onChange={(e) => setGrapeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addGrape(grapeInput); }
                if (e.key === "Backspace" && grapeInput === "" && form.grapes.length > 0) {
                  removeGrape(form.grapes[form.grapes.length - 1]);
                }
              }}
              onBlur={() => addGrape(grapeInput)}
            />
          </div>
        </div>
      </section>

      {/* ── Color ── */}
      <section className="section">
        <p className="section-label">Color *</p>
        <div className="color-chips">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-chip color-chip--${c.toLowerCase()} ${
                colorFamily(form.color) === c.toLowerCase() ? "active" : ""
              }`}
              onClick={() => set("color", c.toLowerCase())}
            >
              {c}
            </button>
          ))}
        </div>

        {colorFamily(form.color) === "red" && (
          <div className="shade-row">
            <span className="shade-label">Shade</span>
            <div className="shade-chips">
              {RED_SHADES.map((s) => (
                <button key={s.key} type="button"
                  className={`shade-chip ${form.color === s.key ? "active" : ""}`}
                  style={{ background: s.hex, color: "#fff" }}
                  onClick={() => set("color", s.key)}
                >{s.label}</button>
              ))}
            </div>
          </div>
        )}

        {colorFamily(form.color) === "white" && (
          <div className="shade-row">
            <span className="shade-label">Shade</span>
            <div className="shade-chips">
              {WHITE_SHADES.map((s) => (
                <button key={s.key} type="button"
                  className={`shade-chip ${form.color === s.key ? "active" : ""}`}
                  style={{ background: s.hex, color: s.dark ? "#3a2a00" : "#fff" }}
                  onClick={() => set("color", s.key)}
                >{s.label}</button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Mode selector ── */}
      <div className="mode-selector">
        <button
          type="button"
          className={`mode-btn ${mode === "manual" ? "mode-btn--active" : ""}`}
          onClick={() => {
            setMode("manual");
            setAutoAromas(new Set());
            setAutoStructure({});
            setForm((f) => ({
              ...f,
              acidity: manualStructure.acidity ?? 3,
              tannin:  manualStructure.tannin  ?? 3,
              body:    manualStructure.body    ?? 3,
              alcohol: manualStructure.alcohol ?? 3,
            }));
          }}
        >
          Fill it out myself
        </button>
        <button
          type="button"
          className={`mode-btn ${mode === "auto" ? "mode-btn--active" : ""}`}
          onClick={handleDetect}
          disabled={detectStatus === "loading"}
        >
          {detectStatus === "loading" ? "Detecting…" : "Show me what I'm tasting"}
        </button>
        <button
          type="button"
          className="mode-btn"
          onClick={() => labelFileRef.current?.click()}
          disabled={labelScanLoading}
        >
          {labelScanLoading ? "Scanning…" : "📷 Scan label"}
        </button>
        <input
          ref={labelFileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleLabelScan}
        />
        {detectStatus === "error" && (
          <span className="lookup-error">Detection failed — check ANTHROPIC_API_KEY</span>
        )}
        {labelScanError && (
          <span className="lookup-error">{labelScanError}</span>
        )}
      </div>

      {/* ── Aromas ── */}
      <section className="section">
        <p className="section-label">
          Aromas
          {allAromas.length > 0 && (
            <span className="aroma-count"> ({allAromas.length} selected)</span>
          )}
        </p>
        {(manualAromas.size > 0 || autoAromas.size > 0) && (
          <div className="aroma-legend">
            {autoAromas.size   > 0 && <span className="aroma-legend--auto">● Detected</span>}
            {manualAromas.size > 0 && <span className="aroma-legend--manual">● My picks</span>}
          </div>
        )}
        <div className="aroma-categories">
          {AROMA_CATEGORIES.map(({ label, aromas }) => {
            const count = aromas.filter((a) => autoAromas.has(a) || manualAromas.has(a)).length;
            const open  = openAromaCategories.has(label);
            return (
              <div key={label} className="aroma-category">
                <button
                  type="button"
                  className={`aroma-cat-btn ${open ? "aroma-cat-btn--open" : ""}`}
                  onClick={() => setOpenAromaCategories((prev) => {
                    const next = new Set(prev);
                    if (next.has(label)) next.delete(label); else next.add(label);
                    return next;
                  })}
                >
                  {label}
                  {count > 0 && <span className="aroma-cat-count">{count}</span>}
                  <span className="aroma-cat-chevron">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="aroma-grid">
                    {aromas.map((a) => {
                      const isAuto   = autoAromas.has(a);
                      const isManual = manualAromas.has(a);
                      const cls = isAuto && isManual ? "active active--both"
                                : isAuto             ? "active"
                                : isManual           ? "active active--manual"
                                : "";
                      return (
                        <label key={a} className={`aroma-tag ${cls}`}>
                          <input type="checkbox" checked={isAuto || isManual} onChange={() => toggleAroma(a)} />
                          {a}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Sliders ── */}
      <section className="section">
        <p className="section-label">
          Structure
          {(Object.keys(manualStructure).length > 0 || Object.keys(autoStructure).length > 0) && (
            <span className="structure-legend">
              {Object.keys(autoStructure).length   > 0 && <span className="structure-legend--auto">● Detected</span>}
              {Object.keys(manualStructure).length > 0 && <span className="structure-legend--manual">● My picks</span>}
            </span>
          )}
        </p>
        {SLIDERS.map(({ key, label, lo, hi }) => (
          <div key={key} className="slider-row">
            <span className="slider-label">{label}</span>
            <span className="slider-endpoint">{lo}</span>
            <div className="slider-wrap" style={{ '--val': form[key] }}>
              <input
                type="range" min="1" max="5"
                value={form[key]}
                onChange={(e) => {
                  setManualStructure((prev) => ({ ...prev, [key]: parseInt(e.target.value) }));
                  set(key, e.target.value);
                }}
              />
              {autoStructure[key]   != null && (
                <span className="slider-bubble slider-bubble--auto"   style={{ '--bval': autoStructure[key] }}>
                  {autoStructure[key]}
                </span>
              )}
              {manualStructure[key] != null && (
                <span className="slider-bubble slider-bubble--manual" style={{ '--bval': manualStructure[key] }}>
                  {manualStructure[key]}
                </span>
              )}
              {autoStructure[key] == null && manualStructure[key] == null && (
                <span className="slider-bubble" style={{ '--bval': form[key] }}>{form[key]}</span>
              )}
            </div>
            <span className="slider-endpoint">{hi}</span>
          </div>
        ))}
      </section>

      {/* ── Rating ── */}
      <section className="section">
        <p className="section-label">Overall rating</p>
        <div className="star-row">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button"
              className={`star ${n <= form.rating ? "active" : ""}`}
              onClick={() => set("rating", n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
            >★</button>
          ))}
        </div>
      </section>

      {/* ── Food pairings ── */}
      <section className="section">
        <button
          type="button"
          className="btn-pairings"
          onClick={handleGetPairings}
          disabled={pairings.loading || !form.wine_name}
        >
          {pairings.loading ? "Getting recommendations…" : pairings.text ? "Refresh" : "Get food pairings"}
        </button>
        {pairings.text && (
          <div className="pairings-result">{pairings.text}</div>
        )}
      </section>

      {/* ── Notes ── */}
      <section className="section">
        <label>
          Notes
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </label>
      </section>

      <div className="form-footer">
        {status === "ok"    && <span className="msg-ok">Saved!</span>}
        {status === "error" && <span className="msg-error">Save failed — is the API running?</span>}
        <button
          type="submit"
          className="btn-save"
          disabled={status === "saving" || !form.wine_name || !form.color}
        >
          {status === "saving" ? "Saving…" : "Save tasting"}
        </button>
      </div>
    </form>
  );
}
