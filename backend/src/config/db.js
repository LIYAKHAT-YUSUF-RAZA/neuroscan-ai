const mongoose = require('mongoose');
const { mongoUri } = require('./env');

let isConnected = false;

const connectDB = async () => {
  if (!mongoUri) {
    console.log('[Database] MONGODB_URI not configured. Running in stateless mode (history disabled).');
    return false;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2500, // Quick timeout to prevent hanging on startup
    });
    isConnected = true;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`[Database] Warning: MongoDB connection failed (${error.message}).`);
    console.warn('[Database] The application will continue running with prediction enabled, but history persistence will be bypassed.');
    return false;
  }
};

const getDBStatus = () => {
  return isConnected && mongoose.connection.readyState === 1;
};

module.exports = { connectDB, getDBStatus };
