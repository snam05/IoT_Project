import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

function buildQrRequest(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return null;

  const fromObject = (payload) => {
    const code = payload.code || payload.otp;
    const lockerId = payload.lockerId || payload.locker;
    const cabinetCode = payload.cabinetCode || payload.cabinet;
    const compartmentNo = payload.compartmentNo || payload.compartment;

    if (lockerId) return { method: 'qr', lockerId: String(lockerId).trim().toUpperCase(), ...(code ? { code: String(code).trim() } : {}) };
    if (cabinetCode && compartmentNo && code) return { method: 'qr', lockerId: `${String(cabinetCode).trim().toUpperCase()}:${compartmentNo}`, code: String(code).trim() };
    if (cabinetCode && code) return { method: 'qr', lockerId: `${String(cabinetCode).trim().toUpperCase()}:${String(code).trim()}` };
    if (code && /^\d{6}$/.test(String(code).trim())) return { method: 'otp', code: String(code).trim() };
    return null;
  };

  try {
    const parsed = JSON.parse(value);
    const request = fromObject(parsed);
    if (request) return request;
  } catch {
    // Not JSON.
  }

  try {
    const url = new URL(value);
    const request = fromObject(Object.fromEntries(url.searchParams.entries()));
    if (request) return request;
  } catch {
    // Not a URL.
  }

  if (/^\d{6}$/.test(value)) return { method: 'otp', code: value };
  return { method: 'qr', lockerId: value.toUpperCase() };
}

function formatLockerId(lockerId) {
  if (!lockerId) return '';
  const [cabinet, compartment] = lockerId.split(':');
  if (cabinet && compartment && !Number.isNaN(Number(compartment))) {
    return `${cabinet}-${String(compartment).padStart(3, '0')}`;
  }
  return lockerId;
}

