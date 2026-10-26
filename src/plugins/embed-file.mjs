import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Code fences with `file="path"` take their body from that file, relative to `baseDir`. */
export function fileMeta(meta) {
  return /\bfile="([^"]+)"/.exec(meta ?? '')?.[1];
}

export function readEmbedded(baseDir, path) {
  return readFileSync(join(baseDir, path), 'utf8');
}

export default function embedFile({ baseDir = process.cwd() } = {}) {
  const walk = (node) => {
    if (node.type === 'code' && fileMeta(node.meta)) node.value = readEmbedded(baseDir, fileMeta(node.meta)).trimEnd();
    node.children?.forEach(walk);
  };
  return (tree) => walk(tree);
}
