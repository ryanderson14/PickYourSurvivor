import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueName = searchParams.get("league") ?? "Pick Your Survivor";
  const season = searchParams.get("season") ?? "50";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #0d2137 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Flame icon replacement */}
        <div
          style={{
            fontSize: 80,
            marginBottom: 24,
            lineHeight: 1,
          }}
        >
          🔥
        </div>

        {/* You're Invited */}
        <div
          style={{
            color: "#ffffff",
            fontSize: 52,
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 20,
            letterSpacing: "-1px",
          }}
        >
          You're Invited!
        </div>

        {/* League name */}
        <div
          style={{
            color: "#f97316",
            fontSize: 30,
            fontWeight: 600,
            textAlign: "center",
            marginBottom: 12,
            maxWidth: 900,
          }}
        >
          {leagueName}
        </div>

        {/* Subtitle */}
        <div
          style={{
            color: "#94a3b8",
            fontSize: 22,
            textAlign: "center",
          }}
        >
          Pick Your Survivor · Season {season}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
