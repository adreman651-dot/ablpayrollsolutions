# QUICK REFERENCE: RUNNING DEVICE TESTS

## Prerequisites
- Windows machine with installed ABL Payroll System
- Android device or emulator
- ADB installed and in PATH
- USB debugging enabled on Android device (if physical)
- Supabase account with test data

## Windows App Status
```bash
# App should be already running
# Verify by checking running processes
Get-Process | Where-Object { $_.ProcessName -like "*ABL*" }

# Database location
echo $env:APPDATA\abl-payroll-system\abl_payroll.db
```

## Android Installation
```bash
# Check connected devices
adb devices

# Install debug APK
adb install -r abl-employee-app\android\app\build\outputs\apk\debug\app-debug.apk

# Or install release APK
adb install -r abl-employee-app\android\app\build\outputs\apk\release\app-release.apk

# Launch app
adb shell am start -n com.abl.employee/com.abl.employee.MainActivity
```

## Test Execution

### Test 1: Employee Sync (Windows → Android)
```
WINDOWS:
1. Open Employees module
2. Click "Add Employee"
3. Fill:
   - Code: TEST-EMP-001
   - Name: Test Employee
   - Email: test@example.com
   - Department: IT
   - Job Title: Developer
   - Salary: 50000
4. Save
5. Open Sync Center → Click "Sync All Data"
6. Wait for "Sync successful" message
7. Note: Upload count (should be 1)

ANDROID:
1. Pull down to refresh Employees
2. Verify "Test Employee" appears
3. Click on employee to view details
4. Verify all fields match Windows
5. Verify sync_status shows 'synced'

VALIDATION:
✓ Employee appears on Android
✓ All fields match
✓ Timestamps are synchronized
```

### Test 2: Attendance Sync (Android → Windows)
```
ANDROID:
1. Open Attendance module
2. Click "Clock In"
3. Select employee: "Test Employee"
4. App captures GPS automatically
5. Tap camera icon to take selfie
6. System shows reverse-geocoded location
7. Confirm Clock In
8. Record shows as 'pending' locally
9. Open Sync Center → Tap "Sync"
10. Wait for upload (watch logs for timestamp)
11. Verify 'pending' → 'synced' status change

WINDOWS:
1. Wait 10 seconds (or manually refresh)
2. Open Attendance module
3. Verify attendance record appears
4. Click on record to view details
5. Verify:
   - Employee name: "Test Employee"
   - Date: Today's date
   - Time In: Matches Android
   - Latitude/Longitude: 14.5994, 120.9842 (or GPS captured)
   - Location: Should show "Manila, Philippines" (reverse-geocoded)
   - Photo: Should show thumbnail or Supabase URL

VALIDATION:
✓ Attendance appears on Windows
✓ GPS coordinates preserved
✓ Location reverse-geocoded
✓ Selfie accessible
```

### Test 3: Offline Queue
```
ANDROID:
1. Disable network (Airplane mode ON)
2. Verify WiFi and mobile data are OFF
3. Open Attendance module
4. Click "Clock Out"
5. System shows 'pending' (no network)
6. Create 2 more attendance records (all pending)
7. Verify sync_status = 'pending' for all
8. Enable network (Airplane mode OFF)
9. Wait 5-10 seconds (auto-sync may trigger)
10. Or manually open Sync Center → Tap "Sync"
11. Verify all 3 records now 'synced'

WINDOWS:
1. Run Sync Center
2. Verify "Download: 3" in sync logs
3. Verify all 3 attendance records appear
4. Verify dates/times match Android

VALIDATION:
✓ Offline queue maintained
✓ Records synced on reconnect
✓ No data loss
✓ Batch operations successful
```

### Test 4: Update Scenario
```
ANDROID:
1. Find attendance record (from Test 2 or 3)
2. Click edit
3. Update notes: "Worked from home"
4. Verify sync_status = 'pending'
5. Sync Center → Sync

WINDOWS:
1. Refresh Attendance module
2. Click on the record
3. Verify notes now shows "Worked from home"
4. Verify updated_at timestamp is recent

VALIDATION:
✓ Updates sync bidirectionally
✓ Timestamps reflect changes
```

### Test 5: Delete Scenario
```
WINDOWS:
1. Open Employees module
2. Find "Test Employee" from Test 1
3. Right-click → Delete (or use delete button)
4. Confirm deletion
5. Open Sync Center → Sync
6. Verify "Upload: 1 (delete)" in logs

ANDROID:
1. Refresh Employees module
2. Verify "Test Employee" is gone
3. Check Attendance module
4. Verify no orphaned attendance records

VALIDATION:
✓ Deletes sync across platforms
✓ No orphaned records
```

