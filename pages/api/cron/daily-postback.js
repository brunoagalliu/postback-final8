// File: pages/api/cron/daily-postback.js
import { 
    getPool, 
    logConversion, 
    logPostback, 
    clearAllCachedConversions, 
    getGlobalCachedTotal,
    initializeDatabase 
  } from '../../../lib/database.js';
  
  export default async function handler(req, res) {
    try {
      // Verify this is a Vercel Cron request
      if (req.headers['user-agent'] !== 'vercel-cron/1.0') {
        return res.status(401).json({ error: 'Unauthorized - Not a Vercel Cron request' });
      }
  
      await initializeDatabase();
  
      // Log that the cron job started
      await logConversion({
        clickid: 'vercel-cron',
        action: 'cron_daily_trigger',
        message: `Vercel Cron triggered daily postback at ${new Date().toISOString()}`
      });
  
      // Execute the daily postback
      const result = await executeDailyPostback();
  
      // Return success response
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        timezone: 'Cron runs at 11:59 PM Eastern Time (4:59 AM UTC)',
        ...result
      });
  
    } catch (error) {
      console.error('Cron daily postback error:', error);
      
      try {
        await logConversion({
          clickid: 'vercel-cron',
          action: 'cron_error',
          message: `Vercel Cron error: ${error.message}`
        });
      } catch (logError) {
        console.error('Failed to log cron error:', logError);
      }
  
      return res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  async function executeDailyPostback() {
    try {
      // Get current time in New York timezone
      const now = new Date();
      const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const currentDateString = nyTime.toDateString();
  
      // Check if we've already processed today (prevent duplicate runs)
      const hasRunToday = await checkIfAlreadyRanToday();
      if (hasRunToday) {
        await logConversion({
          clickid: 'vercel-cron',
          action: 'cron_duplicate_prevented',
          message: `Cron job skipped - already processed today (${currentDateString})`
        });
        
        return {
          success: true,
          message: 'Already processed today - duplicate prevented',
          skipped: true
        };
      }
  
      // Check total cached amount
      const totalCached = await getGlobalCachedTotal();
  
      if (totalCached <= 0) {
        await logConversion({
          clickid: 'vercel-cron',
          action: 'cron_no_cache',
          message: `Cron job completed - no cached conversions to process (total: $${totalCached.toFixed(2)})`
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
  
      const primaryClickid = clickidResult[0]?.clickid || 'vercel-cron';
  
      await logConversion({
        clickid: primaryClickid,
        action: 'cron_postback_preparing',
        cached_amount: totalCached,
        total_sent: totalCached,
        message: `Vercel Cron preparing daily postback. NY Time: ${nyTime.toLocaleString()}, Total cached: $${totalCached.toFixed(2)}, using clickid: ${primaryClickid}`
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
          action: 'cron_postback_success',
          cached_amount: totalCached,
          total_sent: totalCached,
          message: `Vercel Cron postback successful. Amount: $${totalCached.toFixed(2)}, Response: ${responseText}`
        });
  
      } catch (error) {
        errorMessage = error.message;
        postbackSuccess = false;
  
        await logConversion({
          clickid: primaryClickid,
          action: 'cron_postback_failed',
          cached_amount: totalCached,
          total_sent: totalCached,
          message: `Vercel Cron postback failed. Amount: $${totalCached.toFixed(2)}, Error: ${error.message}`
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
          action: 'cron_cache_cleared',
          message: `Vercel Cron daily postback completed successfully. Cache cleared: ${clearedRows} entries. Total sent: $${totalCached.toFixed(2)}`
        });
  
        return {
          success: true,
          message: 'Daily postback sent successfully and cache cleared',
          totalAmount: totalCached,
          clearedEntries: clearedRows,
          clickidUsed: primaryClickid,
          nyTime: nyTime.toLocaleString()
        };
      } else {
        await logConversion({
          clickid: primaryClickid,
          action: 'cron_postback_failed_final',
          message: `Vercel Cron daily postback failed. Cache NOT cleared. Amount: $${totalCached.toFixed(2)}, Error: ${errorMessage}`
        });
  
        return {
          success: false,
          message: 'Daily postback failed - cache not cleared',
          totalAmount: totalCached,
          error: errorMessage,
          clickidUsed: primaryClickid,
          nyTime: nyTime.toLocaleString()
        };
      }
  
    } catch (error) {
      console.error('Execute daily postback error:', error);
      
      await logConversion({
        clickid: 'vercel-cron',
        action: 'cron_execution_error',
        message: `Vercel Cron execution error: ${error.message}`
      });
  
      return { 
        success: false,
        error: error.message,
        message: 'Daily postback execution error'
      };
    }
  }
  
  async function checkIfAlreadyRanToday() {
    const pool = getPool();
    try {
      // Check if we've already run a successful cron postback today
      const [rows] = await pool.execute(`
        SELECT COUNT(*) as count FROM conversion_logs 
        WHERE action IN ('cron_postback_success', 'cron_cache_cleared') 
        AND DATE(created_at) = CURDATE()
      `);
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error checking daily run status:', error);
      return false; // If we can't check, allow the run
    }
  }