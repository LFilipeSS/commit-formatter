import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { detectGitAuthors, scanFolder } from './git-scanner.js';

class LocalFileHandle {
  constructor(path) { this.path = path; this.name = basename(path); this.kind = 'file'; }
  async getFile() {
    const data = await readFile(this.path);
    const info = await stat(this.path);
    return {
      size: data.length,
      lastModified: info.mtimeMs,
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  }
}

class LocalDirectoryHandle {
  constructor(path) { this.path = path; this.name = basename(path); this.kind = 'directory'; }
  async getDirectoryHandle(name) {
    const path = join(this.path, name);
    if (!(await stat(path)).isDirectory()) throw new Error('not a directory');
    return new LocalDirectoryHandle(path);
  }
  async getFileHandle(name) {
    const path = join(this.path, name);
    if (!(await stat(path)).isFile()) throw new Error('not a file');
    return new LocalFileHandle(path);
  }
  async *entries() {
    for (const entry of await readdir(this.path, { withFileTypes: true })) {
      const path = join(this.path, entry.name);
      yield [entry.name, entry.isDirectory() ? new LocalDirectoryHandle(path) : new LocalFileHandle(path)];
    }
  }
  async *keys() { for (const name of await readdir(this.path)) yield name; }
}

const root = process.argv[2];
const author = process.argv[3];
const days = Number(process.argv[4] || 30);
if (!root || !author) throw new Error('Uso: node diagnose-real.mjs <pasta> <autor> [dias]');

const rootHandle = new LocalDirectoryHandle(root);
if (process.env.DETECT_FIRST === '1') await detectGitAuthors(rootHandle);
const result = await scanFolder(rootHandle, {
  author,
  sinceDays: days,
  onProgress: message => console.log(message),
});

const commits = new Set(result.results.map(item => `${item.projectPath}:${item.hash}`));
console.log(JSON.stringify({
  repoCount: result.repoCount,
  commitCount: result.commitCount,
  commitsWithMeasuredFiles: commits.size,
  fileCount: result.results.length,
  errors: result.errors,
  projects: Object.fromEntries(result.branches.map(item => [item.project, {
    checkedBranches: item.checkedBranches.length,
    commits: new Set(result.results.filter(r => r.projectPath === item.projectPath).map(r => r.hash)).size,
    files: result.results.filter(r => r.projectPath === item.projectPath).length,
  }])),
}, null, 2));
