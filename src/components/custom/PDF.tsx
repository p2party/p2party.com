import { useMemo, useEffect } from "react";
import { DocumentIcon } from "@heroicons/react/24/solid";

import { Text } from "../text";
import { Button } from "../button";

import type { FileExtension, MimeType } from "p2party";

const PDF = ({
  blob,
  filename,
  extension,
  percentage,
  className,
}: {
  blob: Blob;
  filename?: string;
  extension?: FileExtension;
  mimeType?: MimeType;
  percentage: number;
  className?: string;
}) => {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ""), [blob]);

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
      className={`relative flex w-full cursor-pointer flex-col items-center justify-center ${className}`}
      onClick={handleClick}
    >
      <div className='flex w-full items-center justify-between px-2'>
        <Text className='grow text-left'>
          {truncateFilename(`${filename}.${extension}`, 20)}
        </Text>
        <DocumentIcon className='h-6 w-6 text-gray-500' />
      </div>
    </Button>
  );
};

export default PDF;
