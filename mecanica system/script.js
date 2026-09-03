import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDClow-K02n-Eytg9zjU-6tWGqKY1nQaBQ",
    authDomain: "mecanicapro-11853.firebaseapp.com",
    projectId: "mecanicapro-11853",
    storageBucket: "mecanicapro-11853.firebasestorage.app",
    messagingSenderId: "482231204593",
    appId: "1:482231204593:web:5afc025124b67d17a0c750",
    measurementId: "G-MEDPDPWPMJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let meuGrafico = null;

// Função auxiliar para padronizar nomes (Capitalize)
function capitalizarNome(nome) {
    if (!nome) return "";
    return nome.toLowerCase().split(' ').map(palavra => {
        return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    }).join(' ');
}

// Máscaras de Input Inteligentes
window.mascaraTelefone = (i) => {
    let v = i.value.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");
    i.value = v;
};

window.mascaraDocumento = (i) => {
    let v = i.value.replace(/\D/g, ""); 
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    i.value = v;
};

document.getElementById('btn-entrar').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const erroMsg = document.getElementById('mensagem-erro');
    try {
        await signInWithEmailAndPassword(auth, email, senha);
        erroMsg.style.display = 'none';
    } catch (error) {
        erroMsg.style.display = 'block';
    }
};

onAuthStateChanged(auth, (user) => {
    const telaLogin = document.getElementById('tela-login');
    const containerSistema = document.getElementById('container-sistema');
    if (user) {
        telaLogin.style.display = 'none';
        containerSistema.style.display = 'flex';
        carregarServicos(user.uid);
        carregarClientes(user.uid);
    } else {
        telaLogin.style.display = 'flex';
        containerSistema.style.display = 'none';
    }
});

window.fazerLogout = () => signOut(auth).then(() => window.location.reload());

window.trocarTela = function(idDestino) {
    document.querySelectorAll('.tela').forEach(t => t.style.display = 'none');
    const alvo = document.getElementById(idDestino);
    if (alvo) alvo.style.display = 'block';
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    const btnAtivo = document.getElementById('btn-' + idDestino);
    if (btnAtivo) btnAtivo.classList.add('active');
};

async function adicionarServico() {
    const user = auth.currentUser;
    if (!user) return;

    const cliente = document.getElementById("cliente");
    const veiculo = document.getElementById("veiculo");
    const servico = document.getElementById("servico");
    const valor = document.getElementById("valorServico");
    const status = document.getElementById("statusServico");
    
    if (!cliente.value || !valor.value) { 
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Informe o cliente e o valor do serviço.', background: '#1e293b', color: '#f8fafc' }); 
        return; 
    }
    
    await addDoc(collection(db, "servicos"), {
        userId: user.uid, // Multi-tenant vinculado ao usuário logado
        cliente: capitalizarNome(cliente.value), 
        veiculo: veiculo.value.toUpperCase(),
        servico: capitalizarNome(servico.value),
        valor: parseFloat(valor.value), 
        status: status.value, 
        data: new Date().toLocaleDateString('pt-BR')
    });
    
    cliente.value = ""; veiculo.value = ""; servico.value = ""; valor.value = "";
    Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Ordem de Serviço cadastrada com sucesso!', background: '#1e293b', color: '#f8fafc' });
}

