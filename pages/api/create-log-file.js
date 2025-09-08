// File: pages/api/create-log-file.js
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

export default async function handler(req, res) {
  try {
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      await fsPromises.mkdir(logsDir, { recursive: true });
      console.log('Created logs directory');
    }
    
    // Create log file if it doesn't exist
    const logFile = path.join(logsDir, 'conversion.log');
    if (!fs.existsSync(logFile)) {
      await fsPromises.writeFile(logFile, '[Initial log entry] Log file created\n');
      console.log('Created log file');
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Log directory and file created',
      logPath: logFile
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}