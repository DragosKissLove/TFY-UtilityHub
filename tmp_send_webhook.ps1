$webhook = 'https://canary.discord.com/api/webhooks/1477735580942205008/aqMLb-S_6gBbIJmhn-LD5RS0hLfp3rwpBAS74dgHmwP38lMyc0ljxegIX_foiXBthEpa'
$download = 'https://github.com/DragosKissLove/TFY-UtilityHub-Releases/raw/main/TFY-UtilityHub-Beta-Setup-LATEST.exe'
$tfyId = '1477742180704718990'
$winId = '1369112015045525504'
$shield = '<:shield:1464662787912372275>'
$winEmoji = '<:WinOS:1369112015045525504>'
$footerIcon = ('https://cdn.discordapp.com/emojis/{0}.png?size=64&quality=lossless' -f $tfyId)

$changelog = @"
+ UI modernizat complet pentru Home, modale si sectiuni principale
+ System Information actualizat (inclusiv multiple placi video)
+ Debloating si Backups rafinate pentru flux stabil
+ Theming extins pe modulele importante
+ Language coverage extinsa pe functiile principale
+ Stabilitate generala si polish pe UX
"@.Trim()

$notes = @"
• Daca ai deja TFY instalat, ruleaza installerul din nou pentru update.
• Daca apare SmartScreen, verifica publisher-ul si continua instalarea.
• Pentru bug report: screenshot + pasi de reproducere.
"@.Trim()

$diff = '```diff' + [Environment]::NewLine + $changelog + [Environment]::NewLine + '```'

$fields = @(
  @{ name='Version'; value='`5.0.0`'; inline=$false },
  @{ name='Changelog'; value=$diff; inline=$false },
  @{ name='Download Link'; value=($winEmoji + ' **TFY Utility Hub**'); inline=$false },
  @{ name='Notes'; value=$notes; inline=$false }
)

$embed = @{
  color = 2895667
  title = '***TFY UTILITY HUB - RELEASE 5.0.0***'
  description = ($shield + ' **Release Notes & Changelog**')
  fields = $fields
  footer = @{ text='TFY Utility Hub • Stable Release'; icon_url=$footerIcon }
  timestamp = [DateTime]::UtcNow.ToString('o')
}

$button = @{ type=2; style=5; label='Download TFY Utility Hub'; url=$download; emoji=@{ id=$winId; name='WinOS' } }
$row = @{ type=1; components=@($button) }
$payload = @{ content=''; allowed_mentions=@{ parse=@() }; embeds=@($embed); components=@($row) }
$body = $payload | ConvertTo-Json -Depth 12
Set-Content -Path '.\tmp_webhook_payload.json' -Value $body -Encoding UTF8
Invoke-WebRequest -Uri $webhook -Method Post -ContentType 'application/json; charset=utf-8' -InFile '.\tmp_webhook_payload.json' | Out-Null
Write-Output 'Webhook sent successfully.'
