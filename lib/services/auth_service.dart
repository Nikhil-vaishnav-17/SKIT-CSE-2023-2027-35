import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthResult {
  final bool success;
  final String message;
  AuthResult(this.success, this.message);
}

class AuthService {
  // Android emulator -> 10.0.2.2 ; iOS simulator -> localhost ; real device -> your PC's LAN IP
  static const String baseUrl = 'http://10.0.2.2:5000/api';
  static const String _tokenKey = 'auth_token';

  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$baseUrl/auth/register'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'name': name, 'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 15));

      final body = _decode(res.body);
      if (res.statusCode == 200 || res.statusCode == 201) {
        return AuthResult(true, body['message'] ?? 'Registration successful');
      }
      return AuthResult(false, body['message'] ?? 'Registration failed');
    } catch (e) {
      return AuthResult(false, 'Cannot reach server. Check your connection.');
    }
  }

  Future<AuthResult> login({
    required String email,
    required String password,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$baseUrl/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 15));

      final body = _decode(res.body);
      if (res.statusCode == 200 && body['token'] != null) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_tokenKey, body['token']);
        return AuthResult(true, 'Login successful');
      }
      return AuthResult(false, body['message'] ?? 'Invalid email or password');
    } catch (e) {
      return AuthResult(false, 'Cannot reach server. Check your connection.');
    }
  }

  Future<String?> getToken() async =>
      (await SharedPreferences.getInstance()).getString(_tokenKey);

  Future<void> logout() async =>
      (await SharedPreferences.getInstance()).remove(_tokenKey);

  Map<String, dynamic> _decode(String s) {
    try {
      return jsonDecode(s) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }
}
