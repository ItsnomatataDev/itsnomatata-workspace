import { useEffect, useRef, type ComponentType } from "react";
import ReactQRCode from "react-qr-code";
import JsBarcode from "jsbarcode";

type QRCodeProps = {
  value: string;
  size?: number;
  bgColor?: string;
  fgColor?: string;
  level?: "L" | "M" | "Q" | "H";
};

const qrCodeModule = ReactQRCode as unknown as {
  QRCode?: ComponentType<QRCodeProps>;
  default?: ComponentType<QRCodeProps>;
};

const QRCodeComponent = qrCodeModule.QRCode ?? qrCodeModule.default;

export default function AssetCodeBlock({
  assetTag,
  assetId,
}: {
  assetTag: string;
  assetId: string;
}) {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!barcodeRef.current || !assetTag) return;

    try {
      JsBarcode(barcodeRef.current, assetTag, {
        format: "CODE128",
        lineColor: "#000000",
        width: 2,
        height: 60,
        displayValue: true,
        background: "#ffffff",
      });
    } catch (error) {
      console.error("Failed to generate barcode:", error);
    }
  }, [assetTag]);

  const qrValue = `${window.location.origin}/assets/${assetId}`;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="border border-white/10 bg-black p-4">
        <p className="mb-3 text-sm text-zinc-400">QR Code</p>
        <div className="inline-block bg-white p-3">
          {QRCodeComponent ? (
            <QRCodeComponent value={qrValue} size={140} />
          ) : (
            <p className="text-sm text-black">QR code unavailable</p>
          )}
        </div>
      </div>

      <div className="border border-white/10 bg-black p-4">
        <p className="mb-3 text-sm text-zinc-400">Barcode</p>
        <div className="overflow-x-auto bg-white p-3">
          <svg ref={barcodeRef} />
        </div>
      </div>
    </div>
  );
}
