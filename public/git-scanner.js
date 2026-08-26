import * as git from 'isomorphic-git';
import { createBrowserFs, findGitRepositories } from './browser-fs.js';

const TASKS = {
  CRIACAO_TELA:   { code: '5.10.1', label: 'Criação de tela', ustibb: 10 },
  ALTERACAO_TELA: { code: '5.10.2', label: 'Alteração de tela', ustibb: 5 },
  CRIACAO_CSS:    { code: '5.10.3', label: 'Criação CSS ou SCSS', ustibb: 8 },
  ALTERACAO_CSS:  { code: '5.10.4', label: 'Alteração CSS ou SCSS', ustibb: 4 },
  CRIACAO_JS:     { code: '5.10.5', label: 'Criação JavaScript', ustibb: 10 },
  ALTERACAO_JS:   { code: '5.10.6', label: 'Alteração JavaScript', ustibb: 5 },
  CRIACAO_KV:     { code: '5.10.7', label: 'Criação de arquivo chave/valor ou tipo XML', ustibb: 2.5 },
  ALTERACAO_KV:   { code: '5.10.8', label: 'Alteração de arquivo chave/valor ou tipo XML', ustibb: 1.5 },
  CRIACAO_JAVA:   { code: '5.10.9', label: 'Criação de objetos de Integração e Negócio Java', ustibb: 5.5 },
  ALTERACAO_JAVA: { code: '5.10.10', label: 'Alteração de Objetos de Integração e Negócio Java', ustibb: 3.5 },
  CRIACAO_TESTE:  { code: '5.10.18', label: 'Criação de objeto de teste automatizado', ustibb: 8 },
  ALTERACAO_TESTE:{ code: '5.10.21', label: 'Alteração de objeto de teste automatizado', ustibb: 4 },
};

// Mantém a leitura da pasta enquanto ela estiver selecionada. A identificação
// do autor e a geração do relatório passam a compartilhar repositórios,
// branches, histórico e objetos Git já carregados.
const folderSessions = new WeakMap();

async function getFolderSession(rootHandle) {
  let session = folderSessions.get(rootHandle);
  if (!session) {
    session = {
      fs: createBrowserFs(rootHandle),
      repos: await findGitRepositories(rootHandle),
      repoStates: new Map(),
    };
    folderSessions.set(rootHandle, session);
  }
  return session;
}

function getRepoState(session, repo) {
  const key = repo.path || repo.name;
  let state = session.repoStates.get(key);
  if (!state) {
    state = {
      cache: {}, branches: null, currentBranch: null,
      logs: new Map(), commitChanges: new Map(),
    };
    session.repoStates.set(key, state);
  }
  return state;
}

function getCutoffTimestamp({ sinceDate, sinceDays = 30 }) {
  if (sinceDate && /^\d{4}-\d{2}-\d{2}$/.test(sinceDate)) {
    const timestamp = new Date(`${sinceDate}T00:00:00`).getTime();
    if (Number.isFinite(timestamp)) return Math.floor(timestamp / 1000);
  }
  return Math.floor((Date.now() - sinceDays * 86400000) / 1000);
}

function classifyFile(status, filePath) {
  const lower = filePath.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
  const create = status === 'A';
  const test = lower.includes('/test/') || lower.includes('/tests/') || lower.includes('.spec.') ||
    lower.includes('.test.') || /tests?\.java$/.test(lower);
  const viewXml = ['/webapp/', '/web-inf/', '/views/', '/templates/', '/pages/'].some(p => lower.includes(p));
  if (test && ['.java', '.js', '.ts', '.jsx', '.tsx'].includes(ext)) return create ? TASKS.CRIACAO_TESTE : TASKS.ALTERACAO_TESTE;
  if (ext === '.java') return create ? TASKS.CRIACAO_JAVA : TASKS.ALTERACAO_JAVA;
  if (['.css', '.scss', '.sass', '.less'].includes(ext)) return create ? TASKS.CRIACAO_CSS : TASKS.ALTERACAO_CSS;
  if (['.html', '.xhtml', '.jsp', '.vtl', '.xsl', '.php', '.xui'].includes(ext) || (ext === '.xml' && viewXml))
    return create ? TASKS.CRIACAO_TELA : TASKS.ALTERACAO_TELA;
  if (['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'].includes(ext)) return create ? TASKS.CRIACAO_JS : TASKS.ALTERACAO_JS;
  return create ? TASKS.CRIACAO_KV : TASKS.ALTERACAO_KV;
}

