import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Search, Play, Award, Users, Settings, Download, X, Check, AlertCircle, Sparkles, Lock, LogOut, Gift, TicketPercent, PartyPopper, Sun, Moon, Disc3, UserPlus } from 'lucide-react';
import { firebaseConfig } from './firebase.js';

const STORAGE_KEY = 'raffle-data';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/default/documents/raffle/${STORAGE_KEY}?key=${firebaseConfig.apiKey}`;

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

// ---------- theme tokens: elegant "gaming" palette, dark + light ----------
const themes = {
  dark: {
    mode: 'dark',
    pageBg: 'linear-gradient(180deg, #0A0F1C 0%, #10192E 100%)',
    glow: 'radial-gradient(circle, rgba(227,179,65,0.18) 0%, rgba(227,179,65,0) 70%)',
    text: '#F3F1EA', textDim: '#9BA3B4', textFaint: '#6E778C', textMute: '#4C5265',
    heroBg: 'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))',
    heroBorder: 'rgba(255,255,255,0.09)',
    panelBg: 'rgba(255,255,255,0.035)', panelBorder: 'rgba(255,255,255,0.08)',
    cardBg: 'rgba(255,255,255,0.04)', cardBorder: 'rgba(255,255,255,0.08)',
    inputBg: 'rgba(255,255,255,0.04)', inputBorder: 'rgba(255,255,255,0.12)',
    rowHover: 'rgba(255,255,255,0.045)', rowBorder: 'rgba(255,255,255,0.05)',
    modalBg: '#131B2E', modalBorder: 'rgba(255,255,255,0.1)', overlay: 'rgba(5,8,16,0.6)',
    ghostBorder: 'rgba(255,255,255,0.14)', ghostBg: 'rgba(255,255,255,0.06)',
    iconBtnBg: 'rgba(255,255,255,0.06)', iconBtnBorder: 'rgba(255,255,255,0.1)',
    drawCardBg: 'radial-gradient(120% 100% at 50% 0%, #16233F 0%, #0D1424 100%)', drawCardBorder: 'rgba(227,179,65,0.2)',
    gold: '#E3B341', goldSoft: '#F0CB6C', teal: '#22C7B5', tealDeep: '#1AA695', red: '#F0625F', purple: '#9B6BF0', blue: '#5B8DEF',
    onGold: '#0A0F1C', onTeal: '#0A0F1C', wheelText: '#0A0F1C', wheelStroke: 'rgba(10,15,28,0.35)',
  },
  light: {
    mode: 'light',
    pageBg: 'linear-gradient(180deg, #F5F1E6 0%, #ECE4D2 100%)',
    glow: 'radial-gradient(circle, rgba(185,134,46,0.16) 0%, rgba(185,134,46,0) 70%)',
    text: '#1D2233', textDim: '#5B6376', textFaint: '#7B8394', textMute: '#9AA1B0',
    heroBg: 'linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.45))',
    heroBorder: 'rgba(29,34,51,0.08)',
    panelBg: 'rgba(255,255,255,0.55)', panelBorder: 'rgba(29,34,51,0.09)',
    cardBg: 'rgba(255,255,255,0.65)', cardBorder: 'rgba(29,34,51,0.08)',
    inputBg: 'rgba(255,255,255,0.8)', inputBorder: 'rgba(29,34,51,0.15)',
    rowHover: 'rgba(29,34,51,0.035)', rowBorder: 'rgba(29,34,51,0.06)',
    modalBg: '#FFFDF8', modalBorder: 'rgba(29,34,51,0.1)', overlay: 'rgba(40,32,15,0.35)',
    ghostBorder: 'rgba(29,34,51,0.16)', ghostBg: 'rgba(29,34,51,0.045)',
    iconBtnBg: 'rgba(29,34,51,0.05)', iconBtnBorder: 'rgba(29,34,51,0.1)',
    drawCardBg: 'radial-gradient(120% 100% at 50% 0%, #FFFDF8 0%, #F1E9D6 100%)', drawCardBorder: 'rgba(185,134,46,0.3)',
    gold: '#B9862E', goldSoft: '#D9A54B', teal: '#0E8E7E', tealDeep: '#0B6F62', red: '#D14C49', purple: '#7A4FD1', blue: '#3F6FD1',
    onGold: '#FFFCF5', onTeal: '#FFFCF5', wheelText: '#1D2233', wheelStroke: 'rgba(255,255,255,0.55)',
  },
};

// ---------- lightweight confetti (no deps) ----------
function useConfetti(canvasRef, colorsRef) {
  const launch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = (canvas.width = canvas.offsetWidth);
    const h = (canvas.height = canvas.offsetHeight);
    const colors = colorsRef.current;
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
  const [rotation, setRotation] = useState(0);
  const spinTimeout = useRef(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState('draw'); // 'draw' | 'entries'
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('raffle-theme') || 'dark'; } catch (e) { return 'dark'; }
  });
  useEffect(() => {
    try { localStorage.setItem('raffle-theme', theme); } catch (e) {}
  }, [theme]);
  const t = themes[theme];
  const styles = getStyles(t);

  const canvasRef = useRef(null);
  const wheelColorsRef = useRef([t.gold, t.teal, t.purple, t.blue, t.red]);
  wheelColorsRef.current = [t.gold, t.teal, t.purple, t.blue, t.red];
  const launchConfetti = useConfetti(canvasRef, wheelColorsRef);
  const wheelCanvasRef = useRef(null);

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

  const entries = data ? (data.entries || []) : [];

  // draw the wheel whenever entries or theme change
  useEffect(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2, cy = size / 2, r = size / 2 - 3;
    ctx.clearRect(0, 0, size, size);
    if (entries.length === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = t.cardBg;
      ctx.fill();
      ctx.strokeStyle = t.cardBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
      return;
    }
    const n = entries.length;
    const sliceAngle = (Math.PI * 2) / n;
    const colors = wheelColorsRef.current;
    for (let i = 0; i < n; i++) {
      const start = -Math.PI / 2 + i * sliceAngle;
      const end = start + sliceAngle;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = t.wheelStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (n <= 40) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = t.wheelText;
        ctx.font = '600 12px Vazirmatn, sans-serif';
        const label = entries[i].name.length > 10 ? entries[i].name.slice(0, 9) + '…' : entries[i].name;
        ctx.translate(r * 0.62, 0);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = t.wheelStroke;
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [entries, theme]);

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
        <div style={{ marginTop: 14, color: t.textFaint, fontFamily: 'Vazirmatn, sans-serif', fontSize: 14 }}>در حال بارگذاری داشبورد جشنواره…</div>
      </div>
    );
  }

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
    const winnerIndex = Math.floor(Math.random() * entries.length);
    const winner = entries[winnerIndex];
    const sliceAngle = 360 / entries.length;
    const targetCenter = winnerIndex * sliceAngle + sliceAngle / 2;
    const desiredFinal = (360 - targetCenter) % 360;
    const current = ((rotation % 360) + 360) % 360;
    let delta = desiredFinal - current;
    if (delta < 0) delta += 360;
    const spins = 6;
    const newRotation = rotation + delta + spins * 360;
    setRotation(newRotation);
    if (spinTimeout.current) clearTimeout(spinTimeout.current);
    spinTimeout.current = setTimeout(async () => {
      const record = { ...winner, drawnAt: new Date().toISOString() };
      await persist({ ...data, winner: record, history: [record, ...(data.history || [])] });
      setIsDrawing(false);
      setTimeout(() => launchConfetti(), 150);
    }, 4300);
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
      setAdminTab('draw');
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
        input:focus, button:focus { outline: 2px solid ${t.teal}; outline-offset: 2px; }
        .row-in { animation: rowIn 0.4s ease both; }
        @keyframes rowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .hero-in { animation: heroIn 0.6s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes heroIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .ticket-row { transition: background 0.15s ease, transform 0.15s ease; }
        .ticket-row:hover { background: ${t.rowHover}; }
        .glow-btn { animation: pulseGlow 2.4s ease-in-out infinite; }
        @keyframes pulseGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(227,179,65,0.35); } 50% { box-shadow: 0 0 0 14px rgba(227,179,65,0); } }
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
              <div style={styles.brandIcon}><TicketPercent size={16} color={t.onGold} /></div>
              <span style={styles.eyebrow}>جشنواره اختصاصی · قرعه‌کشی رسمی</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={styles.iconBtn} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="تغییر پوسته">
                {theme === 'dark' ? <Sun size={17} color={t.text} /> : <Moon size={17} color={t.text} />}
              </button>
              {isAdmin && (
                <button style={styles.iconBtn} onClick={() => { setCfgDraft(cfg); setShowConfig(true); }} aria-label="تنظیمات">
                  <Settings size={17} color={t.text} />
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

          <div style={styles.statRow}>
            <div style={styles.statCard}>
              <Users size={16} color={t.teal} />
              <div>
                <div style={styles.statNum}>{toPersianDigits(entries.length)}</div>
                <div style={styles.statLabel}>شرکت‌کننده</div>
              </div>
            </div>
            <div style={styles.statCard}>
              <Gift size={16} color={t.gold} />
              <div>
                <div style={styles.statNum}>{toPersianDigits(remaining)}</div>
                <div style={styles.statLabel}>ظرفیت باقی‌مانده</div>
              </div>
            </div>
            {isAdmin && (
              <div style={styles.statCard}>
                <Sparkles size={16} color={t.text} />
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
            <Award size={20} color={t.onGold} />
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

        {/* Admin tab switcher */}
        {isAdmin && (
          <div style={styles.tabBar}>
            <button
              style={{ ...styles.tabBtn, ...(adminTab === 'draw' ? styles.tabBtnActive : {}) }}
              onClick={() => setAdminTab('draw')}
            >
              <Disc3 size={15} />
              <span>قرعه‌کشی</span>
            </button>
            <button
              style={{ ...styles.tabBtn, ...(adminTab === 'entries' ? styles.tabBtnActive : {}) }}
              onClick={() => setAdminTab('entries')}
            >
              <UserPlus size={15} />
              <span>مدیریت شرکت‌کنندگان</span>
            </button>
          </div>
        )}

        {/* -------- DRAW TAB (admin) -------- */}
        {isAdmin && adminTab === 'draw' && (
          <div style={styles.drawCard}>
            <canvas ref={canvasRef} style={styles.confettiCanvas} />
            {!data.winner ? (
              <>
                <div style={styles.drawEyebrow}>مرحله نهایی · گردونه شانس</div>
                <div style={styles.wheelWrap}>
                  <div style={styles.wheelPointer} />
                  <div
                    style={{
                      ...styles.wheelSpinner,
                      transform: `rotate(${rotation}deg)`,
                      transition: isDrawing ? 'transform 4.2s cubic-bezier(0.17,0.67,0.12,0.99)' : 'none',
                    }}
                  >
                    <canvas ref={wheelCanvasRef} width={280} height={280} style={styles.wheelCanvas} />
                  </div>
                  <div style={styles.wheelHub}><Sparkles size={18} color={t.onGold} /></div>
                </div>
                <div style={styles.drawStage}>
                  {entries.length === 0 ? (
                    <div style={styles.drawIdle}>برای شروع، اول از تب «مدیریت شرکت‌کنندگان» چند نفر اضافه کن</div>
                  ) : (
                    <div style={styles.drawIdle}>{isDrawing ? 'در حال چرخش گردونه…' : `آماده برای قرعه‌کشی بین ${toPersianDigits(entries.length)} نفر`}</div>
                  )}
                </div>
                <button
                  className={entries.length > 0 && !isDrawing ? 'glow-btn' : ''}
                  style={{ ...styles.drawBtn, opacity: entries.length === 0 || isDrawing ? 0.5 : 1 }}
                  onClick={startDraw}
                  disabled={entries.length === 0 || isDrawing}
                >
                  <Play size={16} />
                  <span>{isDrawing ? 'در حال قرعه‌کشی…' : 'چرخوندن گردونه'}</span>
                </button>
              </>
            ) : (
              <div style={styles.winnerBox}>
                <Award size={30} color={t.gold} />
                <div style={styles.winnerLabel}>برنده جشنواره</div>
                <div style={styles.winnerName}>{data.winner.name}</div>
                <div style={styles.winnerPhone}>{toPersianDigits(data.winner.phone)}</div>
                <button style={styles.ghostBtnDark} onClick={clearWinner}>
                  <X size={14} />
                  <span>قرعه‌کشی مجدد</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* -------- ENTRIES TAB (admin) -------- */}
        {isAdmin && adminTab === 'entries' && (
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

        {/* Search + export — shown for public, and for admin only on entries tab */}
        {(!isAdmin || adminTab === 'entries') && (
          <div style={styles.toolbar}>
            <div style={styles.searchWrap}>
              <Search size={16} color={t.textFaint} />
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
        )}

        {/* Ticket table — shown for public, and for admin only on entries tab */}
        {(!isAdmin || adminTab === 'entries') && (
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
        )}

        {isAdmin && adminTab === 'entries' && entries.length > 0 && (
          <button style={styles.resetLink} onClick={resetFestival}>پاک کردن همه بلیت‌ها و شروع جشنواره جدید</button>
        )}

        <div style={styles.footNote}>تمام اطلاعات به‌صورت خودکار ذخیره می‌شود</div>
      </div>

      {/* PIN modal */}
      {showPinModal && (
        <div style={styles.modalOverlay} onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}><Lock size={16} /> ورود مدیر</span>
              <button style={styles.iconBtn} onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}><X size={16} color={t.text} /></button>
            </div>
            <label style={styles.label}>رمز مدیر</label>
            <input
              style={{ ...styles.input, ...(pinError ? styles.inputErr : {}), letterSpacing: 6, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace' }}
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && checkPin()}
              autoFocus
            />
            {pinError && <div style={styles.errText}>{pinError}</div>}
            <button style={{ ...styles.addBtn, width: '100%', marginTop: 12 }} onClick={checkPin}>ورود</button>
          </div>
        </div>
      )}

      {/* Config modal */}
      {isAdmin && showConfig && (
        <div style={styles.modalOverlay} onClick={() => setShowConfig(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}><Settings size={16} /> تنظیمات جشنواره</span>
              <button style={styles.iconBtn} onClick={() => setShowConfig(false)}><X size={16} color={t.text} /></button>
            </div>
            <label style={styles.label}>نام محصول جایزه</label>
            <input style={styles.input} value={cfgDraft.productName} onChange={(e) => setCfgDraft({ ...cfgDraft, productName: e.target.value })} />
            <label style={styles.label}>قیمت هر بلیت (تومان)</label>
            <input style={styles.input} type="number" value={cfgDraft.ticketPrice} onChange={(e) => setCfgDraft({ ...cfgDraft, ticketPrice: e.target.value })} />
            <label style={styles.label}>سقف تعداد نفرات</label>
            <input style={styles.input} type="number" value={cfgDraft.cap} onChange={(e) => setCfgDraft({ ...cfgDraft, cap: e.target.value })} />
            <label style={styles.label}>رمز ورود مدیر</label>
            <input style={styles.input} value={cfgDraft.adminPin} onChange={(e) => setCfgDraft({ ...cfgDraft, adminPin: e.target.value })} />
            <button style={{ ...styles.addBtn, width: '100%', marginTop: 4 }} onClick={saveConfig}>
              <Check size={15} style={{ marginLeft: 6 }} />
              ذخیره تنظیمات
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getStyles(t) {
  return {
    page: { minHeight: '100vh', background: t.pageBg, padding: '22px 14px 40px', color: t.text, position: 'relative', overflow: 'hidden' },
    bgGlow: { position: 'absolute', top: -120, right: -80, width: 320, height: 320, borderRadius: '50%', background: t.glow, pointerEvents: 'none' },
    container: { maxWidth: 640, margin: '0 auto', position: 'relative', zIndex: 1 },
    loadingWrap: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: t.mode === 'dark' ? '#0A0F1C' : '#F5F1E6' },
    spinner: { width: 30, height: 30, border: '3px solid rgba(128,128,128,0.15)', borderTopColor: t.gold, borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

    hero: { background: t.heroBg, border: `1px solid ${t.heroBorder}`, borderRadius: 20, padding: 20, marginBottom: 14, backdropFilter: 'blur(10px)' },
    heroTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 },
    brandRow: { display: 'flex', alignItems: 'center', gap: 8 },
    brandIcon: { width: 26, height: 26, borderRadius: 8, background: t.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    eyebrow: { fontSize: 11.5, letterSpacing: 0.3, color: t.gold, fontWeight: 700 },
    title: { fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 900, margin: '0 0 6px', color: t.text, letterSpacing: -0.5 },
    subtitle: { fontSize: 13.5, color: t.textDim, margin: '0 0 16px' },

    statRow: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
    statCard: { display: 'flex', alignItems: 'center', gap: 8, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 12, padding: '9px 12px', flex: '1 1 120px' },
    statNum: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 15, color: t.text, direction: 'ltr' },
    statLabel: { fontSize: 11, color: t.textFaint, marginTop: 1 },

    progressTrack: { height: 7, background: t.cardBg, borderRadius: 6, overflow: 'hidden' },
    progressFill: { height: '100%', background: `linear-gradient(90deg, ${t.teal}, ${t.gold})`, borderRadius: 6, transition: 'width 0.5s ease' },
    progressCaption: { fontSize: 11.5, color: t.textFaint, marginTop: 6, fontFamily: "'JetBrains Mono', monospace", direction: 'ltr', textAlign: 'right' },

    publicWinnerBanner: { display: 'flex', alignItems: 'center', gap: 10, background: `linear-gradient(90deg, ${t.gold}, ${t.goldSoft})`, color: t.onGold, padding: '12px 16px', borderRadius: 14, fontSize: 14, marginBottom: 14, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' },
    publicWinnerText: { flex: 1 },
    replayBtn: { background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: t.onGold },

    errorBanner: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(240,98,95,0.12)', color: t.red, padding: '8px 12px', borderRadius: 10, fontSize: 13, marginBottom: 12, border: '1px solid rgba(240,98,95,0.3)' },

    tabBar: { display: 'flex', gap: 8, marginBottom: 14, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: 5 },
    tabBtn: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'transparent', border: 'none', color: t.textDim, borderRadius: 10, padding: '10px 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
    tabBtnActive: { background: `linear-gradient(90deg, ${t.gold}, ${t.goldSoft})`, color: t.onGold, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' },

    panel: { background: t.panelBg, border: `1px solid ${t.panelBorder}`, borderRadius: 16, padding: 14, marginBottom: 14 },
    panelHeader: { fontSize: 12.5, fontWeight: 700, color: t.textFaint, marginBottom: 10 },
    formRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' },
    input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${t.inputBorder}`, background: t.inputBg, fontSize: 14, color: t.text },
    inputErr: { border: `1px solid ${t.red}` },
    errText: { fontSize: 12, color: t.red, marginTop: 4 },
    addBtn: { background: `linear-gradient(90deg, ${t.teal}, ${t.tealDeep})`, color: t.onTeal, border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 14 },

    toolbar: { display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' },
    searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: t.cardBg, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: '8px 12px', flex: 1, minWidth: 180 },
    searchInput: { border: 'none', outline: 'none', background: 'transparent', fontSize: 14, width: '100%', color: t.text },
    ghostBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${t.ghostBorder}`, color: t.text, borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 13 },
    ghostBtnDark: { display: 'flex', alignItems: 'center', gap: 6, background: t.ghostBg, border: `1px solid ${t.ghostBorder}`, color: t.text, borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 13 },

    tableHead: { display: 'flex', alignItems: 'center', gap: 12, padding: '2px 14px 10px', borderBottom: `1px solid ${t.rowBorder}` },
    tCol: { fontSize: 11, color: t.textFaint, fontWeight: 700, letterSpacing: 0.3 },
    empty: { padding: 30, textAlign: 'center', color: t.textFaint, fontSize: 14 },
    ticketRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderBottom: `1px solid ${t.rowBorder}` },
    ticketBadge: { width: 40, minWidth: 40, height: 28, borderRadius: 8, background: 'rgba(227,179,65,0.12)', border: `1px solid ${t.gold}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.gold, fontSize: 12 },
    ticketName: { fontWeight: 600, fontSize: 14, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    ticketPhone: { fontFamily: "'JetBrains Mono', monospace", direction: 'ltr', textAlign: 'right', fontSize: 12.5, color: t.textDim },
    ticketDate: { fontSize: 11, color: t.textFaint, whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" },
    trashBtn: { background: 'transparent', border: 'none', color: t.red, cursor: 'pointer', padding: 6, opacity: 0.85 },

    drawCard: { position: 'relative', background: t.drawCardBg, border: `1px solid ${t.drawCardBorder}`, borderRadius: 18, padding: 24, textAlign: 'center', marginBottom: 12, overflow: 'hidden' },
    confettiCanvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
    drawEyebrow: { fontSize: 11, letterSpacing: 1, color: t.gold, fontWeight: 700, marginBottom: 14 },
    drawStage: { marginBottom: 18, minHeight: 24 },
    drawIdle: { color: t.textDim, fontSize: 13.5 },
    drawBtn: { display: 'inline-flex', alignItems: 'center', gap: 8, background: `linear-gradient(90deg, ${t.gold}, ${t.goldSoft})`, color: t.onGold, border: 'none', borderRadius: 12, padding: '13px 28px', fontWeight: 800, fontSize: 14.5, cursor: 'pointer', margin: '0 auto', position: 'relative', zIndex: 1 },

    wheelWrap: { position: 'relative', width: 280, height: 280, margin: '0 auto 8px', zIndex: 1 },
    wheelPointer: { position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: `18px solid ${t.gold}`, zIndex: 3, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' },
    wheelSpinner: { width: 280, height: 280, borderRadius: '50%', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' },
    wheelCanvas: { width: '100%', height: '100%', borderRadius: '50%', display: 'block' },
    wheelHub: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 46, height: 46, borderRadius: '50%', background: `linear-gradient(160deg, ${t.gold}, ${t.goldSoft})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.3)', zIndex: 2, border: `3px solid ${t.mode === 'dark' ? '#0D1424' : '#FFFDF8'}` },

    winnerBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', zIndex: 1 },
    winnerLabel: { color: t.gold, fontSize: 12, fontWeight: 700, letterSpacing: 1, marginTop: 8 },
    winnerName: { color: t.text, fontSize: 24, fontWeight: 900 },
    winnerPhone: { color: t.textDim, fontFamily: "'JetBrains Mono', monospace", direction: 'ltr', marginBottom: 12 },

    resetLink: { display: 'block', margin: '4px auto 0', background: 'transparent', border: 'none', color: t.textFaint, fontSize: 12, textDecoration: 'underline', cursor: 'pointer', padding: 8 },
    footNote: { textAlign: 'center', fontSize: 11, color: t.textMute, marginTop: 18 },

    iconBtn: { background: t.iconBtnBg, border: `1px solid ${t.iconBtnBorder}`, borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    adminEnterBtn: { display: 'flex', alignItems: 'center', gap: 6, background: t.iconBtnBg, border: `1px solid ${t.iconBtnBorder}`, color: t.text, borderRadius: 10, padding: '0 12px', height: 34, fontSize: 12.5, cursor: 'pointer' },
    adminBadgeBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(34,199,181,0.15)', border: `1px solid ${t.teal}55`, color: t.teal, borderRadius: 10, padding: '0 12px', height: 34, fontSize: 12.5, cursor: 'pointer' },

    modalOverlay: { position: 'fixed', inset: 0, background: t.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 },
    modal: { background: t.modalBg, border: `1px solid ${t.modalBorder}`, borderRadius: 18, padding: 20, width: '100%', maxWidth: 360 },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    modalTitle: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: t.text, fontSize: 15 },
    label: { display: 'block', fontSize: 12, color: t.textFaint, margin: '10px 0 4px' },
  };
}
