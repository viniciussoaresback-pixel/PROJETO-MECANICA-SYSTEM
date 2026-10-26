// Service worker: deixa o sistema abrir sem internet e permite instalar no celular/computador.
// Estratégia: rede primeiro (sempre pega a versão nova quando há internet); sem internet, usa a cópia guardada.
// Arquivo novo em app/? Inclua na lista abaixo (o teste tests/unit/sw.test.mjs confere).
const VERSAO = 'mecanica-pro-v2.0.0';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './css/impressao.css',
  './img/icone.svg',
  './img/icone-192.png',
  './img/icone-512.png',
  './img/icone-maskable-512.png',
  './img/apple-touch-icon.png',
  './js/acoes-os.js',
  './js/app.js',
  './js/busca.js',
  './js/demo.js',
  './js/dominio.js',
  './js/firebase-config.js',
  './js/formularios.js',
  './js/graficos.js',
  './js/icones.js',
  './js/impressao.js',
  './js/mensagens.js',
  './js/migracao.js',
  './js/nuvem.js',
  './js/store.js',
  './js/ui.js',
  './js/utils.js',
  './js/views/agenda.js',
  './js/views/cliente.js',
  './js/views/clientes.js',
  './js/views/config.js',
  './js/views/equipe.js',
  './js/views/estoque.js',
  './js/views/financeiro.js',
  './js/views/ordens.js',
  './js/views/os.js',
  './js/views/painel.js',
  './js/views/relatorios.js',
  './js/views/servicos.js',
  './js/views/veiculo.js',
  './js/views/veiculos.js',
];

// Bibliotecas externas que podem ficar guardadas (Firebase e fontes). O banco em si nunca passa por aqui.
const EXTERNOS = [/^https:\/\/www\.gstatic\.com\/firebasejs\//, /^https:\/\/fonts\.(googleapis|gstatic)\.com\//];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSAO)
      .then((c) => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function redePrimeiro(req) {
  const cache = await caches.open(VERSAO);
  try {
    const resp = await fetch(req);
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (erro) {
    const guardado = await cache.match(req, { ignoreSearch: true });
    if (guardado) return guardado;
    if (req.mode === 'navigate') {
      const inicio = await cache.match('./index.html');
      if (inicio) return inicio;
    }
    throw erro;
  }
}

async function cacheDepoisRede(req) {
  const cache = await caches.open(VERSAO);
  const guardado = await cache.match(req);
  const buscando = fetch(req)
    .then((resp) => {
      if (resp.ok || resp.type === 'opaque') cache.put(req, resp.clone());
      return resp;
    })
    .catch(() => guardado);
  return guardado || buscando;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(redePrimeiro(req));
  } else if (EXTERNOS.some((r) => r.test(req.url))) {
    e.respondWith(cacheDepoisRede(req));
  }
});
