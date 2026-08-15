import { useState, useEffect } from "react";

export function LandlordListingForm({ user, onListingSaved }) {
  const [formData, setFormData] = useState({
    city: "",
    locality: "",
    rent: 12000,
    roomType: "private_room",
    genderPreference: "any",
    status: "active",
    houseRules: {
      smokingAllowed: false,
      drinkingAllowed: false,
      petsAllowed: false,
      guestPolicy: "daytime_only",
      curfew: "no_curfew",
    },
  });

  const [photosFiles, setPhotosFiles] = useState([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState([]);
  const [linkedTenants, setLinkedTenants] = useState([]); // [{ id, name, maskedEmail }]
  
  // Resident tenant search state
  const [tenantSearchEmail, setTenantSearchEmail] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetch("/api/profile/landlord-listing")
      .then((res) => res.json())
      .then((data) => {
        if (data.listing) {
          setFormData({
            city: data.listing.city || "",
            locality: data.listing.locality || "",
            rent: data.listing.rent || 12000,
            roomType: data.listing.roomType || "private_room",
            genderPreference: data.listing.genderPreference || "any",
            status: data.listing.status || "active",
            houseRules: {
              smokingAllowed: Boolean(data.listing.houseRules?.smokingAllowed),
              drinkingAllowed: Boolean(data.listing.houseRules?.drinkingAllowed),
              petsAllowed: Boolean(data.listing.houseRules?.petsAllowed),
              guestPolicy: data.listing.houseRules?.guestPolicy || "daytime_only",
              curfew: data.listing.houseRules?.curfew || "no_curfew",
            },
          });
          setExistingPhotoUrls(data.listing.photoUrls || []);
        }
      })
      .catch((err) => console.error("Error fetching listing:", err))
      .finally(() => setFetching(false));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.startsWith("houseRules.")) {
      const ruleKey = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        houseRules: {
          ...prev.houseRules,
          [ruleKey]: type === "checkbox" ? checked : value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  const handleSearchResident = async () => {
    if (!tenantSearchEmail.trim()) {
      setSearchError("Please enter an exact email address");
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const res = await fetch(`/api/profile/search-residents?email=${encodeURIComponent(tenantSearchEmail.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "No resident found");
      }
      setSearchResult(data.resident);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddTenant = (resident) => {
    if (!linkedTenants.some((t) => t.id === resident.id)) {
      setLinkedTenants((prev) => [...prev, resident]);
    }
    setSearchResult(null);
    setTenantSearchEmail("");
  };

  const handleRemoveTenant = (tenantId) => {
    setLinkedTenants((prev) => prev.filter((t) => t.id !== tenantId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const body = new FormData();
    body.append("city", formData.city);
    body.append("locality", formData.locality);
    body.append("rent", formData.rent);
    body.append("roomType", formData.roomType);
    body.append("genderPreference", formData.genderPreference);
    body.append("status", formData.status);
    body.append("houseRules", JSON.stringify(formData.houseRules));
    body.append("linkedTenantIds", JSON.stringify(linkedTenants.map((t) => t.id)));

    existingPhotoUrls.forEach((url) => body.append("existingPhotoUrls", url));
    Array.from(photosFiles).forEach((file) => body.append("photos", file));

    try {
      const res = await fetch("/api/profile/landlord-listing", {
        method: "POST",
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.details?.join(", ") || "Failed to save listing");
      }

      setSuccess("Landlord Property Listing saved successfully!");
      if (data.listing?.photoUrls) {
        setExistingPhotoUrls(data.listing.photoUrls);
      }
      if (onListingSaved) onListingSaved(data.listing);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="card">Loading listing data...</div>;
  }

  return (
    <div className="auth-card" style={{ maxWidth: "700px", margin: "1rem auto", textAlign: "left" }}>
      <h3>Create / Edit Property Listing (LANDLORD)</h3>
      <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
        Fill out property details and house rules to list your PG or flat.
      </p>

      {error && <div className="error-alert">{error}</div>}
      {success && <div className="status-notice">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label>City *</label>
            <input
              type="text"
              name="city"
              required
              value={formData.city}
              onChange={handleChange}
              placeholder="e.g. Austin, Boston, Delhi"
            />
          </div>

          <div className="form-group">
            <label>Locality / Neighborhood *</label>
            <input
              type="text"
              name="locality"
              required
              value={formData.locality}
              onChange={handleChange}
              placeholder="e.g. Downtown, University District"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label>Monthly Rent ($/₹) *</label>
            <input
              type="number"
              name="rent"
              required
              min="0"
              value={formData.rent}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Room Type *</label>
            <select name="roomType" value={formData.roomType} onChange={handleChange}>
              <option value="private_room">Private Room</option>
              <option value="shared_room">Shared Room</option>
              <option value="full_flat">Full Flat / Apartment</option>
              <option value="pg_bed">PG Bed</option>
            </select>
          </div>

          <div className="form-group">
            <label>Tenant Gender Preference *</label>
            <select name="genderPreference" value={formData.genderPreference} onChange={handleChange}>
              <option value="any">Any / No Preference</option>
              <option value="male_only">Male Only</option>
              <option value="female_only">Female Only</option>
            </select>
          </div>
        </div>

        <h4 style={{ marginTop: "1.5rem", color: "#a5b4fc" }}>House Rules & Policies *</h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", background: "#1e293b", padding: "1rem", borderRadius: "8px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              name="houseRules.smokingAllowed"
              checked={formData.houseRules.smokingAllowed}
              onChange={handleChange}
            />
            Smoking Allowed
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              name="houseRules.drinkingAllowed"
              checked={formData.houseRules.drinkingAllowed}
              onChange={handleChange}
            />
            Drinking Allowed
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              name="houseRules.petsAllowed"
              checked={formData.houseRules.petsAllowed}
              onChange={handleChange}
            />
            Pets Allowed
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <div className="form-group">
            <label>Guest Policy *</label>
            <select name="houseRules.guestPolicy" value={formData.houseRules.guestPolicy} onChange={handleChange}>
              <option value="no_guests">No Guests Allowed</option>
              <option value="daytime_only">Daytime Guests Only</option>
              <option value="overnight_allowed">Overnight Guests Allowed</option>
              <option value="flexible">Flexible Guest Policy</option>
            </select>
          </div>

          <div className="form-group">
            <label>Curfew Rule *</label>
            <select name="houseRules.curfew" value={formData.houseRules.curfew} onChange={handleChange}>
              <option value="no_curfew">No Curfew (24/7 Access)</option>
              <option value="10_pm">10:00 PM Curfew</option>
              <option value="11_pm">11:00 PM Curfew</option>
              <option value="12_am">Midnight Curfew</option>
            </select>
          </div>
        </div>

        <h4 style={{ marginTop: "1.5rem", color: "#a5b4fc" }}>Link Existing Verified Student Tenants (US-5 Optional)</h4>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
          Search for an existing Resident user by exact email to link them as a current tenant.
        </p>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="email"
            placeholder="Exact resident email (e.g. resident@university.edu)"
            value={tenantSearchEmail}
            onChange={(e) => setTenantSearchEmail(e.target.value)}
          />
          <button type="button" onClick={handleSearchResident} disabled={searchLoading}>
            {searchLoading ? "Searching..." : "Search Resident"}
          </button>
        </div>

        {searchError && <div className="error-alert" style={{ marginTop: "0.5rem" }}>{searchError}</div>}

        {searchResult && (
          <div className="status-notice" style={{ marginTop: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{searchResult.name}</strong> ({searchResult.maskedEmail}) - {searchResult.role}
            </div>
            <button type="button" onClick={() => handleAddTenant(searchResult)} style={{ padding: "0.2rem 0.6rem" }}>
              + Link Tenant
            </button>
          </div>
        )}

        {linkedTenants.length > 0 && (
          <div style={{ marginTop: "0.8rem" }}>
            <label style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Linked Student Tenants:</label>
            <ul>
              {linkedTenants.map((t) => (
                <li key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.3rem 0" }}>
                  <span>{t.name} ({t.maskedEmail})</span>
                  <button type="button" onClick={() => handleRemoveTenant(t.id)} style={{ background: "#ef4444", padding: "0.1rem 0.4rem", fontSize: "0.75rem" }}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="form-group" style={{ marginTop: "1.5rem" }}>
          <label>Property Photos (Optional — Max 5 photos)</label>
          {existingPhotoUrls.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", overflowX: "auto" }}>
              {existingPhotoUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Listing ${i}`}
                  style={{ width: "80px", height: "60px", borderRadius: "4px", objectFit: "cover" }}
                />
              ))}
            </div>
          )}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhotosFiles(e.target.files)}
          />
        </div>

        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: "1rem" }}>
          {loading ? "Saving Listing..." : "Save Property Listing"}
        </button>
      </form>
    </div>
  );
}
