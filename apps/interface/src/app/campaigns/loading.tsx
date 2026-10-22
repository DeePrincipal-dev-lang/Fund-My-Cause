/**
 * Loading skeleton for campaigns route segment — Issue #1285
 *
 * Displays while campaigns are being fetched.
 */

export default function CampaignsLoading() {
  return (
    <div style={{ padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1
          style={{
            marginBottom: "10px",
            backgroundColor: "#e0e0e0",
            height: "32px",
            borderRadius: "4px",
          }}
        />
        <p
          style={{
            backgroundColor: "#f0f0f0",
            height: "20px",
            borderRadius: "4px",
            maxWidth: "300px",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "20px",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "#f5f5f5",
              borderRadius: "8px",
              padding: "16px",
              minHeight: "300px",
              animation: "pulse 2s infinite",
            }}
          >
            <div
              style={{
                backgroundColor: "#e0e0e0",
                height: "200px",
                borderRadius: "4px",
                marginBottom: "12px",
              }}
            />
            <div
              style={{
                backgroundColor: "#f0f0f0",
                height: "24px",
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            />
            <div
              style={{
                backgroundColor: "#f0f0f0",
                height: "16px",
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            />
            <div
              style={{
                backgroundColor: "#f0f0f0",
                height: "16px",
                borderRadius: "4px",
                maxWidth: "80%",
              }}
            />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
