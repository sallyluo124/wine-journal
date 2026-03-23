import { useState, useEffect } from "react";
import TastingForm from "./components/TastingForm";
import TastingList from "./components/TastingList";
import WinePairing from "./components/WinePairing";
import "./App.css";

export default function App() {
  const [section, setSection] = useState("journal"); // "journal" | "pairing"
  const [view, setView] = useState("form");           // "form" | "list"
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    fetch("/tastings")
      .then((r) => r.json())
      .then((data) => setEntries(data.reverse()))
      .catch(() => {});
  }, []);

  function handleSaved(entry) {
    setEntries((prev) => [entry, ...prev]);
    setView("list");
  }

  async function handleDelete(id) {
    await fetch(`/tastings/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div>
      <header className="app-header">
        <h1>Somm</h1>
      </header>

      <nav className="section-nav">
        <button
          className={`section-btn ${section === "journal" ? "section-btn--active" : ""}`}
          onClick={() => setSection("journal")}
        >
          Wine Journal
        </button>
        <button
          className={`section-btn ${section === "pairing" ? "section-btn--active" : ""}`}
          onClick={() => setSection("pairing")}
        >
          Wine Pairings
        </button>
      </nav>

      {/* Journal section — always mounted to preserve form state */}
      <div style={{ display: section === "journal" ? "block" : "none" }}>
        <nav className="app-nav">
          <button
            className={view === "form" ? "nav-btn active" : "nav-btn"}
            onClick={() => setView("form")}
          >
            + New tasting
          </button>
          <button
            className={view === "list" ? "nav-btn active" : "nav-btn"}
            onClick={() => setView("list")}
          >
            My tastings
            {entries.length > 0 && (
              <span className="nav-count">{entries.length}</span>
            )}
          </button>
        </nav>
        <div style={{ display: view === "form" ? "block" : "none" }}>
          <TastingForm onSaved={handleSaved} />
        </div>
        <div style={{ display: view === "list" ? "block" : "none" }}>
          <TastingList entries={entries} onDelete={handleDelete} />
        </div>
      </div>

      {/* Pairings section — always mounted to preserve food selections */}
      <div style={{ display: section === "pairing" ? "block" : "none" }}>
        <WinePairing />
      </div>
    </div>
  );
}
