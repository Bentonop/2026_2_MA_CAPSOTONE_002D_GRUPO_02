"use client";
import { useEffect, useId, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerProps {
  onResult: (decodedText: string) => void;
  onError?: (error: string) => void;
  id?: string;
  isLocked?: boolean;
}

const scannerCleanups = new Map<string, Promise<void>>();

export default function QrScanner({ onResult, onError, id = "qr-reader", isLocked = false }: QrScannerProps) {
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const readerId = `${id}-${instanceId}`;
  const callbacksRef = useRef({ onResult, onError });
  const scanLockRef = useRef(false);

  useEffect(() => {
    callbacksRef.current = { onResult, onError };
  }, [onResult, onError]);

  useEffect(() => {
    scanLockRef.current = isLocked;
  }, [isLocked]);

  useEffect(() => {
    let disposed = false;
    let scanner: Html5QrcodeScanner | undefined;

    const ready = (scannerCleanups.get(id) ?? Promise.resolve()).then(() => {
      if (disposed) return;
      scanner = new Html5QrcodeScanner(readerId, {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      }, false);

      scanner.render(
        (decodedText) => {
          if (disposed || scanLockRef.current) return;
          scanLockRef.current = true;
          callbacksRef.current.onResult(decodedText);
        },
        (message) => {
          if (!disposed) callbacksRef.current.onError?.(message);
        }
      );
    }).catch((error: unknown) => {
      console.error("No se pudo iniciar el escáner:", error);
    });

    return () => {
      disposed = true;
      const cleanup = ready.then(async () => {
        await scanner?.clear();
      }).catch((error: unknown) => {
        console.debug("No se pudo limpiar el escáner:", error);
      }).finally(() => {
        if (scannerCleanups.get(id) === cleanup) scannerCleanups.delete(id);
      });
      scannerCleanups.set(id, cleanup);
    };
  }, [id, readerId]);

  return (
    <div className="w-full relative bg-black rounded-2xl overflow-hidden shadow-inner border border-surface-container-highest">
      <style>{`
        #${readerId} {
          width: 100%;
          border: none !important;
        }
        #${readerId}__scan_region {
          min-height: 200px;
        }
        #${readerId}__scan_region video {
          object-fit: cover !important;
          border-radius: 12px;
        }
        #${readerId}__dashboard {
          padding: 10px;
          background: #1E201D;
          color: white;
        }
        #${readerId}__dashboard a {
          color: #D4A72C;
        }
        #${readerId}__dashboard button {
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
      <div id={readerId}></div>
    </div>
  );
}
