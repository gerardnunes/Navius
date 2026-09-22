// Mapa (seção 2, Modo B) — clique para selecionar ponto e criar marcador.
const mapa = L.map("mapa").setView([-15.0, -45.0], 4);

L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors, and the GIS User Community",
  maxZoom: 19,
}).addTo(mapa);
let marcadorAtual = null;

function definirMarcador(lat, lon) {
  if (marcadorAtual) {
    mapa.removeLayer(marcadorAtual);
  }
  marcadorAtual = L.marker([lat, lon]).addTo(mapa);
  document.getElementById("input-lat").value = lat.toFixed(6);
  document.getElementById("input-lon").value = lon.toFixed(6);
}

mapa.on("click", (e) => {
  definirMarcador(e.latlng.lat, e.latlng.lng);
});

// Rótulos amigáveis para as variáveis (fallback: usa a chave crua).
const ROTULOS = {
  wave_height: "Altura de onda",
  wave_direction: "Direção da onda",
  wave_period: "Período de onda",
  swell_wave_height: "Altura do swell",
  swell_wave_direction: "Direção do swell",
  swell_wave_period: "Período do swell",
  ocean_current_velocity: "Velocidade da corrente",
  ocean_current_direction: "Direção da corrente",
  sea_surface_temperature: "Temperatura da água",
  sea_level_height_msl: "Maré (nível do mar)",
  wind_speed_10m: "Vento",
  wind_direction_10m: "Direção do vento",
  pressure_msl: "Pressão atmosférica",
  temperature_2m: "Temperatura do ar",
};

function renderizarResultado(dados) {
  const statusEl = document.getElementById("status-mensagem");
  const resultadoEl = document.getElementById("resultado");

  statusEl.className = "";
  statusEl.textContent = `Local: ${dados.latitude.toFixed(6)}, ${dados.longitude.toFixed(6)}`;

  let linhas = "";
  for (const leitura of dados.readings) {
    const rotulo = ROTULOS[leitura.variable] || leitura.variable;
    const valor = leitura.value !== null
      ? `${leitura.value} ${leitura.unit}`
      : "—";
    linhas += `
      <tr>
        <td>${rotulo}</td>
        <td>${valor}</td>
        <td class="status-${leitura.status}">${leitura.status}</td>
        <td>${leitura.source}</td>
      </tr>`;
  }

  resultadoEl.innerHTML = `
    <table class="dados">
      <thead>
        <tr><th>Variável</th><th>Valor</th><th>Status</th><th>Fonte</th></tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>
  `;
}

let ultimoLocalAnalisado = null; // { lat, lon } — usado pela previsão de maré

async function analisarLocal(lat, lon) {
  const statusEl = document.getElementById("status-mensagem");
  const resultadoEl = document.getElementById("resultado");

  statusEl.className = "carregando";
  statusEl.textContent = "Consultando APIs...";
  resultadoEl.innerHTML = "";

  // Cada nova análise invalida a previsão de maré exibida anteriormente,
  // já que ela é específica do local analisado.
  document.getElementById("btn-prever-mare").disabled = true;
  document.getElementById("previsao-mare-status").textContent = "";
  document.getElementById("previsao-mare-resultado").innerHTML = "";

  try {
    const resp = await fetch(`/analyze/?lat=${lat}&lon=${lon}`);
    const dados = await resp.json();

    if (!resp.ok || !dados.ok) {
      statusEl.className = "erro";
      statusEl.textContent = dados.error || "Não foi possível analisar este local.";
      return;
    }

    renderizarResultado(dados);
    ultimoLocalAnalisado = { lat, lon };
    document.getElementById("btn-prever-mare").disabled = false;
  } catch (err) {
    statusEl.className = "erro";
    statusEl.textContent = "Falha de comunicação com o servidor.";
  }
}

