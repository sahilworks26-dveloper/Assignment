const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = 4000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://assignment-rf03.onrender.com",
  process.env.FRONTEND_ORIGIN,
].filter(Boolean);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 100,
    fileSize: 10 * 1024 * 1024,
  },
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json());
app.use((_, res, next) => {
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

let latestPhotos = [];
let nextId = 1;

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const createPhoto = ({ filename, source, previewUrl, driveLink }) => {
  const smileScore = Number(randomBetween(0, 1).toFixed(2));
  const faceCount = Math.floor(randomBetween(1, 4));

  return {
    id: nextId++,
    filename,
    source,
    previewUrl,
    driveLink: driveLink || null,
    uploadedAt: new Date().toISOString(),
    attributes: {
      smileScore,
      faceCount,
    },
    score: Number((smileScore + faceCount).toFixed(2)),
  };
};

app.get("/", (_, res) => {
  res.json({
    message: "Photo Upload API running",
    endpoints: {
      upload: "POST /api/photos/upload",
      all: "GET /api/photos",
      selected: "GET /api/photos/selected",
      health: "GET /health",
    },
  });
});

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/api/photos/upload", upload.array("photos", 100), (req, res) => {
  const uploadedFiles = req.files || [];
  const rawLinks = req.body.driveLinks;
  let driveLinks = [];

  if (rawLinks) {
    try {
      driveLinks = JSON.parse(rawLinks);
      if (!Array.isArray(driveLinks)) {
        return res
          .status(400)
          .json({ message: "driveLinks must be an array." });
      }
    } catch (error) {
      return res.status(400).json({ message: "Invalid driveLinks JSON." });
    }
  }

  const incomingTotal = uploadedFiles.length + driveLinks.length;
  if (incomingTotal === 0) {
    return res
      .status(400)
      .json({ message: "Please upload at least one file or drive link." });
  }
  if (incomingTotal > 100) {
    return res
      .status(400)
      .json({ message: "Maximum 100 photos allowed per upload." });
  }

  const localPhotos = uploadedFiles.map((file) => {
    const base64 = file.buffer.toString("base64");
    return createPhoto({
      filename: file.originalname,
      source: "local",
      previewUrl: `data:${file.mimetype};base64,${base64}`,
    });
  });

  const drivePhotos = driveLinks.map((link, index) =>
    createPhoto({
      filename: `drive-photo-${index + 1}`,
      source: "google-drive",
      previewUrl: null,
      driveLink: link,
    }),
  );

  // Always replace old set: only latest upload is kept.
  latestPhotos = [...localPhotos, ...drivePhotos];
  nextId = latestPhotos.length + 1;

  return res.status(201).json({
    message: "Upload processed successfully.",
    count: latestPhotos.length,
    photos: latestPhotos,
  });
});

app.get("/api/photos", (_, res) => {
  res.json({
    count: latestPhotos.length,
    photos: latestPhotos,
  });
});

app.get("/api/photos/selected", (req, res) => {
  const minSmile = Number(req.query.minSmile ?? 0.6);
  const maxFaces = Number(req.query.maxFaces ?? 2);
  const limit = Number(req.query.limit ?? 12);

  const selected = latestPhotos
    .filter(
      (photo) =>
        photo.attributes.smileScore >= minSmile &&
        photo.attributes.faceCount <= maxFaces,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  res.json({
    filters: { minSmile, maxFaces, limit },
    count: selected.length,
    photos: selected,
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
