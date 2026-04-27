using System;

namespace TFY.Models
{
    public class OptimizationTask
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public bool IsEnabled { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? CompletedAt { get; set; }
    }

    public class SystemStats
    {
        public long TotalMemory { get; set; }
        public long UsedMemory { get; set; }
        public long FreeMemory { get; set; }
        public double CpuUsage { get; set; }
        public double DiskUsagePercentage { get; set; }
        public DateTime LastUpdated { get; set; } = DateTime.Now;
    }

    public class GameProfile
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string GameName { get; set; } = string.Empty;
        public string? GamePath { get; set; }
        public bool DisableWindowsUpdates { get; set; }
        public bool DisableBackgroundApps { get; set; }
        public bool OptimizeGraphics { get; set; }
        public bool OptimizeNetwork { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
