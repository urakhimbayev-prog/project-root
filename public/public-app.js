async function loadData() {
  const res = await fetch("/api/earthquakes-public");
  const data = await res.json();
  renderTable(data);
  updateMap(data);
}

async function applyFilters() {
  const range = document.getElementById("range").value;
  const minMag = document.getElementById("minMag").value;

  let url = "/api/earthquakes-public?";

  if (range) url += `range=${range}&`;
  if (minMag) url += `minMag=${minMag}`;

  const res = await fetch(url);
  const data = await res.json();

  renderTable(data);
  updateMap(data);
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
    `;
    tbody.appendChild(tr);
  });
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
    const color =
      r.magnitude >= 4 ? "red" : r.magnitude >= 3 ? "orange" : "yellow";

    L.circleMarker([r.lat, r.lon], {
      radius: 8,
      color,
      fillColor: color,
      fillOpacity: 0.8
    })
    .addTo(markersLayer)
    .bindPopup(`<b>${r.date} ${r.time}</b><br>M: ${r.magnitude}<br>${r.comment}`);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadData();
});
