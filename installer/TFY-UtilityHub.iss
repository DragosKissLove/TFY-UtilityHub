; TFY Utility Hub Beta installer
#define BuildStamp GetDateTimeString('yyyymmdd-hhnnss', '', '')
#define SourcePath "."
[Setup]
AppId={{TFY.Utility.Hub}}
AppName=TFY Utility Hub Beta
AppPublisher=DragosKissLove
AppVersion=6.1.1
AppVerName=TFY Utility Hub v6.1.1
DefaultDirName={autopf}\TFY Utility Hub
DefaultGroupName=TFY Utility Hub
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=TFY-UtilityHub-Setup-LATEST
Compression=lzma2
SolidCompression=yes
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\TFY.exe
ArchitecturesInstallIn64BitMode=x64os
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=commandline
WizardStyle=modern
WizardImageFile=wizard.bmp
WizardSmallImageFile=wizard-small.bmp
; Instalare peste aplicatia existenta (upgrade in-place)
UsePreviousAppDir=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#SourcePath}\publish\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; Ship icon.ico so the Desktop shortcut always has the right icon even if Windows caches the exe icon.
Source: "{#SourcePath}\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{commondesktop}\TFY Utility Hub"; Filename: "{app}\TFY.exe"; WorkingDir: "{app}"; IconFilename: "{app}\icon.ico"

[Run]
Filename: "{app}\TFY.exe"; Verb: "runas"; Flags: nowait postinstall skipifsilent shellexec

[Code]
procedure DeleteTfyWebViewCaches();
var
  FindRec: TFindRec;
  Base: string;
begin
  Base := ExpandConstant('{localappdata}\');
  // Legacy folders
  if FindFirst(Base + 'TFY_WebView2_*', FindRec) then
  begin
    try
      repeat
        if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
          DelTree(Base + FindRec.Name, True, True, True);
      until not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    DeleteTfyWebViewCaches();
    // Remove old dist so [Files] overwrites with new assets (no stale JS/CSS)
    DelTree(ExpandConstant('{app}\project\dist'), True, True, True);
  end;
end;
