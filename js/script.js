// Servicios gratuitos de Open-Meteo que no requieren clave
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

// Descripcion del clima segun el codigo WMO
const WEATHER_CODES = {
  0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
  45: "Niebla", 48: "Niebla con escarcha",
  51: "Llovizna ligera", 53: "Llovizna", 55: "Llovizna intensa",
  56: "Llovizna helada", 57: "Llovizna helada intensa",
  61: "Lluvia ligera", 63: "Lluvia", 65: "Lluvia intensa",
  66: "Lluvia helada", 67: "Lluvia helada intensa",
  71: "Nieve ligera", 73: "Nieve", 75: "Nieve intensa", 77: "Granos de nieve",
  80: "Chubascos ligeros", 81: "Chubascos", 82: "Chubascos fuertes",
  85: "Chubascos de nieve", 86: "Chubascos de nieve fuertes",
  95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta con granizo fuerte"
};

// Ultima ubicacion buscada, se usa al actualizar
let currentPlace = null;

const $ = function (id) { return document.getElementById(id); };

function describe(code) {
  return WEATHER_CODES[code] || "Sin datos";
}

function setStatus(text) {
  $("status").textContent = text;
}

// Convierte una fecha ISO a formato dd/mm hh:mm
function formatTime(iso) {
  const parts = iso.split("T");
  const date = parts[0].split("-");
  return date[2] + "/" + date[1] + " " + parts[1];
}

function percent(value) {
  return value === null || value === undefined ? "-" : value + "%";
}

// Busca las coordenadas de la ubicacion escrita
async function findPlace(name) {
  const url = GEO_URL + "?count=1&language=es&name=" + encodeURIComponent(name);
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo buscar la ubicación.");
  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    throw new Error("No se encontró la ubicación: " + name);
  }
  const r = data.results[0];
  return { name: r.name + (r.country ? ", " + r.country : ""), latitude: r.latitude, longitude: r.longitude };
}

// Pide el clima actual y las horas anteriores y siguientes
async function fetchWeather(place) {
  const url = FORECAST_URL +
    "?latitude=" + place.latitude +
    "&longitude=" + place.longitude +
    "&current=temperature_2m,wind_speed_10m,weather_code" +
    "&hourly=temperature_2m,precipitation_probability,weather_code" +
    "&past_hours=24&forecast_hours=26&timezone=auto";
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo obtener el clima.");
  return res.json();
}

// Llena una tabla con las filas de horas indicadas
function renderTable(tableId, rows) {
  const table = $(tableId);
  table.innerHTML = "";
  const head = table.insertRow();
  ["Hora", "Temperatura", "Prob. de lluvia", "Clima"].forEach(function (title) {
    const th = document.createElement("th");
    th.textContent = title;
    head.appendChild(th);
  });
  rows.forEach(function (row) {
    const tr = table.insertRow();
    [formatTime(row.time), row.temp + " °C", percent(row.rain), describe(row.code)].forEach(function (text) {
      tr.insertCell().textContent = text;
    });
  });
}

// Muestra el clima actual y las dos tablas de 24 horas
function render(place, data) {
  const hourly = data.hourly;
  const hours = hourly.time.map(function (time, i) {
    return {
      time: time,
      temp: hourly.temperature_2m[i],
      rain: hourly.precipitation_probability[i],
      code: hourly.weather_code[i]
    };
  });
  let now = hourly.time.indexOf(data.current.time.slice(0, 13) + ":00");
  if (now === -1) now = Math.min(24, hours.length - 1);

  $("place").textContent = place.name;
  $("temp").textContent = data.current.temperature_2m + " °C";
  $("condition").textContent = describe(data.current.weather_code);
  $("wind").textContent = "Viento: " + data.current.wind_speed_10m + " km/h";
  $("rain").textContent = "Probabilidad de lluvia: " + percent(hours[now].rain);

  renderTable("past", hours.slice(Math.max(0, now - 24), now));
  renderTable("future", hours.slice(now + 1, now + 25));

  $("current").hidden = false;
  $("past-section").hidden = false;
  $("future-section").hidden = false;
}

// Carga el clima de la ubicacion actual y maneja errores
async function loadWeather() {
  setStatus("Cargando...");
  try {
    const data = await fetchWeather(currentPlace);
    render(currentPlace, data);
    setStatus("Actualizado a las " + new Date().toLocaleTimeString());
  } catch (err) {
    setStatus(err.message || "Error al cargar el clima.");
  }
}

$("search-form").addEventListener("submit", async function (event) {
  event.preventDefault();
  const name = $("location").value.trim();
  if (!name) return;
  setStatus("Buscando...");
  try {
    currentPlace = await findPlace(name);
    $("refresh").disabled = false;
    await loadWeather();
  } catch (err) {
    setStatus(err.message || "Error al buscar la ubicación.");
  }
});

$("refresh").addEventListener("click", function () {
  if (currentPlace) loadWeather();
});
