package com.ablpayroll.system;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {
    private static final String TAG = "AppUpdatePlugin";
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS    = 15000;
    private static final int MAX_REDIRECTS      = 10;

    private Thread downloadThread = null;
    private volatile boolean isCancelled = false;

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY: connectivity check
    // ─────────────────────────────────────────────────────────────────────────
    private boolean isConnected() {
        try {
            ConnectivityManager cm = (ConnectivityManager)
                    getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            NetworkInfo ni = cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        } catch (Exception e) {
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY: follow redirects manually (handles http→https cross-protocol)
    // ─────────────────────────────────────────────────────────────────────────
    private HttpURLConnection openWithRedirects(String urlString) throws Exception {
        String currentUrl = urlString;
        int redirects = 0;

        while (redirects < MAX_REDIRECTS) {
            Log.d(TAG, "[fetchUrl] Attempting URL: " + currentUrl);
            URL url = new URL(currentUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setInstanceFollowRedirects(false); // we handle redirects manually
            conn.setRequestProperty("User-Agent", "ABLPayrollAndroid/1.0");
            conn.setRequestProperty("Accept", "application/json, */*");
            conn.connect();

            int code = conn.getResponseCode();
            Log.d(TAG, "[fetchUrl] HTTP " + code + " from: " + currentUrl);

            if (code == HttpURLConnection.HTTP_MOVED_PERM
                    || code == HttpURLConnection.HTTP_MOVED_TEMP
                    || code == 307
                    || code == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new Exception("Redirect with no Location header from: " + currentUrl);
                }
                // Handle relative redirects
                if (!location.startsWith("http")) {
                    URL base = new URL(currentUrl);
                    location = base.getProtocol() + "://" + base.getHost() + location;
                }
                Log.d(TAG, "[fetchUrl] Redirect → " + location);
                currentUrl = location;
                redirects++;
                continue;
            }

            return conn; // caller must disconnect
        }
        throw new Exception("Too many redirects (>" + MAX_REDIRECTS + ") for: " + urlString);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getAppVersion
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void getAppVersion(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo pInfo = pm.getPackageInfo(context.getPackageName(), 0);

            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = pInfo.getLongVersionCode();
            } else {
                //noinspection deprecation
                versionCode = pInfo.versionCode;
            }

            JSObject ret = new JSObject();
            ret.put("versionName", pInfo.versionName);
            ret.put("versionCode", versionCode);
            ret.put("packageName", context.getPackageName());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get app version: " + e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // checkConnectivity  — called from JS before any network operation
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void checkConnectivity(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isConnected", isConnected());
        call.resolve(ret);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // fetchUrl — native HTTP GET, follows redirects, full error detail
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void fetchUrl(PluginCall call) {
        final String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("url parameter is required");
            return;
        }

        new Thread(() -> {
            // 1. Connectivity gate
            if (!isConnected()) {
                Log.w(TAG, "[fetchUrl] No internet connection");
                call.reject("NO_INTERNET: No internet connection. Please connect to WiFi or mobile data and try again.");
                return;
            }

            HttpURLConnection connection = null;
            long startTime = System.currentTimeMillis();

            try {
                Log.d(TAG, "[fetchUrl] Starting request: " + urlString);
                connection = openWithRedirects(urlString);

                int responseCode = connection.getResponseCode();
                long elapsed = System.currentTimeMillis() - startTime;
                Log.d(TAG, "[fetchUrl] Final HTTP " + responseCode + " in " + elapsed + "ms");

                if (responseCode == HttpURLConnection.HTTP_OK) {
                    InputStream in = connection.getInputStream();
                    java.util.Scanner s = new java.util.Scanner(in, "UTF-8").useDelimiter("\\A");
                    String result = s.hasNext() ? s.next() : "";
                    in.close();

                    Log.d(TAG, "[fetchUrl] Response length: " + result.length() + " chars");
                    Log.d(TAG, "[fetchUrl] Response preview: " +
                            (result.length() > 200 ? result.substring(0, 200) + "..." : result));

                    JSObject ret = new JSObject();
                    ret.put("status", responseCode);
                    ret.put("data", result);
                    ret.put("responseTime", elapsed);
                    call.resolve(ret);

                } else if (responseCode == HttpURLConnection.HTTP_NOT_FOUND) {
                    call.reject("HTTP_404: version.json not found on server. Ensure the file is uploaded to GitHub Releases.");
                } else if (responseCode == HttpURLConnection.HTTP_FORBIDDEN) {
                    call.reject("HTTP_403: Access forbidden. The file may be private or the GitHub API rate limit was exceeded.");
                } else if (responseCode == 429) {
                    call.reject("HTTP_429: GitHub API rate limit exceeded. Please wait a few minutes and try again.");
                } else if (responseCode >= 500) {
                    call.reject("HTTP_" + responseCode + ": GitHub server error. Please try again later.");
                } else {
                    call.reject("HTTP_" + responseCode + ": Unexpected server response.");
                }

            } catch (UnknownHostException e) {
                Log.e(TAG, "[fetchUrl] DNS failure", e);
                call.reject("DNS_ERROR: Cannot reach GitHub servers. Check your internet connection. (" + e.getMessage() + ")");
            } catch (SocketTimeoutException e) {
                Log.e(TAG, "[fetchUrl] Timeout", e);
                call.reject("TIMEOUT: The request timed out after " + CONNECT_TIMEOUT_MS / 1000 + "s. Check your connection speed.");
            } catch (Exception e) {
                Log.e(TAG, "[fetchUrl] Exception", e);
                call.reject("NETWORK_ERROR: " + e.getMessage());
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // downloadApk — with redirect-following, resume, progress events
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void downloadApk(PluginCall call) {
        final String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("url parameter is required");
            return;
        }

        synchronized (this) {
            if (downloadThread != null && downloadThread.isAlive()) {
                call.reject("A download is already in progress");
                return;
            }
            isCancelled = false;
        }

        downloadThread = new Thread(() -> {
            if (!isConnected()) {
                JSObject errorObj = new JSObject();
                errorObj.put("status", "failed");
                errorObj.put("message", "No internet connection. Connect to WiFi or mobile data.");
                notifyListeners("downloadProgress", errorObj);
                return;
            }

            InputStream input = null;
            FileOutputStream output = null;
            HttpURLConnection connection = null;

            try {
                Context context = getContext();
                File cacheDir = context.getExternalCacheDir();
                if (cacheDir == null) cacheDir = context.getCacheDir();
                File apkFile = new File(cacheDir, "update.apk");

                // Resolve final redirect URL first
                String resolvedUrl = resolveRedirectUrl(urlString);
                Log.d(TAG, "[downloadApk] Final URL: " + resolvedUrl);

                URL url = new URL(resolvedUrl);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "ABLPayrollAndroid/1.0");

                long existingLength = 0;
                if (apkFile.exists()) {
                    existingLength = apkFile.length();
                    connection.setRequestProperty("Range", "bytes=" + existingLength + "-");
                    Log.d(TAG, "[downloadApk] Resuming from byte " + existingLength);
                }

                connection.connect();
                int responseCode = connection.getResponseCode();
                Log.d(TAG, "[downloadApk] HTTP " + responseCode);

                long totalBytes;
                boolean append;

                if (responseCode == HttpURLConnection.HTTP_PARTIAL) {
                    append = true;
                    String rangeHeader = connection.getHeaderField("Content-Range");
                    totalBytes = parseContentRangeTotal(rangeHeader, existingLength,
                            connection.getContentLengthLong());
                } else if (responseCode == HttpURLConnection.HTTP_OK) {
                    append = false;
                    existingLength = 0;
                    totalBytes = connection.getContentLengthLong();
                } else {
                    // Range not satisfiable or other — restart
                    if (apkFile.exists()) apkFile.delete();
                    connection.disconnect();
                    connection = (HttpURLConnection) new URL(resolvedUrl).openConnection();
                    connection.setRequestMethod("GET");
                    connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                    connection.setReadTimeout(READ_TIMEOUT_MS);
                    connection.setRequestProperty("User-Agent", "ABLPayrollAndroid/1.0");
                    connection.connect();
                    responseCode = connection.getResponseCode();
                    if (responseCode != HttpURLConnection.HTTP_OK) {
                        throw new Exception("Server returned HTTP " + responseCode + " for APK download");
                    }
                    append = false;
                    existingLength = 0;
                    totalBytes = connection.getContentLengthLong();
                }

                input = connection.getInputStream();
                output = new FileOutputStream(apkFile, append);

                byte[] data = new byte[8192];
                long bytesDownloaded = existingLength;
                int count;
                long startTime = System.currentTimeMillis();
                long lastNotifyTime = 0;

                while ((count = input.read(data)) != -1) {
                    if (isCancelled) {
                        output.flush();
                        JSObject cancelObj = new JSObject();
                        cancelObj.put("status", "cancelled");
                        notifyListeners("downloadProgress", cancelObj);
                        return;
                    }
                    output.write(data, 0, count);
                    bytesDownloaded += count;

                    long now = System.currentTimeMillis();
                    if (now - lastNotifyTime > 200 || bytesDownloaded == totalBytes) {
                        lastNotifyTime = now;
                        long elapsed = now - startTime;
                        double speed = elapsed > 0
                                ? (double)(bytesDownloaded - existingLength) / (elapsed / 1000.0)
                                : 0;
                        long remaining = (speed > 0 && totalBytes > 0)
                                ? (long)((totalBytes - bytesDownloaded) / speed) : 0;

                        JSObject progressObj = new JSObject();
                        progressObj.put("status", "downloading");
                        progressObj.put("bytesDownloaded", bytesDownloaded);
                        progressObj.put("totalBytes", totalBytes);
                        progressObj.put("progress", totalBytes > 0
                                ? (double)bytesDownloaded / totalBytes : 0);
                        progressObj.put("speed", speed);
                        progressObj.put("timeRemaining", remaining);
                        notifyListeners("downloadProgress", progressObj);
                    }
                }

                output.flush();
                Log.d(TAG, "[downloadApk] Completed: " + apkFile.getAbsolutePath()
                        + " (" + apkFile.length() + " bytes)");

                JSObject doneObj = new JSObject();
                doneObj.put("status", "completed");
                doneObj.put("filePath", apkFile.getAbsolutePath());
                doneObj.put("fileSize", apkFile.length());
                notifyListeners("downloadProgress", doneObj);

            } catch (Exception e) {
                Log.e(TAG, "[downloadApk] Failed", e);
                JSObject errorObj = new JSObject();
                errorObj.put("status", "failed");
                errorObj.put("message", e.getMessage());
                notifyListeners("downloadProgress", errorObj);
            } finally {
                try { if (input  != null) input.close();  } catch (Exception ignored) {}
                try { if (output != null) output.close(); } catch (Exception ignored) {}
                if (connection != null) connection.disconnect();
            }
        });
        downloadThread.start();

        JSObject ret = new JSObject();
        ret.put("status", "started");
        call.resolve(ret);
    }

    /** Resolve a URL through redirects and return the final destination URL string. */
    private String resolveRedirectUrl(String urlString) throws Exception {
        String current = urlString;
        for (int i = 0; i < MAX_REDIRECTS; i++) {
            URL url = new URL(current);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(READ_TIMEOUT_MS);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("User-Agent", "ABLPayrollAndroid/1.0");
            conn.connect();
            int code = conn.getResponseCode();
            conn.disconnect();
            if (code >= 300 && code < 400) {
                String loc = conn.getHeaderField("Location");
                if (loc == null || loc.isEmpty()) break;
                if (!loc.startsWith("http")) {
                    URL base = new URL(current);
                    loc = base.getProtocol() + "://" + base.getHost() + loc;
                }
                current = loc;
            } else {
                break;
            }
        }
        return current;
    }

    private long parseContentRangeTotal(String rangeHeader, long existingLength, long contentLength) {
        if (rangeHeader != null) {
            try {
                String[] parts = rangeHeader.split("/");
                if (parts.length > 1) return Long.parseLong(parts[1].trim());
            } catch (Exception ignored) {}
        }
        return contentLength + existingLength;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // cancelDownload
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void cancelDownload(PluginCall call) {
        isCancelled = true;
        JSObject ret = new JSObject();
        ret.put("status", "cancelling");
        call.resolve(ret);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // verifyApk
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void verifyApk(PluginCall call) {
        String filePath = call.getString("filePath");
        String expectedChecksum = call.getString("expectedChecksum");
        Integer expectedVersionCode = call.getInt("expectedVersionCode");

        if (filePath == null) { call.reject("filePath is required"); return; }

        File file = new File(filePath);
        if (!file.exists()) {
            JSObject ret = new JSObject();
            ret.put("valid", false);
            ret.put("reason", "APK file does not exist at: " + filePath);
            call.resolve(ret); return;
        }

        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo info = pm.getPackageArchiveInfo(filePath, 0);

            if (info == null) {
                JSObject ret = new JSObject();
                ret.put("valid", false);
                ret.put("reason", "APK is corrupt or invalid — cannot parse package archive");
                call.resolve(ret); return;
            }

            if (!info.packageName.equals(context.getPackageName())) {
                JSObject ret = new JSObject();
                ret.put("valid", false);
                ret.put("reason", "Package mismatch: APK is '" + info.packageName
                        + "', expected '" + context.getPackageName() + "'");
                call.resolve(ret); return;
            }

            if (expectedVersionCode != null) {
                long apkCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                        ? info.getLongVersionCode()
                        : //noinspection deprecation
                        info.versionCode;
                if (apkCode != expectedVersionCode) {
                    JSObject ret = new JSObject();
                    ret.put("valid", false);
                    ret.put("reason", "Version code mismatch: APK has " + apkCode
                            + ", expected " + expectedVersionCode);
                    call.resolve(ret); return;
                }
            }

            if (expectedChecksum != null && !expectedChecksum.isEmpty()) {
                String checksum = calculateSHA256(file);
                if (!checksum.equalsIgnoreCase(expectedChecksum)) {
                    JSObject ret = new JSObject();
                    ret.put("valid", false);
                    ret.put("reason", "SHA-256 mismatch: got " + checksum);
                    call.resolve(ret); return;
                }
            }

            JSObject ret = new JSObject();
            ret.put("valid", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("valid", false);
            ret.put("reason", "Verification error: " + e.getMessage());
            call.resolve(ret);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // installApk
    // ─────────────────────────────────────────────────────────────────────────
    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null) { call.reject("filePath is required"); return; }

        File file = new File(filePath);
        if (!file.exists()) { call.reject("APK not found at: " + filePath); return; }

        try {
            Context context = getContext();
            Intent intent = new Intent(Intent.ACTION_VIEW);
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(context,
                        context.getPackageName() + ".fileprovider", file);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                apkUri = Uri.fromFile(file);
            }
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            JSObject ret = new JSObject();
            ret.put("status", "launched");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to launch installer: " + e.getMessage(), e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SHA-256 helper
    // ─────────────────────────────────────────────────────────────────────────
    private String calculateSHA256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = fis.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        byte[] hash = digest.digest();
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) sb.append('0');
            sb.append(hex);
        }
        return sb.toString();
    }
}
