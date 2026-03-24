# Plano de Ação para Refatoração do Sistema (Gemini Flash)

Este plano foi desenhado com tarefas pequenas, focadas e granulares para evitar limites de tokenização e manter a clareza durante a execução por IAs generativas.

## FASE 1: Limpeza e Organização do Backend (Arquivos e Estrutura)

### Tarefa 1.1: Remoção de Arquivos Residuais no Backend
- **Ações**:
  1. Identificar e analisar o arquivo `server copy.js`.
  2. Verificar arquivos de log (`backend.log`, `backend_debug.log`) e bancos legados (`database.db`, `server.db`).
  3. Mover para backup ou remover definitivamente os arquivos não utilizados.

### Tarefa 1.2: Auditoria de Scripts de Migração
- **Ações**:
  1. Revisar `migrate.js`, `migrate_curriculum.js` e `migrate_teachers.js`.
  2. Agrupar scripts relevantes em uma pasta `backend/migrations/`.
  3. Mover `validate_and_cleanup.js`, `validate_schedules.js`, `rebuild_curriculum.js` para um diretório `backend/scripts/`.

### Tarefa 1.3: Limpeza de "ALTER TABLE" Dinâmicos no `server.js`
- **Ações**:
  1. Localizar no arquivo `server.js` comandos repetitivos soltos: `db.run("ALTER TABLE schedules ADD COLUMN...");`.
  2. Mover esses comandos para um script oficial de inicialização/migração.
  3. Manter no `server.js` apenas os `CREATE TABLE IF NOT EXISTS` com o esquema mais atual.

## FASE 2: Refatoração do Arquivo Principal da API (`server.js`)

### Tarefa 2.1: Separação de Rotas de Autenticação
- **Ações**:
  1. Criar diretório `backend/routes/` e arquivo `auth.routes.js`.
  2. Mover os endpoints genéricos `/api/auth/*`.
  3. Importar instâncias do Express, DB e middlewares.

### Tarefa 2.2: Separação de Rotas de Agendamentos (Schedules)
- **Ações**:
  1. Criar o arquivo `routes/schedules.routes.js`.
  2. Mover toda a lógica robusta de `GET /api/schedules` e as requisições `bulk-course`.
  3. Simplificar e coesificar as consultas.

### Tarefa 2.3: Isolamento de Middlewares
- **Ações**:
  1. Mover `verifyToken` e rate limiters para `backend/middlewares/`.
  2. Modificar `server.js` para ser apenas o orquestrador principal de rotas e conexões.

## FASE 3: Eliminação de Código Inativo no Backend (Limpeza Profunda)

### Tarefa 3.1: Identificação de Rotas Órfãs
- **Ações**:
  1. Listar todas as rotas declaradas no backend.
  2. Fazer uma busca reversa na pasta `src/` (frontend).
  3. Remover rotas do backend que não apresentem nenhuma chamada correspondente no frontend.

### Tarefa 3.2: Limpeza de Fragmentos Mortos
- **Ações**:
  1. Limpar trechos de código comentados deixados para trás (ex: bibliotecas inativas).
  2. Validar tratativas de Erro e limpar `console.log()` ou `console.error()` excessivos.

## FASE 4: Inspeção e Integridade do Frontend (React/Next.js)

### Tarefa 4.1: Auditoria do Grid de Aulas (`PortalView.jsx`)
- **Ações**:
  1. Inspecionar `src/components/areas/PortalView.jsx`.
  2. Procurar por lógicas duplicadas ou não utilizadas (código sobrando).
  3. Avaliar as lógicas de `useEffect` garantindo que dependências não causem re-renders infinitos.

### Tarefa 4.2: Auditoria de Modais (ex: `TeacherOfferModal.jsx`)
- **Ações**:
  1. Revisar componentes como `TeacherOfferModal.jsx`. 
  2. Refatorar funções infladas e verificar a integridade da passagem de propriedades (props).

### Tarefa 4.3: Revisão Global de Componentes Órfãos
- **Ações**:
  1. Rodar scripts para encontrar importações que não são mais utilizadas.
  2. Remover ou arquivar componentes velhos na pasta `src/components/` (ex: substituídos por "MasterGrid").
