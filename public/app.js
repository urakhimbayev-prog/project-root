function authHeader() {
  return {
    Authorization: "Bearer " + localStorage.getItem("token")
  };
}

async function loadData() {
  const res = await fetch("/api/earthquakes", {
    headers: authHeader()
  });

  const json = await res.json();
  if (!json.ok) return alert("Ошибка авторизации");

  renderTable(json.data);
}

function renderTable(data) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  data.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.time}</td>
      <td>${r.magnitude}</td>
      <td>${r.lat}</td>
      <td>${r.lon}</td>
      <td>${r.comment}</td>
      <td><button onclick="del(${r.id})">Удалить</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function del(id) {
  const res = await fetch(`/api/delete/${id}`, {
    headers: authHeader()
  });

  loadData();
}

document.addEventListener("DOMContentLoaded", loadData);
