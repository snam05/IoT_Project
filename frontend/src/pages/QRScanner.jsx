import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import jsQR from 'jsqr';

function requestFromParams(params) {
  const code = params.get('code') || params.get('otp');
  const lockerId = params.get('lockerId') || params.get('locker');
  const cabinetCode = params.get('cabinetCode') || params.get('cabinet');
  const compartmentNo = params.get('compartmentNo') || params.get('compartment');

  if (lockerId) return { method: 'qr', lockerId: lockerId.trim().toUpperCase(), ...(code ? { code: code.trim() } : {}) };
  if (cabinetCode && compartmentNo && code) return { method: 'qr', lockerId: `${cabinetCode.trim().toUpperCase()}:${compartmentNo.trim()}`, code: code.trim() };
  if (cabinetCode && code) return { method: 'qr', lockerId: `${cabinetCode.trim().toUpperCase()}:${code.trim()}` };
  if (code && /^\d{6}$/.test(code.trim())) return { method: 'otp', code: code.trim() };
  return null;
}

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
    const request = requestFromParams(url.searchParams) || fromObject(Object.fromEntries(url.searchParams.entries()));
    if (request) return request;
  } catch {
    // Not an absolute URL.
  }

  if (value.startsWith('/')) {
    try {
      const url = new URL(value, window.location.origin);
      const request = requestFromParams(url.searchParams) || fromObject(Object.fromEntries(url.searchParams.entries()));
      if (request) return request;
    } catch {
      // Not a relative app URL.
    }
  }

  if (value.includes('?')) {
    const [, queryString] = value.split('?');
    const request = requestFromParams(new URLSearchParams(queryString));
    if (request) return request;
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

function cameraErrorMessage(err) {
  const name = err?.name || '';
  const detail = ` (${window.location.protocol}//${window.location.host}, secure=${window.isSecureContext ? 'yes' : 'no'})`;
  if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `Camera requires HTTPS. Open this page with https:// and allow camera permission.${detail}`;
  }
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return `Camera permission was blocked. Allow camera access in browser settings, then tap Start camera.${detail}`;
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return `No camera was found on this device.${detail}`;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `Camera is already being used by another app. Close it, then tap Start camera.${detail}`;
  }
  if (err?.message === 'MEDIA_DEVICES_UNAVAILABLE') {
    return `This browser does not expose the camera API. Use HTTPS, localhost, or Scan image.${detail}`;
  }
  return `Could not start camera. Allow camera permission, use HTTPS, then tap Start camera.${detail}`;
}

