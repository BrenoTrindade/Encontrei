# Encontrei

O Encontrei é um experimento de produto para ajudar detectoristas de praia a decidir onde e quando realizar uma busca, combinando circulação, maré, recência e condições gerais em uma recomendação explicável.

## Estado atual

O projeto está construindo uma primeira fatia vertical do piloto fechado da Grande Vitória. Ele ainda não é um produto público e não promete probabilidade de achado nem certifica a legalidade de uma atividade.

Implementado nesta fase:

- frontend React/TypeScript mobile-first;
- API TypeScript em Cloudflare Workers;
- persistência Cloudflare D1;
- convites individuais com cookie seguro;
- Radar para hoje, amanhã e depois;
- score interno versionado com faixas explicáveis;
- importação local auditável de marés oficiais do CHM e previsões ICON/GWAM via Open-Meteo;
- indicação de confiança, validade, atribuição e limitações das fontes;
- oportunidades salvas, intenção de visita e feedback ligados ao convite pseudônimo;
- histórico privado com a versão originalmente salva e feedback após a visita, mesmo se a janela expirar;
- medição opcional de consultas, com consentimento no Radar e sem localização ou rastreadores externos;
- painel administrativo com métricas semanais, exportação CSV/JSON e exclusão dos dados de um convite;
- mapa complementar com Leaflet/OpenStreetMap.

Ainda fora do escopo:

- backend .NET;
- aplicativo nativo;
- GPS de sessões e diário de achados;
- pagamentos;
- rede de objetos perdidos;
- lançamento público.

O plano completo está em [encontrei_plano_implementacao.md](./encontrei_plano_implementacao.md).

## Estrutura

```text
Encontrei/
├── encontrei-web/
│   ├── src/             # SPA React
│   ├── worker/          # API e domínio do piloto
│   ├── migrations/      # schema D1
│   ├── scripts/         # seed e atualização local de dados
│   └── wrangler.jsonc   # configuração Cloudflare
├── docs/
│   └── recrutamento_piloto.md
├── encontrei_plano_implementacao.md
└── encontrei_recomendacoes_codex.md
```

## Executar localmente

Pré-requisitos:

- Node.js 24 (a suíte de integração usa o SQLite nativo do Node);
- npm.

```powershell
cd encontrei-web
npm install
npm run db:migrate:local
npm run db:seed:local
npm run data:refresh:real:local
npm run dev
```

Abra o endereço informado pelo Vite com o convite de desenvolvimento:

```text
http://localhost:5173/?invite=piloto-demo
```

O seed cria o convite local e dados demonstrativos expirados. O comando
`data:refresh:real:local` substitui a experiência visível por dados atuais: busca as tábuas de
2026 dos portos de Tubarão e Vitória e uma previsão de 72 horas para Camburi, Praia da Costa e
Itaparica. Ele registra checksums, modelos, coordenadas de grade e validade de cada lote.

As tábuas do CHM e seus valores derivados permanecem exclusivamente no banco local e não devem
ser publicados enquanto os termos conflitantes de reutilização não forem esclarecidos por escrito.
Os PDFs baixados, o SQL gerado e o banco local ficam fora do Git.

## Verificação

```powershell
cd encontrei-web
npm test
npm run lint
npm run build
```

## Administração local

Abra `/admin` no mesmo endereço do Vite. Configure `ADMIN_SECRET` no arquivo local
`encontrei-web/.dev.vars`, com um segredo aleatório de pelo menos 32 caracteres, e reinicie o Vite.
Esse arquivo fica fora do Git. Em ambiente remoto, use um secret do Worker, nunca uma variável
`VITE_*`. A administração permanece desabilitada sem essa configuração.

O login tem limite de dez tentativas por janela de 15 minutos e sessão de uma hora. Sair ou trocar
o segredo invalida a sessão. O CSV traz métricas por participante e o JSON traz os registros do
piloto; nenhum export inclui credenciais. Esses arquivos podem conter comentários enviados pelos
participantes e devem ficar apenas com o operador.

A exclusão exige digitar o código do convite e remove convite, sessão do participante, eventos,
salvos e feedbacks. O registro de auditoria guarda apenas que houve exclusão e quando, sem reter
o identificador apagado. Arquivos exportados anteriormente precisam ser tratados separadamente.

Atividade semanal considera eventos permitidos e ações persistidas (salvos e feedback), em
semanas iniciadas na segunda-feira no horário do ES. Não interprete ausência de registros como
ausência de uso: a medição é opcional. Feedbacks são contados por recomendação, não por pessoa.

## Cloudflare

O `database_id` presente em `wrangler.jsonc` é intencionalmente um placeholder local. Antes de um deploy remoto:

1. Criar o banco D1 real.
2. Substituir o identificador no arquivo de configuração.
3. Aplicar migrations no ambiente remoto.
4. Criar convites remotos sem reutilizar o token de demonstração.
5. Executar smoke tests antes de compartilhar qualquer link.

Não versione credenciais ou tokens reais.

## Próximo gate de produto

O piloto só deve ser aberto após alcançar dez participantes elegíveis e concluir as verificações descritas no plano. O roteiro de recrutamento está em [docs/recrutamento_piloto.md](./docs/recrutamento_piloto.md).
