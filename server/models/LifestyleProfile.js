import mongoose from "mongoose";

const lifestyleProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    locality: {
      type: String,
      trim: true,
      default: "",
    },
    budgetMin: {
      type: Number,
      required: [true, "Minimum budget is required"],
      min: [0, "Budget cannot be negative"],
    },
    budgetMax: {
      type: Number,
      required: [true, "Maximum budget is required"],
      min: [0, "Budget cannot be negative"],
    },
    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["male", "female", "non-binary", "other"],
    },
    genderPreference: {
      type: String,
      required: [true, "Gender preference is required"],
      enum: ["male_only", "female_only", "any", "no_preference"],
    },
    sleepSchedule: {
      type: String,
      required: [true, "Sleep schedule is required"],
      enum: ["early_bird", "night_owl", "flexible"],
    },
    cleanliness: {
      type: Number,
      required: [true, "Cleanliness level is required (1-5)"],
      min: 1,
      max: 5,
    },
    smokingDrinking: {
      type: String,
      required: [true, "Smoking/drinking preference is required"],
      enum: ["none", "social", "regular", "opposed"],
    },
    foodPreference: {
      type: String,
      required: [true, "Food preference is required"],
      enum: ["vegetarian", "vegan", "non_vegetarian", "eggetarian", "any"],
    },
    guestsFrequency: {
      type: String,
      required: [true, "Guests frequency is required"],
      enum: ["never", "rarely", "weekends_only", "frequently", "anytime"],
    },
    bio: {
      type: String,
      maxlength: [300, "Bio cannot exceed 300 characters"],
      default: "",
    },
    photoUrl: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export const LifestyleProfile = mongoose.models.LifestyleProfile || mongoose.model("LifestyleProfile", lifestyleProfileSchema);
export default LifestyleProfile;
