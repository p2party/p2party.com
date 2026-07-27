import clsx from "clsx";

import { Avatar } from "../avatar";

export interface CatAvatarProps {
  className?: string;
  /**
   * The full logo has generous whitespace around the cat, which reads well as
   * a large watermark and turns into an indistinct smudge at 24px. The tight
   * crop exists for the small sizes.
   */
  src?: string;
}

const CatAvatar = ({ className, src = "/logo-cat.svg" }: CatAvatarProps) => {
  return (
    <Avatar
      src={src}
      className={clsx("!border-none !outline-none select-none", className)}
    />
  );
};

export default CatAvatar;
