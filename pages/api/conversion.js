// File: pages/api/conversion.js
import {
  initializeDatabase,
  addCachedConversion,
  getCachedTotal,
  getGlobalCachedTotal,
  clearAllCachedConversions,
  logConversion,
  logPostback
 } from '../../lib/database.js';
 
 export default async function handler(req, res) {
  try {
    await initializeDatabase();
    

    
    const { clickid, sum } = req.query;
    const sumValue = parseFloat(sum || 0);
    
    await logConversion({
      clickid,
      original_amount: sumValue,
      action: 'request_received',
      message: `Request received: clickid=${clickid}, sum=${sum}`
    });
    
    if (!clickid || sumValue <= 0) {
      await logConversion({
        clickid,
        original_amount: sumValue,
        action: 'validation_failed',
        message: `Invalid input rejected: clickid=${clickid}, sum=${sum}`
      });
      return res.status(200).send("0");
    }
    
    const cachedTotal = await getCachedTotal();
    
    await logConversion({
      clickid,
      original_amount: sumValue,
      cached_amount: cachedTotal,
      action: 'cache_loaded',
      message: `GLOBAL cached total: $${cachedTotal.toFixed(2)}, New conversion: $${sumValue.toFixed(2)}`
    });
    
    if (sumValue < 10) {
      await addCachedConversion(clickid, sumValue);
      const newCachedTotal = await getGlobalCachedTotal();
      
      await logConversion({
        clickid,
        original_amount: sumValue,
        cached_amount: newCachedTotal,
        action: 'cached_conversion',
        message: `Cached sub-$10 conversion ($${sumValue.toFixed(2)}). New GLOBAL total cached: $${newCachedTotal.toFixed(2)}`
      });
      
      return res.status(200).send("1");
    }
    
    const totalToSend = sumValue + cachedTotal;
    const redtrackUrl = `https://clks.trackthisclicks.com/postback?clickid=${encodeURIComponent(clickid)}&sum=${encodeURIComponent(totalToSend)}`;
    
    await logConversion({
      clickid,
      original_amount: sumValue,
      cached_amount: cachedTotal,
      total_sent: totalToSend,
      action: 'preparing_postback',
      message: `Preparing to send postback to RedTrack. Total: $${totalToSend.toFixed(2)} (Current conversion: $${sumValue.toFixed(2)} + Global cache: $${cachedTotal.toFixed(2)}), clickid: ${clickid}`
    });
    
    if (cachedTotal > 0) {
      const clearedRows = await clearAllCachedConversions();
      
      await logConversion({
        clickid,
        original_amount: sumValue,
        cached_amount: cachedTotal,
        total_sent: totalToSend,
        action: 'global_cache_cleared',
        message: `GLOBAL cache cleared before postback. Removed ${clearedRows} cached entries from ALL clickids. Total to send: $${totalToSend.toFixed(2)}`
      });
    }
    
    let postbackSuccess = false;
    let responseText = '';
    let errorMessage = null;
    
    try {
      const response = await fetch(redtrackUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      responseText = await response.text();
      postbackSuccess = true;
      
      await logConversion({
        clickid,
        original_amount: sumValue,
        cached_amount: cachedTotal,
        total_sent: totalToSend,
        action: 'postback_success',
        message: `Postback successful. Response: ${responseText}`
      });
      
    } catch (error) {
      errorMessage = error.message;
      
      await logConversion({
        clickid,
        original_amount: sumValue,
        cached_amount: cachedTotal,
        total_sent: totalToSend,
        action: 'postback_failed',
        message: `Error sending postback: ${error.message}`
      });
    }
    
    await logPostback(clickid, totalToSend, redtrackUrl, postbackSuccess, responseText, errorMessage);
    
    if (postbackSuccess) {
      return res.status(200).send("2");
    } else {
      return res.status(200).send("3");
    }
    
  } catch (error) {
    console.error('Database error:', error);
    
    try {
      await logConversion({
        clickid: req.query.clickid,
        action: 'system_error',
        message: `System error: ${error.message}`
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return res.status(200).send("4");
  }
 }