import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    participantIds: [
      {
        type: String,
        required: true,
      },
    ],
    matchInterestId: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index on participantIds for fast chat querying
chatSchema.index({ participantIds: 1 });

export const Chat = mongoose.model("Chat", chatSchema);
