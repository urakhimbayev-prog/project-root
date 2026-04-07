async function loadData() {
  const res = await fetch("/api/earthquakes");
  const data = await res.json();

  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  data
    .slice()
    .reverse()
    .forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.date || ""}</td>
        <td>${r.time || ""}</td>
        <td>${r.magnitude ?? ""}</td>
        <td>${r.lat ?? ""}</td>
        <td>${r.lon ?? ""}</td>
        <td>${r.comment || ""}</td>
        <td>
          <a href="/api/delete/${r.id}" class="link-danger" onclick="return confirm('Удалить запись?')">Удалить</a>
        </td>
      `;
      tbody.appendChild(tr);
    });

  updateMap(data);
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
        <b>${r.date || ""} ${r.time || ""}</b><br/>
        M: ${r.magnitude ?? ""}<br/>
        ${r.comment || ""}
      `;
      marker.bindPopup(text);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  initMap();
  await loadData();
});
