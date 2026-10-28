# 🔒 Segurança e custos do Mecânica Pro

Este guia explica o que o sistema já faz para proteger os dados e não gerar cobrança, e o que **você**
precisa configurar uma vez no Firebase/Google. Faça a lista do item 2 com calma; leva uns 20 minutos.

---

## 1. O que o sistema já faz sozinho

**Ninguém de fora mexe nos dados**
- As regras do banco ([`firestore.rules`](firestore.rules)) deixam cada oficina ver **só os próprios dados**.
- Só lê e grava quem é **membro** da oficina (o dono ou quem ele convidou).
- **Abrir oficina nova exige liberação** (item 2.6). Um estranho que crie uma conta não consegue gravar nada,
  nem "lixo" para gastar a sua cota.
- O perfil **Mecânico** não vê o financeiro e não apaga registros (a regra é do banco, não só da tela).
- Todo documento tem limite de campos e de tamanho (a logo, por exemplo, tem no máximo ~300 KB).
- Ao excluir um cliente, os dados pessoais somem do banco (fica só uma marca de "excluído").

**O site não executa código estranho**
- Política de segurança de conteúdo (CSP): o navegador só roda código do próprio site e do Firebase/Google.
- O site não pode ser colocado dentro de outro site (proteção contra "clique falso").
- Tudo que é digitado é tratado como texto (proteção contra injeção de código).
- Botão **Sair** apaga a cópia dos dados guardada no aparelho (bom para computador usado por várias pessoas).
- Senha com no mínimo 8 caracteres; o Firebase bloqueia sozinho quem erra a senha muitas vezes.

**Poucas requisições (economia)**
- Ao abrir, o sistema usa a cópia guardada no aparelho e **o banco só manda o que mudou** desde a última vez.
  Ele não relê tudo a cada abertura, que era o que mais gastava leituras.
- Os arquivos do sistema (telas, ícones, estilos) ficam guardados no aparelho. Abrir o sistema quase não usa
  internet, e só baixa de novo quando você publica uma versão nova.
- Nada é gravado a cada tecla: só ao clicar em salvar ou mudar um status.
- As movimentações de estoque carregam só o último ano.

> **Sobre "gastar tokens":** o Mecânica Pro **não usa inteligência artificial nem nenhum serviço cobrado por
> token**. O único "medidor" é o uso do banco do Firebase (leituras e gravações), explicado no item 3.

---

## 2. O que você precisa fazer (uma vez só)

### 2.1 Publicar as regras novas ⚠️ obrigatório
Firebase → **Firestore Database → Regras** → apague tudo → cole o conteúdo de [`firestore.rules`](firestore.rules)
→ **Publicar**. Faça de novo sempre que este arquivo mudar.

### 2.2 Ficar no plano gratuito (Spark): assim nunca vem cobrança
Firebase → ⚙️ (engrenagem) → **Uso e faturamento** → **Detalhes e configurações**. Se aparecer **Spark**,
está no gratuito: **o Google nunca cobra**. Se o uso passar do limite do dia, o banco só pausa até o dia
seguinte (o que, com uma oficina, é muito difícil de acontecer).

Se um dia precisar mudar para o **Blaze** (pago por uso), crie antes um **alerta de orçamento**:
Google Cloud Console → **Faturamento → Orçamentos e alertas** → valor baixo (ex.: R$ 20) com aviso por e-mail.
Atenção: o alerta só **avisa**, não bloqueia a cobrança.

### 2.3 Prender a chave do Firebase ao seu site
A "apiKey" que aparece no código não é senha (todo site com Firebase mostra a dele). Mesmo assim, dá para
fazer ela só funcionar no seu endereço:

Google Cloud Console (mesmo projeto) → **APIs e serviços → Credenciais** → abra a chave
**"Browser key (auto created by Firebase)"** → em **Restrições de aplicativos**, escolha **Sites** e adicione:
- `https://SEU-SITE.netlify.app/*` (o seu endereço; e o domínio próprio, se tiver)
- `https://mecanicapro-11853.firebaseapp.com/*`
- `http://localhost/*` (para testes no computador)

