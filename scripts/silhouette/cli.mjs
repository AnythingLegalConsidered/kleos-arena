#!/usr/bin/env node
// Silhouette post-process CLI (CONCEPT §Art). Takes source images (PNG) and
// forces them onto an exact two-tone palette so every asset shares the same
// style whatever generator produced it. Offline tooling only — never shipped
// to the client or server bundle.
//
// Usage:
//   node scripts/silhouette/cli.mjs --in <file.png|dir> --out <dir> [options]
//
// Options:
//   --fg <#hex|transparent>   figure tone            (default #14110d)
//   --bg <#hex|transparent>   background tone        (default transparent)
//   --threshold <0-255|otsu>  luma cut               (default otsu, per image)
//   --invert                  sources are light-figure-on-dark
//   --suffix <text>           appended to the output basename (default '')

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { PNG } from 'pngjs';
import { parseTone, toTwoTone } from './threshold.mjs';

// Outside these bounds the figure/background split is almost certainly wrong
// (bad source, or --invert missing) — flagged per file, non-fatal.
const FIGURE_RATIO_MIN = 0.02;
const FIGURE_RATIO_MAX = 0.9;

function usage(message) {
  if (message) console.error(`error: ${message}\n`);
  console.error(
    'usage: node scripts/silhouette/cli.mjs --in <file.png|dir> --out <dir>' +
      " [--fg <#hex|transparent>] [--bg <#hex|transparent>] [--threshold <0-255|otsu>] [--invert] [--suffix <text>]"
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    in: null,
    out: null,
    fg: '#14110d',
    bg: 'transparent',
    threshold: 'otsu',
    invert: false,
    suffix: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => {
      i++;
      if (i >= argv.length) usage(`missing value for ${flag}`);
      return argv[i];
    };
    switch (flag) {
      case '--in':
        args.in = next();
        break;
      case '--out':
        args.out = next();
        break;
      case '--fg':
        args.fg = next();
        break;
      case '--bg':
        args.bg = next();
        break;
      case '--threshold':
        args.threshold = next();
        break;
      case '--invert':
        args.invert = true;
        break;
      case '--suffix':
        args.suffix = next();
        break;
      default:
        usage(`unknown flag ${flag}`);
    }
  }
  if (!args.in || !args.out) usage('--in and --out are required');
  if (args.threshold !== 'otsu') {
    const t = Number(args.threshold);
    if (!Number.isInteger(t) || t < 0 || t > 255) {
      usage(`--threshold must be an integer 0-255 or 'otsu', got '${args.threshold}'`);
    }
    args.threshold = t;
  }
  return args;
}

function listSources(input) {
  const stats = statSync(input);
  if (stats.isFile()) return [input];
  return readdirSync(input)
    .filter((name) => extname(name).toLowerCase() === '.png')
    .sort()
    .map((name) => join(input, name));
}

function processFile(source, args, options) {
  const png = PNG.sync.read(readFileSync(source));
  const { out, threshold, figureRatio } = toTwoTone(png.data, options);

  const result = new PNG({ width: png.width, height: png.height });
  result.data = Buffer.from(out.buffer, out.byteOffset, out.byteLength);

  const name = `${basename(source, extname(source))}${args.suffix}.png`;
  const target = join(args.out, name);
  writeFileSync(target, PNG.sync.write(result));

  const percent = (figureRatio * 100).toFixed(1);
  let line = `${basename(source)} -> ${name}  threshold=${threshold}  figure=${percent}%`;
  if (figureRatio < FIGURE_RATIO_MIN || figureRatio > FIGURE_RATIO_MAX) {
    line += '  [WARN: figure ratio out of bounds — bad source, or missing/extra --invert?]';
  }
  console.log(line);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    threshold: args.threshold,
    invert: args.invert,
    fg: parseTone(args.fg),
    bg: parseTone(args.bg),
  };

  const sources = listSources(args.in);
  if (sources.length === 0) {
    console.error(`error: no .png files found in ${args.in}`);
    process.exit(1);
  }
  mkdirSync(args.out, { recursive: true });

  let failures = 0;
  for (const source of sources) {
    try {
      processFile(source, args, options);
    } catch (error) {
      failures++;
      console.error(`${basename(source)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failures > 0) process.exit(1);
}

main();
