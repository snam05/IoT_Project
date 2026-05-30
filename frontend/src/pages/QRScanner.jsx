import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Html5Qrcode } from 'html5-qrcode';

const TABS = ['qr', 'otp'];

export default function QRScanner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState('qr'); // 'qr' | 'otp'
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [lockerId, setLockerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { success, message }
  const otpRefs = useRef([]);

  // QR scan state
  const [scanning, setScanning] = useState(false);
  const [scannedId, setScannedId] = useState('');
  const [scannerError, setScannerError] = useState('');

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));

  // ── OTP digit input ───────────────────────────────────────
  const handleOtpInput = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const digits = [...otpDigits];
    digits[index] = value.slice(-1);
    setOtpDigits(digits);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // ── Submit unlock ─────────────────────────────────────────
  const submitUnlock = async (method, code) => {
    setSubmitting(true);
    setResult(null);
    try {
      const body = { method };
      if (method === 'otp') {
        body.code = otpDigits.join('');
      } else {
        body.lockerId = (lockerId || scannedId || 'TEST_CABINET').trim().toUpperCase();
      }

      const res = await fetch('/api/lockers/unlock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const formattedLockerId = (() => {
          if (!data.lockerId) return '';
          const [cab, comp] = data.lockerId.split(':');
          if (cab && comp && !isNaN(Number(comp))) {
            return `${cab}-${String(comp).padStart(3, '0')}`;
          }
          return data.lockerId;
        })();
        setResult({ success: true, message: `Locker ${formattedLockerId} unlocked successfully!` });
        setOtpDigits(['', '', '', '', '', '']);
        setScanning(true);
      } else {
        setResult({ success: false, message: data.error || 'Failed to unlock' });
      }
    } catch {
      setResult({ success: false, message: 'Network error — please try again' });
    } finally {
      setSubmitting(false);
    }
  };

  const simulateScan = () => {
    const id = 'TEST_CABINET';
    setScannedId(id);
    setScanning(false);
    submitUnlock('qr');
  };

  useEffect(() => {
    let html5Qrcode = null;

    if (tab === 'qr') {
      setScanning(true);
      setScannerError('');
      
      const timer = setTimeout(() => {
        try {
          html5Qrcode = new Html5Qrcode("qr-reader");
          
          const qrCodeSuccessCallback = (decodedText) => {
            html5Qrcode.stop()
              .then(() => {
                setScanning(false);
                submitUnlock('qr', decodedText);
              })
              .catch(err => {
                console.warn('Failed to stop scanner on success:', err);
                submitUnlock('qr', decodedText);
              });
          };

          const qrCodeErrorCallback = () => {
            // Silence noisey camera frame errors
          };

          html5Qrcode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            qrCodeSuccessCallback,
            qrCodeErrorCallback
          ).catch(err => {
            console.error('Failed to start QR scanner:', err);
            setScannerError('Could not access camera. Please allow permission or use simulated scan / OTP.');
          });
        } catch (e) {
          console.error('Scanner init error:', e);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5Qrcode) {
          if (html5Qrcode.isScanning) {
            html5Qrcode.stop().catch(err => console.warn('Failed to stop scanner on unmount:', err));
          }
        }
      };
    }
  }, [tab]);

  return (
    <div className="bg-primary text-on-primary h-screen w-screen overflow-hidden relative flex flex-col items-center justify-center">
      <style>{`
        #qr-reader {
          border: none !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: 1rem;
        }
      `}</style>

      {/* Real QR Scanner Viewport */}
      {tab === 'qr' && (
        <div 
          id="qr-reader" 
          className="absolute z-0 overflow-hidden rounded-2xl bg-black/40"
          style={{
            width: '300px',
            height: '300px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}

      {/* Camera Background Placeholder */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAiO6yRIoEZUy0FrxtYWhhxxdgwoD5nZmECdx4plR3ThEhaGaxPggpBbXj_I3rAsLwgUSNINxZGd8CRS9XYYtXx2zmrtn6MgYiHO4gQyplEmHF1enxIY_bu925k2UsySnJUnK5j3Nlc7pkKFmk9KNl80AiB6SEZAUXpJHWxd8FbiEnr6tZx6_UOjckGSXxua0keF7PSRK7G8Pb-gQvBcIPwIgheiy5LLvrvGEd60DI7xyPhD0GuJi2DHXCw3NdcmsUAb4pZeZCTeJFk')",
          filter: 'blur(2px) brightness(0.6) saturate(0.5)',
          transform: `scale(${zoom})`,
          transition: 'transform 0.3s ease',
        }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        <div className="flex-1 bg-black/70 backdrop-blur-sm" />
        <div className="flex">
          <div className="flex-1 bg-black/70 backdrop-blur-sm h-[300px]" />
          <div className="relative w-[300px] h-[300px] flex-shrink-0">
            {tab === 'qr' && (
              <>
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-xl animate-pulse" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-xl animate-pulse" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-xl animate-pulse" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-xl animate-pulse" />
                <div
                  className="absolute top-0 left-0 w-full h-1 scan-line"
                  style={{ background: '#0058bc', boxShadow: '0 0 8px rgba(0,88,188,0.8)' }}
                />
              </>
            )}
          </div>
          <div className="flex-1 bg-black/70 backdrop-blur-sm h-[300px]" />
        </div>
        <div className="flex-1 bg-black/70 backdrop-blur-sm" />
      </div>

      {/* Close button */}
      <div className="absolute top-0 left-0 right-0 z-20 p-5">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="absolute top-16 left-0 right-0 z-20 flex justify-center px-5 mt-4">
        <div className="flex bg-white/10 backdrop-blur-xl rounded-full p-1 border border-white/20">
          {[
            { key: 'qr', icon: 'qr_code_scanner', label: 'Scan QR' },
            { key: 'otp', icon: 'dialpad', label: 'Enter OTP' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setResult(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-label-md font-semibold transition-all duration-200 ${
                tab === key
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── QR Tab content ──────────────────────────────────── */}
      {tab === 'qr' && (
        <>
          <div className="absolute top-1/4 left-0 right-0 z-20 text-center px-5 -mt-12">
            <p className="text-body-lg text-white mb-2">Scan QR Code</p>
            <p className="text-body-md text-white/70">Align the QR code within the frame to unlock the locker</p>
          </div>

          {/* Camera Access Error Message */}
          {scannerError && (
            <div className="absolute z-20 top-2/3 px-6 text-center text-xs text-red-200 bg-red-900/60 py-3 rounded-xl backdrop-blur-md max-w-xs border border-red-500/30">
              {scannerError}
            </div>
          )}

          {/* Locker ID manual input (fallback for QR) */}
          <div className="absolute z-20 flex flex-col items-center gap-3" style={{ top: 'calc(50% + 160px)' }}>
            <button
              onClick={simulateScan}
              disabled={submitting}
              className="bg-secondary text-white text-label-md font-semibold px-8 py-3 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-cta disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Simulate Scan (Demo)'}
            </button>
          </div>

          <div className="absolute bottom-1/4 left-0 right-0 z-20 text-center flex justify-center items-center gap-2 mb-12">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-label-md text-white uppercase tracking-widest">Scanning...</span>
          </div>
        </>
      )}

      {/* ── OTP Tab content ─────────────────────────────────── */}
      {tab === 'otp' && (
        <div className="absolute z-20 w-full max-w-sm px-6 flex flex-col items-center gap-6"
          style={{ top: '50%', transform: 'translateY(-50%)' }}>
          <div className="text-center">
            <p className="text-body-lg text-white font-semibold mb-1">Enter OTP Code</p>
            <p className="text-body-md text-white/70">Enter the 6-digit code shown on the locker display</p>
          </div>

          {/* 6-digit OTP input boxes */}
          <div className="flex gap-2.5" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (otpRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpInput(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                className={`w-12 h-14 text-center text-headline-md font-bold rounded-xl border-2 backdrop-blur-xl bg-white/10 text-white focus:outline-none transition-all ${
                  digit ? 'border-secondary bg-secondary/20' : 'border-white/30 focus:border-white/70'
                }`}
              />
            ))}
          </div>

          {/* Result message */}
          {result && (
            <div className={`flex items-center gap-2 text-body-md rounded-xl px-4 py-3 w-full ${
              result.success ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {result.success ? 'check_circle' : 'error'}
              </span>
              {result.message}
            </div>
          )}

          <button
            onClick={() => submitUnlock('otp')}
            disabled={submitting || otpDigits.join('').length !== 6}
            className="w-full bg-secondary text-white text-body-md font-semibold py-4 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-cta disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>lock_open</span>
                Verify & Unlock
              </>
            )}
          </button>

          <p className="text-label-md text-white/50 text-center">
            OTP rotates every 30 seconds
          </p>
        </div>
      )}

      {/* Bottom Controls (QR mode only) */}
      {tab === 'qr' && (
        <div className="absolute bottom-0 left-0 right-0 z-20 p-5 pb-12 flex justify-center gap-12 items-center">
          <button
            onClick={() => setFlashOn((f) => !f)}
            className={`w-14 h-14 rounded-full backdrop-blur-xl border flex items-center justify-center transition-all active:scale-95 ${
              flashOn ? 'bg-white text-black border-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
              {flashOn ? 'flash_on' : 'flash_off'}
            </span>
          </button>
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-6 py-3">
            <button onClick={handleZoomOut} className="text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>zoom_out</span>
            </button>
            <span className="text-label-md text-white w-8 text-center">{zoom}X</span>
            <button onClick={handleZoomIn} className="text-white/70 hover:text-white transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>zoom_in</span>
            </button>
          </div>
          <button className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95">
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>flip_camera_ios</span>
          </button>
        </div>
      )}
    </div>
  );
}
