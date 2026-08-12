import { useId, type SVGProps } from "react";

export type GoogleAppIconProps = SVGProps<SVGSVGElement> & { size?: number };

export function GoogleCalendarIcon({ size = 20, ...props }: Readonly<GoogleAppIconProps>) {
  const uid = useId();
  const a = `${uid}-a`;
  const c = `${uid}-c`;
  const e = `${uid}-e`;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 192 192"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path fill="currentColor" d="M32 36.8C32 20.894 44.894 8 60.8 8h70.4C147.106 8 160 20.894 160 36.8v30.4c0 15.906-12.894 28.8-28.8 28.8H60.8C44.894 96 32 83.106 32 67.2z" />
      <path fill="currentColor" d="M19.867 49.392C17.818 33.82 29.94 20 45.645 20h100.71c15.706 0 27.827 13.82 25.778 29.392L166 96l6.133 46.608C174.182 158.18 162.061 172 146.355 172H45.645c-15.706 0-27.827-13.82-25.778-29.392L26 96z" />
      <mask id={a} width="154" height="152" x="19" y="20" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <path fill="#3c90ff" d="M19.867 49.392C17.818 33.82 29.94 20 45.645 20h100.71c15.706 0 27.827 13.82 25.778 29.392L166 96l6.133 46.608C174.182 158.18 162.061 172 146.355 172H45.645c-15.706 0-27.827-13.82-25.778-29.392L26 96z" />
      </mask>
      <g mask={`url(#${a})`}>
        <path fill="currentColor" d="M0 0h166v76H0z" transform="matrix(1 0 0 -1 13 172)" />
      </g>
      <mask id={c} width="154" height="152" x="19" y="20" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <path fill="#3186ff" d="M19.867 49.392C17.818 33.82 29.94 20 45.645 20h100.71c15.706 0 27.827 13.82 25.778 29.392L166 96l6.133 46.608C174.182 158.18 162.061 172 146.355 172H45.645c-15.706 0-27.827-13.82-25.778-29.392L26 96z" />
      </mask>
      <g mask={`url(#${c})`}>
        <path fill="currentColor" filter={`url(#${e})`} d="M32 27.2C32 16.596 40.596 8 51.2 8h89.6c10.604 0 19.2 8.596 19.2 19.2V96H32z" />
      </g>
      <path fill="#fff" d="M75.353 133.336q-6.282 0-10.777-2.043t-7.61-5.465q-3.065-3.474-4.342-6.793T51.603 115a2.07 2.07 0 0 1 1.021-1.124l5.67-2.247q.714-.357 1.43-.102.714.204 1.685 2.349 1.022 2.145 2.86 4.546a14.3 14.3 0 0 0 4.495 3.728q2.606 1.328 6.435 1.328 6.18 0 9.807-3.575 3.677-3.575 3.677-9.091 0-5.976-3.882-9.194-3.881-3.269-10.266-3.269h-5.362a1.9 1.9 0 0 1-1.328-.51q-.51-.562-.511-1.277v-5.465q0-.767.51-1.277a1.82 1.82 0 0 1 1.329-.562h4.647q5.721 0 9.194-3.116t3.473-8.07q0-4.902-3.116-7.916t-8.58-3.014q-3.065 0-5.312 1.022a11.5 11.5 0 0 0-3.882 2.86 22.7 22.7 0 0 0-2.809 3.78q-1.174 1.941-1.89 2.145-.714.153-1.379-.255l-5.363-2.605q-.664-.358-.868-1.124t1.226-3.575q1.481-2.86 4.494-5.823a21 21 0 0 1 7.049-4.597q4.035-1.635 9.398-1.634 9.96 0 15.782 5.26 5.823 5.21 5.823 13.791 0 5.925-2.86 10.266-2.81 4.34-7.968 6.13v.204q6.231 1.838 9.806 6.741 3.627 4.853 3.626 11.594 0 9.654-6.742 15.834-6.74 6.18-17.57 6.18zm51.25-1.175q-.868 0-1.533-.664a2.25 2.25 0 0 1-.612-1.583V73.118l-11.492 8.274q-.614.46-1.431.307a1.96 1.96 0 0 1-1.225-.766l-3.32-4.7a1.98 1.98 0 0 1-.358-1.43q.153-.816.817-1.276l20.379-14.557q.256-.204.562-.306.307-.153.715-.153h4.291q.868 0 1.379.613.562.56.562 1.43v69.36q0 .92-.664 1.583a2 2 0 0 1-1.533.664z" />
      <defs>
        <filter id={e} width="152" height="112" x="20" y="-4" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
    </svg>
  );
}

