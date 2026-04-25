import { useState } from "react";
import "./TastingList.css";

const COLOR_DOT = {
  red:      "#c0392b",
  white:    "#e8ce35",
  rosé:     "#f4a7b9",
  orange:   "#e8895a",
  sparkling:"#82c995",
  // Red shades
  ruby:     "#a31515",
  garnet:   "#6b1a1a",
  purple:   "#6b2d8b",
  brick:    "#b5451b",
  // White/yellow shades
  "pale straw": "#f9f4c8",
  straw:    "#e8d060",
  yellow:   "#c8aa00",
  gold:     "#c8960c",
  amber:    "#c87820",
};

const STRUCTURE_KEYS = ["acidity", "tannin", "body", "alcohol"];

const AROMA_CATEGORIES = [
  { label: "Fruit",   aromas: ["Black Cherry", "Cherry", "Raspberry", "Strawberry", "Plum", "Blackcurrant", "Citrus", "Lemon", "Grapefruit", "Green Apple", "Peach", "Apricot", "Pineapple"] },
  { label: "Floral",  aromas: ["Violet", "Rose", "Jasmine", "Elderflower", "Honey"] },
  { label: "Earthy",  aromas: ["Mushroom", "Tobacco", "Leather", "Truffle", "Wet Stone", "Pepper", "Dried Leaves"] },
  { label: "Herbal",  aromas: ["Herbs", "Eucalyptus", "Grass"] },
  { label: "Oak",     aromas: ["Vanilla", "Toasted Oak", "Cedar", "Smoke", "Cocoa", "Butter", "Toast"] },
];

