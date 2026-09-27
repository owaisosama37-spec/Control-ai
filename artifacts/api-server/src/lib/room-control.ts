import { mongoose } from "./mongo";

const roomControlSchema = new mongoose.Schema({
  owner_id: { type: String, required: true, unique: true },
  stopped_at: { type: Date, default: null },
  stopped_by: { type: String, default: null },
  room_events: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { collection: "room_controls" });

export const RoomControl = mongoose.models.RoomControl || mongoose.model("RoomControl", roomControlSchema);