// Student Enrollment Interface - capture & upload face images
//
// pubspec.yaml -> dependencies:
//   image_picker: ^1.1.2
//   http: ^1.2.2
//
// Android: camera permission auto-handled by image_picker.
// iOS: add NSCameraUsageDescription & NSPhotoLibraryUsageDescription in Info.plist.
// Android emulator ke liye localhost = http://10.0.2.2:8000

import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

// TODO: apna backend URL yahan daalo
const String kUploadUrl = 'http://10.0.2.2:8000/api/students/enroll/';
const int kMaxImages = 5;

void main() => runApp(const EnrollmentApp());

class EnrollmentApp extends StatelessWidget {
  const EnrollmentApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Student Enrollment',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.indigo,
      ),
      home: const EnrollmentScreen(),
    );
  }
}

class EnrollmentScreen extends StatefulWidget {
  const EnrollmentScreen({super.key});

  @override
  State<EnrollmentScreen> createState() => _EnrollmentScreenState();
}

class _EnrollmentScreenState extends State<EnrollmentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _rollCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _picker = ImagePicker();

  String? _course;
  final List<XFile> _files = [];
  final List<Uint8List> _previews = [];
  bool _uploading = false;

  static const _courses = ['B.Tech CSE', 'B.Tech IT', 'B.Tech ECE', 'BCA', 'MCA'];

  @override
  void dispose() {
    _nameCtrl.dispose();
    _rollCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _addImage(ImageSource source) async {
    if (_files.length >= kMaxImages) {
      _snack('Maximum $kMaxImages images allowed');
      return;
    }
    try {
      final XFile? img = await _picker.pickImage(
        source: source,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 85,
        maxWidth: 1080,
      );
      if (img == null) return;
      final bytes = await img.readAsBytes();
      setState(() {
        _files.add(img);
        _previews.add(bytes);
      });
    } catch (e) {
      _snack('Image error: $e');
    }
  }

  void _removeImage(int i) {
    setState(() {
      _files.removeAt(i);
      _previews.removeAt(i);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_files.isEmpty) {
      _snack('Kam se kam 1 face image add karo');
      return;
    }

    setState(() => _uploading = true);
    try {
      final req = http.MultipartRequest('POST', Uri.parse(kUploadUrl))
        ..fields['name'] = _nameCtrl.text.trim()
        ..fields['roll_no'] = _rollCtrl.text.trim()
        ..fields['email'] = _emailCtrl.text.trim()
        ..fields['course'] = _course ?? '';

      for (int i = 0; i < _files.length; i++) {
        req.files.add(http.MultipartFile.fromBytes(
          'face_images',
          _previews[i],
          filename: '${_rollCtrl.text.trim()}_$i.jpg',
        ));
      }

      final res = await req.send().timeout(const Duration(seconds: 30));
      if (res.statusCode == 200 || res.statusCode == 201) {
        _snack('Enrollment successful ✅');
        _reset();
      } else {
        _snack('Upload failed (${res.statusCode})');
      }
    } catch (e) {
      _snack('Network error: $e');
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  void _reset() {
    _formKey.currentState!.reset();
    _nameCtrl.clear();
    _rollCtrl.clear();
    _emailCtrl.clear();
    setState(() {
      _course = null;
      _files.clear();
      _previews.clear();
    });
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Student Enrollment')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  controller: _nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    prefixIcon: Icon(Icons.person),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Name required' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _rollCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Roll Number',
                    prefixIcon: Icon(Icons.badge),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Roll no required' : null,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Email required';
                    final ok = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v.trim());
                    return ok ? null : 'Invalid email';
                  },
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<String>(
                  value: _course,
                  decoration: const InputDecoration(
                    labelText: 'Course',
                    prefixIcon: Icon(Icons.school),
                    border: OutlineInputBorder(),
                  ),
                  items: _courses
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) => setState(() => _course = v),
                  validator: (v) => v == null ? 'Select course' : null,
                ),
                const SizedBox(height: 24),
                Text('Face Images (${_files.length}/$kMaxImages)',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _uploading ? null : () => _addImage(ImageSource.camera),
                        icon: const Icon(Icons.camera_alt),
                        label: const Text('Capture'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _uploading ? null : () => _addImage(ImageSource.gallery),
                        icon: const Icon(Icons.photo_library),
                        label: const Text('Gallery'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (_previews.isEmpty)
                  Container(
                    height: 110,
                    width: double.infinity,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade400),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text('No images yet'),
                  )
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: _previews.length,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemBuilder: (_, i) => Stack(
                      fit: StackFit.expand,
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.memory(_previews[i], fit: BoxFit.cover),
                        ),
                        Positioned(
                          top: 2,
                          right: 2,
                          child: InkWell(
                            onTap: _uploading ? null : () => _removeImage(i),
                            child: const CircleAvatar(
                              radius: 12,
                              backgroundColor: Colors.black54,
                              child: Icon(Icons.close, size: 14, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: FilledButton.icon(
                    onPressed: _uploading ? null : _submit,
                    icon: _uploading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.cloud_upload),
                    label: Text(_uploading ? 'Uploading...' : 'Enroll Student'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
