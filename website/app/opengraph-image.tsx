import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Lumenva — Atendimento e vendas com IA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "flex-start",
          background: "#F5F5F7",
          color: "#111111",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          padding: "72px 84px",
          width: "100%",
        }}
      >
        <div style={{ fontFamily: "Manrope", fontSize: 88, fontWeight: 800 }}>
          Lumenva
        </div>
        <div
          style={{
            color: "#6E6E73",
            fontFamily: "Manrope",
            fontSize: 38,
            fontWeight: 600,
            marginTop: 24,
          }}
        >
          Atendimento e vendas com IA
        </div>
      </div>
    ),
    { ...size },
  );
}
