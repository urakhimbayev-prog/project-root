import express from "express";
import fs from "fs";
import path from "path";
import cookieSession from "cookie-session";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieSession({
  name: "session",
  keys: ["supersecretkey123"],
  maxAge: 24 * 60 * 60 * 1000
}));

app.use(express.static(path.join(__dirname, "public")));

const dataFile = path.join(__dirname, "data", "earthquakes.json");
const logFile = path.join(__dirname, "data", "logs.json");

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
    return res.redirect("/login.html");
  }
  next();
}

// -------------------------
// Auth routes
// -------------------------
app.post("/auth", (req, res) => {
  const { login, password } = req.body;

  if (login === "admin" && password === "12345") {
    req.session.loggedIn = true;
    addLog("login", { user: login });
    return res.redirect("/list.html");
  }

  res.redirect("/login.html?error=1");
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/login.html");
});

// -------------------------
// Earthquake API
// -------------------------
app.get("/api/earthquakes", checkAuth, (req, res) => {
  res.json(readData());
});

app.post("/api/add", checkAuth, (req, res) => {
  const { date, time, lat, lon, magnitude } = req.body;
  const data = readData();

  const record = {
    id: Date.now(),
    date,
    time,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    magnitude: parseFloat(magnitude)
  };

  data.push(record);
  writeData(data);

  addLog("add", record);

  res.redirect("/list.html");
});

app.post("/api/update/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  const { date, time, lat, lon, magnitude } = req.body;

  const data = readData();
  const index = data.findIndex(r => r.id === id);

  if (index !== -1) {
    data[index] = {
      id,
      date,
      time,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      magnitude: parseFloat(magnitude)
    };

    writeData(data);
    addLog("update", data[index]);
  }

  res.redirect("/list.html");
});

app.get("/api/delete/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  let data = readData();

  data = data.filter(r => r.id !== id);
  writeData(data);

  addLog("delete", { id });

  res.redirect("/list.html");
});

// -------------------------
// Logs API
// -------------------------
app.get("/api/logs", checkAuth, (req, res) => {
  res.json(readLogs());
});

// -------------------------
// Export CSV
// -------------------------
app.get("/api/export", checkAuth, (req, res) => {
  const data = readData();

  let csv = "ID,Дата,Время,Широта,Долгота,Магнитуда\n";

  data.forEach(r => {
    csv += `${r.id},${r.date},${r.time},${r.lat},${r.lon},${r.magnitude}\n`;
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=earthquakes.csv");

  res.send("\uFEFF" + csv);
});

// -------------------------
// Root redirect
// -------------------------
app.get("/", checkAuth, (req, res) => {
  res.redirect("/list.html");
});

// -------------------------
// Start server
// -------------------------
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
