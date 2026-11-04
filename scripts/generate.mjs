import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const pageFile = /\.mdx?$/;
const openMarker = /^<!-- flavour (\S+)( todo)? -->$/;
const closeMarker = '<!-- /flavour -->';

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)).map((f) => `${entry.name}/${f}`) : [entry.name],
  );

const markerLike = /^<!--\s*\/?flavour\b/;

/** Splits a page into shared text and flavour blocks; syntax problems go to `errors` as `where:line: message`. */
function parse(text, where, knownFlavour, errors) {
  const parts = [{ lines: [] }];
  let open = null;
  const fail = (line, message) => errors.push(`${where}:${line}: ${message}`);
  text.split('\n').forEach((raw, index) => {
    const line = raw.trimEnd();
    const at = index + 1;
    const opening = openMarker.exec(line);
    if (opening) {
      if (open) fail(at, `block "${opening[1]}" opens inside block "${open.flavour}"`);
      else if (!knownFlavour(opening[1])) fail(at, `unknown flavour "${opening[1]}"`);
      open = { flavour: opening[1], at };
      parts.push({ flavour: opening[1], todo: Boolean(opening[2]), lines: [] });
    } else if (line === closeMarker) {
      if (!open) fail(at, 'closing marker outside a block');
      open = null;
      parts.push({ lines: [] });
    } else if (markerLike.test(line)) {
      fail(at, `malformed marker "${line}"`);
    } else {
      parts.at(-1).lines.push(raw);
    }
  });
  if (open) fail(open.at, `block "${open.flavour}" is not closed`);
  return parts;
}

/** Every value combination of the axes in `names`, as objects of axis to flavour. */
const combinations = (axes, names) =>
  names.reduce((acc, axis) => acc.flatMap((c) => Object.keys(axes[axis]).map((f) => ({ ...c, [axis]: f }))), [{}]);

const splitFrontMatter = (text) => {
  const m = /^---\n[\s\S]*?\n---\n/.exec(text);
  return m ? { front: m[0], body: text.slice(m[0].length) } : { front: '', body: text };
};

/** The front matter a stub needs: the source's own, plus a `title` from the first heading when it has none. */
function stubFront(text) {
  const { front, body } = splitFrontMatter(text);
  if (/^title:/m.test(front)) return front;
  const heading = /^# (.+)$/m.exec(body)?.[1];
  if (!heading) return front;
  const title = `title: ${JSON.stringify(heading)}\n`;
  return front ? front.replace(/\n---\n$/, `\n${title}---\n`) : `---\n${title}---\n`;
}

/** Route of the page at `rel`: no extension, and a folder index sits at its folder. */
const urlOf = (rel) => `/${rel.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '')}`;

/** Relative link path from the page at `from` to the page at `to`, both under the output root. */
const linkPath = (from, to) => {
  const path = posix.relative(posix.dirname(from), to);
  return path.startsWith('.') ? path : `./${path}`;
};

