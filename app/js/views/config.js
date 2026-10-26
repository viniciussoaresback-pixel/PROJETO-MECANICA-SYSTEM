// Configurações: oficina, impressão, mensagens, usuários, aparência, backup e conta.
import { definirTema, moduloNuvem, recomecarDemo, sair, sairDemo, substituirHash, temaAtual } from '../app.js';
import { UFS } from '../formularios.js';
import { COLECOES, MENSAGENS_PADRAO, PAPEIS, pode, store } from '../store.js';
import {
  abrirModal, baixarArquivo, campo, confirmar, erroCampo, html, icone, iniciais, lerFormulario, limparErros, seguro, toast,
} from '../ui.js';
import { agoraISO, erroDocumento, fmtDataHora, hojeISO, mascaraDocumento, mascaraTelefone, soDigitos, validarEmail } from '../utils.js';

const SECOES = [
  { id: 'oficina', nome: 'Dados da oficina', icone: 'building-2', permissao: 'config-oficina' },
  { id: 'documentos', nome: 'Impressão e garantia', icone: 'printer', permissao: 'config-oficina' },
  { id: 'mensagens', nome: 'Mensagens do WhatsApp', icone: 'message-circle', permissao: 'config-oficina' },
  { id: 'usuarios', nome: 'Usuários e acessos', icone: 'users-round', permissao: 'usuarios', soNuvem: true },
  { id: 'aparencia', nome: 'Aparência', icone: 'sun' },
  { id: 'backup', nome: 'Backup e planilhas', icone: 'download', permissao: 'backup-exportar' },
  { id: 'conta', nome: 'Minha conta', icone: 'user' },
];

const VARIAVEIS = {
  orcamento: ['cliente', 'oficina', 'numero', 'veiculo', 'placa', 'itens', 'total', 'validade', 'pix'],
  pronto: ['cliente', 'oficina', 'numero', 'veiculo', 'placa', 'total', 'saldo', 'pix'],
  revisao: ['cliente', 'oficina', 'veiculo', 'placa', 'quando'],
  agendamento: ['cliente', 'oficina', 'data', 'hora', 'servico'],
  cobranca: ['cliente', 'oficina', 'numero', 'veiculo', 'saldo', 'pix'],
};
const NOMES_MSG = {
  orcamento: 'Envio de orçamento',
  pronto: 'Veículo pronto para retirada',
  revisao: 'Lembrete de revisão',
  agendamento: 'Confirmação de agendamento',
  cobranca: 'Lembrete de pagamento',
};

async function lerLogo(arquivo) {
  if (!arquivo.type.startsWith('image/')) throw new Error('Escolha uma imagem (PNG, JPG, WEBP ou SVG).');
  const url = await new Promise((ok, falha) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.onerror = falha;
    fr.readAsDataURL(arquivo);
  });
  const img = await new Promise((ok, falha) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => falha(new Error('Não foi possível ler esta imagem.'));
    i.src = url;
  });
  for (const max of [360, 260, 180]) {
    const esc = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || max) * esc));
    c.height = Math.max(1, Math.round((img.naturalHeight || max) * esc));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    let dado = c.toDataURL('image/webp', 0.9);
    if (!dado.startsWith('data:image/webp')) dado = c.toDataURL('image/png');
    if (dado.length < 280000) return dado;
  }
  throw new Error('A imagem é grande demais. Use uma logo menor.');
}

function validarBackup(p) {
  return p && typeof p === 'object' && p.dados && typeof p.dados === 'object' && COLECOES.some((c) => Array.isArray(p.dados[c]));
}

