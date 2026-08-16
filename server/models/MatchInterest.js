import mongoose from "mongoose";

const matchInterestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: String,
      required: true,
      index: true,
    },
    toUserId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "matched"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index ensuring one interest record per directional user pair
matchInterestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });
matchInterestSchema.index({ toUserId: 1, fromUserId: 1 });

export const MatchInterest = mongoose.model("MatchInterest", matchInterestSchema);
