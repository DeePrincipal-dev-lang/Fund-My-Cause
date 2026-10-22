/**
 * Loading skeleton for profile route segment — Issue #1285
 *
 * Displays while profile data is being fetched.
 */

export default function ProfileLoading() {
  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "30px" }}>
        <div
          style={{
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            backgroundColor: "#e0e0e0",
            margin: "0 auto 20px",
            animation: "pulse 2s infinite",
          }}
        />
        <div
          style={{
            backgroundColor: "#e0e0e0",
            height: "28px",
            borderRadius: "4px",
            maxWidth: "300px",
            margin: "0 auto 10px",
            animation: "pulse 2s infinite",
          }}
        />
        <div
          style={{
            backgroundColor: "#f0f0f0",
            height: "16px",
            borderRadius: "4px",
            maxWidth: "200px",
            margin: "0 auto",
            animation: "pulse 2s infinite",
          }}
        />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ marginBottom: "20px" }}>
          <div
            style={{
              backgroundColor: "#f5f5f5",
              padding: "16px",
              borderRadius: "8px",
              animation: "pulse 2s infinite",
            }}
          >
            <div
              style={{
                backgroundColor: "#e0e0e0",
                height: "20px",
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
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
