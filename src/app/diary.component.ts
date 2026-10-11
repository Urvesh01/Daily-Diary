import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SECTIONS, ALL, has } from '../fields';
import { Api } from '../api';
import { buildPdf, fmt, dayName } from '../pdf';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: ` <div class="app" [attr.data-theme]="theme()">
    <header
      class="noprint flex items-center justify-between px-4 py-3 border-b"
      style="border-color:var(--line);background:var(--card)"
    >
      <b style="font-size:1.3rem;color:#4c9a2a"
        >PG <span style="color:#e01b1b">आयुर्वेद प्रयोजनम्</span></b
      >
      <div class="flex gap-2 items-center">
        <button
          class="btn"
          (click)="theme.set(theme() == 'modern' ? 'classic' : 'modern')"
        >
          {{ theme() == 'modern' ? 'Classic look' : 'Modern look' }}
        </button>
        @if (user()) {
          <span class="hidden sm:inline">{{ user() }}</span
          ><button class="btn" (click)="logout()">Log out</button>
        }
      </div>
    </header>
    <main class="max-w-3xl mx-auto p-3">
      @if (!user()) {
        <div class="card p-5 mt-8 max-w-sm mx-auto">
          <div class="ttl">
            {{ mode() == 'login' ? 'Student login' : 'Create account' }}
          </div>
          @if (mode() == 'register') {
            <input
              class="inp mb-2"
              placeholder="Full name"
              autocomplete="name"
              [(ngModel)]="af.name"
            />
          }
          <input
            class="inp mb-2"
            type="email"
            placeholder="Email"
            autocomplete="email"
            [(ngModel)]="af.email"
          />
          <input
            class="inp mb-3"
            type="password"
            placeholder="Password (6+ characters)"
            [(ngModel)]="af.password"
            [attr.autocomplete]="mode() == 'login' ? 'current-password' : 'new-password'"
            (keyup.enter)="authGo()"
          />
          @if (err()) {
            <p class="mb-2" style="color:#dc2626">{{ err() }}</p>
          }
          <button class="btn p w-full" [disabled]="busy()" (click)="authGo()">
            {{ mode() == 'login' ? 'Log in' : 'Register' }}
          </button>
          <button
            class="w-full mt-3 underline"
            (click)="mode.set(mode() == 'login' ? 'register' : 'login')"
          >
            {{
              mode() == 'login'
                ? 'New student? Create an account'
                : 'Have an account? Log in'
            }}
          </button>
        </div>
      } @else {
        <nav class="noprint flex gap-2 mb-3">
          <button
            class="btn flex-1"
            [class.p]="view() == 'diary'"
            (click)="view.set('diary')"
          >
            Daily diary
          </button>
          <button
            class="btn flex-1"
            [class.p]="view() == 'dash'"
            (click)="view.set('dash')"
          >
            Dashboard
          </button>
        </nav>
        @if (view() == 'diary') {
          <div class="ttl">Daily Assessment Diary</div>
          @for (s of sections; track s.t) {
            <div class="card">
              <div class="sec">{{ s.t }}</div>
              @for (f of s.f; track f.k; let i = $index) {
                <div class="row">
                  <label [for]="'f' + f.k"
                    ><b>{{ letter(i) }}.</b> {{ f.l }}
                    @if (f.r) {
                      <span style="color:#dc2626"> *</span>
                    }
                    @if (f.h) {
                      <small class="block" style="color:var(--mute)">{{
                        f.h
                      }}</small>
                    }
                  </label>
                  <div class="p-2">
                    @switch (f.t) {
                      @case ('date') {
                        <input
                          class="inp"
                          type="date"
                          [id]="'f' + f.k"
                          [ngModel]="date()"
                          (ngModelChange)="open($event)"
                        /><small style="color:var(--mute)">{{
                          dayOf(date())
                        }}</small>
                      }
                      @case ('area') {
                        <textarea
                          class="inp"
                          rows="3"
                          maxlength="5000"
                          [id]="'f' + f.k"
                          [class.err]="miss().includes(f.k)"
                          [(ngModel)]="data[f.k]"
                          (ngModelChange)="auto()"
                        ></textarea>
                      }
                      @case ('rate') {
                        <select
                          class="inp"
                          [id]="'f' + f.k"
                          [(ngModel)]="data[f.k]"
                          (ngModelChange)="auto()"
                        >
                          <option value="">Select</option>
                          @for (n of [1, 2, 3, 4, 5]; track n) {
                            <option>{{ n }}</option>
                          }
                        </select>
                      }
                      @case ('number') {
                        <input
                          class="inp"
                          type="number"
                          min="0"
                          [attr.max]="f.max ?? null"
                          [id]="'f' + f.k"
                          [(ngModel)]="data[f.k]"
                          (ngModelChange)="auto()"
                        />
                      }
                      @default {
                        <input
                          class="inp"
                          maxlength="5000"
                          [id]="'f' + f.k"
                          [class.err]="miss().includes(f.k)"
                          [(ngModel)]="data[f.k]"
                          (ngModelChange)="auto()"
                        />
                      }
                    }
                  </div>
                </div>
              }
            </div>
          }
          <div class="noprint flex flex-wrap gap-2 items-center mb-8">
            <button class="btn" (click)="save()">Save</button>
            <button class="btn p" (click)="submit()">
              Submit and download PDF
            </button>
            <button class="btn" (click)="print(date())">Print</button>
            <span class="ml-auto" style="color:var(--mute)">{{ msg() }}</span>
          </div>
        } @else {
          <div class="card p-3">
            <div class="flex justify-between items-center mb-2">
              <button class="btn" (click)="shift(-1)">Prev</button
              ><b>{{ monthLabel() }}</b
              ><button class="btn" (click)="shift(1)">Next</button>
            </div>
            <div class="cal">
              @for (c of cells(); track $index) {
                @if (c) {
                  <div
                    [class]="'s-' + c.state"
                    (click)="open(c.date); view.set('diary')"
                    [title]="c.state"
                  >
                    {{ c.n }}
                  </div>
                } @else {
                  <span></span>
                }
              }
            </div>
            <p class="mt-2 text-sm" style="color:var(--mute)">
              Green: submitted. Amber: draft. Red: missed. White: pending.
            </p>
          </div>
          <div class="card p-3 flex flex-wrap gap-2 items-center">
            <input
              class="inp"
              style="width:auto;flex:1;min-width:150px"
              placeholder="Search subject, topics, notes"
              [(ngModel)]="q"
            />
            <input
              class="inp"
              style="width:auto"
              type="date"
              [(ngModel)]="from"
              aria-label="From date"
            /><input
              class="inp"
              style="width:auto"
              type="date"
              [(ngModel)]="to"
              aria-label="To date"
            />
            <select class="inp" style="width:auto" [(ngModel)]="sf">
              <option value="">All status</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div class="flex flex-wrap gap-2 mb-3">
            <button class="btn p" (click)="merge(shown())">
              Merge shown range</button
            ><button class="btn" (click)="merge(entries())">
              Merge all days
            </button>
            <button class="btn" (click)="csv()">Export Excel/CSV</button
            ><button class="btn" (click)="backup()">Backup</button>
            <label class="btn"
              >Restore<input
                type="file"
                accept=".json"
                hidden
                (change)="restore($event)"
            /></label>
          </div>
          <div class="card">
            @for (e of shown(); track e.date) {
              <div
                class="flex flex-wrap items-center gap-2 p-3 border-b"
                style="border-color:var(--line)"
              >
                <div class="flex-1" style="min-width:150px">
                  <b>{{ fmtD(e.date) }}</b> {{ dayOf(e.date) }}
                  <div style="color:var(--mute)">
                    {{ e.data['1B'] || 'No subject' }} ({{ e.status }})
                  </div>
                </div>
                <button class="btn" (click)="open(e.date); view.set('diary')">
                  Edit</button
                ><button class="btn" (click)="pdf([e])">PDF</button
                ><button class="btn d" (click)="remove(e.date)">Delete</button>
              </div>
            } @empty {
              <p class="p-4">
                No entries match. Fill today's diary to get started.
              </p>
            }
          </div>
        }
      }
    </main>
  </div>`,
})
export class DiaryComponent {
  sections = SECTIONS;
  theme = signal<'modern' | 'classic'>('modern');
  view = signal<'diary' | 'dash'>('diary');
  user = signal(localStorage.getItem('name') || '');
  mode = signal<'login' | 'register'>('login');
  err = signal('');
  msg = signal('');
  busy = signal(false);
  af: any = { name: '', email: '', password: '' };
  entries = signal<any[]>([]);
  date = signal(iso(new Date()));
  data: any = {};
  miss = signal<string[]>([]);
  // Dashboard filters are signals so the list really updates when they change.
  q = signal('');
  from = signal('');
  to = signal('');
  sf = signal('');
  month = signal(new Date());
  timer: any = null;