async function changedFiles(fs, dir, oid, parentOid, cache) {
  const changes = [];
  const trees = parentOid
    ? [git.TREE({ ref: oid }), git.TREE({ ref: parentOid })]
    : [git.TREE({ ref: oid })];
  await git.walk({
    fs, dir, gitdir: `${dir}/.git`, cache,
    trees,
    map: async (filepath, entries) => {
      const [current, previous] = entries;
      if (filepath === '.') return;
      const currentType = await current?.type();
      const previousType = await previous?.type();
      if (currentType === 'tree' || previousType === 'tree') return;
      const currentOid = await current?.oid();
      const previousOid = await previous?.oid();
      if (!currentOid) return; // exclusões não são medidas
      if (currentOid !== previousOid) changes.push({ filePath: filepath, status: previousOid ? 'M' : 'A', oid: currentOid });
    },
  });
  return changes;
}

function matchesAuthor(commit, author) {
  const needle = author.trim().toLocaleLowerCase('pt-BR');
  if (!needle) return true;
  const value = `${commit.author?.name || ''} ${commit.author?.email || ''}`.toLocaleLowerCase('pt-BR');
  return value.includes(needle);
}

async function listAvailableBranches(fs, dir) {
  const gitdir = `${dir}/.git`;
  const collected = [];
  const seen = new Set();
  const add = (name, ref) => {
    if (!seen.has(ref)) {
      seen.add(ref);
      collected.push({ name, ref });
    }
  };

  for (const name of await git.listBranches({ fs, dir, gitdir }))
    add(name, `refs/heads/${name}`);

  try {
    const remotes = await git.listRemotes({ fs, dir, gitdir });
    for (const remote of remotes) {
      let names = [];
      try { names = await git.listBranches({ fs, dir, gitdir, remote: remote.remote }); } catch { continue; }
      for (const name of names) {
        if (name === 'HEAD') continue;
        add(`${remote.remote}/${name}`, `refs/remotes/${remote.remote}/${name}`);
      }
    }
  } catch {}

  return collected;
}

