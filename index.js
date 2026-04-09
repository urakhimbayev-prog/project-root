import express from "express";
import fs from "fs";
import path from "path";
import cookieSession from "cookie-session";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// -------------------------
// CORS (обязательно для iframe)
// -------------------------
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------------
// Cookie session (фикс для iframe)
// -------------------------
app.use(
  cookieSession({
    name: "session",
    keys: ["supersecretkey123"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: "none",
    httpOnly: false
  })
);

// -------------------------
// Static files
// -------------------------
app.use(express.static(path.join(__dirname, "public")));

// -------------------------
// File paths
// -------------------------
const dataFile = path.join(__dirname, "data", "earthquakes.json");
const logFile = path.join(__dirname, "data", "logs.json");
const usersFile = path.join(__dirname, "data", "users.json");

// -------------------------
// Ensure files exist
// -------------------------
function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
  }
}

ensureFile(dataFile, []);
ensureFile(logFile, []);
ensureFile(usersFile, []);

// -------------------------
// Auto-create default users
// -------------------------
function ensureDefaultUsers() {
  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    if (!Array.isArray(users) || users.length === 0) {
      const defaultUsers = [
        { login: "admin", password: "12345", role: "admin" },
        { login: "operator", password: "op123", role: "operator" }
      ];
      fs.writeFileSync(usersFile, JSON.stringify(defaultUsers, null, 2));
    }
  } catch {
    const defaultUsers = [
      { login: "admin", password: "12345", role: "admin" },
      { login: "operator", password: "op123", role: "operator" }
    ];
    fs.writeFileSync(usersFile, JSON.stringify(defaultUsers, null, 2));
  }
}

ensureDefaultUsers();

// -------------------------
// JSON helpers
// -------------------------
function readData() {
  return JSON.parse(fs.readFileSync(dataFile));
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function readLogs() {
  return JSON.parse(fs.readFileSync(logFile));
}

function writeLogs(data) {
  fs.writeFileSync(logFile, JSON.stringify(data, null, 2));
}

function readUsers() {
  return JSON.parse(fs.readFileSync(usersFile));
}

function addLog(action, details) {
  const logs = readLogs();
  logs.push({
    id: Date.now(),
    time: new Date().toISOString(),
    action,
    details
  });
  writeLogs(logs);
}

// -------------------------
// Auth middleware
// -------------------------
function checkAuth(req, res, next) {
  if (!req.session.loggedIn) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

// -------------------------
// Login page
// -------------------------
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// -------------------------
// Auth routes
// -------------------------
app.post("/auth", (req, res) => {
  const { login, password } = req.body;
  const users = readUsers();

  const user = users.find(
    (u) => u.login === login && u.password === password
  );

  if (!user) {
    return res.json({ ok: false, error: "invalid_credentials" });
  }

  req.session.loggedIn = true;
  req.session.user = user;

  addLog("login", { user: login });

  res.json({ ok: true });
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// -------------------------
// PRIVATE API (operator)
// -------------------------
app.get("/api/earthquakes", checkAuth, (req, res) => {
  let data = readData();
  const now = Date.now();

  const range = req.query.range;
  if (range === "24h") data = data.filter(r => now - r.id <= 24 * 60 * 60 * 1000);
  if (range === "7d")  data = data.filter(r => now - r.id <= 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") data = data.filter(r => now - r.id <= 30 * 24 * 60 * 60 * 1000);

  const minMag = parseFloat(req.query.minMag);
  if (!isNaN(minMag)) {
    data = data.filter(r => r.magnitude >= minMag);
  }

  data = data.sort((a, b) => b.id - a.id);

  res.json({ ok: true, data });
});

// ADD
app.post("/api/add", checkAuth, (req, res) => {
  const { date, time, lat, lon, magnitude, comment } = req.body;
  const data = readData();

  const record = {
    id: Date.now(),
    date,
    time,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    magnitude: parseFloat(magnitude),
    comment: comment || ""
  };

  data.push(record);
  writeData(data);

  addLog("add", record);

  res.json({ ok: true, record });
});

// UPDATE
app.post("/api/update/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  const { date, time, lat, lon, magnitude, comment } = req.body;

  const data = readData();
  const index = data.findIndex((r) => r.id === id);

  if (index !== -1) {
    data[index] = {
      id,
      date,
      time,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      magnitude: parseFloat(magnitude),
      comment: comment || ""
    };

    writeData(data);
    addLog("update", data[index]);

    return res.json({ ok: true, record: data[index] });
  }

  res.json({ ok: false, error: "not_found" });
});

// DELETE
app.get("/api/delete/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  let data = readData();

  data = data.filter(r => r.id !== id);
  writeData(data);

  addLog("delete", { id });

  res.json({ ok: true, id });
});

// -------------------------
// PUBLIC API
// -------------------------
app.get("/api/earthquakes-public", (req, res) => {
  let data = readData();
  const now = Date.now();

  const range = req.query.range;
  if (range === "24h") data = data.filter(r => now - r.id <= 24 * 60 * 60 * 1000);
  if (range === "7d")  data = data.filter(r => now - r.id <= 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") data = data.filter(r => now - r.id <= 30 * 24 * 60 * 60 * 1000);

  const minMag = parseFloat(req.query.minMag);
  if (!isNaN(minMag)) {
    data = data.filter(r => r.magnitude >= minMag);
  }

  data = data.sort((a, b) => b.id - a.id);

  res.json({ ok: true, data });
});

// -------------------------
// Root route
// -------------------------
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

// -------------------------
// Start server
// -------------------------
const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log("Server running on port", port)
);
