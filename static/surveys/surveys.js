function getCookie(name) {
  const valor = document.cookie.split("; ").find((row) => row.startsWith(name + "="));
  return valor ? decodeURIComponent(valor.split("=")[1]) : null;
}

const mapaSurvey = L.map("mapa-survey").setView([-15.0, -45.0], 4);
L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors, and the GIS User Community",
  maxZoom: 19,
}).addTo(mapaSurvey);
let camadaPontos = null;
let graficoPerfil = null;
let surveyAtualId = null;

// Escala de cor simples por profundidade: raso (amarelo) -> fundo (azul escuro).
// Puramente visual, não é um datum nem correção batimétrica.
function corPorProfundidade(depth, min, max) {
  if (max === min) return "#2f81f7";
  const t = (depth - min) / (max - min);
  const r = Math.round(255 * (1 - t));
  const g = Math.round(220 * (1 - t) + 30 * t);
  const b = Math.round(50 + 200 * t);
  return `rgb(${r},${g},${b})`;
}

function plotarPontos(pontos, statsInfo) {
  if (camadaPontos) mapaSurvey.removeLayer(camadaPontos);

  const grupo = L.layerGroup();
  const min = statsInfo.profundidade_min;
  const max = statsInfo.profundidade_max;

  for (const p of pontos) {
    const cor = p.is_outlier ? "#f85149" : corPorProfundidade(p.depth, min, max);
    const raio = p.is_outlier ? 6 : 4;
    const circulo = L.circleMarker([p.latitude, p.longitude], {
      radius: raio,
      color: cor,
      fillColor: cor,
      fillOpacity: 0.85,
      weight: p.is_outlier ? 2 : 1,
    });
    circulo.bindPopup(`
      <strong>Ponto #${p.ordem}</strong><br>
      Profundidade: ${p.depth} m ${p.is_outlier ? "<span class='ponto-outlier'>(outlier)</span>" : ""}<br>
      Horário: ${p.timestamp.replace("T", " ")}<br>
      Lat/Lon: ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}
    `);
    grupo.addLayer(circulo);
  }

  camadaPontos = grupo.addTo(mapaSurvey);

  if (pontos.length > 0) {
    const bounds = L.latLngBounds(pontos.map((p) => [p.latitude, p.longitude]));
    mapaSurvey.fitBounds(bounds, { padding: [30, 30] });
  }
}

function renderizarStats(survey) {
  document.getElementById("stats-survey").innerHTML = `
    <table>
      <tr><td>Total de pontos</td><td>${survey.total_pontos}</td></tr>
      <tr><td>Pontos inválidos (ignorados)</td><td>${survey.total_pontos_invalidos}</td></tr>
      <tr><td>Profundidade mínima</td><td>${survey.profundidade_min} m</td></tr>
      <tr><td>Profundidade máxima</td><td>${survey.profundidade_max} m</td></tr>
      <tr><td>Profundidade média</td><td>${survey.profundidade_media} m</td></tr>
      <tr><td>Desvio padrão</td><td>${survey.profundidade_desvio_padrao} m</td></tr>
    </table>
  `;
}

async function carregarSurvey(surveyId) {
  surveyAtualId = surveyId;
  document.getElementById("btn-correlacionar").disabled = false;
  document.getElementById("correlacao-resultado").innerHTML = "";
  document.getElementById("correlacao-status").textContent = "";

  const respPontos = await fetch(`/surveys/${surveyId}/points/`);
  const dadosPontos = await respPontos.json();
  if (!dadosPontos.ok) return;

  renderizarStats(dadosPontos.survey);
  plotarPontos(dadosPontos.pontos, dadosPontos.survey);

  const respPerfil = await fetch(`/surveys/${surveyId}/profile/`);
  const dadosPerfil = await respPerfil.json();
  if (dadosPerfil.ok) renderizarPerfil(dadosPerfil.perfil);
}

