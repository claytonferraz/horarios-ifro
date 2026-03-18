# Dicionário de Dados - Horários IFRO

Este documento descreve a estrutura atualizada do banco de dados SQLite (`horarios.db`) utilizado pelo sistema.

## Tabelas e Estruturas

### 1. `users` (Tabela Única Consolidada de Servidores e Usuários)
Armazena a relação consolidada de usuários do sistema, equipe multidisciplinar, monitores e docentes.
*   `siape` (TEXT, PRIMARY KEY): Matrícula SIAPE ou identificador único do servidor. Operação manual sem auto-numeração.
*   `nome_completo` (TEXT): Nome civil/funcional completo, adotado para históricos.
*   `nome_exibicao` (TEXT): Nome curto (Nome de Escala) atribuído nos horários de exibição pública.
*   `email` (TEXT, UNIQUE): Endereço base de comunicação e login alternativo de servidores/admin.
*   `senha_hash` (TEXT): Hash criptográfico de acesso (bcrypt). O reset oficial de docentes é prof@ano.
*   `status` (TEXT, DEFAULT 'ativo'): Situação atual da pessoa ('ativo', 'inativo').
*   `perfis` (TEXT, DEFAULT '[]'): Objeto JSON (stringificado) com os papéis do sistema (ex: `["TAE", "Professor"]`).
*   `atua_como_docente` (INTEGER, DEFAULT 1): Booleano de indexação. Se marcado como `1` (true), a pessoa sempre será exibida na base de listas de atribuições de turmas.

### 2. `curriculum_data` (Dados Mestre Anuais)
Armazena as definições de Matrizes Curriculares e as Turmas do ano letivo.
*   `id` (TEXT, PRIMARY KEY): Identificador único.
*   `dataType` (TEXT): Tipo ('matrix' | 'class').
*   `payload` (TEXT): Objeto JSON da matriz ou da turma.
   - **Nota sobre Vínculo de Professores (Turma)**: O array `professorAssignments` no payload de uma *Class* armazena obrigatoriamente a matrícula **SIAPE** como chave estrangeira em vez do nome por extenso do docente. O frontend do sistema interage em tempo real varrendo os usuários na renderização (`PortalView`) mapeando o SIAPE para apresentar o `nome_exibicao`. Qualquer troca no Nome de Exibição de um SIAPE atualizará instantaneamente o componente das Turmas onde ele leciona.

### 3. `schedules`
Armazena os agendamentos/quadros de horários semanais consolidados ou prévios.
*   `id` (TEXT, PRIMARY KEY): String composta única do horário (ex: "43/2026_oficial").
*   `week` (TEXT): Identificador da semana no formato "WW/YYYY".
*   `type` (TEXT): Tipo do agendamento ('oficial', 'previa', 'padrao').
*   `fileName` (TEXT): Nome do arquivo CSV de origem.
*   `records` (TEXT): JSON em formato stringfy contendo o array de aulas extraídas.
*   `updatedAt` (TEXT): Data e hora da última alteração no formato ISO 8601.

### 4. `config`
Parâmetros gerais do sistema por ano letivo.
*   `id` (TEXT, PRIMARY KEY): Identificador do registro (ex: "config_2026").
*   `disabledWeeks` (TEXT): Extrato em JSON (array) de semanas desativadas.
*   `activeDays` (TEXT): Objeto JSON com os dias letivos ativos (seg-sex, sab).
*   `classTimes` (TEXT): Objeto JSON com as faixas de horários das aulas.
*   `bimesters` (TEXT): Objeto JSON contendo os limites e semanas de cada bimestre.
*   `activeDefaultScheduleId` (TEXT): ID do horário padrão (base) ativo no momento.

