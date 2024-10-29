import clsx from "clsx";

import { Avatar } from "../avatar";

export interface CatAvatarProps {
  className?: string;
}

const CatAvatar = ({ className }: CatAvatarProps) => {
  return (
    <Avatar
      src={"/logo-cat.svg"}
      className={clsx("select-none border-0 outline-0", className)}
    />
  );
};

export default CatAvatar;