  constructor(private api: Api) {
    // Any 401 from the API (expired/invalid token) logs the user out.
    api.onUnauthorized = () => this.logout('Your session expired. Please log in again.');
    if (api.token && this.user()) this.load();
  }

  letter = (i: number) => String.fromCharCode(65 + i);
  dayOf = (d: string) => (d ? dayName(d) : '');
  fmtD = fmt;
  private byDate = (l: any[]) => [...l].sort((a, b) => (a.date < b.date ? -1 : 1));

  authGo() {
    this.err.set('');
    const body = {
      name: String(this.af.name || '').trim(),
      email: String(this.af.email || '').trim(),
      password: String(this.af.password || ''),
    };
    if (!body.email || !body.password) return this.err.set('Please enter email and password.');
    if (this.mode() == 'register' && !body.name) return this.err.set('Please enter your name.');
    this.busy.set(true);
    this.api.auth(this.mode(), body).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.api.token = r.token;
        localStorage.setItem('token', r.token);
        localStorage.setItem('name', r.name);
        this.af.password = '';
        this.user.set(r.name);
        this.load();
      },
      error: (e) => {
        this.busy.set(false);
        this.err.set(e.error?.error || 'Could not reach the server. Please try again.');
      },
    });
  }

  logout(note = '') {
    clearTimeout(this.timer);
    this.timer = null;
    localStorage.removeItem('token');
    localStorage.removeItem('name');
    this.api.token = '';
    this.user.set('');
    this.entries.set([]);
    this.data = {};
    this.err.set(note);
  }

  load() {
    this.api.list().subscribe({
      next: (r) => {
        this.entries.set(this.byDate(r)); // server sends newest first; keep oldest first
        this.open(iso(new Date()));
      },
      // 401 is handled globally (logout); other errors just show a message.
      error: (e) => {
        if (e.status !== 401) this.msg.set(e.error?.error || 'Could not load your diary. Please refresh.');
      },
    });
  }

  open(d: string) {
    if (!d) return; // the date input was cleared – ignore
    this.flush(); // save pending edits of the day we are leaving
    this.date.set(d);
    const e = this.entries().find((x) => x.date === d);
    this.data = { ...(e?.data || {}) };
    this.data['1A'] = d;
    this.miss.set([]);
    this.msg.set(e ? `Loaded (${e.status})` : 'New entry');
  }

  filled() {
    return Object.keys(this.data).some((k) => k !== '1A' && has(this.data[k]));
  }

  put(status: string, after?: () => void) {
    const date = this.date();
    this.api.save(date, { ...this.data }, status).subscribe({
      next: (r) => {
        this.entries.set(this.byDate([...this.entries().filter((x) => x.date !== r.date), r]));
        if (this.date() === date) this.msg.set(status == 'draft' ? 'Saved as draft' : 'Submitted');
        after?.();
      },
      error: (e) => {
        if (e.status !== 401) this.msg.set(e.error?.error || 'Save failed. Check your connection.');
      },
    });
  }

  /** Autosave a draft shortly after typing stops. */
  auto() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.autosave();
    }, 800);
  }
  private autosave() {
    const cur = this.entries().find((x) => x.date === this.date());
    if (cur?.status === 'submitted') this.msg.set('Unsaved changes: press Save');
    else if (this.filled()) this.put('draft');
  }
  /** Run a pending autosave right now (used before switching dates). */
  private flush() {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
    this.autosave();
  }

  save() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.filled()) return this.msg.set('Fill at least one field first.');
    const wasSubmitted =
      this.entries().find((x) => x.date === this.date())?.status === 'submitted';
    if (wasSubmitted && !this.validOk()) {
      this.msg.set('Required fields are empty – saved as draft.');
    }
    this.put(wasSubmitted && this.miss().length === 0 ? 'submitted' : 'draft');
  }

  validOk() {
    const m = ALL.filter((f) => f.r && !has(this.data[f.k])).map((f) => f.k);
    this.miss.set(m);
    return !m.length;
  }

  submit() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.validOk()) return this.msg.set('Please fill the fields marked *');
    const snap = { date: this.date(), data: { ...this.data } };
    this.put('submitted', () => this.pdf([snap]));
  }

  async pdf(list: any[], name?: string) {
    if (!list.length) return this.msg.set('No entries to export.');
    try {
      this.msg.set('Creating PDF…');
      const p = await buildPdf(list);
      p.save(
        name ||
          (list.length == 1
            ? `Diary_${list[0].date}.pdf`
            : `Diary_${list[0].date}_to_${list[list.length - 1].date}.pdf`),
      );
      this.msg.set('PDF downloaded');
    } catch (e) {
      console.error(e);
      this.msg.set('Could not create the PDF. Please try again.');
    }
  }

  merge(list: any[]) {
    this.pdf(this.byDate(list));
  }

  async print(d: string) {
    const e =
      d === this.date() ? { date: d, data: { ...this.data } } : this.entries().find((x) => x.date === d);
    if (!e) return;
    // Open the tab immediately (inside the click) so pop-up blockers allow it.
    const w = window.open('', '_blank');
    try {
      const p = await buildPdf([e]);
      p.autoPrint();
      const url = p.output('bloburl') as unknown as string;
      if (w) w.location.href = url;
      else p.save(`Diary_${d}.pdf`); // pop-ups blocked: download instead
    } catch (err) {
      console.error(err);
      w?.close();
      this.msg.set('Could not create the PDF. Please try again.');
    }
  }

  remove(d: string) {
    if (confirm(`Delete the diary for ${fmt(d)}? This cannot be undone.`))
      this.api.del(d).subscribe({
        next: () => this.entries.set(this.entries().filter((x) => x.date !== d)),
        error: (e) => {
          if (e.status !== 401) this.msg.set(e.error?.error || 'Delete failed.');
        },
      });
  }

  shown = computed(() => {
    const q = this.q().toLowerCase(),
      from = this.from(),
      to = this.to(),
      sf = this.sf();
    return this.entries().filter(
      (e) =>
        (!from || e.date >= from) &&
        (!to || e.date <= to) &&
        (!sf || e.status === sf) &&
        (!q || JSON.stringify(e.data).toLowerCase().includes(q)),
    );
  });

  monthLabel = computed(() =>
    this.month().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  );
  shift(n: number) {
    const m = this.month();
    // use day 1 so e.g. 31 Jan + 1 month does not jump to March
    this.month.set(new Date(m.getFullYear(), m.getMonth() + n, 1));
  }

  cells = computed(() => {
    const m = this.month(),
      y = m.getFullYear(),
      mo = m.getMonth(),
      n = new Date(y, mo + 1, 0).getDate(),
      t = iso(new Date()),
      first = this.entries()[0]?.date || t,
      out: any[] = Array(new Date(y, mo, 1).getDay()).fill(null);
    for (let d = 1; d <= n; d++) {
      const ds = `${y}-${pad(mo + 1)}-${pad(d)}`,
        e = this.entries().find((x) => x.date === ds);
      out.push({
        n: d,
        date: ds,
        state: e ? e.status : ds < t && ds >= first ? 'missed' : 'pending',
      });
    }
    return out;
  });

  dl(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  csv() {
    // Prefix risky cells so Excel never runs them as formulas (CSV injection).
    const safe = (v: any) => {
      const s = String(v ?? '');
      return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    };
    const q = (v: any) => `"${safe(v).replace(/"/g, '""')}"`;
    const cols = ALL.filter((f) => f.k !== '1A');
    const rows = [['Date', 'Day', 'Status', ...cols.map((f) => f.l)].map(q).join(',')];
    for (const e of this.entries())
      rows.push(
        [e.date, dayName(e.date), e.status, ...cols.map((f) => e.data[f.k])].map(q).join(','),
      );
    this.dl(new Blob(['\ufeff' + rows.join('\r\n')], { type: 'text/csv' }), 'diary.csv');
  }

  backup() {
    const rows = this.entries().map((e) => ({ date: e.date, data: e.data, status: e.status }));
    this.dl(new Blob([JSON.stringify(rows)], { type: 'application/json' }), 'diary-backup.json');
  }

  restore(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      input.value = ''; // lets the same file be chosen again later
      let rows: any;
      try {
        rows = JSON.parse(r.result as string);
      } catch {
        return alert('Not a valid backup file.');
      }
      if (!Array.isArray(rows)) return alert('Not a valid backup file.');
      this.api.restore(rows).subscribe({
        next: (res) => {
          this.load();
          alert(`Backup restored (${res.restored} entries).`);
        },
        error: (e) => {
          if (e.status !== 401) alert(e.error?.error || 'Restore failed.');
        },
      });
    };
    r.readAsText(f);
  }
}
