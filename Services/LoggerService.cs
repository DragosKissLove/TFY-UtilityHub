using System;
using System.IO;
using System.Collections;
using System.Collections.ObjectModel;
using System.Collections.Generic;

namespace TFY.Services
{
    public enum LogLevel
    {
        Info,
        Warning,
        Error,
        Success
    }

    public class LogEntry
    {
        public DateTime Timestamp { get; set; }
        public LogLevel Level { get; set; }
        public string Message { get; set; }

        public LogEntry(LogLevel level, string message)
        {
            Timestamp = DateTime.Now;
            Level = level;
            Message = message;
        }

        public override string ToString()
        {
            return $"[{Timestamp:HH:mm:ss}] [{Level}] {Message}";
        }
    }

    public class LoggerService
    {
        private readonly ObservableCollection<LogEntry> _logs;
        private readonly string _logPath;
        private readonly object _lockObject = new object();

        public IReadOnlyCollection<LogEntry> Logs => _logs;

        public event EventHandler<LogEntry>? LogAdded;

        public LoggerService()
        {
            _logs = new ObservableCollection<LogEntry>();
            
            _logPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "TFY",
                "Logs"
            );

            EnsureLogDirectoryExists();
        }

        private void EnsureLogDirectoryExists()
        {
            try
            {
                if (!Directory.Exists(_logPath))
                {
                    Directory.CreateDirectory(_logPath);
                }
            }
            catch { }
        }

        public void Log(LogLevel level, string message)
        {
            lock (_lockObject)
            {
                var entry = new LogEntry(level, message);
                _logs.Add(entry);
                LogAdded?.Invoke(this, entry);
                SaveToFile(entry);
            }
        }

        public void Info(string message) => Log(LogLevel.Info, message);
        public void Warning(string message) => Log(LogLevel.Warning, message);
        public void Error(string message) => Log(LogLevel.Error, message);
        public void Success(string message) => Log(LogLevel.Success, message);

        private void SaveToFile(LogEntry entry)
        {
            try
            {
                var fileName = $"TFY_{DateTime.Now:yyyy-MM-dd}.log";
                var filePath = Path.Combine(_logPath, fileName);
                File.AppendAllText(filePath, entry.ToString() + Environment.NewLine);
            }
            catch { }
        }

        public void ClearLogs()
        {
            _logs.Clear();
        }
    }
}
