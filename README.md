# ⛪ Sistema de Escalas de Ministérios

Web App para gerenciamento de escalas de ministérios de igrejas.
Construído com **React + Vite + Tailwind CSS + Firebase**.

---

## 🗂️ Estrutura do Projeto

```
church-schedule/
├── src/
│   ├── pages/
│   │   ├── PublicBoard.jsx     ← Mural público (sem login)
│   │   ├── AdminPanel.jsx      ← Painel do Diretor (restrito)
│   │   └── LoginPage.jsx       ← Tela de login
│   ├── utils/
│   │   ├── dateUtils.js        ← Gerador automático de datas
│   │   ├── ministryConfig.js   ← Campos de cada ministério
│   │   └── pdfUtils.js         ← Exportação em PDF
│   ├── contexts/
│   │   └── AuthContext.jsx     ← Autenticação Firebase
│   ├── firebase.js             ← ⚠️ Configurar com seus dados
│   ├── App.jsx
│   └── main.jsx
├── firestore.rules             ← Regras de segurança do banco
├── vercel.json                 ← Config de deploy na Vercel
└── package.json
```

---

## 🚀 Passo a Passo de Configuração

### ETAPA 1 — Criar o Projeto no GitHub

1. Acesse [github.com](https://github.com) e faça login (ou crie uma conta)
2. Clique em **"New repository"**
3. Dê um nome: `escala-ministerios`
4. Deixe como **Public** e clique em **"Create repository"**
5. Faça upload de todos os arquivos deste projeto para o repositório

> 💡 Se tiver o Git instalado, pode usar o terminal:
> ```bash
> git init
> git add .
> git commit -m "primeiro commit"
> git branch -M main
> git remote add origin https://github.com/SEU_USUARIO/escala-ministerios.git
> git push -u origin main
> ```

---

### ETAPA 2 — Configurar o Firebase

#### 2.1 Criar o Projeto Firebase
1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Nome: `escala-ministerios` → clique em Continuar
4. Pode desativar o Google Analytics → clique em **"Criar projeto"**

#### 2.2 Ativar Authentication (Login)
1. No menu lateral, clique em **Authentication**
2. Clique em **"Vamos começar"**
3. Na aba **"Sign-in method"**, habilite **E-mail/senha**
4. Clique em **Salvar**

#### 2.3 Criar o Usuário Diretor
1. Ainda em Authentication, vá para a aba **"Usuários"**
2. Clique em **"Adicionar usuário"**
3. Informe o e-mail e senha do diretor (ex: `diretor@minhaigreja.com`)
4. Clique em **"Adicionar usuário"**
> 🔐 Guarde bem esse e-mail e senha — é com eles que o diretor fará login!

#### 2.4 Ativar o Firestore (Banco de Dados)
1. No menu lateral, clique em **Firestore Database**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"** → clique em Avançar
4. Escolha a região **southamerica-east1 (São Paulo)** → clique em **Ativar**

#### 2.5 Configurar as Regras de Segurança do Firestore
1. No Firestore, clique na aba **"Regras"**
2. Apague o conteúdo existente e cole o conteúdo do arquivo `firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /config/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /schedules/{scheduleId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```
3. Clique em **"Publicar"**

#### 2.6 Obter as Credenciais do Firebase
1. Clique na engrenagem ⚙️ ao lado de "Visão geral do projeto" → **"Configurações do projeto"**
2. Role para baixo até **"Seus aplicativos"**
3. Clique em **"</ > Web"** para adicionar um app web
4. Nome: `escala-web` → clique em **"Registrar app"**
5. Você verá um objeto `firebaseConfig` parecido com este:
```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "escala-ministerios.firebaseapp.com",
  projectId: "escala-ministerios",
  storageBucket: "escala-ministerios.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:123...web:abc..."
};
```
6. **Copie esses valores** — você vai precisar no próximo passo.

---

### ETAPA 3 — Configurar o Arquivo firebase.js

Abra o arquivo `src/firebase.js` e substitua os valores de exemplo pelos seus:

```js
const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY_AQUI",           // ← substitua
  authDomain: "SEU_PROJETO.firebaseapp.com", // ← substitua
  projectId: "SEU_PROJETO_ID",               // ← substitua
  storageBucket: "SEU_PROJETO.appspot.com",  // ← substitua
  messagingSenderId: "SEU_SENDER_ID",        // ← substitua
  appId: "SEU_APP_ID"                        // ← substitua
};
```

Salve o arquivo e faça o push para o GitHub:
```bash
git add src/firebase.js
git commit -m "adicionar config firebase"
git push
```

---

### ETAPA 4 — Deploy na Vercel (Hospedagem Gratuita)

1. Acesse [vercel.com](https://vercel.com) e crie uma conta (pode usar o GitHub)
2. Clique em **"Add New... → Project"**
3. Importe o repositório `escala-ministerios` do GitHub
4. A Vercel detectará automaticamente que é um projeto Vite/React
5. Clique em **"Deploy"**
6. Aguarde 1-2 minutos — seu site estará no ar!

> 🌐 Você receberá uma URL como `escala-ministerios.vercel.app`
> Compartilhe com os membros da igreja para eles acessarem o mural público.

---

## 📱 Como Usar o Sistema

### Mural Público (`/`)
- Acessível por qualquer membro sem login
- Selecione o Ministério pelas abas coloridas
- Filtre por Trimestre/Bimestre, Ano e Mês
- Clique em **"Baixar PDF"** para exportar a escala

### Painel do Diretor (`/admin`)
- Acesse `/login` com o e-mail e senha criados no Firebase
- **Aba Escala:** Edite os nomes em cada data automaticamente gerada
- **Aba Membros:** Cadastre os voluntários de cada ministério
- **Aba Configurações:** Coloque o nome da igreja e faça upload da logo

---

## 🗓️ Lógica de Geração Automática de Datas

O sistema gera automaticamente **todas as Quartas, Sábados e Domingos** do período:

| Dia da Semana | Ministérios |
|---------------|-------------|
| Quarta-feira  | Diaconato, Sonoplastia |
| Sábado        | Música, Diaconato, Sonoplastia, Recepção |
| Domingo       | Música, Diaconato, Sonoplastia, Recepção |

---

## 🎵 Campos por Ministério

| Ministério | Campos |
|------------|--------|
| **Música** | Grupo de Louvor, Música Especial, Escola Sabatina |
| **Diaconato** | Responsável pela Chave, Apoio/Oferta 1, Apoio/Oferta 2 |
| **Sonoplastia** | PC / Projeção, Mesa de Som |
| **Recepção** | Recepcionista 1, Recepcionista 2 |

---

## 🛠️ Rodar Localmente (opcional)

```bash
# Instalar dependências
npm install

# Rodar em modo de desenvolvimento
npm run dev

# Gerar build de produção
npm run build
```

---

## 📦 Tecnologias Utilizadas

| Tecnologia | Uso | Custo |
|------------|-----|-------|
| React + Vite | Interface do usuário | Grátis |
| Tailwind CSS | Estilização | Grátis |
| Firebase Auth | Login dos diretores | Grátis* |
| Firestore | Banco de dados em tempo real | Grátis* |
| jsPDF + autoTable | Geração de PDF | Grátis |
| Vercel | Hospedagem do site | Grátis |

*Plano Spark (gratuito) do Firebase é mais do que suficiente para uso em igrejas locais.

---

## ❓ Problemas Comuns

**"Erro ao fazer login"**
→ Verifique se o usuário foi criado corretamente no Firebase Authentication.

**"Erro ao salvar"**
→ Verifique as regras do Firestore (Etapa 2.5).

**"O PDF não tem o logo"**
→ Faça o upload da imagem em Configurações no painel do diretor.

**A página dá erro 404 na Vercel**
→ Verifique se o arquivo `vercel.json` está na raiz do projeto.

---

Desenvolvido para gestão de ministérios de igrejas adventistas. ✝️
