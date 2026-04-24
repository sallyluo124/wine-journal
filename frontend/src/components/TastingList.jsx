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

export default function TastingList({ entries, onDelete }) {
  const [expanded, setExpanded] = useState(null);
  const [pairings, setPairings] = useState({}); // id → { loading, text }

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
                          <div
                            className="tl-bar-fill"
                            style={{ width: `${(e[k] / 5) * 100}%` }}
                          />
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
                  <button
                    className="tl-btn-pairings"
                    onClick={() => fetchPairings(e)}
                    disabled={pairings[e.id]?.loading}
                  >
                    {pairings[e.id]?.loading ? "Getting recommendations…" : "Food pairings"}
                  </button>
                  {pairings[e.id]?.text && (
                    <div className="tl-pairings-result">
                      {pairings[e.id].text}
                    </div>
                  )}
                </div>

                <div className="tl-actions">
                  <button
                    className="tl-btn-delete"
                    onClick={() => onDelete(e.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
