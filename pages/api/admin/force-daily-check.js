// File: pages/api/admin/force-daily-check.js
import { 
    getPool, 
    logConversion, 
    logPostback, 
    clearAllCachedConversions, 
    getGlobalCachedTotal,
    initializeDatabase 
  } from '../../../lib/database.js';
  
  export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method not allowed' });
    }
  
    try {
      await initializeDatabase();
  
      await logConversion({
        clickid: 'admin-force-check',
        action: 'admin_force_daily_check',
        message: 'Admin manually forced daily postback check (bypasses time window)'
      });
  
      // Execute the daily postback logic (same as cron, but forced)
      const result = await executeForcedDailyPostback();
      
      return res.status(result.success ? 200 : 500).json({
        forced: true,
        timestamp: new Date().toISOString(),
        ...result
      });
  
    } catch (error) {
      console.error('Error in force daily check:', error);
      
      try {
        await logConversion({
          clickid: 'admin-force-check',
          action: 'admin_force_check_error',
          message: `Admin force check error: ${error.message}`
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
  
      return res.status(500).json({ 
        error: error.message,
        message: 'Failed to force daily check'
      });
    }
  }
  
  async function executeForcedDailyPostback() {
    try {
      // Get current time in New York timezone
      const now = new Date();
      const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
  
      // Check total cached amount
      const totalCached = await getGlobalCachedTotal();
  
      if (totalCached <= 0) {
        await logConversion({
          clickid: 'admin-force-check',
          action: 'force_no_cache',
          message: `Force check completed - no cached conversions to process (total: $${totalCached.toFixed(2)})`
        });
        
        return {
          success: true,
          message: 'No cached conversions to process',
          totalAmount: totalCached
        };
      }
  
      // Get a representative clickid for the postback
      const pool = getPool();
      const [clickidResult] = await pool.execute(`
        SELECT clickid FROM cached_conversions 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
  
      const primaryClickid = clickidResult[0]?.clickid || 'force-check';
  
      await logConversion({
        clickid: primaryClickid,
        action: 'force_postback_preparing',
        cached_amount: totalCached,
        total_sent: totalCached,
        message: `Force check preparing daily postback. NY Time: ${nyTime.toLocaleString()}, Total cached: $${totalCached.toFixed(2)}, using clickid: ${primaryClickid}`
      });
  
      // Send the postback to RedTrack
      const redtrackUrl = `https://clks.trackthisclicks.com/postback?clickid=${encodeURIComponent(primaryClickid)}&sum=${encodeURIComponent(totalCached)}`;
      
      let postbackSuccess = false;
      let responseText = '';
      let errorMessage = null;
  
      try {
        const response = await fetch(redtrackUrl, {
          method: 'GET',
          timeout: 30000
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        responseText = await response.text();
        postbackSuccess = true;
  
        await logConversion({
          clickid: primaryClickid,
          action: 'force_postback_success',
          cached_amount: totalCached,
          total_sent: totalCached,
          message: `Force check postback successful. Amount: $${totalCached.toFixed(2)}, Response: ${responseText}`
        });
  
      } catch (error) {
        errorMessage = error.message;
        postbackSuccess = false;
  
        await logConversion({
          clickid: primaryClickid,
          action: 'force_postback_failed',
          cached_amount: totalCached,
          total_sent: totalCached,
          message: `Force check postback failed. Amount: $${totalCached.toFixed(2)}, Error: ${error.message}`
        });
      }
  
      // Log the postback attempt in postback_history
      await logPostback(
        primaryClickid, 
        totalCached, 
        redtrackUrl, 
        postbackSuccess, 
        responseText, 
        errorMessage
      );
  
      if (postbackSuccess) {
        // Clear the cache only if postback was successful
        const clearedRows = await clearAllCachedConversions();
  
        await logConversion({
          clickid: primaryClickid,
          action: 'force_cache_cleared',
          message: `Force check completed successfully. Cache cleared: ${clearedRows} entries. Total sent: $${totalCached.toFixed(2)}`
        });
  
        return {
          success: true,
          message: 'Force daily check: postback sent successfully and cache cleared',
          totalAmount: totalCached,
          clearedEntries: clearedRows,
          clickidUsed: primaryClickid,
          nyTime: nyTime.toLocaleString()
        };
      } else {
        await logConversion({
          clickid: primaryClickid,
          action: 'force_postback_failed_final',
          message: `Force check postback failed. Cache NOT cleared. Amount: $${totalCached.toFixed(2)}, Error: ${errorMessage}`
        });
  
        return {
          success: false,
          message: 'Force daily check: postback failed - cache not cleared',
          totalAmount: totalCached,
          error: errorMessage,
          clickidUsed: primaryClickid,
          nyTime: nyTime.toLocaleString()
        };
      }
  
    } catch (error) {
      console.error('Execute forced daily postback error:', error);
      
      await logConversion({
        clickid: 'admin-force-check',
        action: 'force_execution_error',
        message: `Force check execution error: ${error.message}`
      });
  
      return { 
        success: false,
        error: error.message,
        message: 'Force daily check execution error'
      };
    }
  }