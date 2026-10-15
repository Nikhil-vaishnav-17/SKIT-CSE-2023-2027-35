// Enrollment Request & Status Tracking
// Submit enrollment request + track approval status (Pending / Approved / Rejected)
//
// pubspec.yaml -> dependencies:
//   image_picker: ^1.1.2
//   http: ^1.2.2
//
// Run as-is: kUseMock = true  -> in-memory backend (no server needed).
//   Request submit karo, ~15 sec baad status Pending -> Approved/Rejected ho jayega.
// Real backend: kUseMock = false aur kBaseUrl set karo.
//   POST {kBaseUrl}/requests/   (multipart: name, roll_no, email, course, face_images[])
//   GET  {kBaseUrl}/requests/   -> [{id,name,roll_no,email,course,status,remark,created_at}]
//   status values: "pending" | "approved" | "rejected"

import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

const bool kUseMock = true;
const String kBaseUrl = 'http://10.0.2.2:8000/api/students'; // Android emulator
const int kMaxImages = 5;

void main() => runApp(const App());

// ───────────────────────── Model ─────────────────────────

enum RequestStatus { pending, approved, rejected }

class EnrollmentRequest {
  final String id, name, rollNo, email, course;
  final RequestStatus status;
  final String? remark;
  final DateTime submittedAt;
  final int imageCount;

  const EnrollmentRequest({
    required this.id,
    required this.name,
    required this.rollNo,
    required this.email,
    required this.course,
    required this.status,
    required this.submittedAt,
    this.remark,
    this.imageCount = 0,
  });

  factory EnrollmentRequest.fromJson(Map<String, dynamic> j) => EnrollmentRequest(
        id: '${j['id']}',
        name: j['name'] ?? '',
        rollNo: j['roll_no'] ?? '',
        email: j['email'] ?? '',
        course: j['course'] ?? '',
        status: RequestStatus.values.firstWhere(
          (s) => s.name == (j['status'] ?? 'pending'),
          orElse: () => RequestStatus.pending,
        ),
        remark: j['remark'],
        submittedAt: DateTime.tryParse(j['created_at'] ?? '') ?? DateTime.now(),
      );

  EnrollmentRequest copyWith({RequestStatus? status, String? remark}) =>
      EnrollmentRequest(
        id: id,
        name: name,
        rollNo: rollNo,
        email: email,
        course: course,
        status: status ?? this.status,
        remark: remark ?? this.remark,
        submittedAt: submittedAt,
        imageCount: imageCount,
      );
}

// ───────────────────────── Service ─────────────────────────

abstract class EnrollmentService {
  Future<void> submit({
    required String name,
    required String rollNo,
    required String email,
    required String course,
    required List<Uint8List> images,
  });
  Future<List<EnrollmentRequest>> fetchAll();
}

class MockService implements EnrollmentService {
  final List<EnrollmentRequest> _db = [];

  @override
  Future<void> submit({
    required String name,
    required String rollNo,
    required String email,
    required String course,
    required List<Uint8List> images,
  }) async {
    await Future.delayed(const Duration(milliseconds: 800));
    _db.add(EnrollmentRequest(
      id: 'REQ${1000 + _db.length}',
      name: name,
      rollNo: rollNo,
      email: email,
      course: course,
      status: RequestStatus.pending,
      submittedAt: DateTime.now(),
      imageCount: images.length,
    ));
  }

  @override
  Future<List<EnrollmentRequest>> fetchAll() async {
    await Future.delayed(const Duration(milliseconds: 300));
    final now = DateTime.now();
    final out = _db.map((r) {
      if (now.difference(r.submittedAt).inSeconds < 15) return r;
      final reject = r.rollNo.codeUnits.fold<int>(0, (a, b) => a + b) % 3 == 0;
      return reject
          ? r.copyWith(
              status: RequestStatus.rejected,
              remark: 'Face image unclear, please resubmit')
          : r.copyWith(
              status: RequestStatus.approved, remark: 'Verified by admin');
    }).toList();
    out.sort((a, b) => b.submittedAt.compareTo(a.submittedAt));
    return out;
  }
}

class ApiService implements EnrollmentService {
  @override
  Future<void> submit({
    required String name,
    required String rollNo,
    required String email,
    required String course,
    required List<Uint8List> images,
  }) async {
    final req = http.MultipartRequest('POST', Uri.parse('$kBaseUrl/requests/'))
      ..fields.addAll({
        'name': name,
        'roll_no': rollNo,
        'email': email,
        'course': course,
      });
    for (int i = 0; i < images.length; i++) {
      req.files.add(http.MultipartFile.fromBytes('face_images', images[i],
          filename: '${rollNo}_$i.jpg'));
    }
    final res = await req.send().timeout(const Duration(seconds: 30));
    if (res.statusCode != 200 && res.statusCode != 201) {
      throw Exception('Server error ${res.statusCode}');
    }
  }

