import { supabase } from "@/integrations/supabase/client";
import { offlineExecute, offlineQuery } from "@/lib/offlineDb";

export interface ErrorLogDetails {
  module: string;
  functionName: string;
  errorMessage: string;
  stackTrace?: string;
  userId?: string;
  employeeId?: string;
  gpsStatus?: string;
  severity?: "low" | "medium" | "high" | "critical";
  context?: any;
}

class ErrorLoggingService {
  async log(details: ErrorLogDetails) {
    const isOnline = navigator.onLine;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const device = isMobile ? "Mobile" : "Desktop";
    const userAgent = navigator.userAgent;
    let osVersion = "Unknown";
    if (userAgent.indexOf("Windows NT 10.0") !== -1) osVersion = "Windows 10/11";
    else if (userAgent.indexOf("Android") !== -1) {
      const match = userAgent.match(/Android\s([0-9\.]*)/);
      osVersion = match ? `Android ${match[1]}` : "Android";
    }

    const browser = navigator.userAgent.split(" ").pop() || "Unknown";
    
    const logEntry = {
      id: crypto.randomUUID(),
      module: details.module,
      function_name: details.functionName,
      error_message: details.errorMessage,
      stack_trace: details.stackTrace || new Error().stack || "",
      user_id: details.userId || "",
      employee_id: details.employeeId || "",
      device: device,
      os_version: osVersion,
      browser: browser,
      internet_status: isOnline ? "Online" : "Offline",
      gps_status: details.gpsStatus || "Unknown",
      sqlite_status: "Active", // Assuming if we reach here we can use it
      supabase_status: isOnline ? "Active" : "Unreachable",
      sync_status: isOnline ? "Synced" : "Pending",
      severity: details.severity || "high",
      created_at: new Date().toISOString()
    };

    try {
      // 1. Try Supabase if online
      if (isOnline) {
        const { error } = await supabase.from('system_logs').insert([logEntry]);
        if (error) {
          console.warn("Failed to log to Supabase. Falling back to SQLite.", error);
          await this.logToSQLite(logEntry);
        }
      } else {
        // 2. Offline -> SQLite
        await this.logToSQLite(logEntry);
      }
    } catch (e) {
      console.error("Global Error Logging completely failed", e);
      // Last resort: attempt local DB anyway
      try {
        await this.logToSQLite(logEntry);
      } catch (innerError) {
        console.error("SQLite logging also failed", innerError);
      }
    }
  }

  private async logToSQLite(log: any) {
    const sql = `
      INSERT INTO system_logs (
        id, module, function_name, error_message, stack_trace, user_id, employee_id, device, os_version, browser, internet_status, gps_status, sqlite_status, supabase_status, sync_status, severity, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      log.id, log.module, log.function_name, log.error_message, log.stack_trace, log.user_id, log.employee_id, log.device, log.os_version, log.browser, log.internet_status, log.gps_status, log.sqlite_status, log.supabase_status, "Pending", log.severity, log.created_at
    ];
    await offlineExecute(sql, params);
  }
}

export const errorLogger = new ErrorLoggingService();
