/**
 * Loading skeleton for status route segment — Issue #1285
 *
 * Displays while status data is being fetched.
 */

export default function StatusLoading() {
  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      <div style={{ marginBottom: "30px" }}>
        <div
          style={{
            backgroundColor: "#e0e0e0",
            height: "32px",
            borderRadius: "4px",
            maxWidth: "300px",
            marginBottom: "10px",
            animation: "pulse 2s infinite",
          }}
        />
        <div
          style={{
            backgroundColor: "#f0f0f0",
            height: "20px",
            borderRadius: "4px",
            maxWidth: "500px",
            animation: "pulse 2s infinite",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              backgroundColor: "#f5f5f5",
              padding: "20px",
              borderRadius: "8px",
              borderLeft: "4px solid #e0e0e0",
              animation: "pulse 2s infinite",
            }}
          >
            <div
              style={{
                backgroundColor: "#e0e0e0",
                height: "24px",
                borderRadius: "4px",
                marginBottom: "12px",
              }}
            />
            <div
              style={{
                backgroundColor: "#f0f0f0",
                height: "40px",
                borderRadius: "4px",
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: "30px" }}>
        <div
          style={{
            backgroundColor: "#e0e0e0",
            height: "28px",
            borderRadius: "4px",
            marginBottom: "15px",
            animation: "pulse 2s infinite",
          }}
        />
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 0",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <div
              style={{
                backgroundColor: "#f0f0f0",
                height: "16px",
                borderRadius: "4px",
                flex: 1,
                marginRight: "10px",
                animation: "pulse 2s infinite",
              }}
            />
            <div
              style={{
                backgroundColor: "#f0f0f0",
                height: "16px",
                borderRadius: "4px",
                width: "100px",
                animation: "pulse 2s infinite",
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
