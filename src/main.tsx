import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  advance,
  buildingAt,
  CATALOG,
  newCity,
  place,
  placementError,
  remove,
  stats,
  type BuildingKind,
  type Cell,
  type City,
  type Rotation,
} from "./simulation/city";
import { IndexedDBSaveStore } from "./platform/storage";
import { IslandScene } from "./rendering/IslandScene";
import "./style.css";
const store = new IndexedDBSaveStore();
const glyphs: Record<BuildingKind, string> = {
  cottage: "⌂",
  tower: "▥",
  garden: "♧",
  turbine: "✣",
  market: "▰",
  path: "▦",
};
function App() {
  const [city, setCity] = useState<City | null>(null);
  const [kind, setKind] = useState<BuildingKind>("cottage");
  const [rotation, setRotation] = useState<Rotation>(0);
  const [mode, setMode] = useState<"build" | "remove" | "explore">("build");
  const [category, setCategory] = useState("All buildings");
  const [paused, setPaused] = useState(false);
  const [saveState, setSaveState] = useState("Loading island…");
  const [notice, setNotice] = useState(
    "Choose a building, then tap an empty tile.",
  );
  const [savedCity, setSavedCity] = useState<City | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [help, setHelp] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<IslandScene | null>(null);
  const hover = useRef<Cell | null>(null);
  const current = useRef({ city, kind, rotation, mode });
  current.current = { city, kind, rotation, mode };
  useEffect(() => {
    let live = true;
    store
      .load()
      .then((saved) => {
        if (live) {
          setCity(saved ?? newCity());
          setStorageReady(true);
          setSaveState(saved ? "Island restored" : "Ready to save");
        }
      })
      .catch(() => {
        if (live) {
          setCity(newCity());
          setSaveState("Save unavailable");
          setNotice(
            "Could not load your save. Play in memory, or enable saving below to replace the old save.",
          );
        }
      });
    return () => {
      live = false;
    };
  }, []);
  const interact = useCallback((cell: Cell | null, commit: boolean) => {
    hover.current = cell;
    const s = current.current;
    if (!s.city) return;
    const invalid = cell
      ? placementError(s.city, s.kind, cell.x, cell.z, s.rotation)
      : null;
    view.current?.showPreview(
      s.mode === "explore" ? null : cell,
      s.mode === "remove" ? "path" : s.kind,
      s.rotation,
      s.mode === "remove"
        ? !!cell && !!buildingAt(s.city, cell.x, cell.z)
        : !invalid,
    );
    if (!commit || !cell || s.mode === "explore") return;
    if (s.mode === "remove") {
      const b = buildingAt(s.city, cell.x, cell.z);
      if (!b) {
        setNotice("Tap a building to remove it.");
        return;
      }
      setCity((c) => c && remove(c, cell.x, cell.z));
      setNotice(`${CATALOG[b.kind].name} removed. 50% refunded.`);
    } else if (invalid) setNotice(invalid);
    else {
      setCity((c) => c && place(c, s.kind, cell.x, cell.z, s.rotation));
      setNotice(
        `${CATALOG[s.kind].name} built. A little more life above the clouds.`,
      );
    }
  }, []);
  useEffect(() => {
    if (!canvas.current) return;
    try {
      view.current = new IslandScene(canvas.current, interact);
    } catch {
      setError(
        "The 3D view needs WebGL. Enable hardware acceleration or try another browser.",
      );
    }
    return () => {
      view.current?.dispose();
      view.current = null;
    };
  }, [interact]);
  useEffect(() => {
    if (city) view.current?.update(city);
    interact(hover.current, false);
  }, [city, kind, rotation, mode, interact]);
  useEffect(() => {
    if (paused || !city) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible")
        setCity((c) => c && advance(c));
    }, 10000);
    return () => window.clearInterval(id);
  }, [paused, !!city]);
  // A short debounce coalesces edits; transactions remain ordered by IndexedDB.
  useEffect(() => {
    if (!city || !storageReady) return;
    setSaveState("Saving…");
    let active = true;
    const id = window.setTimeout(() => {
      store
        .save(city)
        .then(() => {
          if (active) {
            setSavedCity(city);
            setSaveState("All changes saved");
          }
        })
        .catch(() => {
          if (active) setSaveState("Save failed · retry below");
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(id);
    };
  }, [city, storageReady]);
  useEffect(() => {
    const persist = () => {
      const c = current.current.city;
      if (c && storageReady)
        void store
          .save(c)
          .catch(() => setSaveState("Save failed · retry below"));
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
    };
  }, [storageReady]);
  const rotate = () => setRotation((r) => ((r + 1) % 4) as Rotation);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.key.toLowerCase() === "r")
        setRotation((r) => ((r + 1) % 4) as Rotation);
      if (e.key === "Escape") {
        setMode("explore");
        setHelp(false);
      }
      if (e.key === "Delete") setMode("remove");
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const totals = city ? stats(city) : { population: 0, income: 0 };
  return (
    <main className="app">
      <div className="sky-grain" aria-hidden="true" />
      <canvas
        ref={canvas}
        aria-label="Interactive floating island. Drag to pan, pinch or scroll to zoom. Choose a tile using the accessible grid controls if needed."
      />
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">☁</span>
          <span>
            CLOUD CITY<small>A LITTLE HIGHER. A LITTLE HAPPIER.</small>
          </span>
        </a>
        <div className="resources" aria-label="City resources">
          <div>
            <span className="resource-icon coin">◈</span>
            <span>
              <strong data-testid="credits">
                {city?.credits.toLocaleString() ?? "—"}
              </strong>
              <small>Cloud coins</small>
            </span>
          </div>
          <div>
            <span className="resource-icon">♙</span>
            <span>
              <strong data-testid="population">{totals.population}</strong>
              <small>Residents</small>
            </span>
          </div>
          <div className="income">
            <span className="resource-icon">↗</span>
            <span>
              <strong>
                +{totals.income}
                <em> / 10s</em>
              </strong>
              <small>City income</small>
            </span>
          </div>
        </div>
        <button
          className="help-button"
          aria-label="How to play"
          onClick={() => setHelp((v) => !v)}
        >
          ?
        </button>
      </header>
      <section className="island-label">
        <span className="eyebrow">
          <i /> YOUR LITTLE WORLD
        </span>
        <h1>{city?.name ?? "Zephyr Isle"}</h1>
        <p>Room to grow. Space to breathe.</p>
        <span className="island-meta">
          12 × 12 island <span>·</span> Day{" "}
          {Math.floor((city?.tick ?? 0) / 6) + 1}
        </span>
      </section>
      <div className="save-pill" role="status">
        <i className={storageReady ? "" : "warning"} />
        {saveState === "All changes saved" && savedCity !== city
          ? "Saving…"
          : saveState}
      </div>
      {(saveState.includes("failed") || (!storageReady && city)) && (
        <button
          className="retry"
          onClick={() => {
            if (city)
              void store
                .save(city)
                .then(() => {
                  setStorageReady(true);
                  setSavedCity(city);
                  setSaveState("All changes saved");
                })
                .catch(() => setSaveState("Save failed · retry below"));
          }}
        >
          Enable / retry saving
        </button>
      )}
      <aside className="world-controls" aria-label="Camera controls">
        <button aria-label="Zoom in" onClick={() => view.current?.zoom(0.85)}>
          +
        </button>
        <button aria-label="Zoom out" onClick={() => view.current?.zoom(1.15)}>
          −
        </button>
        <span />
        <button
          aria-label="Orbit camera left"
          onClick={() => view.current?.orbit(-1)}
        >
          ↶
        </button>
        <button
          aria-label="Orbit camera right"
          onClick={() => view.current?.orbit(1)}
        >
          ↷
        </button>
        <button aria-label="Center island" onClick={() => view.current?.home()}>
          ⌖
        </button>
      </aside>
      <div className="scene-caption">
        <span>✧</span> A city with its head in the clouds.
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {help && (
        <section className="help-panel">
          <button
            className="close"
            aria-label="Close help"
            onClick={() => setHelp(false)}
          >
            ×
          </button>
          <span className="eyebrow">WELCOME, SKY BUILDER</span>
          <h2>Make yourself at cloud.</h2>
          <p>
            Select a building and click or tap an empty tile. Rotate it before
            placing with <kbd>R</kbd> or the rotate button. Red means the space
            is blocked or too expensive.
          </p>
          <p>
            Drag to pan. Pinch or scroll to zoom. Use the arrow buttons to
            orbit. Remove a building for a 50% refund.
          </p>
          <p>
            Your city earns coins every 10 seconds while visible and unpaused.
            Changes save automatically on this device. No offline income in
            Sprint 01.
          </p>
          <details>
            <summary>Keyboard & accessible tile controls</summary>
            <p>
              Select a tile and use the action button. Coordinates run from 1 to
              12.
            </p>
            <TileControls onAction={interact} />
          </details>
        </section>
      )}
      <section className="build-dock" aria-label="Building tools">
        <div className="dock-heading">
          <div>
            <span className="eyebrow">A PLACE FOR POSSIBILITY</span>
            <h2>
              Build your little city<span> ✦</span>
            </h2>
          </div>
          <div className="mode-switch">
            <button
              aria-pressed={mode === "build"}
              onClick={() => setMode("build")}
            >
              ⌂ <span>Build</span>
            </button>
            <button
              aria-pressed={mode === "remove"}
              onClick={() => setMode("remove")}
            >
              ⌫ <span>Remove</span>
            </button>
            <button
              aria-label="Explore without building"
              aria-pressed={mode === "explore"}
              onClick={() => setMode("explore")}
            >
              ☝
            </button>
          </div>
        </div>
        <div className="dock-body">
          <nav className="categories" aria-label="Building categories">
            {["All buildings", "Homes", "Nature", "Utilities", "Services"].map(
              (c) => (
                <button
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ),
            )}
          </nav>
          <div className="building-list">
            {(Object.keys(CATALOG) as BuildingKind[])
              .filter(
                (k) =>
                  category === "All buildings" ||
                  CATALOG[k].category === category,
              )
              .map((k) => (
                <button
                  key={k}
                  className={`building-card ${kind === k && mode === "build" ? "selected" : ""}`}
                  aria-pressed={kind === k && mode === "build"}
                  aria-label={`${CATALOG[k].name}, ${CATALOG[k].cost} coins`}
                  onClick={() => {
                    setKind(k);
                    setMode("build");
                  }}
                >
                  <span className={`building-art ${k}`} aria-hidden="true">
                    {glyphs[k]}
                  </span>
                  <span className="building-name">{CATALOG[k].name}</span>
                  <span className="building-price">
                    ◈ {CATALOG[k].cost}{" "}
                    <small>{CATALOG[k].size.join(" × ")}</small>
                  </span>
                </button>
              ))}
          </div>
        </div>
        <div className="dock-footer">
          <p role="status">
            {mode === "remove"
              ? "Removal mode · tap a building for a 50% refund."
              : mode === "explore"
                ? "Explore mode · drag to look around your island."
                : notice}
          </p>
          <button
            aria-label="Rotate building"
            className="rotate"
            onClick={rotate}
            disabled={mode !== "build"}
          >
            ↻ <span>Rotate</span> <kbd>R</kbd>
            <small>{rotation * 90}°</small>
          </button>
        </div>
      </section>
      <footer className="bottom-bar">
        <span>
          ✦ SPRINT 01 <i> / </i> THE FIRST CHAPTER
        </span>
        <button
          aria-label={paused ? "Resume simulation" : "Pause simulation"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "▶ Paused" : "Ⅱ Living, slowly"}
        </button>
        <span>Made for a quieter kind of city.</span>
      </footer>
    </main>
  );
}
function TileControls({
  onAction,
}: {
  onAction: (cell: Cell, commit: boolean) => void;
}) {
  const [x, setX] = useState(1),
    [z, setZ] = useState(1);
  return (
    <div className="tile-controls">
      <label>
        Column{" "}
        <input
          aria-label="Tile column"
          type="number"
          min="1"
          max="12"
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
        />
      </label>
      <label>
        Row{" "}
        <input
          aria-label="Tile row"
          type="number"
          min="1"
          max="12"
          value={z}
          onChange={(e) => setZ(Number(e.target.value))}
        />
      </label>
      <button onClick={() => onAction({ x: x - 1, z: z - 1 }, true)}>
        Apply tool to tile
      </button>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