function carregarServicos(userId) {
    // Query de segurança filtrando apenas os dados da própria conta/oficina
    const q = query(collection(db, "servicos"), where("userId", "==", userId));
    
    onSnapshot(q, (snapshot) => {
        const tabela = document.getElementById("listaServicos");
        const busca = document.getElementById("buscaServico").value.toLowerCase();
        if (!tabela) return;
        tabela.innerHTML = "";
        let tCount = 0, pCount = 0, eCount = 0, fCount = 0, cCount = 0, faturamento = 0;
        
        snapshot.forEach((docItem) => {
            const d = docItem.data();
            tCount++;
            if (d.status === 'pendente') pCount++;
            else if (d.status === 'em-andamento') eCount++;
            else if (d.status === 'finalizado') { fCount++; faturamento += d.valor; }
            else if (d.status === 'cancelado') cCount++;

            if ((d.cliente + d.veiculo).toLowerCase().includes(busca)) {
                const valFmt = Number(d.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2});
                tabela.innerHTML += `<tr><td><strong>${d.cliente}</strong></td><td>${d.veiculo}</td><td>
                    <select onchange="window.atualizarStatusOS('${docItem.id}', this.value)" class="status-badge status-${d.status}">
                    <option value="pendente" ${d.status === 'pendente' ? 'selected' : ''}>Pendente</option>
                    <option value="em-andamento" ${d.status === 'em-andamento' ? 'selected' : ''}>Em Andamento</option>
                    <option value="finalizado" ${d.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
                    <option value="cancelado" ${d.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    </select></td><td>${d.servico}</td><td>R$ ${valFmt}</td><td>
                    <button class="imprimir" onclick="window.gerarPDF('${d.cliente}', '${d.veiculo}', '${d.servico}', '${d.data}', '${valFmt}')"><i class="fa-solid fa-print"></i></button>
                    <button class="excluir" onclick="window.removerServico('${docItem.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
            }
        });
        document.getElementById("totalOrdens").innerText = tCount;
        document.getElementById("totalPendentes").innerText = pCount;
        document.getElementById("totalFinalizados").innerText = fCount;
        document.getElementById("faturamento-total").innerText = faturamento.toLocaleString('pt-br', {style: 'currency', currency: 'BRL'});
        document.getElementById("ticket-medio").innerText = (fCount > 0 ? faturamento/fCount : 0).toLocaleString('pt-br', {style: 'currency', currency: 'BRL'});
        atualizarGrafico(pCount, eCount, fCount, cCount);
    });
}

async function salvarCliente() {
    const user = auth.currentUser;
    if (!user) return;

    const nome = document.getElementById("nomeCliente"), docu = document.getElementById("cpfCliente"), tel = document.getElementById("telefoneCliente");
    if (!nome.value || !docu.value) { 
        Swal.fire({ icon: 'warning', title: 'Atenção', text: 'Nome e Documento são obrigatórios!', background: '#1e293b', color: '#f8fafc' }); 
        return; 
    }
    await addDoc(collection(db, "clientes"), { 
        userId: user.uid, // Vincula o cliente à conta logada
        nome: capitalizarNome(nome.value), 
        documento: docu.value, 
        telefone: tel.value, 
        dataCadastro: new Date().toLocaleDateString('pt-BR') 
    });
    nome.value = ""; docu.value = ""; tel.value = ""; 
    Swal.fire({ icon: 'success', title: 'Sucesso', text: 'Cliente cadastrado com sucesso!', background: '#1e293b', color: '#f8fafc' });
}

function carregarClientes(userId) {
    const q = query(collection(db, "clientes"), where("userId", "==", userId));
    
    onSnapshot(q, (snapshot) => {
        const tabela = document.getElementById("listaClientes"), busca = document.getElementById("buscaCliente").value.toLowerCase();
        const listaRecentes = document.getElementById("listaRecentes");
        if (!tabela) return; tabela.innerHTML = ""; if (listaRecentes) listaRecentes.innerHTML = "";
        let i = 0;
        snapshot.forEach((docItem) => {
            const d = docItem.data();
            if (i < 3 && listaRecentes) { listaRecentes.innerHTML += `<li><i class="fa-solid fa-user"></i> ${d.nome}</li>`; i++; }
            if (d.nome.toLowerCase().includes(busca)) {
                const linkWhats = `https://api.whatsapp.com/send?phone=55${d.telefone.replace(/\D/g, '')}&text=Olá ${d.nome}, o seu veículo na Mecânica Pro está pronto para levantamento!`;
                tabela.innerHTML += `<tr><td><strong>${d.nome}</strong></td><td>${d.documento || '---'}</td>
                    <td>${d.telefone} <a href="${linkWhats}" target="_blank" style="color: #25d366; margin-left: 10px;"><i class="fab fa-whatsapp"></i></a></td>
                    <td>${d.dataCadastro}</td><td><button class="excluir" onclick="window.removerCliente('${docItem.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
            }
        });
        document.getElementById("totalClientesDash").innerText = snapshot.size;
        if(document.getElementById("badge-clientes")) document.getElementById("badge-clientes").innerText = snapshot.size;
    });
}

function atualizarGrafico(p, e, f, c) {
    const ctx = document.getElementById('graficoStatus')?.getContext('2d');
    if (!ctx) return; if (meuGrafico) meuGrafico.destroy();
    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: ['Pendente', 'Andamento', 'Finalizado', 'Cancelado'], datasets: [{ data: [p, e, f, c], backgroundColor: ['#facc15', '#38bdf8', '#4ade80', '#fb7185'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#ffffff', font: { size: 14, family: 'Plus Jakarta Sans', weight: '500' }, padding: 20 } } }, cutout: '70%' }
    });
}

window.gerarPDF = (cliente, veiculo, servico, data, valor) => {
    const oficina = localStorage.getItem("mecanica_nome") || "Sua Oficina Mecânica";
    const contato = localStorage.getItem("mecanica_contato") || "Telefone / Endereço";
    const win = window.open('', '', 'height=700,width=800');
    
    // HTML customizado profissional, limpo com fundo branco para folha de orçamento
    win.document.write(`
        <html>
        <head>
            <title>Ordem de Serviço</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; padding: 40px; margin: 0; background: #fff; }
                .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .oficina-title { font-size: 24px; font-weight: bold; text-transform: uppercase; color: #1e293b; }
                .os-badge { background: #e2e8f0; padding: 5px 15px; border-radius: 5px; font-weight: bold; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .box { border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; }
                .box-title { font-weight: bold; margin-bottom: 5px; color: #64748b; font-size: 12px; text-transform: uppercase; }
                .table-servicos { width: 100%; border-collapse: collapse; margin-top: 20px; }
                .table-servicos th { background: #f1f5f9; text-align: left; padding: 12px; border-bottom: 2px solid #cbd5e1; }
                .table-servicos td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
                .total-box { text-align: right; margin-top: 30px; font-size: 22px; font-weight: bold; color: #0ea5e9; }
                .assinatura { margin-top: 60px; display: flex; justify-content: space-between; }
                .linha-assinatura { border-top: 1px solid #94a3b8; width: 45%; text-align: center; padding-top: 8px; font-size: 14px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="oficina-title">${oficina}</div>
                    <div style="color:#64748b; font-size: 14px; margin-top:5px;">${contato}</div>
                </div>
                <div>
                    <div class="os-badge">ORDEM DE SERVIÇO</div>
                    <div style="text-align: right; margin-top: 5px; font-size: 14px;">Data: ${data}</div>
                </div>
            </div>
            
            <div class="grid">
                <div class="box"><div class="box-title">Cliente</div><div style="font-size:16px; font-weight:bold;">${cliente}</div></div>
                <div class="box"><div class="box-title">Veículo / Placa</div><div style="font-size:16px; font-weight:bold;">${veiculo}</div></div>
            </div>

            <table class="table-servicos">
                <thead>
                    <tr>
                        <th>Descrição do Serviço / Peça</th>
                        <th style="text-align: right;">Valor Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${servico}</td>
                        <td style="text-align: right; font-weight: bold;">R$ ${valor}</td>
                    </tr>
                </tbody>
            </table>

            <div class="total-box">Valor Total: R$ ${valor}</div>

            <div class="assinatura">
                <div class="linha-assinatura">Responsável Técnico</div>
                <div class="linha-assinatura">Assinatura do Cliente</div>
            </div>

            <script>
                setTimeout(() => { window.print(); window.close(); }, 500);
            </script>
        </body>
        </html>
    `);
    win.document.close();
};

window.atualizarStatusOS = async (id, novoStatus) => { await updateDoc(doc(db, "servicos", id), { status: novoStatus }); };

window.removerServico = async (id) => {
    Swal.fire({
        title: 'Excluir Ordem de Serviço?',
        text: "Essa ação não poderá ser desfeita!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "servicos", id));
            Swal.fire({ title: 'Excluído!', text: 'A OS foi removida.', icon: 'success', background: '#1e293b', color: '#f8fafc' });
        }
    });
};

window.removerCliente = async (id) => {
    Swal.fire({
        title: 'Excluir Cliente?',
        text: "Todas as informações deste cliente serão eliminadas permanentemente!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#475569',
        confirmButtonText: 'Sim, excluir!',
        cancelButtonText: 'Cancelar',
        background: '#1e293b',
        color: '#f8fafc'
    }).then(async (result) => {
        if (result.isConfirmed) {
            await deleteDoc(doc(db, "clientes", id));
            Swal.fire({ title: 'Excluído!', text: 'O cliente foi removido.', icon: 'success', background: '#1e293b', color: '#f8fafc' });
        }
    });
};

window.salvarConfiguracoes = () => {
    localStorage.setItem("mecanica_nome", document.getElementById("nomeOficinaConfig").value);
    localStorage.setItem("mecanica_contato", document.getElementById("contatoOficinaConfig").value);
    Swal.fire({ icon: 'success', title: 'Salvo', text: 'Configurações guardadas com sucesso!', background: '#1e293b', color: '#f8fafc' });
};

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('btn-dashboard').onclick = () => trocarTela('dashboard');
    document.getElementById('btn-servicos').onclick = () => trocarTela('servicos');
    document.getElementById('btn-clientes').onclick = () => trocarTela('clientes');
    document.getElementById('btn-ajustes').onclick = () => trocarTela('ajustes');
    document.getElementById('btnCadastrar').onclick = adicionarServico;
    document.getElementById('btnSalvarCliente').onclick = salvarCliente;
    
    // Vincula a busca em tempo real com passagem segura de contexto
    document.getElementById("buscaServico").oninput = () => { if (auth.currentUser) carregarServicos(auth.currentUser.uid); };
    document.getElementById("buscaCliente").oninput = () => { if (auth.currentUser) carregarClientes(auth.currentUser.uid); };
    
    document.getElementById("nomeOficinaConfig").value = localStorage.getItem("mecanica_nome") || "";
    document.getElementById("contatoOficinaConfig").value = localStorage.getItem("mecanica_contato") || "";
});