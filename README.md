# InforwNet Telecom — Controle de Clientes Cancelados

Sistema web para controle de clientes que tiveram o contrato de internet
cancelado: situação no SPC/SERASA, devolução de equipamentos e histórico
de alterações.

Construído **somente** com HTML5, CSS3 e JavaScript puro (módulos ES),
usando Firebase Authentication e Firestore como backend. Não há build
step — o projeto roda direto no navegador e pode ser hospedado em
qualquer servidor estático, incluindo o GitHub Pages.

## Estrutura do projeto

```
inforwnet/
├── index.html                 → Tela de login
├── cadastro.html               → Criação de conta
├── dashboard.html               → Painel com indicadores em tempo real
├── clientes.html                → Lista, busca e filtros de clientes
├── cliente-form.html            → Cadastro/edição de cliente e equipamentos
├── cliente-detalhes.html        → Detalhes, equipamentos e histórico do cliente
├── historico.html               → Histórico global de alterações
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js       → Credenciais do Firebase (EDITE ESTE ARQUIVO)
│   ├── utils.js                 → CPF, datas, toasts, modal, histórico
│   ├── app-shell.js              → Sidebar, topbar, guarda de autenticação
│   ├── dashboard.js
│   ├── clientes.js
│   ├── cliente-form.js
│   └── cliente-detalhes.js
├── firestore.rules              → Regras de segurança do Firestore
└── firestore.indexes.json       → Índice necessário para o histórico global
```

## 1. Criar o projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um novo projeto.
2. Em **Compilação → Authentication → Sign-in method**, habilite o provedor **E-mail/senha**.
3. Em **Compilação → Firestore Database**, crie o banco de dados (modo produção).
4. Em **Configurações do projeto → Seus apps**, adicione um app da Web e copie o objeto `firebaseConfig`.

## 2. Configurar as credenciais

Abra `js/firebase-config.js` e substitua os valores de exemplo pelos dados
reais do seu projeto Firebase:

```js
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJECT_ID.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};
```

> Nunca versione credenciais de projetos com dados sensíveis em
> repositórios públicos sem revisar as regras de segurança (passo 3) —
> a `apiKey` do Firebase não é secreta por natureza, mas o acesso aos
> dados é controlado pelas regras do Firestore, não pela chave.

## 3. Publicar as regras de segurança

As regras em `firestore.rules` bloqueiam **todo** acesso de usuários não
autenticados. Publique-as em **Firestore Database → Regras**, colando o
conteúdo do arquivo, ou via Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # aponte para este projeto
firebase deploy --only firestore:rules,firestore:indexes
```

## 4. Índice para o histórico global

A página **Histórico** faz uma consulta em grupo de coleções
(`collectionGroup`) na subcoleção `historico` de todos os clientes,
ordenada por data. Isso exige um índice, já descrito em
`firestore.indexes.json`. Ao publicar via `firebase deploy --only
firestore:indexes`, ou também na primeira vez que a consulta rodar, o
Firestore pode indicar um link direto no console para criar esse índice
automaticamente.

## 5. Rodar localmente

Como o projeto usa módulos ES (`type="module"`), ele precisa ser servido
por HTTP (não abra o `index.html` direto com `file://`). Qualquer
servidor estático simples resolve, por exemplo:

```bash
npx serve .
# ou
python3 -m http.server 8080
```

## 6. Hospedar no GitHub Pages

1. Suba a pasta do projeto para um repositório no GitHub.
2. Em **Settings → Pages**, selecione a branch (ex.: `main`) e a pasta raiz `/`.
3. Aguarde a publicação — o sistema ficará acessível em
   `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`.
4. No **Console Firebase → Authentication → Settings → Authorized domains**,
   adicione o domínio do GitHub Pages para permitir login a partir dele.

## Modelo de dados no Firestore

```
clientes_cancelados/{clienteId}
  nome, cpf, dataCancelamento, spcSerasa, dataSpcSerasa, observacaoSpc,
  equipamentoDevolvido, dataDevolucao, observacaoDevolucao, status,
  ativo, createdAt, updatedAt, createdBy, updatedBy

  equipamentos/{equipamentoId}
    tipo, marca, modelo, numeroSerie, macAddress, status, observacao,
    createdAt, updatedAt

  historico/{historicoId}
    data, usuario, usuarioEmail, acao, descricao
```

A exclusão de um cliente é **lógica**: em vez de apagar o documento, o
campo `ativo` é definido como `false` e o registro deixa de aparecer nas
listagens, mas permanece no banco para fins de auditoria.

## Funcionalidades

- Login, cadastro e recuperação de senha via Firebase Authentication.
- Dashboard com indicadores em tempo real (total de cancelados, SPC/SERASA,
  equipamentos pendentes e devolvidos), atualizados automaticamente via
  `onSnapshot` sempre que os dados mudam.
- Cadastro de cliente com máscara e validação de CPF, situação de
  SPC/SERASA e devolução de equipamentos (com múltiplos equipamentos por
  cliente, cada um com tipo, marca, modelo, número de série, MAC e status).
- Lista de clientes com busca em tempo real (nome ou CPF) e filtros por
  situação de SPC/SERASA e de devolução de equipamentos.
- Página de detalhes com informações completas, lista de equipamentos e
  linha do tempo do histórico daquele cliente.
- Histórico automático: toda alteração relevante (SPC/SERASA, status de
  equipamento, devolução, cadastro, edição, exclusão) é registrada com
  data, usuário e descrição.
- Layout responsivo: menu lateral vira menu com botão de hambúrguer no
  celular, e tabelas viram cartões empilhados em telas pequenas.