export default function QRScanner() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('qr');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [scannerReady, setScannerReady] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const otpRefs = useRef([]);
  const scannerRef = useRef(null);
  const scanLockedRef = useRef(false);

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

  const submitUnlock = useCallback(async (request) => {
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/lockers/unlock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: `Locker ${formatLockerId(data.lockerId)} ${data.action || 'unlock'}ed successfully!` });
        setOtpDigits(['', '', '', '', '', '']);
      } else {
        setResult({ success: false, message: data.error || 'Failed to unlock' });
      }
    } catch {
      setResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
      scanLockedRef.current = false;
    }
  }, []);

  const submitOtp = () => {
    const code = otpDigits.join('');
    submitUnlock({ method: 'otp', code });
  };

  const handleDecodedQr = useCallback((decodedText) => {
    if (scanLockedRef.current) return;

    const request = buildQrRequest(decodedText);
    if (!request) {
      setResult({ success: false, message: 'Invalid QR payload' });
      return;
    }

    scanLockedRef.current = true;
    setScannedText(decodedText);

    const scanner = scannerRef.current;
    if (scanner) {
      scanner.stop().catch(() => {}).finally(() => submitUnlock(request));
      return;
    }

    submitUnlock(request);
  }, [submitUnlock]);

  useEffect(() => {
    if (tab !== 'qr') return undefined;

    let cancelled = false;
    let scanner;
    scanLockedRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScannerReady(false);
    setScannerError('');

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode('qr-reader', false);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: { ideal: 'environment' } },
          { fps: 10, qrbox: { width: 260, height: 260 }, aspectRatio: 1 },
          handleDecodedQr,
          () => {},
        );
        if (!cancelled) setScannerReady(true);
      } catch (err) {
        console.error('[qr scanner]', err);
        if (!cancelled) {
          setScannerError('Could not access camera. Open this page over HTTPS and allow camera permission.');
        }
      }
    };

    const timer = setTimeout(startScanner, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      scanLockedRef.current = false;
      setScannerReady(false);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear?.();
          scannerRef.current = null;
        });
      }
    };
  }, [tab, handleDecodedQr]);

  return (
    <div className="bg-black text-on-primary h-screen w-screen overflow-hidden relative flex flex-col items-center justify-center">
      <style>{`
        #qr-reader {
          border: none !important;
          width: 100% !important;
          height: 100% !important;
        }
        #qr-reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #qr-reader__dashboard_section,
        #qr-reader__scan_region img,
        #qr-reader__header_message {
          display: none !important;
        }
      `}</style>

      {tab === 'qr' && <div id="qr-reader" className="absolute inset-0 z-0 bg-black" />}

      {tab === 'otp' && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAiO6yRIoEZUy0FrxtYWhhxxdgwoD5nZmECdx4plR3ThEhaGaxPggpBbXj_I3rAsLwgUSNINxZGd8CRS9XYYtXx2zmrtn6MgYiHO4gQyplEmHF1enxIY_bu925k2UsySnJUnK5j3Nlc7pkKFmk9KNl80AiB6SEZAUXpJHWxd8FbiEnr6tZx6_UOjckGSXxua0keF7PSRK7G8Pb-gQvBcIPwIgheiy5LLvrvGEd60DI7xyPhD0GuJi2DHXCw3NdcmsUAb4pZeZCTeJFk')",
            filter: 'blur(2px) brightness(0.45) saturate(0.6)',
            transform: 'scale(1.05)',
          }}
        />
      )}

      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        <div className="flex-1 bg-black/70 backdrop-blur-[1px]" />
        <div className="flex">
          <div className="flex-1 bg-black/70 backdrop-blur-[1px] h-[300px]" />
          <div className="relative w-[300px] h-[300px] flex-shrink-0">
            {tab === 'qr' && (
              <>
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-xl" />
                <div
                  className="absolute top-0 left-0 w-full h-1 scan-line"
                  style={{ background: '#0058bc', boxShadow: '0 0 8px rgba(0,88,188,0.8)' }}
                />
              </>
            )}
          </div>
          <div className="flex-1 bg-black/70 backdrop-blur-[1px] h-[300px]" />
        </div>
        <div className="flex-1 bg-black/70 backdrop-blur-[1px]" />
      </div>

      <div className="absolute top-0 left-0 right-0 z-20 p-5">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
        </button>
      </div>

      <div className="absolute top-16 left-0 right-0 z-20 flex justify-center px-5 mt-4">
        <div className="flex bg-white/10 backdrop-blur-xl rounded-full p-1 border border-white/20">
          {[
            { key: 'qr', icon: 'qr_code_scanner', label: 'Scan QR' },
            { key: 'otp', icon: 'dialpad', label: 'Enter OTP' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setResult(null); setScannerError(''); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-label-md font-semibold transition-all duration-200 ${
                tab === key ? 'bg-white text-black shadow-sm' : 'text-white/70 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'qr' && (
        <>
          <div className="absolute top-1/4 left-0 right-0 z-20 text-center px-5 -mt-12">
            <p className="text-body-lg text-white mb-2">Scan QR Code</p>
            <p className="text-body-md text-white/70">Align the locker display QR code within the frame</p>
          </div>

          {!scannerReady && !scannerError && (
            <div className="absolute z-20 top-2/3 px-5 text-center text-label-md text-white/70 bg-black/40 py-3 rounded-xl backdrop-blur-md">
              Starting camera...
            </div>
          )}

          {scannerError && (
            <div className="absolute z-20 top-2/3 px-6 text-center text-xs text-red-100 bg-red-900/70 py-3 rounded-xl backdrop-blur-md max-w-xs border border-red-500/30">
              {scannerError}
            </div>
          )}

          {result && (
            <div className={`absolute z-20 px-5 py-3 rounded-xl text-body-md max-w-sm text-center ${
              result.success ? 'bottom-28 bg-green-500/20 text-green-200 border border-green-500/30' : 'bottom-28 bg-red-500/20 text-red-200 border border-red-500/30'
            }`}>
              {result.message}
            </div>
          )}

          <div className="absolute bottom-1/4 left-0 right-0 z-20 text-center flex flex-col items-center gap-2 mb-12 px-5">
            <div className="flex justify-center items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${submitting ? 'bg-yellow-300' : 'bg-secondary'} animate-pulse`} />
              <span className="text-label-md text-white uppercase tracking-widest">{submitting ? 'Processing...' : 'Scanning...'}</span>
            </div>
            {scannedText && <span className="text-xs text-white/50 max-w-xs truncate">{scannedText}</span>}
          </div>
        </>
      )}

      {tab === 'otp' && (
        <div className="absolute z-20 w-full max-w-sm px-6 flex flex-col items-center gap-6"
          style={{ top: '50%', transform: 'translateY(-50%)' }}>
          <div className="text-center">
            <p className="text-body-lg text-white font-semibold mb-1">Enter OTP Code</p>
            <p className="text-body-md text-white/70">Enter the 6-digit code shown on the locker display</p>
          </div>

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
            onClick={submitOtp}
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

          <p className="text-label-md text-white/50 text-center">OTP rotates every 30 seconds</p>
        </div>
      )}
    </div>
  );
}
