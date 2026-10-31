# Phase 0 Decision Record: SmartKaksha ML Pipeline

**Date:** 2026-11-01  
**Project:** SmartKaksha (Academic Automated Attendance System)  
**Status:** Approved / Signed-off  

---

## 1. Decision 1: Model License and Weights (buffalo_l)
* **Model Pack:** InsightFace `buffalo_l` distribution containing:
  * Detector: `det_10g.onnx` (SCRFD-10GF face detector with 5 landmarks).
  * Recognizer: `w600k_r50.onnx` (ArcFace ResNet-50 trained on WebFace600K, 512-d embeddings).
* **Licensing Compliance:**
  * SmartKaksha is an unpaid academic college project. InsightFace models are released for non-commercial research use.
  * If the institution transitions to commercial operation or campus-wide production beyond academic research, commercial licensing terms from InsightFace must be formally obtained or models migrated.
* **Module Pruning:**
  * Only detector (`det_10g.onnx`) and recognizer (`w600k_r50.onnx`) are loaded.
  * Gender/age estimation (`genderage.onnx`) and secondary 2D/3D dense landmark models are excluded to reduce inference latency and prevent unnecessary biometric profiling.

---

## 2. Decision 2: Privacy, Consent, and Data Governance (DPDP Alignment)
* **Roles:**
  * Data Fiduciary: The College / Institution.
  * Data Processor: SmartKaksha System & ML Pipeline.
* **Consent Mechanisms:**
  * Standalone, plain-language digital consent collected before registration.
  * Separate consent for live attendance processing and evaluation/benchmark dataset inclusion.
  * Parental/guardian consent workflow required for any student under age 18.
  * Opt-out: Students opting out are marked manually by instructors; un-enrolled students are never auto-marked absent.
* **Storage and Retention:**
  * Enrollment photos (5 per student) are encrypted at rest with the backend photo storage for re-embedding across model versions.
  * Classroom attendance capture photos are retained only for a temporary audit window (e.g., 30 days for disputes) after attendance locking, then purged.
  * Face embeddings in vector stores (Qdrant) are keyed strictly by opaque UUID/student ID; no student names, branches, or classes are stored in vectors.
* **Deletion & Redaction:**
  * Right to erasure (`remove-student`) purges vectors from Qdrant, split manifests, and staging directories.
  * Zero biometric data (photos, cropped faces, raw embeddings, student names) in system logs at any level. Only anonymized IDs, bounding boxes, and performance metrics are logged.

---

## 3. Decision 3: Serving Hardware Selection
* **Target Hardware Exploration:**
  * Evaluate CPU-only server vs. single GPU server on baseline 70-face classroom images.
  * Final production deployment choice governed by the latency requirement ($\text{p95} \le 10\text{ s}$).
  * Both CPU (`onnxruntime`) and GPU (`onnxruntime-gpu`) packaging targets maintained via mutually exclusive Python extras.

---

## 4. Decision 4: Operating Targets & Validation Sizing
* **Core Metrics:**
  * **False-Present Rate (FPR):** Upper 95% confidence bound $\le 0.5\%$ on unknown-person searches (achieved via gallery ablation).
  * **False-Absent Rate (FAR):** $\le 5\%$ for present students pre-filled as absent.
  * **Review Load:** $\le 10\%$ of session roster flagged for manual instructor review (`uncertain` / ambiguous faces).
  * **Inference Latency:** $\text{p95} \le 10\text{ s}$ for a single full classroom photo with 70 students on chosen hardware.
* **Dataset Target:**
  * Minimum 8 sections, 5 sessions each, 1–3 photos per session with ground-truth manual attendance and identity labeling.
  * Open-set evaluation with bootstrap resampling across sessions and students.

---

## 5. Decision 5: Image Capture & Quality Protocol
* **Student Enrollment Protocol:**
  * Exactly 5 photos captured directly inside the app camera (no gallery uploads):
    1. Frontal neutral.
    2. Head rotated slightly left (~15°).
    3. Head rotated slightly right (~15°).
    4. Head tilted slightly down (~10° seated student perspective).
    5. Frontal under varied/natural lighting.
  * Wearers of glasses keep glasses on.
  * Pre-storage validation: single-face check, consistency score $\ge \text{consistency\_min}$, and whole-gallery duplicate search $\le \text{dedup\_threshold}$.
* **Classroom Attendance Protocol:**
  * Instructor captures landscape orientation at head height standing at room front.
  * Overlapping photos (up to 3) triggered if on-device checks detect motion blur, back-row face height $< 40\text{ px}$, or face count discrepancy.
  * Full-resolution JPEG uploaded directly without client-side downsampling.

