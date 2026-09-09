Option Explicit

Dim shell, localAppData, repairScript, command, exitCode
Set shell = CreateObject("WScript.Shell")

localAppData = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
repairScript = localAppData & "\DTC-Vivaldi-Workspace\tools\Repair-VivaldiBridge.ps1"
command = "powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & repairScript & """ -Quiet"

' Window style 0 = completely hidden. Wait=True keeps the Scheduled Task alive
' until PowerShell finishes, so overlapping instances remain blocked and the
' task records the real repair exit code.
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
