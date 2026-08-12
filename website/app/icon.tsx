import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
  const markPath = join(process.cwd(), "public", "brand", "lumenva-mark-favicon.png");
  const markBase64 = readFileSync(markPath).toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 18,
          display: "flex",
          height: "100%",
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          height={179}
          src={`data:image/png;base64,${markBase64}`}
          style={{ height: 179, left: -83, position: "absolute", top: -33, width: 267 }}
          width={267}
        />
      </div>
    ),
    { ...size },
  );
}
