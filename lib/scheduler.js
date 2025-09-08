// File: lib/scheduler.js
import { getPool, logConversion, logPostback, clearAllCachedConversions, getGlobalCachedTotal } from './database.js';

// Track when we last ran the daily postback to avoid duplicates
let lastDailyRun = null;

export async function checkAndRunDailyPostback() {
  try {
    // Get current time in New York timezone
    const now = new Date();
    const nyTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const currentDateString = nyTime.toDateString(); // e.g., "Tue Jan 09 2024"
    
    // Check if we've already run today
    if (lastDailyRun === currentDateString) {
      return { skipped: true, reason: 'Already ran today' };
    }

    // Check if it's between 11:59 PM and 11:59:59 PM NY time
    const hour = nyTime.getHours();
    const minute = nyTime.getMinutes();
    
    const isTimeWindow = (hour === 23 && minute === 59);
    
    if (!isTimeWindow) {
      return { skipped: true, reason: `Not in time window. Current NY time: ${hour}:${minute.toString().padStart(2, '0')}` };
    }

    // Mark that we're running today to prevent duplicates
    lastDailyRun = currentDateString;

    await logConversion({
      clickid: 'auto-scheduler',
      action: 'daily_auto_trigger',
      message: `Auto-triggered daily postback at ${nyTime.toISOString()} NY time`
    });

    return await executeDailyPostback();

  } catch (error) {
    console.error('Daily scheduler check error:', error);
    
    await logConversion({
      clickid: 'auto-scheduler',
      action: 'daily_scheduler_error',
      message: `Daily scheduler error: ${error.message}`
    });

    return { success: false, error: error.message };
  }
}

async function executeDailyPostback() {
  try {
    // Check total cached amount
    const totalCached = await getGlobalCachedTotal();

    if (totalCached <= 0) {
      await logConversion({
        clickid: 'auto-scheduler',
        action: 'no_cache_to_process',
        message: `No cached conversions found (total: $${totalCached.toFixed(2)}). Daily postback completed with no action needed.`
      });
      
      return {
        success: true,
        message: 'No cached conversions to process',
        totalAmount: totalCached
      };
    }

    // Get a representative clickid for the postback (use the most recent one)
    const pool = getPool();
    const [clickidResult] = await pool.execute(`
      SELECT clickid FROM cached_conversions 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    const primaryClickid = clickidResult[0]?.clickid || 'auto-scheduler';

    await logConversion({
      clickid: primaryClickid,
      action: 'daily_postback_preparing',
      cached_amount: totalCached,
      total_sent: totalCached,
      message: `Preparing automated daily postback. Total cached: $${totalCached.toFixed(2)}, using clickid: ${primaryClickid}`
    });

    // Send the postback
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
        action: 'daily_postback_success',
        cached_amount: totalCached,
        total_sent: totalCached,
        message: `Automated daily postback successful. Amount: $${totalCached.toFixed(2)}, Response: ${responseText}`
      });

    } catch (error) {
      errorMessage = error.message;
      postbackSuccess = false;

      await logConversion({
        clickid: primaryClickid,
        action: 'daily_postback_failed',
        cached_amount: totalCached,
        total_sent: totalCached,
        message: `Automated daily postback failed. Amount: $${totalCached.toFixed(2)}, Error: ${error.message}`
      });
    }

    // Log the postback attempt
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
        action: 'daily_cache_cleared',
        message: `Automated daily postback completed successfully. Cache cleared: ${clearedRows} entries. Total sent: $${totalCached.toFixed(2)}`
      });

      return {
        success: true,
        message: 'Daily postback sent successfully and cache cleared',
        totalAmount: totalCached,
        clearedEntries: clearedRows,
        clickidUsed: primaryClickid
      };
    } else {
      await logConversion({
        clickid: primaryClickid,
        action: 'daily_postback_failed_final',
        message: `Automated daily postback failed. Cache NOT cleared. Amount: $${totalCached.toFixed(2)}, Error: ${errorMessage}`
      });

      return {
        success: false,
        message: 'Daily postback failed - cache not cleared',
        totalAmount: totalCached,
        error: errorMessage,
        clickidUsed: primaryClickid
      };
    }

  } catch (error) {
    console.error('Execute daily postback error:', error);
    
    await logConversion({
      clickid: 'auto-scheduler',
      action: 'daily_execution_error',
      message: `Daily postback execution error: ${error.message}`
    });

    return { 
      success: false,
      error: error.message,
      message: 'Daily postback execution error'
    };
  }
}