import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

import { Alert, AlertActions, AlertTitle, AlertBody } from "../alert";
import { Button } from "../button";

import QRCode from "qrcode";
// import QrCodeWithLogo from 'qrcode-with-logos'

import type { Dispatch, SetStateAction } from "react";

export interface QRCodeAlertProps {
  roomUrl: string;
  inviteUrl: string;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const QRCodeAlert = ({
  roomUrl,
  inviteUrl,
  isOpen,
  setIsOpen,
}: QRCodeAlertProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawCanvas = (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    qrImage: HTMLImageElement,
    logoImage: HTMLImageElement,
  ) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // **Fix Gradient**: Apply gradient before drawing QR
    const gradient = ctx.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    gradient.addColorStop(0, "#eb5e28");
    gradient.addColorStop(1, "#252422");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the QR code (leave some margin for the gradient effect)
    const qrSize = canvas.width * 0.96;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = (canvas.height - qrSize) / 2;
    ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    // Draw the logo in center (smaller than before)
    const center = canvas.width / 2;
    const logoSize = canvas.width * 0.5;
    ctx.drawImage(
      logoImage,
      center - logoSize / 2,
      center - logoSize / 2,
      logoSize,
      logoSize,
    );
  };

  useEffect(() => {
    // If modal is closed, don’t bother drawing
    if (!isOpen || !roomUrl || roomUrl.length !== 64) return;

    setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return; // Ensure canvas exists
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        // 1️⃣ Generate QR Code
        const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
          margin: 0.4,
          width: 1024,
          errorCorrectionLevel: "H",
          color: {
            dark: "#eb5e28",
            light: "#fff",
          },
        });

        // 2️⃣ Load both images and wait for them to fully load
        const qrImage = new Image();
        const logoImage = new Image();
        qrImage.crossOrigin = "anonymous";
        logoImage.crossOrigin = "anonymous";

        qrImage.src = qrDataUrl;
        logoImage.src = "/logo-cat.svg"; // Ensure this exists in `/public/`

        await Promise.all([
          new Promise((resolve) => (qrImage.onload = resolve)),
          new Promise((resolve) => (logoImage.onload = resolve)),
        ]);

        // 3️⃣ Draw everything
        drawCanvas(canvas, ctx, qrImage, logoImage);
      } catch (error) {
        console.error("QR Code Generation Error:", error);
      }
    }, 100); // Wait 50ms to ensure canvas is attached
  }, [inviteUrl, roomUrl, isOpen]);

  const handleDownload = async () => {
    if (canvasRef.current) {
      if (Capacitor.getPlatform() === "web") {
        // Create an anchor element for the download
        const link = document.createElement("a");
        link.href = canvasRef.current.toDataURL("image/png"); // qrCodeDataUri;
        link.download = "qr-" + roomUrl + ".png"; // Replace with your desired file name and extension

        // Append the anchor to the body, trigger click, then remove it
        document.body.appendChild(link);
        link.addEventListener("click", () => {
          document.body.removeChild(link);
          link.removeEventListener("click", () => {});
        });

        link.click();
      } else {
        const data = canvasRef.current
          .toDataURL("image/png")
          .split(";base64,")[1];
        const path = `p2party/${roomUrl}/roomQR.png`;
        return await Filesystem.writeFile({
          path,
          data,
          directory: Directory.Documents,
          recursive: true,
        });
      }
    }

    setIsOpen(false);
  };

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='md'>
      <AlertTitle>Scan the room URL</AlertTitle>
      <AlertBody>
        <canvas
          ref={canvasRef}
          className={`w-64 border-0 select-none`}
          width={1024}
          height={1024}
          style={{ width: "16rem", height: "16rem" }}
        />
      </AlertBody>
      <AlertActions>
        <Button plain onClick={() => setIsOpen(false)}>
          Close
        </Button>
        <Button plain onClick={handleDownload}>
          Download
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default QRCodeAlert;