function renderizarPerfil(perfil) {
  const ctx = document.getElementById("grafico-perfil").getContext("2d");
  if (graficoPerfil) graficoPerfil.destroy();

  graficoPerfil = new Chart(ctx, {
    type: "line",
    data: {
      labels: perfil.map((p) => p.distancia_m.toFixed(0)),
      datasets: [{
        label: "Profundidade (m)",
        data: perfil.map((p) => p.depth),
        borderColor: "#2f81f7",
        pointBackgroundColor: perfil.map((p) => (p.is_outlier ? "#f85149" : "#2f81f7")),
        pointRadius: perfil.map((p) => (p.is_outlier ? 5 : 2)),
        tension: 0.15,
      }],
    },
    options: {
      scales: {
        y: { reverse: true, title: { display: true, text: "Profundidade (m)" } },
        x: { title: { display: true, text: "Distância percorrida (m)" } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

document.getElementById("form-upload").addEventListener("submit", async (e) => {
  e.preventDefault();
  const arquivo = document.getElementById("input-arquivo").files[0];
  const nome = document.getElementById("input-nome").value;
  const statusEl = document.getElementById("upload-status");

  if (!arquivo) return;

  const formData = new FormData();
  formData.append("arquivo", arquivo);
  formData.append("nome", nome);

  statusEl.className = "carregando";
  statusEl.textContent = "Importando e validando arquivo...";

  try {
    const resp = await fetch("/surveys/upload/", {
      method: "POST",
      headers: { "X-CSRFToken": getCookie("csrftoken") },
      body: formData,
    });
    const dados = await resp.json();

    if (!resp.ok || !dados.ok) {
      statusEl.className = "erro";
      let msg = dados.error || "Falha ao importar o arquivo.";
      if (dados.erros && dados.erros.length) {
        msg += " Primeiros erros: " + dados.erros.slice(0, 3).map((e) => `linha ${e.linha}: ${e.motivo}`).join("; ");
      }
      statusEl.textContent = msg;
      return;
    }

    statusEl.className = "sucesso";
    statusEl.textContent = `Importado: ${dados.total_pontos} pontos válidos, ${dados.total_pontos_invalidos} inválidos (${dados.stats.total_outliers} outliers detectados).`;

    const select = document.getElementById("select-survey");
    const option = document.createElement("option");
    option.value = dados.survey_id;
    option.textContent = `${nome || arquivo.name} (${dados.total_pontos} pontos)`;
    select.appendChild(option);
    select.value = dados.survey_id;
    carregarSurvey(dados.survey_id);
  } catch (err) {
    statusEl.className = "erro";
    statusEl.textContent = "Falha de comunicação com o servidor.";
  }
});

document.getElementById("select-survey").addEventListener("change", (e) => {
  if (e.target.value) carregarSurvey(e.target.value);
});

document.getElementById("btn-correlacionar").addEventListener("click", async () => {
  if (!surveyAtualId) return;
  const statusEl = document.getElementById("correlacao-status");
  const resultadoEl = document.getElementById("correlacao-resultado");

  statusEl.textContent = "Consultando condições ambientais para cada ponto (pode levar alguns segundos)...";
  resultadoEl.innerHTML = "";

  try {
    const resp = await fetch(`/surveys/${surveyAtualId}/environment/`);
    const dados = await resp.json();
    if (!dados.ok) {
      statusEl.textContent = "Falha ao correlacionar.";
      return;
    }

    statusEl.textContent = `${dados.correlacao.length} pontos correlacionados.`;

    let linhas = "";
    for (const item of dados.correlacao) {
      const onda = item.condicoes_ambientais.find((c) => c.variable === "wave_height");
      const mare = item.condicoes_ambientais.find((c) => c.variable === "sea_level_height_msl");
      const corrente = item.condicoes_ambientais.find((c) => c.variable === "ocean_current_velocity");

      const fmt = (r) => (r && r.value !== null ? `${r.value} ${r.unit}` : "—");

      linhas += `<tr>
        <td>#${item.ordem}</td>
        <td>${item.depth} m</td>
        <td>${item.timestamp.replace("T", " ")}</td>
        <td>${fmt(onda)}</td>
        <td>${fmt(mare)}</td>
        <td>${fmt(corrente)}</td>
      </tr>`;
    }

    resultadoEl.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>Profund.</th><th>Horário</th><th>Onda</th><th>Maré</th><th>Corrente</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
    `;
  } catch (err) {
    statusEl.textContent = "Falha de comunicação com o servidor.";
  }
});
