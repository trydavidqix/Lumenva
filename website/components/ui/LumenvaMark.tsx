export interface LumenvaMarkProps {
  readonly size?: number;
  readonly className?: string;
}

export function LumenvaMark({ className, size = 24 }: Readonly<LumenvaMarkProps>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 3.5L14 3.5 14 15.5 20 15.5 20 20.5 8 20.5Z"
        fill="currentColor"
      />
      <path
        d="M4 9.5V20.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
      <path
        d="M6.5 8L6.5 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}
