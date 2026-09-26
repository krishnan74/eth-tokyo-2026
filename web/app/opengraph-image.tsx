import { ImageResponse } from "next/og";

// The link preview (Twitter, Telegram, ETHGlobal showcase): the idea in one card.
export const alt = "ENS Drive — share ENS names like a folder";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#eef0ed", color: "#0d1413", fontFamily: "serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontFamily: "sans-serif" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#0d1413" }} />
          <span style={{ fontWeight: 600 }}>ENS Drive</span>
          <span style={{ color: "#5c6865" }}>· Google Drive–style sharing for ENS names</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 104, lineHeight: 1 }}>Share ENS names</div>
          <div style={{ fontSize: 104, lineHeight: 1, display: "flex", gap: 24 }}>like a <span style={{ color: "#06706c", fontStyle: "italic" }}>folder.</span></div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 26, fontFamily: "monospace", color: "#3a4543" }}>
          <span style={{ background: "#dcefec", padding: "6px 14px", borderRadius: 8 }}>acme-labs.eth</span>
          <span>→ shared with a team →</span>
          <span style={{ background: "#dcefec", padding: "6px 14px", borderRadius: 8 }}>every name below</span>
          <span style={{ color: "#5c6865" }}>· live on the ENSv2 beta</span>
        </div>
      </div>
    ),
    size,
  );
}
