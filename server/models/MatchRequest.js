import mongoose from "mongoose";

const matchRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: String,
      required: true,
      index: true,
    },
    requesterType: {
      type: String,
      required: true,
      enum: ["seeker", "spaceHolder"],
    },
    criteria: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    results: [
      {
        candidateId: { type: String, required: true },
        candidateType: { type: String, required: true, enum: ["lifestyleProfile", "landlordListing"] },
        score: { type: Number, required: true },
        normalizedScore: { type: Number },
        maxApplicablePoints: { type: Number },
        factorCoverage: {
          evaluatedFactorsCount: Number,
          totalFactorsCount: Number,
          maxApplicablePoints: Number,
          totalPossiblePoints: Number,
          coveragePercentage: Number,
          confidenceLabel: String,
        },
        breakdown: { type: mongoose.Schema.Types.Mixed },
        candidateSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
      },
    ],
    totalEligibleCount: {
      type: Number,
      default: 0,
    },
    message: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast 24h caching query: requesterId + createdAt descending
matchRequestSchema.index({ requesterId: 1, createdAt: -1 });

export const MatchRequest =
  mongoose.models.MatchRequest || mongoose.model("MatchRequest", matchRequestSchema);
export default MatchRequest;
