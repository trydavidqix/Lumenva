import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const markPath = join(process.cwd(), "public", "brand", "lumenva-mark-favicon.png");
  const markBase64 = readFileSync(markPath).toString("base64");

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
          overflow: "hidden",
          width: "100%",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          height={60}
          src={`data:image/png;base64,${markBase64}`}
          style={{ height: 60, objectFit: "contain", width: 90 }}
          width={90}
        />
      </div>
    ),
    { ...size },
  );
}
