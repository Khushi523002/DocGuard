import { useState, useRef, useCallback, useEffect } from 'react'

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const G = {
  bg0: '#080b14',
  bg1: '#0d1120',
  bg2: '#131828',
  bg3: '#1a2035',
  bg4: '#202540',
  border: 'rgba(120,140,255,0.10)',
  borderBright: 'rgba(120,140,255,0.22)',
  accent: '#6366f1',
  accentLight: '#818cf8',
  accentDim: 'rgba(99,102,241,0.10)',
  accentGlow: 'rgba(99,102,241,0.25)',
  accentPulse: 'rgba(99,102,241,0.4)',
  green: '#10d9a0',
  greenDim: 'rgba(16,217,160,0.10)',
  greenGlow: 'rgba(16,217,160,0.3)',
  red: '#f04060',
  redDim: 'rgba(240,64,96,0.10)',
  amber: '#f5a524',
  amberDim: 'rgba(245,165,36,0.10)',
  udemy: '#a435f0',
  udemyDim: 'rgba(164,53,240,0.10)',
  udemyGlow: 'rgba(164,53,240,0.25)',
  t0: '#f0f2ff',
  t1: '#8892b0',
  t2: '#4a5280',
  t3: '#2d3358',
  mono: '"JetBrains Mono", "Fira Code", monospace',
  sans: '"Nunito", "DM Sans", sans-serif',
  display: '"Clash Display", "Plus Jakarta Sans", sans-serif',
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Nunito:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body, #root {
      height: 100%;
      background: ${G.bg0};
      color: ${G.t0};
      font-family: ${G.sans};
      font-size: 15px;
      -webkit-font-smoothing: antialiased;
    }

    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 99px; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes shimmer {
      0%   { background-position: -400% 0; }
      100% { background-position: 400% 0; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.8); }
    }
    @keyframes glow {
      0%, 100% { box-shadow: 0 0 12px var(--glow-color, #6366f188); }
      50%       { box-shadow: 0 0 28px var(--glow-color, #6366f188); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-5px); }
    }
    @keyframes scanH {
      0%   { transform: translateY(-2px) scaleY(1); opacity: 0.6; }
      50%  { opacity: 0.2; }
      100% { transform: translateY(380px) scaleY(1); opacity: 0; }
    }

    .fu  { animation: fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
    .fu1 { animation: fadeUp 0.45s 0.06s cubic-bezier(0.22,1,0.36,1) both; }
    .fu2 { animation: fadeUp 0.45s 0.12s cubic-bezier(0.22,1,0.36,1) both; }
    .fu3 { animation: fadeUp 0.45s 0.18s cubic-bezier(0.22,1,0.36,1) both; }
    .fu4 { animation: fadeUp 0.45s 0.24s cubic-bezier(0.22,1,0.36,1) both; }

    button { cursor: pointer; font-family: inherit; }
    button:disabled { cursor: not-allowed; }

    .step-card { transition: border-color 0.25s ease, box-shadow 0.25s ease; }
    .step-card:hover { border-color: rgba(120,140,255,0.2) !important; }

    .run-btn { transition: all 0.18s ease; }
    .run-btn:not(:disabled):hover { transform: translateY(-1px); }
    .run-btn:not(:disabled):active { transform: translateY(0); }

    .url-row { transition: background 0.15s ease; }
    .url-row:hover { background: rgba(255,255,255,0.03) !important; }
  `}</style>
)

// ─── MICRO COMPONENTS ────────────────────────────────────────────────────────
const Tag = ({ children, color = G.accentLight, bg }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 8px', borderRadius: 5,
    fontSize: 10, fontFamily: G.mono, fontWeight: 500,
    color, background: bg || color + '1a',
    border: `1px solid ${color}2a`, letterSpacing: '0.04em',
  }}>{children}</span>
)

const Dot = ({ color = G.green, size = 7 }) => (
  <span style={{
    display: 'inline-block', width: size, height: size,
    borderRadius: '50%', background: color,
    boxShadow: `0 0 7px ${color}`,
    animation: 'pulse 2.2s ease infinite',
    flexShrink: 0,
  }} />
)

const Spinner = ({ size = 16, color = G.accent }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.75s linear infinite', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" fill="none" strokeDasharray="38 62" strokeLinecap="round" />
  </svg>
)

const Bar = ({ pct, color, height = 4 }) => (
  <div style={{ height, borderRadius: 99, background: G.bg4, overflow: 'hidden', flex: 1 }}>
    <div style={{
      height: '100%', width: `${pct}%`, borderRadius: 99,
      background: `linear-gradient(90deg, ${color}88, ${color})`,
      transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
      boxShadow: `0 0 8px ${color}66`,
    }} />
  </div>
)

const Divider = () => (
  <div style={{ height: 1, background: G.border, margin: '0 -22px' }} />
)

// ─── CARD ─────────────────────────────────────────────────────────────────────
const Card = ({ children, style = {}, className = '', ...rest }) => (
  <div className={className} {...rest} style={{
    background: G.bg1,
    border: `1px solid ${G.border}`,
    borderRadius: 18,
    overflow: 'hidden',
    ...style,
  }}>{children}</div>
)

// ─── HEADER ──────────────────────────────────────────────────────────────────
function Header({ health, onRefresh }) {
  const groqOk = health?.groq?.startsWith('configured')
  const cnnOk  = health?.cnn_model === 'loaded'

  return (
    <header style={{
      borderBottom: `1px solid ${G.border}`,
      background: `${G.bg0}dd`,
      backdropFilter: 'blur(24px)',
      position: 'sticky', top: 0, zIndex: 200,
      padding: '0 40px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: `linear-gradient(135deg, ${G.accent} 0%, #8b5cf6 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 20px ${G.accentGlow}, 0 4px 12px rgba(0,0,0,0.3)`,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M9 12l2 2 4-4" strokeWidth="2"/>
          </svg>
        </div>
        <div>
          <div style={{ fontFamily: G.display, fontSize: 20, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            Doc<span style={{ color: G.accentLight }}>Guard</span>
          </div>
          <div style={{ fontSize: 9, color: G.t2, fontFamily: G.mono, letterSpacing: '0.14em', marginTop: 2 }}>
            CERTIFICATE INTELLIGENCE
          </div>
        </div>
      </div>

      {/* Status pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {health && (<>
          <StatusPill label="CNN" ok={cnnOk} />
          <StatusPill label="GROQ" ok={groqOk} />
        </>)}
        <button onClick={onRefresh} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 99,
          border: `1px solid ${health ? G.green + '33' : G.red + '33'}`,
          background: health ? G.greenDim : G.redDim,
          color: health ? G.green : G.red,
          fontSize: 11, fontFamily: G.mono, letterSpacing: '0.06em',
          transition: 'all 0.2s ease',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.54"/>
          </svg>
          {health ? 'ONLINE' : 'OFFLINE'}
        </button>
      </div>
    </header>
  )
}

function StatusPill({ label, ok }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 12px', borderRadius: 99,
      border: `1px solid ${ok ? G.green + '22' : G.amber + '22'}`,
      background: ok ? G.greenDim : G.amberDim,
      fontSize: 10, fontFamily: G.mono,
    }}>
      <Dot color={ok ? G.green : G.amber} size={5} />
      <span style={{ color: ok ? G.green : G.amber, letterSpacing: '0.08em' }}>{label}</span>
    </div>
  )
}

// ─── UPLOAD ZONE ─────────────────────────────────────────────────────────────
function UploadZone({ onFile, preview, onReset }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()

  const handle = f => { if (f?.type?.startsWith('image/')) onFile(f) }

  if (preview) return (
    <Card className="fu" style={{ position: 'relative' }}>
      {/* Image */}
      <div style={{ position: 'relative', background: G.bg0, overflow: 'hidden' }}>
        <img src={preview} alt="Certificate" style={{
          width: '100%', display: 'block', maxHeight: 340,
          objectFit: 'contain',
        }} />
        {/* Scan line effect */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${G.accentLight}88, transparent)`,
          animation: 'scanH 3s ease-in-out infinite',
        }} />
        {/* Subtle overlay grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(${G.border} 1px, transparent 1px), linear-gradient(90deg, ${G.border} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          opacity: 0.3,
        }} />
        {/* Corner brackets */}
        {[['top:8px left:8px', '0 0 0 2px'], ['top:8px right:8px', '0 0 2px 0'], ['bottom:8px left:8px', '0 2px 0 2px'], ['bottom:8px right:8px', '0 2px 2px 0']].map(([pos, br], i) => {
          const [t, l, b, r] = pos.split(' ').map(p => p.split(':'))
          const posObj = {}
          if (t) posObj.top = t[1]; if (l) posObj.left = l[1]; if (b) posObj.bottom = b[1]; if (r) posObj.right = r[1]
          return (
            <div key={i} style={{
              position: 'absolute', ...posObj,
              width: 20, height: 20,
              borderTop: i < 2 ? `2px solid ${G.accentLight}88` : 'none',
              borderBottom: i >= 2 ? `2px solid ${G.accentLight}88` : 'none',
              borderLeft: (i === 0 || i === 2) ? `2px solid ${G.accentLight}88` : 'none',
              borderRight: (i === 1 || i === 3) ? `2px solid ${G.accentLight}88` : 'none',
            }} />
          )
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 18px', borderTop: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: G.bg2,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: G.green, boxShadow: `0 0 8px ${G.green}` }} />
          <span style={{ fontSize: 11, fontFamily: G.mono, color: G.t1, letterSpacing: '0.05em' }}>
            DOCUMENT LOADED — RUN VERIFICATION STEPS
          </span>
        </div>
        <button onClick={onReset} className="run-btn" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 8,
          border: `1px solid ${G.border}`, background: G.bg3,
          color: G.t1, fontSize: 11, fontFamily: G.mono,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          RESET
        </button>
      </div>
    </Card>
  )

  return (
    <Card className="fu" style={{
      border: `2px dashed ${drag ? G.accentLight : G.border}`,
      background: drag ? `${G.accentDim}` : G.bg1,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: drag ? `0 0 40px ${G.accentGlow}` : 'none',
    }}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      onClick={() => ref.current.click()}
    >
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])} />

      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        {/* Upload icon */}
        <div style={{
          width: 80, height: 80, borderRadius: 24, margin: '0 auto 24px',
          background: drag ? G.accentDim : G.bg2,
          border: `1px solid ${drag ? G.accentLight + '66' : G.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: drag ? `0 0 40px ${G.accentGlow}` : 'none',
          transition: 'all 0.2s ease',
          animation: 'float 4s ease-in-out infinite',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={drag ? G.accentLight : G.t2} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.2s' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>

        <div style={{ fontFamily: G.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8, color: G.t0 }}>
          Drop your certificate here
        </div>
        <div style={{ color: G.t2, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
          Drag & drop or click to browse<br/>
          <span style={{ fontSize: 12 }}>Supports JPG, PNG, JPEG</span>
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
          {['PNG', 'JPG', 'JPEG'].map(e => (
            <span key={e} style={{
              padding: '4px 12px', borderRadius: 7,
              border: `1px solid ${G.border}`, background: G.bg2,
              fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.08em',
            }}>{e}</span>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ─── STEP BUTTON ─────────────────────────────────────────────────────────────
function StepBtn({ num, title, desc, tag, tagColor, tagBg, onRun, loading, done, error, disabled, accent = G.accent }) {
  const stateColor = done ? G.green : error ? G.red : accent
  return (
    <Card className={`fu step-card`} style={{
      border: `1px solid ${done ? G.green + '22' : error ? G.red + '22' : G.border}`,
    }}>
      <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* Number */}
        <div style={{
          flexShrink: 0, width: 38, height: 38, borderRadius: 11,
          background: done ? G.greenDim : error ? G.redDim : `${accent}14`,
          border: `1px solid ${done ? G.green + '33' : error ? G.red + '33' : accent + '33'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: G.mono, fontSize: 12, fontWeight: 700,
          color: done ? G.green : error ? G.red : accent,
          letterSpacing: '0.02em',
        }}>{num}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: G.display, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</span>
            {tag && <Tag color={tagColor || G.accentLight} bg={tagBg}>{tag}</Tag>}
          </div>
          <div style={{ fontSize: 12.5, color: G.t1, lineHeight: 1.6, marginBottom: 16 }}>{desc}</div>

          <button
            onClick={onRun}
            disabled={disabled || loading}
            className="run-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 10,
              border: 'none', fontSize: 11, fontFamily: G.mono, fontWeight: 600,
              letterSpacing: '0.06em',
              background: loading ? G.bg3
                : done ? G.greenDim
                : error ? G.redDim
                : `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
              color: loading ? G.t2 : done ? G.green : error ? G.red : '#fff',
              opacity: (disabled && !loading) ? 0.3 : 1,
              boxShadow: (!disabled && !loading && !done && !error) ? `0 4px 16px ${accent}44` : 'none',
            }}
          >
            {loading ? <><Spinner size={12} color={G.t1} /> ANALYZING…</>
              : done ? <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                RE-RUN
              </>
              : error ? <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.54"/></svg>
                RETRY
              </>
              : <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                RUN
              </>}
          </button>
        </div>
      </div>
    </Card>
  )
}

// ─── RESULT: CNN ──────────────────────────────────────────────────────────────
function CnnResult({ d }) {
  const auth = d.prediction === 'Authentic'
  const conf = d.confidence ? Math.round(d.confidence * 100) : null

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Verdict row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0,
          background: auth ? G.greenDim : G.redDim,
          border: `1px solid ${auth ? G.green + '44' : G.red + '44'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: auth ? `0 0 20px ${G.greenGlow}` : `0 0 20px ${G.red}44`,
        }}>
          {auth
            ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
        </div>
        <div>
          <div style={{ fontFamily: G.display, fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: auth ? G.green : G.red, lineHeight: 1 }}>
            {d.prediction}
          </div>
        </div>
      </div>

      {/* Model info */}
      <div style={{
        background: G.bg2, borderRadius: 10, padding: '12px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontFamily: G.mono, color: G.t2, letterSpacing: '0.05em' }}>MODEL</span>
        <Tag color={G.accentLight}>EfficientNet-B0</Tag>
      </div>
    </div>
  )
}

// ─── RESULT: LINKS ───────────────────────────────────────────────────────────
function LinksResult({ d }) {
  const [open, setOpen] = useState(null)
  const cert = d.certificate || {}
  const urlV = d.url_verification || {}
  const pv   = d.person_verification || {}

  // Determine if link format is valid — show "DETAILS FOUND" instead of SUSPICIOUS
  const hasValidLinks = urlV.details?.some(u => !u.error?.startsWith('Invalid URL format'))
  const hasFoundDetails = cert.name || cert.course || cert.cert_id

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Extracted certificate info */}
      {hasFoundDetails && (
        <div style={{ background: G.bg2, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 12 }}>
            EXTRACTED FROM CERTIFICATE
          </div>
          {[['NAME', cert.name], ['COURSE', cert.course], ['DATE', cert.date], ['ISSUER', cert.issuer], ['CERT ID', cert.cert_id]].map(([k, v]) => v && (
            <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontFamily: G.mono, color: G.t3, minWidth: 64, paddingTop: 1, letterSpacing: '0.05em' }}>{k}</span>
              <span style={{ fontSize: 13, color: G.t0, flex: 1, lineHeight: 1.5 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* URL checks */}
      {urlV.details?.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 8 }}>
            LINK VERIFICATION — {urlV.urls_found} URL{urlV.urls_found !== 1 ? 'S' : ''} FOUND
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {urlV.details.map((u, i) => {
              const formatBad = u.error && u.error.startsWith('Invalid URL format')
              const ok = !formatBad && u.valid !== false
              const unknown = u.valid === null && !formatBad
              const c = ok ? G.green : unknown ? G.amber : G.red
              const statusLabel = ok ? 'VALID' : unknown ? 'BLOCKED' : 'INVALID'
              return (
                <div key={i} style={{
                  borderRadius: 9,
                  border: `1px solid ${c}22`,
                  background: G.bg2,
                  overflow: 'hidden',
                }}>
                  <div
                    className="url-row"
                    onClick={() => setOpen(open === i ? null : i)}
                    style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c, boxShadow: `0 0 7px ${c}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: G.mono, color: G.t1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.url}
                    </span>
                    <Tag color={c} bg={c + '14'}>{statusLabel}</Tag>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={G.t2} strokeWidth="2.5" style={{ transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                  {open === i && (
                    <div style={{ padding: '10px 14px', borderTop: `1px solid ${G.border}`, fontSize: 12, fontFamily: G.mono, color: G.t1, lineHeight: 1.7 }}>
                      {u.error && <div style={{ color: G.red }}>Error: {u.error}</div>}
                      {u.note && <div style={{ color: G.amber }}>{u.note}</div>}
                      {u.redirected_to && <div>Redirected → {u.redirected_to}</div>}
                      {!u.error && !u.note && !u.redirected_to && <div style={{ color: G.green }}>✓ Link is accessible (HTTP 200)</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Issuer & course legitimacy — no suspicious banner, just show facts */}
      {pv.verdict && (
        <div style={{ background: G.bg2, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 12 }}>
            ISSUER & COURSE LEGITIMACY
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <Tag
              color={pv.issuer_legitimate === 'YES' ? G.green : G.amber}
              bg={(pv.issuer_legitimate === 'YES' ? G.green : G.amber) + '14'}
            >
              ISSUER: {pv.issuer_legitimate || 'UNKNOWN'}
            </Tag>
            <Tag
              color={pv.course_exists === 'YES' ? G.green : G.amber}
              bg={(pv.course_exists === 'YES' ? G.green : G.amber) + '14'}
            >
              COURSE EXISTS: {pv.course_exists || 'UNKNOWN'}
            </Tag>
          </div>
          {/* Show only a neutral summary of the facts, no SUSPICIOUS wording */}
          {pv.issuer_legitimate === 'YES' && pv.course_exists === 'YES' && (
            <div style={{ fontSize: 12, color: G.t1, lineHeight: 1.6 }}>
              Issuer and course details were verified as legitimate.
            </div>
          )}
        </div>
      )}

      {/* Details found summary pill */}
      {hasFoundDetails && (
        <div style={{
          borderRadius: 10, padding: '11px 15px',
          background: G.greenDim, border: `1px solid ${G.green}22`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: G.green, boxShadow: `0 0 8px ${G.green}` }} />
          <span style={{ fontSize: 12, fontFamily: G.mono, color: G.green, letterSpacing: '0.04em' }}>
            DETAILS FOUND — Certificate data successfully extracted
          </span>
        </div>
      )}
    </div>
  )
}

// ─── RESULT: QR ──────────────────────────────────────────────────────────────
function QrResult({ d }) {
  const colors = {
    ORIGINAL: G.green, TAMPERED: G.red,
    QR_NOT_VALID: G.amber, OCR_FAILED: G.amber,
    OCR_UNAVAILABLE: G.amber,
    CERTIFICATE_REVOKED: G.red, CERTIFICATE_NOT_FOUND: G.amber,
  }
  const c = colors[d.verdict] || G.t2
  const good = d.verdict === 'ORIGINAL'
  const bad  = d.verdict === 'TAMPERED' || d.verdict === 'CERTIFICATE_REVOKED'
  const verdictLabel = (d.verdict || '—').replace(/_/g, ' ')

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Verdict */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0,
          background: good ? G.greenDim : bad ? G.redDim : G.amberDim,
          border: `1px solid ${c}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 20px ${c}44`,
        }}>
          {good
            ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : bad
            ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.amber} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        </div>
        <div style={{ fontFamily: G.display, fontSize: 24, fontWeight: 800, color: c, letterSpacing: '-0.03em', lineHeight: 1 }}>
          {verdictLabel}
        </div>
      </div>

      {/* QR → Issuer API */}
      {d.qr_result?.verified && (
        <div style={{ background: G.bg2, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 12 }}>QR → ISSUER API</div>
          {[['ISSUER', d.qr_result.issuer], ['CERT ID', d.qr_result.cert_id], ['STATUS', d.qr_result.status], ['DOMAIN', d.qr_result.domain]].map(([k, v]) => v && (
            <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontFamily: G.mono, color: G.t3, minWidth: 64, letterSpacing: '0.05em' }}>{k}</span>
              <span style={{ fontSize: 13, color: G.t0 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* OCR data */}
      {d.ocr_data && (
        <div style={{ background: G.bg2, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 12 }}>OCR EXTRACTED</div>
          {[['CERT ID', d.ocr_data.cert_id], ['NAME', d.ocr_data.name], ['COURSE', d.ocr_data.course]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontFamily: G.mono, color: G.t3, minWidth: 64, letterSpacing: '0.05em' }}>{k}</span>
              <span style={{ fontSize: 13, color: v ? G.t0 : G.t3, fontStyle: v ? 'normal' : 'italic' }}>{v || 'not detected'}</span>
            </div>
          ))}
        </div>
      )}


      {/* Error/info */}
      {d.qr_result?.error && (
        <div style={{ fontSize: 12, color: G.amber, fontFamily: G.mono, lineHeight: 1.6 }}>
          ℹ {d.qr_result.error}
        </div>
      )}
    </div>
  )
}

// ─── RESULT: UDEMY DB ────────────────────────────────────────────────────────
function UdemyResult({ d }) {
  const verified = d.verified === true || d.status === 'verified' || d.db_verified === true
  const certData = d.certificate || d.data || {}

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Verdict */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0,
          background: verified ? G.greenDim : G.redDim,
          border: `1px solid ${verified ? G.green + '44' : G.red + '44'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 20px ${verified ? G.greenGlow : G.red + '44'}`,
        }}>
          {verified
            ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
        </div>
        <div>
          <div style={{ fontFamily: G.display, fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', color: verified ? G.green : G.red, lineHeight: 1 }}>
            {verified ? 'VERIFIED' : 'NOT FOUND'}
          </div>
          <div style={{ fontSize: 11, fontFamily: G.mono, color: G.t2, marginTop: 4, letterSpacing: '0.04em' }}>
            {verified ? 'Certificate exists in Udemy database' : 'Certificate not found in Udemy database'}
          </div>
        </div>
      </div>

      {/* DB info */}
      {Object.keys(certData).length > 0 && (
        <div style={{ background: G.bg2, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 12 }}>DATABASE RECORD</div>
          {Object.entries(certData).map(([k, v]) => v && (
            <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontFamily: G.mono, color: G.t3, minWidth: 80, paddingTop: 1, letterSpacing: '0.05em' }}>
                {k.toUpperCase().replace(/_/g, ' ')}
              </span>
              <span style={{ fontSize: 13, color: G.t0, flex: 1, lineHeight: 1.5 }}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {d.message && (
        <div style={{ fontSize: 12, color: G.t1, fontFamily: G.mono, lineHeight: 1.7 }}>
          {d.message}
        </div>
      )}
    </div>
  )
}

// ─── RESULT PANEL ────────────────────────────────────────────────────────────
function ResultPanel({ stepKey, data, loading }) {
  if (!data && !loading) return null

  const meta = {
    cnn:   { title: 'CNN ANALYSIS',            color: G.accentLight },
    links: { title: 'LINK VERIFICATION',        color: G.accentLight },
    qr:    { title: 'QR + OCR MATCH',           color: G.accentLight },
    udemy: { title: 'UDEMY DATABASE CHECK',      color: G.udemy },
  }

  const icons = {
    cnn: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    links: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    qr: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>,
    udemy: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  }

  const { title, color } = meta[stepKey] || {}

  return (
    <Card className="fu1">
      {/* Panel header */}
      <div style={{
        padding: '13px 20px', borderBottom: `1px solid ${G.border}`,
        background: G.bg2,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color }}>{icons[stepKey]}</span>
        <span style={{ fontSize: 11, fontFamily: G.mono, color, letterSpacing: '0.09em' }}>{title}</span>
        {loading && <Spinner size={11} color={G.t2} style={{ marginLeft: 'auto' }} />}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[85, 60, 75, 45].map((w, i) => (
            <div key={i} style={{
              height: i === 0 ? 20 : 12, borderRadius: 5, width: `${w}%`,
              background: `linear-gradient(90deg, ${G.bg2} 25%, ${G.bg3} 50%, ${G.bg2} 75%)`,
              backgroundSize: '400% 100%', animation: 'shimmer 1.5s infinite',
            }} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && data?.error && (
        <div style={{ padding: '18px 22px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: G.redDim, border: `1px solid ${G.red}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div style={{ fontSize: 13, color: G.red, lineHeight: 1.6 }}>{data.error}</div>
        </div>
      )}

      {/* Results */}
      {!loading && data && !data.error && (
        <>
          {stepKey === 'cnn'   && <CnnResult d={data} />}
          {stepKey === 'links' && <LinksResult d={data} />}
          {stepKey === 'qr'    && <QrResult d={data} />}
          {stepKey === 'udemy' && <UdemyResult d={data} />}
        </>
      )}
    </Card>
  )
}

// ─── VERDICT BAR ─────────────────────────────────────────────────────────────
function VerdictBar({ steps }) {
  const { cnn, links, qr, udemy } = steps
  const any = cnn || links || qr || udemy
  if (!any) return null

  const cnnBad  = cnn   && !cnn.error   && cnn.prediction === 'Tampered'
  const qrBad   = qr    && !qr.error    && (qr.verdict === 'TAMPERED' || qr.verdict === 'CERTIFICATE_REVOKED')
  const udemyBad = udemy && !udemy.error && (udemy.verified === false || udemy.status === 'not_found' || udemy.db_verified === false)

  const cnnGood  = cnn   && !cnn.error   && cnn.prediction === 'Authentic'
  const qrGood   = qr    && !qr.error    && qr.verdict === 'ORIGINAL'
  const linkGood = links && !links.error
  const udemyGood = udemy && !udemy.error && (udemy.verified === true || udemy.status === 'verified' || udemy.db_verified === true)

  let label = 'INCONCLUSIVE', color = G.amber

  if (cnnBad || qrBad || udemyBad) {
    if (cnnBad && qrBad) label = 'HIGH RISK — LIKELY FRAUDULENT'
    else if (cnnBad) label = 'CNN FLAGGED TAMPERING'
    else if (qrBad) label = 'QR MISMATCH DETECTED'
    else if (udemyBad) label = 'NOT IN UDEMY DATABASE'
    color = G.red
  } else if (cnnGood && qrGood && linkGood) {
    label = 'FULLY VERIFIED — AUTHENTIC'
    color = G.green
  } else if (udemyGood && (cnnGood || qrGood)) {
    label = 'VERIFIED — DATABASE CONFIRMED'
    color = G.green
  } else if (udemyGood) {
    label = 'DATABASE VERIFIED'
    color = G.green
  } else if (cnnGood || qrGood || linkGood) {
    label = 'PARTIALLY VERIFIED'
    color = G.green
  }

  const stepDots = [
    { label: 'CNN',   data: cnn },
    { label: 'LINKS', data: links },
    { label: 'QR',    data: qr },
    { label: 'UDEMY', data: udemy },
  ]

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
      background: `${G.bg1}f0`, backdropFilter: 'blur(24px)',
      borderTop: `1px solid ${color}22`,
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '12px 40px',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, boxShadow: `0 0 12px ${color}` }} />
          <span style={{ fontFamily: G.display, fontSize: 13, fontWeight: 700, color, letterSpacing: '-0.01em' }}>
            {label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14, marginLeft: 'auto' }}>
          {stepDots.map(({ label: l, data }) => {
            const done = data && !data.error
            const err  = data?.error
            return (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: done ? G.green : err ? G.red : G.t3,
                  boxShadow: done ? `0 0 6px ${G.green}` : 'none',
                }} />
                <span style={{ fontSize: 10, fontFamily: G.mono, color: done ? G.t1 : G.t3, letterSpacing: '0.07em' }}>{l}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── SECTION LABEL ───────────────────────────────────────────────────────────
function SectionLabel({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: -4 }}>
      <span style={{ color: G.t2 }}>{icon}</span>
      <span style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em' }}>{text}</span>
    </div>
  )
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
function EmptyResults() {
  return (
    <div className="fu" style={{
      borderRadius: 18, border: `1px dashed ${G.border}`,
      padding: '52px 32px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, marginBottom: 14, opacity: 0.3 }}>◈</div>
      <div style={{ fontSize: 12, fontFamily: G.mono, color: G.t3, letterSpacing: '0.06em' }}>
        RUN A STEP TO SEE RESULTS
      </div>
      <div style={{ fontSize: 12, color: G.t3, marginTop: 8, lineHeight: 1.6 }}>
        Use the buttons on the left to run<br/>individual verification steps
      </div>
    </div>
  )
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [steps,   setSteps]   = useState({ cnn: null, links: null, qr: null, udemy: null })
  const [loading, setLoading] = useState({ cnn: false, links: false, qr: false, udemy: false })
  const [health,  setHealth]  = useState(null)

  const fetchHealth = useCallback(async () => {
    try {
      const r = await fetch('/health')
      setHealth(await r.json())
    } catch { setHealth(null) }
  }, [])

  useEffect(() => { fetchHealth() }, [fetchHealth])

  const handleFile = f => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setSteps({ cnn: null, links: null, qr: null, udemy: null })
  }

  const run = async (key, endpoint) => {
    if (!file) return
    setLoading(l => ({ ...l, [key]: true }))
    setSteps(s => ({ ...s, [key]: null }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`/api/analyze/${endpoint}`, { method: 'POST', body: fd })
      const text = await r.text()
      let data
      try { data = JSON.parse(text) }
      catch { data = { error: r.ok ? 'Unexpected server response — please retry' : `Server error ${r.status}: please retry in a moment` } }
      setSteps(s => ({ ...s, [key]: r.ok ? data : { error: data.detail || data.error || 'Request failed' } }))
    } catch (e) {
      setSteps(s => ({ ...s, [key]: { error: e.message } }))
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
    }
  }

  const reset = () => {
    setFile(null); setPreview(null)
    setSteps({ cnn: null, links: null, qr: null, udemy: null })
  }

  const hasAnyResult = Object.values(steps).some(v => v !== null)
  const hasAnyLoading = Object.values(loading).some(v => v)

  return (
    <>
      <GlobalStyle />

      {/* Background ambience */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {/* Gradient blobs */}
        <div style={{ position: 'absolute', top: '-15%', left: '-5%', width: 700, height: 700, borderRadius: '50%', background: `radial-gradient(circle, ${G.accent}08 0%, transparent 65%)` }} />
        <div style={{ position: 'absolute', bottom: '-5%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${G.green}07 0%, transparent 65%)` }} />
        <div style={{ position: 'absolute', top: '40%', left: '50%', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${G.udemy}05 0%, transparent 65%)` }} />
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, ${G.border} 1px, transparent 1px)`,
          backgroundSize: '36px 36px', opacity: 0.5,
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header health={health} onRefresh={fetchHealth} />

        <main style={{
          flex: 1,
          maxWidth: 1240, width: '100%', margin: '0 auto',
          padding: preview ? '32px 40px 100px' : '80px 40px 100px',
          display: preview ? 'grid' : 'flex',
          gridTemplateColumns: '480px 1fr',
          flexDirection: 'column',
          alignItems: preview ? 'start' : 'center',
          gap: 28,
        }}>

          {/* ── LEFT COLUMN ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {!preview && (
              <div style={{ textAlign: 'center', marginBottom: 32, maxWidth: 500 }}>
                <div style={{
                  fontFamily: G.display, fontSize: 42, fontWeight: 800,
                  letterSpacing: '-0.05em', lineHeight: 1.1, marginBottom: 16,
                  background: `linear-gradient(135deg, ${G.t0} 0%, ${G.accentLight} 100%)`,
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  Verify Any Certificate
                </div>
                <div style={{ fontSize: 15, color: G.t1, lineHeight: 1.7 }}>
                  AI-powered authenticity analysis using CNN, QR scanning, link verification, and database checks.
                </div>
              </div>
            )}

            <UploadZone onFile={handleFile} preview={preview} onReset={reset} />

            {preview && (<>
              <SectionLabel
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
                text="VERIFICATION STEPS"
              />

              <StepBtn
                num="01" title="CNN Authenticity Analysis" tag="EfficientNet-B0"
                desc="Deep learning model detects pixel-level tampering and forgery artifacts in the certificate image."
                onRun={() => run('cnn', 'cnn')}
                loading={loading.cnn} done={steps.cnn && !steps.cnn.error} error={steps.cnn?.error}
                disabled={!file} accent={G.accent}
              />
              <StepBtn
                num="02" title="Link & Identity Verification" tag="Groq AI"
                desc="Extracts certificate details via vision AI, checks if URLs are live and valid, and verifies issuer legitimacy."
                onRun={() => run('links', 'links')}
                loading={loading.links} done={steps.links && !steps.links.error} error={steps.links?.error}
                disabled={!file} accent={G.accent}
              />
              <StepBtn
                num="03" title="QR Code + OCR Field Match" tag="Tesseract"
                desc="Scans embedded QR code, contacts issuer API, and performs fuzzy-match comparison of extracted fields."
                onRun={() => run('qr', 'qr')}
                loading={loading.qr} done={steps.qr && !steps.qr.error} error={steps.qr?.error}
                disabled={!file} accent={G.accent}
              />

              {/* Udemy specific section */}
              <div style={{ marginTop: 4 }}>
                <SectionLabel
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>}
                  text="PLATFORM-SPECIFIC"
                />
              </div>

              <StepBtn
                num="U" title="Udemy Database Check" tag="DB LOOKUP"
                tagColor={G.udemy} tagBg={G.udemyDim}
                desc="Directly checks Udemy's certificate database using the certificate ID. No link visit needed — DB match = verified."
                onRun={() => run('udemy', 'udemy')}
                loading={loading.udemy} done={steps.udemy && !steps.udemy.error} error={steps.udemy?.error}
                disabled={!file} accent={G.udemy}
              />
            </>)}
          </div>

          {/* ── RIGHT COLUMN ── */}
          {preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(steps.cnn   || loading.cnn)   && <ResultPanel stepKey="cnn"   data={steps.cnn}   loading={loading.cnn}   />}
              {(steps.links || loading.links)  && <ResultPanel stepKey="links" data={steps.links} loading={loading.links} />}
              {(steps.qr    || loading.qr)     && <ResultPanel stepKey="qr"    data={steps.qr}    loading={loading.qr}    />}
              {(steps.udemy || loading.udemy)  && <ResultPanel stepKey="udemy" data={steps.udemy} loading={loading.udemy} />}
              {!hasAnyResult && !hasAnyLoading && <EmptyResults />}
            </div>
          )}
        </main>
      </div>

      <VerdictBar steps={steps} />
    </>
  )
}
