# Conecta Saúde Olinda

O **Conecta Saúde Olinda** é uma plataforma moderna e escalável desenvolvida para digitalizar, organizar e otimizar o atendimento de saúde da rede pública municipal. O sistema abrange desde o acesso do cidadão até a gestão operacional e estratégica das unidades de saúde.

> **Aviso:** Este projeto é um protótipo funcional full-stack que utiliza dados fictícios. Desenvolvido para demonstração e integração com a rede municipal de saúde. **Não utilize em produção sem revisar credenciais e dados.**

## 🚀 Principais Funcionalidades

- **Portal do Cidadão:** Agendamentos, consultas, histórico clínico, exames, lembretes e central de informações.
- **Painel Administrativo:** Gestão de unidades, equipe médica, especialidades, pacientes, agenda, recepção e relatórios.
- **Display de Recepção:** Interface de chamada de pacientes na rota `/display-tv`.
- **Integração CNES:** Endpoints dedicados para sincronização de dados do Cadastro Nacional de Estabelecimentos de Saúde.
- **Tempo Real:** Notificações e eventos síncronos via WebSockets (Socket.IO).
- **Segurança e Arquitetura:** Separação clara entre frontend, API e regras de negócio, assegurando escalabilidade e confiabilidade.

## 🛠 Arquitetura e Stack Tecnológico

O sistema adota o fluxo de responsabilidade clara:
`Frontend (React) ➔ API (Express) ➔ Validação/Domínio ➔ Banco de Dados (PostgreSQL)`

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Lucide React e Recharts.
- **Backend:** Node.js, Express, Socket.IO, JWT (Autenticação), bcryptjs (Hashing).
- **Banco de Dados:** PostgreSQL (acessado via `pg` driver puro).
- **Segurança:** Helmet, CORS, Rate Limiting (Express Rate Limit), Sanitização (XSS), validações rigorosas e separação de secrets.

O frontend interage com o backend **apenas** através de endpoints HTTP (via `services/api.ts`). Não há acoplamento direto com banco de dados, ORM ou chaves privadas.

## 📦 Estrutura do Projeto

- `pages/` - Telas públicas, portal do paciente e módulo administrativo.
- `components/` - Componentes reutilizáveis e UI Shells.
- `services/` - Integração e chamadas de API (`api.ts`).
- `scripts/` - Scripts de inicialização, deploy e servidor Express (`serve-dist.mjs`).
- `server/domain/` - Regras de negócio modulares e isoladas.
- `database/migrations/` - Versionamento de esquemas SQL.
- `tests/` - Testes unitários das regras de domínio.

## ⚙️ Como Executar Localmente

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configuração de Ambiente:**
   Copie o arquivo de exemplo e configure suas variáveis locais:
   ```bash
   cp .env.example .env
   ```

3. **Configuração do Banco de Dados:**
   Execute as migrações e popule o banco com dados de teste:
   ```bash
   npm run migrate
   npm run seed
   ```

4. **Ambiente de Desenvolvimento:**
   ```bash
   npm run dev
   ```

5. **Build e Produção (API + Estáticos):**
   ```bash
   npm run build
   npm run start
   ```

## 🔐 Perfis de Demonstração (Seed)

O comando `npm run seed` cria perfis base para navegação e testes utilizando a senha padrão: `Demo@123456`

- **Gestor:** `ADMIN001`
- **Médico:** `MED001`
- **Recepção:** `REC001`
- **Paciente:** Acesso pelo portal do paciente via nome completo e Cartão SUS gerado pelo seed.

## 🛡️ Práticas de Segurança Aplicadas

- **Proteção de Secrets:** Variáveis sensíveis (`JWT_SECRET`, `DATABASE_URL`) não utilizam o prefixo `VITE_` e são tratadas exclusivamente no backend.
- **Autenticação Segura:** Autenticação via JWT com senhas criptografadas usando bcryptjs.
- **Prevenção de Ataques (OWASP):** Implementação de HTTP headers seguros via Helmet, Rate Limiting para prevenção contra Brute Force, Sanitização XSS em payloads e SQL Injection mitigado utilizando exclusivamente prepared statements e validações na borda da API.
- **CORS Rigoroso:** Configuração estrita de origens permitidas controlada via variáveis de ambiente (`CORS_ORIGIN`).

## 📜 Licença e Restrições

Este projeto foi construído para demonstrações com dados estruturais fictícios. O uso de dados sensíveis e pessoais de saúde reais de pacientes não deve ocorrer neste ambiente local.