export async function scanFolder(rootHandle, { author, sinceDate, sinceDays, onProgress }) {
  const session = await getFolderSession(rootHandle);
  const { repos, fs } = session;
  const results = [];
  const branches = [];
  const errors = [];
  const seen = new Map();
  let commitCount = 0;
  const cutoff = getCutoffTimestamp({ sinceDate, sinceDays });

  for (let index = 0; index < repos.length; index++) {
    const repo = repos[index];
    const repoState = getRepoState(session, repo);
    if (!repoState.logs.size) onProgress?.(`Lendo ${repo.name}…`, index, repos.length);
    const { cache } = repoState;
    const dir = repo.path ? `/${repo.path}` : '/';
    const checkedBranches = [];
    const repoIssues = [];
    try {
      const availableBranches = repoState.branches ||= await listAvailableBranches(fs, dir);
      let currentBranch = repoState.currentBranch || '(desconhecida)';
      if (!repoState.currentBranch) {
        try { currentBranch = await git.currentBranch({ fs, dir, gitdir: `${dir}/.git`, fullname: false }) || '(desconhecida)'; } catch {}
        repoState.currentBranch = currentBranch;
      }
      const branchEntry = { project: repo.name, projectPath: repo.path, branch: currentBranch, checkedBranches };
      branches.push(branchEntry);

      const commitsByOid = new Map();
      for (const branchEntry of availableBranches) {
        const { name: branch, ref: branchRef } = branchEntry;
        try {
          const branchOid = await git.resolveRef({ fs, dir, gitdir: `${dir}/.git`, ref: branchRef, cache });
          if (typeof branchOid !== 'string' || !/^[0-9a-f]{40}$/i.test(branchOid)) continue;

          const cachedLog = repoState.logs.get(branchRef);
          const cachedCoversPeriod = cachedLog && (
            cachedLog.complete ||
            cachedLog.coversSince <= cutoff ||
            cachedLog.commits.at(-1)?.commit?.committer?.timestamp <= cutoff
          );
          const commits = cachedCoversPeriod ? cachedLog.commits : await git.log({
            fs, dir, gitdir: `${dir}/.git`, ref: branchOid,
            since: new Date(cutoff * 1000), depth: 5000, force: true, cache,
          });
          if (!cachedCoversPeriod)
            repoState.logs.set(branchRef, { commits, complete: false, coversSince: cutoff });
          const relevant = commits.filter(entry =>
            typeof entry?.oid === 'string' &&
            entry.commit?.committer?.timestamp >= cutoff &&
            matchesAuthor(entry.commit, author)
          );
          if (relevant.length) {
            checkedBranches.push(branch);

            for (const entry of relevant) {
              if (typeof entry.oid !== 'string') continue;
              const existing = commitsByOid.get(entry.oid);
              if (existing) existing.branches.add(branch);
              else commitsByOid.set(entry.oid, { entry, branches: new Set([branch]) });
            }
          }
        } catch (error) {
          // Branch vazia, referência quebrada ou objeto não disponível localmente.
          repoIssues.push(`${branch}: ${error.stack || error.message || String(error)}`);
          await new Promise(resolve => setTimeout(resolve, 0));
          continue;
        }
        // Devolve o controle ao navegador entre branches para a página não
        // parecer travada em repositórios sem commits do autor pesquisado.
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      let processed = 0;
      commitCount += commitsByOid.size;
      const allChangesPrepared = [...commitsByOid.values()].every(({ entry }) =>
        (entry.commit.parent?.length || 0) > 1 || repoState.commitChanges.has(entry.oid)
      );
      for (const { entry, branches: commitBranches } of commitsByOid.values()) {
        processed++;
        if (!allChangesPrepared)
          onProgress?.(`Analisando ${repo.name}: commit ${processed} de ${commitsByOid.size}…`, index, repos.length);
        // Equivale ao `git log --name-status`: merges não exibem a comparação
        // contra o primeiro pai, a menos que o Git seja chamado com -m.
        if ((entry.commit.parent?.length || 0) > 1) continue;
        const hash = entry.oid.slice(0, 10);
        let changes;
        try {
          if (repoState.commitChanges.has(entry.oid)) {
            changes = repoState.commitChanges.get(entry.oid);
          } else {
            changes = await changedFiles(fs, dir, entry.oid, entry.commit.parent?.[0] || null, cache);
            repoState.commitChanges.set(entry.oid, changes);
          }
        } catch (error) {
          repoIssues.push(`${entry.oid.slice(0, 10)}: ${error.message || String(error)}`);
          continue;
        }
        for (const change of changes) {
          const task = classifyFile(change.status, change.filePath);
          const projectId = repo.path || repo.name;
          const key = `${projectId}/${change.filePath}#${hash}`;
          if (seen.has(key)) continue;
          seen.set(key, results.length);
          results.push({
            formatted: `${repo.name}/${change.filePath}#${hash};${task.label}`,
            projectName: repo.name, projectPath: repo.path, filePath: change.filePath,
            hash, taskCode: task.code, description: task.label, ustibb: task.ustibb,
            status: change.status, branches: [...commitBranches],
          });
        }
        if (processed % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (commitsByOid.size === 0 && repoIssues.length)
        errors.push({ repo: repo.name, error: repoIssues[0] });
    } catch (error) {
      errors.push({ repo: repo.name, error: error.message || String(error) });
      if (!branches.some(b => b.projectPath === repo.path))
        branches.push({ project: repo.name, projectPath: repo.path, branch: '(erro)', checkedBranches });
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return { results, repoCount: repos.length, commitCount, errors, branches };
}

export async function detectGitAuthors(rootHandle, { sinceDate, sinceDays = 30, onProgress } = {}) {
  const session = await getFolderSession(rootHandle);
  const { repos, fs } = session;
  const authors = new Map();
  const seenCommits = new Set();
  const cutoff = getCutoffTimestamp({ sinceDate, sinceDays });

  for (let index = 0; index < repos.length; index++) {
    const repo = repos[index];
    onProgress?.(`Identificando autor em ${repo.name}…`, index, repos.length);
    const repoState = getRepoState(session, repo);
    const { cache } = repoState;
    const dir = repo.path ? `/${repo.path}` : '/';
    try {
      const branches = repoState.branches ||= await listAvailableBranches(fs, dir);
      for (const branchEntry of branches) {
        const { ref: branchRef } = branchEntry;
        let branchOid;
        try { branchOid = await git.resolveRef({ fs, dir, gitdir: `${dir}/.git`, ref: branchRef, cache }); } catch {
          await new Promise(resolve => setTimeout(resolve, 0));
          continue;
        }
        if (typeof branchOid !== 'string' || !/^[0-9a-f]{40}$/i.test(branchOid)) {
          await new Promise(resolve => setTimeout(resolve, 0));
          continue;
        }
        let commits;
        try {
          const cachedLog = repoState.logs.get(branchRef);
          const cachedCoversPeriod = cachedLog && (
            cachedLog.complete || cachedLog.coversSince <= cutoff ||
            cachedLog.commits.at(-1)?.commit?.committer?.timestamp <= cutoff
          );
          commits = cachedCoversPeriod ? cachedLog.commits : await git.log({
            fs, dir, gitdir: `${dir}/.git`, ref: branchOid,
            since: new Date(cutoff * 1000), depth: 5000, force: true, cache,
          });
          if (!cachedCoversPeriod)
            repoState.logs.set(branchRef, { commits, complete: false, coversSince: cutoff });
        } catch {
          await new Promise(resolve => setTimeout(resolve, 0));
          continue;
        }
        for (const entry of commits) {
          if (typeof entry?.oid !== 'string' || !entry.commit || entry.commit.committer?.timestamp < cutoff) continue;
          const commitKey = `${repo.path || repo.name}:${entry.oid}`;
          if (seenCommits.has(commitKey)) continue;
          seenCommits.add(commitKey);
          const name = entry.commit.author?.name?.trim();
          const email = entry.commit.author?.email?.trim();
          if (!name && !email) continue;
          const normalizedIdentity = `${name || ''} ${email || ''}`.toLocaleLowerCase('pt-BR');
          if (normalizedIdentity.includes('aic-workflow-autoupdate')) continue;
          const key = (email || name).toLocaleLowerCase('pt-BR');
          const current = authors.get(key) || {
            name: name || email,
            email: email || '',
            count: 0,
            projects: new Set(),
            lastTimestamp: 0,
          };
          current.count++;
          current.projects.add(repo.path || repo.name);
          current.lastTimestamp = Math.max(current.lastTimestamp, entry.commit.author?.timestamp || entry.commit.committer?.timestamp || 0);
          authors.set(key, current);

          // A inspeção dos arquivos é feita junto com a primeira leitura. Ao
          // escanear depois, resta apenas filtrar e formatar dados em memória.
          if ((entry.commit.parent?.length || 0) <= 1 && !repoState.commitChanges.has(entry.oid)) {
            try {
              const changes = await changedFiles(
                fs, dir, entry.oid, entry.commit.parent?.[0] || null, cache
              );
              repoState.commitChanges.set(entry.oid, changes);
            } catch {}
          }
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return [...authors.values()]
    .map(author => ({ ...author, projects: author.projects.size }))
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp || b.projects - a.projects || b.count - a.count || a.name.localeCompare(b.name));
}
