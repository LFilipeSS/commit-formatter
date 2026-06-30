const express = require('express');
const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3456;

app.use(express.json());
app.use(express.static(__dirname));

// ─── Classificação de arquivos ────────────────────────────────────────────────

const TASKS = {
  CRIACAO_TELA:       { code: '5.10.1',  label: 'Criação de tela',                                        ustibb: 10   },
  ALTERACAO_TELA:     { code: '5.10.2',  label: 'Alteração de tela',                                      ustibb: 5    },
  CRIACAO_CSS:        { code: '5.10.3',  label: 'Criação CSS ou SCSS',                                     ustibb: 8    },
  ALTERACAO_CSS:      { code: '5.10.4',  label: 'Alteração CSS ou SCSS',                                   ustibb: 4    },
  CRIACAO_JS:         { code: '5.10.5',  label: 'Criação JavaScript',                                      ustibb: 10   },
  ALTERACAO_JS:       { code: '5.10.6',  label: 'Alteração JavaScript',                                    ustibb: 5    },
  CRIACAO_KV:         { code: '5.10.7',  label: 'Criação de arquivo chave/valor ou tipo XML',              ustibb: 2.5  },
  ALTERACAO_KV:       { code: '5.10.8',  label: 'Alteração de arquivo chave/valor ou tipo XML',            ustibb: 1.5  },
  CRIACAO_JAVA:       { code: '5.10.9',  label: 'Criação de objetos de Integração e Negócio Java',         ustibb: 5.5  },
  ALTERACAO_JAVA:     { code: '5.10.10', label: 'Alteração de Objetos de Integração e Negócio Java',       ustibb: 3.5  },
  CRIACAO_TESTE:      { code: '5.10.18', label: 'Criação de objeto de teste automatizado',                 ustibb: 8    },
  ALTERACAO_TESTE:    { code: '5.10.21', label: 'Alteração de objeto de teste automatizado',               ustibb: 4    },
};

function isTestFile(filePath) {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('/test/') ||
    lower.includes('/tests/') ||
    lower.includes('.spec.') ||
    lower.includes('.test.') ||
    /test\.java$/.test(lower) ||
    /tests\.java$/.test(lower)
  );
}

function isViewXml(filePath) {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('/webapp/') ||
    lower.includes('/web-inf/') ||
    lower.includes('/views/') ||
    lower.includes('/templates/') ||
    lower.includes('/pages/')
  );
}

function classifyFile(status, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const create = (status === 'A');

  // Arquivos de teste
  if (isTestFile(filePath) && ['.java', '.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
    return create ? TASKS.CRIACAO_TESTE : TASKS.ALTERACAO_TESTE;
  }

  // Java
  if (ext === '.java') {
    return create ? TASKS.CRIACAO_JAVA : TASKS.ALTERACAO_JAVA;
  }

  // CSS / SCSS
  if (['.css', '.scss', '.sass', '.less'].includes(ext)) {
    return create ? TASKS.CRIACAO_CSS : TASKS.ALTERACAO_CSS;
  }

  // Telas (HTML, JSP, etc.)
  if (['.html', '.xhtml', '.jsp', '.vtl', '.xsl', '.php', '.xui'].includes(ext)) {
    return create ? TASKS.CRIACAO_TELA : TASKS.ALTERACAO_TELA;
  }

  // XML em contexto de view
  if (ext === '.xml' && isViewXml(filePath)) {
    return create ? TASKS.CRIACAO_TELA : TASKS.ALTERACAO_TELA;
  }

  // JavaScript / TypeScript (não-teste)
  if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) {
    return create ? TASKS.CRIACAO_JS : TASKS.ALTERACAO_JS;
  }

  // Tudo mais: XML, JSON, properties, yaml, pom.xml, etc.
  return create ? TASKS.CRIACAO_KV : TASKS.ALTERACAO_KV;
}

// ─── Varredura de repositórios ────────────────────────────────────────────────

function findGitRepos(dir, maxDepth = 2, depth = 0) {
  const repos = [];
  if (depth > maxDepth) return repos;

  let items;
  try {
    items = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return repos;
  }

  for (const item of items) {
    if (!item.isDirectory()) continue;
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;

    const fullPath = path.join(dir, item.name);

    if (fs.existsSync(path.join(fullPath, '.git'))) {
      repos.push(fullPath);
    } else if (depth < maxDepth) {
      repos.push(...findGitRepos(fullPath, maxDepth, depth + 1));
    }
  }

  return repos;
}

// ─── API ──────────────────────────────────────────────────────────────────────

