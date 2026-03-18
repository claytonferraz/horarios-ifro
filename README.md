Com base na estrutura de ficheiros e nas funcionalidades implementadas no projeto **horarios-ifro**, aqui está uma proposta de ficheiro `README.md` completa e profissional para documentar o repositório.

---

# Antgravity - Sistema de Gestão de Horários (IFRO Ji-Paraná)

O **Antgravity** é uma plataforma de gestão académica desenvolvida para centralizar e automatizar a criação de horários escolares no **IFRO Campus Ji-Paraná**. O sistema foi concebido para atender às necessidades do **DAPE (Departamento de Apoio ao Ensino)**, permitindo uma gestão dinâmica, visual e segura dos fluxos de aulas.

## 🚀 Funcionalidades Principais

* **Master Grid (Quadro de Comando):** Visualização completa e interativa de todos os cursos (Informática, Química, Florestas) e turmas em uma única grade.
* **Gestão Dinâmica (Drag-and-Drop):** Interface intuitiva para arrastar e soltar disciplinas nos slots de horários, facilitando ajustes semanais.
* **Ciclo de Vida do Horário:** Suporte para três estados de horário:
    * *Horário Padrão:* Modelo base do semestre.
    * *Prévia Semanal:* Versão editável para ajustes pontuais.
    * *Horário Consolidado:* Registro oficial e imutável para contabilidade de aulas dadas.
* **Portal do Professor:**
    * Acesso autenticado via **SIAPE**.
    * Visualização personalizada ("Meus Horários").
    * Sistema de solicitação de trocas e ocupação de aulas vagas.
* **Regras de Negócio Automatizadas:**
    * Cálculo automático de carga horária (Regra de 40h).
    * Slots de 50 minutos com cálculo automático de hora final.
    * Configuração de intervalos (20 min para matutino/vespertino e 10 min para noturno).
    * Motor de conflitos para evitar choque de horários de professores e salas.

## 🛠️ Tecnologias Utilizadas

* **Frontend:** [Next.js](https://nextjs.org/) (React) com Tailwind CSS.
* **Backend:** Node.js com Express.
* **Base de Dados:** SQLite (ficheiro `horarios.db`).
* **Contentorização:** Docker e Docker Compose.
* **Gestão de Estado:** React Context API (Auth, Data e Theme).

## 📂 Estrutura do Repositório

* `/frontend-next`: Aplicação frontend em Next.js.
    * `/src/components/areas`: Componentes principais como `MasterGrid` e `GestaoHorarios`.
    * `/src/contexts`: Gestão de estado global e autenticação.
* `/frontend-next/backend`: Servidor API e lógica de base de dados.
    * `server.js`: Ponto de entrada do backend.
    * `migrate.js`: Scripts de migração e configuração inicial.
* `docker-compose.yml`: Configuração para subir o ambiente completo (Frontend + Backend + DB).
* `bd.md`: Documentação técnica detalhada da estrutura das tabelas.

## 🔧 Como Executar

### Pré-requisitos
* Docker e Docker Compose instalados.

### Passo a Passo
1.  Clone o repositório:
    ```bash
    git clone https://github.com/claytonferraz/horarios-ifro.git
    cd horarios-ifro
    ```
2.  Suba os contentores:
    ```bash
    docker-compose up -d
    ```
3.  Aceda à aplicação:
    * Frontend: `http://localhost:3000`
    * Backend API: `http://localhost:3001`

### Configuração Inicial
Para configurar os intervalos e dados base de 2026, execute os scripts de setup dentro do contentor backend:
```bash
docker exec -it <nome_do_container_backend> node setup_2026_intervals.js
```

## 🔒 Segurança

* Autenticação centralizada por SIAPE.
* Proteção de rotas sensíveis (Admin/DAPE).
* Configuração de CORS restritiva.
* Eliminação de dados sensíveis no `localStorage` em favor de sessões seguras no servidor.

## 📄 Licença

Este projeto é de uso institucional para o **Instituto Federal de Educação, Ciência e Tecnologia de Rondônia (IFRO)**.

---
*Desenvolvido para otimizar o apoio ao ensino e a organização docente no Campus Ji-Paraná.*