async function preverMare() {
  if (!ultimoLocalAnalisado) return;
  const { lat, lon } = ultimoLocalAnalisado;

  const statusEl = document.getElementById("previsao-mare-status");
  const resultadoEl = document.getElementById("previsao-mare-resultado");

  statusEl.className = "";
  statusEl.textContent = "Treinando modelo e calculando previsão...";
  resultadoEl.innerHTML = "";

  try {
    const resp = await fetch(`/oceanography/predict-tide/?lat=${lat}&lon=${lon}&hours_ahead=2`);
    const dados = await resp.json();

    if (!resp.ok || !dados.ok) {
      statusEl.className = "erro";
      statusEl.textContent = dados.error || "Não foi possível calcular a previsão.";
      return;
    }

    statusEl.textContent = "";
    const p = dados.previsao;
    resultadoEl.innerHTML = `
      <div class="mare-resultado-valor">${p.valor_previsto_m} m</div>
      <div class="mare-detalhes">
        Daqui a ${p.horas_a_frente}h (${p.timestamp.replace("T", " ")})<br>
        Treinado em ${dados.pontos_treino} pontos · ${p.janela_treino_horas}h de histórico · R² ajuste: ${p.r2_treino}
      </div>
      <div class="mare-disclaimer">⚠️ ${p.disclaimer}</div>
    `;
  } catch (err) {
    statusEl.className = "erro";
    statusEl.textContent = "Falha de comunicação com o servidor.";
  }
}

document.getElementById("btn-prever-mare").addEventListener("click", preverMare);

document.getElementById("form-coordenadas").addEventListener("submit", (e) => {
  e.preventDefault();
  const lat = parseFloat(document.getElementById("input-lat").value);
  const lon = parseFloat(document.getElementById("input-lon").value);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return;
  definirMarcador(lat, lon);
  mapa.setView([lat, lon], 8);
  analisarLocal(lat, lon);
});

// ---------------------------------------------------------------------
// SIMULAÇÃO DE USV (Unmanned Surface Vehicle)
//
// Isto é uma SIMULAÇÃO de movimento no mapa para fins de visualização/
// planejamento, não uma integração com GNSS/telemetria real de
// embarcação (isso está na seção 3 do prompt base — "futuro modo GPS",
// ainda não implementado). Os "dados do USV" abaixo (heading, speed,
// pitch, roll) são gerados localmente no navegador para simular o
// comportamento de navegação, e são claramente identificados como tal
// no popup — nunca apresentados como leitura real de sensor.
// ---------------------------------------------------------------------

const USV_CONFIG = {
  velocidadeNos: 4,          // velocidade simulada em nós
  intervaloAtualizacaoMs: 800,
  raioAreaGraus: 0.02,       // ~2km, define o tamanho da área de "lawn-mower"
};

class SimuladorUSV {
  constructor(mapaLeaflet) {
    this.mapa = mapaLeaflet;
    this.marcador = null;
    this.rota = [];          // array de {lat, lon} — waypoints tipo "cortador de grama"
    this.indiceAtual = 0;
    this.fracaoSegmento = 0;
    this.heading = 0;
    this.rodando = false;
    this.timer = null;
    this.trilha = null;      // polyline do rastro percorrido
    this.pontosTrilha = [];
  }

  _gerarRotaLawnMower(centroLat, centroLon) {
    // Gera um padrão de varredura simples (linhas paralelas) em torno do
    // ponto clicado — típico de levantamento batimétrico real.
    const raio = USV_CONFIG.raioAreaGraus;
    const linhas = 5;
    const passo = (raio * 2) / linhas;
    const pontos = [];
    for (let i = 0; i <= linhas; i++) {
      const lat = centroLat - raio + i * passo;
      if (i % 2 === 0) {
        pontos.push({ lat, lon: centroLon - raio });
        pontos.push({ lat, lon: centroLon + raio });
      } else {
        pontos.push({ lat, lon: centroLon + raio });
        pontos.push({ lat, lon: centroLon - raio });
      }
    }
    return pontos;
  }

