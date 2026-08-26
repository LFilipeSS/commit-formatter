# Commit Formatter — USTIBB

Aplicação web que lê repositórios Git locais, classifica os arquivos alterados por tipo de tarefa e gera a saída de medição USTIBB.

Todo o processamento acontece no navegador. Os projetos, commits e caminhos locais não são enviados para um servidor e nenhum token Git é necessário.

## Navegadores compatíveis

- Google Chrome
- Microsoft Edge
- Outros navegadores Chromium que ofereçam `showDirectoryPicker`

Firefox e Safari não são suportados porque ainda não oferecem a API necessária para autorizar a leitura de uma pasta local.

## Como usar

1. Abra o site no Chrome ou Edge.
2. Clique no botão de pasta e autorize acesso somente de leitura.
3. Informe o nome ou e-mail usado como autor dos commits.
4. Defina o período e clique em **Escanear projetos**.
5. Confira, filtre e copie os resultados por tarefa USTIBB.

A pasta selecionada pode ser um repositório Git ou uma pasta contendo vários repositórios, até dois níveis de profundidade.

## Desenvolvimento

Pré-requisito: Node.js 20 ou superior.

```bash
cd public
npm install
npm run dev
```

O Node.js é necessário apenas para desenvolver e gerar o site. O usuário final não instala nada.

## Testes e build de produção

```bash
cd public
npm test
npm run build
```

O build estático é criado em `public/dist` 

## Privacidade

- O acesso à pasta é concedido explicitamente pelo usuário.
- A aplicação solicita somente leitura.
- Não existe endpoint de upload.
- Não é feita autenticação no GitHub, GitLab ou Bitbucket.
- O histórico é interpretado localmente por `isomorphic-git`.

## Limitações atuais

- São examinadas branches locais armazenadas no repositório.
- Worktrees em que `.git` é um arquivo ainda não são suportadas.
- A leitura de cada branch é limitada aos 5.000 commits mais recentes.
- Repositórios muito grandes podem levar alguns segundos para processar.

Desenvolvido por **Luiz Filipe**.
