import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

import p2party from "p2party";
import QRCode from "qrcode";

import { Alert, AlertActions, AlertTitle, AlertBody } from "../alert";
import { Button } from "../button";
import { coverModeSummary, roomPqModeParameterSet } from "../../protocol/v4";

import type { Dispatch, SetStateAction } from "react";
import type { RoomPolicyV1 } from "p2party";

export interface QRCodeAlertProps {
  roomUrl: string;
  inviteUrl: string;
  roomPolicy: RoomPolicyV1;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const drawCanvas = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  qrImage: HTMLImageElement,
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
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

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
  roomUrl,
  inviteUrl,
  roomPolicy,
  isOpen,
  setIsOpen,
}: QRCodeAlertProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wordInvite, setWordInvite] = useState({ roomUrl: "", value: "" });
  const [copyResult, setCopyResult] = useState({ inviteUrl: "", value: "" });
  const words = wordInvite.roomUrl === roomUrl ? wordInvite.value : "";
  const copyStatus = copyResult.inviteUrl === inviteUrl ? copyResult.value : "";

  useEffect(() => {
    if (!isOpen || roomUrl.length === 0) return;
    let cancelled = false;
    const capability = p2party.decodeRoomCapability(roomUrl);
    void p2party
      .encodeRoomCapabilityWords(capability)
      .then((encoded) => {
        if (!cancelled) setWordInvite({ roomUrl, value: encoded });
      })
      .catch((cause) => console.error("Room word encoding error:", cause))
      .finally(() => capability.fill(0));
    return () => {
      cancelled = true;
    };
  }, [isOpen, roomUrl]);

  useEffect(() => {
    if (!isOpen || inviteUrl.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        try {
          const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
            margin: 0.4,
            width: 1024,
            errorCorrectionLevel: "H",
            color: { dark: "#eb5e28", light: "#fff" },
          });
          const [qrImage, logoImage] = await Promise.all([
            loadImage(qrDataUrl, "QR image"),
            loadImage("/logo-cat.svg", "room logo"),
          ]);
          if (!cancelled) drawCanvas(canvas, ctx, qrImage, logoImage);
        } catch (cause) {
          if (!cancelled) console.error("QR code generation error:", cause);
        }
      })();
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [inviteUrl, isOpen]);

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
    if (!canvasRef.current) return;
    if (Capacitor.getPlatform() === "web") {
      const link = document.createElement("a");
      link.href = canvasRef.current.toDataURL("image/png");
      link.download = "p2party-room-invite.png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      const data = canvasRef.current
        .toDataURL("image/png")
        .split(";base64,")[1];
      await Filesystem.writeFile({
        path: "p2party/room-invite.png",
        data,
        directory: Directory.Documents,
        recursive: true,
      });
    }
    close();
  };

  const close = () => {
    setWordInvite({ roomUrl: "", value: "" });
    setCopyResult({ inviteUrl: "", value: "" });
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
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
            ref={canvasRef}
            className='w-64 border-0 select-none'
            width={1024}
            height={1024}
            style={{ width: "16rem", height: "16rem" }}
          />
        </div>
        <p className='mt-4 font-mono text-xs text-zinc-600 dark:text-zinc-300'>
          ML-KEM-{roomPqModeParameterSet(roomPolicy.pqMode)} ·{" "}
          {roomPolicy.authMode === "pin" ? "PIN required" : "no room PIN"} ·{" "}
          {coverModeSummary(roomPolicy)}
        </p>
        <label
          htmlFor='room-invite-words-copy'
          className='mt-3 block font-mono text-xs font-bold text-zinc-950 dark:text-white'
        >
          24-word human invitation
        </label>
        <textarea
          id='room-invite-words-copy'
          readOnly
          rows={4}
          value={words}
          className='mt-1 block w-full resize-none rounded-lg border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100'
        />
        <p className='mt-2 text-xs text-zinc-500 dark:text-zinc-400'>
          The link keeps the capability after <code>#</code>. The words encode
          the same 256-bit capability and never enter the URL. Communicate a PIN
          separately.
        </p>
        <p aria-live='polite' className='mt-2 min-h-4 font-mono text-xs'>
          {copyStatus}
        </p>
      </AlertBody>
      <AlertActions className='sm:flex-wrap'>
        <Button plain onClick={close}>
          Close
        </Button>
        <Button plain onClick={handleDownload}>
          Download QR
        </Button>
        <Button outline onClick={() => copy("Link", inviteUrl)}>
          Copy link
        </Button>
        <Button
          color='orange'
          onClick={() => copy("24 words", words)}
          disabled={words.length === 0}
        >
          Copy 24 words
        </Button>
      </AlertActions>
    </Alert>
  );
};

export default QRCodeAlert;
