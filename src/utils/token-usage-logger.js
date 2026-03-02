const fs = require('fs');
const path = require('path');

/**
 * จัดการประวัติการใช้ Token ของ Gemini
 */
class TokenUsageLogger {
  constructor() {
    this.logDir = './logs';
    this.logFile = path.join(this.logDir, 'token-usage.log');
    this.ensureLogDirectory();
  }

  /**
   * สร้างโฟลเดอร์ logs ถ้ายังไม่มี
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * บันทึกการใช้ Token
   * @param {Object} usageData - ข้อมูลการใช้ Token
   * @param {string} usageData.fileName - ชื่อไฟล์ที่ประมวลผล
   * @param {string} usageData.fileType - ประเภทไฟล์
   * @param {number} usageData.inputTokens - Input tokens
   * @param {number} usageData.outputTokens - Output tokens
   * @param {number} usageData.totalTokens - Total tokens
   * @param {number} usageData.processingTime - เวลาประมวลผล (ms)
   * @param {string} usageData.extractedLength - ความยาวข้อความที่ดึงได้
   */
  logUsage(usageData) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...usageData
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(this.logFile, logLine);
      console.log(`📊 Token usage logged for ${usageData.fileName}`);
    } catch (error) {
      console.warn('⚠️ Failed to log token usage:', error.message);
    }
  }

  /**
   * อ่านประวัติการใช้ Token ทั้งหมด
   * @param {string} period - ระยะเวลา: 'today', 'week', 'month', 'all'
   * @returns {Array} - รายการประวัติการใช้ Token
   */
  getUsageHistory(period = 'all') {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);
      
      const logs = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter(log => log !== null);

      // กรองตามช่วงเวลา
      let filteredLogs = logs;
      const now = new Date();
      
      if (period === 'today') {
        // ใช้ UTC time เพื่อให้ตรงกับ timestamp ใน log
        const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        filteredLogs = logs.filter(log => {
          const logDate = new Date(log.timestamp);
          return logDate >= todayUTC;
        });
      } else if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredLogs = logs.filter(log => new Date(log.timestamp) >= weekAgo);
      } else if (period === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredLogs = logs.filter(log => new Date(log.timestamp) >= monthAgo);
      }

      // เรียงจากล่าสุด (ไม่จำกัดจำนวน)
      return filteredLogs.reverse();
    } catch (error) {
      console.warn('⚠️ Failed to read usage history:', error.message);
      return [];
    }
  }

  /**
   * สรุปสถิติการใช้ Token
   * @param {string} period - ระยะเวลา: 'today', 'week', 'month', 'all'
   * @returns {Object} - สถิติการใช้ Token
   */
  getUsageStats(period = 'all') {
    const logs = this.getUsageHistory(period); // ดึงข้อมูลทั้งหมดตามช่วงเวลา
    
    if (logs.length === 0) {
      return {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        averageTokensPerRequest: 0,
        totalFilesProcessed: 0,
        totalCost: 0,
        period
      };
    }

    const stats = {
      totalRequests: logs.length,
      totalInputTokens: logs.reduce((sum, log) => sum + (log.inputTokens || 0), 0),
      totalOutputTokens: logs.reduce((sum, log) => sum + (log.outputTokens || 0), 0),
      totalFilesProcessed: logs.length,
      period
    };

    stats.totalTokens = stats.totalInputTokens + stats.totalOutputTokens;
    stats.averageTokensPerRequest = Math.round(stats.totalTokens / stats.totalRequests);
    
    // คำนวณค่าใช้จ่าย (Gemini 2.0 Flash pricing: $0.075/1M input tokens, $0.30/1M output tokens)
    const inputCostPerMillion = 0.075;
    const outputCostPerMillion = 0.30;
    const exchangeRate = 32; // 32 THB per USD
    
    const costUSD = (stats.totalInputTokens / 1000000) * inputCostPerMillion + 
                   (stats.totalOutputTokens / 1000000) * outputCostPerMillion;
    
    stats.totalCost = costUSD;
    stats.totalCostTHB = costUSD * exchangeRate;

    // จัดกลุ่มตามประเภทไฟล์
    stats.byFileType = {};
    logs.forEach(log => {
      const type = log.fileType || 'unknown';
      if (!stats.byFileType[type]) {
        stats.byFileType[type] = {
          count: 0,
          tokens: 0
        };
      }
      stats.byFileType[type].count++;
      stats.byFileType[type].tokens += log.totalTokens || 0;
    });

    return stats;
  }

  /**
   * ล้างประวัติเก่ากว่าที่กำหนด
   * @param {number} days - จำนวนวันที่ต้องการเก็บไว้
   */
  cleanupOldLogs(days = 30) {
    try {
      if (!fs.existsSync(this.logFile)) return;

      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);
      
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const filteredLines = lines.filter(line => {
        try {
          const log = JSON.parse(line);
          return new Date(log.timestamp) >= cutoffDate;
        } catch {
          return false;
        }
      });

      fs.writeFileSync(this.logFile, filteredLines.join('\n') + '\n');
      console.log(`🧹 Cleaned up token usage logs (kept last ${days} days)`);
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old logs:', error.message);
    }
  }

  /**
   * สร้างรายงานการใช้ Token ในรูปแบบข้อความ
   * @param {string} period - ระยะเวลา
   * @returns {string} - รายงานในรูปแบบข้อความ
   */
  generateReport(period = 'today') {
    const stats = this.getUsageStats(period);
    const recentLogs = this.getUsageHistory(10);

    let report = `\n📊 Gemini Token Usage Report - ${period.toUpperCase()}\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    report += `📈 Summary:\n`;
    report += `   • Total Requests: ${stats.totalRequests}\n`;
    report += `   • Total Input Tokens: ${stats.totalInputTokens.toLocaleString()}\n`;
    report += `   • Total Output Tokens: ${stats.totalOutputTokens.toLocaleString()}\n`;
    report += `   • Total Tokens: ${stats.totalTokens.toLocaleString()}\n`;
    report += `   • Average per Request: ${stats.averageTokensPerRequest.toLocaleString()}\n\n`;

    if (stats.byFileType && Object.keys(stats.byFileType).length > 0) {
      report += `📁 By File Type:\n`;
      Object.entries(stats.byFileType).forEach(([type, data]) => {
        report += `   • ${type}: ${data.count} files, ${data.tokens.toLocaleString()} tokens\n`;
      });
      report += '\n';
    }

    report += `🕒 Recent Activity (last 10):\n`;
    recentLogs.forEach((log, index) => {
      const time = new Date(log.timestamp).toLocaleString('th-TH');
      report += `   ${index + 1}. ${time} - ${log.fileName} (${log.totalTokens || 0} tokens)\n`;
    });

    return report;
  }
}

// Singleton instance
const tokenUsageLogger = new TokenUsageLogger();

module.exports = tokenUsageLogger;
