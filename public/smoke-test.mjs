import { mkdtemp, mkdir, writeFile, readFile, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { scanFolder, detectGitAuthors } from './git-scanner.js';

class NodeFileHandle {
  constructor(path, name) { this.path = path; this.name = name; this.kind = 'file'; }
  async getFile() {
    const data = await readFile(this.path);
    const info = await stat(this.path);
    return { size: data.length, lastModified: info.mtimeMs, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  }
}

class NodeDirectoryHandle {
  constructor(path, name) { this.path = path; this.name = name; this.kind = 'directory'; }
  async getDirectoryHandle(name) {
    const path = join(this.path, name);
    if (!(await stat(path)).isDirectory()) throw new Error('not directory');
    return new NodeDirectoryHandle(path, name);
  }
  async getFileHandle(name) {
    const path = join(this.path, name);
    if (!(await stat(path)).isFile()) throw new Error('not file');
    return new NodeFileHandle(path, name);
  }
  async *entries() {
    for (const entry of await readdir(this.path, { withFileTypes: true }))
      yield [entry.name, entry.isDirectory() ? new NodeDirectoryHandle(join(this.path, entry.name), entry.name) : new NodeFileHandle(join(this.path, entry.name), entry.name)];
  }
  async *keys() { for (const entry of await readdir(this.path)) yield entry; }
}

const root = await mkdtemp(join(tmpdir(), 'commit-formatter-'));
try {
  const repo = join(root, 'projeto-exemplo');
  await mkdir(join(repo, 'src'), { recursive: true });
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Pessoa Teste'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'teste@example.com'], { cwd: repo });
  await writeFile(join(repo, 'src', 'App.java'), 'class App {}\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'cria app'], { cwd: repo });
  await writeFile(join(repo, 'src', 'App.java'), 'class App { int value; }\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-m', 'altera app'], { cwd: repo });

  execFileSync('git', ['config', 'user.name', 'Outra Pessoa'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'outra@example.com'], { cwd: repo });
  await writeFile(join(repo, 'README.md'), '# Projeto\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  const latestDate = new Date(Date.now() + 60000).toISOString();
  execFileSync('git', ['commit', '-m', 'documenta projeto'], {
    cwd: repo,
    env: { ...process.env, GIT_AUTHOR_DATE: latestDate, GIT_COMMITTER_DATE: latestDate },
  });
  // Repositórios reais normalmente armazenam commits em packfiles.
  execFileSync('git', ['gc', '--aggressive', '--prune=now'], { cwd: repo });

  const result = await scanFolder(new NodeDirectoryHandle(root, 'projetos'), { author: 'Pessoa Teste', sinceDays: 30 });
  if (result.repoCount !== 1) throw new Error(`Esperava 1 repositório, recebeu ${result.repoCount}`);
  if (result.results.length !== 2) throw new Error(`Esperava 2 alterações, recebeu ${result.results.length}: ${JSON.stringify(result.errors)}`);
  if (!result.results.some(item => item.taskCode === '5.10.9') || !result.results.some(item => item.taskCode === '5.10.10'))
    throw new Error('Classificação Java de criação/alteração incorreta');
  const authors = await detectGitAuthors(new NodeDirectoryHandle(root, 'projetos'));
  if (authors[0]?.name !== 'Outra Pessoa' || authors[0]?.email !== 'outra@example.com' || authors[1]?.name !== 'Pessoa Teste')
    throw new Error(`Detecção de autor incorreta: ${JSON.stringify(authors)}`);
  console.log('Smoke test: leitura Git, autor e classificação OK');
} finally {
  await rm(root, { recursive: true, force: true });
}