export default function TastingList({ entries, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(null);
  const [pairings, setPairings] = useState({}); // id → { loading, text }
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  function startEdit(e) {
    setEditId(e.id);
    setEditDraft({ ...e, aromas: [...e.aromas], grapes: [...(e.grapes ?? [])] });
  }

  function cancelEdit() {
    setEditId(null);
    setEditDraft(null);
  }

  function setDraft(field, value) {
    setEditDraft((d) => ({ ...d, [field]: value }));
  }

  function toggleEditAroma(aroma) {
    setEditDraft((d) => {
      const next = d.aromas.includes(aroma)
        ? d.aromas.filter((a) => a !== aroma)
        : [...d.aromas, aroma];
      return { ...d, aromas: next };
    });
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      const res = await fetch(`/tastings/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editDraft,
          vintage: editDraft.vintage ? parseInt(editDraft.vintage) : null,
          acidity: parseInt(editDraft.acidity),
          tannin:  parseInt(editDraft.tannin),
          body:    parseInt(editDraft.body),
          alcohol: parseInt(editDraft.alcohol),
          rating:  parseInt(editDraft.rating),
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onUpdate?.(updated);
      setEditId(null);
      setEditDraft(null);
    } catch {
      alert("Save failed — is the backend running?");
    } finally {
      setEditSaving(false);
    }
  }

  async function fetchPairings(e) {
    setPairings((p) => ({ ...p, [e.id]: { loading: true, text: "" } }));
    try {
      const res = await fetch("/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wine_name: e.wine_name,
          producer:  e.producer,
          color:     e.color,
          country:   e.country,
          region:    e.region,
          grapes:    e.grapes ?? [],
          aromas:    e.aromas,
          acidity:   e.acidity,
          tannin:    e.tannin,
          body:      e.body,
          alcohol:   e.alcohol,
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
        setPairings((p) => ({ ...p, [e.id]: { loading: false, text } }));
      }
    } catch {
      setPairings((p) => ({ ...p, [e.id]: { loading: false, text: "Could not load recommendations — is the API running?" } }));
    }
  }

  if (entries.length === 0) {
    return <p className="tl-empty">No tastings yet — add one above.</p>;
  }

  return (
    <ul className="tl-list">
      {entries.map((e) => {
        const open = expanded === e.id;
        return (
          <li key={e.id} className={`tl-card ${open ? "tl-card--open" : ""}`}>
            {/* ── Summary row ── */}
            <button
              className="tl-summary"
              onClick={() => setExpanded(open ? null : e.id)}
              aria-expanded={open}
            >
              <span
                className="tl-dot"
                style={{ background: COLOR_DOT[e.color] ?? "#bbb" }}
                title={e.color}
              />
              <span className="tl-name">
                {e.wine_name}
                {e.vintage ? <span className="tl-vintage"> {e.vintage}</span> : null}
              </span>
              <span className="tl-producer">{e.producer}</span>
              <span className="tl-stars">
                {"★".repeat(e.rating)}
                <span className="tl-stars-empty">{"★".repeat(5 - e.rating)}</span>
              </span>
              <span className="tl-date">{e.tasted_on}</span>
              <span className="tl-chevron">{open ? "▲" : "▼"}</span>
            </button>

            {/* ── Detail panel ── */}
            {open && (
              <div className="tl-detail">
                {editId === e.id && editDraft ? (
                  /* ── Edit mode ── */
                  <div className="tl-edit-form">
                    <div className="tl-edit-row2">
                      <label className="tl-edit-label">Wine name
                        <input className="tl-edit-input" value={editDraft.wine_name} onChange={(ev) => setDraft("wine_name", ev.target.value)} />
                      </label>
                      <label className="tl-edit-label">Producer
                        <input className="tl-edit-input" value={editDraft.producer} onChange={(ev) => setDraft("producer", ev.target.value)} />
                      </label>
                    </div>
                    <div className="tl-edit-row3">
                      <label className="tl-edit-label">Country
                        <input className="tl-edit-input" value={editDraft.country} onChange={(ev) => setDraft("country", ev.target.value)} />
                      </label>
                      <label className="tl-edit-label">Region
                        <input className="tl-edit-input" value={editDraft.region} onChange={(ev) => setDraft("region", ev.target.value)} />
                      </label>
                      <label className="tl-edit-label">Village / Appellation
                        <input className="tl-edit-input" value={editDraft.village} onChange={(ev) => setDraft("village", ev.target.value)} />
                      </label>
                    </div>
                    <div className="tl-edit-row2">
                      <label className="tl-edit-label">Vintage
                        <input className="tl-edit-input" type="number" value={editDraft.vintage ?? ""} onChange={(ev) => setDraft("vintage", ev.target.value)} />
                      </label>
                      <label className="tl-edit-label">Date tasted
                        <input className="tl-edit-input" type="date" value={editDraft.tasted_on} onChange={(ev) => setDraft("tasted_on", ev.target.value)} />
                      </label>
                    </div>
                    <div>
                      <span className="tl-edit-section-label">Aromas</span>
                      {AROMA_CATEGORIES.map(({ label, aromas }) => (
                        <div key={label} className="tl-edit-aroma-group">
                          <span className="tl-edit-aroma-cat">{label}</span>
                          <div className="tl-edit-aroma-chips">
                            {aromas.map((a) => (
                              <button
                                key={a}
                                type="button"
                                className={`tl-edit-aroma-chip ${editDraft.aromas.includes(a) ? "tl-edit-aroma-chip--on" : ""}`}
                                onClick={() => toggleEditAroma(a)}
                              >{a}</button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <span className="tl-edit-section-label">Structure</span>
                      {STRUCTURE_KEYS.map((k) => (
                        <div key={k} className="tl-edit-slider-row">
                          <span className="tl-edit-slider-label">{k}</span>
                          <input type="range" min="1" max="5" value={editDraft[k]} onChange={(ev) => setDraft(k, parseInt(ev.target.value))} />
                          <span className="tl-edit-slider-val">{editDraft[k]}/5</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <span className="tl-edit-section-label">Rating</span>
                      <div className="tl-edit-stars">
                        {[1,2,3,4,5].map((n) => (
                          <button key={n} type="button" className={`tl-star ${n <= editDraft.rating ? "tl-star--on" : ""}`} onClick={() => setDraft("rating", n)}>★</button>
                        ))}
                      </div>
                    </div>
                    <label className="tl-edit-label">Notes
                      <textarea className="tl-edit-textarea" rows={3} value={editDraft.notes} onChange={(ev) => setDraft("notes", ev.target.value)} />
                    </label>
                    <div className="tl-edit-actions">
                      <button className="tl-btn-save" onClick={saveEdit} disabled={editSaving}>
                        {editSaving ? "Saving…" : "Save changes"}
                      </button>
                      <button className="tl-btn-cancel" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <>
                    <div className="tl-wine-details">
                      <div className="tl-wine-details-row">
                        <span className="tl-wine-details-name">{e.wine_name}{e.vintage ? ` ${e.vintage}` : ""}</span>
                        {e.producer && <span className="tl-wine-details-producer">{e.producer}</span>}
                      </div>
                      {(e.country || e.region || e.village) && (
                        <div className="tl-wine-details-origin">
                          {[e.village, e.region, e.country].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {e.grapes?.length > 0 && (
                        <div className="tl-grapes">
                          {e.grapes.map((g) => (
                            <span key={g} className="tl-grape-tag">{g}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {e.aromas.length > 0 && (
                      <div className="tl-row">
                        <span className="tl-field-label">Aromas</span>
                        <div className="tl-aromas">
                          {e.aromas.map((a) => (
                            <span key={a} className="tl-aroma-tag">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="tl-row">
                      <span className="tl-field-label">Structure</span>
                      <div className="tl-bars">
                        {STRUCTURE_KEYS.map((k) => (
                          <div key={k} className="tl-bar-row">
                            <span className="tl-bar-label">{k}</span>
                            <div className="tl-bar-track">
                              <div className="tl-bar-fill" style={{ width: `${(e[k] / 5) * 100}%` }} />
                            </div>
                            <span className="tl-bar-val">{e[k]}/5</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {e.notes && (
                      <div className="tl-row">
                        <span className="tl-field-label">Notes</span>
                        <p className="tl-notes">{e.notes}</p>
                      </div>
                    )}

                    <div className="tl-pairings">
                      <button className="tl-btn-pairings" onClick={() => fetchPairings(e)} disabled={pairings[e.id]?.loading}>
                        {pairings[e.id]?.loading ? "Getting recommendations…" : "Food pairings"}
                      </button>
                      {pairings[e.id]?.text && (
                        <div className="tl-pairings-result">{pairings[e.id].text}</div>
                      )}
                    </div>

                    <div className="tl-actions">
                      <button className="tl-btn-edit" onClick={() => startEdit(e)}>Edit</button>
                      <button className="tl-btn-delete" onClick={() => onDelete(e.id)}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
