import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { User } from '../models/User.js';
import { Profile } from '../models/Profile.js';
import { logger } from '../utils/logger.js';

/**
 * Secure administrator provisioning script.
 * Must be executed directly from the server CLI:
 *   node src/scripts/provisionAdmin.js <email> <password> <fullName>
 */
async function run() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL;
  const password = process.argv[3] || process.env.ADMIN_PASSWORD;
  const fullName = process.argv[4] || process.env.ADMIN_NAME || 'TripZa Administrator';

  if (!email || !password) {
    console.error('Usage: node src/scripts/provisionAdmin.js <email> <password> [fullName]');
    console.error('Or set ADMIN_EMAIL and ADMIN_PASSWORD environment variables.');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('Error: Administrator password must be at least 10 characters long.');
    process.exit(1);
  }

  try {
    logger.info('Connecting to database...');
    await mongoose.connect(config.mongoUri);

    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      user.role = 'admin';
      user.passwordHash = await User.hashPassword(password);
      await user.save();
      logger.info(`Existing user ${normalizedEmail} successfully elevated to 'admin'.`);
    } else {
      const passwordHash = await User.hashPassword(password);
      user = await User.create({
        email: normalizedEmail,
        passwordHash,
        role: 'admin',
        accountStatus: 'active',
        emailVerified: true,
      });

      await Profile.create({
        user: user._id,
        fullName: fullName.trim(),
        verification: {
          status: 'verified',
          reviewedAt: new Date(),
          reviewNotes: 'Initial System Provisioning',
        },
      });

      logger.info(`New administrator ${normalizedEmail} successfully created and verified.`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error(`Failed to provision administrator: ${error.message}`);
    process.exit(1);
  }
}

run();
