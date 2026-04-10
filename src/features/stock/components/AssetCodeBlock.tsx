import { useEffect, useRef } from "react";
import QRCode from "react-qr-code";
import JsBarcode from "jsbarcode";

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
        lineColor: "#ffffff",
        width: 2,
        height: 60,
        displayValue: true,
        background: "transparent",
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
          <QRCode value={qrValue} size={140} />
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
