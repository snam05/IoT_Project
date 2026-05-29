import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function QRScanner() {
  const navigate = useNavigate();
  const [flashOn, setFlashOn] = useState(false);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.5, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.5, 0.5));

  return (
    <div className="bg-primary text-on-primary h-screen w-screen overflow-hidden font-body-md relative flex flex-col items-center justify-center">
      {/* Camera Background */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAiO6yRIoEZUy0FrxtYWhhxxdgwoD5nZmECdx4plR3ThEhaGaxPggpBbXj_I3rAsLwgUSNINxZGd8CRS9XYYtXx2zmrtn6MgYiHO4gQyplEmHF1enxIY_bu925k2UsySnJUnK5j3Nlc7pkKFmk9KNl80AiB6SEZAUXpJHWxd8FbiEnr6tZx6_UOjckGSXxua0keF7PSRK7G8Pb-gQvBcIPwIgheiy5LLvrvGEd60DI7xyPhD0GuJi2DHXCw3NdcmsUAb4pZeZCTeJFk')",
          filter: 'blur(2px) brightness(0.6) saturate(0.5)',
        }}
      />

      {/* Dark overlay with cutout */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
        <div className="flex-1 bg-black/70 backdrop-blur-sm" />
        <div className="flex">
          <div className="flex-1 bg-black/70 backdrop-blur-sm h-[300px]" />
          {/* Scanning Frame */}
          <div className="relative w-[300px] h-[300px] flex-shrink-0">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-xl" />
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-xl" />
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-xl" />
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-xl" />
            <div className="absolute top-0 left-0 w-full h-1 scan-line" style={{ background: '#0058bc', boxShadow: '0 0 8px rgba(0,88,188,0.8)' }} />
          </div>
          <div className="flex-1 bg-black/70 backdrop-blur-sm h-[300px]" />
        </div>
        <div className="flex-1 bg-black/70 backdrop-blur-sm" />
      </div>

      {/* Close button */}
      <div className="absolute top-0 left-0 right-0 z-20 p-5">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-colors active:scale-95">
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
        </button>
      </div>

      {/* Instructions */}
      <div className="absolute top-1/4 left-0 right-0 z-20 text-center px-5 -mt-12">
        <p className="text-body-lg text-white mb-2">Scan QR Code</p>
        <p className="text-body-md text-white/70">Align the QR code within the frame to unlock the locker</p>
      </div>

      {/* Status */}
      <div className="absolute bottom-1/4 left-0 right-0 z-20 text-center flex justify-center items-center gap-2 mb-12">
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        <span className="text-label-md text-white uppercase tracking-widest">Scanning...</span>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-5 pb-12 flex justify-center gap-12 items-center">
        <button onClick={() => setFlashOn((f) => !f)} className={`w-14 h-14 rounded-full backdrop-blur-xl border flex items-center justify-center transition-all active:scale-95 ${flashOn ? 'bg-white text-black border-white' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
          <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{flashOn ? 'flash_on' : 'flash_off'}</span>
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
    </div>
  );
}