export function GoogleMeetIcon({ size = 20, ...props }: Readonly<GoogleAppIconProps>) {
  const uid = useId();
  const a = `${uid}-a`;
  const b = `${uid}-b`;
  const c = `${uid}-c`;
  const e = `${uid}-e`;
  const f = `${uid}-f`;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 192 192"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path fill="currentColor" d="M110.015 108.88c-6.829-4.718-6.921-14.778-.179-19.62L165 49.643c7.94-5.701 19-.038 19 9.737v77.755c0 9.675-10.861 15.359-18.821 9.859z" />
      <path fill="currentColor" d="M8 71c0-24.3 19.7-44 44-44h64c11.046 0 20 8.954 20 20v98c0 11.046-8.954 20-20 20H28c-11.046 0-20-8.954-20-20z" />
      <mask id={e} width="129" height="138" x="8" y="27" maskUnits="userSpaceOnUse" style={{ maskType: "luminance" }}>
        <path fill="#fff" d="M8 71c0-24.3 19.7-44 44-44h64c11.046 0 20 8.954 20 20v98c0 11.046-8.954 20-20 20H28c-11.046 0-20-8.954-20-20z" />
      </mask>
      <g filter={`url(#${c})`} mask={`url(#${e})`}>
        <path fill="currentColor" d="m73.906 99.198 110-63.198v124z" />
      </g>
      <circle cx="38" cy="135" r="14" fill="#fff" />
      <defs>
        <linearGradient id={a} x1="128.8" x2="227.2" y1="104.44" y2="104.44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f6a100" />
          <stop offset="1" stopColor="#ffbe00" />
        </linearGradient>
        <linearGradient id={f} x1="136.22" x2="78.5" y1="91.32" y2="91.19" gradientUnits="userSpaceOnUse">
          <stop offset=".15" stopColor="#ffb5e8" />
          <stop offset="1" stopColor="#ffdbf5" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={b} cx="0" cy="0" r="1" gradientTransform="matrix(-159.725 0 0 -135.852 160.325 96)" gradientUnits="userSpaceOnUse">
          <stop offset=".15" stopColor="#ffe921" />
          <stop offset="1" stopColor="#fec700" />
        </radialGradient>
        <filter id={c} width="166" height="180" x="45.91" y="8" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
    </svg>
  );
}

export function GoogleVoiceIcon({ size = 20, ...props }: Readonly<GoogleAppIconProps>) {
  const uid = useId();
  const b = `${uid}-b`;
  const c = `${uid}-c`;
  const d = `${uid}-d`;
  const clip = `${uid}-clip`;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 192 192"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g clipPath={`url(#${clip})`}>
        <path fill="currentColor" d="m21.96 49.04.04-.039c7.822-7.668 20.378-7.621 28.141.141l13.045 13.045c6.248 6.249 6.248 16.38 0 22.627l-4.7 4.701c-4.687 4.686-4.687 12.284 0 16.971l25.029 25.027c4.686 4.686 12.284 4.686 16.97 0l4.7-4.7c6.248-6.248 16.379-6.248 22.627 0l15.044 15.044c7.762 7.762 7.809 20.316.142 28.138v.008l-.165.161-.826.826q-.007.006-.016 0a.01.01 0 0 0-.015 0c-17.739 16.675-45.64 16.347-62.976-.989l-57-57C4.664 95.665 4.335 67.764 21.009 50.025a.012.012 0 0 0 0-.017.012.012 0 0 1 0-.018l.847-.847z" />
        <path fill="currentColor" d="m21.96 49.04.04-.039c7.822-7.668 20.378-7.621 28.141.141l13.045 13.045c6.248 6.249 6.248 16.38 0 22.627l-4.7 4.701c-4.687 4.686-4.687 12.284 0 16.971l25.029 25.027c4.686 4.686 12.284 4.686 16.97 0l4.7-4.7c6.248-6.248 16.379-6.248 22.627 0l15.044 15.044c7.762 7.762 7.809 20.316.142 28.138v.008l-.165.161-.826.826q-.007.006-.016 0a.01.01 0 0 0-.015 0c-17.739 16.675-45.64 16.347-62.976-.989l-57-57C4.664 95.665 4.335 67.764 21.009 50.025a.012.012 0 0 0 0-.017.012.012 0 0 1 0-.018l.847-.847z" />
        <mask id={c} width="102" height="102" x="82" y="8" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
          <rect width="102" height="102" x="82" y="8" fill="#d9d9d9" rx="12" />
        </mask>
        <g mask={`url(#${c})`}>
          <circle cx="96" cy="96" r="88" fill="currentColor" />
        </g>
      </g>
      <defs>
        <radialGradient id={d} cx="0" cy="0" r="1" gradientTransform="translate(83 110) scale(99.5)" gradientUnits="userSpaceOnUse">
          <stop offset=".2" stopColor="#78c9ff" />
          <stop offset=".85" stopColor="#60d673" />
        </radialGradient>
        <linearGradient id={b} x1="60" x2="110.5" y1="134" y2="83.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#78c9ff" stopOpacity="0" />
          <stop offset=".75" stopColor="#78c9ff" />
        </linearGradient>
        <clipPath id={clip}>
          <path fill="#fff" d="M8 8h176v176H8z" />
        </clipPath>
      </defs>
    </svg>
  );
}

