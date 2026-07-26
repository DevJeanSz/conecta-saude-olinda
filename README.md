<div align="center">

# Conecta Saúde Olinda 🏥

**Sistema Integrado de Saúde Pública e Telemedicina**

O **Conecta Saúde Olinda** é uma plataforma moderna e completa projetada para digitalizar, organizar e otimizar o atendimento de saúde da rede pública municipal. A aplicação atende desde o agendamento de consultas pelo próprio paciente até a gestão de unidades de saúde pelos administradores.

</div>

---

## 🎯 Principais Funcionalidades

- **Portal do Paciente:** Agendamento rápido, interface estilo "wizard", acesso a histórico, visualização de médicos disponíveis e notificações em tempo real.
- **Painel Profissional (Médicos/Recepção/Admin):** Gestão de filas, aprovação de pacientes, agenda diária e prontuários médicos.
- **Painel de Chamada (Display TV):** Tela dedicada para recepção que exibe as senhas sendo chamadas.
- **Integração com CNES:** Busca automatizada e sincronização de dados oficiais de Unidades de Saúde usando a API do Ministério da Saúde.
- **Notificações em Tempo Real:** Sistema de WebSockets para avisos imediatos (ex: Lembretes de Consulta, Alterações no Atendimento).
- **Segurança e Permissões:** Autenticação baseada em tokens (JWT) e restrição de rotas por perfis (Paciente, Médico, Recepcionista, Admin).

---

## 💻 Tecnologias Utilizadas

**Frontend (Interface do Usuário)**
- **React.js** com **TypeScript**
- **Vite** para build e desenvolvimento rápido
- **Tailwind CSS** para estilização moderna e responsiva
- **Lucide React** para iconografia
- **Socket.io-Client** para comunicação em tempo real

**Backend (Servidor e API)**
- **Node.js** com **Express**
- **PostgreSQL (via pacote pg)** para banco de dados relacional
- **Socket.IO** para eventos e notificações WebSockets
- **JWT (JSON Web Token)** para autenticação
- **Bcrypt** para criptografia de senhas

---

## 🚀 Como Inicializar o Projeto Localmente

Siga o passo a passo abaixo para rodar a aplicação no seu computador:

### 1. Pré-requisitos
- Ter o **Node.js** instalado (versão 18+ recomendada)
- Ter o **PostgreSQL** instalado e rodando localmente (ou possuir a URL de um banco de dados em nuvem, como o Supabase)
- **Git** para clonar o repositório

### 2. Clonando o Repositório
```bash
git clone https://github.com/DevJeanSz/conecta-saude-olinda.git
cd conecta-saude-olinda
```

### 3. Instalação das Dependências
Instale todos os pacotes necessários utilizando o npm:
```bash
npm install
```

### 4. Configuração das Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto (use o `.env.example` caso exista) e defina as variáveis obrigatórias.

Exemplo básico de `.env`:
```env
# Banco de Dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/conecta_saude"

# Chave secreta para os Tokens (JWT)
JWT_SECRET="sua-chave-secreta-muito-segura-aqui"

# Porta do Servidor (Opcional)
PORT=4173
```

### 5. Configuração do Banco de Dados
O sistema criará automaticamente as tabelas (migrations) na primeira vez em que for rodado (através do arquivo `schema.sql` embutido no código backend). Basta garantir que o banco especificado na `DATABASE_URL` já esteja criado.

### 6. Executando o Sistema

Para ambiente de **Desenvolvimento** (com live-reload):
```bash
# Inicia tanto o Front-end pelo Vite quanto o Backend via tsx
npm run dev
```

Para gerar a versão de **Produção** e rodar:
```bash
# Compila o Front-end e inicia o servidor Express servindo os estáticos
npm run build
npm run start
```

Após iniciar, o projeto ficará disponível por padrão na porta `4173`. Acesse no seu navegador:  
👉 **http://localhost:4173**

---

## 🌐 Deploy em Nuvem (Railway, Render, etc)

O projeto está otimizado para deploy facilitado em plataformas como o **Railway**.
- Certifique-se de definir a variável de ambiente `DATABASE_URL` da nuvem nas configurações do serviço.
- O comando de "Start Command" deve ser: `npm run start` (ou deixar que o arquivo `package.json` defina automaticamente via instrução de start).
- Os pacotes geram a build de produção do frontend (`dist`) automaticamente e o `scripts/serve-dist.mjs` assume o controle como servidor web (servindo APIs e arquivos estáticos na mesma porta).
