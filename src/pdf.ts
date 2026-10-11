/**
 * Daily Assessment Diary → PDF
 *
 * Draws a real (vector) PDF that mirrors the original Word/PDF template:
 * US-Letter page, header logo, faded watermark, footer logo, red title,
 * blue section headings and a two-column ruled table.
 *
 * Every measurement below (in PDF points, 1pt = 1/72in) was taken from the
 * original "Daily Assessment Diary" PDF/DOCX, so a blank diary paginates
 * exactly like the original and a filled diary simply grows the rows.
 *
 * Text is drawn with an embedded Times New Roman-compatible font (Liberation
 * Serif). Text the font cannot draw (Hindi, Gujarati, emoji …) is rendered
 * through the browser canvas and placed as an image so it never turns into
 * empty boxes.
 */
import type { jsPDF } from 'jspdf';
import { ALL, SECTIONS } from './fields';

export type DiaryEntry = { date: string; data: Record<string, any> };

/* ------------------------------------------------------------------ */
/* Date helpers (locale independent, so Node/Chrome/Safari all agree)   */
/* ------------------------------------------------------------------ */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Parses "YYYY-MM-DD" as a local date; returns null when invalid. */
export function parseISO(d: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  if (!m) return null;
  const t = new Date(+m[1], +m[2] - 1, +m[3]);
  return t.getMonth() === +m[2] - 1 ? t : null;
}
export const dayName = (d: string) => {
  const t = parseISO(d);
  return t ? DAYS[t.getDay()] : '';
};
/** "29 Sep 2026" – used in the app UI. */
export const fmt = (d: string) => {
  const t = parseISO(d);
  return t
    ? `${pad2(t.getDate())} ${MONTHS[t.getMonth()].slice(0, 3)} ${t.getFullYear()}`
    : d;
};
/** "29 September 2026 (Tuesday)" – printed in row 1-A of the PDF. */
const fmtLong = (d: string) => {
  const t = parseISO(d);
  return t
    ? `${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()} (${DAYS[t.getDay()]})`
    : d;
};

/* ------------------------------------------------------------------ */
/* Template geometry (points) – measured from the original PDF          */
/* ------------------------------------------------------------------ */
const B = 0.5; // table border thickness
const ROW_FIX = 0.027; // matches the original row pitch (h + 0.527)
const G = {
  x0: 72, // table left edge
  colA: 4407 / 20, // label column width   (220.35)
  colB: 4945 / 20, // answer column width  (247.25)
  top1: 179.3, // table top on the first page of an entry (below the title)
  top2: 85.8, // table top on continuation pages
  bottom: 711, // lowest y a row may reach (keeps clear of the footer logo)
  labelX: 77.7, // label text x
  padR: 5.35, // padding inside the answer column
  baseField: 13.65, // first baseline below a field row's top border
  baseSec: 15.6, // baseline of a section heading below its top border
  lineAns: 16.1, // answer line pitch (14pt, single spacing)
  lineLab: 32.1, // label line pitch (as authored in the original)
  padBottom: 4, // breathing room under the last answer line
  fs: 14,
  fsSec: 16,
  fsTitle: 20,
  titleBase: 161.7,
  titleCx: 306.1,
};
const X_MID = G.x0 + G.colA; // 292.35
const X_RIGHT = G.x0 + G.colA + G.colB; // 539.6
const ANS_X = X_MID + B + G.padR;
const ANS_W = X_RIGHT - G.padR - ANS_X;

/** Images as placed in the original PDF (x, y, w, h). */
const IMG = {
  watermark: [74.3, 155.9, 467.9, 467.9],
  header: [207.6, 36.0, 196.8, 49.8],
  footer: [243.8, 720.9, 125.5, 35.1],
} as const;

/** Minimum row heights (twips) taken from the original DOCX. */
const SEC_MIN = [1247, 1194, 1269, 1267, 1266, 1266, 1267];
const MIN_H: Record<string, number> = {
  '1A': 643, '1B': 645, '1C': 642,
  '2A': 1286, '2B': 645, '2C': 642,
  '3A': 642, '3B': 645, '3C': 1288, '3D': 1288,
  '4A': 645, '4B': 1286, '4C': 1288,
  '5A': 645, '5B': 1288,
  '6A': 642, '6B': 1934,
  '7A': 1285, '7B': 645, '7C': 645,
};

