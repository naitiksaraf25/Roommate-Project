import { useState, useEffect } from "react";

export function MatchRequirementForm({ user, onFindMatches, onNavigateToProfile, loading }) {
  const [profileDoc, setProfileDoc] = useState(null);
  const [listingDoc, setListingDoc] = useState(null);
  const [fetching, setFetching] = useState(true);

  const isLandlord = user?.role === "landlord";

  useEffect(() => {
    setFetching(true);
    if (isLandlord) {
      fetch("/api/profile/landlord-listing")
        .then((res) => res.json())
        .then((data) => setListingDoc(data.listing || null))
        .catch(() => {})
        .finally(() => setFetching(false));
    } else {
      fetch("/api/profile/lifestyle")
        .then((res) => res.json())
        .then((data) => setProfileDoc(data.profile || null))
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [user, isLandlord]);

  const handleTriggerMatch = (e) => {
    e.preventDefault();
    onFindMatches({});
  };

  if (fetching) {
    return <div className="card">Checking saved profile preferences...</div>;
  }

  const activeDoc = isLandlord ? listingDoc : profileDoc;

  if (!activeDoc) {
    return (
      <div className="card" style={{ textAlign: "left", maxWidth: "650px", margin: "1rem auto" }}>
        <h3 style={{ color: "#f59e0b" }}>📋 Profile / Listing Required</h3>
        <p style={{ color: "#94a3b8", fontSize: "0.95rem" }}>
          To calculate AI compatibility scores, you must first complete your {isLandlord ? "Property Listing" : "Lifestyle Profile"}.
        </p>
        <div style={{ marginTop: "1.25rem" }}>
          <button onClick={onNavigateToProfile} style={{ width: "100%", background: "#3b82f6" }}>
            ✏️ Complete Your {isLandlord ? "Property Listing" : "Lifestyle Profile"} First
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ textAlign: "left", maxWidth: "680px", margin: "1rem auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3>⚡ One-Click AI Matching</h3>
        <span className="badge badge-success" style={{ fontSize: "0.8rem" }}>
          ✓ Profile Ready
        </span>
      </div>

      <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
        Matching runs directly against your saved {isLandlord ? "property listing" : "lifestyle profile"} criteria.
      </p>

      {/* Saved Preferences Summary Card */}
      <div
        style={{
          backgroundColor: "#0f172a",
          borderRadius: "8px",
          padding: "1rem",
          margin: "1rem 0",
          border: "1px solid #334155",
        }}
      >
        <div style={{ fontWeight: "bold", color: "#38bdf8", marginBottom: "0.75rem", fontSize: "0.95rem" }}>
          Active Search Criteria (from Saved Profile)
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", fontSize: "0.85rem", color: "#cbd5e1" }}>
          <div>
            <strong>Target City:</strong> {activeDoc.city} {activeDoc.locality ? `(${activeDoc.locality})` : ""}
          </div>

          <div>
            <strong>Rent / Budget:</strong>{" "}
            {activeDoc.rent !== undefined
              ? `₹/$$ ${activeDoc.rent.toLocaleString()}/mo`
              : `₹/$$ ${activeDoc.budgetMin?.toLocaleString()} - ${activeDoc.budgetMax?.toLocaleString()}/mo`}
          </div>

          <div>
            <strong>Gender Preference:</strong>{" "}
            <span style={{ textTransform: "capitalize" }}>
              {activeDoc.genderPreference ? activeDoc.genderPreference.replace("_", " ") : "Any"}
            </span>
          </div>

          <div>
            <strong>Room Type Preference:</strong>{" "}
            <span style={{ textTransform: "capitalize" }}>
              {activeDoc.preferredRoomType
                ? activeDoc.preferredRoomType.replace("_", " ")
                : activeDoc.roomType
                ? activeDoc.roomType.replace("_", " ")
                : "Any"}
            </span>
          </div>

          {!isLandlord && (
            <>
              <div>
                <strong>Cleanliness:</strong> {activeDoc.cleanliness} / 5
              </div>
              <div>
                <strong>Sleep Schedule:</strong>{" "}
                <span style={{ textTransform: "capitalize" }}>{activeDoc.sleepSchedule?.replace("_", " ")}</span>
              </div>
              <div>
                <strong>Smoking/Drinking:</strong> {activeDoc.smokingDrinking}
              </div>
              <div>
                <strong>Food Preference:</strong> {activeDoc.foodPreference}
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign: "right", marginTop: "0.75rem" }}>
          <button
            onClick={onNavigateToProfile}
            style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem", background: "#334155" }}
          >
            ✏️ Edit Saved Profile Criteria
          </button>
        </div>
      </div>

      <form onSubmit={handleTriggerMatch}>
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "0.8rem", fontSize: "1.05rem" }}>
          {loading ? "Calculating Top Matches..." : "⚡ Find Top 3 Compatible Matches"}
        </button>
      </form>
    </div>
  );
}
