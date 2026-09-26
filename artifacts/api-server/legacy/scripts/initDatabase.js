import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Project from '../models/Project.js';
import AuditLog from '../models/AuditLog.js';
import Analytics from '../models/Analytics.js';

dotenv.config();

const initDatabase = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/starfruit-control-room');
    console.log('✅ Connected to MongoDB');

    console.log('\n📊 Creating indexes...');

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ user_id: 1 }, { unique: true });
    await User.collection.createIndex({ created_at: -1 });
    console.log('✅ User indexes created');

    // Project indexes
    await Project.collection.createIndex({ project_id: 1 }, { unique: true });
    await Project.collection.createIndex({ status: 1, priority: -1 });
    await Project.collection.createIndex({ created_at: -1 });
    await Project.collection.createIndex({ client_name: 1 });
    await Project.collection.createIndex({ 'replit_task.github_pr_url': 1 });
    console.log('✅ Project indexes created');

    // AuditLog indexes
    await AuditLog.collection.createIndex({ log_id: 1 }, { unique: true });
    await AuditLog.collection.createIndex({ action: 1, created_at: -1 });
    await AuditLog.collection.createIndex({ actor: 1, created_at: -1 });
    await AuditLog.collection.createIndex({ target_type: 1, target_id: 1 });
    await AuditLog.collection.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
    console.log('✅ AuditLog indexes created');

    // Analytics indexes
    await Analytics.collection.createIndex({ period: 1, timestamp: -1 });
    await Analytics.collection.createIndex({ timestamp: -1 });
    console.log('✅ Analytics indexes created');

    // Create default admin user if it doesn't exist
    console.log('\n👤 Setting up default users...');
    const adminExists = await User.findOne({ email: 'admin@starfruit.local' });

    if (!adminExists) {
      const admin = new User({
        user_id: 'USR-ADMIN001',
        email: 'admin@starfruit.local',
        password: 'admin123', // Should be changed in production
        full_name: 'Admin User',
        role: 'admin',
        status: 'active',
        permissions: [
          'view_projects',
          'create_projects',
          'approve_projects',
          'merge_code',
          'emergency_stop',
          'view_audit_logs',
          'manage_users',
          'system_configuration'
        ]
      });

      await admin.save();
      console.log('✅ Default admin user created (admin@starfruit.local)');
    } else {
      console.log('⚠️ Admin user already exists');
    }

    // Create default manager user if it doesn't exist
    const managerExists = await User.findOne({ email: 'manager@starfruit.local' });

    if (!managerExists) {
      const manager = new User({
        user_id: 'USR-MGR0001',
        email: 'manager@starfruit.local',
        password: 'manager123',
        full_name: 'Project Manager',
        role: 'client_manager',
        status: 'active',
        permissions: [
          'view_projects',
          'create_projects',
          'approve_projects'
        ]
      });

      await manager.save();
      console.log('✅ Default manager user created (manager@starfruit.local)');
    } else {
      console.log('⚠️ Manager user already exists');
    }

    // Create default developer user if it doesn't exist
    const devExists = await User.findOne({ email: 'developer@starfruit.local' });

    if (!devExists) {
      const developer = new User({
        user_id: 'USR-DEV0001',
        email: 'developer@starfruit.local',
        password: 'developer123',
        full_name: 'Senior Developer',
        role: 'senior_developer',
        status: 'active',
        permissions: [
          'view_projects',
          'merge_code'
        ]
      });

      await developer.save();
      console.log('✅ Default developer user created (developer@starfruit.local)');
    } else {
      console.log('⚠️ Developer user already exists');
    }

    console.log('\n✨ Database initialization completed successfully!');
    console.log('\n📝 Default Users:');
    console.log('   - Admin: admin@starfruit.local / admin123');
    console.log('   - Manager: manager@starfruit.local / manager123');
    console.log('   - Developer: developer@starfruit.local / developer123');
    console.log('\n⚠️  IMPORTANT: Change all default passwords in production!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
};

initDatabase();
