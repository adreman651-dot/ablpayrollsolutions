import { useState, useEffect, useCallback, useRef } from "react";
import { registerPlugin } from "@capacitor/core";
import { toast } from "sonner";

const AppUpdate = registerPlugin<any>("AppUpdate");

// ─── Public repo — version.json is committed to main branch ──────────────────
const VERSION_URLS = [
  // 1. Raw GitHub content — fastest, no auth, no redirect
  "https://raw.githubusercontent.com/adreman651-dot/ablpayrollsolutions/main/version.json",
  // 2. GitHub Pages fallback (if repo has Pages enabled)
  "https://adreman651-dot.github.io/ablpayrollsolutions/version.json",
];

const REPO_OWNER = "adreman651-dot";
const REPO_NAME  = "ablpayrollsolutions";
const GH_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

// ─── Interfaces ────────────────────────────────────────────────────────────
export interface VersionInfo {
  versionCode: number;
  versionName: string;
  minimumVersion: number;
  mandatory: boolean;
  releaseDate: string;
  apkUrl: string;
  releaseNotesUrl: string;
  apkSize?: string;
}

export interface ReleaseNotes {
  version: string;
  changes: string[];
}

export interface DownloadProgress {
  status: "idle" | "downloading" | "completed" | "failed" | "cancelled";
  progress: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number;
  timeRemaining: number;
  message?: string;
  filePath?: string;
}

