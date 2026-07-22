import { useRef } from "react";

import { PaperClipIcon } from "@heroicons/react/24/solid";

import { Button } from "../button";

export interface MessageInputProps {
  handleFiles: (files: FileList) => void;
}

const FileButton = ({ handleFiles }: MessageInputProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) handleFiles(files);
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        type='file'
        ref={fileInputRef}
        onChange={handleFileSelect}
        className='hidden'
        multiple
      />

      <Button
        plain
        onClick={handleFileClick}
        className='mr-1 flex-shrink-0 cursor-pointer'
        aria-label='Attach files'
        title={"Select files to upload"}
      >
        <PaperClipIcon />
      </Button>
    </>
  );
};

export default FileButton;
