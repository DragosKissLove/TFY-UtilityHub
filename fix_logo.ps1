$mw = 'c:\Users\Regele\Desktop\TFY TOOL C#\MainWindow.xaml'
$lv = 'c:\Users\Regele\Desktop\TFY TOOL C#\Views\LoginView.xaml'

# Fix MainWindow sidebar logo
$mc = Get-Content $mw
$mc = $mc -replace 'Padding="10,16".*?HorizontalAlignment="Center"', 'Padding="8,12,0,12" Background="{DynamicResource SurfaceBrush}" BorderBrush="{DynamicResource BorderBrush}" BorderThickness="0,0,0,1" HorizontalAlignment="Left"'
$mc = $mc -replace 'Height="40" Width="40" Stretch="UniformToFill"', 'Height="32" Width="32" Stretch="Uniform"'
$mc | Set-Content $mw
Write-Host "Fixed MainWindow"

# Fix LoginView logo section
$lc = Get-Content $lv
$lc = $lc -replace 'Margin="0,0,0,16"', 'Margin="0,0,0,24"'
$lc | Set-Content $lv
Write-Host "Fixed LoginView"