  iniciar(centroLat, centroLon) {
    this.parar();
    this.rota = this._gerarRotaLawnMower(centroLat, centroLon);
    this.indiceAtual = 0;
    this.fracaoSegmento = 0;
    this.pontosTrilha = [];

    const iconeUsv = L.divIcon({
      className: "icone-usv",
      html: "🚤",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const inicio = this.rota[0];
    this.marcador = L.marker([inicio.lat, inicio.lon], { icon: iconeUsv }).addTo(this.mapa);
    this.marcador.on("click", () => this._aoClicarNoUsv());

    this.trilha = L.polyline([], { color: "#2f81f7", weight: 2, dashArray: "4 4" }).addTo(this.mapa);

    this.rodando = true;
    this.timer = setInterval(() => this._passo(), USV_CONFIG.intervaloAtualizacaoMs);
  }

  parar() {
    this.rodando = false;
    if (this.timer) clearInterval(this.timer);
    if (this.marcador) { this.mapa.removeLayer(this.marcador); this.marcador = null; }
    if (this.trilha) { this.mapa.removeLayer(this.trilha); this.trilha = null; }
  }

  _passo() {
    if (!this.rodando || this.rota.length < 2) return;

    const de = this.rota[this.indiceAtual];
    const para = this.rota[(this.indiceAtual + 1) % this.rota.length];

    // Velocidade simulada: fração do segmento avançada por tick.
    const distanciaGraus = Math.hypot(para.lat - de.lat, para.lon - de.lon);
    const passoGraus = (USV_CONFIG.velocidadeNos * 0.0003) * (USV_CONFIG.intervaloAtualizacaoMs / 1000);
    const incremento = distanciaGraus > 0 ? passoGraus / distanciaGraus : 1;

    this.fracaoSegmento += incremento;
    if (this.fracaoSegmento >= 1) {
      this.fracaoSegmento = 0;
      this.indiceAtual = (this.indiceAtual + 1) % this.rota.length;
    }

    const lat = de.lat + (para.lat - de.lat) * this.fracaoSegmento;
    const lon = de.lon + (para.lon - de.lon) * this.fracaoSegmento;

    this.heading = (Math.atan2(para.lon - de.lon, para.lat - de.lat) * 180) / Math.PI;
    if (this.heading < 0) this.heading += 360;

    this.marcador.setLatLng([lat, lon]);
    this.pontosTrilha.push([lat, lon]);
    if (this.pontosTrilha.length > 300) this.pontosTrilha.shift();
    this.trilha.setLatLngs(this.pontosTrilha);
  }

  async _aoClicarNoUsv() {
    const pos = this.marcador.getLatLng();
    const pitchSimulado = (Math.random() * 4 - 2).toFixed(1);   // graus, só ilustrativo
    const rollSimulado = (Math.random() * 6 - 3).toFixed(1);    // graus, só ilustrativo

    this.marcador.bindPopup("Carregando condições do local...").openPopup();

    try {
      const resp = await fetch(`/analyze/?lat=${pos.lat}&lon=${pos.lng}`);
      const dados = await resp.json();

      let linhasHtml = "";
      if (dados.ok) {
        for (const leitura of dados.readings) {
          const rotulo = ROTULOS[leitura.variable] || leitura.variable;
          const valor = leitura.value !== null ? `${leitura.value} ${leitura.unit}` : "—";
          linhasHtml += `<tr><td>${rotulo}</td><td>${valor}</td></tr>`;
        }
      }

      this.marcador.setPopupContent(`
        <div class="popup-usv">
          <strong>USV — telemetria simulada</strong>
          <table class="dados-popup">
            <tr><td>Latitude</td><td>${pos.lat.toFixed(6)}</td></tr>
            <tr><td>Longitude</td><td>${pos.lng.toFixed(6)}</td></tr>
            <tr><td>Rumo (heading)</td><td>${this.heading.toFixed(0)}°</td></tr>
            <tr><td>Velocidade</td><td>${USV_CONFIG.velocidadeNos} kn (simulado)</td></tr>
            <tr><td>Pitch</td><td>${pitchSimulado}° (simulado)</td></tr>
            <tr><td>Roll</td><td>${rollSimulado}° (simulado)</td></tr>
          </table>
          <strong>Condições ambientais no local (dados reais)</strong>
          <table class="dados-popup">${linhasHtml || "<tr><td colspan=2>indisponível</td></tr>"}</table>
        </div>
      `);
    } catch (err) {
      this.marcador.setPopupContent("Falha ao consultar condições do local.");
    }
  }
}

const usv = new SimuladorUSV(mapa);

document.getElementById("btn-usv-iniciar").addEventListener("click", () => {
  const lat = parseFloat(document.getElementById("input-lat").value) || mapa.getCenter().lat;
  const lon = parseFloat(document.getElementById("input-lon").value) || mapa.getCenter().lng;
  usv.iniciar(lat, lon);
  document.getElementById("btn-usv-iniciar").disabled = true;
  document.getElementById("btn-usv-parar").disabled = false;
});

document.getElementById("btn-usv-parar").addEventListener("click", () => {
  usv.parar();
  document.getElementById("btn-usv-iniciar").disabled = false;
  document.getElementById("btn-usv-parar").disabled = true;
});
