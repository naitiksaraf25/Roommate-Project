import { useState, useEffect } from "react";

export function LifestyleProfileForm({ user, onProfileSaved }) {
  const [formData, setFormData] = useState({
    city: "",
    locality: "",
    budgetMin: 5000,
    budgetMax: 20000,
    gender: "male",
    genderPreference: "no_preference",
    sleepSchedule: "flexible",
    cleanliness: 3,
    smokingDrinking: "none",
    foodPreference: "any",
    guestsFrequency: "weekends_only",
    bio: "",
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetch("/api/profile/lifestyle")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setFormData({
            city: data.profile.city || "",
            locality: data.profile.locality || "",
            budgetMin: data.profile.budgetMin || 5000,
            budgetMax: data.profile.budgetMax || 20000,
            gender: data.profile.gender || "male",
            genderPreference: data.profile.genderPreference || "no_preference",
            sleepSchedule: data.profile.sleepSchedule || "flexible",
            cleanliness: data.profile.cleanliness || 3,
            smokingDrinking: data.profile.smokingDrinking || "none",
            foodPreference: data.profile.foodPreference || "any",
            guestsFrequency: data.profile.guestsFrequency || "weekends_only",
            bio: data.profile.bio || "",
            rent: data.profile.rent || "",
            roomType: data.profile.roomType || "private_room",
            preferredRoomType: data.profile.preferredRoomType || "any",
          });
          setExistingPhotoUrl(data.profile.photoUrl || "");
        }
      })
      .catch((err) => console.error("Error fetching profile:", err))
      .finally(() => setFetching(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const body = new FormData();
    Object.keys(formData).forEach((key) => {
      body.append(key, formData[key]);
    });
    if (existingPhotoUrl) {
      body.append("existingPhotoUrl", existingPhotoUrl);
    }
    if (photoFile) {
      body.append("photo", photoFile);
    }

    try {
      const res = await fetch("/api/profile/lifestyle", {
        method: "POST",
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.details?.join(", ") || "Failed to save profile");
      }

      setSuccess("Lifestyle Profile saved successfully!");
      if (data.profile?.photoUrl) {
        setExistingPhotoUrl(data.profile.photoUrl);
      }
      if (onProfileSaved) onProfileSaved(data.profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="card">Loading profile data...</div>;
  }

  return (
    <div className="auth-card" style={{ maxWidth: "650px", margin: "1rem auto", textAlign: "left" }}>
      <h3>Create / Edit Lifestyle Profile ({user.role.toUpperCase()})</h3>
      <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
        Fill out your lifestyle preferences to match with compatible roommates.
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
              placeholder="e.g. San Francisco, Mumbai, Boston"
            />
          </div>

          <div className="form-group">
            <label>Locality / Neighborhood (Optional)</label>
            <input
              type="text"
              name="locality"
              value={formData.locality}
              onChange={handleChange}
              placeholder="e.g. Downtown, Mission District"
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label>Min Budget ($/₹ per month) *</label>
            <input
              type="number"
              name="budgetMin"
              required
              min="0"
              value={formData.budgetMin}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label>Max Budget ($/₹ per month) *</label>
            <input
              type="number"
              name="budgetMax"
              required
              min="0"
              value={formData.budgetMax}
              onChange={handleChange}
            />
          </div>
        </div>

        {user.role === "resident" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", backgroundColor: "#1e293b", padding: "0.75rem", borderRadius: "8px", margin: "0.5rem 0" }}>
            <div className="form-group">
              <label style={{ color: "#38bdf8" }}>Vacancy Rent Amount ($/₹) *</label>
              <input
                type="number"
                name="rent"
                placeholder="Monthly rent for vacant spot"
                value={formData.rent}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label style={{ color: "#38bdf8" }}>Vacant Room Type *</label>
              <select name="roomType" value={formData.roomType} onChange={handleChange}>
                <option value="private_room">Private Room</option>
                <option value="shared_room">Shared Room</option>
                <option value="full_flat">Full Flat</option>
                <option value="pg_bed">PG Bed</option>
              </select>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label>Your Gender *</label>
            <select name="gender" value={formData.gender} onChange={handleChange}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-Binary</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Roommate Gender Preference *</label>
            <select name="genderPreference" value={formData.genderPreference} onChange={handleChange}>
              <option value="no_preference">No Preference / Any</option>
              <option value="male_only">Male Only</option>
              <option value="female_only">Female Only</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Preferred Room Type *</label>
          <select name="preferredRoomType" value={formData.preferredRoomType || "any"} onChange={handleChange}>
            <option value="any">No Preference / Any Room Type</option>
            <option value="private_room">Private Room</option>
            <option value="shared_room">Shared Room</option>
            <option value="full_flat">Full Flat</option>
            <option value="pg_bed">PG Bed</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label>Sleep Schedule *</label>
            <select name="sleepSchedule" value={formData.sleepSchedule} onChange={handleChange}>
              <option value="early_bird">Early Bird (Sleeps & Wakes Early)</option>
              <option value="night_owl">Night Owl (Stays Up Late)</option>
              <option value="flexible">Flexible / Variable</option>
            </select>
          </div>

          <div className="form-group">
            <label>Cleanliness Rating (1 = Low, 5 = Neat Freak) *</label>
            <select name="cleanliness" value={formData.cleanliness} onChange={handleChange}>
              <option value={1}>1 - Low / Relaxed</option>
              <option value={2}>2 - Below Average</option>
              <option value={3}>3 - Average / Moderate</option>
              <option value={4}>4 - Neat & Tidy</option>
              <option value={5}>5 - Very Strict / Spotless</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div className="form-group">
            <label>Smoking / Drinking Habits *</label>
            <select name="smokingDrinking" value={formData.smokingDrinking} onChange={handleChange}>
              <option value="none">None / Non-smoker & Non-drinker</option>
              <option value="social">Social / Occasional</option>
              <option value="regular">Regular</option>
              <option value="opposed">Strictly Opposed (No smoking/drinking in flat)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Food Preference *</label>
            <select name="foodPreference" value={formData.foodPreference} onChange={handleChange}>
              <option value="any">Any / No Restrictions</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="eggetarian">Eggetarian</option>
              <option value="non_vegetarian">Non-Vegetarian</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Guests & Parties Frequency *</label>
          <select name="guestsFrequency" value={formData.guestsFrequency} onChange={handleChange}>
            <option value="never">Never / Quiet Home</option>
            <option value="rarely">Rarely</option>
            <option value="weekends_only">Weekends Only</option>
            <option value="frequently">Frequently</option>
            <option value="anytime">Anytime / Open House</option>
          </select>
        </div>

        <div className="form-group">
          <label>Bio (Optional — Max 300 characters)</label>
          <textarea
            name="bio"
            rows="3"
            maxLength={300}
            value={formData.bio}
            onChange={handleChange}
            placeholder="Tell potential roommates a bit about yourself, hobbies, or lifestyle..."
          />
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "right" }}>
            {formData.bio.length} / 300 characters
          </div>
        </div>

        <div className="form-group">
          <label>Profile Photo (Optional)</label>
          {existingPhotoUrl && (
            <div style={{ marginBottom: "0.5rem" }}>
              <img
                src={existingPhotoUrl}
                alt="Profile Preview"
                style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover" }}
              />
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setPhotoFile(e.target.files[0])}
          />
        </div>

        <button type="submit" disabled={loading} style={{ width: "100%", marginTop: "1rem" }}>
          {loading ? "Saving Profile..." : "Save Lifestyle Profile"}
        </button>
      </form>
    </div>
  );
}
