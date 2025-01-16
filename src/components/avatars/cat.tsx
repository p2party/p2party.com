import clsx from "clsx";

import { Avatar } from "../avatar";

export interface CatAvatarProps {
  className?: string;
}

const CatAvatar = ({ className }: CatAvatarProps) => {
  return (
    <Avatar
      src={"/logo-cat.svg"}
      className={clsx("select-none !border-none !outline-none", className)}
    />
  );
};

export default CatAvatar;