export default {
  montar(el, { query }) {
    const secoes = SECOES.filter((s) => (!s.permissao || pode(s.permissao)) && (!s.soNuvem || store.estado.modo === 'nuvem'));
    let atual = secoes.some((s) => s.id === query.aba) ? query.aba : secoes[0].id;
    if (query.aba) substituirHash('#/config');
    el.innerHTML = String(html`<div class="config-layout">
      <nav class="config-menu" aria-label="Seções das configurações">${secoes.map((s) => html`<button type="button" data-secao="${s.id}">${icone(s.icone)}${s.nome}</button>`)}</nav>
      <div data-painel></div>
    </div>`);
    const pg = el.firstElementChild;
    const painel = pg.querySelector('[data-painel]');

    function cartao(titulo, descricao, corpo, rodape = '') {
      return html`<section class="cartao"><div class="cartao-cab"><div><h3>${titulo}</h3>${descricao ? html`<p class="texto-3" style="font-size:13px;margin-top:2px">${descricao}</p>` : ''}</div></div>
        <div class="cartao-corpo">${corpo}</div>${rodape ? html`<div class="modal-rod" style="border-radius:0 0 var(--raio-g) var(--raio-g)">${rodape}</div>` : ''}</section>`;
    }

    // ---------- Oficina ----------
    function secaoOficina() {
      const c = store.estado.config;
      painel.innerHTML = String(html`<form class="grade" data-form novalidate>
        ${cartao('Dados da oficina', 'Aparecem no topo das ordens de serviço, orçamentos e recibos.', html`<div class="form-grade">
          ${campo({ rotulo: 'Nome da oficina', nome: 'nome', valor: c.nome, obrigatorio: true, classe: 'c-6', placeholder: 'Ex.: Auto Center Silva' })}
          ${campo({ rotulo: 'Razão social', nome: 'razaoSocial', valor: c.razaoSocial, classe: 'c-6' })}
          ${campo({ rotulo: 'CNPJ (ou CPF)', nome: 'cnpj', valor: mascaraDocumento(c.cnpj || ''), mascara: 'documento', classe: 'c-4' })}
          ${campo({ rotulo: 'Telefone', nome: 'telefone', valor: mascaraTelefone(c.telefone || ''), mascara: 'telefone', classe: 'c-4' })}
          ${campo({ rotulo: 'WhatsApp', nome: 'whatsapp', valor: mascaraTelefone(c.whatsapp || ''), mascara: 'telefone', classe: 'c-4' })}
          ${campo({ rotulo: 'E-mail', nome: 'email', tipo: 'email', valor: c.email, classe: 'c-6' })}
          ${campo({ rotulo: 'Site ou Instagram', nome: 'site', valor: c.site, classe: 'c-6' })}
          ${campo({ rotulo: 'Endereço', nome: 'endereco', valor: c.endereco, classe: 'c-6', placeholder: 'Rua, número, bairro' })}
          ${campo({ rotulo: 'Cidade', nome: 'cidade', valor: c.cidade, classe: 'c-4' })}
          ${campo({ rotulo: 'UF', nome: 'uf', tipo: 'select', valor: c.uf, opcoes: UFS, classe: 'c-2' })}
          ${campo({ rotulo: 'Chave PIX', nome: 'chavePix', valor: c.chavePix, classe: 'c-12', ajuda: 'Vai junto nas mensagens de “carro pronto” e de cobrança.' })}
        </div>`, html`<button type="submit" class="btn btn-primario">${icone('check')}Salvar dados</button>`)}
        ${cartao('Logo', 'Aparece no menu e nos documentos impressos. Prefira imagem quadrada com fundo branco ou transparente.', html`<div class="linha" style="gap:20px;align-items:center">
          <div class="logo-preview" data-preview>${c.logo ? html`<img src="${c.logo}" alt="Logo da oficina">` : icone('image')}</div>
          <div class="grupo-botoes">
            <label class="btn">${icone('upload')}Escolher imagem<input type="file" accept="image/*" data-logo hidden></label>
            ${c.logo ? html`<button type="button" class="btn btn-fantasma perigo" data-tirar-logo>${icone('trash-2')}Remover</button>` : ''}
          </div>
        </div>`)}
      </form>`);
      const form = painel.querySelector('[data-form]');
      form.onsubmit = (e) => {
        e.preventDefault();
        limparErros(form);
        const d = lerFormulario(form);
        if (!d.nome) return erroCampo(form, 'nome', 'Informe o nome da oficina');
        const eDoc = erroDocumento(d.cnpj);
        if (eDoc) return erroCampo(form, 'cnpj', eDoc);
        if (d.email && !validarEmail(d.email)) return erroCampo(form, 'email', 'E-mail inválido');
        store.salvarConfig({ ...d, cnpj: soDigitos(d.cnpj), telefone: soDigitos(d.telefone), whatsapp: soDigitos(d.whatsapp) });
        toast('Dados da oficina salvos');
      };
      form.querySelector('[data-logo]').onchange = async (e) => {
        const arq = e.target.files?.[0];
        if (!arq) return;
        try {
          const logo = await lerLogo(arq);
          store.salvarConfig({ logo });
          toast('Logo atualizada');
          secaoOficina();
        } catch (err) {
          toast(err.message, 'erro');
        }
      };
      form.querySelector('[data-tirar-logo]')?.addEventListener('click', () => {
        store.salvarConfig({ logo: '' });
        secaoOficina();
      });
    }

    // ---------- Documentos ----------
    function secaoDocumentos() {
      const c = store.estado.config;
      painel.innerHTML = String(html`<form class="grade" data-form novalidate>
        ${cartao('Impressão e garantia', 'Textos e prazos usados na OS, no orçamento e no recibo.', html`<div class="form-grade">
          ${campo({ rotulo: 'Garantia padrão (dias)', nome: 'garantiaDias', tipo: 'number', valor: c.garantiaDias, min: 0, classe: 'c-4', ajuda: 'Já vem preenchida em cada OS nova' })}
          ${campo({ rotulo: 'Validade do orçamento (dias)', nome: 'validadeOrcamentoDias', tipo: 'number', valor: c.validadeOrcamentoDias, min: 1, classe: 'c-4' })}
          <div class="c-4"></div>
          ${campo({ rotulo: 'Termo de garantia', nome: 'termoGarantia', tipo: 'textarea', valor: c.termoGarantia, linhas: 4, classe: 'c-12' })}
          ${campo({ rotulo: 'Mensagem no rodapé da OS', nome: 'rodapeOS', valor: c.rodapeOS, classe: 'c-12' })}
          ${campo({ rotulo: 'Imprimir o checklist de entrada (combustível, itens, avarias) na OS', nome: 'imprimirChecklist', tipo: 'checkbox', valor: c.imprimirChecklist, classe: 'c-12' })}
        </div>`, html`<button type="button" class="btn" data-exemplo>${icone('eye')}Ver exemplo</button><button type="submit" class="btn btn-primario">${icone('check')}Salvar</button>`)}
      </form>`);
      const form = painel.querySelector('[data-form]');
      form.onsubmit = (e) => {
        e.preventDefault();
        const d = lerFormulario(form);
        store.salvarConfig({ ...d, garantiaDias: Number(d.garantiaDias) || 0, validadeOrcamentoDias: Number(d.validadeOrcamentoDias) || 7 });
        toast('Configurações de impressão salvas');
      };
      form.querySelector('[data-exemplo]').onclick = async () => {
        const { documentoOS, visualizar } = await import('../impressao.js');
        const ultima = [...store.todos('ordens')].sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''))[0];
        const exemplo = ultima || {
          numero: 1, status: 'execucao', clienteNome: 'Cliente de exemplo', veiculoDesc: 'Carro de exemplo 2020', placa: 'ABC1D23', entrada: agoraISO(), garantiaDias: store.estado.config.garantiaDias,
          itens: [{ tipo: 'servico', descricao: 'Troca de óleo e filtro', qtd: 1, valor: 80 }, { tipo: 'peca', descricao: 'Óleo 5W30 sintético 1L', qtd: 4, valor: 55 }], pagamentos: [], checklist: { combustivel: '1/2', itens: { estepe: true } },
        };
        visualizar('Exemplo de impressão', documentoOS(exemplo, 'os'));
      };
    }

    // ---------- Mensagens ----------
    function secaoMensagens() {
      const m = store.estado.config.mensagens;
      painel.innerHTML = String(html`<form class="grade" data-form novalidate>
        ${cartao('Mensagens do WhatsApp', 'Modelos usados nos botões de WhatsApp. Clique numa variável para inserir no texto; ela é trocada pelo dado real na hora de enviar.', html`<div class="form">
          ${Object.keys(NOMES_MSG).map((k) => html`<div class="campo">
            <label for="msg-${k}">${NOMES_MSG[k]}</label>
            <textarea id="msg-${k}" name="${k}" rows="5">${m[k] || ''}</textarea>
            <div class="linha" style="justify-content:space-between">
              <div class="variaveis">${VARIAVEIS[k].map((v) => html`<code data-var="${v}" data-alvo="msg-${k}" title="Inserir">{${v}}</code>`)}</div>
              <button type="button" class="link" data-restaurar="${k}">Restaurar padrão</button>
            </div>
          </div>`)}
        </div>`, html`<button type="submit" class="btn btn-primario">${icone('check')}Salvar mensagens</button>`)}
      </form>`);
      const form = painel.querySelector('[data-form]');
      for (const v of form.querySelectorAll('[data-var]')) {
        v.onclick = () => {
          const ta = form.querySelector(`#${v.dataset.alvo}`);
          const ini = ta.selectionStart ?? ta.value.length;
          const fim = ta.selectionEnd ?? ini;
          const t = `{${v.dataset.var}}`;
          ta.value = ta.value.slice(0, ini) + t + ta.value.slice(fim);
          ta.focus();
          ta.setSelectionRange(ini + t.length, ini + t.length);
        };
      }
      for (const b of form.querySelectorAll('[data-restaurar]')) {
        b.onclick = () => {
          form.querySelector(`[name=${b.dataset.restaurar}]`).value = MENSAGENS_PADRAO[b.dataset.restaurar];
        };
      }
      form.onsubmit = (e) => {
        e.preventDefault();
        const d = lerFormulario(form);
        store.salvarConfig({ mensagens: { ...store.estado.config.mensagens, ...d } });
        toast('Mensagens salvas');
      };
    }

    // ---------- Usuários ----------
    function secaoUsuarios() {
      const nuvem = moduloNuvem();
      const eu = store.estado.usuario;
      const membros = [...store.estado.membros].sort((a, b) => (a.papel === 'dono' ? -1 : 0) - (b.papel === 'dono' ? -1 : 0) || (a.nome || '').localeCompare(b.nome || ''));
      const convites = store.estado.convites || [];
      painel.innerHTML = String(html`<div class="grade">
        ${cartao('Quem acessa o sistema', 'Cada pessoa entra com o próprio e-mail e senha, e vê só o que o perfil dela permite.', html`
          <ul class="lista" style="margin:-8px -18px">${membros.map((m) => html`<li class="lista-item">
            <span class="avatar" style="background:var(--sup-3);color:var(--txt-2)">${iniciais(m.nome || m.email)}</span>
            <span class="principal-txt"><strong>${m.nome || m.email}${m.uid === eu.uid ? ' (você)' : ''}</strong><small>${m.email}</small></span>
            ${m.uid === eu.uid || m.uid === store.estado.oficinaId
              ? html`<span class="selo selo-azul">${PAPEIS[m.papel]?.nome || m.papel}</span>`
              : html`<select data-papel="${m.uid}" aria-label="Perfil de ${m.nome}" style="width:auto;height:34px">${Object.entries(PAPEIS).map(([id, p]) => html`<option value="${id}" ${m.papel === id ? seguro('selected') : ''}>${p.nome}</option>`)}</select>
                <button type="button" class="btn-icone sm perigo" data-remover="${m.uid}" aria-label="Remover acesso">${icone('trash-2')}</button>`}
          </li>`)}</ul>`, html`<button type="button" class="btn btn-primario" data-convidar>${icone('user-plus')}Convidar pessoa</button>`)}
        ${convites.length ? cartao('Convites aguardando', 'A pessoa precisa criar a conta na tela de entrada usando exatamente este e-mail.', html`<ul class="lista" style="margin:-8px -18px">${convites.map((c) => html`<li class="lista-item">
          <span class="icone-redondo amarelo">${icone('mail')}</span>
          <span class="principal-txt"><strong>${c.nome || c.email}</strong><small>${c.email} · ${PAPEIS[c.papel]?.nome || c.papel} · enviado em ${fmtDataHora(c.criadoEm)}</small></span>
          <button type="button" class="btn btn-sm" data-cancelar="${c.email}">Cancelar</button></li>`)}</ul>`) : ''}
        ${cartao('Perfis de acesso', '', html`<dl class="dados-lista">${Object.values(PAPEIS).map((p) => html`<dt>${p.nome}</dt><dd>${p.descricao}</dd>`)}</dl>`)}
      </div>`);
      painel.querySelector('[data-convidar]').onclick = () => {
        const m = abrirModal({
          titulo: 'Convidar pessoa',
          tamanho: 'md',
          corpo: html`<form class="form" novalidate><div class="form-grade">
            ${campo({ rotulo: 'Nome', nome: 'nome', obrigatorio: true, classe: 'c-6', autofocus: true })}
            ${campo({ rotulo: 'E-mail', nome: 'email', tipo: 'email', obrigatorio: true, classe: 'c-6' })}
            ${campo({ rotulo: 'Perfil', nome: 'papel', tipo: 'select', valor: 'mecanico', opcoes: Object.entries(PAPEIS).map(([id, p]) => ({ valor: id, texto: p.nome })), classe: 'c-12' })}
          </div>
          <div class="aviso aviso-info">${icone('info')}<span>Depois de convidar, peça para a pessoa abrir o sistema, clicar em <strong>Criar conta</strong> e usar este mesmo e-mail. Ela entra direto na sua oficina.</span></div>
          <button type="submit" hidden></button></form>`,
          rodape: html`<button type="button" class="btn" data-fechar>Cancelar</button><button type="button" class="btn btn-primario" data-ok>${icone('send')}Convidar</button>`,
        });
        const form = m.el.querySelector('form');
        const enviar = async () => {
          limparErros(form);
          const d = lerFormulario(form);
          if (!d.nome) return erroCampo(form, 'nome', 'Informe o nome');
          if (!validarEmail(d.email)) return erroCampo(form, 'email', 'E-mail inválido');
          if (store.estado.membros.some((x) => x.email?.toLowerCase() === d.email.toLowerCase())) return erroCampo(form, 'email', 'Esta pessoa já tem acesso');
          try {
            await nuvem.convidar(store.estado.oficinaId, { ...d, oficinaNome: store.estado.config.nome, por: eu.nome });
            m.fechar('ok');
            toast(`Convite criado para ${d.email}`);
          } catch (e) {
            toast(nuvem.mensagemErro(e), 'erro');
          }
        };
        form.onsubmit = (e) => {
          e.preventDefault();
          enviar();
        };
        m.el.querySelector('[data-ok]').onclick = enviar;
      };
      for (const s of painel.querySelectorAll('[data-papel]')) {
        s.onchange = async () => {
          try {
            await nuvem.alterarPapel(store.estado.oficinaId, s.dataset.papel, s.value);
            toast('Perfil alterado');
          } catch (e) {
            toast(nuvem.mensagemErro(e), 'erro');
          }
        };
      }
      for (const b of painel.querySelectorAll('[data-remover]')) {
        b.onclick = async () => {
          const m = store.estado.membros.find((x) => x.uid === b.dataset.remover);
          if (!(await confirmar({ titulo: `Remover o acesso de ${m?.nome || m?.email}?`, texto: 'A pessoa não vai mais conseguir entrar nesta oficina.', ok: 'Remover', perigo: true }))) return;
          try {
            await nuvem.removerMembro(store.estado.oficinaId, b.dataset.remover);
            toast('Acesso removido');
          } catch (e) {
            toast(nuvem.mensagemErro(e), 'erro');
          }
        };
      }
      for (const b of painel.querySelectorAll('[data-cancelar]')) {
        b.onclick = async () => {
          try {
            await nuvem.cancelarConvite(b.dataset.cancelar);
            toast('Convite cancelado');
          } catch (e) {
            toast(nuvem.mensagemErro(e), 'erro');
          }
        };
      }
    }

    // ---------- Aparência ----------
    function secaoAparencia() {
      const t = temaAtual();
      painel.innerHTML = String(cartao('Aparência', 'O tema escuro cansa menos a vista em ambientes com pouca luz.', html`<div class="cartao-tema">
        ${[['claro', 'Claro'], ['escuro', 'Escuro'], ['auto', 'Automático (igual ao aparelho)']].map(([id, nome]) => html`<button type="button" class="opcao-tema ${t === id ? 'ativo' : ''}" data-tema-op="${id}"><span class="amostra ${id}"></span>${nome}</button>`)}
      </div>`));
      for (const b of painel.querySelectorAll('[data-tema-op]')) {
        b.onclick = () => {
          definirTema(b.dataset.temaOp);
          secaoAparencia();
        };
      }
    }

    // ---------- Backup ----------
    function secaoBackup() {
      const demo = store.estado.modo === 'demo';
      const contagem = COLECOES.reduce((s, c) => s + store.todos(c).length, 0);
      painel.innerHTML = String(html`<div class="grade">
        ${cartao('Cópia de segurança (backup)', demo ? 'Na demonstração os dados ficam só neste navegador.' : 'Seus dados já ficam guardados na nuvem. Mesmo assim, é bom baixar uma cópia de vez em quando.', html`
          <p class="texto-2">O arquivo de backup tem todos os ${contagem} registros da oficina (clientes, veículos, OS, estoque, financeiro…) e as configurações.</p>
          <div class="grupo-botoes mt-2">
            <button type="button" class="btn btn-primario" data-exportar>${icone('download')}Baixar backup</button>
            ${pode('usuarios') ? html`<label class="btn">${icone('upload')}Restaurar um backup<input type="file" accept=".json,application/json" data-importar hidden></label>` : ''}
          </div>
          ${pode('usuarios') ? html`<p class="texto-3 mt-1" style="font-size:13px">Restaurar substitui os dados atuais pelos do arquivo.</p>` : ''}`)}
        ${cartao('Planilhas (Excel)', 'Para conferir no computador ou mandar para o contador.', html`<div class="grupo-botoes">
          <button type="button" class="btn" data-csv="clientes">${icone('users')}Clientes</button>
          <a class="btn" href="#/estoque">${icone('package')}Estoque (na tela de estoque)</a>
          ${pode('relatorios') ? html`<a class="btn" href="#/relatorios">${icone('clipboard-list')}Ordens de serviço (em relatórios)</a>` : ''}
        </div>`)}
        ${demo ? cartao('Demonstração', 'Quer começar de novo com os dados de exemplo, ou criar a conta da sua oficina?', html`<div class="grupo-botoes">
          <button type="button" class="btn" data-recomecar>${icone('rotate-ccw')}Recomeçar demonstração</button>
          <button type="button" class="btn btn-primario" data-sair-demo>${icone('user-plus')}Criar a conta da minha oficina</button></div>`) : ''}
      </div>`);
      painel.querySelector('[data-exportar]').onclick = () => {
        const nome = (store.estado.config.nome || 'oficina').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        baixarArquivo(`backup-${nome}-${hojeISO()}.json`, JSON.stringify(store.exportar(), null, 1));
        toast('Backup baixado. Guarde o arquivo em local seguro (pen drive, Google Drive…).', 'ok', { duracao: 6000 });
      };
      painel.querySelector('[data-csv=clientes]').onclick = async () => {
        const { exportarClientesCSV } = await import('./clientes.js');
        exportarClientesCSV();
      };
      painel.querySelector('[data-recomecar]')?.addEventListener('click', async () => {
        if (await confirmar({ titulo: 'Recomeçar a demonstração?', texto: 'Tudo o que você mexeu na demonstração será apagado e os dados de exemplo voltam ao original.', ok: 'Recomeçar', perigo: true })) recomecarDemo();
      });
      painel.querySelector('[data-sair-demo]')?.addEventListener('click', sairDemo);
      painel.querySelector('[data-importar]')?.addEventListener('change', async (e) => {
        const arq = e.target.files?.[0];
        e.target.value = '';
        if (!arq) return;
        let pacote;
        try {
          pacote = JSON.parse(await arq.text());
        } catch {
          toast('Arquivo inválido: não é um backup do Mecânica Pro', 'erro');
          return;
        }
        if (!validarBackup(pacote)) {
          toast('Arquivo inválido: não é um backup do Mecânica Pro', 'erro');
          return;
        }
        const n = COLECOES.reduce((s, c) => s + (pacote.dados[c]?.length || 0), 0);
        const ok = await confirmar({
          titulo: 'Restaurar backup?',
          texto: `O arquivo tem ${n} registros${pacote.geradoEm ? `, gerado em ${fmtDataHora(pacote.geradoEm)}` : ''}. Os dados atuais da oficina serão substituídos por ele.`,
          detalhe: 'Dica: baixe um backup dos dados atuais antes, por segurança.',
          ok: 'Substituir dados',
          perigo: true,
        });
        if (!ok) return;
        const ops = [];
        for (const c of COLECOES) {
          const novos = (pacote.dados[c] || []).filter((x) => x && typeof x === 'object');
          const ids = new Set(novos.map((x) => x.id).filter(Boolean));
          for (const x of store.todos(c)) if (!ids.has(x.id)) ops.push({ op: 'apagar', col: c, id: x.id });
          for (const x of novos) ops.push({ op: 'gravar', col: c, id: x.id, dados: x });
        }
        store.lote(ops);
        if (pacote.config) {
          const { migracaoV1: _ignorar, ...cfg } = pacote.config;
          store.salvarConfig(cfg);
        }
        toast('Restaurando… aguarde', 'info');
        await store.aguardarGravacoes(60000);
        toast(`Backup restaurado: ${n} registros`, 'ok', { duracao: 6000 });
        secaoBackup();
      });
    }

    // ---------- Conta ----------
    function secaoConta() {
      const u = store.estado.usuario;
      const demo = store.estado.modo === 'demo';
      painel.innerHTML = String(html`<div class="grade">
        ${cartao('Minha conta', '', html`<dl class="dados-lista">
          <dt>Nome</dt><dd>${u.nome}</dd>
          <dt>E-mail</dt><dd>${u.email || (demo ? 'Demonstração (sem conta)' : '—')}</dd>
          <dt>Perfil</dt><dd>${demo ? 'Demonstração' : PAPEIS[u.papel]?.nome || u.papel}</dd>
          <dt>Oficina</dt><dd>${store.estado.config.nome || '—'}</dd>
        </dl>`, html`<button type="button" class="btn btn-fantasma perigo" data-sair>${icone('log-out')}${demo ? 'Sair da demonstração' : 'Sair do sistema'}</button>`)}
        ${!demo ? cartao('Trocar senha', '', html`<form class="form" data-senha novalidate style="max-width:420px">
          ${campo({ rotulo: 'Senha atual', nome: 'atual', tipo: 'password' })}
          ${campo({ rotulo: 'Nova senha (mínimo 6 caracteres)', nome: 'nova', tipo: 'password' })}
          ${campo({ rotulo: 'Repita a nova senha', nome: 'repete', tipo: 'password' })}
          <div><button type="submit" class="btn btn-primario">${icone('key-round')}Trocar senha</button></div>
        </form>`) : ''}
      </div>`);
      painel.querySelector('[data-sair]').onclick = () => (demo ? sairDemo() : sair());
      const f = painel.querySelector('[data-senha]');
      if (f) {
        f.onsubmit = async (e) => {
          e.preventDefault();
          limparErros(f);
          const d = lerFormulario(f);
          if (!d.atual) return erroCampo(f, 'atual', 'Informe a senha atual');
          if ((d.nova || '').length < 6) return erroCampo(f, 'nova', 'Mínimo de 6 caracteres');
          if (d.nova !== d.repete) return erroCampo(f, 'repete', 'As senhas não são iguais');
          const nuvem = moduloNuvem();
          try {
            await nuvem.trocarSenha(d.atual, d.nova);
            f.reset();
            toast('Senha alterada');
          } catch (err) {
            toast(nuvem.mensagemErro(err), 'erro');
          }
        };
      }
    }

    const DESENHOS = { oficina: secaoOficina, documentos: secaoDocumentos, mensagens: secaoMensagens, usuarios: secaoUsuarios, aparencia: secaoAparencia, backup: secaoBackup, conta: secaoConta };
    function desenhar() {
      for (const b of pg.querySelectorAll('[data-secao]')) b.classList.toggle('ativo', b.dataset.secao === atual);
      DESENHOS[atual]();
    }
    for (const b of pg.querySelectorAll('[data-secao]')) {
      b.onclick = () => {
        atual = b.dataset.secao;
        desenhar();
      };
    }
    desenhar();
    return {
      atualizar(cols) {
        // Formulários não são redesenhados para não apagar o que está sendo digitado.
        if (atual === 'usuarios' && (cols.has('membros') || cols.has('convites'))) secaoUsuarios();
      },
    };
  },
};
