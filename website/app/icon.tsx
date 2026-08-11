import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#F5F5F7",
          borderRadius: 7,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <svg fill="none" height="22" viewBox="0 0 24 24" width="22" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 3.5L14 3.5 14 15.5 20 15.5 20 20.5 8 20.5Z" fill="#111111" />
          <path d="M4 9.5V20.5" stroke="#111111" strokeLinecap="round" strokeWidth="1.75" />
          <path d="M6.5 8L6.5 14" stroke="#111111" strokeLinecap="round" strokeWidth="1.75" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
