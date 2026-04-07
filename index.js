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

// Cookie fix for iframe + HTTPS
app.use(
  cookieSession({
    name: "session",
    keys: ["supersecretkey123"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: "none"
  })
);

app.use(express.static(path.join(__dirname, "public")));

const dataFile = path.join(__dirname, "data", "earthquakes.json");
const logFile = path.join(__dirname, "data", "logs.json");
const usersFile = path.join(__dirname, "data", "users.json");

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

function checkAuth(req, res, next) {
  if (!req.session.loggedIn) {
    return res.redirect("/login.html");
  }
  next();
}

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// AUTH
app.post("/auth", (req, res) => {
  const { login, password } = req.body;
  const users = readUsers();

  const user = users.find(
    (u) => u.login === login && u.password === password
  );

  if (!user) {
    return res.redirect("/login.html?error=1");
  }

  req.session.loggedIn = true;
  req.session.user = user;

  addLog("login", { user: login });

  res.redirect("/list.html");
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/login.html");
});

// API with filters
app.get("/api/earthquakes", checkAuth, (req, res) => {
  let data = readData();
  const now = Date.now();

  // Date range filter
  const range = req.query.range;
  if (range === "24h") data = data.filter(r => now - r.id <= 24 * 60 * 60 * 1000);
  if (range === "7d")  data = data.filter(r => now - r.id <= 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") data = data.filter(r => now - r.id <= 30 * 24 * 60 * 60 * 1000);

  // Magnitude filter
  const minMag = parseFloat(req.query.minMag);
  if (!isNaN(minMag)) {
    data = data.filter(r => r.magnitude >= minMag);
  }

  // Sort newest first
  data = data.sort((a, b) => b.id - a.id);

  res.json(data);
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

  res.redirect("/list.html");
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
  }

  res.redirect("/list.html");
});

// DELETE
app.get("/api/delete/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  let data = readData();

  data = data.filter(r => r.id !== id);
  writeData(data);

  addLog("delete", { id });

  res.redirect("/list.html");
});

// LOGS
app.get("/api/logs", checkAuth, (req, res) => {
  res.json(readLogs());
});

// EXPORT CSV
app.get("/api/export", checkAuth, (req, res) => {
  const data = readData();

  let csv = "ID,Дата,Время,Широта,Долгота,Магнитуда,Комментарий\n";

  data.forEach((r) => {
    csv += `${r.id},${r.date},${r.time},${r.lat},${r.lon},${r.magnitude},"${(r.comment || "").replace(/"/g, '""')}"\n`;
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=earthquakes.csv"
  );

  res.send("\uFEFF" + csv);
});

// ROOT
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

const port = process.env.PORT || 3000;
app.listen(port, () =>
  console.log("Server running on port", port)
);
