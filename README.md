# Commit Formatter — USTIBB

Aplicação web que lê repositórios Git locais, identifica os autores dos commits e formata os arquivos alterados no padrão de medição USTIBB.

Todo o processamento acontece no navegador. Os projetos, commits e caminhos locais não são enviados a nenhum servidor, e não é necessário utilizar token do GitHub, GitLab ou Bitbucket.

## Acesso

Versão publicada:

<https://d1dl2wq4wd1nx7.cloudfront.net/>

## Navegadores compatíveis

- Google Chrome
- Microsoft Edge
- Navegadores Chromium que implementem a API `showDirectoryPicker`

Firefox e Safari não são suportados atualmente porque não oferecem a API necessária para autorizar a leitura de uma pasta local.

## Como usar

1. Abra o site no Chrome ou Edge.
2. Clique no botão de pasta.
3. Selecione um repositório Git ou uma pasta que contenha vários projetos.
4. Autorize o acesso de leitura solicitado pelo navegador.
5. Escolha a data inicial. Por padrão, é utilizado o primeiro dia do mês atual.
6. Selecione um dos autores encontrados nos commits do período.
7. Aguarde a geração automática do resultado.

Não existe botão para escanear: a leitura começa automaticamente após a seleção do autor.

O autor `aic-workflow-autoupdate`, utilizado por automação, é ocultado da lista.

## Resultados

A aplicação apresenta:

- saída formatada por tarefa USTIBB;
- resumo das quantidades e do total USTIBB;
- relação de todos os arquivos encontrados;
- projetos e branches analisados;
- opção para desconsiderar branches do resultado.

## Persistência no navegador

A pasta e o autor escolhidos são lembrados para o próximo acesso:

- o nome da pasta e o autor são armazenados no `localStorage`;
- a autorização da pasta é armazenada localmente pelo navegador usando `IndexedDB`;
- se a permissão continuar válida, a pasta é restaurada automaticamente;
- se o navegador revogar a permissão, clique novamente no botão de pasta para renová-la.

Essas informações permanecem somente no dispositivo do usuário.

## Desenvolvimento local

Pré-requisito: Node.js 20 ou superior.

```bash
cd public
npm install
npm run dev
```

Abra o endereço exibido pelo Vite, normalmente `http://127.0.0.1:5173/`.

O Node.js é necessário apenas para desenvolvimento, testes e geração do build. O usuário da versão publicada não precisa instalar nada.

## Testes e build de produção

```bash
cd public
npm test
npm run build
```

O build estático é criado em `public/dist`.

## Arquivos para enviar ao GitHub

Envie o código-fonte e os arquivos de configuração:

```text
.gitignore
README.md
public/
  browser-fs.js
  git-scanner.js
  index.html
  package.json
  package-lock.json
  smoke-test.mjs
  vite.config.js
  static/
    folder-picker.js
```

Não envie:

```text
.DS_Store
public/node_modules/
public/dist/
```

O arquivo `public/diagnose-real.mjs` é uma ferramenta opcional de diagnóstico local e não é necessário para executar ou publicar o site.

## Privacidade e segurança

- O acesso à pasta é concedido explicitamente pelo usuário.
- A aplicação solicita somente acesso de leitura.
- Não existe endpoint de upload.
- Não há autenticação em serviços Git remotos.
- Nenhuma credencial AWS faz parte do código do projeto.
- O histórico Git é interpretado localmente com `isomorphic-git`.

## Limitações conhecidas

- São examinadas as branches armazenadas localmente no repositório.
- Worktrees em que `.git` é um arquivo ainda não são suportadas.
- A busca por repositórios percorre até dois níveis abaixo da pasta selecionada.
- A leitura de cada branch é limitada aos 5.000 commits mais recentes.
- Repositórios muito grandes podem levar alguns segundos para processar.

Desenvolvido por **Luiz Filipe da Silva Santos**.