export default function QRScanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialRequestRef = useRef(null);
  const initialRequest = requestFromParams(new URLSearchParams(location.search));
  initialRequestRef.current ??= initialRequest;
  const [tab, setTab] = useState(() => (
    initialRequest || new URLSearchParams(location.search).get('tab') === 'otp' ? 'otp' : 'qr'
  ));
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [scannerError, setScannerError] = useState('');
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerStarting, setScannerStarting] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const otpRefs = useRef([]);
  const fileInputRef = useRef(null);
  const scannerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const lastScanAtRef = useRef(0);
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

  useEffect(() => {
    const request = initialRequestRef.current;
    if (!request || scanLockedRef.current) return;
    scanLockedRef.current = true;
    if (request.code && /^\d{6}$/.test(request.code)) {
      setOtpDigits(request.code.split(''));
    }
    setScannedText(new URLSearchParams(location.search).toString());
    submitUnlock(request);
    initialRequestRef.current = null;
  }, [location.search, submitUnlock]);

  const handleDecodedQr = useCallback((decodedText) => {
    if (scanLockedRef.current) return;

    const request = buildQrRequest(decodedText);
    if (!request) {
      setResult({ success: false, message: 'Invalid QR payload' });
      return;
    }

    scanLockedRef.current = true;
    setScannedText(decodedText);
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastScanAtRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScannerReady(false);
    setHasTorch(false);
    setTorchOn(false);

    const scanner = scannerRef.current;
    if (scanner) {
      scanner.stop().catch(() => {}).finally(() => submitUnlock(request));
      return;
    }

    submitUnlock(request);
  }, [submitUnlock]);

  const toggleTorch = useCallback(async () => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      }
    } catch (err) {
      console.error('Failed to toggle torch:', err);
    }
  }, [torchOn]);

  const clearScannerRuntime = useCallback(async () => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    lastScanAtRef.current = 0;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;

    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      await scanner.stop();
    } catch {
      // Scanner may not be running yet.
    }
    try {
      await scanner.clear();
    } catch {
      // Ignore cleanup failures from partially-started scanners.
    }
  }, []);

  const stopScanner = useCallback(async () => {
    await clearScannerRuntime();
    setScannerReady(false);
    setHasTorch(false);
    setTorchOn(false);
  }, [clearScannerRuntime]);

  const startCamera = useCallback(async () => {
    if (tab !== 'qr') return;

    await stopScanner();
    scanLockedRef.current = false;
    setScannerReady(false);
    setScannerStarting(true);
    setScannerError('');
    setHasTorch(false);
    setTorchOn(false);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('MEDIA_DEVICES_UNAVAILABLE');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error('VIDEO_ELEMENT_UNAVAILABLE');
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      await video.play();

      setScannerReady(true);
      setScannerStarting(false);

      const track = stream.getVideoTracks()[0];
      if (track?.getCapabilities?.()?.torch) setHasTorch(true);

      const scanFrame = async () => {
        if (!videoRef.current || !canvasRef.current || scanLockedRef.current) return;

        const activeVideo = videoRef.current;
        const now = performance.now();
        if (
          activeVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          && activeVideo.videoWidth > 0
          && now - lastScanAtRef.current >= 120
        ) {
          lastScanAtRef.current = now;
          const canvas = canvasRef.current;
          const scale = Math.min(1, 720 / activeVideo.videoWidth);
          canvas.width = Math.max(1, Math.floor(activeVideo.videoWidth * scale));
          canvas.height = Math.max(1, Math.floor(activeVideo.videoHeight * scale));
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) {
            frameRef.current = requestAnimationFrame(scanFrame);
            return;
          }
          context.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);
          try {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'attemptBoth',
            });
            if (code?.data) {
              handleDecodedQr(code.data);
              return;
            }
          } catch (err) {
            console.warn('[qr detector]', err);
          }
        }

        frameRef.current = requestAnimationFrame(scanFrame);
      };
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch (err) {
      console.error('[qr scanner]', err);
      await stopScanner();
      setScannerReady(false);
      setScannerStarting(false);
      setScannerError(cameraErrorMessage(err));
    }
  }, [handleDecodedQr, stopScanner, tab]);

  const scanQrImage = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setResult(null);
      setScannerError('');
      setScannedText(file.name);
      await stopScanner();
      const imageScanner = new Html5Qrcode('qr-file-reader', false);
      try {
        const decodedText = await imageScanner.scanFile(file, false);
        handleDecodedQr(decodedText);
      } finally {
        await imageScanner.clear().catch(() => {});
      }
    } catch (err) {
      console.error('[qr image scanner]', err);
      setResult({ success: false, message: 'Could not read QR from this image. Try a clearer photo.' });
    }
  }, [handleDecodedQr, stopScanner]);

  useEffect(() => {
    if (tab !== 'qr') {
      clearScannerRuntime();
    }
    return () => {
      clearScannerRuntime();
    };
  }, [clearScannerRuntime, tab]);

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

      <div 
        id="qr-reader" 
        className="absolute inset-0 z-0 bg-black" 
        style={{ display: tab === 'qr' ? 'block' : 'none' }}
      >
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div id="qr-file-reader" className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={scanQrImage}
        className="hidden"
      />

      {tab === 'otp' && (
        <div className="absolute inset-0 z-0 bg-black" />
      )}

      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        <div className="flex-1 bg-black/45" />
        <div className="flex">
          <div className="flex-1 bg-black/45 h-[300px]" />
          <div className="relative w-[300px] h-[300px] flex-shrink-0">
            {tab === 'qr' && (
              <>
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-[#00f0ff] rounded-tl-xl filter drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-[#00f0ff] rounded-tr-xl filter drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-[#00f0ff] rounded-bl-xl filter drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-[#00f0ff] rounded-br-xl filter drop-shadow-[0_0_6px_rgba(0,240,255,0.6)]" />
                <div
                  className="absolute top-0 left-0 w-full h-1 scan-line"
                  style={{ background: '#00f0ff', boxShadow: '0 0 12px rgba(0,240,255,0.9)' }}
                />
              </>
            )}
          </div>
          <div className="flex-1 bg-black/45 h-[300px]" />
        </div>
        <div className="flex-1 bg-black/45" />
      </div>

      <div className="absolute top-0 left-0 right-0 z-20 p-5 flex justify-between items-center">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors active:scale-95"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
        </button>

        {tab === 'qr' && hasTorch && (
          <button
            onClick={toggleTorch}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
              torchOn ? 'bg-yellow-400 text-black shadow-[0_0_15px_rgba(250,204,21,0.6)]' : 'bg-white/20 backdrop-blur-md text-white hover:bg-white/30'
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
              {torchOn ? 'flashlight_off' : 'flashlight_on'}
            </span>
          </button>
        )}
      </div>

      <div className="absolute top-16 left-0 right-0 z-20 flex justify-center px-5 mt-4">
        <div className="flex bg-white/10 backdrop-blur-xl rounded-full p-1 border border-white/20">
          {[
            { key: 'qr', icon: 'qr_code_scanner', label: 'Scan QR' },
            { key: 'otp', icon: 'dialpad', label: 'Enter OTP' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              onClick={() => {
                if (key !== tab) stopScanner();
                setTab(key);
                setResult(null);
                setScannerError('');
                setOtpDigits(['', '', '', '', '', '']);
              }}
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

          {!scannerReady && (
            <div className="absolute z-20 top-2/3 px-5 text-center text-label-md text-white/80 bg-black/50 py-4 rounded-xl backdrop-blur-md max-w-xs border border-white/10">
              <div className="mb-3">{scannerError || (scannerStarting ? 'Starting camera...' : 'Camera is not running')}</div>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 rounded-lg bg-white text-black text-label-md font-semibold active:scale-95 transition-all"
              >
                Start camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 px-4 py-2 rounded-lg border border-white/30 text-white text-label-md font-semibold active:scale-95 transition-all"
              >
                Scan image
              </button>
            </div>
          )}

          {result && (
            <div className={`absolute z-20 px-5 py-3 rounded-xl text-body-md max-w-sm text-center ${
              result.success ? 'bottom-28 bg-green-500/20 text-green-200 border border-green-500/30' : 'bottom-28 bg-red-500/20 text-red-200 border border-red-500/30'
            }`}>
              {result.message}
            </div>
          )}

          {scannerReady && scannerError && (
            <div className="absolute z-20 bottom-28 px-5 py-3 rounded-xl text-body-md max-w-sm text-center bg-yellow-500/20 text-yellow-100 border border-yellow-400/30">
              {scannerError}
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
