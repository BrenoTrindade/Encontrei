# Encontrei 🔎

> **Seu guia para o próximo achado.** O primeiro app brasileiro de inteligência para detectorismo, cruzando dados de eventos, marés e geolocalização.

## 📋 Sobre o Projeto

O **Encontrei** é uma plataforma desenvolvida para otimizar o tempo de quem pratica detectorismo de metal. Em vez de contar apenas com a sorte, o sistema utiliza dados para indicar os locais com maior probabilidade de achados recentes ("Hotspots").

A aplicação cruza dados de grandes aglomerações (shows, eventos esportivos na areia, réveillon) com a tábua de marés e previsões climáticas, entregando ao usuário o melhor momento e local para sua busca, respeitando sempre a legislação vigente.

### Principais Funcionalidades
* **Radar de Oportunidades:** Mapa interativo mostrando onde ocorreram eventos recentes com grande fluxo de pessoas.
* **Sincronia de Maré:** Alertas de "Janela de Ouro" (Maré baixa logo após um evento).
* **Compliance Map:** Bloqueio e alerta visual de áreas protegidas pelo IPHAN (Sítios Arqueológicos) para evitar infrações legais.
* **Diário de Achados:** Histórico pessoal geolocalizado dos itens encontrados pelo usuário.

---

## 🚀 Stack Tecnológica

O projeto foi desenhado com foco em escalabilidade e manutenibilidade, utilizando **Clean Architecture** e princípios de **SOLID**.

### Backend (.NET 10)
* **API:** ASP.NET Core Web API.
* **Arquitetura:** Clean Architecture (Separation of Concerns).
* **Padrões:** CQRS (Command Query Responsibility Segregation), Repository Pattern.
* **Data:** PostgreSQL com Entity Framework Core.
* **Background Jobs:** Worker Services para varredura de dados de eventos e marés.

### Frontend (Web)
* **Framework:** React.js.

### Mobile (App)
* **Framework:** React Native.

---

## 🏗️ Estrutura do Projeto

A solução segue a nomenclatura padrão do ecossistema .NET:

/
├── src/
│   ├── Encontrei.API/           # Entry point da API
│   ├── Encontrei.Core/          # Domain Layer (Entities, Value Objects, Interfaces)
│   ├── Encontrei.Application/   # Use Cases, DTOs, CQRS Handlers
│   ├── Encontrei.Infra/         # Implementação de Repositories, Migrations, External, Services
│   ├── encontrei-web/           # Frontend React
│   └── encontrei-mobile/        # App React Native
├── docs/                        # Documentação técnica e Diagramas
├── docker-compose.yml           # Ambiente de desenvolvimento containerizado
└── .gitignore

---

## 💻 Como Começar

Siga estas instruções para configurar e executar o projeto em seu ambiente de desenvolvimento.

### Pré-requisitos

Certifique-se de ter as seguintes ferramentas instaladas:
* [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
* [Node.js (LTS)](https://nodejs.org/)
* [Docker](https://www.docker.com/products/docker-desktop/) (Opcional, para usar com `docker-compose.yml`)

### Instalação

1. Clone o repositório:
   ```sh
   git clone https://github.com/BrenoTrindade/Encontrei.git
   cd Encontrei
   ```

2. Configure as variáveis de ambiente:
   - Crie um arquivo `.env` na raiz e preencha com as chaves de API, connection strings, etc. Baseie-se no arquivo `.env.example` (se houver).

3. Restaure as dependências do Backend:
   ```sh
   cd src/Encontrei.API
   dotnet restore
   ```

4. Instale as dependências do Frontend:
   ```sh
   cd ../../encontrei-web
   npm install
   ```

---

## ▶️ Uso

Para iniciar a aplicação, você pode subir os serviços individualmente ou usar o Docker.

### Ambiente Local

1. Iniciar o Backend (.NET API):
   ```sh
   cd src/Encontrei.API
   dotnet run
   ```
   A API estará disponível em `http://localhost:5000`.

2. Iniciar o Frontend (React):
   ```sh
   cd encontrei-web
   npm start
   ```
   O app web estará acessível em `http://localhost:3000`.

### Docker

Se preferir, suba todo o ambiente com um único comando:
```sh
docker-compose up -d
```

---

## 🧪 Rodando Testes

Para executar os testes unitários e de integração do backend, utilize o seguinte comando na raiz da solução ou no projeto de teste específico:
```sh
dotnet test
```

---

## 🤝 Contribuindo

Contribuições são o que tornam a comunidade open source um lugar incrível para aprender, inspirar e criar. Qualquer contribuição que você fizer será **muito apreciada**.

1. Faça um *Fork* do projeto.
2. Crie uma *Branch* para sua feature (`git checkout -b feature/AmazingFeature`).
3. Faça o *Commit* de suas alterações (`git commit -m 'Add some AmazingFeature'`).
4. Faça o *Push* para a Branch (`git push origin feature/AmazingFeature`).
5. Abra um *Pull Request*.
