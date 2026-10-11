// Renders sample PDFs with the SAME engine the web app uses (src/pdf.ts), in Node.
//   npm run test:pdf        → writes tmp/blank.pdf, tmp/filled.pdf, tmp/long.pdf
// Handy for checking layout changes without starting the whole stack.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tmp = path.join(root, 'tmp');
await mkdir(tmp, { recursive: true });

// Bundle the TypeScript engine so Node can import it (jspdf stays external).
const bundle = path.join(tmp, 'pdf.bundle.mjs');
await build({
  entryPoints: [path.join(root, 'src/pdf.ts')],
  outfile: bundle,
  bundle: true,
  format: 'esm',
  platform: 'node',
  external: ['jspdf'],
  logLevel: 'error',
});
const { buildPdf } = await import(pathToFileURL(bundle).href);

const pub = path.join(root, 'public/assets');
const rd = async (p) => new Uint8Array(await readFile(path.join(pub, p)));
const assets = {
  fonts: {
    regular: await rd('fonts/LiberationSerif-Regular.ttf'),
    bold: await rd('fonts/LiberationSerif-Bold.ttf'),
    italic: await rd('fonts/LiberationSerif-Italic.ttf'),
    boldItalic: await rd('fonts/LiberationSerif-BoldItalic.ttf'),
  },
  images: {
    watermark: await rd('pdf/watermark.jpg'),
    header: await rd('pdf/logo-header.jpg'),
    footer: await rd('pdf/logo-footer.jpg'),
  },
};

const filled = {
  date: '2026-09-29',
  data: {
    '1B': 'Dravyaguna Vigyan',
    '1C': '8 hours',
    '2A': 'Rasa panchaka, Virya and Vipaka; Karma of Dravya (Chapter 2, Unit 3)',
    '2B': 'Actual 7.5 hrs vs Target 8 hrs',
    '2C':
      'Rasa is the first-perceived attribute of a dravya; Virya is the active potency (hot/cold). ' +
      'Vipaka is the post-digestive transformation – Madhura, Amla and Katu. Remember: “Rasa-Guna-Virya-Vipaka-Prabhava”.\nRevise Nighantu names tomorrow.',
    '3A': 120,
    '3B': 78,
    '3C': 'Confusion between Virya and Prabhava; Vipaka of Lavana rasa.',
    '3D': 'PYQ 2019–2024 + Test Series 4',
    '4A': '4',
    '4B': 'Good retention of Rasa and Guna. Solved 90 MCQs in one sitting without a break.',
    '4C': 'Slow in recall of Nighantu synonyms; too much time on Vipaka.',
    '5A': 'Dhatu, Mala, Dosha basics',
    '5B': 7,
    '6A': 'Consistency beats intensity.',
    '6B': 'Every small step counts towards AIAPGET success.',
    '7A': 'Rasashastra – Parada samskara; Bhaishajya Kalpana – Kwatha',
    '7B': 'Nighantu synonyms',
    '7C': 'Finish Rasashastra unit 1 and solve 100 MCQs',
  },
};

// A deliberately huge answer to prove long rows flow over several pages.
const long = structuredClone(filled);
long.data['2C'] = Array.from(
  { length: 60 },
  (_, i) => `Point ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt.`,
).join('\n');
long.data['3C'] = 'Supercalifragilisticexpialidocious_'.repeat(6); // one very long "word"

for (const [name, entries] of [
  ['blank', [{ date: '2026-09-29', data: {} }]],
  ['filled', [filled]],
  ['long', [long]],
  ['merged', [filled, { ...filled, date: '2026-09-30' }]],
]) {
  const pdf = await buildPdf(entries, assets);
  const buf = Buffer.from(pdf.output('arraybuffer'));
  await writeFile(path.join(tmp, `${name}.pdf`), buf);
  console.log(`${name}.pdf  pages=${pdf.getNumberOfPages()}  ${(buf.length / 1024).toFixed(0)} KB`);
}