### 5. `academic_weeks`
Calendário e categorização das semanas acadêmicas no ano letivo.
*   `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Identificador único.
*   `name` (TEXT, UNIQUE): Nome ou designador (ex: "Semana 01").
*   `start_date` (TEXT): Data de início (YYYY-MM-DD).
*   `end_date` (TEXT): Data de término (YYYY-MM-DD).
*   `category` (TEXT, DEFAULT 'regular'): Tipo ('regular', 'avaliacao', 'recesso', 'evento', 'feriado').
*   `school_days` (INTEGER, DEFAULT 0): Número de dias letivos computados na semana.
*   `academic_year` (TEXT): Ano letivo referente àquela semana (ex: '2026').

### 6. `discipline_meta`
Armazena ajustes manuais da carga horária de SUAP para a matriz ou visualização extra.
*   `id` (TEXT, PRIMARY KEY): Combinação código da disciplina/curso.
*   `suapHours` (INTEGER): Carga horária cadastrada.

### 7. `subject_hours`
Armazena parâmetros de horas-aula gerais ou anuais.
*   `id` (TEXT, PRIMARY KEY): Referência da disciplina total.
*   `totalHours` (INTEGER): Carga horária total validada.

### 8. `academic_years`
Gerencia informações ativas dos anos letivos (dias totais programados).
*   `year` (TEXT, PRIMARY KEY): Ano ref. (ex: '2026').
*   `totalDays` (INTEGER): Total de dias alvos.
*   `currentDays` (INTEGER): Dias já realizados letivos.

### 9. `curriculum_data`
Armazena os objetos complexos JSON para matrizes curriculares e turmas.
*   `id` (TEXT, PRIMARY KEY): ID randômico (ex: 'a1b2c3d4').
*   `dataType` (TEXT): Define se o registro é uma matriz ('matrix') ou uma turma ('class').
*   `payload` (TEXT): Objeto JSON serializado com todo o escopo de dados.
    *   No caso de `matrix`: `{ id, name, course, courseAcronym, series: [ {id, name, disciplines: [{id, name, code, hours}]} ] }`
    *   No caso de `class`: `{ id, name, room, academicYear, matrixId, serieId, professorAssignments: { [discId]: [nome_professor] } }`

### 10. `change_requests` (solicitacoes_troca)
Armazena as solicitações de mudança de horário feitas pelos professores (Portal do Professor) para apreciação da gestão.
*   `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT): Identificador único da solicitação.
*   `siape` (TEXT): Matrícula SIAPE do professor solicitante.
*   `week_id` (TEXT): A semana alvo da solicitação (ex: "Semana 01", "24/03 a 28/03").
*   `description` (TEXT): Descrição detalhada ou justificativa do pedido de mudança.
*   `original_slot` (TEXT): Opcional. Bloco original (ex: "Segunda-feira - 1º e 2º Horário - TDS").
*   `proposed_slot` (TEXT): Opcional. Bloco proposto em JSON contendo dia, horário e tipificação da aula.
*   `status` (TEXT, DEFAULT 'pendente'): Status atual ('pendente', 'aprovado', 'rejeitado').
*   `admin_feedback` (TEXT): Resposta ou recado opcional deixado pelo gestor/DAPE.
*   `createdAt` (DATETIME, DEFAULT CURRENT_TIMESTAMP): Carimbo de data/hora de criação.

### 11. `area_neutra_horario` (Estacionamento Temporário)
Armazena os blocos de aula temporariamente removidos/desalocados do "Master Grid Interativo" pelo Gestor, permitindo que a aula seja reorganizada no quadro através de Drag-and-Drop sem perder seus dados vinculativos.
*   `id` (TEXT, PRIMARY KEY): ID único do registro gerado no front-end.
*   `week_id` (TEXT): Semana em que o estacionamento da aula ocorreu.
*   `record_payload` (TEXT): JSON do slot de aula (professor, turma, curso, subject, etc.) que foi estacionado.
*   `updatedAt` (DATETIME, DEFAULT CURRENT_TIMESTAMP): Carimbo de data/hora da última movimentação na staging area.
## Relacionamentos Lógicos Adicionais e Transições de Ano (Smart Copy)
- Em `curriculum_data` do tipo `class`, a propriedade JSON `professorAssignments` faz uma referência lógica pelo NOME do servidor docente com a tabela `users` e `roomAssignments` por salas.
- **Aulas Semanais e Turnos:** Em `curriculum_data` do tipo `matrix`, o campo numérico `hours` (Carga Horária) nas disciplinas gera dinamicamente sua conversão para contagem de slots na grade via fórmula de proporção matemática padronizada: `aulas_semanais = Math.floor(hours / 40)`. Essa chave restringe e afofoca a quantidade de slots (TD) possíveis na Grade Visual (Editor Interativo) de Semanas.
- O campo `shift` da configuração de turnos baliza se os dados estão adequadamente localizados num turno fixo, ou se demandam aviso de Colisão de Turno nas Matrizes e Alocações no View do React.
- **Editor Interativo em Grade:** O frontend permite edição via `onClick` diretamente na View de Grade em células HTML interativas baseadas em permissão. Quando modificado ou alocado para um professor substituto, as informações são ressalvas no campo textual JSON longo de `records` na tabela `schedules`.

