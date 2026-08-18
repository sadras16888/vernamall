import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Search, Play, Award, Users, Settings, Download, X, Check, AlertCircle, Sparkles, Lock, LogOut, Gift, TicketPercent, PartyPopper } from 'lucide-react';
import { firebaseConfig } from './firebase.js';

const STORAGE_KEY = 'raffle-data';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/raffle/${STORAGE_KEY}?key=${firebaseConfig.apiKey}`;

// ---------- tiny helpers to talk to Firestore's plain REST API (no SDK) ----------
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') return { doubleValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') return { mapValue: { fields: toFirestoreFields(val) } };
  return { stringValue: String(val) };
}
function toFirestoreFields(obj) {
  const fields = {};
  Object.keys(obj || {}).forEach((k) => { fields[k] = toFirestoreValue(obj[k]); });
  return fields;
}
function fromFirestoreValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) return fromFirestoreFields(v.mapValue.fields || {});
  return null;
}
function fromFirestoreFields(fields) {
  const obj = {};
  Object.keys(fields || {}).forEach((k) => { obj[k] = fromFirestoreValue(fields[k]); });
  return obj;
}
async function firestoreGet() {
  const res = await fetch(FIRESTORE_URL, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('read failed');
  const json = await res.json();
  return fromFirestoreFields(json.fields || {});
}
async function firestoreSet(data) {
  const res = await fetch(FIRESTORE_URL, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error('write failed');
  return true;
}

const toPersianDigits = (input) => {
  const fa = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(input).replace(/\d/g, (d) => fa[d]);
};

const formatMoney = (n) => toPersianDigits(Number(n || 0).toLocaleString('en-US'));
const maskPhone = (phone) => `${phone.slice(0, 4)}***${phone.slice(-2)}`;

const nameRegex = /^[\u0600-\u06FFA-Za-z\s]{3,50}$/;
const phoneRegex = /^09\d{9}$/;

const defaultData = {
  config: { productName: 'دستگاه جایزه', ticketPrice: 200000, cap: 60, adminPin: '1234' },
  entries: [],
  winner: null,
  history: [],
};

// ---------- lightweight confetti (no deps) ----------
function useConfetti(canvasRef) {
  const launch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);
    const colors = ['#E3B341', '#22C7B5', '#F3F1EA', '#F0625F'];
    const particles = Array.from({ length: 90 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 60,
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -9 - 3,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 0,
    }));
    let frame = 0;
    const maxFrames = 130;
    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.vy += 0.22;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });
      if (frame < maxFrames) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    tick();
  };
  return launch;
}

export default function RaffleApp() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [formErr, setFormErr] = useState({});

  const [search, setSearch] = useState('');
  const [mySearch, setMySearch] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [cfgDraft, setCfgDraft] = useState(defaultData.config);

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawName, setDrawName] = useState('');
  const drawTimer = useRef(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const canvasRef = useRef(null);
  const launchConfetti = useConfetti(canvasRef);

  useEffect(() => {
    (async () => {
      try {
        const parsed = await firestoreGet();
        if (parsed) {
          setData({ ...defaultData, ...parsed, config: { ...defaultData.config, ...parsed.config } });
          setCfgDraft({ ...defaultData.config, ...parsed.config });
        } else {
          await firestoreSet(defaultData);
          setData(defaultData);
        }
      } catch (e) {
        setData(defaultData);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (next) => {
    setData(next);
    try {
      await firestoreSet(next);
      setSaveError('');
    } catch (e) {
      setSaveError('خطا در ذخیره‌سازی. اتصال اینترنت را بررسی کنید.');
    }
  };

  if (loading || !data) {
    return (
      <div style={styles.loadingWrap}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={styles.spinner} />
        <div style={{ marginTop: 14, color: '#8D96AC', fontFamily: 'Vazirmatn, sans-serif', fontSize: 14 }}>در حال بارگذاری داشبورد جشنواره…</div>
      </div>
    );
  }

  const entries = data.entries || [];
  const cfg = data.config;

  const validate = () => {
    const errs = {};
    if (!nameRegex.test(name.trim())) errs.name = 'نام باید فقط حروف باشد (حداقل ۳ حرف)';
    if (!phoneRegex.test(phone.trim())) errs.phone = 'شماره باید ۱۱ رقم و با ۰۹ شروع شود';
    if (phoneRegex.test(phone.trim()) && entries.some((e) => e.phone === phone.trim())) {
      errs.phone = 'این شماره قبلاً ثبت‌نام کرده است';
    }
    setFormErr(errs);
    return Object.keys(errs).length === 0;
  };

  const addEntry = async () => {
    if (!validate()) return;
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      phone: phone.trim(),
      paid: cfg.ticketPrice,
      date: new Date().toISOString(),
    };
    await persist({ ...data, entries: [...entries, entry] });
    setName('');
    setPhone('');
    setFormErr({});
  };

  const deleteEntry = async (id) => {
    await persist({ ...data, entries: entries.filter((e) => e.id !== id) });
  };

  const saveConfig = async () => {
    await persist({ ...data, config: { ...cfgDraft, ticketPrice: Number(cfgDraft.ticketPrice) || 0, cap: Number(cfgDraft.cap) || 0 } });
    setShowConfig(false);
  };

  const startDraw = () => {
    if (entries.length === 0 || isDrawing) return;
    setIsDrawing(true);
    let ticks = 0;
    const totalTicks = 28;
    drawTimer.current = setInterval(() => {
      const r = entries[Math.floor(Math.random() * entries.length)];
      setDrawName(r.name);
      ticks += 1;
      if (ticks >= totalTicks) {
        clearInterval(drawTimer.current);
        const winner = entries[Math.floor(Math.random() * entries.length)];
        setDrawName(winner.name);
        setTimeout(async () => {
          const record = { ...winner, drawnAt: new Date().toISOString() };
          await persist({ ...data, winner: record, history: [record, ...(data.history || [])] });
          setIsDrawing(false);
          setTimeout(() => launchConfetti(), 150);
        }, 500);
      }
    }, 85);
  };

  const clearWinner = async () => {
    await persist({ ...data, winner: null });
  };

  const resetFestival = async () => {
    if (!window.confirm('همه بلیت‌ها و برنده فعلی پاک شوند؟ (تاریخچه برندگان قبلی حفظ می‌شود)')) return;
    await persist({ ...data, entries: [], winner: null });
  };

  const exportCSV = () => {
    const header = 'شماره بلیت,نام,شماره تماس,تاریخ ثبت‌نام\n';
    const rows = entries
      .map((e, i) => `${i + 1},${e.name},="${e.phone}",${new Date(e.date).toLocaleDateString('fa-IR')}`)
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bolit-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const checkPin = () => {
    if (pinInput === (cfg.adminPin || '1234')) {
      setIsAdmin(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('رمز اشتباه است');
    }
  };

  const activeSearch = isAdmin ? search : mySearch;
  const filtered = entries.filter(
    (e) => e.name.includes(activeSearch.trim()) || e.phone.includes(activeSearch.trim())
  );

  const remaining = Math.max(0, cfg.cap - entries.length);
  const progressPct = cfg.cap > 0 ? Math.min(100, (entries.length / cfg.cap) * 100) : 0;
  const revenue = entries.length * cfg.ticketPrice;

  return (
    <div dir="rtl" style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; font-family: 'Vazirmatn', sans-serif; }
        input:focus, button:focus { outline: 2px solid #22C7B5; outline-offset: 2px; }
        .row-in { animation: rowIn 0.4s ease both; }
        @keyframes rowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .hero-in { animation: heroIn 0.6s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes heroIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .ticket-row { transition: background 0.15s ease, transform 0.15s ease; }
        .ticket-row:hover { background: rgba(255,255,255,0.045); }
        .glow-btn { animation: pulseGlow 2.4s ease-in-out infinite; }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(227,179,65,0.35); } 50% { box-shadow: 0 0 0 14px rgba(227,179,65,0); } }
        .reel-name { animation: reelPop 0.09s ease; }
        @keyframes reelPop { from { opacity: 0.3; transform: translateY(4px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .winner-pop { animation: winnerPop 0.5s cubic-bezier(.2,.9,.3,1.3) both; }
        @keyframes winnerPop { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
      `}</style>

      <div style={styles.bgGlow} />

      <div style={styles.container}>
        {/* Header / hero */}
        <div className="hero-in" style={styles.hero}>
          <div style={styles.heroTop}>
            <div style={styles.brandRow}>
              <div style={styles.brandIcon}><TicketPercent size={16} color="#0A0F1C" /></div>
              <span style={styles.eyebrow}>جشنواره اختصاصی · قرعه‌کشی رسمی</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isAdmin && (
                <button style={styles.iconBtn} onClick={() => { setCfgDraft(cfg); setShowConfig(true); }} aria-label="تنظیمات">
                  <Settings size={17} color="#F3F1EA" />
                </button>
              )}
              {isAdmin ? (
                <button style={styles.adminBadgeBtn} onClick={() => setIsAdmin(false)}>
                  <LogOut size={14} /><span>خروج مدیر</span>
                </button>
              ) : (
                <button style={styles.adminEnterBtn} onClick={() => setShowPinModal(true)}>
                  <Lock size={14} /><span>ورود مدیر</span>
                </button>
              )}
            </div>
          </div>

          <h1 style={styles.title}>{cfg.productName}</h1>
          <p style={styles.subtitle}>
            {isAdmin ? 'مدیریت کامل شرکت‌کننده‌ها و برگزاری قرعه‌کشی' : 'اسم یا شماره‌ات رو جستجو کن و ببین ثبت‌نامت تأیید شده'}
          </p>

          {/* stat pills */}
          <div style={styles.statRow}>
            <div style={styles.statCard}>
              <Users size={16} color="#22C7B5" />
              <div>
                <div style={styles.statNum}>{toPersianDigits(entries.length)}</div>
                <div style={styles.statLabel}>شرکت‌کننده</div>
              </div>
            </div>
            <div style={styles.statCard}>
              <Gift size={16} color="#E3B341" />
              <div>
                <div style={styles.statNum}>{toPersianDigits(remaining)}</div>
                <div style={styles.statLabel}>ظرفیت باقی‌مانده</div>
              </div>
            </div>
            {isAdmin && (
              <div style={styles.statCard}>
                <Sparkles size={16} color="#F3F1EA" />
                <div>
                  <div style={styles.statNum}>{formatMoney(revenue)}</div>
                  <div style={styles.statLabel}>درآمد (تومان)</div>
                </div>
              </div>
            )}
          </div>

          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progressPct}%` }} />
          </div>
          <div style={styles.progressCaption}>
            {toPersianDigits(entries.length)} از {toPersianDigits(cfg.cap)} بلیت پر شده · {toPersianDigits(Math.round(progressPct))}٪
          </div>
        </div>

        {data.winner && (
          <div className="winner-pop" style={styles.publicWinnerBanner}>
            <Award size={20} color="#0A0F1C" />
            <span style={styles.publicWinnerText}>برنده جشنواره: <strong>{data.winner.name}</strong></span>
            <button style={styles.replayBtn} onClick={launchConfetti} aria-label="بازپخش جشن"><PartyPopper size={15} /></button>
          </div>
        )}

        {saveError && isAdmin && (
          <div style={styles.errorBanner}>
            <AlertCircle size={16} />
            <span>{saveError}</span>
          </div>
        )}

        {/* Add form — admin only */}
        {isAdmin && (
          <div style={styles.panel}>
            <div style={styles.panelHeader}>افزودن شرکت‌کننده</div>
            <div style={styles.formRow}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <input
                  style={{ ...styles.input, ...(formErr.name ? styles.inputErr : {}) }}
                  placeholder="نام و نام خانوادگی"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                />
                {formErr.name && <div style={styles.errText}>{formErr.name}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <input
                  style={{ ...styles.input, ...(formErr.phone ? styles.inputErr : {}), direction: 'ltr', textAlign: 'right' }}
                  placeholder="09xxxxxxxxx"
                  value={phone}
                  maxLength={11}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && addEntry()}
                />
                {formErr.phone && <div style={styles.errText}>{formErr.phone}</div>}
              </div>
              <button style={styles.addBtn} onClick={addEntry}>افزودن بلیت</button>
            </div>
          </div>
        )}

        {/* Search + export */}
        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <Search size={16} color="#8D96AC" />
            <input
              style={styles.searchInput}
              placeholder={isAdmin ? 'جستجوی نام یا شماره...' : 'اسم یا شماره خودتو جستجو کن...'}
              value={isAdmin ? search : mySearch}
              onChange={(e) => (isAdmin ? setSearch(e.target.value) : setMySearch(e.target.value))}
            />
          </div>
          {isAdmin && (
            <button style={styles.ghostBtn} onClick={exportCSV} disabled={entries.length === 0}>
              <Download size={15} />
              <span>خروجی اکسل</span>
            </button>
          )}
        </div>

        {/* Ticket table */}
        <div style={styles.panel}>
          <div style={styles.tableHead}>
            <span style={{ ...styles.tCol, width: 56 }}>بلیت</span>
            <span style={{ ...styles.tCol, flex: 1 }}>نام</span>
            <span style={{ ...styles.tCol, flex: 1 }}>شماره تماس</span>
            <span style={{ ...styles.tCol, width: 80, textAlign: 'left' }}>تاریخ</span>
          </div>
          {filtered.length === 0 ? (
            <div style={styles.empty}>
              {entries.length === 0 ? 'هنوز بلیتی ثبت نشده.' : 'موردی با این جستجو پیدا نشد.'}
            </div>
          ) : (
            filtered.map((e, idx) => {
              const ticketNo = entries.findIndex((x) => x.id === e.id) + 1;
              return (
                <div key={e.id} className="ticket-row row-in" style={{ ...styles.ticketRow, animationDelay: `${Math.min(idx, 12) * 0.02}s` }}>
                  <div style={styles.ticketBadge}>{toPersianDigits(String(ticketNo).padStart(3, '0'))}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.ticketName}>{e.name}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.ticketPhone}>{toPersianDigits(isAdmin ? e.phone : maskPhone(e.phone))}</div>
                  </div>
                  <div style={styles.ticketDate}>{new Date(e.date).toLocaleDateString('fa-IR')}</div>
                  {isAdmin && (
                    <button style={styles.trashBtn} onClick={() => deleteEntry(e.id)} aria-label="حذف">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Draw section — admin only */}
        {isAdmin && (
          <div style={styles.drawCard}>
            <canvas ref={canvasRef} style={styles.confettiCanvas} />
            {!data.winner ? (
              <>
                <div style={styles.drawEyebrow}>مرحله نهایی</div>
                <div style={styles.drawStage}>
                  {isDrawing ? (
                    <div key={drawName} className="reel-name" style={styles.drawSpin}>{drawName}</div>
                  ) : (
                    <div style={styles.drawIdle}>آماده برای قرعه‌کشی بین {toPersianDigits(entries.length)} نفر</div>
                  )}
                </div>
                <button
                  className={entries.length > 0 && !isDrawing ? 'glow-btn' : ''}
                  style={{ ...styles.drawBtn, opacity: entries.length === 0 || isDrawing ? 0.5 : 1 }}
                  onClick={startDraw}
                  disabled={entries.length === 0 || is