/** Label text exactly as broken into lines in the original (b = bold, i = italic). */
type Run = [text: string, style?: 'b' | 'i'];
const LABELS: Record<string, Run[][]> = {
  '1A': [[['A.', 'b'], [' Date & Day']]],
  '1B': [[['B.', 'b'], [' Subject Planned for Today']]],
  '1C': [[['C.', 'b'], [' Study Hours Target']]],
  '2A': [[['A.', 'b'], [' Topics Covered Today']], [['(Chapter/Unit/Subject wise)']]],
  '2B': [[['B.', 'b'], [' Time Spent (Actual vs Target)']]],
  '2C': [[['C.', 'b'], [' Key Notes / Points Learned']]],
  '3A': [[['A.', 'b'], [' Number of MCQs attempted']]],
  '3B': [[['B.', 'b'], [' Correct Answers (%)']]],
  '3C': [[['C.', 'b'], [' Mistakes / Weak Areas (to revise']], [['again)']]],
  '3D': [[['D.', 'b'], [' Source of Questions (PYQ / Test']], [['Series / Book)']]],
  '4A': [[['A.', 'b'], [' Confidence Level (1–5 rating)']]],
  '4B': [[['B.', 'b'], [' Today’s Strength (what went']], [['well)']]],
  '4C': [[['C.', 'b'], [' Today’s Weakness (what needs']], [['work)']]],
  '5A': [[['A.', 'b'], [' Topics Revised Today']]],
  '5B': [[['B.', 'b'], [' Quick Recall Score (Self-quiz out']], [['of 10)']]],
  '6A': [[['A.', 'b'], [' 1 line of self-motivation OR']]],
  '6B': [
    [['B.', 'b'], [' A quote/affirmation (e.g., '], ['“Every', 'i']],
    [['small step counts towards AIAPGET', 'i']],
    [['success”', 'i'], [')']],
  ],
  '7A': [[['A.', 'b'], [' Subjects/Topics to be studied']], [['tomorrow']]],
  '7B': [[['B.', 'b'], [' Special focus areas']]],
  '7C': [[['C.', 'b'], [' Short-term goal for the next day']]],
};

/* ------------------------------------------------------------------ */
/* Assets (fonts + images), fetched once and cached                     */
/* ------------------------------------------------------------------ */
export type Assets = {
  fonts: { regular: Uint8Array; bold: Uint8Array; italic: Uint8Array; boldItalic: Uint8Array };
  images: { watermark: Uint8Array; header: Uint8Array; footer: Uint8Array };
};

