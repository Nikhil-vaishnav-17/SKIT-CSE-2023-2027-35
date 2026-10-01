// pubspec.yaml -> under dependencies add:
//   http: ^1.2.0
//   shared_preferences: ^2.2.0
//
// Android: add  <uses-permission android:name="android.permission.INTERNET"/>
// in android/app/src/main/AndroidManifest.xml, and for http (non-https) dev
// servers add  android:usesCleartextTraffic="true"  to the <application> tag.

import 'package:flutter/material.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Student App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: FutureBuilder<String?>(
        future: AuthService().getToken(),
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          return snap.data != null ? const HomeScreen() : const LoginScreen();
        },
      ),
    );
  }
}
