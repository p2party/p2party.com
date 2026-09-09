import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

import QRCode from "qrcode";

import { Alert, AlertActions, AlertTitle, AlertBody } from "../alert";
import { Button } from "../button";
import { coverModeSummary, roomPqModeParameterSet } from "../../protocol/v4";

import type { Dispatch, SetStateAction } from "react";
import type { RoomPolicyV1 } from "p2party";

export interface QRCodeAlertProps {
  inviteUrl: string;
  roomPolicy: RoomPolicyV1;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const drawCanvas = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  qrCanvas: HTMLCanvasElement,
  logoImage: HTMLImageElement,
) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#eb5e28");
  gradient.addColorStop(1, "#252422");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const qrSize = canvas.width * 0.96;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = (canvas.height - qrSize) / 2;
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

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

const loadImage = (src: string, label: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${label}`));
    image.src = src;
  });

const QRCodeAlert = ({
  inviteUrl,
  roomPolicy,
  isOpen,
  setIsOpen,
}: QRCodeAlertProps) => {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [qrResult, setQrResult] = useState<{
    canvas: HTMLCanvasElement;
    inviteUrl: string;
    status: "ready" | "error";
  } | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const downloadGeneration = useRef(0);
  const [copyResult, setCopyResult] = useState({ inviteUrl: "", value: "" });
  const copyStatus = copyResult.inviteUrl === inviteUrl ? copyResult.value : "";
  const qrStatus =
    isOpen && qrResult?.canvas === canvas && qrResult?.inviteUrl === inviteUrl
      ? qrResult.status
      : "loading";

  useEffect(() => {
    // The dialog mounts its portal after opening. A callback ref makes the
    // effect follow the actual canvas instead of racing the portal mount.
    if (!isOpen || !canvas || inviteUrl.length === 0) return;
    const downloads = downloadGeneration;
    let cancelled = false;
    let ctx: CanvasRenderingContext2D | null = null;
    void (async () => {
      try {
        ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is unavailable");

        // Display needs drawing only. Exporting an intermediate PNG would
        // unnecessarily require Firefox's canvas-extraction permission before
        // the invitation can be shown; readback belongs to Download QR.
        const qrCanvas = document.createElement("canvas");
        const [, logoImage] = await Promise.all([
          QRCode.toCanvas(qrCanvas, inviteUrl, {
            margin: 4,
            width: 1024,
            errorCorrectionLevel: "H",
            color: { dark: "#eb5e28", light: "#fff" },
          }),
          loadImage("/logo-cat.svg", "room logo"),
        ]);
        if (!cancelled) {
          drawCanvas(canvas, ctx, qrCanvas, logoImage);
          setQrResult({ canvas, inviteUrl, status: "ready" });
        }
      } catch {
        if (!cancelled) setQrResult({ canvas, inviteUrl, status: "error" });
      }
    })();

    return () => {
      cancelled = true;
      downloads.current++;
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [canvas, inviteUrl, isOpen]);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyResult({ inviteUrl, value: `${label} copied` });
    } catch {
      setCopyResult({
        inviteUrl,
        value: `Could not copy ${label.toLowerCase()}`,
      });
    }
  };

  const handleDownload = async () => {
    if (!canvas || qrStatus !== "ready") return;
    const generation = ++downloadGeneration.current;
    setDownloadError("");
    try {
      const png = canvas.toDataURL("image/png");
      if (Capacitor.getPlatform() === "web") {
        const link = document.createElement("a");
        link.href = png;
        link.download = "p2party-room-invite.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else {
        await Filesystem.writeFile({
          path: "p2party/room-invite.png",
          data: png.split(";base64,")[1],
          directory: Directory.Documents,
          recursive: true,
        });
      }
      if (generation === downloadGeneration.current) close();
    } catch {
      if (generation === downloadGeneration.current) {
        setDownloadError(
          "Could not download the QR code. You can still copy the link.",
        );
      }
    }
  };

  const close = () => {
    downloadGeneration.current++;
    setCopyResult({ inviteUrl: "", value: "" });
    setQrResult(null);
    setDownloadError("");
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (open) setIsOpen(true);
    else close();
  };

  return (
    <Alert open={isOpen} onClose={handleOpenChange} size='lg'>
      <AlertTitle>Share this room</AlertTitle>
      <AlertBody>
        <div className='flex justify-center'>
          <canvas
            ref={setCanvas}
            role='img'
            aria-label='Room invitation QR code'
            className='w-64 border-0 select-none'
            width={1024}
            height={1024}
            style={{ width: "16rem", height: "16rem" }}
          />
        </div>
        {qrStatus === "loading" && <p role='status'>Creating QR code…</p>}
        {(qrStatus === "error" || downloadError) && (
          <p role='alert'>
            {qrStatus === "error"
              ? "Could not create the QR code. You can still copy the link."
              : downloadError}
          </p>
        )}
        <p className='mt-4 font-mono text-xs text-zinc-600 dark:text-zinc-300'>
          ML-KEM-{roomPqModeParameterSet(roomPolicy.pqMode)} ·{" "}
          {roomPolicy.authMode === "pin" ? "PIN required" : "no room PIN"} ·{" "}
          {coverModeSummary(roomPolicy)}
        </p>
        <p className='mt-2 text-xs text-zinc-500 dark:text-zinc-400'>
          The link keeps the capability after <code>#</code>, so it stays out of
          request lines and server logs. Communicate a PIN separately.
        </p>
        <p aria-live='polite' className='mt-2 min-h-4 font-mono text-xs'>
          {copyStatus}
        </p>
      </AlertBody>
      <AlertActions className='sm:flex-wrap'>
        <Button plain onClick={close}>
          Close
        </Button>
        <Button plain onClick={handleDownload} disabled={qrStatus !== "ready"}>
          Download QR
        </Button>
        <Button color='orange' onClick={() => copy("Link", inviteUrl)}>
          Copy link
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default QRCodeAlert;
