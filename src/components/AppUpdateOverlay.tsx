import { useEffect, useState } from "react";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, RefreshCw, XCircle, ArrowUpCircle } from "lucide-react";

export default function AppUpdateOverlay() {
  const {
    isSupported,
    currentBuild,
    latestVersionInfo,
    releaseNotes,
    downloadProgress,
    checkForUpdates,
    startDownload,
    cancelDownload,
    formatSpeed,
    formatTime,
    formatSize,
  } = useAppUpdate();

  const [isOpen, setIsOpen] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // Run update check on startup (once per app session)
    if (!hasChecked) {
      setHasChecked(true);
      const runCheck = async () => {
        // Respect "Later" button for this session
        if (sessionStorage.getItem("abl_update_later") === "1") {
          return;
        }
        const info = await checkForUpdates(true);
        if (info && info.versionCode > currentBuild) {
          setIsOpen(true);
        }
      };
      // Delay slightly to not block splash screens/other starts
      const timer = setTimeout(runCheck, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasChecked, currentBuild, checkForUpdates]);

  const handleLater = () => {
    sessionStorage.setItem("abl_update_later", "1");
    setIsOpen(false);
  };

  const handleUpdateNow = () => {
    startDownload();
  };

  // If download fails or is cancelled, allow closing/later
  const isDownloading = downloadProgress.status === "downloading";
  const isCompleted = downloadProgress.status === "completed";

  if (!isOpen || !latestVersionInfo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Prevent closing by clicking outside if downloading
      if (!isDownloading) {
        setIsOpen(open);
      }
    }}>
      <DialogContent className="max-w-md border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold font-display text-primary animate-pulse">
            <ArrowUpCircle className="w-6 h-6 text-primary" />
            New Update Available
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="flex flex-col gap-1 text-sm bg-muted/20 border border-muted p-3 rounded-lg">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Version:</span>
              <span className="font-bold font-mono text-primary">{latestVersionInfo.versionName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Release Date:</span>
              <span className="font-bold">{latestVersionInfo.releaseDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Build Number:</span>
              <span className="font-bold font-mono">{latestVersionInfo.versionCode}</span>
            </div>
            {latestVersionInfo.apkSize && (
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">APK Size:</span>
                <span className="font-bold font-mono">{latestVersionInfo.apkSize}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Changes:</h4>
            <div className="max-h-40 overflow-y-auto border border-border/50 rounded-lg p-3 bg-muted/10">
              {releaseNotes && releaseNotes.changes && releaseNotes.changes.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-foreground/90">
                  {releaseNotes.changes.map((change, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-1.5 text-sm text-foreground/90">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>Payroll Improvements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>Attendance Improvements</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span>Bug Fixes</span>
                  </li>
                </ul>
              )}
            </div>
          </div>

          {/* Download Progress Bar Section */}
          {downloadProgress.status === "downloading" && (
            <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-primary">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Downloading Update...
                </span>
                <span>{Math.round(downloadProgress.progress * 100)}%</span>
              </div>
              <Progress value={downloadProgress.progress * 100} className="h-2" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-muted-foreground font-mono">
                <div>{formatSize(downloadProgress.bytesDownloaded)} / {formatSize(downloadProgress.totalBytes)}</div>
                <div>{formatSpeed(downloadProgress.speed)}</div>
                <div>{formatTime(downloadProgress.timeRemaining)}</div>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" variant="outline" onClick={cancelDownload} className="text-destructive border-destructive text-[11px] h-7 px-2 hover:bg-destructive/10">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {downloadProgress.status === "failed" && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block">Download failed:</strong>
                {downloadProgress.message || "Please check your network and try again."}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="ghost"
              onClick={handleLater}
              disabled={isDownloading}
              className="text-muted-foreground hover:bg-muted"
            >
              Later
            </Button>
            <Button
              onClick={handleUpdateNow}
              disabled={isDownloading || isCompleted}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold"
            >
              <Download className="w-4 h-4" />
              Update Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
