import { mongoose } from "./mongo";

const schema = new mongoose.Schema({
  owner_id: { type: String, required: true },
  user_id: { type: String, required: true },
  role: { type: String, enum: ["editor", "reviewer", "viewer"], required: true },
}, { collection: "room_memberships", timestamps: true });
schema.index({ owner_id: 1, user_id: 1 }, { unique: true });
schema.index({ user_id: 1 });
export const Membership = mongoose.models.RoomMembership || mongoose.model("RoomMembership", schema);