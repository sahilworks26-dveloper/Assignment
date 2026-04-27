import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000`;

function App() {
  const [files, setFiles] = useState([]);
  const [driveInput, setDriveInput] = useState("");
  const [allPhotos, setAllPhotos] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [minSmile, setMinSmile] = useState(0.6);
  const [maxFaces, setMaxFaces] = useState(2);
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Upload up to 100 photos to get started.");

  const localPreviews = useMemo(
    () =>
      files.map((file, index) => ({
        id: `${file.name}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      localPreviews.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [localPreviews]);

  const visibleSelected = useMemo(() => {
    return [...selectedPhotos].sort((a, b) => b.score - a.score);
  }, [selectedPhotos]);

  const jsonPreviewData = useMemo(
    () =>
      allPhotos.map((photo) => ({
        ...photo,
        previewUrl:
          typeof photo.previewUrl === "string" && photo.previewUrl.length > 80
            ? `${photo.previewUrl.slice(0, 80)}... [truncated ${photo.previewUrl.length} chars]`
            : photo.previewUrl,
      })),
    [allPhotos],
  );

  const fetchSelected = async () => {
    const params = new URLSearchParams({
      minSmile: String(minSmile),
      maxFaces: String(maxFaces),
      limit: String(limit),
    });
    const response = await fetch(`${API_BASE}/api/photos/selected?${params.toString()}`, {
      cache: "no-store",
    });
    const data = await response.json();
    setSelectedPhotos(data.photos || []);
  };

  const uploadPhotos = async () => {
    if (files.length === 0 && !driveInput.trim()) {
      setMessage("Select files or add drive links first.");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("photos", file));
    const driveLinks = driveInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    formData.append("driveLinks", JSON.stringify(driveLinks));

    setLoading(true);
    setMessage("Uploading latest photo set...");
    try {
      const response = await fetch(`${API_BASE}/api/photos/upload`, {
        method: "POST",
        body: formData,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Upload failed");
      }

      setAllPhotos(data.photos || []);
      setMessage(`Processed ${data.count} photos. Showing only latest upload.`);
      await fetchSelected();
      setFiles([]);
      setDriveInput("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearAllInputs = () => {
    setFiles([]);
    setDriveInput("");
    setAllPhotos([]);
    setSelectedPhotos([]);
    setMessage("Cleared current upload inputs and previews.");
  };

  const applySelection = async () => {
    try {
      setLoading(true);
      await fetchSelected();
      setMessage("Selection updated for latest upload.");
    } catch {
      setMessage("Could not apply selection. Check backend server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app">
      <header className="header">
        <h1>Photo Upload Smart Selection</h1>
      </header>

      <section className="card">
        <h2>1) Upload Photos</h2>
        <div className="form-row">
          <label htmlFor="fileUpload">Choose local images (max 100)</label>
          <input
            id="fileUpload"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 100))}
          />
        </div>

        <div className="form-row">
          <label htmlFor="driveLinks">Google Drive links (one per line)</label>
          <textarea
            id="driveLinks"
            placeholder="https://drive.google.com/..."
            value={driveInput}
            onChange={(event) => setDriveInput(event.target.value)}
          />
        </div>

        <div className="action-row">
          <button className="primary-btn" type="button" onClick={uploadPhotos} disabled={loading}>
            {loading ? "Processing..." : "Upload and Structure"}
          </button>
          <button type="button" onClick={clearAllInputs} disabled={loading}>
            Clear All
          </button>
        </div>
        <p className="message">{message}</p>

        {localPreviews.length > 0 && (
          <>
            <h3 className="subheading">Local Preview Before Upload ({localPreviews.length})</h3>
            <div className={viewMode === "grid" ? "photos-grid" : "photos-list"}>
              {localPreviews.map((item) => (
                <article className="photo-card" key={item.id}>
                  <img src={item.url} alt={item.name} />
                  <div className="photo-info">
                    <strong>{item.name}</strong>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2>2) Smart Selection Controls</h2>
        <div className="controls">
          <label>
            Min Smile Score
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={minSmile}
              onChange={(event) => setMinSmile(Number(event.target.value))}
            />
          </label>
          <label>
            Max Face Count
            <input
              type="number"
              min="1"
              max="3"
              value={maxFaces}
              onChange={(event) => setMaxFaces(Number(event.target.value))}
            />
          </label>
          <label>
            Max Photos
            <input
              type="number"
              min="1"
              max="100"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
            />
          </label>
          <button type="button" onClick={applySelection} disabled={loading}>
            Apply
          </button>
          <button type="button" onClick={() => setViewMode("grid")}>
            Grid
          </button>
          <button type="button" onClick={() => setViewMode("list")}>
            List
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Latest Uploaded Photos ({allPhotos.length})</h2>
        {allPhotos.length === 0 ? (
          <p className="empty">Only latest upload is shown. Old set is replaced on next upload.</p>
        ) : (
          <div className={viewMode === "grid" ? "photos-grid" : "photos-list"}>
            {allPhotos.map((photo) => (
              <article className="photo-card" key={`all-${photo.id}`}>
                {photo.previewUrl ? (
                  <img src={photo.previewUrl} alt={photo.filename} />
                ) : (
                  <div className="placeholder">Drive Photo</div>
                )}
                <div className="photo-info">
                  <strong>{photo.filename}</strong>
                  <span>Smile: {photo.attributes.smileScore}</span>
                  <span>Faces: {photo.attributes.faceCount}</span>
                  <span>Source: {photo.source}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Selected Best Photos ({visibleSelected.length})</h2>
        {visibleSelected.length === 0 ? (
          <p className="empty">No selected photos yet. Upload and click Apply.</p>
        ) : (
          <div className={viewMode === "grid" ? "photos-grid" : "photos-list"}>
            {visibleSelected.map((photo) => (
              <article className="photo-card" key={photo.id}>
                {photo.previewUrl ? (
                  <img src={photo.previewUrl} alt={photo.filename} />
                ) : (
                  <div className="placeholder">Drive Photo</div>
                )}
                <div className="photo-info">
                  <strong>{photo.filename}</strong>
                  <span>Smile: {photo.attributes.smileScore}</span>
                  <span>Faces: {photo.attributes.faceCount}</span>
                  <span>Smart Score: {photo.score}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Structured JSON Preview</h2>
        <pre>{JSON.stringify(jsonPreviewData, null, 2)}</pre>
      </section>
    </main>
  );
}

export default App;
