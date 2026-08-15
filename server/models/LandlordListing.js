import mongoose from "mongoose";

const houseRulesSchema = new mongoose.Schema(
  {
    smokingAllowed: { type: Boolean, default: false },
    drinkingAllowed: { type: Boolean, default: false },
    petsAllowed: { type: Boolean, default: false },
    guestPolicy: {
      type: String,
      required: [true, "Guest policy is required"],
      enum: ["no_guests", "daytime_only", "overnight_allowed", "flexible"],
      default: "daytime_only",
    },
    curfew: {
      type: String,
      required: [true, "Curfew rule is required"],
      default: "no_curfew",
    },
  },
  { _id: false }
);

const landlordListingSchema = new mongoose.Schema(
  {
    landlordId: {
      type: String,
      required: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    locality: {
      type: String,
      required: [true, "Locality is required"],
      trim: true,
    },
    rent: {
      type: Number,
      required: [true, "Rent amount is required"],
      min: [0, "Rent cannot be negative"],
    },
    roomType: {
      type: String,
      required: [true, "Room type is required"],
      enum: ["private_room", "shared_room", "full_flat", "pg_bed"],
    },
    genderPreference: {
      type: String,
      required: [true, "Gender preference is required"],
      enum: ["male_only", "female_only", "any"],
    },
    houseRules: {
      type: houseRulesSchema,
      required: true,
    },
    linkedTenantIds: {
      type: [String],
      default: [],
    },
    photoUrls: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "filled", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

export const LandlordListing = mongoose.models.LandlordListing || mongoose.model("LandlordListing", landlordListingSchema);
export default LandlordListing;
