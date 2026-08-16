import { useState, useEffect } from "react";

export function MatchResultsView({ matchRequest, isCached, onRecompute, onBackToForm }) {
  const [expandedBreakdown, setExpandedBreakdown] = useState({});
  const [interestStates, setInterestStates] = useState({}); // { candidateId: { status: 'none'|'pending'|'matched', isMutualMatch: bool } }
  const [loadingInterest, setLoadingInterest] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  const results = matchRequest?.results || [];
  const eligibleCount = matchRequest?.totalEligibleCount ?? results.length;
  const explanatoryMessage = matchRequest?.message || matchRequest?.explanatoryMessage || "";

  const toggleBreakdown = (index) => {
    setExpandedBreakdown((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#38bdf8";
    if (score >= 40) return "#eab308";
    return "#f97316";
  };

  // Fetch interest status for each displayed candidate on load
  useEffect(() => {
    if (!Array.isArray(results) || results.length === 0) return;

    results.forEach((res) => {
      const candidateId = res.candidateId;
      if (!candidateId) return;

      fetch(`/api/interest/status/${candidateId}`)
        .then((res) => res.json())
        .then((data) => {
          setInterestStates((prev) => ({
            ...prev,
            [candidateId]: {
              status: data.status || "none",
              isMutualMatch: Boolean(data.isMutualMatch),
            },
          }));
        })
        .catch(() => {});
    });
  }, [matchRequest]);

  const handleExpressInterest = async (candidateId) => {
    setLoadingInterest((prev) => ({ ...prev, [candidateId]: true }));
    try {
      const response = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: candidateId }),
      });
      const data = await response.json();

      if (response.ok) {
        setInterestStates((prev) => ({
          ...prev,
          [candidateId]: {
            status: data.status || "pending",
            isMutualMatch: Boolean(data.isMutualMatch),
          },
        }));

        if (data.isMutualMatch) {
          setToastMessage(data.message || "🎉 It's a Mutual Match!");
        }
      } else {
        alert(data.message || "Could not express interest.");
      }
    } catch (err) {
      console.error("Express Interest Error:", err);
    } finally {
      setLoadingInterest((prev) => ({ ...prev, [candidateId]: false }));
    }
  };

  const getConfidenceBadgeColor = (label) => {
    if (label === "High") return "badge-success";
    if (label === "Medium") return "badge-warning";
    return "badge-warning";
  };

  const formatFactorName = (key) => {
    const map = {
      cleanliness: "Cleanliness",
      sleepSchedule: "Sleep Schedule",
      smokingDrinking: "Smoking / Drinking",
      foodPreference: "Food Preference",
      guestsFrequency: "Guests Frequency",
      cityProximity: "City & Locality Proximity",
      budgetCloseness: "Budget Closeness",
      linkedTenantsAverage: "Linked Tenants Avg",
    };
    return map[key] || key;
  };

  return (
    <div style={{ maxWidth: "750px", margin: "1rem auto", textAlign: "left" }}>
      {/* Toast Banner Notification for Mutual Match */}
      {toastMessage && (
        <div
          style={{
            backgroundColor: "#22c55e",
            color: "#0f172a",
            padding: "0.85rem 1.25rem",
            borderRadius: "8px",
            fontWeight: "bold",
            display: "flex",
            justify: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
            boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: "transparent", border: "none", color: "#0f172a", fontWeight: "bold", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Navigation & Status Bar */}
      <div
        className="card"
        style={{
          display: "flex",
          justify: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <button onClick={onBackToForm} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
            ← Modify Requirements
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isCached ? (
            <span className="badge badge-warning" style={{ fontSize: "0.8rem" }}>
              ⚡ 24h Cached Result
            </span>
          ) : (
            <span className="badge badge-success" style={{ fontSize: "0.8rem" }}>
              ✓ Fresh Calculation
            </span>
          )}
          <button
            onClick={() => onRecompute(true)}
            style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", background: "#3b82f6" }}
          >
            🔄 Recompute Matches
          </button>
        </div>
      </div>

      {/* Explanatory Banner for Fewer Than 3 Results (PRD §8.3 Edge Case) */}
      {(eligibleCount < 3 || results.length < 3) && (
        <div
          className="status-notice"
          style={{
            backgroundColor: "#1e293b",
            borderLeft: "4px solid #38bdf8",
            margin: "0 0 1rem 0",
            padding: "1rem",
            borderRadius: "6px",
          }}
        >
          <div style={{ fontWeight: "bold", color: "#38bdf8", marginBottom: "0.3rem" }}>
            ℹ️ Candidate Pool Availability Note
          </div>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            {explanatoryMessage || `Found ${results.length} eligible match(es) in launch city.`}
          </p>
          <p style={{ margin: "0.4rem 0 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
            We only match against active, platform-verified profiles. As more students and landlords get verified in your city, top matches will expand automatically.
          </p>
        </div>
      )}

      <h3 style={{ marginBottom: "1rem" }}>
        Top Match Results ({results.length} Surfaced)
      </h3>

      {/* Match Cards List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {results.map((res, index) => {
          const snapshot = res.candidateSnapshot || {};
          const factorCoverage = res.factorCoverage || {};
          const score = res.score ?? 0;
          const isExpanded = expandedBreakdown[index];

          const photo = snapshot.photoUrl || (snapshot.photoUrls && snapshot.photoUrls[0]);

          return (
            <div
              key={res.candidateId || index}
              className="card"
              style={{
                border: index === 0 ? "2px solid #22c55e" : "1px solid #334155",
                borderRadius: "12px",
                position: "relative",
                padding: "1.25rem",
              }}
            >
              {/* Rank Tag */}
              <div
                style={{
                  position: "absolute",
                  top: "-12px",
                  left: "16px",
                  background: index === 0 ? "#22c55e" : "#475569",
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: "0.75rem",
                  padding: "2px 10px",
                  borderRadius: "12px",
                  textTransform: "uppercase",
                }}
              >
                {index === 0 ? "🏆 Top #1 Match" : `#${index + 1} Candidate`}
              </div>

              {/* Card Header & Main Score */}
              <div
                style={{
                  display: "flex",
                  justify: "space-between",
                  alignItems: "flex-start",
                  marginTop: "0.5rem",
                  gap: "1rem",
                }}
              >
                {/* Profile Photo & Candidate Basic Info */}
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  {photo ? (
                    <img
                      src={photo}
                      alt={snapshot.name || "Candidate"}
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid #38bdf8",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        background: "#334155",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        color: "#94a3b8",
                      }}
                    >
                      {(snapshot.name || snapshot.landlordName || "RM").charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h4 style={{ margin: 0, fontSize: "1.2rem", color: "#f8fafc" }}>
                      {snapshot.title || snapshot.name || snapshot.landlordName || "Verified User"}
                    </h4>
                    <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "2px" }}>
                      <span style={{ textTransform: "capitalize" }}>
                        {snapshot.candidateType === "landlordListing"
                          ? `Landlord Listing (${snapshot.roomType?.replace("_", " ") || "property"})`
                          : `${snapshot.role || "Seeker"} • ${snapshot.gender || "Gender unspecified"}`}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#38bdf8", marginTop: "2px" }}>
                      📍 {snapshot.locality ? `${snapshot.locality}, ` : ""}{snapshot.city}
                    </div>
                  </div>
                </div>

                {/* Score & Confidence Badge */}
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "1.8rem",
                      fontWeight: "bold",
                      color: getScoreColor(score),
                      lineHeight: "1",
                    }}
                  >
                    {score}%
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                    Match Score
                  </div>
                </div>
              </div>

              {/* FACTOR COVERAGE METADATA DISPLAY (PRD §8.3 & PROMPT #6 REQUIREMENT) */}
              <div
                style={{
                  margin: "1rem 0",
                  padding: "0.6rem 0.9rem",
                  backgroundColor: "#0f172a",
                  borderRadius: "8px",
                  borderLeft: `4px solid ${getScoreColor(score)}`,
                  fontSize: "0.85rem",
                  color: "#e2e8f0",
                }}
              >
                <div style={{ fontWeight: "600", marginBottom: "2px" }}>
                  {score}% Match • Based on {factorCoverage.evaluatedFactorsCount || 0} of {factorCoverage.totalFactorsCount || 7} factors ({factorCoverage.confidenceLabel || "Medium"} Confidence)
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  Factor Coverage: {factorCoverage.coveragePercentage || 0}% • Evaluated Points: {factorCoverage.maxApplicablePoints || 0} / 100
                </div>
              </div>

              {/* Quick Details Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.5rem",
                  fontSize: "0.85rem",
                  color: "#cbd5e1",
                  margin: "0.75rem 0",
                }}
              >
                <div>
                  <strong>Rent / Budget:</strong>{" "}
                  {snapshot.rent !== undefined
                    ? `₹/$$ ${snapshot.rent.toLocaleString()}/mo`
                    : snapshot.budgetMin !== undefined
                    ? `₹/$$ ${snapshot.budgetMin.toLocaleString()} - ${snapshot.budgetMax?.toLocaleString()}/mo`
                    : "Not specified"}
                </div>
                <div>
                  <strong>Sleep / Curfew:</strong>{" "}
                  {snapshot.sleepSchedule
                    ? snapshot.sleepSchedule.replace("_", " ")
                    : snapshot.houseRules?.curfew
                    ? snapshot.houseRules.curfew.replace("_", " ")
                    : "Flexible"}
                </div>
                <div>
                  <strong>Habits:</strong>{" "}
                  {snapshot.smokingDrinking
                    ? snapshot.smokingDrinking
                    : snapshot.houseRules
                    ? `Smoking: ${snapshot.houseRules.smokingAllowed ? "Yes" : "No"}, Drinking: ${snapshot.houseRules.drinkingAllowed ? "Yes" : "No"}`
                    : "Standard"}
                </div>
                <div>
                  <strong>Food / Guests:</strong>{" "}
                  {snapshot.foodPreference || snapshot.houseRules?.guestPolicy || "Flexible"}
                </div>
              </div>

              {/* Bio or House Rules summary */}
              {snapshot.bio && (
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#94a3b8",
                    fontStyle: "italic",
                    margin: "0.5rem 0 0.75rem 0",
                  }}
                >
                  "{snapshot.bio}"
                </p>
              )}

              {/* Privacy Notice & Express Interest Action */}
              <div
                style={{
                  display: "flex",
                  justify: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  margin: "0.75rem 0",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
                  🔒 Contact info protected & hidden until mutual match.
                </div>

                {/* EXPRESS INTEREST BUTTON (PRD §5.4 US-10) */}
                <div>
                  {interestStates[res.candidateId]?.isMutualMatch ? (
                    <span className="badge badge-success" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                      🎉 Mutually Matched!
                    </span>
                  ) : interestStates[res.candidateId]?.status === "pending" ? (
                    <button disabled style={{ background: "#475569", cursor: "default", opacity: 0.8 }}>
                      ⏳ Interest Sent (Pending)
                    </button>
                  ) : (
                    <button
                      onClick={() => handleExpressInterest(res.candidateId)}
                      disabled={loadingInterest[res.candidateId]}
                      style={{ background: "#ec4899", fontWeight: "bold" }}
                    >
                      {loadingInterest[res.candidateId] ? "Sending..." : "💖 Express Interest"}
                    </button>
                  )}
                </div>
              </div>

              {/* Toggle Breakdown Button */}
              <button
                onClick={() => toggleBreakdown(index)}
                style={{
                  width: "100%",
                  fontSize: "0.8rem",
                  padding: "0.4rem",
                  background: "#1e293b",
                  border: "1px solid #334155",
                }}
              >
                {isExpanded ? "▲ Hide Factor Breakdown" : "▼ View Detailed Factor Breakdown"}
              </button>

              {/* Expanded Factor Breakdown */}
              {isExpanded && res.breakdown && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    padding: "0.75rem",
                    backgroundColor: "#0f172a",
                    borderRadius: "8px",
                    fontSize: "0.8rem",
                  }}
                >
                  <div style={{ fontWeight: "bold", color: "#f8fafc", marginBottom: "0.5rem" }}>
                    Sub-Factor Score Breakdown
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                    {Object.entries(res.breakdown).map(([factorKey, pointsEarned]) => (
                      <div
                        key={factorKey}
                        style={{
                          display: "flex",
                          justify: "space-between",
                          padding: "0.25rem 0.5rem",
                          backgroundColor: "#1e293b",
                          borderRadius: "4px",
                        }}
                      >
                        <span style={{ color: "#cbd5e1" }}>{formatFactorName(factorKey)}:</span>
                        <span style={{ fontWeight: "bold", color: pointsEarned > 0 ? "#22c55e" : "#ef4444" }}>
                          +{pointsEarned} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