export function GoogleChatIcon({ size = 20, ...props }: Readonly<GoogleAppIconProps>) {
  const uid = useId();
  const a = `${uid}-a`;
  const b = `${uid}-b`;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 192 192"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="160" height="96" x="16" y="28" fill="currentColor" rx="48" />
      <path fill="currentColor" d="M133 48c28.167 0 51 22.834 51 51 0 28.167-22.833 51-51 51H96.624l-34.857 23.064c-3.86 2.544-5.789 3.816-7.372 3.92a6 6 0 0 1-5.612-3.022C48 172.583 48 170.271 48 165.649V148.81C25.121 143.78 8 123.39 8 99c0-28.166 22.834-51 51-51h74z" />
      <mask id={a} width="176" height="129" x="8" y="48" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <path fill="#0EBC5F" d="M133 48c28.167 0 51 22.834 51 51 0 28.167-22.833 51-51 51H96.722l-39.428 25.896c-3.99 2.62-9.294-.242-9.294-5.015V148.81C25.121 143.78 8 123.39 8 99c0-28.166 22.834-51 51-51h74z" />
      </mask>
      <g mask={`url(#${a})`}>
        <rect width="160" height="96" x="16" y="28" fill="currentColor" rx="48" />
        <rect width="160" height="96" x="16" y="28" fill="currentColor" rx="48" />
        <path stroke="#fff" strokeLinecap="round" strokeWidth="12" d="M62 94s8.84 18 34 18 34-17.182 34-17.182" />
      </g>
      <defs>
        <linearGradient id={b} x1="96" x2="96" y1="28" y2="124" gradientUnits="userSpaceOnUse">
          <stop offset=".09" stopColor="#94D4FF" />
          <stop offset=".28" stopColor="#78C9FF" />
          <stop offset=".88" stopColor="#01AE58" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function GoogleFormsIcon({ size = 20, ...props }: Readonly<GoogleAppIconProps>) {
  const uid = useId();
  const a = `${uid}-a`;
  const b = `${uid}-b`;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 192 192"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect width="102" height="50" x="70" y="121" fill="currentColor" rx="25" />
      <rect width="50" height="50" x="20" y="121" fill="currentColor" rx="25" />
      <rect width="50" height="50" x="20" y="71" fill="currentColor" rx="25" />
      <rect width="102" height="50" x="70" y="71" fill="currentColor" rx="25" />
      <mask id={a} width="102" height="50" x="70" y="21" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <rect width="102" height="50" x="70" y="21" fill="#5f54f4" rx="25" />
      </mask>
      <g mask={`url(#${a})`}>
        <rect width="102" height="50" x="70" y="21" fill="currentColor" rx="25" />
        <g filter={`url(#${b})`}>
          <circle cx="56" cy="46" r="36" fill="currentColor" />
        </g>
      </g>
      <rect width="50" height="50" x="20" y="21" fill="currentColor" rx="25" />
      <path stroke="#fff" strokeLinecap="round" strokeWidth="12" d="M95 46h52" />
      <circle cx="45" cy="46" r="12" fill="#fff" />
      <defs>
        <filter id={b} width="111.47" height="111.47" x=".27" y="-9.74" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="9.87" />
        </filter>
      </defs>
    </svg>
  );
}

