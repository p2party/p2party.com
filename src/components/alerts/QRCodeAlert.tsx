import { useState, useEffect } from "react";

import { Alert, AlertActions, AlertTitle, AlertBody } from "../alert";
import { Button } from "../button";

import QRCode from "qrcode";

import type { Dispatch, SetStateAction } from "react";

export interface QRCodeAlertProps {
  roomUrl: string;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

const url = "https://p2party.com/";

const QRCodeAlert = ({ roomUrl, isOpen, setIsOpen }: QRCodeAlertProps) => {
  const [qrCodeDataUri, setQrCodeDataUri] = useState("");

  useEffect(() => {
    // Generate the QR code data URI from the parameter string
    QRCode.toDataURL(
      url + roomUrl,
      { margin: 1, width: 300, errorCorrectionLevel: "H" }, // Adjust size as needed
      (err, url) => {
        if (err) {
          console.error(err);
          return;
        }
        setQrCodeDataUri(url);
      },
    );
  }, [roomUrl]);

  const handleDownload = async () => {
    // Create an anchor element for the download
    const link = document.createElement("a");
    link.href = qrCodeDataUri;
    link.download = "qr-" + roomUrl + ".png"; // Replace with your desired file name and extension

    // Append the anchor to the body, trigger click, then remove it
    document.body.appendChild(link);
    link.addEventListener("click", async () => {
      document.body.removeChild(link);
      link.removeEventListener("click", () => {});
    });

    link.click();

    setIsOpen(false);
  };

  return (
    <Alert open={isOpen} onClose={setIsOpen} size='lg'>
      <AlertTitle>P2Party room URL</AlertTitle>
      <AlertBody>
        <img
          src={qrCodeDataUri}
          alt='QR Code Avatar'
          className='w-60 select-none border-0'
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
