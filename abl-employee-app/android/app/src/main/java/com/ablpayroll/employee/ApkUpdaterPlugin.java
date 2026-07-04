package com.ablpayroll.employee;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private long downloadId = -1;
    private BroadcastReceiver onDownloadComplete;
    private Handler handler;
    private Runnable progressRunnable;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("Must provide an APK url");
            return;
        }

        Context context = getContext();
        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle("Downloading Update");
        request.setDescription("Please wait...");
        request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, "update.apk");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);

        // Delete old file if exists
        File file = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "update.apk");
        if (file.exists()) {
            file.delete();
        }

        DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        downloadId = manager.enqueue(request);

        if (onDownloadComplete == null) {
            onDownloadComplete = new BroadcastReceiver() {
                public void onReceive(Context ctxt, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (downloadId == id) {
                        installApk(file);
                        JSObject ret = new JSObject();
                        ret.put("status", "completed");
                        notifyListeners("downloadProgress", ret);
                        call.resolve();
                        stopProgressTimer();
                    }
                }
            };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED);
            } else {
                context.registerReceiver(onDownloadComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
            }
        }

        startProgressTimer(manager, downloadId);
    }

    private void startProgressTimer(final DownloadManager manager, final long downloadId) {
        handler = new Handler(Looper.getMainLooper());
        progressRunnable = new Runnable() {
            @Override
            public void run() {
                DownloadManager.Query q = new DownloadManager.Query();
                q.setFilterById(downloadId);
                Cursor cursor = manager.query(q);
                if (cursor != null && cursor.moveToFirst()) {
                    int bytesDownloadedIndex = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                    int bytesTotalIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                    if (bytesDownloadedIndex >= 0 && bytesTotalIndex >= 0) {
                        long bytesDownloaded = cursor.getInt(bytesDownloadedIndex);
                        long bytesTotal = cursor.getInt(bytesTotalIndex);
                        if (bytesTotal > 0) {
                            double progress = (bytesDownloaded * 100.0) / bytesTotal;
                            JSObject ret = new JSObject();
                            ret.put("status", "downloading");
                            ret.put("progress", progress);
                            notifyListeners("downloadProgress", ret);
                        }
                    }
                    cursor.close();
                }
                handler.postDelayed(this, 1000);
            }
        };
        handler.post(progressRunnable);
    }

    private void stopProgressTimer() {
        if (handler != null && progressRunnable != null) {
            handler.removeCallbacks(progressRunnable);
        }
    }

    private void installApk(File file) {
        Context context = getContext();
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file), "application/vnd.android.package-archive");
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        context.startActivity(intent);
    }
}
