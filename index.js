import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const SECRET = "supersecretjwtkey123";

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const dataFile = path.join(__dirname, "data", "earthquakes.json");
const logFile = path.join(__dirname, "data", "logs.json");
const usersFile = path.join(__dirname, "data", "users.json");

function ensureFile(filePath, defaultContent) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
  }
}

ensureFile(dataFile, []);
ensureFile(logFile, []);
ensureFile(usersFile, []);

function ensureDefaultUsers() {
  try {
    const users = JSON.parse(fs.readFileSync(usersFile));
    if (!Array.isArray(users) || users.length === 0) {
      const defaultUsers = [
        { login: "admin", password: "12345" },
        { login: "operator", password: "op123" }
      ];
      fs.writeFileSync(usersFile, JSON.stringify(defaultUsers, null, 2));
    }
  } catch {
    const defaultUsers = [
      { login: "admin", password: "12345" },
      { login: "operator", password: "op123" }
    ];
    fs.writeFileSync(usersFile, JSON.stringify(defaultUsers, null, 2));
  }
}

ensureDefaultUsers();

function readData() {
  return JSON.parse(fs.readFileSync(dataFile));
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function readUsers() {
  return JSON.parse(fs.readFileSync(usersFile));
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

function checkAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ ok: false, error: "unauthorized" });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
}

app.post("/auth", (req, res) => {
  const { login, password } = req.body;
  const users = readUsers();

  const user = users.find(u => u.login === login && u.password === password);

  if (!user) {
    return res.json({ ok: false, error: "invalid_credentials" });
  }

  const token = jwt.sign({ login: user.login }, SECRET, { expiresIn: "7d" });

  res.json({ ok: true, token });
});

app.get("/api/earthquakes", checkAuth, (req, res) => {
  let data = readData();
  res.json({ ok: true, data });
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

  res.json({ ok: true, record });
});

app.post("/api/update/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  const data = readData();
  const index = data.findIndex(r => r.id === id);

  if (index === -1) return res.json({ ok: false });

  data[index] = { ...data[index], ...req.body };
  writeData(data);

  addLog("update", data[index]);

  res.json({ ok: true, record: data[index] });
});

app.get("/api/delete/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  let data = readData();

  data = data.filter(r => r.id !== id);
  writeData(data);

  addLog("delete", { id });

  res.json({ ok: true });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
