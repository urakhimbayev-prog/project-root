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

// -------------------------
// Cookie session (iframe + HTTPS fix)
// -------------------------
app.use(
  cookieSession({
    name: "session",
    keys: ["supersecretkey123"],
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,       // обязательно для HTTPS (Railway)
    sameSite: "none"    // обязательно для iframe
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
    return res.redirect("/login.html");
  }
  next();
}

// -------------------------
// Allow login.html without auth
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

// -------------------------
// Earthquake API
// -------------------------
app.get("/api/earthquakes", checkAuth, (req, res) => {
  res.json(readData());
});

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

app.get("/api/delete/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  let data = readData();

  data = data.filter((r) => r.id !== id);
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