app.get('/api/pick-folder', (req, res) => {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `osascript -e 'POSIX path of (choose folder with prompt "Selecione a pasta raiz dos projetos:")'`;
  } else if (platform === 'win32') {
    command = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Selecione a pasta raiz dos projetos'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"`;
  } else {
    const hasZenity  = (() => { try { execSync('which zenity',  { stdio: 'ignore' }); return true; } catch { return false; } })();
    const hasKdialog = (() => { try { execSync('which kdialog', { stdio: 'ignore' }); return true; } catch { return false; } })();

    if (hasZenity)       command = `zenity --file-selection --directory --title="Selecione a pasta raiz dos projetos"`;
    else if (hasKdialog) command = `kdialog --getexistingdirectory "$HOME" "Selecione a pasta raiz dos projetos"`;
    else return res.status(501).json({ error: 'no-picker' });
  }

  try {
    const chosen = execSync(command, { encoding: 'utf8' }).trim();
    if (!chosen) return res.status(400).json({ error: 'cancelled' });
    res.json({ path: chosen.replace(/\\/g, '/') });
  } catch {
    res.status(400).json({ error: 'cancelled' });
  }
});

app.get('/api/git-user', (req, res) => {
  try {
    const name  = execSync('git config --global user.name',  { encoding: 'utf8' }).trim();
    const email = execSync('git config --global user.email', { encoding: 'utf8' }).trim();
    res.json({ name, email });
  } catch {
    res.status(404).json({ error: 'Não foi possível ler as configurações do git.' });
  }
});

app.get('/api/scan', (req, res) => {
  const { basePath, author, since } = req.query;

  if (!basePath) {
    return res.status(400).json({ error: 'basePath é obrigatório' });
  }

  const expandedPath = basePath.replace(/^~/, process.env.HOME || '');

  if (!fs.existsSync(expandedPath)) {
    return res.status(400).json({ error: `Pasta não encontrada: ${basePath}` });
  }

  const repos   = findGitRepos(expandedPath);
  const results = [];
  const errors  = [];
  const seen    = new Map();
  const branches = [];

  for (const repoPath of repos) {
    const projectName = path.basename(repoPath);
    const gitAuthor   = author || 'Luiz Filipe da Silva Santos';
    const gitSince    = since  || '1 month ago';

    let currentBranch = '(desconhecida)';
    try {
      currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoPath, encoding: 'utf8', timeout: 5000,
      }).trim();
    } catch {}

    let allBranches = [];
    try {
      const branchOut = execSync('git branch --format="%(refname:short)"', {
        cwd: repoPath, encoding: 'utf8', timeout: 5000,
      }).trim();
      allBranches = branchOut.split('\n').map(b => b.trim()).filter(Boolean);
    } catch {
      allBranches = currentBranch !== '(desconhecida)' ? [currentBranch] : [];
    }

    const checkedBranches = [];
    const branchEntry = { project: projectName, branch: currentBranch, checkedBranches };
    branches.push(branchEntry);

    try {
      for (const branch of allBranches) {
        let hasCommits = false;
        try {
          const check = execSync(
            `git log "${branch}" --since="${gitSince}" --author="${gitAuthor}" --oneline`,
            { cwd: repoPath, encoding: 'utf8', timeout: 10000 }
          ).trim();
          hasCommits = !!check;
        } catch { continue; }

        if (!hasCommits) continue;

        checkedBranches.push(branch);

        const output = execSync(
          `git log "${branch}" --since="${gitSince}" --author="${gitAuthor}" --name-status --pretty=format:"#%h" --abbrev=10`,
          { cwd: repoPath, encoding: 'utf8', timeout: 30000 }
        );

        if (!output.trim()) continue;

        let currentHash = null;

        for (const rawLine of output.split('\n')) {
          const line = rawLine.trim();
          if (!line) continue;

          if (line.startsWith('#')) {
            currentHash = line.slice(1);
            continue;
          }

          const match = line.match(/^([AMDRC])\d*\t(.+)$/);
          if (!match) continue;

          const statusChar = match[1];
          if (statusChar === 'D') continue;

          const parts    = line.split('\t');
          const filePath = parts[parts.length - 1];

          const task      = classifyFile(statusChar, filePath);
          const shortHash = (currentHash || '').substring(0, 8);
          const key       = `${projectName}/${filePath}#${shortHash}`;

          if (seen.has(key)) {
            const existing = results[seen.get(key)];
            if (!existing.branches.includes(branch)) existing.branches.push(branch);
            continue;
          }

          seen.set(key, results.length);
          results.push({
            formatted:   `${projectName}/${filePath}#${shortHash};${task.label}`,
            projectName,
            filePath,
            hash:        shortHash,
            taskCode:    task.code,
            description: task.label,
            ustibb:      task.ustibb,
            status:      statusChar,
            branches:    [branch],
          });
        }
      }
    } catch (e) {
      errors.push({ repo: projectName, error: e.message.split('\n')[0] });
    }
  }

  res.json({ results, repoCount: repos.length, errors, branches });
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n✅  Commit Formatter rodando em → ${url}\n`);

  const { platform } = process;
  const cmd =
    platform === 'win32'  ? `start "" "${url}"` :
    platform === 'darwin' ? `open "${url}"`      :
                            `xdg-open "${url}"`;
  exec(cmd);
});
