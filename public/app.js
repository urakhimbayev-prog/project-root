async function loadData() {
  const res = await fetch("/api/earthquakes", {
    credentials: "include"
  });

  const json = await res.json();
  if (!json.ok) return alert("Ошибка авторизации");

  renderTable(json.data);
  updateMap(json.data);
}

async function applyFilters() {
  const range = document.getElementById("range").value;
  const minMag = document.getElementById("minMag").value;

  let url = "/api/earthquakes?";

  if (range) url += `range=${range}&`;
  if (minMag) url += `minMag=${minMag}`;

  const res = await fetch(url, {
    credentials: "include"
  });

  const json = await res.json();
  if (!json.ok) return alert("Ошибка авторизации");

  renderTable(json.data);
  updateMap(json.data);
}

function renderTable(data) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  data.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td>${r.magnitude}</td>
      <td>${r.lat}</td>
      <td>${r.lon}</td>
      <td>${r.comment}</td>
      <td><button onclick="deleteRecord(${r.id})">Удалить</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteRecord(id) {
  const res = await fetch(`/api/delete/${id}`, {
    method: "GET",
    credentials: "include"
  });

  const json = await res.json();
  if (!json.ok) return alert("Ошибка авторизации");

  loadData();
}

let map;
let markersLayer;

function initMap() {
  map = L.map("map").setView([43.25, 76.9], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);

  markersLayer = L.layerGroup().addTo(map);
}

function updateMap(data) {
  markersLayer.clearLayers();

  data.forEach((r) => {
    if (typeof r.lat === "number" && typeof r.lon === "number") {
      const color =
        r.magnitude >= 4 ? "red" : r.magnitude >= 3 ? "orange" : "yellow";

      const marker = L.circleMarker([r.lat, r.lon], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.8
      }).addTo(markersLayer);

      const text = `
        <b>${r.date} ${r.time}</b><br/>
        M: ${r.magnitude}<br/>
        ${r.comment}
      `;
      marker.bindPopup(text);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadData();
});
