// File: pages/api/read-logs.js
import { getRecentLogs } from '../../lib/database.js';

export default async function handler(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await getRecentLogs(limit);
    
    if (logs.length === 0) {
      return res.status(200).json({ 
        logs: [],
        message: 'No logs found. Try making a conversion request first.',
        count: 0
      });
    }
    
    // Format logs for display
    const formattedLogs = logs.map(log => {
      const timestamp = new Date(log.created_at).toISOString();
      let logLine = `[${timestamp}] ${log.action.toUpperCase()}`;
      
      if (log.clickid) {
        logLine += ` (${log.clickid})`;
      }
      
      if (log.original_amount) {
        logLine += ` - Original: $${parseFloat(log.original_amount).toFixed(2)}`;
      }
      
      if (log.cached_amount) {
        logLine += ` - Cached: $${parseFloat(log.cached_amount).toFixed(2)}`;
      }
      
      if (log.total_sent) {
        logLine += ` - Total Sent: $${parseFloat(log.total_sent).toFixed(2)}`;
      }
      
      logLine += ` - ${log.message}`;
      
      return logLine;
    }).join('\n');
    
    return res.status(200).json({ 
      logs: formattedLogs,
      rawLogs: logs,
      count: logs.length,
      note: "Logs are now stored persistently in MySQL database."
    });
    
  } catch (error) {
    console.error('Error reading logs:', error);
    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to read logs from database'
    });
  }
}