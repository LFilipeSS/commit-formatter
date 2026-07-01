# Commit Formatter — USTIBB

Ferramenta local que varre repositórios git, classifica os arquivos alterados por tipo de tarefa e gera a saída formatada no padrão de medição USTIBB.

Desenvolvido por **Luiz Filipe**

---

## Pré-requisito

**Node.js 18 ou superior** — baixe em [nodejs.org](https://nodejs.org) e instale normalmente.

---

## Como usar

### 1. Clone o repositório

```bash
git clone https://github.com/LFilipeSS/commit-formatter.git
cd commit-formatter
```

### 2. Inicie a aplicação

| Sistema  | O que fazer                                    |
|----------|------------------------------------------------|
| macOS    | Duplo clique em `INICIAR NO MAC.command`       |
| Windows  | Duplo clique em `INICIAR NO WINDOWS.bat`       |
| Linux    | Execute `bash "INICIAR NO LINUX.sh"` no terminal |

O script instala as dependências automaticamente na primeira vez e abre o browser em `http://localhost:3456`.

> **Alternativa que sempre funciona (macOS e Linux):** se o duplo clique não abrir, abra o Terminal na pasta do projeto e rode `bash "INICIAR NO MAC.command"` (ou `INICIAR NO LINUX.sh`). Executar via `bash` não exige permissão de execução, então dispensa qualquer configuração.

---

## Solução de problemas (macOS)

### "O arquivo não pôde ser executado porque você não possui os privilégios de acesso apropriados"

Ao baixar/descompactar o projeto (principalmente pelo botão **Download ZIP** do GitHub), o macOS remove a permissão de execução do arquivo. Para devolvê-la, abra o Terminal na pasta do projeto e rode uma única vez:

```bash
chmod +x "INICIAR NO MAC.command"
```

> Dica: você pode digitar `chmod +x ` (com o espaço) e **arrastar o arquivo** do Finder para o Terminal — o caminho é colado automaticamente.

Se preferir não mexer em permissões, use a alternativa via `bash` descrita acima.


Na primeira execução o macOS pode bloquear o arquivo por segurança. Duas opções:

- Vá em **Ajustes do Sistema → Privacidade e Segurança** e clique em **"Abrir mesmo assim"**; ou
- Remova a marca de quarentena pelo Terminal:

```bash
xattr -d com.apple.quarantine "INICIAR NO MAC.command"
```

---

## O que a ferramenta faz

1. Você seleciona a pasta raiz que contém seus projetos git
2. Informa seu nome (igual ao configurado no git) e o período em dias
3. A ferramenta varre todas as branches de todos os projetos encontrados
4. Classifica cada arquivo alterado de acordo com a tabela de tarefas USTIBB
5. Exibe a saída formatada por tipo de tarefa, pronta para copiar

---

## Classificação automática de arquivos

| Extensão / Caminho | Tipo |
|---|---|
| `*Test.java`, `/test/` | Criação/Alteração de objeto de teste automatizado |
| `.java` (main) | Criação/Alteração de objetos de Integração e Negócio Java |
| `.html`, `.jsp`, `.xhtml`, `.vtl`, `.xsl`, `.php` | Criação/Alteração de tela |
| `.css`, `.scss` | Criação/Alteração CSS ou SCSS |
| `.js`, `.ts` e variantes | Criação/Alteração JavaScript |
| Demais (`.xml`, `.json`, `.yaml`, `pom.xml`…) | Criação/Alteração de arquivo chave/valor ou tipo XML |

---

## Dúvidas, bugs ou sugestões?

Entre em contato com o autor:

- **E-mail:** lfsantos6@stefanini.com / luizfilipedasilvasantos@gmail.com
- **Teams:** Luiz Filipe da Silva Santos
