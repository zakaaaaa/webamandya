'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Loader2, Mail, Lock, ArrowRight, CheckCircle2, Camera } from 'lucide-react'

const TYPING_TEXTS = [
  'Kelola bisnis photobooth kamu.',
  'Monitor transaksi real-time.',
  'Upload & atur frame dengan mudah.',
  'Generate voucher untuk pelanggan.',
]

const FEATURES = [
  { label: 'License & HWID Management',     color: '#D42B22' },
  { label: 'Real-time Transaction Monitor', color: '#059669' },
  { label: 'Frame & Voucher Control',       color: '#D97706' },
]

export default function LoginPage() {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [mounted, setMounted]     = useState(false)

  const [textIndex, setTextIndex]   = useState(0)
  const [displayed, setDisplayed]   = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [charIndex, setCharIndex]   = useState(0)

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const current = TYPING_TEXTS[textIndex]
    let timeout: ReturnType<typeof setTimeout>
    if (!isDeleting && charIndex <= current.length) {
      timeout = setTimeout(() => { setDisplayed(current.slice(0, charIndex)); setCharIndex(c => c + 1) }, 55)
    } else if (!isDeleting && charIndex > current.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000)
    } else if (isDeleting && charIndex >= 0) {
      timeout = setTimeout(() => { setDisplayed(current.slice(0, charIndex)); setCharIndex(c => c - 1) }, 28)
    } else {
      setIsDeleting(false); setTextIndex(i => (i + 1) % TYPING_TEXTS.length); setCharIndex(0)
    }
    return () => clearTimeout(timeout)
  }, [charIndex, isDeleting, textIndex])

  const handleLogin = async () => {
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email atau password salah.'); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
  }

  const Brand = ({ size = 44 }: { size?: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: `${size}px`, height: `${size}px`, borderRadius: `${size * 0.28}px`, flexShrink: 0,
        background: 'linear-gradient(135deg,#E83530,#D42B22,#C02018)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 18px rgba(212,43,34,0.32)',
      }}>
        <Camera size={size * 0.5} color="white" />
      </div>
      <div style={{ lineHeight: 1.05 }}>
        <div style={{ fontSize: `${size * 0.42}px`, fontWeight: 900, color: '#150C09', letterSpacing: '-0.02em' }}>Pabrik</div>
        <div style={{ fontSize: `${size * 0.42}px`, fontWeight: 900, color: '#D42B22', letterSpacing: '-0.02em', marginTop: '-3px' }}>Kenangan</div>
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Poppins', sans-serif; }
        @keyframes blink     { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
        @keyframes spin      { to{transform:rotate(360deg)} }
        @keyframes shake     { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }
        @keyframes float-1   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-25px)} }
        @keyframes float-2   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,30px)} }
        @keyframes slide-left  { from{opacity:0;transform:translateX(-32px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slide-right { from{opacity:0;transform:translateX(32px)}  to{opacity:1;transform:translateX(0)} }
        @keyframes fade-up   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .slide-left  { animation: slide-left  0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .slide-right { animation: slide-right 0.7s cubic-bezier(0.16,1,0.3,1) forwards; }
        .login-input {
          width: 100%;
          background: #FFFFFF;
          border: 1.5px solid rgba(212,43,34,0.15);
          border-radius: 12px;
          padding: 13px 16px 13px 44px;
          color: #150C09;
          font-size: 14px;
          font-family: 'Poppins', sans-serif;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-input::placeholder { color: #B0A09A; }
        .login-input:focus {
          border-color: #D42B22;
          box-shadow: 0 0 0 3px rgba(212,43,34,0.10);
        }
        .login-btn {
          width: 100%;
          padding: 14px 20px;
          background: linear-gradient(135deg, #E83530, #D42B22);
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Poppins', sans-serif;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          box-shadow: 0 4px 16px rgba(212,43,34,0.32);
        }
        .login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 26px rgba(212,43,34,0.42); }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 767px) {
          .left-panel  { display: none !important; }
          .right-panel { width: 100% !important; padding: 24px !important; }
          .login-card  { padding: 32px 28px !important; border-radius: 24px !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .left-panel  { padding: 40px !important; }
          .headline    { font-size: 36px !important; }
          .right-panel { width: 420px !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden',
        background: '#FAF7F5',
        fontFamily: "'Poppins', sans-serif",
      }}>

        {/* Soft red orbs */}
        {[
          { w:700, h:700, style:{ top:'-180px', left:'-180px' },     color:'rgba(232,53,48,0.08)',  anim:'float-1 16s ease-in-out infinite' },
          { w:550, h:550, style:{ bottom:'-120px', right:'-120px' }, color:'rgba(212,43,34,0.06)',  anim:'float-2 20s ease-in-out infinite' },
        ].map((o, i) => (
          <div key={i} style={{
            position: 'absolute', width:`${o.w}px`, height:`${o.h}px`,
            borderRadius: '50%', filter: 'blur(70px)', pointerEvents: 'none',
            background: `radial-gradient(circle, ${o.color} 0%, transparent 70%)`,
            animation: o.anim, ...o.style,
          }} />
        ))}

        {/* Grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(212,43,34,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(212,43,34,0.03) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }} />

        {/* ── LEFT PANEL ── */}
        <div className={`left-panel ${mounted ? 'slide-left' : ''}`} style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '60px 56px', position: 'relative', zIndex: 10,
          opacity: mounted ? 1 : 0,
        }}>
          {/* Brand */}
          <div style={{ marginBottom: '40px', animation: mounted ? 'fade-up 0.5s ease 0.05s both' : 'none' }}>
            <Brand size={48} />
          </div>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(212,43,34,0.08)', border: '1px solid rgba(212,43,34,0.20)',
            borderRadius: '100px', padding: '7px 16px',
            marginBottom: '28px', width: 'fit-content',
            animation: mounted ? 'fade-up 0.5s ease 0.1s both' : 'none',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#D42B22', animation: 'pulse-dot 2s infinite' }} />
            <span style={{ color: '#D42B22', fontSize: '12px', fontWeight: 700, letterSpacing: '0.3px', fontFamily: 'Poppins, sans-serif' }}>
              Photobooth Management
            </span>
          </div>

          {/* Headline */}
          <h1 className="headline" style={{
            color: '#150C09', fontSize: '48px', fontWeight: 900, lineHeight: 1.15,
            fontFamily: 'Poppins, sans-serif', marginBottom: '20px', letterSpacing: '-0.02em',
            animation: mounted ? 'fade-up 0.5s ease 0.15s both' : 'none',
          }}>
            Kelola bisnis<br />
            <span style={{ background: 'linear-gradient(135deg, #E83530 0%, #C02018 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              photobooth
            </span>
            <br />dengan mudah.
          </h1>

          {/* Typewriter */}
          <div style={{ height: '24px', marginBottom: '44px', animation: mounted ? 'fade-up 0.5s ease 0.2s both' : 'none' }}>
            <span style={{ color: '#7A6259', fontSize: '15px', fontWeight: 400 }}>{displayed}</span>
            <span style={{ color: '#D42B22', animation: 'blink 1s step-end infinite', fontSize: '15px' }}>|</span>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {FEATURES.map((f, i) => (
              <div key={f.label} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                animation: mounted ? `fade-up 0.5s ease ${0.28 + i * 0.07}s both` : 'none',
              }}>
                <CheckCircle2 size={15} color={f.color} style={{ flexShrink: 0 }} />
                <span style={{ color: '#7A6259', fontSize: '14px' }}>{f.label}</span>
              </div>
            ))}
          </div>

          {/* Bottom brand */}
          <div style={{ marginTop: '64px', animation: mounted ? 'fade-up 0.5s ease 0.5s both' : 'none' }}>
            <div style={{ color: '#B0A09A', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: 'Poppins, sans-serif' }}>
              Powered by
            </div>
            <div style={{ color: '#4A2E22', fontSize: '20px', fontWeight: 800, fontFamily: 'Poppins, sans-serif', marginTop: '4px' }}>
              Pabrik Kenangan
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={`right-panel ${mounted ? 'slide-right' : ''}`} style={{
          width: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 40px 40px 20px', position: 'relative', zIndex: 10,
          opacity: mounted ? 1 : 0,
        }}>
          <div className="login-card" style={{
            width: '100%', maxWidth: '420px',
            background: '#FFFFFF',
            border: '1px solid rgba(212,43,34,0.10)',
            borderRadius: '28px', padding: '44px 40px',
            boxShadow: '0 20px 60px rgba(212,43,34,0.10), 0 4px 16px rgba(0,0,0,0.04)',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Top shine */}
            <div style={{ position: 'absolute', top: 0, left: '32px', right: '32px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,43,34,0.20), transparent)', pointerEvents: 'none' }} />

            {/* Brand in card */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              marginBottom: '32px',
              animation: mounted ? 'fade-up 0.5s ease 0.25s both' : 'none',
            }}>
              <Brand size={44} />
            </div>

            {/* Title */}
            <div style={{ marginBottom: '28px', animation: mounted ? 'fade-up 0.5s ease 0.3s both' : 'none' }}>
              <h2 style={{ color: '#150C09', fontSize: '26px', fontWeight: 800, fontFamily: 'Poppins, sans-serif', marginBottom: '6px' }}>
                Masuk
              </h2>
              <p style={{ color: '#9E8880', fontSize: '13.5px' }}>
                Masukkan kredensial akun kamu
              </p>
            </div>

            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Email */}
              <div style={{ animation: mounted ? 'fade-up 0.5s ease 0.35s both' : 'none' }}>
                <label style={{ color: '#7A6259', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontFamily: 'Poppins, sans-serif' }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} color="#C0AFA9" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@photobooth.com" className="login-input" />
                </div>
              </div>

              {/* Password */}
              <div style={{ animation: mounted ? 'fade-up 0.5s ease 0.4s both' : 'none' }}>
                <label style={{ color: '#7A6259', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '8px', fontFamily: 'Poppins, sans-serif' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} color="#C0AFA9" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••••" className="login-input" />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ background: 'rgba(180,30,20,0.08)', border: '1px solid rgba(180,30,20,0.22)', borderRadius: '10px', padding: '11px 14px', color: '#B82018', fontSize: '13px', fontWeight: 500, animation: 'shake 0.35s ease' }}>
                  {error}
                </div>
              )}

              {/* Button */}
              <div style={{ animation: mounted ? 'fade-up 0.5s ease 0.45s both' : 'none', marginTop: '4px' }}>
                <button onClick={handleLogin} disabled={loading} className="login-btn">
                  {loading
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />Memverifikasi...</>
                    : <><span>Masuk ke Dashboard</span><ArrowRight size={15} /></>
                  }
                </button>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(212,43,34,0.08)', textAlign: 'center', animation: mounted ? 'fade-up 0.5s ease 0.5s both' : 'none' }}>
              <span style={{ color: '#C0AFA9', fontSize: '11px', letterSpacing: '2px', fontFamily: 'Poppins, sans-serif' }}>
                PABRIK KENANGAN © 2026
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