// ─── JSON validator ──────────────────────────────────────────────────────────
function validateVersionJson(obj: any): { valid: boolean; reason?: string } {
  if (!obj || typeof obj !== "object") return { valid: false, reason: "JSON is not an object" };
  if (typeof obj.versionCode !== "number")
    return { valid: false, reason: "Missing or invalid 'versionCode' (must be number)" };
  if (typeof obj.versionName !== "string" || !obj.versionName)
    return { valid: false, reason: "Missing or invalid 'versionName' (must be string)" };
  if (typeof obj.apkUrl !== "string" || !obj.apkUrl.startsWith("http"))
    return { valid: false, reason: "Missing or invalid 'apkUrl' (must be https URL)" };
  if (typeof obj.releaseDate !== "string" || !obj.releaseDate)
    return { valid: false, reason: "Missing 'releaseDate'" };
  return { valid: true };
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useAppUpdate() {
  const [isSupported,       setIsSupported]       = useState(false);
  const [currentVersion,    setCurrentVersion]    = useState("1.0.0");
  const [currentBuild,      setCurrentBuild]      = useState(1);
  const [latestVersionInfo, setLatestVersionInfo] = useState<VersionInfo | null>(null);
  const [releaseNotes,      setReleaseNotes]      = useState<ReleaseNotes | null>(null);
  const [lastChecked,       setLastChecked]       = useState<string | null>(null);
  const [checking,          setChecking]          = useState(false);
  const [connectionStatus,  setConnectionStatus]  = useState<"unknown"|"online"|"offline">("unknown");
  const [githubStatus,      setGithubStatus]      = useState<string>("Not checked");
  const [debugLog,          setDebugLog]          = useState<string[]>([]);
  const [downloadProgress,  setDownloadProgress]  = useState<DownloadProgress>({
    status: "idle", progress: 0, bytesDownloaded: 0,
    totalBytes: 0, speed: 0, timeRemaining: 0,
  });

  const debugRef = useRef<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log("[AppUpdate]", msg);
    debugRef.current = [...debugRef.current.slice(-49), line];
    setDebugLog([...debugRef.current]);
  }, []);

  // ── Detect plugin support on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const v = await AppUpdate.getAppVersion();
        if (v?.versionName) {
          setCurrentVersion(v.versionName);
          setCurrentBuild(Number(v.versionCode));
          setIsSupported(true);
        }
      } catch {
        setIsSupported(false);
      }
    })();
  }, []);

  // ── Native connectivity check ───────────────────────────────────────────────
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    if (isSupported) {
      try {
        const r = await AppUpdate.checkConnectivity();
        const online = r?.isConnected === true;
        setConnectionStatus(online ? "online" : "offline");
        addLog(online ? "✓ Internet connected (native)" : "✗ No internet connection (native)");
        return online;
      } catch { /* fall through */ }
    }
    const online = navigator.onLine;
    setConnectionStatus(online ? "online" : "offline");
    addLog(online ? "✓ Internet connected (browser)" : "✗ No internet connection (browser)");
    return online;
  }, [isSupported, addLog]);

  // ── Native-first JSON fetch ─────────────────────────────────────────────────
  const fetchJson = useCallback(async (url: string): Promise<any> => {
    addLog(`→ GET ${url}`);
    const startMs = Date.now();

    if (isSupported) {
      try {
        const response = await AppUpdate.fetchUrl({ url });
        const elapsed = Date.now() - startMs;
        addLog(`← HTTP ${response.status} (${elapsed}ms) from ${url}`);

        if (response?.data) {
          let parsed: any;
          try {
            parsed = JSON.parse(response.data);
          } catch {
            throw new Error(`Invalid JSON from ${url}: ${response.data.substring(0, 100)}`);
          }
          addLog(`✓ JSON parsed OK`);
          return parsed;
        }
        throw new Error("Empty response body");
      } catch (err: any) {
        // If it's a connectivity/server error code from our plugin, re-throw cleanly
        if (err?.message?.startsWith("NO_INTERNET:")
            || err?.message?.startsWith("TIMEOUT:")
            || err?.message?.startsWith("DNS_ERROR:")) {
          throw err;
        }
        addLog(`↳ Native fetch failed: ${err?.message} — trying JS fetch`);
      }
    }

    // JS-fetch fallback (Web / Electron)
    const res = await fetch(url, { cache: "no-store" });
    const elapsed = Date.now() - startMs;
    addLog(`← HTTP ${res.status} (${elapsed}ms) from ${url} [JS fetch]`);
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      addLog(`✓ JSON parsed OK [JS fetch]`);
      return parsed;
    } catch {
      throw new Error(`Invalid JSON from ${url}`);
    }
  }, [isSupported, addLog]);

  // ── Try GitHub API to find version.json asset URL ───────────────────────────
  const tryGitHubReleasesApi = useCallback(async (): Promise<VersionInfo | null> => {
    addLog(`→ Checking GitHub Releases API: ${GH_API_URL}`);
    try {
      const release = await fetchJson(GH_API_URL);
      setGithubStatus(`Release: ${release.tag_name || "latest"}`);
      addLog(`✓ GitHub release found: ${release.tag_name}`);

      // Find version.json asset
      const vAsset = release.assets?.find((a: any) => a.name === "version.json");
      if (vAsset?.browser_download_url) {
        addLog(`✓ Found version.json asset at: ${vAsset.browser_download_url}`);
        const data = await fetchJson(vAsset.browser_download_url);
        return data;
      }

      addLog(`⚠ version.json not in release assets — building from release metadata`);
      // Construct from release metadata
      const apkAsset = release.assets?.find((a: any) => a.name === "app-release.apk");
      if (apkAsset) {
        const constructed: VersionInfo = {
          versionCode: parseInt((release.tag_name || "v1.0.1").replace(/[^0-9]/g, "")) || 1,
          versionName: (release.tag_name || "1.0.1").replace(/^v/, ""),
          minimumVersion: 1,
          mandatory: false,
          releaseDate: (release.published_at || new Date().toISOString()).split("T")[0],
          apkUrl: apkAsset.browser_download_url,
          releaseNotesUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/release-notes.json`,
          apkSize: formatSize(apkAsset.size),
        };
        addLog(`✓ Constructed version info from release assets`);
        return constructed;
      }

      addLog(`✗ No APK asset found in release`);
    } catch (err: any) {
      addLog(`✗ GitHub API error: ${err?.message}`);
      if (err?.message?.includes("rate limit") || err?.message?.includes("429")) {
        setGithubStatus("API rate-limited — try later");
      } else {
        setGithubStatus("API error: " + err?.message?.substring(0, 50));
      }
    }
    return null;
  }, [fetchJson, addLog]);

  // ── Main check-for-updates ──────────────────────────────────────────────────
  const checkForUpdates = useCallback(async (quiet = false) => {
    setChecking(true);
    if (!quiet) toast.loading("Checking for updates...", { id: "check-update" });

    try {
      addLog("=== checkForUpdates START ===");

      // 1. Connectivity
      const online = await checkConnectivity();
      if (!online) {
        const msg = "No internet connection. Connect to WiFi or mobile data and try again.";
        if (!quiet) toast.error(msg, { id: "check-update" });
        addLog(`✗ Aborted: ${msg}`);
        return null;
      }

      // 2. Try VERSION_URLS (direct raw GitHub) first — no redirects needed
      let versionData: VersionInfo | null = null;

      for (const url of VERSION_URLS) {
        try {
          const data = await fetchJson(url);
          const check = validateVersionJson(data);
          if (check.valid) {
            versionData = data as VersionInfo;
            addLog(`✓ Valid version.json from: ${url}`);
            addLog(`  → versionCode=${data.versionCode}, versionName=${data.versionName}`);
            addLog(`  → apkUrl=${data.apkUrl}`);
            setGithubStatus("Connected ✓");
            break;
          } else {
            addLog(`⚠ Invalid JSON from ${url}: ${check.reason}`);
          }
        } catch (err: any) {
          if (err?.message?.startsWith("NO_INTERNET:") || err?.message?.startsWith("DNS_ERROR:")) {
            throw err; // propagate connectivity errors immediately
          }
          addLog(`⚠ ${url} failed: ${err?.message}`);
        }
      }

      // 3. Fallback to GitHub Releases API
      if (!versionData) {
        addLog("Direct URLs failed — falling back to GitHub API");
        versionData = await tryGitHubReleasesApi();
      }

      if (!versionData) {
        throw new Error(
          "Could not fetch version info from GitHub. " +
          "Ensure version.json is committed to the main branch or uploaded to the latest GitHub Release."
        );
      }

      // 4. Final JSON validation
      const validation = validateVersionJson(versionData);
      if (!validation.valid) {
        throw new Error(`version.json validation failed: ${validation.reason}`);
      }

      setLatestVersionInfo(versionData);
      setLastChecked(new Date().toLocaleTimeString());

      // 5. Fetch release notes
      if (versionData.releaseNotesUrl) {
        try {
          const notes = await fetchJson(versionData.releaseNotesUrl);
          if (notes?.version && Array.isArray(notes.changes)) {
            setReleaseNotes(notes as ReleaseNotes);
            addLog(`✓ Release notes loaded (${notes.changes.length} changes)`);
          }
        } catch (e: any) {
          addLog(`⚠ Release notes fetch skipped: ${e?.message}`);
        }
      }

      addLog(`=== checkForUpdates DONE — latest: v${versionData.versionName} (${versionData.versionCode}), installed: v${currentVersion} (${currentBuild}) ===`);

      if (!quiet) {
        if (versionData.versionCode > currentBuild) {
          toast.success(
            `New version available: v${versionData.versionName}`,
            { id: "check-update" }
          );
        } else {
          toast.success("You are running the latest version.", { id: "check-update" });
        }
      }

      return versionData;

    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      addLog(`✗ checkForUpdates FAILED: ${msg}`);

      let userMsg = "Failed to check for updates.";
      if (msg.includes("NO_INTERNET") || msg.includes("No internet")) {
        userMsg = "No internet connection. Please connect and try again.";
      } else if (msg.includes("TIMEOUT")) {
        userMsg = "Request timed out. Check your connection speed and try again.";
      } else if (msg.includes("DNS_ERROR")) {
        userMsg = "Cannot reach GitHub. Check your internet and try again.";
      } else if (msg.includes("rate limit") || msg.includes("429")) {
        userMsg = "GitHub API rate limit hit. Please wait a few minutes.";
      } else if (msg.includes("404")) {
        userMsg = "version.json not found. Please push a release to GitHub first.";
      } else {
        userMsg = "Update check failed: " + msg;
      }

      if (!quiet) toast.error(userMsg, { id: "check-update" });
      setGithubStatus("Error: " + msg.substring(0, 60));
      return null;
    } finally {
      setChecking(false);
    }
  }, [currentBuild, currentVersion, checkConnectivity, fetchJson, tryGitHubReleasesApi, addLog]);

  // ── Download ────────────────────────────────────────────────────────────────
  const startDownload = useCallback(async () => {
    if (!latestVersionInfo) {
      toast.error("No update info available. Please check for updates first.");
      return;
    }
    if (!isSupported) {
      toast.info("Opening GitHub releases page...");
      window.open(
        `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
        "_blank"
      );
      return;
    }

    const online = await checkConnectivity();
    if (!online) {
      toast.error("No internet connection. Cannot download update.");
      return;
    }

    try {
      setDownloadProgress({ status: "downloading", progress: 0, bytesDownloaded: 0, totalBytes: 0, speed: 0, timeRemaining: 0 });

      const handler = await AppUpdate.addListener("downloadProgress", (data: any) => {
        setDownloadProgress({
          status: data.status,
          progress: data.progress || 0,
          bytesDownloaded: data.bytesDownloaded || 0,
          totalBytes: data.totalBytes || 0,
          speed: data.speed || 0,
          timeRemaining: data.timeRemaining || 0,
          message: data.message,
          filePath: data.filePath,
        });
        if (data.status === "completed") {
          toast.success("Download complete! Verifying...", { id: "dl" });
          handler.remove();
          verifyAndInstall(data.filePath);
        } else if (data.status === "failed") {
          toast.error("Download failed: " + (data.message || "Unknown error"), { id: "dl" });
          handler.remove();
        } else if (data.status === "cancelled") {
          toast.info("Download cancelled", { id: "dl" });
          handler.remove();
        }
      });

      toast.loading("Starting download...", { id: "dl" });
      addLog(`→ Starting APK download: ${latestVersionInfo.apkUrl}`);
      await AppUpdate.downloadApk({ url: latestVersionInfo.apkUrl });
    } catch (err: any) {
      toast.error("Download error: " + err.message, { id: "dl" });
      setDownloadProgress(prev => ({ ...prev, status: "failed", message: err.message }));
    }
  }, [latestVersionInfo, isSupported, checkConnectivity, addLog]);

  const cancelDownload = useCallback(async () => {
    if (!isSupported) return;
    await AppUpdate.cancelDownload();
    setDownloadProgress(prev => ({ ...prev, status: "cancelled" }));
  }, [isSupported]);

  const verifyAndInstall = useCallback(async (filePath: string) => {
    if (!latestVersionInfo || !isSupported) return;
    try {
      const v = await AppUpdate.verifyApk({ filePath, expectedVersionCode: latestVersionInfo.versionCode });
      if (!v.valid) {
        toast.error("APK verification failed: " + (v.reason || "Invalid APK"), { id: "install" });
        setDownloadProgress(prev => ({ ...prev, status: "failed", message: v.reason }));
        return;
      }
      toast.loading("Launching installer...", { id: "install" });
      const r = await AppUpdate.installApk({ filePath });
      if (r.status === "launched") {
        toast.success("Installer launched. Follow the on-screen prompts.", { id: "install" });
      }
    } catch (err: any) {
      toast.error("Install error: " + err.message, { id: "install" });
    }
  }, [latestVersionInfo, isSupported]);

  // ── Formatters ─────────────────────────────────────────────────────────────
  const formatSpeed = (b: number) => {
    if (!b) return "0 B/s";
    const k = 1024, s = ["B/s","KB/s","MB/s","GB/s"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(2) + " " + s[i];
  };
  const formatTime = (s: number) => {
    if (s <= 0) return "Calculating...";
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };
  function formatSize(b: number) {
    if (!b) return "0 B";
    const k = 1024, s = ["B","KB","MB","GB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return (b / Math.pow(k, i)).toFixed(2) + " " + s[i];
  }

  return {
    isSupported, currentVersion, currentBuild,
    latestVersionInfo, releaseNotes, lastChecked,
    checking, connectionStatus, githubStatus, debugLog,
    downloadProgress,
    checkForUpdates, checkConnectivity,
    startDownload, cancelDownload, verifyAndInstall,
    formatSpeed, formatTime, formatSize,
  };
}
