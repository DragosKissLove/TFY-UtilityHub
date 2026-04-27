$f = 'c:\Users\Regele\Desktop\TFY TOOL C#\Views\SystemOptimizationView.xaml.cs'
$c = Get-Content $f
$nc = $c -replace 'CheckTweakState\(name, 0\)', 'DetectTweakState\(name\)'
$nc | Set-Content $f
Write-Host 'Updated'
