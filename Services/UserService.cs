using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;

namespace TFY.Services
{
    public class UserService
    {
        private readonly string _usersFilePath;
        private List<UserData> _users;

        public UserService()
        {
            var appDataPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "TFY",
                "users.json"
            );
            _usersFilePath = appDataPath;
            LoadUsers();
        }

        public bool AuthenticateUser(string email, string password)
        {
            var user = _users.Find(u => u.Email == email);
            if (user == null) return false;

            return VerifyPassword(password, user.PasswordHash);
        }

        public bool UserExists(string email)
        {
            return _users.Exists(u => u.Email == email);
        }

        public bool RegisterUser(string email, string username, string password)
        {
            if (UserExists(email)) return false;

            var user = new UserData
            {
                Email = email,
                Username = username,
                PasswordHash = HashPassword(password),
                CreatedAt = DateTime.UtcNow
            };

            _users.Add(user);
            SaveUsers();
            return true;
        }

        private void LoadUsers()
        {
            try
            {
                if (File.Exists(_usersFilePath))
                {
                    var content = File.ReadAllText(_usersFilePath);
                    _users = JsonConvert.DeserializeObject<List<UserData>>(content) ?? new List<UserData>();
                }
                else
                {
                    _users = new List<UserData>();
                }
            }
            catch
            {
                _users = new List<UserData>();
            }
        }

        private void SaveUsers()
        {
            try
            {
                var directory = Path.GetDirectoryName(_usersFilePath);
                if (directory != null && !Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                var content = JsonConvert.SerializeObject(_users, Formatting.Indented);
                File.WriteAllText(_usersFilePath, content);
            }
            catch { }
        }

        private string HashPassword(string password)
        {
            using (var sha256 = SHA256.Create())
            {
                var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
                return Convert.ToBase64String(hashedBytes);
            }
        }

        private bool VerifyPassword(string password, string hash)
        {
            var hashOfInput = HashPassword(password);
            return hashOfInput == hash;
        }
    }

    public class UserData
    {
        public string? Email { get; set; }
        public string? Username { get; set; }
        public string? PasswordHash { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