## Monitoring & Logging

### Windows Logs
```bash
# View sync logs in app: Settings → System Logs
# Or check database:
sqlite3 "$env:APPDATA\abl-payroll-system\abl_payroll.db"
SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 10;
```

### Android Logs
```bash
# Monitor Android logs while syncing
adb logcat | grep -i "SyncEngine\|Sync\|error"

# Or save logs to file
adb logcat > android_sync_log.txt

# Check SQLite database
adb shell "sqlite3 /data/data/com.abl.employee/databases/attendance_db.db .dump" | grep "sync_status"
```

### Supabase Verification
```bash
# Check Supabase via curl (requires API key with proper permissions)
curl -H "apikey: YOUR_ANON_KEY" \
  https://zgkmvonpphqhihawrvcf.supabase.co/rest/v1/employees \
  -G -d "limit=5"

# Or use Supabase Dashboard:
1. Login to https://supabase.com
2. Select project "abl-payroll-system"
3. Navigate to "SQL Editor"
4. Query: SELECT COUNT(*) FROM employees;
5. Verify counts match between systems
```

## Troubleshooting

### Issue: App won't install
```bash
# Check for existing installation
adb shell pm list packages | grep abl

# Uninstall old version
adb uninstall com.abl.employee

# Try install again
adb install -r app-debug.apk
```

### Issue: Sync fails with "permission denied"
- Verify Supabase API key in code
- Check table permissions in Supabase SQL Editor
- Try using RPC endpoints instead of direct table access

### Issue: Photos not syncing
- Verify Supabase storage bucket exists: `attendance-selfies`
- Check bucket is public or has proper access policies
- Verify photo file exists in Android app

### Issue: GPS coordinates show 0,0
- Verify Location permission is granted in Android settings
- Ensure GPS is enabled on device
- Wait 10 seconds for GPS lock

### Issue: Offline sync not triggering auto-sync
- Open Sync Center manually and tap "Sync"
- Check if auto-sync listener is registered in app
- Verify network status is detected correctly

## Performance Benchmarks

| Operation | Target | Method |
|-----------|--------|--------|
| Sync 10 employees | < 5s | Open Sync Center, measure time |
| Sync 100 attendance | < 10s | Create 100 attendance records, measure |
| Offline queue (100 records) | < 15s | Create 100 pending, reconnect, measure |
| Memory after sync | < 150MB | Check Android Settings → App Memory |

## Success Criteria

### Test PASSED if:
- [ ] Windows app and Android app both running
- [ ] Employee created on Windows appears on Android within 5 seconds of sync
- [ ] Attendance created on Android appears on Windows within 10 seconds of sync
- [ ] GPS coordinates preserved end-to-end
- [ ] Selfie photos accessible in Windows app
- [ ] Offline records sync when reconnected
- [ ] Updates replicate bidirectionally
- [ ] Deletes propagate across platforms
- [ ] No error messages in sync logs
- [ ] Sync timestamp matches across platforms

### Test FAILED if:
- [ ] Records don't appear after sync
- [ ] Error messages in sync logs
- [ ] Field values differ between platforms
- [ ] Photos not accessible
- [ ] Offline records lost on reconnect
- [ ] Sync takes > 30 seconds for 100 records
- [ ] App crashes during sync
- [ ] Database corruption detected

## Report Generation

After running tests:

1. **Collect Windows sync logs:**
   ```bash
   sqlite3 "$env:APPDATA\abl-payroll-system\abl_payroll.db" \
     "SELECT * FROM sync_logs ORDER BY id DESC LIMIT 20" > windows_logs.txt
   ```

2. **Collect Android logs:**
   ```bash
   adb logcat -d > android_full_log.txt
   ```

3. **Take screenshots:**
   - Windows: Employees, Attendance, Sync Center UI
   - Android: Employees list, Attendance detail, Sync logs

4. **Generate report:**
   - Create file: `DEVICE_TEST_RESULTS_[DATE].md`
   - Include: Test case results, screenshots, logs
   - Summary: Pass/Fail per test case
   - Mark overall: PASSED if all critical tests pass

---

## Quick Command Reference

```bash
# Installation
adb install -r app-debug.apk

# Monitoring
adb logcat | grep SyncEngine

# Verification
adb shell "sqlite3 /data/data/com.abl.employee/databases/attendance_db.db 'SELECT COUNT(*) FROM attendance WHERE sync_status = \"synced\"'"

# Uninstall
adb uninstall com.abl.employee

# Clear app data
adb shell pm clear com.abl.employee
```

---

**Ready to test? Connect device and follow the Test Execution section above.**