const linkPattern = /\]\((\.\.?\/[^)#\s]*\.mdx?)(#[^)]*)?\)/g;

/** Builds the page tree under `config.outDir` from the source pages under `config.docsRoot`. */
export function generate({ root, config }) {
  const { axes } = config;
  const axisOrder = Object.keys(axes);
  const axisOf = (flavour) => axisOrder.find((a) => flavour in axes[a]);
  const label = (combo) => axisOrder.filter((a) => a in combo).map((a) => axes[a][combo[a]]).join(' · ');
  const treePath = (combo, rel) => [...axisOrder.filter((a) => a in combo).map((a) => combo[a]), rel].join('/');

  const source = join(root, config.docsRoot);
  const out = join(root, config.outDir);
  rmSync(out, { recursive: true, force: true });
  const errors = [];
  const written = new Map();
  /** Records that `from` writes the output file `path`; false when another source already did. */
  const claim = (path, from) => {
    const other = written.get(path);
    if (other) errors.push(`${path} is written by both ${[other, from].sort().join(' and ')}`);
    else written.set(path, from);
    return !other;
  };
  const emit = (rel, text, from) => {
    if (!claim(rel, from)) return;
    mkdirSync(dirname(join(out, rel)), { recursive: true });
    writeFileSync(join(out, rel), text);
  };

  for (const axis of axisOrder) {
    for (const flavour of Object.keys(axes[axis])) {
      const first = axisOf(flavour);
      if (first !== axis) errors.push(`flavour name "${flavour}" is on both axis "${first}" and axis "${axis}"`);
    }
  }

  const pages = new Map();
  for (const rel of walk(source)) {
    const where = `${config.docsRoot}/${rel}`;
    const text = pageFile.test(rel) ? readFileSync(join(source, rel), 'utf8') : null;
    const parts = text === null ? [] : parse(text, where, axisOf, errors);
    const named = parts.filter((p) => p.flavour && axisOf(p.flavour));
    const used = axisOrder.filter((a) => named.some((p) => axisOf(p.flavour) === a));
    for (const axis of used) {
      const blocks = named.filter((p) => axisOf(p.flavour) === axis);
      for (const flavour of Object.keys(axes[axis])) {
        if (!blocks.some((p) => p.flavour === flavour)) errors.push(`${where}: no block or todo for flavour "${flavour}"`);
      }
      if (blocks.every((p) => p.todo)) errors.push(`${where}: every block of axis "${axis}" is todo`);
    }
    pages.set(rel, { text, parts, used });
  }
  if (errors.length) throw new Error(errors.join('\n'));

  // A tree page links into its own tree when it has every axis the target varies on; otherwise the stub chooses.
  const rewriteLinks = (body, from, combo) =>
    body.replace(linkPattern, (match, target, hash = '') => {
      const to = posix.join(posix.dirname(from), target);
      const page = pages.get(to);
      if (!page) return match;
      const inTree = page.used.length > 0 && page.used.every((a) => a in combo);
      const dest = inTree ? treePath(Object.fromEntries(page.used.map((a) => [a, combo[a]])), to) : to;
      return `](${linkPath(treePath(combo, from), dest)}${hash})`;
    });

  // Counts source blocks, so a second client flavour does not double a gap.
  let todos = 0;
  const manifest = [];
  for (const [rel, { text, parts, used }] of pages) {
    const from = `${config.docsRoot}/${rel}`;
    if (!used.length) {
      if (claim(rel, from)) {
        mkdirSync(dirname(join(out, rel)), { recursive: true });
        copyFileSync(join(source, rel), join(out, rel));
      }
      continue;
    }
    const trees = combinations(axes, used);
    todos += parts.filter((p) => p.todo).length;
    for (const combo of trees) {
      const notice = (flavour) => {
        const axis = axisOf(flavour);
        const writtenFlavour = Object.keys(axes[axis]).find((f) => parts.some((p) => p.flavour === f && !p.todo));
        const other = { ...combo, [axis]: writtenFlavour };
        const link = `[${label(other)} version](${linkPath(treePath(combo, rel), treePath(other, rel))})`;
        return ['', ':::warning', `Not yet written for ${axes[axis][flavour]}. Read the ${link}.`, ':::', ''];
      };
      const body = parts
        .filter((p) => !p.flavour || Object.values(combo).includes(p.flavour))
        .flatMap((p) => (p.todo ? notice(p.flavour) : p.lines))
        .join('\n');
      const { front, body: rest } = splitFrontMatter(rewriteLinks(body, rel, combo));
      const shown = front ? front.replace(/\n---\n$/, '\ndisplayed_sidebar: docs\n---\n') : '---\ndisplayed_sidebar: docs\n---\n';
      emit(treePath(combo, rel), shown + rest, from);
    }
    manifest.push({
      source: rel,
      url: urlOf(rel),
      axes: used,
      trees: trees.map((flavours) => ({ flavours, url: urlOf(treePath(flavours, rel)) })),
    });
    const front = stubFront(text);
    const links = trees.map((combo) => `- [${label(combo)}](${linkPath(rel, treePath(combo, rel))})`);
    emit(rel, `${front}\nThis page has one version for each flavour. Choose yours:\n\n${links.join('\n')}\n`, from);
  }
  emit('flavours.json', `${JSON.stringify({ pages: manifest }, null, 2)}\n`, 'the generator');
  if (errors.length) throw new Error(errors.join('\n'));
  if (todos > config.todoCap) {
    const noun = todos === 1 ? 'notice exceeds' : 'notices exceed';
    throw new Error(`${todos} open todo ${noun} the cap of ${config.todoCap}`);
  }
  return { todos };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const config = JSON.parse(readFileSync(join(root, 'flavours.config.json'), 'utf8'));
  try {
    const { todos } = generate({ root, config });
    console.log(`${config.outDir} generated, ${todos} open todo notice(s) of ${config.todoCap}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
