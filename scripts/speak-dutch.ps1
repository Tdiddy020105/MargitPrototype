param(
  [Parameter(Mandatory = $true)][string]$TextFile,
  [Parameter(Mandatory = $true)][string]$OutFile
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1"
})[0]

function Await-WinRt($Operation, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($Operation))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}

[Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime] | Out-Null
[Windows.Media.SpeechSynthesis.SpeechSynthesisStream, Windows.Media, ContentType = WindowsRuntime] | Out-Null

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$dutch = @([Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -like "nl*" })
if ($dutch.Count -eq 0) {
  throw "No Dutch voice is installed on this PC."
}

$voice = $dutch | Where-Object { $_.DisplayName -match "claire" } | Select-Object -First 1
if (-not $voice) {
  $voice = $dutch | Where-Object { $_.DisplayName -match "ellen" } | Select-Object -First 1
}
if (-not $voice) {
  $voice = $dutch | Select-Object -First 1
}
$synth.Voice = $voice

$text = [System.IO.File]::ReadAllText($TextFile, [System.Text.Encoding]::UTF8).Trim()
if (-not $text) { throw "Empty line." }

$stream = Await-WinRt ($synth.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$length = [uint32]$stream.Size
$reader = [Windows.Storage.Streams.DataReader]::new($stream.GetInputStreamAt(0))
$null = Await-WinRt ($reader.LoadAsync($length)) ([uint32])
$bytes = New-Object byte[] $length
$reader.ReadBytes($bytes)
[System.IO.File]::WriteAllBytes($OutFile, $bytes)
Write-Output $voice.DisplayName