export function GoogleDriveIcon({ size = 20, ...props }: Readonly<GoogleAppIconProps>) {
  const uid = useId();
  const a = `${uid}-a`;
  const b = `${uid}-b`;
  const c = `${uid}-c`;
  const d = `${uid}-d`;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 192 192"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <mask id={a} width="168" height="154" x="12" y="18" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <path fill="#b43333" d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001z" />
      </mask>
      <g mask={`url(#${a})`}>
        <path fill="currentColor" d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578z" />
        <path fill="currentColor" d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001z" />
        <path fill="currentColor" d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048z" />
      </g>
      <defs>
        <linearGradient id={b} x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse">
          <stop offset=".09" stopColor="#ffe921" />
          <stop offset="1" stopColor="#fec700" />
        </linearGradient>
        <linearGradient id={c} x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse">
          <stop offset=".15" stopColor="#a9a8ff" />
          <stop offset=".33" stopColor="#6d97ff" />
          <stop offset=".48" stopColor="#3186ff" />
        </linearGradient>
        <linearGradient id={d} x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse">
          <stop offset=".55" stopColor="#0ebc5f" />
          <stop offset=".85" stopColor="#78c9ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function GoogleSlidesIcon({ size = 20, ...props }: Readonly<GoogleAppIconProps>) {
  const uid = useId();
  const a = `${uid}-a`;
  const b = `${uid}-b`;
  const c = `${uid}-c`;
  const e = `${uid}-e`;
  const f = `${uid}-f`;
  return (
    <svg
      aria-hidden="true"
      height={size}
      viewBox="0 0 192 192"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path fill={`url(#${a})`} d="M12.591 63.318c-2.493-15.262 7.858-29.655 23.12-32.148l96.724-15.8c15.262-2.492 29.655 7.859 32.148 23.12l14.732 90.189c2.493 15.262-7.858 29.655-23.12 32.148l-96.724 15.8c-15.262 2.493-29.655-7.858-32.148-23.12z" />
      <path fill={`url(#${b})`} d="M12 61.6c0-8.943 0-13.415 1.405-16.962a20 20 0 0 1 11.233-11.233C28.185 32 32.656 32 41.6 32h108.8c8.943 0 13.415 0 16.962 1.404a20 20 0 0 1 11.234 11.234C180 48.185 180 52.657 180 61.6v68.8c0 8.943 0 13.415-1.404 16.962a20 20 0 0 1-11.234 11.234C163.815 160 159.343 160 150.4 160H41.6c-8.943 0-13.415 0-16.963-1.404a20 20 0 0 1-11.232-11.234C12 143.815 12 139.343 12 130.4z" />
      <mask id={e} width="168" height="128" x="12" y="32" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <path fill="#fec700" d="M12 61.6c0-8.943 0-13.415 1.405-16.962a20 20 0 0 1 11.233-11.233C28.185 32 32.656 32 41.6 32h108.8c8.943 0 13.415 0 16.962 1.404a20 20 0 0 1 11.234 11.234C180 48.185 180 52.657 180 61.6v68.8c0 8.943 0 13.415-1.404 16.962a20 20 0 0 1-11.234 11.234C163.815 160 159.343 160 150.4 160H41.6c-8.943 0-13.415 0-16.963-1.404a20 20 0 0 1-11.232-11.234C12 143.815 12 139.343 12 130.4z" />
      </mask>
      <g filter={`url(#${c})`} mask={`url(#${e})`}>
        <path fill="#ffbe00" d="m33.74 191.516 144.396-21.58L153.304 3.781 8.907 25.361z" />
        <path fill={`url(#${f})`} d="m33.74 191.516 144.396-21.58L153.304 3.781 8.907 25.361z" />
      </g>
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M148 58a6 6 0 0 1 6 6v64a6 6 0 0 1-6 6H44l-.309-.008A6 6 0 0 1 38 128V64a6 6 0 0 1 5.691-5.992L44 58zm-98 64h92V70H50z"
        clipRule="evenodd"
      />
      <defs>
        <linearGradient id={a} x1="84.07" x2="157.2" y1="23.27" y2="160.82" gradientUnits="userSpaceOnUse">
          <stop offset=".2" stopColor="#ffdb0f" />
          <stop offset=".67" stopColor="#ffbe00" />
          <stop offset=".91" stopColor="#ffa8e3" />
        </linearGradient>
        <linearGradient id={b} x1="96" x2="96" y1="32" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffbe00" />
          <stop offset="1" stopColor="#fec700" />
        </linearGradient>
        <linearGradient id={f} x1="108.52" x2="83.96" y1="168.16" y2="25.27" gradientUnits="userSpaceOnUse">
          <stop offset=".07" stopColor="#fff549" />
          <stop offset=".78" stopColor="#ffbe00" stopOpacity="0" />
        </linearGradient>
        <filter id={c} width="193.23" height="211.73" x="-3.09" y="-8.22" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
    </svg>
  );
}
