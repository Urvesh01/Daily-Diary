// Fields copied from the Daily Assessment Diary PDF.
// r = required to Submit, max = upper limit for number inputs.
export type Field = {
  k: string;
  l: string;
  h?: string;
  t: 'date' | 'text' | 'area' | 'number' | 'rate';
  r?: boolean;
  max?: number;
};

export const SECTIONS: { t: string; f: Field[] }[] = [
  {
    t: '1. Basic Info Section',
    f: [
      { k: '1A', l: 'Date & Day', t: 'date' },
      { k: '1B', l: 'Subject Planned for Today', t: 'text', r: true },
      { k: '1C', l: 'Study Hours Target', t: 'text', r: true },
    ],
  },
  {
    t: '2. Study Tracking',
    f: [
      {
        k: '2A',
        l: 'Topics Covered Today',
        h: '(Chapter/Unit/Subject wise)',
        t: 'area',
        r: true,
      },
      { k: '2B', l: 'Time Spent (Actual vs Target)', t: 'text', r: true },
      { k: '2C', l: 'Key Notes / Points Learned', t: 'area', r: true },
    ],
  },
  {
    t: '3. MCQ/Practice Section',
    f: [
      { k: '3A', l: 'Number of MCQs attempted', t: 'number' },
      { k: '3B', l: 'Correct Answers (%)', t: 'number', max: 100 },
      { k: '3C', l: 'Mistakes / Weak Areas (to revise again)', t: 'area' },
      {
        k: '3D',
        l: 'Source of Questions (PYQ / Test Series / Book)',
        t: 'text',
      },
    ],
  },
  {
    t: '4. Self-Evaluation',
    f: [
      { k: '4A', l: 'Confidence Level (1–5 rating)', t: 'rate' },
      { k: '4B', l: 'Today’s Strength (what went well)', t: 'area' },
      { k: '4C', l: 'Today’s Weakness (what needs work)', t: 'area' },
    ],
  },
  {
    t: '5. Revision Section',
    f: [
      { k: '5A', l: 'Topics Revised Today', t: 'area' },
      {
        k: '5B',
        l: 'Quick Recall Score (Self-quiz out of 10)',
        t: 'number',
        max: 10,
      },
    ],
  },
  {
    t: '6. Motivation / Reflection',
    f: [
      { k: '6A', l: '1 line of self-motivation OR', t: 'area' },
      {
        k: '6B',
        l: 'A quote/affirmation (e.g., “Every small step counts towards AIAPGET success”)',
        t: 'area',
      },
    ],
  },
  {
    t: '7. Tomorrow’s Plan',
    f: [
      { k: '7A', l: 'Subjects/Topics to be studied tomorrow', t: 'area' },
      { k: '7B', l: 'Special focus areas', t: 'text' },
      { k: '7C', l: 'Short-term goal for the next day', t: 'text' },
    ],
  },
];

export const ALL = SECTIONS.flatMap((s) => s.f);

/** True when a stored value counts as "filled in" (0 is a real answer). */
export const has = (v: unknown) =>
  v !== null && v !== undefined && String(v).trim() !== '';
