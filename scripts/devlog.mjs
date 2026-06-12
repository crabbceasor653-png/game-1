import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const logDir = path.join(rootDir, 'devlogs');
const now = new Date();
const pad = (value) => String(value).padStart(2, '0');
const dateStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const timeStamp = now.toLocaleTimeString('en-GB', {
  hour: '2-digit',
  minute: '2-digit'
});
const logFile = path.join(logDir, `${dateStamp}.md`);

function readFlag(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return fallback;
  return value;
}

function formatField(label, value) {
  return `- ${label}: ${value || 'none'}`;
}

async function ensureLogFile() {
  await fs.mkdir(logDir, { recursive: true });
  try {
    await fs.access(logFile);
  } catch {
    const initial = [`# ${dateStamp}`, '', `## ${timeStamp} - Session start`, '- Completed: none', '- In progress: none', '- To do: none', '- Blockers: none', '- Decisions: none', '- Verification: none', ''].join('\n');
    await fs.writeFile(logFile, `${initial}\n`, 'utf8');
  }
}

async function main() {
  await ensureLogFile();

  const title = readFlag('title', 'Session update');
  const completed = readFlag('completed');
  const inProgress = readFlag('in-progress', readFlag('inprogress'));
  const todo = readFlag('todo');
  const blockers = readFlag('blockers');
  const decisions = readFlag('decisions');
  const verification = readFlag('verification');

  const block = [
    `## ${timeStamp} - ${title}`,
    formatField('Completed', completed),
    formatField('In progress', inProgress),
    formatField('To do', todo),
    formatField('Blockers', blockers),
    formatField('Decisions', decisions),
    formatField('Verification', verification),
    ''
  ].join('\n');

  await fs.appendFile(logFile, `${block}\n`, 'utf8');
  process.stdout.write(`${logFile}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