  @override
  Future<List<EnrollmentRequest>> fetchAll() async {
    final res = await http
        .get(Uri.parse('$kBaseUrl/requests/'))
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) throw Exception('Server error ${res.statusCode}');
    final list = jsonDecode(res.body) as List;
    return list
        .map((e) => EnrollmentRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}

// ───────────────────────── App shell ─────────────────────────

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Enrollment',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.indigo),
        home: const HomeShell(),
      );
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  final EnrollmentService _service = kUseMock ? MockService() : ApiService();
  final ValueNotifier<int> _refreshTick = ValueNotifier(0);
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_tab == 0 ? 'New Enrollment Request' : 'Request Status'),
      ),
      body: IndexedStack(
        index: _tab,
        children: [
          RequestFormTab(
            service: _service,
            onSubmitted: () {
              _refreshTick.value++;
              setState(() => _tab = 1);
            },
          ),
          StatusTab(service: _service, refreshTick: _refreshTick),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) {
          if (i == 1) _refreshTick.value++;
          setState(() => _tab = i);
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.person_add), label: 'Request'),
          NavigationDestination(icon: Icon(Icons.track_changes), label: 'Status'),
        ],
      ),
    );
  }
}

// ───────────────────────── Tab 1: Submit request ─────────────────────────

class RequestFormTab extends StatefulWidget {
  final EnrollmentService service;
  final VoidCallback onSubmitted;
  const RequestFormTab({super.key, required this.service, required this.onSubmitted});

  @override
  State<RequestFormTab> createState() => _RequestFormTabState();
}

class _RequestFormTabState extends State<RequestFormTab> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _roll = TextEditingController();
  final _email = TextEditingController();
  final _picker = ImagePicker();
  final List<Uint8List> _images = [];
  String? _course;
  bool _busy = false;

  static const _courses = ['B.Tech CSE', 'B.Tech IT', 'B.Tech ECE', 'BCA', 'MCA'];

  @override
  void dispose() {
    _name.dispose();
    _roll.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource src) async {
    if (_images.length >= kMaxImages) return _snack('Max $kMaxImages images');
    try {
      final f = await _picker.pickImage(
        source: src,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 85,
        maxWidth: 1080,
      );
      if (f == null) return;
      final bytes = await f.readAsBytes();
      setState(() => _images.add(bytes));
    } catch (e) {
      _snack('Image error: $e');
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_images.isEmpty) return _snack('Kam se kam 1 face image add karo');
    setState(() => _busy = true);
    try {
      await widget.service.submit(
        name: _name.text.trim(),
        rollNo: _roll.text.trim(),
        email: _email.text.trim(),
        course: _course!,
        images: _images,
      );
      _snack('Request submitted ✅');
      _formKey.currentState!.reset();
      _name.clear();
      _roll.clear();
      _email.clear();
      setState(() {
        _course = null;
        _images.clear();
      });
      widget.onSubmitted();
    } catch (e) {
      _snack('Submit failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _snack(String m) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(m)));
  }

  InputDecoration _dec(String label, IconData icon) => InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: const OutlineInputBorder(),
      );

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: _dec('Full Name', Icons.person),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Name required' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _roll,
              decoration: _dec('Roll Number', Icons.badge),
              validator: (v) => (v ?? '').trim().isEmpty ? 'Roll no required' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: _dec('Email', Icons.email),
              validator: (v) =>
                  RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch((v ?? '').trim())
                      ? null
                      : 'Valid email required',
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: _course,
              decoration: _dec('Course', Icons.school),
              items: _courses
                  .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                  .toList(),
              onChanged: (v) => setState(() => _course = v),
              validator: (v) => v == null ? 'Select course' : null,
            ),
            const SizedBox(height: 20),
            Text('Face Images (${_images.length}/$kMaxImages)',
                style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : () => _pick(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt),
                  label: const Text('Capture'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy ? null : () => _pick(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library),
                  label: const Text('Gallery'),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            if (_images.isNotEmpty)
              SizedBox(
                height: 90,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _images.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) => Stack(children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.memory(_images[i],
                          width: 90, height: 90, fit: BoxFit.cover),
                    ),
                    Positioned(
                      top: 2,
                      right: 2,
                      child: InkWell(
                        onTap: _busy ? null : () => setState(() => _images.removeAt(i)),
                        child: const CircleAvatar(
                          radius: 11,
                          backgroundColor: Colors.black54,
                          child: Icon(Icons.close, size: 13, color: Colors.white),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 50,
              child: FilledButton.icon(
                onPressed: _busy ? null : _submit,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.send),
                label: Text(_busy ? 'Submitting...' : 'Submit Request'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Tab 2: Status tracking ─────────────────────────

class StatusTab extends StatefulWidget {
  final EnrollmentService service;
  final ValueNotifier<int> refreshTick;
  const StatusTab({super.key, required this.service, required this.refreshTick});

  @override
  State<StatusTab> createState() => _StatusTabState();
}

class _StatusTabState extends State<StatusTab> {
  List<EnrollmentRequest> _all = [];
  RequestStatus? _filter; // null = all
  bool _loading = true;
  String? _error;
  Timer? _poller;

  @override
  void initState() {
    super.initState();
    widget.refreshTick.addListener(_load);
    _load();
    // Auto-poll: pending requests ka status live update hota rahe
    _poller = Timer.periodic(const Duration(seconds: 5), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    widget.refreshTick.removeListener(_load);
    _poller?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent && mounted) setState(() => _loading = true);
    try {
      final data = await widget.service.fetchAll();
      if (!mounted) return;
      setState(() {
        _all = data;
        _error = null;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        if (!silent) _error = '$e';
        _loading = false;
      });
    }
  }

  int _count(RequestStatus? s) =>
      s == null ? _all.length : _all.where((r) => r.status == s).length;

  @override
  Widget build(BuildContext context) {
    final items =
        _filter == null ? _all : _all.where((r) => r.status == _filter).toList();

    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
          child: Row(children: [
            _chip('All', null),
            _chip('Pending', RequestStatus.pending),
            _chip('Approved', RequestStatus.approved),
            _chip('Rejected', RequestStatus.rejected),
          ]),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: _body(items),
          ),
        ),
      ],
    );
  }

  Widget _chip(String label, RequestStatus? s) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(
          label: Text('$label (${_count(s)})'),
          selected: _filter == s,
          onSelected: (_) => setState(() => _filter = s),
        ),
      );

  Widget _body(List<EnrollmentRequest> items) {
    if (_loading && _all.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _all.isEmpty) {
      return ListView(children: [
        const SizedBox(height: 120),
        Center(child: Text('Error: $_error')),
        Center(child: TextButton(onPressed: _load, child: const Text('Retry'))),
      ]);
    }
    if (items.isEmpty) {
      return ListView(children: const [
        SizedBox(height: 120),
        Center(child: Text('Koi request nahi mili')),
      ]);
    }
    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: items.length,
      itemBuilder: (_, i) => RequestCard(req: items[i]),
    );
  }
}

