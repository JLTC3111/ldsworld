import { mkdir, rm, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));

// Read module syntax without mistaking examples, shader strings, comments, or
// regular expressions for imports. Template expressions remain executable code.
function moduleTokens(code) {
  const tokens = []; let index = 0, previous = '';
  const push = (type, value, start, end = index) => { tokens.push({ type, value, start, end }); previous = value; };
  function template() {
    index++;
    while (index < code.length) {
      if (code[index] === '\\') { index += 2; continue; }
      if (code[index] === '`') { index++; return; }
      if (code[index] === '$' && code[index + 1] === '{') { index += 2; previous = '('; scan(true); continue; }
      index++;
    }
  }
  function scan(expression = false) {
    let depth = 0;
    while (index < code.length) {
      const char = code[index], next = code[index + 1];
      if (/\s/u.test(char)) { index++; continue; }
      if (char === '/' && next === '/') { index += 2; while (index < code.length && code[index] !== '\n') index++; continue; }
      if (char === '/' && next === '*') { index += 2; while (index < code.length && !(code[index] === '*' && code[index + 1] === '/')) index++; index += 2; continue; }
      if (char === '"' || char === "'") {
        const start = index++, quote = char;
        while (index < code.length && code[index] !== quote) { if (code[index] === '\\') index++; index++; }
        index++; push('string', code.slice(start + 1, index - 1), start); continue;
      }
      if (char === '`') { template(); previous = 'template'; continue; }
      if (char === '/' && (!previous || /^(?:[({[=,:;!?&|+*%~^<>-]|return|throw|case|yield|=>)$/u.test(previous))) {
        index++; let characterClass = false;
        while (index < code.length) {
          if (code[index] === '\\') { index += 2; continue; }
          if (code[index] === '[') characterClass = true;
          if (code[index] === ']') characterClass = false;
          if (code[index] === '/' && !characterClass) { index++; while (/[a-z]/iu.test(code[index] || '')) index++; break; }
          index++;
        }
        previous = 'regexp'; continue;
      }
      if (/[a-z_$]/iu.test(char)) { const start = index++; while (/[\w$]/u.test(code[index] || '')) index++; push('identifier', code.slice(start, index), start); continue; }
      if (expression && char === '}' && depth === 0) { index++; return; }
      if (char === '{') depth++;
      if (char === '}') depth--;
      const start = index++; push('punctuation', char, start);
    }
  }
  scan(); return tokens;
}

function versioned(specifier, revision, extensions) {
  if (!/^\.{1,2}\//u.test(specifier) || !extensions.test(specifier.split(/[?#]/u)[0])) return specifier;
  const hashIndex = specifier.indexOf('#'), fragment = hashIndex < 0 ? '' : specifier.slice(hashIndex);
  const resource = hashIndex < 0 ? specifier : specifier.slice(0, hashIndex), queryIndex = resource.indexOf('?');
  const pathname = queryIndex < 0 ? resource : resource.slice(0, queryIndex), parameters = new URLSearchParams(queryIndex < 0 ? '' : resource.slice(queryIndex + 1));
  parameters.set('v', revision); return `${pathname}?${parameters}${fragment}`;
}

export function versionModuleImports(code, revision) {
  const tokens = moduleTokens(code), replacements = new Map();
  const add = token => {
    if (token?.type !== 'string') return;
    const value = versioned(token.value, revision, /\.m?js$/iu);
    if (value !== token.value) replacements.set(token.start, { start: token.start + 1, end: token.end - 1, value });
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], next = tokens[index + 1];
    if (token.type !== 'identifier' || !['import', 'export'].includes(token.value) || tokens[index - 1]?.value === '.') continue;
    if (token.value === 'import' && next?.type === 'string') { add(next); continue; }
    if (token.value === 'import' && next?.value === '(') { if ([')', ','].includes(tokens[index + 3]?.value)) add(tokens[index + 2]); continue; }
    if (token.value === 'import' ? !next || next.value === '.' || next.value === ':' : !['{', '*'].includes(next?.value)) continue;
    for (let cursor = index + 1; cursor < tokens.length && tokens[cursor].value !== ';'; cursor++) {
      if (tokens[cursor].value === 'from' && tokens[cursor + 1]?.type === 'string') { add(tokens[cursor + 1]); break; }
    }
  }
  for (const replacement of [...replacements.values()].sort((a, b) => b.start - a.start)) code = code.slice(0, replacement.start) + replacement.value + code.slice(replacement.end);
  return code;
}

export function versionHtmlResources(html, revision) {
  return html.replace(/(\b(?:src|href)\s*=\s*)(["'])([^"']+)\2/giu, (match, prefix, quote, specifier) => `${prefix}${quote}${versioned(specifier, revision, /\.(?:m?js|css)$/iu)}${quote}`);
}

async function readSource(directory, prefix = '') {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const relative = prefix + entry.name, filename = path.join(directory, entry.name);
    // Input reference photographs and design screenshots are not runtime assets.
    if(relative==='assets/3D_CARS'||relative==='assets/aspects')continue;
    if (entry.isDirectory()) result.push(...await readSource(filename, `${relative}/`));
    else if (entry.isFile()) result.push({ relative, bytes: await readFile(filename) });
    else throw new Error(`Unsupported source entry: ${relative}`);
  }
  return result;
}

export async function buildProject({ source = path.join(root, 'src'), destination = path.join(root, 'dist') } = {}) {
  const inputRoot=path.resolve(source),outputRoot=path.resolve(destination);
  if (inputRoot===outputRoot||inputRoot.startsWith(outputRoot+path.sep)||outputRoot.startsWith(inputRoot+path.sep)) throw new Error('Build source and destination must not overlap');
  const files = await readSource(source), index = files.find(file => file.relative === 'index.html');
  if (!index) throw new Error('Missing entry point');
  if (!index.bytes.toString('utf8').includes('Long D.')) throw new Error('Portfolio metadata missing');
  // Hash the unmodified snapshot, including asset bytes, so identical builds
  // share one revision and source edits cannot produce a mixed module graph.
  const hash = createHash('sha256');
  for (const file of files) hash.update(`${file.relative}\0${file.bytes.length}\0`).update(file.bytes);
  const revision = hash.digest('hex').slice(0, 16);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const file of files) {
    const filename = path.join(destination, file.relative); let content = file.bytes;
    if (/\.m?js$/iu.test(file.relative)) content = versionModuleImports(file.bytes.toString('utf8'), revision);
    else if (/\.html$/iu.test(file.relative)) content = versionHtmlResources(file.bytes.toString('utf8'), revision);
    await mkdir(path.dirname(filename), { recursive: true }); await writeFile(filename, content);
  }
  return { revision, files: files.length, destination };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { revision } = await buildProject();
  console.log(`Built Project Island → dist/ (revision ${revision}; self-contained, no CDN dependencies)`);
}
