Option Explicit

Dim shell, localAppData, repairScript, command
Set shell = CreateObject("WScript.Shell")

localAppData = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
repairScript = localAppData & "\DTC-Vivaldi-Workspace\tools\Repair-VivaldiBridge.ps1"
command = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & repairScript & """ -Quiet"

' Window style 0 = completely hidden. False = do not block WScript while the
' repair helper runs. The scheduled task itself prevents overlapping instances.
shell.Run command, 0, False
