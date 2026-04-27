using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Animation;

namespace TFY.Services
{
    public class NotificationService
    {
        private static Canvas _notificationCanvas;

        public static void Initialize(Canvas canvas)
        {
            _notificationCanvas = canvas;
        }

        public static void ShowSuccess(string message, int durationMs = 3000)
        {
            ShowNotification(message, "#FF10B981", durationMs);
        }

        public static void ShowError(string message, int durationMs = 3000)
        {
            ShowNotification(message, "#FFEF4444", durationMs);
        }

        public static void ShowInfo(string message, int durationMs = 3000)
        {
            ShowNotification(message, "#FF06B6D4", durationMs);
        }

        private static void ShowNotification(string message, string colorHex, int durationMs)
        {
            if (_notificationCanvas == null) return;

            var border = new Border
            {
                Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString(colorHex)),
                CornerRadius = new CornerRadius(6),
                Padding = new Thickness(16, 12, 16, 12),
                Margin = new Thickness(16),
                MaxWidth = 400,
                Effect = new System.Windows.Media.Effects.DropShadowEffect
                {
                    BlurRadius = 8,
                    ShadowDepth = 2,
                    Opacity = 0.5
                }
            };

            var textBlock = new TextBlock
            {
                Text = message,
                Foreground = new SolidColorBrush(Colors.White),
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                TextWrapping = TextWrapping.Wrap
            };

            border.Child = textBlock;

            Canvas.SetRight(border, 16);
            Canvas.SetTop(border, 16);

            _notificationCanvas.Children.Add(border);

            var fadeInAnimation = new DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(300));
            var fadeOutAnimation = new DoubleAnimation(1, 0, TimeSpan.FromMilliseconds(300));

            var storyboard = new Storyboard();
            storyboard.Children.Add(fadeInAnimation);
            Storyboard.SetTarget(fadeInAnimation, border);
            Storyboard.SetTargetProperty(fadeInAnimation, new PropertyPath("Opacity"));

            border.BeginStoryboard(storyboard);

            var removeTimer = new System.Timers.Timer(durationMs);
            removeTimer.AutoReset = false;
            removeTimer.Elapsed += (s, e) =>
            {
                _notificationCanvas.Dispatcher.Invoke(() =>
                {
                    var fadeOut = new Storyboard();
                    fadeOut.Children.Add(fadeOutAnimation);
                    Storyboard.SetTarget(fadeOutAnimation, border);
                    Storyboard.SetTargetProperty(fadeOutAnimation, new PropertyPath("Opacity"));

                    fadeOut.Completed += (s2, e2) =>
                    {
                        _notificationCanvas.Children.Remove(border);
                    };

                    border.BeginStoryboard(fadeOut);
                });
            };
            removeTimer.Start();
        }
    }
}
