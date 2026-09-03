import Image from "next/image";

export interface LumenvaMarkProps {
  readonly size?: number;
  readonly className?: string;
  readonly priority?: boolean;
}

const NATURAL_ASPECT_RATIO = 256 / 171;

export function LumenvaMark({ className, priority = false, size = 24 }: Readonly<LumenvaMarkProps>) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={className}
      height={size}
      priority={priority}
      src="/brand/lumenva-mark.webp"
      width={Math.round(size * NATURAL_ASPECT_RATIO)}
    />
  );
}