Salve. Pode levar alguns minutos para valer.

### 2.4 Domínios autorizados do login
Firebase → **Authentication → Settings → Authorized domains**: deixe só o seu site, `localhost` e
`mecanicapro-11853.firebaseapp.com`. Apague os que você não usa.

### 2.5 Ajustes do login
Firebase → **Authentication → Settings**:
- **Proteção contra enumeração de e-mail**: ligada (impede descobrir quais e-mails têm conta).
- **Política de senha**: mínimo de 8 caracteres.

### 2.6 Liberar uma oficina nova
Por padrão, **ninguém consegue abrir oficina nova**. Você e quem você convida pela tela
(Configurações → Usuários) continuam entrando normalmente, porque convite não precisa de liberação.

Para liberar o e-mail de uma oficina nova (por exemplo, um cliente seu que vai usar o sistema):
Firebase → **Firestore Database → Dados** → **Iniciar coleção** `liberados` → **ID do documento** = o e-mail
da pessoa, em letras minúsculas → adicione qualquer campo (ex.: `por` = `Vinicius`) → Salvar.
A pessoa então usa **Criar conta** com esse e-mail.

Para abrir o cadastro para **qualquer pessoa** (não recomendado): coleção `sistema`, documento `cadastro`,
campo `aberto` do tipo **booleano** = `true`. Para fechar de novo, apague o documento.

### 2.7 App Check: só o seu site fala com o banco (recomendado)
Bloqueia robôs que tentam usar o banco fora do seu site.
1. Crie uma chave **reCAPTCHA v3** em <https://www.google.com/recaptcha/admin> com o domínio do seu site.
2. Firebase → **App Check** → **Apps** → o app web → **reCAPTCHA v3** → cole a **chave secreta** → Salvar.
3. No código, em [`app/js/firebase-config.js`](app/js/firebase-config.js), cole a **chave do site** em
   `APP_CHECK_CHAVE` e publique (merge no `main`).
4. Espere 1 ou 2 dias olhando o App Check: as requisições devem aparecer como **verificadas**.
5. Só então clique em **Aplicar (Enforce)** para **Cloud Firestore** e **Authentication**.
   ⚠️ Se aplicar antes do passo 3 estar no ar, o sistema para de funcionar para todo mundo.

### 2.8 Domínio próprio (opcional, deixa mais profissional)
Netlify → **Domain management → Add a domain** (ex.: `sistema.suaoficina.com.br`). Depois adicione esse
domínio nos itens 2.3, 2.4 e 2.7.

---

## 3. Quanto o banco aguenta no plano gratuito

| Limite por dia (Spark) | Uso típico de uma oficina com o sistema |
|---|---|
| 50 mil leituras | Algumas centenas. Só a **primeira** abertura num aparelho novo lê tudo. |
| 20 mil gravações | Cada OS salva usa de 1 a 5 gravações. |
| 1 GB guardado | Milhares de OS ocupam poucos MB. |

Acompanhe em Firebase → **Firestore Database → Uso**.

---

## 4. Boas práticas do dia a dia
- Cada funcionário com **o próprio login** (nunca compartilhe a senha do dono). Saiu da empresa? Remova em
  **Configurações → Usuários**.
- Dê o perfil **Mecânico** para quem não precisa ver dinheiro.
- Baixe um **backup** toda semana (Configurações → Backup e planilhas) e guarde fora do computador.
- Use senha forte e diferente das outras no e-mail do dono. Se puder, ligue a verificação em duas etapas no
  Google da conta que administra o Firebase.

## 5. Se desconfiar de algo
1. Troque a senha do dono (Configurações → Minha conta).
2. Remova pessoas desconhecidas em Configurações → Usuários.
3. Firebase → **Authentication → Users**: desative contas estranhas.
4. Confira se as regras publicadas são as do arquivo `firestore.rules`.
