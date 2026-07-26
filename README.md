# Conecta Saúde Olinda

Protótipo funcional full-stack do sistema municipal **Conecta Saúde Olinda**, reunindo telas públicas, portal do cidadão, cadastro, login, painel gestor, recepção, módulos administrativos, API Express e painel de chamadas para TV.

O projeto é uma base visual e interativa para validar fluxos de atendimento e gestão da rede pública municipal. Ele usa dados demonstrativos e ainda não deve ser tratado como autenticação, prontuário ou sistema de produção sem revisão de segurança, backend real, controle de acesso, auditoria e adequação à LGPD.

## Escopo Implementado

- Página inicial com serviços, unidades e chamada para acesso.
- Login para paciente e profissional.
- Cadastro do paciente e acesso ao portal do cidadão.
- Portal do cidadão com consultas, histórico, unidades, exames, lembretes e informações.
- Painel gestor com métricas e módulos administrativos.
- Gestão de unidades, equipe, especialidades, pacientes, agenda, recepção e relatórios.
- Painel de recepção com fila, check-in, chamada e prioridade.
- Display de TV para leitura à distância em `/display-tv`.
- API Express servindo endpoints, autenticação, agendamentos, exames, lembretes, notificações e sincronização CNES.

## Arquitetura

Fluxo obrigatório do projeto:

```text
Frontend React -> API Express -> validação/regras -> PostgreSQL -> API -> Frontend
```

O frontend conversa com o backend apenas por `services/api.ts`. Ele não importa banco de dados, ORM, credenciais privadas ou strings de conexão.

## Stack

- Frontend: React 18, TypeScript, Vite, React Router, Tailwind, lucide-react e Recharts.
- Backend: Node.js, Express, Socket.IO, JWT, bcryptjs, Helmet, CORS, rate limit e `pg`.
- Banco: PostgreSQL.
- Regras de domínio: utilitários testáveis em `server/domain`.
- Migrations: SQL versionado em `database/migrations`.
- Testes: Node test runner em `tests/`.

## Estrutura

- `pages/`: telas públicas, portal do paciente e administração.
- `components/`: layouts, navegação e componentes de apoio.
- `services/api.ts`: cliente HTTP usado pelo frontend.
- `scripts/serve-dist.mjs`: API Express e servidor dos arquivos de produção.
- `scripts/run-migrations.mjs`: execução das migrations SQL.
- `scripts/seed-demo-data.mjs`: dados fictícios para demonstração.
- `server/domain/`: regras de negócio isoladas e testáveis.
- `database/migrations/`: schema versionado.
- `tests/`: testes unitários e validações de identidade pública.

## Como Executar

Pré-requisito: Node.js `>=18.0.0`.

1. Instale as dependências:

```bash
npm install
```

2. Configure o ambiente:

```bash
cp .env.example .env
```

3. Ajuste `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` e demais variáveis no `.env`.

4. Prepare o banco:

```bash
npm run migrate
npm run seed
```

5. Rode o frontend em desenvolvimento:

```bash
npm run dev
```

6. Gere a versão de produção e suba API + arquivos estáticos:

```bash
npm run build
npm run start
```

## Comandos de Validação

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:verified
```

`npm run lint` verifica a fronteira arquitetural e falha se o frontend importar banco, ORM, clientes administrativos ou credenciais privadas.

`npm run build:verified` executa o build de produção e valida se o artefato gerado contém a identidade pública do **Conecta Saúde Olinda**.

## Perfis Fictícios

Quando o backend inicializa um banco vazio, ele cria dados demonstrativos. O seed dedicado usa a senha fictícia `Demo@123456`.

- Gestor: `ADMIN001`
- Médico: `MED001`
- Recepção: `REC001`
- Paciente: acesso por nome e Cartão SUS fictício

Nunca use esses dados em produção.

## Rotas Principais

- `/`: landing page.
- `/login`: acesso de paciente e profissional.
- `/register`: cadastro de paciente.
- `/patient-portal`: início do cidadão.
- `/patient-portal/schedule`: agendar consulta.
- `/patient-portal/appointments`: minhas consultas.
- `/patient-portal/care-history`: atendimentos.
- `/patient-portal/units`: unidades de saúde.
- `/patient-portal/exams/schedule`: agendar exame.
- `/patient-portal/exams`: meus exames.
- `/patient-portal/reminders`: lembretes.
- `/patient-portal/information`: informações.
- `/perfil`: perfil.
- `/admin`: painel gestor.
- `/admin/units`: unidades.
- `/admin/users`: equipe.
- `/admin/specialties`: especialidades.
- `/admin/patients`: pacientes.
- `/admin/schedule`: agendamentos.
- `/admin/reception`: recepção e senhas.
- `/admin/reports`: relatórios.
- `/display-tv`: painel de chamada.

Rotas antigas `/cadastro` e `/tv` redirecionam para as rotas canônicas.

## Endpoints Principais

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

## Segurança

- Segredos ficam apenas no backend.
- `JWT_SECRET`, `DATABASE_URL` e `INITIAL_ADMIN_PASSWORD` não usam prefixo `VITE_`.
- CORS e Socket.IO usam `CORS_ORIGIN`.
- O backend revalida criação de agendamentos, conflito de horário, check-in e chamada.
- Dados sensíveis de saúde reais não devem ser usados neste protótipo.
- Antes de produção, revise autenticação, autorização por perfil, logs, auditoria, backup, LGPD e monitoramento.

## Diretrizes de Evolução

- Preserve o nome canônico **Conecta Saúde Olinda**.
- Não reutilize referências, imagens ou textos institucionais de Itapissuma.
- Use o design system como fonte de verdade quando houver conflito visual.
- Priorize a experiência mobile do paciente.
- Priorize contraste, tamanho e hierarquia no painel de TV.
- Troque dados demonstrativos por APIs e persistência reais antes de produção.
