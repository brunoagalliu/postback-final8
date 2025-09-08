// File: pages/api/admin/clear-cache.js
import { clearAllCachedConversions, logConversion } from '../../../lib/database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Clear ALL cached conversions (global cache)
    const clearedRows = await clearAllCachedConversions();

    // Log the manual cache clear
    await logConversion({
      clickid: 'admin',
      action: 'manual_global_cache_clear',
      message: `Admin manually cleared ALL cached entries. Removed ${clearedRows} total entries from global cache.`
    });

    return res.status(200).json({
      success: true,
      clearedRows,
      message: `Cleared ALL cached conversions. Removed ${clearedRows} total entries from global cache.`
    });

  } catch (error) {
    console.error('Error clearing global cache:', error);
    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to clear global cache'
    });
  }
}