using System;
using System.Windows;
using System.IO;
using Newtonsoft.Json;

namespace TFY.Services
{
    public enum ThemeMode
    {
        Dark,
        Light
    }

    public class ThemeService
    {
        private const string ConfigFileName = "theme.config";
        private readonly string _configPath;
        private ThemeMode _currentTheme;

        public ThemeMode CurrentTheme
        {
            get => _currentTheme;
            set
            {
                if (_currentTheme != value)
                {
                    _currentTheme = value;
                    ApplyTheme(value);
                }
            }
        }

        public event EventHandler? ThemeChanged;

        public ThemeService()
        {
            _configPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "TFY",
                ConfigFileName
            );

            _currentTheme = LoadThemePreference();
            ApplyTheme(_currentTheme);
        }

        private ThemeMode LoadThemePreference()
        {
            try
            {
                if (File.Exists(_configPath))
                {
                    var content = File.ReadAllText(_configPath);
                    var config = JsonConvert.DeserializeObject<ThemeConfig>(content);
                    return config?.Theme ?? ThemeMode.Dark;
                }
            }
            catch { }

            return ThemeMode.Dark;
        }

        public void SaveThemePreference()
        {
            try
            {
                var directory = Path.GetDirectoryName(_configPath);
                if (directory != null && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var config = new ThemeConfig { Theme = _currentTheme };
                var content = JsonConvert.SerializeObject(config, Formatting.Indented);
                File.WriteAllText(_configPath, content);
            }
            catch { }
        }

        private void ApplyTheme(ThemeMode theme)
        {
            var resourceDictionary = new ResourceDictionary();
            resourceDictionary.Source = new Uri(
                "pack://application:,,,/Resources/Themes/DarkTheme.xaml",
                UriKind.Absolute
            );

            Application.Current.Resources.MergedDictionaries.Clear();
            Application.Current.Resources.MergedDictionaries.Add(resourceDictionary);

            ThemeChanged?.Invoke(this, EventArgs.Empty);
        }

        private class ThemeConfig
        {
            public ThemeMode Theme { get; set; }
        }
    }
}
