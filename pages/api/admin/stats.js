// File: pages/api/admin/stats.js
import { getPool } from '../../../lib/database.js';

export default async function handler(req, res) {
  try {
    const pool = getPool();

    // Get total cached amount (now global across all clickids)
    const [cacheStats] = await pool.execute(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_cached_amount,
        COUNT(DISTINCT clickid) as unique_clickids,
        COUNT(*) as total_cached_conversions
      FROM cached_conversions
    `);

    // Get postback statistics
    const [postbackStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_postbacks,
        COUNT(CASE WHEN success = 1 THEN 1 END) as successful_postbacks,
        COALESCE(SUM(amount), 0) as total_postback_amount
      FROM postback_history
    `);

    // Get cached conversions grouped by clickid (for reference)
    const [cachedByClickid] = await pool.execute(`
      SELECT 
        clickid,
        SUM(amount) as total_amount,
        COUNT(*) as conversion_count,
        MAX(created_at) as last_updated
      FROM cached_conversions
      GROUP BY clickid
      ORDER BY total_amount DESC
      LIMIT 20
    `);

    // Get recent postbacks
    const [recentPostbacks] = await pool.execute(`
      SELECT clickid, amount, success, created_at
      FROM postback_history
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const totalPostbacks = postbackStats[0].total_postbacks;
    const successfulPostbacks = postbackStats[0].successful_postbacks;
    const successRate = totalPostbacks > 0 ? (successfulPostbacks / totalPostbacks) * 100 : 0;

    return res.status(200).json({
      totalCachedAmount: parseFloat(cacheStats[0].total_cached_amount),
      uniqueClickids: parseInt(cacheStats[0].unique_clickids),
      totalCachedConversions: parseInt(cacheStats[0].total_cached_conversions),
      totalPostbacks: parseInt(totalPostbacks),
      successfulPostbacks: parseInt(successfulPostbacks),
      successRate: successRate,
      totalPostbackAmount: parseFloat(postbackStats[0].total_postback_amount),
      cachedByClickid: cachedByClickid,
      recentPostbacks: recentPostbacks
    });

  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to fetch admin statistics'
    });
  }
}