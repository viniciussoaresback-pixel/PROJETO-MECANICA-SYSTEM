// Início do sistema: escolhe o modo (nuvem ou demonstração), mostra a tela de entrada,
// monta o menu e cuida da navegação entre as telas.
import { abrirBusca } from './busca.js';
import { agendaDoDia, despesasAVencer, estoqueBaixo } from './dominio.js';
import { criarAdaptadorLocal, gravarDadosLocais, PAPEIS, pode, store } from './store.js';
import {
  $$, abrirMenu, confirmar, esqueletoLinhas, fecharMenu, fecharModalTopo, html, icone, iniciais, modalAberto, toast, vazio,
} from './ui.js';
import { agoraISO, proximoNumero, STATUS_ABERTOS, validarEmail } from './utils.js';

export const VERSAO_APP = '2.0.0';

// ---------- Telas (rotas) ----------
const MENU = [
  { id: 'painel', titulo: 'Painel', icone: 'layout-dashboard', grupo: 'Operação' },
  { id: 'os', titulo: 'Ordens de serviço', icone: 'clipboard-list', grupo: 'Operação' },
  { id: 'agenda', titulo: 'Agenda', icone: 'calendar', grupo: 'Operação' },
  { id: 'clientes', titulo: 'Clientes', icone: 'users', grupo: 'Cadastros' },
  { id: 'veiculos', titulo: 'Veículos', icone: 'car', grupo: 'Cadastros' },
  { id: 'estoque', titulo: 'Estoque', icone: 'package', grupo: 'Cadastros' },
  { id: 'servicos', titulo: 'Serviços', icone: 'wrench', grupo: 'Cadastros' },
  { id: 'equipe', titulo: 'Equipe', icone: 'hard-hat', grupo: 'Cadastros', permissao: 'equipe' },
  { id: 'financeiro', titulo: 'Financeiro', icone: 'wallet', grupo: 'Gestão', permissao: 'financeiro' },
  { id: 'relatorios', titulo: 'Relatórios', icone: 'chart-column', grupo: 'Gestão', permissao: 'relatorios' },
  { id: 'config', titulo: 'Configurações', icone: 'settings', grupo: 'Gestão' },
];

const MODULOS = {
  painel: () => import('./views/painel.js'),
  os: () => import('./views/ordens.js'),
  osEditor: () => import('./views/os.js'),
  agenda: () => import('./views/agenda.js'),
  clientes: () => import('./views/clientes.js'),
  cliente: () => import('./views/cliente.js'),
  veiculos: () => import('./views/veiculos.js'),
  veiculo: () => import('./views/veiculo.js'),
  estoque: () => import('./views/estoque.js'),
  servicos: () => import('./views/servicos.js'),
  equipe: () => import('./views/equipe.js'),
  financeiro: () => import('./views/financeiro.js'),
  relatorios: () => import('./views/relatorios.js'),
  config: () => import('./views/config.js'),
};