class RequestCard extends StatelessWidget {
  final EnrollmentRequest req;
  const RequestCard({super.key, required this.req});

  static Color colorOf(RequestStatus s) => switch (s) {
        RequestStatus.pending => Colors.orange,
        RequestStatus.approved => Colors.green,
        RequestStatus.rejected => Colors.red,
      };

  static IconData iconOf(RequestStatus s) => switch (s) {
        RequestStatus.pending => Icons.hourglass_top,
        RequestStatus.approved => Icons.check_circle,
        RequestStatus.rejected => Icons.cancel,
      };

  String _fmt(DateTime d) {
    String p(int n) => n.toString().padLeft(2, '0');
    return '${p(d.day)}/${p(d.month)}/${d.year} ${p(d.hour)}:${p(d.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final c = colorOf(req.status);
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ExpansionTile(
        leading: CircleAvatar(
          backgroundColor: c.withOpacity(0.15),
          child: Icon(iconOf(req.status), color: c),
        ),
        title: Text(req.name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('${req.rollNo} • ${req.id}'),
        trailing: Chip(
          label: Text(req.status.name.toUpperCase(),
              style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.bold)),
          backgroundColor: c.withOpacity(0.12),
          side: BorderSide.none,
          visualDensity: VisualDensity.compact,
        ),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Course: ${req.course}'),
          Text('Email: ${req.email}'),
          Text('Submitted: ${_fmt(req.submittedAt)}'),
          const SizedBox(height: 12),
          _step('Submitted', true, Colors.indigo),
          _step('Under review', true, Colors.indigo),
          _step(
            switch (req.status) {
              RequestStatus.pending => 'Awaiting decision',
              RequestStatus.approved => 'Approved',
              RequestStatus.rejected => 'Rejected',
            },
            req.status != RequestStatus.pending,
            c,
          ),
          if (req.remark != null) ...[
            const SizedBox(height: 8),
            Text('Remark: ${req.remark}',
                style: const TextStyle(fontStyle: FontStyle.italic)),
          ],
        ],
      ),
    );
  }

  Widget _step(String label, bool done, Color color) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Icon(done ? Icons.check_circle : Icons.radio_button_unchecked,
              size: 18, color: done ? color : Colors.grey),
          const SizedBox(width: 8),
          Text(label),
        ]),
      );
}