let assetsCache: Promise<Assets> | null = null;
export function loadAssets(base = 'assets/'): Promise<Assets> {
  if (!assetsCache) {
    const get = async (p: string) => {
      const r = await fetch(base + p);
      if (!r.ok) throw new Error(`Could not load ${p} (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    };
    assetsCache = Promise.all([
      get('fonts/LiberationSerif-Regular.ttf'),
      get('fonts/LiberationSerif-Bold.ttf'),
      get('fonts/LiberationSerif-Italic.ttf'),
      get('fonts/LiberationSerif-BoldItalic.ttf'),
      get('pdf/watermark.jpg'),
      get('pdf/logo-header.jpg'),
      get('pdf/logo-footer.jpg'),
    ])
      .then(([regular, bold, italic, boldItalic, watermark, header, footer]) => ({
        fonts: { regular, bold, italic, boldItalic },
        images: { watermark, header, footer },
      }))
      .catch((e) => {
        assetsCache = null; // allow a retry after a network hiccup
        throw e;
      });
  }
  return assetsCache;
}

const toBase64 = (u: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000)
    s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};

/* ------------------------------------------------------------------ */
/* Text handling                                                        */
/* ------------------------------------------------------------------ */
const clean = (v: unknown) =>
  String(v ?? '')
    .replace(/\r\n?|\u2028|\u2029/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+$/, '');

/** Characters Liberation Serif can draw (Latin, Greek, Cyrillic, common punctuation). */
const UNSUPPORTED = /[^\n\u0020-\u007E\u00A0-\u024F\u0370-\u03FF\u0400-\u04FF\u2010-\u2027\u2030-\u203A\u20AC\u2122\u2212]/;

/** Greedy word wrap. `w` measures a string in points. Long words are split. */
function wrap(text: string, maxW: number, w: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(/ +/)) {
      if (!word) continue;
      const test = line ? `${line} ${word}` : word;
      if (w(test) <= maxW) {
        line = test;
        continue;
      }
      if (line) out.push(line);
      line = '';
      if (w(word) <= maxW) {
        line = word;
        continue;
      }
      // a single word wider than the column: break it by characters
      let piece = '';
      for (const ch of Array.from(word)) {
        if (piece && w(piece + ch) > maxW) {
          out.push(piece);
          piece = '';
        }
        piece += ch;
      }
      line = piece;
    }
    out.push(line);
  }
  return out;
}

/** Browser-canvas text renderer used only for scripts the PDF font lacks. */
type Raster = {
  measure: (s: string) => number;
  draw: (s: string, x: number, baseline: number, w: number) => void;
};
const ASC = 12.7; // baseline offset inside a raster line box
async function createRaster(doc: jsPDF, A: Assets): Promise<Raster> {
  const family = `DiarySerif${Date.now()}`;
  const face = new FontFace(family, A.fonts.regular.slice().buffer as ArrayBuffer);
  await face.load();
  document.fonts.add(face);
  const FONT =
    `${G.fs}px "${family}", "Noto Serif Devanagari", "Noto Serif Gujarati", ` +
    `"Nirmala UI", Mangal, Shruti, "Kohinoor Devanagari", "Kohinoor Gujarati", ` +
    `"Apple Color Emoji", "Segoe UI Emoji", serif`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = FONT;
  const S = 4; // 4 px per point ≈ 288 dpi
  return {
    measure: (s) => probe.measureText(s).width,
    draw: (s, x, baseline, w) => {
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * S);
      c.height = Math.ceil(G.lineAns * S);
      const g = c.getContext('2d')!;
      g.scale(S, S);
      g.font = FONT;
      g.fillStyle = '#000';
      g.textBaseline = 'alphabetic';
      g.fillText(s, 0, ASC);
      doc.addImage(c.toDataURL('image/png'), 'PNG', x, baseline - ASC, w, G.lineAns);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Row model                                                            */
/* ------------------------------------------------------------------ */
type Row =
  | { kind: 'sec'; title: string; h: number }
  | { kind: 'field'; key: string; h: number; label: Run[][]; lines: string[]; raster: boolean };

/* ------------------------------------------------------------------ */
/* Public API                                                           */
/* ------------------------------------------------------------------ */
/** Builds one PDF containing one page-set per entry, in the order given. */
export async function buildPdf(entries: DiaryEntry[], assets?: Assets) {
  const { jsPDF } = await import('jspdf');
  const A = assets ?? (await loadAssets());

  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait', compress: true });
  const add = (file: string, u8: Uint8Array, style: 'normal' | 'bold' | 'italic' | 'bolditalic') => {
    doc.addFileToVFS(file, toBase64(u8));
    doc.addFont(file, 'LiberationSerif', style);
  };
  add('LiberationSerif-Regular.ttf', A.fonts.regular, 'normal');
  add('LiberationSerif-Bold.ttf', A.fonts.bold, 'bold');
  add('LiberationSerif-Italic.ttf', A.fonts.italic, 'italic');
  add('LiberationSerif-BoldItalic.ttf', A.fonts.boldItalic, 'bolditalic');

  const needRaster = entries.some((e) =>
    ALL.some((f) => f.k !== '1A' && UNSUPPORTED.test(clean(e.data?.[f.k]))),
  );
  const raster = needRaster ? await createRaster(doc, A) : null;

  entries.forEach((e, i) => {
    if (i > 0) doc.addPage();
    renderEntry(doc, A, raster, e);
  });

  const first = entries[0]?.date ?? '';
  doc.setProperties({
    title:
      entries.length > 1
        ? `Daily Assessment Diary – ${fmt(first)} to ${fmt(entries[entries.length - 1].date)}`
        : `Daily Assessment Diary – ${fmt(first)}`,
    subject: 'Daily Assessment Diary',
  });
  return doc;
}

/* ------------------------------------------------------------------ */
/* Rendering                                                            */
/* ------------------------------------------------------------------ */
function renderEntry(doc: jsPDF, A: Assets, raster: Raster | null, entry: DiaryEntry) {
  const setFont = (style: 'normal' | 'bold' | 'italic' | 'bolditalic', size: number) => {
    doc.setFont('LiberationSerif', style);
    doc.setFontSize(size);
  };
  const vw = (s: string) => {
    setFont('normal', G.fs);
    return doc.getTextWidth(s);
  };

  /* ---- build rows ---- */
  const rows: Row[] = [];
  SECTIONS.forEach((s, si) => {
    rows.push({ kind: 'sec', title: s.t, h: SEC_MIN[si] / 20 });
    for (const f of s.f) {
      const raw = f.k === '1A' ? fmtLong(entry.date) : clean(entry.data?.[f.k]);
      const useRaster = !!raster && UNSUPPORTED.test(raw);
      const lines = raw
        ? useRaster
          ? wrap(raw, ANS_W, raster!.measure)
          : wrap(raw, ANS_W, vw)
        : [];
      const label = LABELS[f.k];
      const labelH = G.lineAns + (label.length - 1) * G.lineLab;
      const ansH = lines.length ? lines.length * G.lineAns + G.padBottom : 0;
      rows.push({
        kind: 'field',
        key: f.k,
        h: Math.max(MIN_H[f.k] / 20, labelH, ansH),
        label,
        lines,
        raster: useRaster,
      });
    }
  });

  /* ---- page furniture ---- */
  let y = 0;
  let pageTop = 0;
  const fill = (x: number, yy: number, w: number, h: number) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(x, yy, w, h, 'F');
  };
  const newPage = (first: boolean) => {
    if (!first) doc.addPage();
    doc.addImage(A.images.watermark, 'JPEG', ...IMG.watermark, 'wm');
    doc.addImage(A.images.header, 'JPEG', ...IMG.header, 'hd');
    doc.addImage(A.images.footer, 'JPEG', ...IMG.footer, 'ft');
    if (first) {
      setFont('bold', G.fsTitle);
      doc.setTextColor(0xee, 0x00, 0x00);
      doc.text('Daily Assessment Diary', G.titleCx, G.titleBase, { align: 'center' });
    }
    y = pageTop = first ? G.top1 : G.top2;
  };
  const closeTable = () => fill(G.x0, y, X_RIGHT - G.x0 + B, B); // bottom border

  /* ---- drawing primitives ---- */
  const drawRuns = (runs: Run[], x: number, base: number) => {
    doc.setTextColor(0, 0, 0);
    for (const [t, st] of runs) {
      setFont(st === 'b' ? 'bold' : st === 'i' ? 'italic' : 'normal', G.fs);
      doc.text(t, x, base);
      x += doc.getTextWidth(t);
    }
  };

  const drawSection = (r: Extract<Row, { kind: 'sec' }>) => {
    fill(G.x0, y, X_RIGHT - G.x0 + B, B);
    fill(G.x0, y, B, r.h + B);
    fill(X_RIGHT, y, B, r.h + B);
    setFont('bold', G.fsSec);
    doc.setTextColor(0x00, 0x70, 0xc0);
    doc.text(r.title, G.labelX, y + G.baseSec);
    y += r.h + B + ROW_FIX;
  };

  const drawField = (
    r: Extract<Row, { kind: 'field' }>,
    from: number,
    count: number,
    h: number,
    withLabel: boolean,
  ) => {
    fill(G.x0, y, X_RIGHT - G.x0 + B, B);
    for (const x of [G.x0, X_MID, X_RIGHT]) fill(x, y, B, h + B);
    if (withLabel) {
      r.label.forEach((runs, li) => drawRuns(runs, G.labelX, y + G.baseField + li * G.lineLab));
    }
    doc.setTextColor(0, 0, 0);
    setFont('normal', G.fs);
    for (let k = 0; k < count; k++) {
      const text = r.lines[from + k];
      if (!text) continue;
      const base = y + G.baseField + k * G.lineAns;
      if (r.raster) raster!.draw(text, ANS_X, base, ANS_W);
      else doc.text(text, ANS_X, base);
    }
    y += h + B + ROW_FIX;
  };

  /* ---- flow rows onto pages ---- */
  newPage(true);
  const capacity = G.bottom - G.top2 - 2 * B; // content height of a full page
  rows.forEach((r, i) => {
    // keep a section heading together with (the start of) its first row
    let need = r.h + 2 * B;
    if (r.kind === 'sec') need += Math.min((rows[i + 1] as { h: number }).h, 50) + B;
    if (y + need > G.bottom && y > pageTop) {
      closeTable();
      newPage(false);
    }
    if (r.kind === 'sec') {
      drawSection(r);
      return;
    }

    if (r.h <= capacity) {
      drawField(r, 0, r.lines.length, r.h, true);
      return;
    }

    // Very long answer: split the row across pages, line by line.
    let done = 0;
    let firstPart = true;
    while (done < r.lines.length) {
      const avail = G.bottom - y - 2 * B;
      const take = Math.min(
        r.lines.length - done,
        Math.floor((avail - G.padBottom) / G.lineAns),
      );
      if (take < 1) {
        closeTable();
        newPage(false);
        continue;
      }
      const h = Math.max(take * G.lineAns + G.padBottom, firstPart ? MIN_H[r.key] / 20 : 0);
      drawField(r, done, take, h, firstPart);
      done += take;
      firstPart = false;
      if (done < r.lines.length) {
        closeTable();
        newPage(false);
      }
    }
  });
  closeTable();
}

