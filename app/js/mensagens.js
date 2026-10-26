// Mensagens de WhatsApp: monta o texto a partir dos modelos (Configurações → Mensagens)
// e abre uma janela para conferir/editar antes de enviar.
import { nomeClienteOS, telefoneOS, veiculoOS } from './dominio.js';
import { store } from './store.js';
import { abrirExterno, abrirModal, html, icone, toast } from './ui.js';
import {
  addDias, calcularOS, diaDe, fmtData, fmtMoeda, fmtNumero, fmtNumeroOS, hojeISO, linkWhatsApp, mascaraPlaca, mascaraTelefone,
  preencherModelo, totalItem, validarTelefone,
} from './utils.js';

function primeiroNome(nome) {
  const p = String(nome || '').trim().split(/\s+/)[0] || '';
  // Empresa: usa o nome inteiro
  return /ltda|me$|eireli|s\/a|transportes|comércio|comercio/i.test(nome || '') ? nome : p;
}

function varsBase(os) {
  const cfg = store.estado.config;
  const v = veiculoOS(os);
  const c = calcularOS(os);
  return {
    cliente: primeiroNome(nomeClienteOS(os)),
    oficina: cfg.nome || 'nossa oficina',
    numero: fmtNumeroOS(os.numero),
    veiculo: v.desc || 'veículo',
    placa: v.placa ? mascaraPlaca(v.placa) : 'sem placa',
    total: fmtMoeda(c.total),
    saldo: fmtMoeda(c.saldo),
    pix: cfg.chavePix ? `\nChave PIX: ${cfg.chavePix}` : '',
  };
}

export function textoItens(os) {
  return (os.itens || [])
    .map((it) => {
      const q = Number(it.qtd) || 0;
      const qtd = q !== 1 ? `${fmtNumero(q)}x ` : '';
      return `• ${qtd}${it.descricao} — ${fmtMoeda(totalItem(it))}`;
    })
    .join('\n');
}

export function msgOrcamento(os) {
  const cfg = store.estado.config;
  const validade = fmtData(addDias(diaDe(os.entrada) || hojeISO(), Number(cfg.validadeOrcamentoDias) || 7));
  return preencherModelo(cfg.mensagens.orcamento, { ...varsBase(os), itens: textoItens(os) || '(sem itens)', validade });
}

export function msgPronto(os) {
  return preencherModelo(store.estado.config.mensagens.pronto, varsBase(os));
}

export function msgCobranca(os) {
  return preencherModelo(store.estado.config.mensagens.cobranca, varsBase(os));
}

export function msgRevisao(os) {
  const r = os.proximaRevisao || {};
  const partes = [];
  if (r.data) partes.push(`para ${fmtData(r.data)}`);
  if (r.km) partes.push(`aos ${fmtNumero(r.km)} km`);
  const quando = partes.length ? ` (prevista ${partes.join(' ou ')})` : '';
  return preencherModelo(store.estado.config.mensagens.revisao, { ...varsBase(os), quando });
}

export function msgAgendamento(ag) {
  const cfg = store.estado.config;
  const c = store.porId('clientes', ag.clienteId);
  return preencherModelo(cfg.mensagens.agendamento, {
    cliente: primeiroNome(c?.nome || ag.clienteNome || ''),
    oficina: cfg.nome || 'nossa oficina',
    data: fmtData(ag.data),
    hora: ag.hora || '',
    servico: ag.servico ? `, para ${ag.servico.charAt(0).toLowerCase()}${ag.servico.slice(1)}` : '',
  });
}

// Janela de envio: confere o número, edita o texto e abre o WhatsApp.
export function enviarWhatsApp({ titulo = 'Enviar pelo WhatsApp', telefone = '', texto = '', aoEnviar } = {}) {
  const demo = store.estado.modo === 'demo';
  const m = abrirModal({
    titulo,
    tamanho: 'md',
    corpo: html`
      ${demo ? html`<div class="aviso aviso-info">${icone('info')}<span>Demonstração: os telefones são fictícios, então o WhatsApp vai abrir para você escolher o contato.</span></div>` : ''}
      <div class="campo">
        <label for="wa-tel">Telefone (WhatsApp)</label>
        <input id="wa-tel" type="tel" inputmode="tel" data-mascara="telefone" value="${mascaraTelefone(telefone)}" placeholder="(00) 00000-0000">
      </div>
      <div class="campo">
        <label for="wa-txt">Mensagem</label>
        <textarea id="wa-txt" rows="10">${texto}</textarea>
        <small class="campo-ajuda">Você pode ajustar o texto antes de enviar. Para mudar o modelo, vá em Configurações → Mensagens.</small>
      </div>`,
    rodape: html`<button type="button" class="btn" data-copiar>${icone('copy')}Copiar texto</button>
      <button type="button" class="btn btn-whats" data-enviar>${icone('send')}Abrir no WhatsApp</button>`,
  });
  const tel = m.el.querySelector('#wa-tel');
  const txt = m.el.querySelector('#wa-txt');
  m.el.querySelector('[data-copiar]').onclick = async () => {
    try {
      await navigator.clipboard.writeText(txt.value);
      toast('Texto copiado');
    } catch {
      txt.select();
      toast('Selecione e copie o texto (Ctrl+C)', 'info');
    }
  };
  m.el.querySelector('[data-enviar]').onclick = () => {
    const numero = tel.value;
    if (!demo && numero && !validarTelefone(numero)) {
      toast('Telefone incompleto: use DDD + número', 'aviso');
      tel.focus();
      return;
    }
    abrirExterno(linkWhatsApp(demo ? '' : numero, txt.value));
    aoEnviar?.();
    m.fechar('ok');
  };
  return m;
}

export function whatsOS(os, tipo, opcoes = {}) {
  const telefone = telefoneOS(os);
  const mapa = {
    orcamento: { titulo: 'Enviar orçamento', texto: msgOrcamento(os) },
    pronto: { titulo: 'Avisar que está pronto', texto: msgPronto(os) },
    cobranca: { titulo: 'Lembrar pagamento', texto: msgCobranca(os) },
    revisao: { titulo: 'Lembrete de revisão', texto: msgRevisao(os) },
    livre: { titulo: 'Mensagem ao cliente', texto: `Olá, ${primeiroNome(nomeClienteOS(os))}! ` },
  };
  const m = mapa[tipo] || mapa.livre;
  return enviarWhatsApp({ ...m, telefone, ...opcoes });
}
