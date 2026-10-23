// Modo nuvem: Firebase (login + banco Firestore). Só é carregado quando necessário.
// Estrutura no banco:
//   usuarios/{uid}                      -> { oficinaId }            (a qual oficina a pessoa pertence)
//   oficinas/{oficinaId}                -> { dono, criadoEm }
//   oficinas/{oficinaId}/membros/{uid}  -> { nome, email, papel }   (quem pode entrar)
//   oficinas/{oficinaId}/config/oficina -> dados da oficina
//   oficinas/{oficinaId}/{colecao}/{id} -> clientes, veiculos, ordens, pecas…
//   convites/{email}                    -> { oficinaId, papel, nome }
import { FIREBASE_CONFIG, FIREBASE_VERSAO, PERMITIR_NOVAS_OFICINAS } from './firebase-config.js';
import { converterDadosAntigos } from './migracao.js';
import { COLECOES, ehIncremento } from './store.js';
import { addDias, agoraISO, hojeISO } from './utils.js';

const BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSAO}`;
let fb = null;

function usarEmulador() {
  try {
    return ['localhost', '127.0.0.1'].includes(location.hostname) && localStorage.getItem('mp:emulador') === '1';
  } catch {
    return false;
  }
}

export async function carregarFirebase() {
  if (fb) return fb;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${BASE}/firebase-app.js`),
    import(`${BASE}/firebase-auth.js`),
    import(`${BASE}/firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(FIREBASE_CONFIG);
  const auth = authMod.getAuth(app);
  auth.languageCode = 'pt';
  let db;
  try {
    db = fsMod.initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: fsMod.persistentLocalCache({ tabManager: fsMod.persistentMultipleTabManager() }),
    });
  } catch (e) {
    // Navegador sem IndexedDB (ex.: janela anônima em alguns celulares): funciona só com internet.
    console.warn('Cache offline indisponível', e);
    db = fsMod.initializeFirestore(app, { ignoreUndefinedProperties: true });
  }
  if (usarEmulador()) {
    authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  fb = { app, auth, db, A: authMod, F: fsMod };
  return fb;
}

// ---------- Mensagens de erro em português ----------
const ERROS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-login-credentials': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/user-not-found': 'Não existe conta com este e-mail.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar".',
  'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/requires-recent-login': 'Por segurança, saia e entre de novo antes de trocar a senha.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/operation-not-allowed': 'O login por e-mail e senha não está ativado no Firebase (Authentication → Sign-in method).',
  'permission-denied': 'O banco de dados recusou o acesso. Confira se as regras do arquivo firestore.rules foram publicadas no Firebase.',
  unavailable: 'Sem conexão com o servidor. Verifique a internet.',
  'acesso-removido': 'Seu acesso a esta oficina foi removido. Fale com o responsável.',
  'cadastro-fechado': 'Para entrar, peça um convite ao responsável da oficina (Configurações → Usuários).',
};

export function mensagemErro(e) {
  const cod = e?.code || e?.message || '';
  return ERROS[cod] || ERROS[String(cod).replace('firestore/', '')] || e?.message || 'Erro inesperado. Tente de novo.';
}

// ---------- Login ----------
export function observarLogin(cb) {
  const { auth, A } = fb;
  return A.onAuthStateChanged(auth, cb);
}

export async function entrar(email, senha) {
  const { auth, A } = fb;
  await A.signInWithEmailAndPassword(auth, email.trim(), senha);
}

export async function recuperarSenha(email) {
  const { auth, A } = fb;
  await A.sendPasswordResetEmail(auth, email.trim());
}

export async function sair() {
  const { auth, A } = fb;
  await A.signOut(auth);
}

// Saída pelo botão "Sair": além de deslogar, apaga a cópia dos dados guardada neste aparelho
// (importante em computador usado por várias pessoas). Depois disso a página precisa ser recarregada.
export async function encerrarSessao() {
  const { auth, A, db, F } = fb;
  await A.signOut(auth);
  try {
    await F.terminate(db);
    await F.clearIndexedDbPersistence(db);
  } catch (e) {
    console.warn('Cópia local não apagada (outra aba aberta?)', e?.code);
  }
  fb = null;
}

export async function trocarSenha(senhaAtual, novaSenha) {
  const { auth, A } = fb;
  const u = auth.currentUser;
  const cred = A.EmailAuthProvider.credential(u.email, senhaAtual);
  await A.reauthenticateWithCredential(u, cred);
  await A.updatePassword(u, novaSenha);
}

// Cria a conta de login. Quem descobre a oficina (convite ou oficina nova) é o resolverOficina,
// chamado pelo app assim que o Firebase avisa que a pessoa entrou.
export async function criarConta({ email, senha, nome }) {
  const { auth, A } = fb;
  const cred = await A.createUserWithEmailAndPassword(auth, email.trim(), senha);
  if (nome) await A.updateProfile(cred.user, { displayName: nome }).catch(() => {});
  return cred.user;
}

function erro(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

function guardarSessao(uid, s) {
  try {
    localStorage.setItem(`mp:sessao:${uid}`, JSON.stringify(s));
  } catch {
    /* sem espaço: tudo bem */
  }
}
function sessaoGuardada(uid) {
  try {
    return JSON.parse(localStorage.getItem(`mp:sessao:${uid}`) || 'null');
  } catch {
    return null;
  }
}

// Descobre a oficina da pessoa (e o perfil dela). Cria a oficina na primeira entrada do dono.
export async function resolverOficina(user, { nome = '', nomeOficina = '', criando = false } = {}) {
  const { db, F } = fb;
  const email = (user.email || '').toLowerCase();
  const nomePessoa = nome || user.displayName || email.split('@')[0];
  try {
    const uSnap = await F.getDoc(F.doc(db, 'usuarios', user.uid));
    const ponteiro = uSnap.exists() ? uSnap.data() : null;
    if (ponteiro?.oficinaId) {
      const m = await F.getDoc(F.doc(db, 'oficinas', ponteiro.oficinaId, 'membros', user.uid));
      if (m.exists()) {
        const s = { oficinaId: ponteiro.oficinaId, papel: m.data().papel || 'mecanico', nome: m.data().nome || nomePessoa };
        guardarSessao(user.uid, s);
        return s;
      }
    }
    // Convite pendente?
    if (email) {
      const cSnap = await F.getDoc(F.doc(db, 'convites', email));
      if (cSnap.exists()) {
        const c = cSnap.data();
        const lote = F.writeBatch(db);
        lote.set(F.doc(db, 'oficinas', c.oficinaId, 'membros', user.uid), {
          nome: c.nome || nomePessoa,
          email,
          papel: c.papel,
          desde: agoraISO(),
        });
        lote.set(F.doc(db, 'usuarios', user.uid), { oficinaId: c.oficinaId, email });
        lote.delete(F.doc(db, 'convites', email));
        await lote.commit();
        const s = { oficinaId: c.oficinaId, papel: c.papel, nome: c.nome || nomePessoa, entrouAgora: true };
        guardarSessao(user.uid, s);
        return s;
      }
    }
    if (ponteiro?.oficinaId && ponteiro.oficinaId !== user.uid) throw erro('acesso-removido');
    if (criando && !PERMITIR_NOVAS_OFICINAS) throw erro('cadastro-fechado');
    // Dono: oficina com o mesmo id da conta (contas da versão antiga caem aqui também).
    const lote = F.writeBatch(db);
    lote.set(F.doc(db, 'oficinas', user.uid), { dono: user.uid, criadoEm: agoraISO() }, { merge: true });
    lote.set(F.doc(db, 'oficinas', user.uid, 'membros', user.uid), { nome: nomePessoa, email, papel: 'dono', desde: agoraISO() });
    lote.set(F.doc(db, 'usuarios', user.uid), { oficinaId: user.uid, email });
    if (nomeOficina) lote.set(F.doc(db, 'oficinas', user.uid, 'config', 'oficina'), { nome: nomeOficina }, { merge: true });
    await lote.commit();
    const s = { oficinaId: user.uid, papel: 'dono', nome: nomePessoa, novo: true };
    guardarSessao(user.uid, s);
    return s;
  } catch (e) {
    if (e.code === 'acesso-removido' || e.code === 'cadastro-fechado' || e.code === 'permission-denied') throw e;
    // Sem internet: usa a última sessão conhecida neste aparelho.
    const s = sessaoGuardada(user.uid);
    if (s) return s;
    throw e;
  }
}

// ---------- Adaptador de dados ----------
function converterPatch(patch) {
  const { F } = fb;
  const r = {};
  for (const [k, v] of Object.entries(patch)) r[k] = ehIncremento(v) ? F.increment(v.__incremento) : v;
  return r;
}

export function criarAdaptadorNuvem(oficinaId, { papel } = {}) {
  const { db, F } = fb;
  const desligar = [];
  const ref = (col, id) => F.doc(db, 'oficinas', oficinaId, col, id);

  return {
    tipo: 'nuvem',
    iniciar(cbs) {
      return new Promise((resolve, reject) => {
        const colecoes = COLECOES.filter((c) => !(c === 'despesas' && papel === 'mecanico'));
        let faltam = colecoes.length + 2;
        let terminou = false;
        const pronto = () => {
          faltam -= 1;
          if (faltam <= 0 && !terminou) {
            terminou = true;
            resolve();
          }
        };
        const falhou = (e) => {
          cbs.aoErro(e);
          if (!terminou) {
            terminou = true;
            reject(e);
          }
        };
        for (const col of colecoes) {
          let primeira = true;
          let q = F.collection(db, 'oficinas', oficinaId, col);
          // Movimentações de estoque crescem rápido: carrega só o último ano.
          if (col === 'movimentos') q = F.query(q, F.where('data', '>=', addDias(hojeISO(), -365)));
          desligar.push(
            F.onSnapshot(
              q,
              (snap) => {
                cbs.aoColecao(col, snap.docs.map((d) => ({ ...d.data(), id: d.id })));
                if (primeira) {
                  primeira = false;
                  pronto();
                }
              },
              falhou,
            ),
          );
        }
        let primeiraCfg = true;
        desligar.push(
          F.onSnapshot(
            F.doc(db, 'oficinas', oficinaId, 'config', 'oficina'),
            (snap) => {
              cbs.aoConfig(snap.exists() ? snap.data() : null);
              if (primeiraCfg) {
                primeiraCfg = false;
                pronto();
              }
            },
            falhou,
          ),
        );
        let primeiraMemb = true;
        desligar.push(
          F.onSnapshot(
            F.collection(db, 'oficinas', oficinaId, 'membros'),
            (snap) => {
              cbs.aoMembros(snap.docs.map((d) => ({ ...d.data(), uid: d.id })));
              if (primeiraMemb) {
                primeiraMemb = false;
                pronto();
              }
            },
            falhou,
          ),
        );
        if (papel === 'dono') {
          desligar.push(
            F.onSnapshot(
              F.query(F.collection(db, 'convites'), F.where('oficinaId', '==', oficinaId)),
              (snap) => cbs.aoConvites(snap.docs.map((d) => ({ ...d.data(), email: d.id }))),
              (e) => console.warn('convites', e),
            ),
          );
        }
      });
    },
    gravar(col, id, dados) {
      return F.setDoc(ref(col, id), dados);
    },
    alterar(col, id, patch) {
      return F.updateDoc(ref(col, id), converterPatch(patch));
    },
    apagar(col, id) {
      return F.deleteDoc(ref(col, id));
    },
    async lote(ops) {
      // O Firestore aceita até 500 operações por lote.
      for (let i = 0; i < ops.length; i += 400) {
        const b = F.writeBatch(db);
        for (const o of ops.slice(i, i + 400)) {
          if (o.op === 'apagar') b.delete(ref(o.col, o.id));
          else if (o.op === 'alterar') b.update(ref(o.col, o.id), converterPatch(o.dados));
          else b.set(ref(o.col, o.id), o.dados);
        }
        await b.commit();
      }
    },
    gravarConfig(patch) {
      return F.setDoc(F.doc(db, 'oficinas', oficinaId, 'config', 'oficina'), patch, { merge: true });
    },
    parar() {
      for (const d of desligar.splice(0)) d();
    },
  };
}

// ---------- Usuários da oficina ----------
export async function convidar(oficinaId, { email, nome, papel, oficinaNome, por }) {
  const { db, F } = fb;
  const id = email.trim().toLowerCase();
  await F.setDoc(F.doc(db, 'convites', id), { oficinaId, nome, papel, oficinaNome: oficinaNome || '', criadoEm: agoraISO(), criadoPor: por || '' });
}
export async function cancelarConvite(email) {
  const { db, F } = fb;
  await F.deleteDoc(F.doc(db, 'convites', email));
}
export async function alterarPapel(oficinaId, uid, papel) {
  const { db, F } = fb;
  await F.updateDoc(F.doc(db, 'oficinas', oficinaId, 'membros', uid), { papel });
}
export async function removerMembro(oficinaId, uid) {
  const { db, F } = fb;
  await F.deleteDoc(F.doc(db, 'oficinas', oficinaId, 'membros', uid));
}

// ---------- Migração da versão antiga ----------
// Lê "clientes" e "servicos" (com userId) e grava no formato novo. Não apaga nada do antigo.
export async function migrarDadosAntigos(uid, { proximoNumero = 1 } = {}) {
  const { db, F } = fb;
  const ler = async (col) => {
    try {
      const snap = await F.getDocs(F.query(F.collection(db, col), F.where('userId', '==', uid)));
      return snap.docs.map((d) => d.data());
    } catch (e) {
      console.warn('Migração: não foi possível ler', col, e?.code);
      return [];
    }
  };
  const [clientes, servicos] = await Promise.all([ler('clientes'), ler('servicos')]);
  if (!clientes.length && !servicos.length) return null;
  const novos = converterDadosAntigos(clientes, servicos);
  for (const o of novos.ordens) o.numero += proximoNumero - 1;
  const ops = [];
  for (const col of ['clientes', 'veiculos', 'ordens']) for (const d of novos[col]) ops.push({ op: 'gravar', col, id: d.id, dados: d });
  return { ops, resumo: { clientes: novos.clientes.length, veiculos: novos.veiculos.length, ordens: novos.ordens.length } };
}
