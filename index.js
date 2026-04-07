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

// Middleware: проверка авторизации
function checkAuth(req, res, next) {
  if (!req.session.loggedIn) {
    return res.redirect("/login.html");
  }
  next();
}

// Чтение/запись JSON
function readData() {
  return JSON.parse(fs.readFileSync(dataFile));
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Авторизация
app.post("/auth", (req, res) => {
  const { login, password } = req.body;

  if (login === "admin" && password === "12345") {
    req.session.loggedIn = true;
    return res.redirect("/list.html");
  }

  res.redirect("/login.html?error=1");
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/login.html");
});

// API защищаем
app.get("/api/earthquakes", checkAuth, (req, res) => {
  res.json(readData());
});

app.post("/api/add", checkAuth, (req, res) => {
  const { date, time, lat, lon, magnitude } = req.body;
  const data = readData();

  data.push({
    id: Date.now(),
    date,
    time,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    magnitude: parseFloat(magnitude)
  });

  writeData(data);
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
  }

  res.redirect("/list.html");
});

app.get("/api/delete/:id", checkAuth, (req, res) => {
  const id = Number(req.params.id);
  let data = readData();

  data = data.filter(r => r.id !== id);
  writeData(data);

  res.redirect("/list.html");
});

// Главная → журнал
app.get("/", checkAuth, (req, res) => {
  res.redirect("/list.html");
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