## Configuração do Ano Letivo 2026 e Gerenciamento Unificado

Para que a transição ocorra de forma confiável e os horários entrem alinhados com a realidade da distribuição da Carga Horária via SUAP, instituímos:
1.  **Regra de Matemática (Ch/40h)**: Pata calcular visualmente o *slots*, o Frontend agora adota o sistema divisível por 40. Ao preencher que Matemática tem `80h` Carga Horária total numa matriz, o front preenche automaticamente `2 aulas` (*aulas_semanais*). Na Grade visual, a renderização mapeia exclusivamente os turnos ativos.
2.  **Sistema Centralizado de Cadastro (SSO DAPE)**: Como solicitado pelo núcleo estratégico do IFRO, todos os componentes "avulsos" de autoatendimento (*Criar minha conta*, *Meus dados*, *Minha senha particular*) do Frontend ou rotas abertas do Backend (`/api/auth/register`, `/api/auth/change-password`) foram definitivamente banidos.
    - O processo de **Gestão de Servidores**, incluindo cadastro, reset e alteração manual ou em massa dos docentes ocorre agora de forma **100% interna e hierárquica**, disparada por um Admin autenticado usando acesso mestre na ferramenta de Gestão de Usuários.
    - O login exige obrigatoriamente a matrícula **SIAPE** do servidor previamento autorizado pelo DAPE.
Para reaproveitar dados, caso o usuário gere um novo ano (ex: 2027), a rota Backend de Importação copia não apenas a tabela `config` base (Turnos, Dias e Bimestres), mas varre ativamente a tabela `curriculum_data`, localizando qualquer turma que esteja mapeada internamente no JSON (`payload -> academicYear`) com o ano de base (2026). Essas turmas são duplicadas com novos IDs universais únicos, salvando tempo e integrando diretamente o esquema da matriz.

## Lógica de Encadeamento de Horários e Intervalos
O sistema possui flexibilidade total para o recálculo de horários em bloco no módulo `ScheduleConfigPanel`.
A entidade Config (`config` table) armazena a propriedade JSON `intervals`: `[{ id, shift, position, duration, description }]`.
- **Cálculo da Grade Automática**: Durante a "Edição de Horários" (Tempos de Aula), o gestor tem a opção de gerar o encadeamento dos horários de todo o turno automaticamente através do comando **Recalcular**. O cálculo do início e fim de cada slot adota as seguintes regras matemáticas:
   - A hora inicial do processo é ancorada na propriedade de horário da **1ª Aula** do turno selecionado.
   - Todo slot base sequencial assume uma **duração pedagógica exata de 50 minutos**.
   - O sistema checa ativamente o array `intervals`. Caso exista um intervalo (ex: position 3, após a 3ª aula), a duração do slot do intervalo (ex: `20` minutos) é acrescido ao relógio universal (`minutesCounter`) *antes* do cálculo matemático da próxima aula.
- **Renderer da Grade em PortalView**: O intervalo se funde de forma visual (UI) à grade sem agendar slots fantasmas. Ao renderizar a grade da semana (`PortalView.jsx` em ViewMode Turma), após o desenho de cada linha de horário, o algoritmo intercepta a renderização para verificar a propriedade iterativa `classPositionInShift`. Se o `posição` bater com um Recreio, ele despacha dinamicamente uma tag `<tr>` horizontal fundida alertando visualmente o término da aula com a hora do recreio somada.
