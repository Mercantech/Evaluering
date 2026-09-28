'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

type ShareQrProps = {
  url: string;
  code: string;
  size?: number;
  showDownload?: boolean;
};

export function ShareQr({
  url,
  code,
  size = 280,
  showDownload = false,
}: ShareQrProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f5c45',
        light: '#f7faf8',
      },
    })
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  function downloadQr() {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `eval-platform-${code}.png`;
    link.click();
  }

  return (
    <div className="qr-card">
      <div className="qr-frame">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={`QR ${code}`}
            style={{ width: size * 0.72, height: size * 0.72 }}
          />
        ) : (
          <div
            className="qr-placeholder muted"
            style={{ width: size * 0.72, height: size * 0.72 }}
          />
        )}
      </div>
      {showDownload ? (
        <button
          className="btn ghost"
          type="button"
          onClick={downloadQr}
          disabled={!dataUrl}
        >
          Download
        </button>
      ) : null}
    </div>
  );
}
