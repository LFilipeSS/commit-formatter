import { Buffer } from 'buffer';

// isomorphic-git usa Buffer em tempo de execução, mas o Vite não injeta os
// globais do Node automaticamente em aplicações para navegador.
globalThis.Buffer ||= Buffer;

function createStats(kind, size = 0, lastModified = Date.now()) {
  return {
    size,
    mode: kind === 'directory' ? 0o040755 : 0o100644,
    mtimeMs: lastModified,
    ctimeMs: lastModified,
    uid: 0,
    gid: 0,
    isFile: () => kind === 'file',
    isDirectory: () => kind === 'directory',
    isSymbolicLink: () => false,
  };
}

function normalize(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function createBrowserFs(rootHandle) {
  const readOnly = async () => {
    throw Object.assign(new Error('Filesystem is read-only'), { code: 'EROFS' });
  };
  async function resolve(path) {
    const parts = normalize(path).split('/').filter(Boolean);
    let handle = rootHandle;
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') throw Object.assign(new Error('Path outside selected folder'), { code: 'EACCES' });
      try {
        handle = await handle.getDirectoryHandle(part);
      } catch {
        try {
          handle = await handle.getFileHandle(part);
        } catch {
          throw Object.assign(new Error(`Not found: ${path}`), { code: 'ENOENT' });
        }
      }
    }
    return handle;
  }

  const promises = {
    async readFile(path, options) {
      try {
        const handle = await resolve(path);
        if (handle.kind !== 'file') throw Object.assign(new Error(`Is a directory: ${path}`), { code: 'EISDIR' });
        const file = await handle.getFile();
        const buffer = typeof FileReader === 'function'
          ? await new Promise((resolveRead, rejectRead) => {
              const reader = new FileReader();
              reader.onload = () => resolveRead(reader.result);
              reader.onerror = () => rejectRead(reader.error || new Error(`Falha ao ler ${path}`));
              reader.readAsArrayBuffer(file);
            })
          : await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const encoding = typeof options === 'string' ? options : options?.encoding;
        // Copia para memória própria. Alguns navegadores podem desvincular o
        // ArrayBuffer retornado pelo FileReader depois que a leitura termina;
        // isomorphic-git mantém os bytes do índice do pack em cache.
        return encoding ? new TextDecoder(encoding === 'utf8' ? 'utf-8' : encoding).decode(bytes) : Buffer.from(bytes);
      } catch (error) {
        throw error;
      }
    },
    async readdir(path) {
      const handle = await resolve(path);
      if (handle.kind !== 'directory') throw Object.assign(new Error(`Not a directory: ${path}`), { code: 'ENOTDIR' });
      const names = [];
      for await (const name of handle.keys()) names.push(name);
      return names;
    },
    async stat(path) {
      const handle = await resolve(path);
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        return createStats('file', file.size, file.lastModified);
      }
      return createStats('directory');
    },
    async lstat(path) { return promises.stat(path); },
    async readlink() { throw Object.assign(new Error('Symbolic links are not available in the browser'), { code: 'EINVAL' }); },
    writeFile: readOnly,
    mkdir: readOnly,
    rmdir: readOnly,
    unlink: readOnly,
    symlink: readOnly,
  };

  return { promises };
}

export async function findGitRepositories(rootHandle, maxDepth = 2) {
  const repos = [];

  async function visit(handle, relativePath, depth) {
    if (depth > maxDepth) return;
    let hasGit = false;
    try {
      const git = await handle.getDirectoryHandle('.git');
      hasGit = git.kind === 'directory';
    } catch {}

    if (hasGit) {
      repos.push({ name: handle.name, path: relativePath, handle });
      return;
    }

    if (depth === maxDepth) return;
    for await (const [name, child] of handle.entries()) {
      if (child.kind !== 'directory' || name.startsWith('.') || name === 'node_modules') continue;
      await visit(child, relativePath ? `${relativePath}/${name}` : name, depth + 1);
    }
  }

  // Também aceita que o usuário selecione diretamente um repositório.
  await visit(rootHandle, '', 0);
  return repos;
}
