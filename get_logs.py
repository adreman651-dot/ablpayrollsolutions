import urllib.request
import json
import zipfile
import io

repo = "adreman651-dot/ablpayrollsolutions"
runs_url = f"https://api.github.com/repos/{repo}/actions/runs?per_page=1"

req = urllib.request.Request(runs_url)
req.add_header("Accept", "application/vnd.github.v3+json")

try:
    with urllib.request.urlopen(req) as response:
        runs_data = json.loads(response.read().decode())
        if not runs_data["workflow_runs"]:
            print("No runs found")
            exit(1)
        latest_run = runs_data["workflow_runs"][0]
        run_id = latest_run["id"]
        print(f"Latest run ID: {run_id}")
        
        logs_url = f"https://api.github.com/repos/{repo}/actions/runs/{run_id}/logs"
        print(f"Fetching logs from {logs_url}")
        
        log_req = urllib.request.Request(logs_url)
        log_req.add_header("Accept", "application/vnd.github.v3+json")
        # Github redirects to a zip file download for logs
        try:
            with urllib.request.urlopen(log_req) as log_response:
                zip_data = log_response.read()
                with zipfile.ZipFile(io.BytesIO(zip_data)) as z:
                    for filename in z.namelist():
                        if "Build Debug APK" in filename:
                            print(f"\n--- {filename} ---")
                            print(z.read(filename).decode('utf-8')[-2000:])
        except Exception as e:
            print(f"Failed to download logs: {e}")
            
except Exception as e:
    print(f"Error: {e}")
