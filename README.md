<div align="center">

# Conecta Saúde Olinda

**Sistema Integrado de Saúde Pública e Telemedicina**

</div>

O **Conecta Saúde Olinda** é uma plataforma para digitalizar, organizar e otimizar o atendimento de saúde da rede pública municipal, cobrindo desde o acesso do cidadão até a gestão operacional das unidades.

Protótipo funcional full-stack para organizar acesso a servicos da rede municipal de saude de Olinda, com dados ficticios de desenvolvimento.

## Principais funcionalidades

- Portal do cidadao com agendamento, consultas, historico, exames, lembretes e informacoes.
- Painel administrativo para unidades, equipe, especialidades, pacientes, agenda, recepcao e relatorios.
- Display de chamada para recepcao em `/display-tv`.
- Integracao CNES por endpoints dedicados de sincronizacao.
- Notificacoes e eventos em tempo real via Socket.IO.
- Separacao entre frontend, API, regras de dominio e PostgreSQL.

## Arquitetura

Fluxo obrigatorio:

`Frontend React -> API Express -> validacao/regras -> PostgreSQL -> API -> Frontend`

O frontend usa apenas `services/api.ts` para chamar endpoints HTTP. Ele nao importa `pg`, ORM, cliente Supabase/Firebase, credenciais ou strings de conexao.

## Tecnologias

- Frontend: React 18, TypeScript, Vite, React Router, Tailwind via CDN, lucide-react, Recharts.
- Backend: Node.js, Express, Socket.IO, JWT, bcryptjs, `pg`.
- Banco: PostgreSQL.
- Validacao atual: validacoes manuais no backend, utilitarios de dominio em `server/domain`.
- Migrations: SQL versionado em `database/migrations`.

## Estrutura

- `pages/`: telas publicas, portal do paciente e administracao.
- `components/`: shells e componentes de apoio.
- `services/api.ts`: cliente HTTP do frontend.
- `scripts/serve-dist.mjs`: API Express e servidor dos arquivos de producao.
- `server/domain/`: regras de negocio testaveis.
- `database/migrations/`: schema versionado.
- `tests/`: testes unitarios das regras de dominio.

## Ambiente

1. Instale dependencias:

```bash
npm install
```

2. Copie `.env.example` para `.env` e ajuste valores locais.

3. Prepare o banco:

```bash
npm run migrate
npm run seed
```

4. Rode o frontend em desenvolvimento:

```bash
npm run dev
```

5. Gere producao e suba API + estaticos:

```bash
npm run build
npm run start
```

## Comandos

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run migrate
npm run seed
```

`npm run lint` executa a verificacao automatica de fronteira frontend/backend e falha se o frontend importar banco, ORM ou credenciais privadas.

## Perfis ficticios

Quando `scripts/serve-dist.mjs` inicializa um banco vazio, cria dados demonstrativos. O seed dedicado usa a senha ficticia `Demo@123456`.

- Gestor: `ADMIN001`
- Medico: `MED001`
- Recepcao: `REC001`
- Paciente: acesso por nome e Cartao SUS ficticio

Nunca use esses dados em producao.

## Rotas principais

- `/`: landing page.
- `/login`: acesso de paciente e profissional.
- `/register`: cadastro de paciente.
- `/patient-portal`: inicio do cidadao.
- `/patient-portal/schedule`: agendar consulta.
- `/patient-portal/appointments`: minhas consultas.
- `/patient-portal/care-history`: atendimentos.
- `/patient-portal/units`: unidades de saude.
- `/patient-portal/exams/schedule`: agendar exame.
- `/patient-portal/exams`: meus exames.
- `/patient-portal/reminders`: lembretes.
- `/patient-portal/information`: informacoes.
- `/perfil`: perfil.
- `/admin`: painel gestor.
- `/admin/units`: unidades.
- `/admin/users`: equipe.
- `/admin/specialties`: especialidades.
- `/admin/patients`: pacientes.
- `/admin/schedule`: agendamentos.
- `/admin/reception`: recepcao e senhas.
- `/admin/reports`: relatorios.
- `/display-tv`: painel de chamada.

Rotas antigas `/cadastro` e `/tv` redirecionam para as rotas canonicas.

## Endpoints principais

- `POST /api/auth/login`
- `POST /api/auth/login-patient`
- `POST /api/auth/register-patient`
- `GET/POST/PATCH/DELETE /api/units`
- `GET/POST/PATCH/DELETE /api/specialties`
- `GET/POST/PATCH/DELETE /api/users`
- `GET/POST/PATCH/DELETE /api/patients`
- `GET/POST/PATCH /api/appointments`
- `POST /api/appointments/:id/check-in`
- `POST /api/appointments/:id/call`
- `GET/POST /api/exams`
- `GET /api/care-history`
- `GET/PUT /api/reminders/preferences`
- `GET/POST /api/notifications`
- `POST /api/sync/cnes`
- `POST /api/sync/cnes/professionals`

## Seguranca

- Segredos ficam apenas no backend.
- `JWT_SECRET`, `DATABASE_URL` e `INITIAL_ADMIN_PASSWORD` nao usam prefixo `VITE_`.
- CORS e Socket.IO usam `CORS_ORIGIN`.
- O backend revalida criacao de agendamentos, conflito de horario, check-in e chamada.
- Dados sensiveis de saude reais nao devem ser usados neste prototipo.

## Limitacoes conhecidas

- O backend ainda esta concentrado em `scripts/serve-dist.mjs`; regras novas foram extraidas para `server/domain`, mas controllers/repositories ainda podem ser modularizados.
- Nao ha ESLint configurado; o script `lint` cobre a fronteira arquitetural exigida.
- A sincronizacao CNES depende de rede externa e pode demorar.
- O prototipo usa dados ficticios e nao implementa prontuario clinico.
