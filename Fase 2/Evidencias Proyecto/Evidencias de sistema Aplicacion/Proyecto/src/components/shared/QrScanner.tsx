"use client";
import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerProps {
  onResult: (decodedText: string) => void;
  onError?: (error: any) => void;
  id?: string;
  isLocked?: boolean;
}

export default function QrScanner({ onResult, onError, id = "qr-reader", isLocked = false }: QrScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scanLockRef = useRef<boolean>(false);

  // Sincronizar el bloqueo externo con la referencia interna
  useEffect(() => {
    scanLockRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    // Evitar inicialización duplicada
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        id,
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
        },
        false
      );

      scannerRef.current.render(
        (decodedText) => {
          // Bloqueo estricto anti-saturación: si ya se detectó un código, ignorar cuadros posteriores
          if (scanLockRef.current) {
            return;
          }
          scanLockRef.current = true;
          onResult(decodedText);
        },
        (errorMessage) => {
          if (onError) onError(errorMessage);
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(e => {
            // Ignorar errores benignos de desmonte rápido
            console.debug("Info clearing scanner:", e);
          });
        } catch (e) {
          console.debug("Catch on scanner cleanup:", e);
        }
        scannerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="w-full relative bg-black rounded-2xl overflow-hidden shadow-inner border border-surface-container-highest">
      <style>{`
        #${id} {
          width: 100%;
          border: none !important;
        }
        #${id}__scan_region {
          min-height: 200px;
        }
        #${id}__scan_region video {
          object-fit: cover !important;
          border-radius: 12px;
        }
        #${id}__dashboard {
          padding: 10px;
          background: #1E201D;
          color: white;
        }
        #${id}__dashboard a {
          color: #D4A72C;
        }
        #${id}__dashboard button {
          background-color: #D4A72C;
          color: #1E201D;
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          margin-top: 5px;
          font-size: 13px;
        }
      `}</style>
      <div id={id}></div>
    </div>
  );
}
