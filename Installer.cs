using System;
using System.IO;
using System.Reflection;
using System.IO.Compression;
using System.Diagnostics;

class Program
{
    static void Main()
    {
        try
        {
            Console.WriteLine("========================================");
            Console.WriteLine("      Installing ABL Payroll System     ");
            Console.WriteLine("========================================");
            
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string installDir = Path.Combine(localAppData, "Programs", "ABL Payroll System");

            if (Directory.Exists(installDir))
            {
                Console.WriteLine("Cleaning previous installation...");
                try {
                    Directory.Delete(installDir, true);
                } catch {}
            }
            
            Directory.CreateDirectory(installDir);
            Console.WriteLine("Extracting application package...");

            string zipPath = Path.Combine(installDir, "app.zip");
            
            // Extract the embedded zip resource
            using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream("app.zip"))
            {
                if (input == null) {
                    throw new Exception("Embedded package file app.zip not found in installer binary.");
                }
                using (Stream output = File.Create(zipPath))
                {
                    input.CopyTo(output);
                }
            }

            ZipFile.ExtractToDirectory(zipPath, installDir);
            File.Delete(zipPath);

            Console.WriteLine("Creating desktop shortcut...");
            string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string shortcutPath = Path.Combine(desktopDir, "ABL Payroll System.lnk");
            string targetPath = Path.Combine(installDir, "electron.exe");

            string vbsPath = Path.Combine(Path.GetTempPath(), "shortcut.vbs");
            File.WriteAllText(vbsPath, 
                "Set wshShell = CreateObject(\"WScript.Shell\")\r\n" +
                "Set shortcut = wshShell.CreateShortcut(\"" + shortcutPath.Replace("\\", "\\\\") + "\")\r\n" +
                "shortcut.TargetPath = \"" + targetPath.Replace("\\", "\\\\") + "\"\r\n" +
                "shortcut.WorkingDirectory = \"" + installDir.Replace("\\", "\\\\") + "\"\r\n" +
                "shortcut.Save()");
            
            ProcessStartInfo vbsPsi = new ProcessStartInfo("wscript.exe", "\"" + vbsPath + "\"") { UseShellExecute = false, CreateNoWindow = true };
            Process vbsProc = Process.Start(vbsPsi);
            if (vbsProc != null) vbsProc.WaitForExit();
            File.Delete(vbsPath);

            Console.WriteLine("Success! ABL Payroll System has been installed.");
            Console.WriteLine("Starting the application...");
            
            Process.Start(targetPath);
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error: " + ex.Message);
            Console.WriteLine("Press Enter to close installer...");
            Console.ReadLine();
        }
    }
}