function lerRota() {
  const bruto = (location.hash || '#/painel').replace(/^#\/?/, '');
  const [caminho, qs] = bruto.split('?');
  const partes = caminho.split('/').filter(Boolean).map(decodeURIComponent);
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const raiz = partes[0] || 'painel';
  let modulo = raiz;
  if (raiz === 'os' && partes[1]) modulo = 'osEditor';
  else if (raiz === 'clientes' && partes[1]) modulo = 'cliente';
  else if (raiz === 'veiculos' && partes[1]) modulo = 'veiculo';
  const item = MENU.find((m) => m.id === raiz);
  return { raiz, partes, query, modulo: MODULOS[modulo] ? modulo : null, item, hash: location.hash || '#/painel' };
}

export function navegar(destino, { substituir = false } = {}) {
  const h = destino.startsWith('#') ? destino : `#/${destino.replace(/^\//, '')}`;
  if (substituir) {
    history.replaceState(null, '', h);
    aoMudarHash();
  } else location.hash = h;
}

// ---------- Tema ----------
export function temaAtual() {
  try {
    return localStorage.getItem('mp:tema') || 'auto';
  } catch {
    return 'auto';
  }
}
export function aplicarTema(pref = temaAtual()) {
  const escuro = pref === 'escuro' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', escuro ? '#0b1120' : '#0f172a');
}
export function definirTema(pref) {
  try {
    localStorage.setItem('mp:tema', pref);
  } catch {
    /* ok */
  }
  aplicarTema(pref);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicarTema());

// ---------- Estado da navegação ----------
let atual = null; // { hash, inst, modulo }
let nuvem = null; // módulo nuvem.js quando em modo nuvem
let cadastroPendente = null;
let raizApp = null;

const raiz = () => document.getElementById('app');

function telaCarregando(texto = 'Carregando…') {
  raiz().innerHTML = html`<div class="tela-cheia"><div class="carregando-marca">${icone('wrench')}</div><p>${texto}</p><div class="barra-indeterminada"></div></div>`;
}

function telaErro(texto, { detalhe = '', botoes = '' } = {}) {
  raiz().innerHTML = html`<div class="tela-cheia">
    <div class="carregando-marca erro">${icone('triangle-alert')}</div>
    <h2>Não foi possível abrir o sistema</h2>
    <p>${texto}</p>
    ${detalhe ? html`<p class="texto-3">${detalhe}</p>` : ''}
    <div class="linha-botoes">${botoes}</div>
  </div>`;
}

// ---------- Tela de entrada ----------
function telaEntrada({ erroNuvem = false, mensagem = '' } = {}) {
  atual = null;
  raizApp = null;
  document.title = 'Entrar · Mecânica Pro';
  raiz().innerHTML = html`<div class="entrada">
    <section class="entrada-marca">
      <div class="entrada-logo">${icone('wrench')}<span>Mecânica Pro</span></div>
      <h1>O sistema completo da sua oficina, simples de usar.</h1>
      <ul class="entrada-lista">
        <li>${icone('clipboard-list')}<div><strong>Ordens de serviço e orçamentos</strong><span>Do orçamento à entrega, com impressão e assinatura.</span></div></li>
        <li>${icone('users')}<div><strong>Clientes e veículos</strong><span>Histórico completo de cada carro, por placa.</span></div></li>
        <li>${icone('package')}<div><strong>Estoque automático</strong><span>As peças saem do estoque sozinhas quando a OS fica pronta.</span></div></li>
        <li>${icone('message-circle')}<div><strong>WhatsApp integrado</strong><span>Envie orçamento, aviso de “pronto” e lembrete de revisão.</span></div></li>
        <li>${icone('wallet')}<div><strong>Financeiro e relatórios</strong><span>Contas a receber, despesas, comissões e faturamento.</span></div></li>
      </ul>
    </section>
    <section class="entrada-form">
      <div class="cartao-entrada">
        <div class="entrada-logo so-celular">${icone('wrench')}<span>Mecânica Pro</span></div>
        ${erroNuvem
          ? html`<div class="aviso aviso-erro">${icone('cloud-off')}<span>Não foi possível conectar ao servidor. Verifique a internet e <a href="" data-recarregar>tente de novo</a>.</span></div>`
          : ''}
        ${mensagem ? html`<div class="aviso aviso-erro">${icone('circle-alert')}<span>${mensagem}</span></div>` : ''}
        <div class="abas abas-entrada" role="tablist">
          <button type="button" role="tab" class="aba ativa" data-aba="entrar">Entrar</button>
          <button type="button" role="tab" class="aba" data-aba="criar">Criar conta</button>
        </div>
        <form class="form" data-form="entrar" novalidate>
          <div class="campo"><label for="ent-email">E-mail</label><input id="ent-email" name="email" type="email" autocomplete="username" required></div>
          <div class="campo"><label for="ent-senha">Senha</label>
            <div class="campo-senha"><input id="ent-senha" name="senha" type="password" autocomplete="current-password" required>
            <button type="button" class="btn-icone" data-ver-senha aria-label="Mostrar senha">${icone('eye')}</button></div>
          </div>
          <p class="form-erro" hidden></p>
          <button type="submit" class="btn btn-primario btn-largo">Entrar</button>
          <button type="button" class="link" data-esqueci>Esqueci minha senha</button>
        </form>
        <form class="form" data-form="criar" novalidate hidden>
          <div class="campo"><label for="cri-oficina">Nome da oficina</label><input id="cri-oficina" name="oficina" type="text" placeholder="Ex.: Auto Center Silva"></div>
          <div class="campo"><label for="cri-nome">Seu nome</label><input id="cri-nome" name="nome" type="text" autocomplete="name" required></div>
          <div class="campo"><label for="cri-email">E-mail</label><input id="cri-email" name="email" type="email" autocomplete="username" required></div>
          <div class="campo"><label for="cri-senha">Senha (mínimo 6 caracteres)</label>
            <div class="campo-senha"><input id="cri-senha" name="senha" type="password" autocomplete="new-password" required minlength="6">
            <button type="button" class="btn-icone" data-ver-senha aria-label="Mostrar senha">${icone('eye')}</button></div>
          </div>
          <p class="campo-ajuda">Foi convidado por uma oficina? Use o mesmo e-mail do convite — você entra direto na oficina que convidou.</p>
          <p class="form-erro" hidden></p>
          <button type="submit" class="btn btn-primario btn-largo">Criar conta</button>
        </form>
        <div class="divisor"><span>ou</span></div>
        <button type="button" class="btn btn-largo" data-demo>${icone('sparkles')}Conhecer o sistema com dados de exemplo</button>
        <p class="entrada-rodape">Mecânica Pro · versão ${VERSAO_APP}</p>
      </div>
    </section>
  </div>`;

  const el = raiz();
  el.querySelector('[data-recarregar]')?.addEventListener('click', (e) => {
    e.preventDefault();
    location.reload();
  });
  for (const b of $$('[data-aba]', el)) {
    b.onclick = () => {
      for (const x of $$('[data-aba]', el)) x.classList.toggle('ativa', x === b);
      for (const f of $$('[data-form]', el)) f.hidden = f.dataset.form !== b.dataset.aba;
      el.querySelector(`[data-form=${b.dataset.aba}] input`)?.focus();
    };
  }
  for (const b of $$('[data-ver-senha]', el)) {
    b.onclick = () => {
      const i = b.parentElement.querySelector('input');
      i.type = i.type === 'password' ? 'text' : 'password';
    };
  }
  el.querySelector('[data-demo]').onclick = () => entrarDemo();

  const fEntrar = el.querySelector('[data-form=entrar]');
  const fCriar = el.querySelector('[data-form=criar]');
  const erro = (f, msg) => {
    const p = f.querySelector('.form-erro');
    p.textContent = msg || '';
    p.hidden = !msg;
  };
  const ocupado = (f, sim) => {
    const b = f.querySelector('[type=submit]');
    b.disabled = sim;
    b.classList.toggle('carregando', sim);
  };

  fEntrar.onsubmit = async (e) => {
    e.preventDefault();
    erro(fEntrar, '');
    const email = fEntrar.email.value.trim();
    const senha = fEntrar.senha.value;
    if (!validarEmail(email)) return erro(fEntrar, 'Informe um e-mail válido.');
    if (!senha) return erro(fEntrar, 'Informe a senha.');
    if (!nuvem) return erro(fEntrar, 'Sem conexão com o servidor. Recarregue a página.');
    ocupado(fEntrar, true);
    try {
      await nuvem.entrar(email, senha);
    } catch (err) {
      erro(fEntrar, nuvem.mensagemErro(err));
      ocupado(fEntrar, false);
    }
  };
  el.querySelector('[data-esqueci]').onclick = async () => {
    const email = fEntrar.email.value.trim();
    if (!validarEmail(email)) {
      erro(fEntrar, 'Digite seu e-mail acima e clique de novo em “Esqueci minha senha”.');
      fEntrar.email.focus();
      return;
    }
    if (!nuvem) return erro(fEntrar, 'Sem conexão com o servidor.');
    try {
      await nuvem.recuperarSenha(email);
      toast('Enviamos um e-mail com o link para criar uma nova senha.', 'ok', { duracao: 8000 });
    } catch (err) {
      erro(fEntrar, nuvem.mensagemErro(err));
    }
  };
  fCriar.onsubmit = async (e) => {
    e.preventDefault();
    erro(fCriar, '');
    const d = { oficina: fCriar.oficina.value.trim(), nome: fCriar.nome.value.trim(), email: fCriar.email.value.trim(), senha: fCriar.senha.value };
    if (!d.nome) return erro(fCriar, 'Informe seu nome.');
    if (!validarEmail(d.email)) return erro(fCriar, 'Informe um e-mail válido.');
    if (d.senha.length < 6) return erro(fCriar, 'A senha precisa ter pelo menos 6 caracteres.');
    if (!nuvem) return erro(fCriar, 'Sem conexão com o servidor. Recarregue a página.');
    ocupado(fCriar, true);
    cadastroPendente = { nome: d.nome, nomeOficina: d.oficina, criando: true };
    try {
      await nuvem.criarConta({ email: d.email, senha: d.senha, nome: d.nome });
    } catch (err) {
      cadastroPendente = null;
      erro(fCriar, nuvem.mensagemErro(err));
      ocupado(fCriar, false);
    }
  };
  // Foca o e-mail só se a pessoa ainda não clicou em outro campo.
  requestAnimationFrame(() => {
    if (!document.activeElement || document.activeElement === document.body) el.querySelector('#ent-email')?.focus();
  });
}

// ---------- Modos ----------
async function entrarDemo() {
  try {
    localStorage.setItem('mp:modo', 'demo');
  } catch {
    /* ok */
  }
  telaCarregando('Preparando a demonstração…');
  const ad = criarAdaptadorLocal('demo');
  if (!ad.existeDados()) {
    const { gerarDemo } = await import('./demo.js');
    gravarDadosLocais('demo', gerarDemo());
  }
  await store.conectar(ad, { modo: 'demo', usuario: { uid: 'demo', email: '', nome: 'Visitante', papel: 'dono' }, oficinaId: 'demo' });
  montarApp();
}

export async function sairDemo() {
  try {
    localStorage.removeItem('mp:modo');
  } catch {
    /* ok */
  }
  store.desconectar();
  history.replaceState(null, '', location.pathname);
  location.reload();
}

export async function recomecarDemo() {
  const ad = criarAdaptadorLocal('demo');
  ad.apagarTudo();
  const { gerarDemo } = await import('./demo.js');
  gravarDadosLocais('demo', gerarDemo());
  history.replaceState(null, '', location.pathname);
  location.reload();
}

export async function sair() {
  if (atual?.inst?.podeSair && !(await atual.inst.podeSair())) return;
  if (store.estado.modo === 'demo') return sairDemo();
  if (store.gravacoesPendentes() > 0) {
    const ok = await confirmar({ titulo: 'Ainda enviando dados', texto: 'Algumas alterações ainda não chegaram ao servidor (internet lenta ou desligada). Se sair agora, elas podem se perder.', ok: 'Sair mesmo assim', perigo: true });
    if (!ok) return;
  }
  store.desconectar();
  raizApp = null;
  telaCarregando('Saindo…');
  history.replaceState(null, '', location.pathname);
  await nuvem?.encerrarSessao();
  location.reload();
}

export function moduloNuvem() {
  return nuvem;
}

async function iniciarNuvem() {
  telaCarregando('Conectando…');
  try {
    nuvem = await import('./nuvem.js');
    await nuvem.carregarFirebase();
  } catch (e) {
    console.error(e);
    nuvem = null;
    telaEntrada({ erroNuvem: true });
    return;
  }
  nuvem.observarLogin(async (user) => {
    if (store.estado.modo === 'demo') return;
    if (!user) {
      if (store.estado.conectado) store.desconectar();
      telaEntrada();
      return;
    }
    if (store.estado.conectado && store.estado.usuario?.uid === user.uid) return;
    telaCarregando('Abrindo sua oficina…');
    const extra = cadastroPendente || {};
    cadastroPendente = null;
    let sessao;
    try {
      sessao = await nuvem.resolverOficina(user, extra);
    } catch (e) {
      console.error(e);
      if (e.code === 'cadastro-fechado') await user.delete().catch(() => {});
      await nuvem.sair().catch(() => {});
      telaEntrada({ mensagem: nuvem.mensagemErro(e) });
      return;
    }
    try {
      store.aoErroLeitura = (e) => {
        if (e?.code === 'permission-denied') {
          store.desconectar();
          telaErro(nuvem.mensagemErro(e), { botoes: html`<button class="btn" data-sair>Sair</button><button class="btn btn-primario" data-recarregar>Tentar de novo</button>` });
          raiz().querySelector('[data-sair]').onclick = () => nuvem.sair();
          raiz().querySelector('[data-recarregar]').onclick = () => location.reload();
        }
      };
      await store.conectar(nuvem.criarAdaptadorNuvem(sessao.oficinaId, { papel: sessao.papel }), {
        modo: 'nuvem',
        usuario: { uid: user.uid, email: user.email, nome: sessao.nome || user.displayName || user.email, papel: sessao.papel },
        oficinaId: sessao.oficinaId,
      });
    } catch (e) {
      console.error(e);
      if (!raiz().querySelector('.tela-cheia h2')) {
        telaErro(nuvem.mensagemErro(e), { botoes: html`<button class="btn" data-sair>Sair</button><button class="btn btn-primario" data-recarregar>Tentar de novo</button>` });
        raiz().querySelector('[data-sair]').onclick = () => nuvem.sair();
        raiz().querySelector('[data-recarregar]').onclick = () => location.reload();
      }
      return;
    }
    montarApp();
    if (sessao.entrouAgora) toast(`Bem-vindo(a)! Você entrou na oficina como ${PAPEIS[sessao.papel]?.nome || sessao.papel}.`, 'ok', { duracao: 7000 });
    if (sessao.novo && !store.estado.config.nome && extra.nomeOficina) store.salvarConfig({ nome: extra.nomeOficina });
    if (sessao.papel === 'dono' && sessao.oficinaId === user.uid && !store.estado.config.migracaoV1) migrarVersaoAntiga(user.uid);
  });
}

async function migrarVersaoAntiga(uid) {
  try {
    const r = await nuvem.migrarDadosAntigos(uid, { proximoNumero: proximoNumero(store.todos('ordens')) });
    if (r) {
      store.lote(r.ops);
      toast(`Trouxemos da versão anterior: ${r.resumo.clientes} clientes, ${r.resumo.veiculos} veículos e ${r.resumo.ordens} ordens de serviço.`, 'ok', { duracao: 10000 });
    }
    store.salvarConfig({ migracaoV1: agoraISO() });
  } catch (e) {
    console.warn('Migração da versão anterior não concluída', e);
  }
}

// ---------- Estrutura do sistema (menu + topo) ----------
function montarApp() {
  const u = store.estado.usuario;
  const demo = store.estado.modo === 'demo';
  const itens = MENU.filter((m) => !m.permissao || pode(m.permissao));
  const grupos = [...new Set(itens.map((m) => m.grupo))];
  raiz().innerHTML = html`<div class="app">
    <aside class="lateral" id="lateral" aria-label="Menu principal">
      <div class="lateral-marca">
        <div class="marca-icone" data-logo>${icone('wrench')}</div>
        <div class="marca-texto"><strong data-nome-oficina></strong><small>Mecânica Pro</small></div>
      </div>
      <nav class="lateral-nav">
        ${grupos.map((g) => html`<div class="nav-grupo">${g}</div>
          ${itens.filter((m) => m.grupo === g).map((m) => html`<a href="#/${m.id}" class="nav-item" data-rota="${m.id}">${icone(m.icone)}<span>${m.titulo}</span><em class="nav-contador" data-contador="${m.id}" hidden></em></a>`)}`)}
      </nav>
      <div class="lateral-rodape">
        <button type="button" class="usuario" data-menu-usuario aria-label="Menu do usuário">
          <span class="avatar">${iniciais(u?.nome)}</span>
          <span class="usuario-texto"><strong>${u?.nome || 'Usuário'}</strong><small>${demo ? 'Demonstração' : PAPEIS[u?.papel]?.nome || ''}</small></span>
          ${icone('ellipsis-vertical')}
        </button>
      </div>
    </aside>
    <div class="cortina" data-fechar-menu></div>
    <div class="principal">
      <header class="topo">
        <button type="button" class="btn-icone so-menu-movel" data-abrir-menu aria-label="Abrir menu">${icone('menu')}</button>
        <h1 class="topo-titulo" id="titulo-pagina">Painel</h1>
        <button type="button" class="busca-global" data-abrir-busca aria-label="Buscar (Ctrl+K)">${icone('search')}<span>Buscar cliente, placa ou OS…</span><kbd>Ctrl K</kbd></button>
        <button type="button" class="btn-icone so-celular" data-abrir-busca aria-label="Buscar">${icone('search')}</button>
        <span class="sinc" id="indicador-sinc" hidden></span>
        <button type="button" class="btn-icone" data-tema aria-label="Mudar tema claro/escuro">${icone(document.documentElement.dataset.tema === 'escuro' ? 'sun' : 'moon')}</button>
        <a href="#/os/nova" class="btn btn-primario topo-nova">${icone('plus')}<span>Nova OS</span></a>
      </header>
      <div id="faixas"></div>
      <main id="conteudo" class="conteudo" tabindex="-1"></main>
    </div>
  </div>`;
  raizApp = raiz().querySelector('.app');
  atualizarMarca();
  atualizarContadores();
  atualizarFaixas();

  const fecharMenuMovel = () => raizApp.classList.remove('menu-aberto');
  raizApp.querySelector('[data-abrir-menu]').onclick = () => raizApp.classList.add('menu-aberto');
  raizApp.querySelector('[data-fechar-menu]').onclick = fecharMenuMovel;
  for (const b of $$('[data-abrir-busca]', raizApp)) b.onclick = () => abrirBusca();
  raizApp.querySelector('[data-tema]').onclick = (e) => {
    const novo = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro';
    definirTema(novo);
    e.currentTarget.innerHTML = String(icone(novo === 'escuro' ? 'sun' : 'moon'));
  };
  raizApp.querySelector('[data-menu-usuario]').onclick = (e) => {
    abrirMenu(e.currentTarget, [
      { texto: 'Configurações', icone: 'settings', fn: () => navegar('config') },
      { texto: 'Atalhos do teclado', icone: 'circle-help', fn: mostrarAtalhos },
      '-',
      demo ? { texto: 'Sair da demonstração', icone: 'log-out', fn: sairDemo } : { texto: 'Sair', icone: 'log-out', perigo: true, fn: sair },
    ]);
  };
  for (const a of $$('.nav-item', raizApp)) a.addEventListener('click', fecharMenuMovel);

  window.removeEventListener('hashchange', aoMudarHash);
  window.addEventListener('hashchange', aoMudarHash);
  atual = null;
  aoMudarHash();
}

function atualizarMarca() {
  if (!raizApp) return;
  const cfg = store.estado.config;
  raizApp.querySelector('[data-nome-oficina]').textContent = cfg.nome || 'Minha oficina';
  const logo = raizApp.querySelector('[data-logo]');
  logo.innerHTML = cfg.logo ? html`<img src="${cfg.logo}" alt="">`.toString() : String(icone('wrench'));
  logo.classList.toggle('com-logo', !!cfg.logo);
}

function atualizarContadores() {
  if (!raizApp) return;
  const contar = {
    os: store.todos('ordens').filter((o) => STATUS_ABERTOS.includes(o.status)).length,
    agenda: agendaDoDia().filter((a) => a.status !== 'concluido' && a.status !== 'faltou').length,
    estoque: estoqueBaixo().length,
    financeiro: pode('financeiro') ? despesasAVencer(0).length : 0,
  };
  for (const el of $$('[data-contador]', raizApp)) {
    const n = contar[el.dataset.contador] || 0;
    el.hidden = !n;
    el.textContent = n > 99 ? '99+' : String(n);
    el.classList.toggle('alerta', ['estoque', 'financeiro'].includes(el.dataset.contador));
    const titulos = { os: 'OS em aberto', agenda: 'agendamentos hoje', estoque: 'peças com estoque baixo', financeiro: 'contas vencendo ou vencidas' };
    el.title = `${n} ${titulos[el.dataset.contador] || ''}`;
  }
}

function atualizarFaixas() {
  const area = document.getElementById('faixas');
  if (!area) return;
  const faixas = [];
  if (store.estado.modo === 'demo') {
    faixas.push(html`<div class="faixa faixa-demo">${icone('sparkles')}<span><strong>Demonstração</strong><span class="so-largo">: dados de exemplo, guardados só neste navegador. Fique à vontade para testar tudo.</span></span>
      <button type="button" class="btn btn-sm" data-sair-demo><span>Sair<span class="so-largo"> da demonstração</span></span></button></div>`);
  }
  if (store.estado.modo === 'nuvem' && !navigator.onLine) {
    faixas.push(html`<div class="faixa faixa-offline">${icone('wifi-off')}<span><strong>Sem internet.</strong> Pode continuar trabalhando: as alterações ficam guardadas e são enviadas quando a conexão voltar.</span></div>`);
  }
  area.innerHTML = html`${faixas}`.toString();
  area.querySelector('[data-sair-demo]')?.addEventListener('click', sairDemo);
}

function atualizarSincronia() {
  const el = document.getElementById('indicador-sinc');
  if (!el) return;
  const n = store.gravacoesPendentes();
  if (store.estado.modo !== 'nuvem' || !n) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = String(html`${icone(navigator.onLine ? 'refresh-cw' : 'cloud-off', navigator.onLine ? 'girando' : '')}<span>${navigator.onLine ? 'Salvando…' : 'Aguardando internet'}</span>`);
}

window.addEventListener('online', () => {
  atualizarFaixas();
  atualizarSincronia();
});
window.addEventListener('offline', () => {
  atualizarFaixas();
  atualizarSincronia();
});

store.inscrever((cols) => {
  if (!raizApp) return;
  if (cols.has('config') || cols.has('*')) atualizarMarca();
  atualizarContadores();
  atualizarSincronia();
  const relevantes = new Set([...cols].filter((c) => c !== '_sincronia'));
  if (relevantes.size) atual?.inst?.atualizar?.(relevantes);
});

store.aoErroGravacao = (e) => {
  const msg = nuvem ? nuvem.mensagemErro(e) : e?.message || 'Erro ao salvar';
  toast(`Não foi possível salvar: ${msg}`, 'erro', { duracao: 9000 });
};

// ---------- Navegação ----------
let mudando = false;
async function aoMudarHash() {
  if (!raizApp) return;
  const rota = lerRota();
  if (atual && atual.hash === rota.hash) return;
  if (mudando) return;
  if (atual?.inst?.podeSair) {
    mudando = true;
    const ok = await atual.inst.podeSair();
    mudando = false;
    if (!ok) {
      history.replaceState(null, '', atual.hash);
      return;
    }
  }
  try {
    atual?.inst?.sair?.();
  } catch (e) {
    console.error(e);
  }
  const conteudo = document.getElementById('conteudo');
  const item = rota.item || MENU[0];
  for (const a of $$('.nav-item', raizApp)) a.classList.toggle('ativo', a.dataset.rota === rota.raiz);
  document.getElementById('titulo-pagina').textContent = item.titulo;
  document.title = `${item.titulo} · ${store.estado.config.nome || 'Mecânica Pro'}`;
  const meu = { hash: rota.hash, inst: null };
  atual = meu;
  if (!rota.modulo) {
    conteudo.innerHTML = String(vazio({ icone: 'circle-help', titulo: 'Página não encontrada', texto: 'O endereço digitado não existe.', acao: html`<a class="btn btn-primario" href="#/painel">Ir para o painel</a>` }));
    return;
  }
  if (item.permissao && !pode(item.permissao)) {
    conteudo.innerHTML = String(vazio({ icone: 'lock', titulo: 'Sem acesso', texto: 'Seu perfil não tem permissão para esta área. Fale com o responsável da oficina.' }));
    return;
  }
  conteudo.innerHTML = String(html`<div class="pagina">${esqueletoLinhas(7)}</div>`);
  let mod;
  try {
    mod = await MODULOS[rota.modulo]();
  } catch (e) {
    console.error(e);
    conteudo.innerHTML = String(vazio({ icone: 'wifi-off', titulo: 'Não foi possível abrir esta tela', texto: 'Verifique a internet e tente de novo.', acao: html`<button class="btn btn-primario" onclick="location.reload()">Recarregar</button>` }));
    return;
  }
  if (atual !== meu) return; // a pessoa já foi para outra tela
  conteudo.innerHTML = '';
  conteudo.scrollTop = 0;
  window.scrollTo(0, 0);
  try {
    meu.inst = mod.default.montar(conteudo, { partes: rota.partes, query: rota.query, navegar }) || {};
  } catch (e) {
    console.error(e);
    conteudo.innerHTML = String(vazio({ icone: 'triangle-alert', titulo: 'Algo deu errado nesta tela', texto: String(e?.message || e) }));
  }
  if (meu.inst?.titulo) document.getElementById('titulo-pagina').textContent = meu.inst.titulo;
}

// Troca o endereço sem recarregar a tela (ex.: "#/os/nova" vira "#/os/<id>" depois de salvar).
export function substituirHash(h) {
  history.replaceState(null, '', h);
  if (atual) atual.hash = h;
}

export function definirTitulo(t) {
  const el = document.getElementById('titulo-pagina');
  if (el) el.textContent = t;
}

// ---------- Teclado ----------
function mostrarAtalhos() {
  import('./ui.js').then(({ abrirModal }) =>
    abrirModal({
      titulo: 'Atalhos do teclado',
      tamanho: 'sm',
      corpo: html`<dl class="atalhos">
        <dt><kbd>Ctrl</kbd> + <kbd>K</kbd> ou <kbd>/</kbd></dt><dd>Buscar cliente, placa ou OS</dd>
        <dt><kbd>Alt</kbd> + <kbd>N</kbd></dt><dd>Nova ordem de serviço</dd>
        <dt><kbd>Ctrl</kbd> + <kbd>S</kbd></dt><dd>Salvar a OS aberta</dd>
        <dt><kbd>Esc</kbd></dt><dd>Fechar janela</dd>
      </dl>`,
      fecharFora: true,
    }),
  );
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (fecharMenu()) return;
    if (modalAberto()) {
      e.preventDefault();
      fecharModalTopo();
      return;
    }
    raizApp?.classList.remove('menu-aberto');
    return;
  }
  if (!raizApp) return;
  const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (!modalAberto()) abrirBusca();
  } else if (e.key === '/' && !digitando && !modalAberto()) {
    e.preventDefault();
    abrirBusca();
  } else if (e.altKey && e.key.toLowerCase() === 'n' && !modalAberto()) {
    e.preventDefault();
    navegar('os/nova');
  }
});

window.addEventListener('beforeunload', (e) => {
  const sujo = atual?.inst?.sujo?.();
  if (sujo || (store.estado.modo === 'nuvem' && store.gravacoesPendentes() > 0)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------- Service worker (funciona sem internet / instalar no celular) ----------
function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  if (['localhost', '127.0.0.1'].includes(location.hostname) && !localStorage.getItem('mp:sw-local')) return;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker não registrado', e));
}

// ---------- Início ----------
export async function iniciar() {
  aplicarTema();
  registrarSW();
  let modo = null;
  try {
    modo = localStorage.getItem('mp:modo');
  } catch {
    /* ok */
  }
  const q = new URLSearchParams(location.search);
  if (q.has('demo')) modo = 'demo';
  if (modo === 'demo') return entrarDemo();
  return iniciarNuvem();
}
