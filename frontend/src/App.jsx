import { useState, useRef, useCallback, useEffect } from 'react'

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const G = {
  bg0: '#06080f',
  bg1: '#0c0f1a',
  bg2: '#131728',
  bg3: '#1c2236',
  border: 'rgba(99,120,255,0.12)',
  borderBright: 'rgba(99,120,255,0.25)',
  accent: '#4f6ef7',
  accentBright: '#7b93ff',
  accentDim: 'rgba(79,110,247,0.12)',
  accentGlow: 'rgba(79,110,247,0.3)',
  green: '#22d3a5',
  greenDim: 'rgba(34,211,165,0.12)',
  red: '#f25c6e',
  redDim: 'rgba(242,92,110,0.12)',
  amber: '#f5a524',
  amberDim: 'rgba(245,165,36,0.12)',
  t0: '#eef0ff',
  t1: '#9399bf',
  t2: '#555a7a',
  t3: '#33374f',
  mono: '"JetBrains Mono", "Fira Code", monospace',
  sans: '"Outfit", "DM Sans", sans-serif',
  display: '"Syne", "Outfit", sans-serif',
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Outfit:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body, #root {
      height: 100%;
      background: ${G.bg0};
      color: ${G.t0};
      font-family: ${G.sans};
      font-size: 15px;
      -webkit-font-smoothing: antialiased;
    }

    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 3px; }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes shimmer {
      0%   { background-position: -400% 0; }
      100% { background-position: 400% 0; }
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.85); }
    }
    @keyframes scanline {
      0%   { transform: translateY(-100%); }
      100% { transform: translateY(100vh); }
    }
    @keyframes borderGlow {
      0%, 100% { border-color: rgba(79,110,247,0.2); }
      50%       { border-color: rgba(79,110,247,0.5); }
    }

    .fu  { animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both; }
    .fu1 { animation: fadeUp 0.5s 0.08s cubic-bezier(0.22,1,0.36,1) both; }
    .fu2 { animation: fadeUp 0.5s 0.16s cubic-bezier(0.22,1,0.36,1) both; }
    .fu3 { animation: fadeUp 0.5s 0.24s cubic-bezier(0.22,1,0.36,1) both; }

    button { cursor: pointer; font-family: inherit; }
    button:disabled { cursor: not-allowed; }
  `}</style>
)

// ─── SMALL ATOMS ─────────────────────────────────────────────────────────────
const Tag = ({ children, color = G.accent, bg = G.accentDim }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 9px', borderRadius: 5,
    fontSize: 11, fontFamily: G.mono, fontWeight: 500,
    color, background: bg,
    border: `1px solid ${color}28`, letterSpacing: '0.03em',
  }}>{children}</span>
)

const Dot = ({ color = G.green }) => (
  <span style={{
    display: 'inline-block', width: 7, height: 7,
    borderRadius: '50%', background: color,
    boxShadow: `0 0 6px ${color}`,
    animation: 'pulse 2s ease infinite',
    flexShrink: 0,
  }} />
)

const Spinner = ({ size = 16, color = G.accent }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2.5" fill="none" strokeDasharray="40 60" strokeLinecap="round" />
  </svg>
)

const Bar = ({ pct, color, height = 5 }) => (
  <div style={{ height, borderRadius: 999, background: G.bg3, overflow: 'hidden', flex: 1 }}>
    <div style={{
      height: '100%', width: `${pct}%`, borderRadius: 999,
      background: color,
      transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
      boxShadow: `0 0 8px ${color}88`,
    }} />
  </div>
)

// ─── CARD WRAPPER ─────────────────────────────────────────────────────────────
const Card = ({ children, style = {}, glow = false, className = '', ...rest }) => (
  <div className={className} {...rest} style={{
    background: G.bg1,
    border: `1px solid ${G.border}`,
    borderRadius: 16,
    overflow: 'hidden',
    ...(glow ? { animation: 'borderGlow 3s ease infinite', boxShadow: `0 0 30px ${G.accentGlow}` } : {}),
    ...style,
  }}>{children}</div>
)

// ─── HEADER ───────────────────────────────────────────────────────────────────
function Header({ health, onRefresh }) {
  const groqOk = health?.groq?.startsWith('configured')
  const cnnOk  = health?.cnn_model === 'loaded'

  return (
    <header style={{
      borderBottom: `1px solid ${G.border}`,
      background: `${G.bg0}cc`,
      backdropFilter: 'blur(20px)',
      position: 'sticky', top: 0, zIndex: 200,
      padding: '0 32px', height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: `linear-gradient(135deg, ${G.accent}, ${G.accentBright})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 18px ${G.accentGlow}`,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#06080f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div>
          <span style={{ fontFamily: G.display, fontSize: 19, fontWeight: 700, letterSpacing: '-0.03em' }}>
            Doc<span style={{ color: G.accentBright }}>Guard</span>
          </span>
          <div style={{ fontSize: 10, color: G.t2, fontFamily: G.mono, letterSpacing: '0.1em', marginTop: -3 }}>
            CERTIFICATE INTELLIGENCE
          </div>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {health && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: G.mono, color: G.t2 }}>
              <Dot color={cnnOk ? G.green : G.amber} />
              <span style={{ color: cnnOk ? G.green : G.amber }}>CNN</span>
            </div>
            <div style={{ width: 1, height: 16, background: G.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontFamily: G.mono, color: G.t2 }}>
              <Dot color={groqOk ? G.green : G.amber} />
              <span style={{ color: groqOk ? G.green : G.amber }}>GROQ</span>
            </div>
            <div style={{ width: 1, height: 16, background: G.border }} />
          </>
        )}
        <button onClick={onRefresh} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          border: `1px solid ${G.border}`, background: 'transparent',
          color: health ? G.green : G.red, fontSize: 11, fontFamily: G.mono,
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.54"/>
          </svg>
          {health ? 'ONLINE' : 'OFFLINE'}
        </button>
      </div>
    </header>
  )
}

// ─── UPLOAD ZONE ──────────────────────────────────────────────────────────────
function UploadZone({ onFile, preview, onReset }) {
  const [drag, setDrag] = useState(false)
  const ref = useRef()

  const handle = f => { if (f?.type?.startsWith('image/')) onFile(f) }

  if (preview) return (
    <Card className="fu" style={{ position: 'relative' }}>
      <img src={preview} alt="Certificate" style={{
        width: '100%', display: 'block', maxHeight: 380,
        objectFit: 'contain', background: G.bg0,
      }} />
      {/* Scanline effect */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(transparent, transparent 3px, rgba(79,110,247,0.015) 3px, rgba(79,110,247,0.015) 4px)',
      }} />
      <div style={{
        padding: '10px 16px', borderTop: `1px solid ${G.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontFamily: G.mono, color: G.t2 }}>
          ✓ DOCUMENT LOADED — RUN VERIFICATION STEPS
        </span>
        <button onClick={onReset} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 6,
          border: `1px solid ${G.border}`, background: G.bg3,
          color: G.t1, fontSize: 11, fontFamily: G.mono,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          RESET
        </button>
      </div>
    </Card>
  )

  return (
    <Card className="fu" style={{
      border: `2px dashed ${drag ? G.accent : G.border}`,
      background: drag ? G.accentDim : G.bg1,
      padding: '52px 32px', textAlign: 'center', cursor: 'pointer',
      transition: 'all 0.2s ease',
    }}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]) }}
      onClick={() => ref.current.click()}
    >
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])} />

      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: 20, margin: '0 auto 24px',
        background: drag ? G.accentDim : G.bg2,
        border: `1px solid ${drag ? G.accent : G.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: drag ? `0 0 30px ${G.accentGlow}` : 'none',
        transition: 'all 0.2s ease',
      }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={G.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>

      <div style={{ fontFamily: G.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 8 }}>
        Drop your certificate here
      </div>
      <div style={{ color: G.t1, fontSize: 14, marginBottom: 20 }}>
        or click to browse — JPG, PNG supported
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        {['PNG', 'JPG', 'JPEG'].map(e => (
          <span key={e} style={{
            padding: '3px 10px', borderRadius: 6,
            border: `1px solid ${G.border}`, background: G.bg2,
            fontSize: 11, fontFamily: G.mono, color: G.t2,
          }}>{e}</span>
        ))}
      </div>
    </Card>
  )
}

// ─── STEP BUTTON ──────────────────────────────────────────────────────────────
function StepBtn({ num, title, desc, tag, onRun, loading, done, error, disabled }) {
  return (
    <Card className="fu" style={{
      border: `1px solid ${done ? G.green + '33' : error ? G.red + '33' : G.border}`,
    }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        {/* Number badge */}
        <div style={{
          flexShrink: 0, width: 40, height: 40, borderRadius: 12,
          background: done ? G.greenDim : error ? G.redDim : G.bg2,
          border: `1px solid ${done ? G.green + '44' : error ? G.red + '44' : G.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: G.mono, fontSize: 13, fontWeight: 600,
          color: done ? G.green : error ? G.red : G.t2,
        }}>{num}</div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: G.display, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</span>
            {tag && <Tag>{tag}</Tag>}
          </div>
          <div style={{ fontSize: 13, color: G.t1, lineHeight: 1.55, marginBottom: 14 }}>{desc}</div>

          <button
            onClick={onRun}
            disabled={disabled || loading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 20px', borderRadius: 9,
              border: 'none', fontSize: 12, fontFamily: G.mono, fontWeight: 500,
              letterSpacing: '0.04em',
              background: loading ? G.bg3 : done ? G.greenDim : G.accent,
              color: loading ? G.t2 : done ? G.green : G.bg0,
              opacity: disabled && !loading ? 0.35 : 1,
              boxShadow: (!disabled && !loading && !done) ? `0 0 20px ${G.accentGlow}` : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? <><Spinner size={13} color={G.t1} /> ANALYZING…</>
              : done ? <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                RE-RUN
              </>
              : error ? <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.54"/></svg>
                RETRY
              </>
              : <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
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
  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Verdict row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: auth ? G.greenDim : G.redDim,
          border: `1px solid ${auth ? G.green + '44' : G.red + '44'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {auth
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
        </div>
        <div>
          <div style={{
            fontFamily: G.display, fontSize: 26, fontWeight: 800,
            letterSpacing: '-0.04em',
            color: auth ? G.green : G.red,
          }}>{d.prediction}</div>
          <div style={{ fontSize: 12, color: G.t2, fontFamily: G.mono }}>
            {d.confidence}% confidence
          </div>
        </div>
      </div>

      {/* Dual bar */}
      <div style={{ background: G.bg2, borderRadius: 10, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: G.mono, color: G.t2, marginBottom: 8 }}>
          <span style={{ color: G.green }}>AUTHENTIC {d.authentic_prob}%</span>
          <span style={{ color: G.red }}>TAMPERED {d.tampered_prob}%</span>
        </div>
        <div style={{ display: 'flex', gap: 3, height: 8, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            width: `${d.authentic_prob}%`, background: G.green,
            transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
            boxShadow: `0 0 8px ${G.green}88`,
          }} />
          <div style={{
            width: `${d.tampered_prob}%`, background: G.red,
            transition: 'width 0.9s cubic-bezier(0.22,1,0.36,1)',
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── RESULT: LINKS ────────────────────────────────────────────────────────────
function LinksResult({ d }) {
  const [open, setOpen] = useState(null)
  const cert = d.certificate || {}
  const urlV = d.url_verification || {}
  const pv   = d.person_verification || {}

  const vStatus = d.final_verdict
  const vColor  = vStatus === 'LIKELY_AUTHENTIC' ? G.green : vStatus === 'SUSPICIOUS' ? G.red : G.amber

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Final verdict */}
      <div style={{
        borderRadius: 10, padding: '12px 16px',
        background: vColor + '14', border: `1px solid ${vColor}33`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: vColor, boxShadow: `0 0 8px ${vColor}`, flexShrink: 0 }} />
        <div>
          <div style={{ fontFamily: G.mono, fontSize: 12, fontWeight: 600, color: vColor, letterSpacing: '0.05em' }}>
            {(d.final_verdict || 'UNVERIFIABLE').replace(/_/g, ' ')}
          </div>
          {d.final_reason && (
            <div style={{ fontSize: 12, color: G.t1, marginTop: 2, lineHeight: 1.5 }}>{d.final_reason}</div>
          )}
        </div>
      </div>

      {/* Extracted certificate info */}
      {(cert.name || cert.course) && (
        <div style={{ background: G.bg2, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 10 }}>EXTRACTED FROM CERTIFICATE</div>
          {[['NAME', cert.name], ['COURSE', cert.course], ['DATE', cert.date], ['ISSUER', cert.issuer], ['CERT ID', cert.cert_id]].map(([k, v]) => v && (
            <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 7, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontFamily: G.mono, color: G.t3, minWidth: 60, paddingTop: 1, letterSpacing: '0.05em' }}>{k}</span>
              <span style={{ fontSize: 13, color: G.t0, flex: 1 }}>{v}</span>
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
              const ok = u.valid === true
              const unknown = u.valid === null
              const c = ok ? G.green : unknown ? G.amber : G.red
              return (
                <div key={i} style={{
                  borderRadius: 8,
                  border: `1px solid ${c}33`,
                  background: G.bg2,
                  overflow: 'hidden',
                }}>
                  <div
                    onClick={() => setOpen(open === i ? null : i)}
                    style={{
                      padding: '10px 14px', display: 'flex', alignItems: 'center',
                      gap: 10, cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontFamily: G.mono, color: G.t1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.url}
                    </span>
                    <Tag color={c} bg={c + '14'}>
                      {ok ? 'VALID' : unknown ? 'BLOCKED' : 'INVALID'}
                      {u.status_code ? ` · ${u.status_code}` : ''}
                    </Tag>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={G.t2} strokeWidth="2.5" style={{ transform: open === i ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                  {open === i && (
                    <div style={{ padding: '10px 14px', borderTop: `1px solid ${G.border}`, fontSize: 12, color: G.t1, fontFamily: G.mono }}>
                      {u.error && <div style={{ color: G.red }}>Error: {u.error}</div>}
                      {u.note && <div style={{ color: G.amber }}>{u.note}</div>}
                      {u.redirected_to && <div>Redirected → {u.redirected_to}</div>}
                      {!u.error && !u.note && !u.redirected_to && <div style={{ color: G.green }}>Link is accessible and returned HTTP 200</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Person / issuer check */}
      {pv.verdict && (
        <div style={{ background: G.bg2, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 10 }}>ISSUER & COURSE LEGITIMACY</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <Tag color={pv.issuer_legitimate === 'YES' ? G.green : G.amber}
                 bg={(pv.issuer_legitimate === 'YES' ? G.green : G.amber) + '14'}>
              ISSUER: {pv.issuer_legitimate || 'UNKNOWN'}
            </Tag>
            <Tag color={pv.course_exists === 'YES' ? G.green : G.amber}
                 bg={(pv.course_exists === 'YES' ? G.green : G.amber) + '14'}>
              COURSE EXISTS: {pv.course_exists || 'UNKNOWN'}
            </Tag>
          </div>
          {pv.reason && (
            <div style={{ fontSize: 12, color: G.t1, lineHeight: 1.6 }}>{pv.reason}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── RESULT: QR ───────────────────────────────────────────────────────────────
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

  return (
    <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Verdict */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: good ? G.greenDim : bad ? G.redDim : G.amberDim,
          border: `1px solid ${c}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {good
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            : bad
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G.amber} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
        </div>
        <div>
          <div style={{ fontFamily: G.display, fontSize: 22, fontWeight: 800, color: c, letterSpacing: '-0.03em' }}>
            {(d.verdict || '—').replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Issuer API */}
      {d.qr_result?.verified && (
        <div style={{ background: G.bg2, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 10 }}>QR → ISSUER API</div>
          {[['ISSUER', d.qr_result.issuer], ['CERT ID', d.qr_result.cert_id], ['STATUS', d.qr_result.status], ['DOMAIN', d.qr_result.domain]].map(([k, v]) => v && (
            <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontFamily: G.mono, color: G.t3, minWidth: 60, letterSpacing: '0.05em' }}>{k}</span>
              <span style={{ fontSize: 13, color: G.t0 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* OCR data */}
      {d.ocr_data && (
        <div style={{ background: G.bg2, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 10 }}>OCR EXTRACTED</div>
          {[['CERT ID', d.ocr_data.cert_id], ['NAME', d.ocr_data.name], ['COURSE', d.ocr_data.course]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 7 }}>
              <span style={{ fontSize: 10, fontFamily: G.mono, color: G.t3, minWidth: 60, letterSpacing: '0.05em' }}>{k}</span>
              <span style={{ fontSize: 13, color: v ? G.t0 : G.t3, fontStyle: v ? 'normal' : 'italic' }}>{v || 'not detected'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Field similarity bars */}
      {d.comparison?.similarity_scores && (
        <div style={{ background: G.bg2, borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontFamily: G.mono, color: G.t2, letterSpacing: '0.1em', marginBottom: 12 }}>FIELD MATCH SCORES</div>
          {Object.entries(d.comparison.similarity_scores).map(([field, score]) => {
            const pct = Math.round(score * 100)
            const col = pct >= 80 ? G.green : pct >= 50 ? G.amber : G.red
            return (
              <div key={field} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: G.mono, marginBottom: 5 }}>
                  <span style={{ color: G.t2, letterSpacing: '0.05em' }}>{field.toUpperCase()}</span>
                  <span style={{ color: col, fontWeight: 600 }}>{pct}%</span>
                </div>
                <Bar pct={pct} color={col} />
              </div>
            )
          })}
          {d.comparison.mismatched_fields?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: G.red, fontFamily: G.mono }}>
              ⚠ Mismatch: {d.comparison.mismatched_fields.join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Error/info messages */}
      {d.qr_result?.error && (
        <div style={{ fontSize: 12, color: G.amber, fontFamily: G.mono }}>ℹ {d.qr_result.error}</div>
      )}
    </div>
  )
}

// ─── RESULT PANEL WRAPPER ─────────────────────────────────────────────────────
function ResultPanel({ stepKey, data, loading }) {
  if (!data && !loading) return null

  const titles = { cnn: 'CNN ANALYSIS', links: 'LINK VERIFICATION', qr: 'QR + OCR MATCH' }
  const icons = {
    cnn: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    links: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    qr: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>,
  }

  return (
    <Card className="fu1">
      {/* Panel header */}
      <div style={{
        padding: '12px 20px', borderBottom: `1px solid ${G.border}`,
        background: G.bg2,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: G.accent }}>{icons[stepKey]}</span>
        <span style={{ fontSize: 11, fontFamily: G.mono, color: G.accent, letterSpacing: '0.08em' }}>
          {titles[stepKey]}
        </span>
        {loading && <Spinner size={12} color={G.t2} style={{ marginLeft: 'auto' }} />}
      </div>

      {/* Shimmer skeleton */}
      {loading && (
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[90, 65, 80].map((w, i) => (
            <div key={i} style={{
              height: i === 0 ? 22 : 13, borderRadius: 5, width: `${w}%`,
              background: `linear-gradient(90deg, ${G.bg2} 25%, ${G.bg3} 50%, ${G.bg2} 75%)`,
              backgroundSize: '400% 100%', animation: 'shimmer 1.5s infinite',
            }} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && data?.error && (
        <div style={{ padding: '18px 22px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={G.red} strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ fontSize: 13, color: G.red, lineHeight: 1.6 }}>{data.error}</div>
        </div>
      )}

      {/* Results */}
      {!loading && data && !data.error && (
        <>
          {stepKey === 'cnn'   && <CnnResult d={data} />}
          {stepKey === 'links' && <LinksResult d={data} />}
          {stepKey === 'qr'    && <QrResult d={data} />}
        </>
      )}
    </Card>
  )
}

// ─── VERDICT BAR ──────────────────────────────────────────────────────────────
function VerdictBar({ steps }) {
  const { cnn, links, qr } = steps
  const any = cnn || links || qr
  if (!any) return null

  const cnnBad   = cnn  && !cnn.error  && cnn.prediction === 'Tampered'
  const qrBad    = qr   && !qr.error   && (qr.verdict === 'TAMPERED' || qr.verdict === 'CERTIFICATE_REVOKED')
  const linkBad  = links && !links.error && links.final_verdict === 'SUSPICIOUS'
  const cnnGood  = cnn  && !cnn.error  && cnn.prediction === 'Authentic'
  const qrGood   = qr   && !qr.error   && qr.verdict === 'ORIGINAL'
  const linkGood = links && !links.error && links.final_verdict === 'LIKELY_AUTHENTIC'

  let label = 'INCONCLUSIVE', color = G.amber

  if (cnnBad || qrBad || linkBad) {
    label = cnnBad && (qrBad || linkBad) ? 'HIGH RISK — LIKELY FRAUDULENT' : cnnBad ? 'CNN FLAGGED TAMPERING' : qrBad ? 'QR MISMATCH DETECTED' : 'SUSPICIOUS LINK FINDINGS'
    color = G.red
  } else if (cnnGood && qrGood && linkGood) {
    label = 'FULLY VERIFIED — AUTHENTIC'
    color = G.green
  } else if (cnnGood || qrGood || linkGood) {
    label = 'PARTIALLY VERIFIED'
    color = G.green
  }

  const stepDots = [
    { label: 'CNN',   data: cnn },
    { label: 'LINKS', data: links },
    { label: 'QR',    data: qr },
  ]

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 300,
      background: `${G.bg1}ee`, backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${color}33`,
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '11px 32px',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
          <span style={{ fontFamily: G.display, fontSize: 13, fontWeight: 700, color, letterSpacing: '-0.01em' }}>
            {label}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 16, marginLeft: 'auto' }}>
          {stepDots.map(({ label: l, data }) => {
            const done = data && !data.error
            const err  = data?.error
            return (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: done ? G.green : err ? G.red : G.t3,
                  boxShadow: done ? `0 0 6px ${G.green}` : 'none',
                }} />
                <span style={{ fontSize: 10, fontFamily: G.mono, color: done ? G.t1 : G.t3, letterSpacing: '0.06em' }}>{l}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [steps,   setSteps]   = useState({ cnn: null, links: null, qr: null })
  const [loading, setLoading] = useState({ cnn: false, links: false, qr: false })
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
    setSteps({ cnn: null, links: null, qr: null })
  }

  const run = async (key, endpoint) => {
    if (!file) return
    setLoading(l => ({ ...l, [key]: true }))
    setSteps(s => ({ ...s, [key]: null }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`/api/analyze/${endpoint}`, { method: 'POST', body: fd })
      const data = await r.json()
      setSteps(s => ({ ...s, [key]: r.ok ? data : { error: data.detail || 'Request failed' } }))
    } catch (e) {
      setSteps(s => ({ ...s, [key]: { error: e.message } }))
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
    }
  }

  const reset = () => { setFile(null); setPreview(null); setSteps({ cnn: null, links: null, qr: null }) }

  return (
    <>
      <GlobalStyle />

      {/* Ambient background glow */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '10%', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${G.accent}0a 0%, transparent 70%)` }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${G.green}07 0%, transparent 70%)` }} />
        {/* Dot grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `radial-gradient(circle, ${G.border} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.6,
        }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header health={health} onRefresh={fetchHealth} />

        <main style={{
          flex: 1, maxWidth: 1200, width: '100%',
          margin: '0 auto', padding: '36px 32px 90px',
          display: 'grid',
          gridTemplateColumns: preview ? '1fr 1fr' : '1fr',
          gap: 24, alignItems: 'start',
        }}>
          {/* LEFT: upload + step buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <UploadZone onFile={handleFile} preview={preview} onReset={reset} />

            {preview && <>
              <StepBtn
                num="01" title="CNN Authenticity Analysis" tag="EfficientNet-B0"
                desc="Deep learning model detects pixel-level tampering and forgery artifacts in the certificate image."
                onRun={() => run('cnn', 'cnn')}
                loading={loading.cnn} done={steps.cnn && !steps.cnn.error} error={steps.cnn?.error}
                disabled={!file}
              />
              <StepBtn
                num="02" title="Link & Identity Verification" tag="Groq AI"
                desc="Extracts certificate details via vision AI, checks if URLs are live and valid, and verifies issuer legitimacy."
                onRun={() => run('links', 'links')}
                loading={loading.links} done={steps.links && !steps.links.error} error={steps.links?.error}
                disabled={!file}
              />
              <StepBtn
                num="03" title="QR Code + OCR Field Match" tag="Tesseract"
                desc="Scans embedded QR code, contacts issuer API, and performs fuzzy-match comparison of extracted fields."
                onRun={() => run('qr', 'qr')}
                loading={loading.qr} done={steps.qr && !steps.qr.error} error={steps.qr?.error}
                disabled={!file}
              />
            </>}
          </div>

          {/* RIGHT: result panels */}
          {preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(steps.cnn || loading.cnn) && <ResultPanel stepKey="cnn"   data={steps.cnn}   loading={loading.cnn}   />}
              {(steps.links || loading.links) && <ResultPanel stepKey="links" data={steps.links} loading={loading.links} />}
              {(steps.qr   || loading.qr)   && <ResultPanel stepKey="qr"    data={steps.qr}    loading={loading.qr}    />}
              {!steps.cnn && !steps.links && !steps.qr && !loading.cnn && !loading.links && !loading.qr && (
                <div className="fu" style={{
                  borderRadius: 16, border: `1px dashed ${G.border}`,
                  padding: '48px 32px', textAlign: 'center', color: G.t3,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
                  <div style={{ fontSize: 13, fontFamily: G.mono, letterSpacing: '0.05em' }}>
                    RUN A STEP TO SEE RESULTS
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <VerdictBar steps={steps} />
    </>
  )
}
