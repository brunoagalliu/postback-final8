// File: pages/api/admin/manual-daily-postback.js
import { logConversion } from '../../../lib/database.js';

// Import the execution function directly to bypass time checks
async function executeDailyPostback() {
  const { getPool, logPostback, clearAllCachedConversions, getGlobalCachedTotal } = await import('../../../lib/database.js');
  
  try {
    const totalCached = await getGlobalCachedTotal();

    if (totalCached <= 0) {
      await logConversion({
        clickid: 'manual-admin',
        action: 'manual_no_cache',
        message: `Manual trigger: No cached conversions found (total: $${totalCached.toFixed(2)})`
      });
      
      return {
        success: true,
        message: 'No cached conversions to process',
        totalAmount: totalCached
      };
    }

    const pool = getPool();
    const [clickidResult] = await pool.execute(`
      SELECT clickid FROM cached_conversions 
      ORDER BY created_at DESC 
      LIMIT 1
    `);

    const primaryClickid = clickidResult[0]?.clickid || 'manual-trigger';

    await logConversion({
      clickid: primaryClickid,
      action: 'manual_postback_preparing',
      cached_amount: totalCached,
      total_sent: totalCached,
      message: `Manual daily postback triggered by admin. Total cached: $${totalCached.toFixed(2)}, using clickid: ${primaryClickid}`
    });

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
        action: 'manual_postback_success',
        cached_amount: totalCached,
        total_sent: totalCached,
        message: `Manual daily postback successful. Amount: $${totalCached.toFixed(2)}, Response: ${responseText}`
      });

    } catch (error) {
      errorMessage = error.message;
      postbackSuccess = false;

      await logConversion({
        clickid: primaryClickid,
        action: 'manual_postback_failed',
        cached_amount: totalCached,
        total_sent: totalCached,
        message: `Manual daily postback failed. Amount: $${totalCached.toFixed(2)}, Error: ${error.message}`
      });
    }

    await logPostback(primaryClickid, totalCached, redtrackUrl, postbackSuccess, responseText, errorMessage);

    if (postbackSuccess) {
      const clearedRows = await clearAllCachedConversions();

      await logConversion({
        clickid: primaryClickid,
        action: 'manual_cache_cleared',
        message: `Manual daily postback completed successfully. Cache cleared: ${clearedRows} entries. Total sent: $${totalCached.toFixed(2)}`
      });

      return {
        success: true,
        message: 'Manual daily postback sent successfully and cache cleared',
        totalAmount: totalCached,
        clearedEntries: clearedRows,
        clickidUsed: primaryClickid
      };
    } else {
      return {
        success: false,
        message: 'Manual daily postback failed - cache not cleared',
        totalAmount: totalCached,
        error: errorMessage,
        clickidUsed: primaryClickid
      };
    }

  } catch (error) {
    await logConversion({
      clickid: 'manual-admin',
      action: 'manual_execution_error',
      message: `Manual daily postback execution error: ${error.message}`
    });

    return { 
      success: false,
      error: error.message,
      message: 'Manual daily postback execution error'
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await logConversion({
      clickid: 'manual-admin',
      action: 'manual_trigger_start',
      message: 'Admin manually triggered daily postback'
    });

    const result = await executeDailyPostback();
    
    return res.status(result.success ? 200 : 500).json({
      triggered: true,
      timestamp: new Date().toISOString(),
      ...result
    });

  } catch (error) {
    console.error('Error in manual daily postback trigger:', error);
    
    await logConversion({
      clickid: 'manual-admin',
      action: 'manual_trigger_error',
      message: `Manual trigger error: ${error.message}`
    });

    return res.status(500).json({ 
      error: error.message,
      message: 'Failed to trigger manual daily postback'
    });
  }
}