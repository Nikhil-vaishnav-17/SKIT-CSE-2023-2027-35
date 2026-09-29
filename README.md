# AttendAI

AttendAI is an AI-powered digital classroom platform designed to automate classroom attendance using computer vision and facial recognition.

The system can recognize multiple students from a single classroom photograph and mark attendance automatically. It also provides role-based dashboards for Students, Teachers, and Administrators.

The project is designed to reduce the time spent on manual attendance while maintaining a structured and auditable digital attendance workflow.

---

## Problem Statement

Manual attendance is repetitive and time-consuming. It can also be vulnerable to proxy attendance, where one student marks attendance for another.

Many existing recognition-based attendance systems authenticate students one at a time through methods such as selfie check-ins.

AttendAI addresses this problem by using **single-shot, whole-classroom facial recognition**, allowing multiple students to be recognized from a single classroom image.

---

## Key Features

### Automated Attendance

- Capture a single classroom photograph.
- Detect multiple faces in the image.
- Generate facial embeddings.
- Match detected faces with enrolled students.
- Automatically mark attendance.
- Maintain attendance records digitally.

### Student Enrollment

- Student registration and profile management.
- Capture multiple facial images for enrollment.
- Generate and store facial embeddings.
- Teacher/Admin approval workflow for enrollment.

### Role-Based Access

AttendAI provides separate interfaces for:
- **Student**
- **Teacher**
- **Admin**

### Teacher Dashboard

Teachers can:

- View classroom sessions
- Create and manage sessions
- Capture classroom images
- Review attendance
- Edit attendance before submission
- Submit attendance
- View attendance reports
- Export attendance records

### Admin Dashboard

Administrators can:

- Manage users
- Manage students
- Manage teachers
- Manage courses and sections
- Manage sessions
- Review submitted attendance
- Edit attendance after submission
- Manage system settings

### Student Dashboard

Students can:

- View their profile
- View attendance history
- View class/session information
- View attendance reports
- Receive notifications

---

## How Attendance Works

```text
Classroom
    │
    ▼
Capture Classroom Photo
    │
    ▼
Face Detection
(RetinaFace)
    │
    ▼
Face Embedding Generation
(ArcFace)
    │
    ▼
Compare With Enrolled Students
    │
    ▼
Identify Present Students
    │
    ▼
Attendance Record
    │
    ▼
Teacher Review
    │
    ▼
Submit & Lock