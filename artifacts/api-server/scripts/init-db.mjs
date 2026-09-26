import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  process.stderr.write("MONGODB_URI is required. Add it through Replit Secrets.\n");
  process.exitCode = 1;
} else {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    const projects = mongoose.connection.collection("projects");
    await projects.createIndex({ project_id: 1 }, { unique: true });
    await projects.createIndex({ owner_id: 1, deleted_at: 1, priority: -1 });
    process.stdout.write("Project indexes initialized. No users or demo records were created.\n");
  } catch {
    process.stderr.write("Initialization failed. Check MongoDB access, permissions, and existing index definitions.\n");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}