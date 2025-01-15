"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import clsx from "clsx";

import { Avatar } from "../avatar"; // Adjust the import path

export interface Params {
  src: string;
  className?: string;
}

export const QRCodeAvatar = ({ src, className }: Params) => {
  const [qrCodeDataUri, setQrCodeDataUri] = useState("");

  useEffect(() => {
    // Generate the QR code data URI from the parameter string
    QRCode.toDataURL(
      src,
      { margin: 0, width: 100, errorCorrectionLevel: "H" }, // Adjust size as needed
      (err, url) => {
        if (err) {
          console.error(err);
          return;
        }
        setQrCodeDataUri(url);
      },
    );
  }, [src]);

  return (
    <Avatar
      src={qrCodeDataUri}
      square={true} // Makes the avatar a rounded rectangle
      alt='QR Code Avatar'
      className={clsx(className, "select-none border border-2 border-light")} // Custom border and rounded corners
    />
  );
};
