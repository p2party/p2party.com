import { useMemo, useEffect } from "react";

import { Button } from "../button";
import { Text } from "../text";

import type { FileExtension, MimeType } from "p2party";

const Image = ({
  blob,
  filename,
  extension,
  percentage,
  className,
}: {
  blob: Blob;
  filename?: string;
  extension?: FileExtension;
  percentage: number;
  mimeType?: MimeType;
  className?: string;
}) => {
  const url = useMemo(
    () => (blob && percentage === 100 ? URL.createObjectURL(blob) : ""),
    [blob, percentage],
  );

  useEffect(() => {
    return () => {
      if (url.length > 0) URL.revokeObjectURL(url);
    };
  }, [url]);

  const truncateFilename = (filename: string, maxLength: number) => {
    if (filename.length <= maxLength) return filename;
    const half = Math.floor((maxLength - 3) / 2); // Reserve space for "..."
    return `${filename.slice(0, half)}...${filename.slice(-half)}`;
  };

  const handleClick = () => {
    if (percentage === 100) window.open(url);
  };

  return (
    <Button
      plain
      className={`flex w-full cursor-pointer flex-col items-center justify-center ${className}`}
      onClick={handleClick}
    >
      <img
        src={url}
        alt={filename}
        className={`${className} h-16 w-16 object-contain`}
      />

      <Text className='mt-2 text-center'>
        {truncateFilename(`${filename}.${extension}`, 20)}
      </Text>
    </Button>
  );
};

export default Image;
