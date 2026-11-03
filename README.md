# Brainzima Student Management System — REST API Backend

> Production REST API backend for the Brainzima Student Management System, deployed at:  
> **Production Base URL**: `https://api.brainzima.com/student/api` *(also supports alias `.../studnet/api`)*  
> Built strictly with Pure OOP PHP 8.2+ and MySQLi OOP to power the Next.js 14+ frontend.

[![PHP Version](https://img.shields.io/badge/PHP-8.2%2B-777BB4?logo=php&logoColor=white)](#)
[![Database](https://img.shields.io/badge/Database-MySQL%20%2F%20MariaDB-4479A1?logo=mysql&logoColor=white)](#)
[![Driver](https://img.shields.io/badge/Driver-MySQLi%20OOP-005C84)](#)
[![Methods](https://img.shields.io/badge/Methods-GET%20%7C%20POST%20%7C%20PUT%20%7C%20PATCH%20%7C%20DELETE-brightgreen)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Clean%20OOP%20REST%20API-green)](#)
[![Storage](https://img.shields.io/badge/File%20Uploads-Flat%20Directory%20%7C%20FileUploadHelper-blue)](#)
[![Upload](https://img.shields.io/badge/Content--Type-multipart%2Fform--data-orange)](#)

---

## Production API Base URLs

- **Primary Production URL**:  
  `https://api.brainzima.com/student/api`
- **Fallback / Alias URL (supports common typo)**:  
  `https://api.brainzima.com/student/api`
- **Local Development URL**:  
  `http://localhost/student.brainzima.com/api`

---

## 1. Architecture: Server-Side File Uploads with Flat Directory Storage

### 1.1 Upload Architecture Overview

The PHP backend handles **all file uploads** via `multipart/form-data`. Files are validated, stored on disk in a **flat directory structure**, and only the resulting **relative path string** is persisted in MySQL.

```
Next.js Frontend
       │
       │  multipart/form-data (or JSON)
       ▼
PHP REST API  ──▶  FileUploadHelper
       │                │
       │         ┌──────┴───────────────────────────────┐
       │         │  uploads/images/                      │
       │         ├── users/         user-12-profile-xxx.jpg
       │         ├── students/      student-5-profile-xxx.webp
       │         ├── adharfront/    student-5-aadhaar-front-xxx.webp
       │         ├── adharback/     student-5-aadhaar-back-xxx.webp
       │         ├── qualification/ student-5-qualification-xxx.pdf
       │         └── notes/         course-3-react-fundamentals-xxx.pdf
       │
       ▼
MySQL — stores ONLY the path string
       └── uploads/images/users/user-12-profile-xxx.jpg
```

### 1.2 Responsibility Table

| Responsibility | Backend (PHP 8.2+ REST API) | Frontend (Next.js) |
| :--- | :--- | :--- |
| **File Selection** | — | Rendered in browser UI |
| **File Upload** | Receives `$_FILES` via `multipart/form-data` | Sends `FormData` |
| **MIME Validation** | `finfo` — validates actual file content | — |
| **Extension Check** | Whitelist: `jpg jpeg png webp pdf` — blocks executables | — |
| **Size Enforcement** | Configurable per type (images 5 MB, docs 10 MB, PDF 20 MB) | — |
| **Filename Generation** | Safe, unique: `entity-id-type-timestamp-rand.ext` | Never uses original filename |
| **Directory Mapping** | Hardcoded whitelist — never accepts path from client | — |
| **Path Storage** | Stores only relative path string in MySQL | Consumes path to render image/file URL |
| **File Replacement** | Upload new → update DB → delete old | — |
| **File Deletion** | `FileUploadHelper::delete()` with path traversal check | — |

### 1.3 Flat Directory Rule — Enforced in `FileUploadHelper`

**NEVER** creates entity-specific subdirectories. IDs belong in **filenames only**.

```
CORRECT (flat — always):
  uploads/images/users/user-12-profile-1728123456abc.jpg
  uploads/images/students/student-5-profile-1728123456abc.webp
  uploads/images/adharfront/student-5-aadhaar-front-1728123456abc.webp
  uploads/images/notes/course-3-react-fundamentals-1728123456abc.pdf

FORBIDDEN (nested — never):
  uploads/images/users/user-12/profile.jpg
  uploads/images/students/student-5/profile.webp
  uploads/images/adharfront/student-5/aadhaar-front.webp
```

### 1.4 Filename Pattern

```
user_image      →  user-{id}-profile-{timestamp}{rand}.{ext}
student_image   →  student-{id}-profile-{timestamp}{rand}.{ext}
aadhaar_front   →  student-{id}-aadhaar-front-{timestamp}{rand}.{ext}
aadhaar_back    →  student-{id}-aadhaar-back-{timestamp}{rand}.{ext}
qualification   →  student-{id}-qualification-{timestamp}{rand}.{ext}
notes_pdf       →  course-{id}-{slug}-{timestamp}{rand}.{ext}
```

**Example filenames:**
```
user-12-profile-17281234561a2b3c4d.jpg
student-5-profile-17281234565e6f7a8b.webp
student-5-aadhaar-front-17281234569c0d1e2f.webp
student-5-aadhaar-back-17281234563g4h5i6j.webp
student-5-qualification-17281234567k8l9m0n.pdf
course-3-react-fundamentals-17281234561p2q3r4s.pdf
```

### 1.5 Database Path Format

The database stores **only the application-relative path string** — never BLOBs, base64, or filesystem absolute paths.

| What to store | What NOT to store |
| :--- | :--- |
| `uploads/images/users/user-12-profile-xxx.jpg` | `C:\xampp\htdocs\...\profile.jpg` |
| `uploads/images/students/student-5-profile-xxx.webp` | `blob:...` or base64 data |
| `uploads/images/adharfront/student-5-aadhaar-front-xxx.webp` | `/var/www/html/uploads/...` |

---

## 2. `FileUploadHelper` — Reusable OOP Upload Service

**Location**: `helpers/FileUploadHelper.php`

### 2.1 Public API

```php
// Upload a file from $_FILES and return the stored path string
FileUploadHelper::upload(array $file, string $uploadType, int $entityId, string $slug = ''): string

// Safely delete a file by its DB path (with traversal protection)
FileUploadHelper::delete(string $dbPath): bool

// Check if a $_FILES field was actually submitted
FileUploadHelper::hasFile(string $key): bool
```

### 2.2 Upload Type Whitelist

| `$uploadType` key | Stored folder | Entity ID |
| :--- | :--- | :--- |
| `user_image` | `uploads/images/users/` | `user_id` |
| `student_image` | `uploads/images/students/` | `st_id` |
| `aadhaar_front` | `uploads/images/adharfront/` | `st_id` |
| `aadhaar_back` | `uploads/images/adharback/` | `st_id` |
| `qualification` | `uploads/images/qualification/` | `st_id` |
| `notes_pdf` | `uploads/images/notes/` | `course_id` |

> **Security**: The directory is always resolved from this backend whitelist. The client can **never** send a directory path — only the file data.

### 2.3 Validation Rules

| Validation | Rule |
| :--- | :--- |
| PHP upload error | Must be `UPLOAD_ERR_OK` |
| `is_uploaded_file()` | Enforced — rejects non-HTTP uploads |
| MIME type | Verified via `finfo` from actual file bytes |
| Extension | Whitelist: images `jpg jpeg png webp`; docs `pdf jpg jpeg png webp` |
| MIME ↔ extension cross-check | Extension must match detected MIME |
| Blocked extensions | `php phtml phar exe sh js html htm cgi jsp asp …` |
| File size (images) | 5 MB max |
| File size (documents) | 10 MB max |
| File size (notes PDF) | 20 MB max |

### 2.4 File Replacement Sequence

```
1. Validate new file
2. Upload new file to disk
3. Generate new path string
4. Update database with new path
5. ✅ DB update succeeded → delete old physical file
   ❌ DB update failed   → delete new file, keep old DB value + old file
```

### 2.5 Safe Deletion Rules

`FileUploadHelper::delete()` enforces:
- Path must start with `uploads/images/`
- No `..` path traversal allowed
- No `\0` null bytes
- No absolute filesystem paths (Windows or Unix)
- `realpath()` resolved path must remain inside `API_ROOT/uploads/images/`
- Symbolic-link escapes rejected

### 2.6 Upload Directory Structure

```
api/
└── uploads/
    ├── .htaccess              ← blocks PHP execution inside uploads/
    └── images/
        ├── users/
        ├── students/
        ├── adharfront/
        ├── adharback/
        ├── qualification/
        └── notes/
```

The `.htaccess` inside `uploads/` denies execution of `.php`, `.phtml`, `.phar`, `.exe`, `.sh`, `.js`, `.html`, and other script types, even if a malicious file were somehow placed there.

---

## 3. Request Format: multipart/form-data

All file upload endpoints accept `multipart/form-data`. Text fields are read from `$_POST` and files from `$_FILES`.

### 3.1 Example: Register with Profile Image

```http
POST /auth/register
Content-Type: multipart/form-data

name       = Ajit Kumar
email      = ajit@example.com
mobile     = 9876543210
password   = Password@123
user_image = <binary file data>
```

### 3.2 Example: Update User Profile Image

```http
PATCH /api/user/image
Content-Type: multipart/form-data
X-User-Id: 12
X-User-Role: student

user_image = <binary file data>
```

### 3.3 Example: Upload Student Documents

```http
POST /api/document/student/5
Content-Type: multipart/form-data
X-User-Id: 12
X-User-Role: student

docs_st_aadhaar_front = <binary file data>
docs_st_aadhaar_back  = <binary file data>
docs_st_qualification = <binary file data>
```

### 3.4 Example: Upload Notes PDF

```http
POST /api/notes
Content-Type: multipart/form-data
X-User-Id: 1
X-User-Role: admin

notes_title     = React Fundamentals
notes_course_id = 3
notes_pdf       = <binary file data>
```

### 3.5 Backward Compatibility — Path Strings Still Accepted

If no file is uploaded, all endpoints also accept a plain path string in the request body (JSON or form-encoded) for backward compatibility and testing:

```json
{
  "user_image": "uploads/images/users/user-12-profile-1728123456.jpg"
}
```

---

## 4. Full PATCH & Method Overriding Support

The API natively supports the `PATCH` HTTP verb across **all resource update endpoints**:
- **Native Direct PATCH**: Clients send `PATCH` directly to `/api/user/profile`, `/api/user/{id}`, `/api/student/me`, `/api/student/{id}`, `/api/course/{id}`, `/api/fee/{id}`, `/api/notes/{id}`, etc.
- **HTTP Method Overriding**: Supported for clients or proxies unable to send native PATCH:
  - Header: `X-HTTP-Method-Override: PATCH` (or `PUT`)
  - Body parameter: `_method=PATCH`
  - Query parameter: `?_method=PATCH`
- **Multipart PATCH**: For file uploads, send `POST` with `_method=PATCH` in the form body since browsers do not natively support `PATCH` + `multipart/form-data`.

---

## 5. Architecture Overview

```
Next.js Frontend / Client
        │
        │ multipart/form-data OR JSON
        │ Auth Headers (X-User-Id, X-User-Role)
        │ Native HTTP Verbs (GET, POST, PUT, PATCH, DELETE)
        │
        ▼
    PHP API (core/Router.php)
        │
┌───────┼─────────────────────┐
│       │                     │
▼       ▼                     ▼
Request CORS               Response
(POST   (GET, POST,       (Uniform
 + FILES PUT, PATCH,       Envelopes)
 Parser) DELETE)
        │
        ▼
    FileUploadHelper ──▶  uploads/images/{type}/
        │
        ▼
    Controllers ──────▶ Models (MySQLi Prepared Stmts)
        │                       │
        ├── AuthController       ├── AuthModel
        ├── UserController       ├── UserModel       (bi_users.user_image)
        ├── StudentController    ├── StudentModel    (bi_student.user_image)
        ├── CourseController       ├── CourseModel       (bi_courses)
        ├── OnlineCourseController ├── OnlineCourseModel (bi_online_courese, bi_online_coures_syllabus)
        ├── OnlineCouponController ├── OnlineCouponModel (bi_coupons_online)
        ├── CouponController       ├── CouponModel       (bi_coupons)
        ├── EnrollmentController   ├── EnrollmentModel   (bi_st_course)
        ├── FeeController          ├── FeeModel          (bi_fee_transactions)
        ├── AttendanceController   ├── AttendanceModel   (bi_attendance)
        ├── NotesController        ├── NotesModel        (bi_notes.notes_pdf)
        ├── DocumentController     ├── DocumentModel     (bi_st_docs)
        ├── FranchiseeController   ├── FranchiseeModel   (bi_franchisee)
        ├── QuizQuestionController ├── QuizQuestionModel (bi_online_quiz_questions)
        ├── OnlineResultController ├── OnlineResultModel (bi_online_result)
        ├── OnlineCourseFeedbackController ├── OnlineCourseFeedbackModel (bi_online_courese_feedbak)
        └── EbookLibraryController └── EbookLibraryModel (bi_ebook_library)
```
---
## 6. Technology Stack & Invariants

### Strictly Followed
- **PHP 8.2+** with `declare(strict_types=1);` and typed properties.
- **Pure OOP PHP**: Dedicated controllers, models, helpers, and middleware.
- **MySQLi Prepared Statements**: Complete parameterized binding (`bind_param`) everywhere.
- **Zero Framework Bloat**: No external frameworks, micro-frameworks, or PDO.
- **Stateless Authentication**: Next.js passes `X-User-Id` and `X-User-Role` headers.
- **Bcrypt Password Security**: Passwords hashed with `PASSWORD_DEFAULT` and verified with `password_verify()`.
- **Flat Upload Architecture**: `FileUploadHelper` enforces zero entity subdirectories.
- **DB Stores Path Strings Only**: MySQL columns store only the relative path, never binary data.

---

## 7. API Directory Structure

```
/api
├── attendance/
│   ├── AttendanceController.php
│   ├── AttendanceModel.php
│   └── index.php
├── auth/
│   ├── AuthController.php      ← register handles $_FILES['user_image']
│   ├── AuthModel.php
│   └── index.php
├── config/
│   ├── Config.php
│   ├── Cors.php
│   ├── Database.php
│   ├── patch.sql               ← Migration script for user_image & sync
│   └── sql.sql                 ← Complete DB dump
├── core/
│   ├── Request.php             ← JSON parser, method override, file() helper
│   ├── Response.php            ← Predictable JSON Envelopes
│   ├── Router.php              ← Full PATCH, PUT, POST, GET, DELETE routing
│   └── Validator.php
├── coupon/                     ← Offline (bi_coupons) & Online (bi_coupons_online) Coupons API
│   ├── CouponController.php
│   ├── CouponModel.php
│   ├── OnlineCouponController.php
│   ├── OnlineCouponModel.php
│   └── index.php
├── course/
│   ├── CourseController.php    ← ✨ UPGRADED: Full CRUD (GET, POST, PUT, PATCH, DELETE)
│   ├── CourseModel.php
│   └── index.php
├── ebooks-lib/                 ← ✨ NEW: E-Books Library CRUD & PDF Storage
│   ├── EbookLibraryController.php
│   ├── EbookLibraryModel.php
│   ├── index.php
│   ├── test_ebooks_api.php
│   ├── pdf/                    ← Uploaded E-Book PDFs (.pdf)
│   └── pdfs/
├── enrollment/
│   ├── EnrollmentController.php
│   ├── EnrollmentModel.php
│   └── document/
│       ├── DocumentController.php  ← handles $_FILES for all 4 doc types
│       ├── DocumentModel.php
│       └── index.php
├── feedback/                   ← ✨ NEW: Online Course Feedback API
│   ├── OnlineCourseFeedbackController.php
│   ├── OnlineCourseFeedbackModel.php
│   ├── index.php
│   └── test_feedback_api.php
├── fee/
│   ├── FeeController.php
│   ├── FeeModel.php
│   └── index.php
├── franchisee/
│   ├── FranchiseeController.php
│   ├── FranchiseeModel.php
│   └── index.php
├── helpers/
│   ├── EmailHelper.php
│   ├── FileUploadHelper.php    ← ✨ NEW: Central upload service
│   ├── ImageHelper.php         ← stub (superseded by FileUploadHelper)
│   ├── IpHelper.php
│   ├── PasswordHelper.php
│   └── RegNoHelper.php
├── middleware/
│   ├── RequestMiddleware.php
│   ├── RoleMiddleware.php
│   └── ValidationMiddleware.php
├── notes/
│   ├── NotesController.php     ← handles $_FILES['notes_pdf']
│   ├── NotesModel.php
│   └── index.php
├── onlinecoures/               ← ✨ NEW: Online courses & syllabus API
│   ├── OnlineCourseController.php
│   ├── OnlineCourseModel.php
│   └── index.php
├── student/
│   ├── StudentController.php   ← handles $_FILES['user_image']
│   ├── StudentModel.php
│   └── index.php
├── uploads/                    ← ✨ NEW: Physical upload root
│   ├── .htaccess               ← blocks PHP execution inside uploads/
│   └── images/
│       ├── users/
│       ├── students/
│       ├── adharfront/
│       ├── adharback/
│       ├── qualification/
│       └── notes/
├── user/
│   ├── UserController.php      ← handles $_FILES['user_image']
│   ├── UserModel.php
│   └── index.php
├── .env
├── .htaccess
├── index.php
└── README.md
```

---

## 8. Standard JSON Response Envelopes

### Success Envelope (HTTP 200 / 201)
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```

### Error Envelope (HTTP 400 / 401 / 403 / 404 / 405 / 422 / 500)
```json
{
  "success": false,
  "message": "Error description."
}
```

### Validation Failure Envelope (HTTP 422)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": "Email is already registered."
  }
}
```

### File Upload Error Envelope (HTTP 422)
```json
{
  "success": false,
  "message": "Invalid file type. Detected MIME: application/x-php."
}
```

---

## 9. Complete API Reference

### 9.1 Authentication (`/auth`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/auth/register` | `POST` | Public | Register new user. Accepts `user_image` file upload or path string. |
| `/auth/login` | `POST` | Public | Unified login (email, mobile, or student regno). Returns `user_image` path. |
| `/auth/student-login` | `POST` | Public | Dedicated student login using `regno` + `password`. |
| `/auth/forgot-password` | `POST` | Public | Password reset initiation. |
| `/auth/reset-password` | `POST` | Public | Reset password with new bcrypt hash. |

#### Register User (with file upload)
- **Method**: `POST`
- **Path**: `/auth/register`
- **Content-Type**: `multipart/form-data`

```
name       = Ajit Kumar
email      = ajit@example.com
mobile     = 9876543210
password   = Password@123
user_image = <file>              ← optional; jpg/jpeg/png/webp, max 5 MB
```

- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user_id": 12,
    "name": "Ajit Kumar",
    "email": "ajit@example.com",
    "role": "user",
    "user_image": "uploads/images/users/user-12-profile-17281234561a2b3c4d.jpg"
  }
}
```

#### Unified Login
- **Method**: `POST`
- **Path**: `/auth/login`
- **Content-Type**: `application/json`

```json
{
  "identifier": "ajit@example.com",
  "password": "Password@123",
  "ip": "103.120.10.11"
}
```

- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user_id": 12,
    "name": "Ajit Kumar",
    "email": "ajit@example.com",
    "mobile": "9876543210",
    "role": "student",
    "is_student": true,
    "student_id": 5,
    "registration_number": "BISR0005",
    "centre_id": 1,
    "user_image": "uploads/images/users/user-12-profile-17281234561a2b3c4d.jpg"
  }
}
```

---

### 9.2 User Profile & Account (`/api/user`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/user/me` | `GET` | Authenticated | Retrieve current user profile with `user_image` path |
| `/api/user/profile` | `PATCH`, `PUT`, `POST` | Authenticated | Partial update: name, email, mobile, and/or `user_image` file/path |
| `/api/user/image` | `POST`, `PUT`, `PATCH` | Authenticated | Dedicated endpoint to upload or update `user_image` |
| `/api/user/image` | `DELETE` | Authenticated | Deletes physical file + sets `user_image = NULL` in database |
| `/api/user/password` | `PUT`, `PATCH` | Authenticated | Change user account password |
| `/api/user/{id}` | `GET` | Self / Admin | Get account details by `user_id` |
| `/api/user/{id}` | `PATCH`, `PUT` | Self / Admin | Update user (Admin can update role, verified, etc.) |
| `/api/user` | `GET` | Admin (Self if non-admin) | List all registered users with pagination & search |
| `/api/user/{id}` | `DELETE` | Admin | Delete user account from database |

#### Update Profile with Image Upload (`PATCH /api/user/profile`)
- **Content-Type**: `multipart/form-data`
- **Headers**: `X-User-Id: 12`, `X-User-Role: student`

```
name       = Ajit Kumar Singh   ← optional
mobile     = 9876543219         ← optional
user_image = <file>             ← optional; replaces existing image
```

- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user_id": 12,
    "name": "Ajit Kumar Singh",
    "email": "ajit@example.com",
    "mobile": "9876543219",
    "role": "student",
    "verified": true,
    "user_image": "uploads/images/users/user-12-profile-17281234565e6f7a8b.jpg",
    "is_student": true,
    "student_id": 5,
    "registration_number": "BISR0005"
  }
}
```

#### Dedicated Image Upload (`POST /api/user/image`)
- **Content-Type**: `multipart/form-data`
- **Headers**: `X-User-Id: 12`

```
user_image = <file>    ← jpg/jpeg/png/webp, max 5 MB
```

- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Profile image updated successfully",
  "data": {
    "user_id": 12,
    "user_image": "uploads/images/users/user-12-profile-17281234565e6f7a8b.webp"
  }
}
```

#### Remove Profile Image (`DELETE /api/user/image`)
- **Headers**: `X-User-Id: 12`
- **Description**: Deletes the physical file from `uploads/images/users/` **and** sets `user_image = NULL` in `bi_users`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Profile image removed successfully",
  "data": {
    "user_id": 12,
    "user_image": null
  }
}
```

---

### 9.3 Student Profiles (`/api/student`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/student/me` | `GET` | Authenticated | Get current authenticated student's profile |
| `/api/student/me` | `PATCH`, `PUT` | Authenticated | Student self-update — supports `user_image` file upload |
| `/api/student/{id}` | `GET` | Student (own) / Admin | Get student details by `st_id` |
| `/api/student/{id}` | `PATCH`, `PUT` | Student (own) / Admin | Update student profile — supports `user_image` file upload |
| `/api/student/password`| `PUT`, `PATCH` | Student / Admin | Change student password |
| `/api/student` | `GET` | Admin / Student | List students |
| `/api/student` | `POST` | Admin | Create student record directly |
| `/api/student/{id}` | `DELETE` | Admin | Delete student database record |

#### Update Student Profile with Image (`PATCH /api/student/me`)
- **Content-Type**: `multipart/form-data`
- **Headers**: `X-User-Id: 12`, `X-User-Role: student`

```
st_mobile_parent = 9001000009     ← optional
st_address       = Line Bazar     ← optional
st_qualification = Graduation     ← optional
user_image       = <file>         ← optional; jpg/jpeg/png/webp → uploads/images/students/
```

- **Student image is stored in**: `uploads/images/students/student-5-profile-xxx.webp`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Student updated successfully.",
  "data": {
    "st_id": 5,
    "st_user_id": 12,
    "st_regno": "BISR0005",
    "st_name": "Ajit Kumar",
    "user_image": "uploads/images/students/student-5-profile-17281234569c0d1e2f.webp"
  }
}
```

---

### 9.4 Student Documents (`/api/document`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/document/student/{id}` | `GET` | Student / Admin | Get stored document paths |
| `/api/document/student/{id}` | `POST` | Student / Admin | Upload documents (file upload or path strings) |
| `/api/document/{id}` | `PUT`, `PATCH` | Student / Admin | Update documents (file upload or path strings) |
| `/api/document/{id}` | `DELETE` | Admin | Delete document record + physical files |

#### Upload Documents (`POST /api/document/student/5`)
- **Content-Type**: `multipart/form-data`
- **Headers**: `X-User-Id: 12`, `X-User-Role: student`

| Field | Upload Type | Stored In |
| :--- | :--- | :--- |
| `docs_st_image` | `student_image` | `uploads/images/students/` |
| `docs_st_aadhaar_front` or `aadhaar_front` | `aadhaar_front` | `uploads/images/adharfront/` |
| `docs_st_aadhaar_back` or `aadhaar_back` | `aadhaar_back` | `uploads/images/adharback/` |
| `docs_st_qualification` or `qualification` | `qualification` | `uploads/images/qualification/` |

- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Documents saved successfully.",
  "data": {
    "docs_id": 3,
    "docs_st_id": 5,
    "docs_st_image": "uploads/images/students/student-5-profile-17281234561a2b3c4d.webp",
    "docs_st_aadhaar_front": "uploads/images/adharfront/student-5-aadhaar-front-17281234565e6f7a8b.webp",
    "docs_st_aadhaar_back": "uploads/images/adharback/student-5-aadhaar-back-17281234569c0d1e2f.webp",
    "docs_st_qualification": "uploads/images/qualification/student-5-qualification-17281234563g4h5i6j.pdf",
    "st_regno": "BISR0005",
    "st_name": "Ajit Kumar"
  }
}
```

> **PATCH behavior**: Send only the fields you want to update. Omitted fields are left unchanged in the database.

---

### 9.5 Study Notes (`/api/notes`)

Full REST API for course study notes and PDF documents stored in database table `bi_notes`. Supports PDF document uploads via `multipart/form-data` or JSON relative path strings. Uploaded PDF files are stored in `uploads/images/notes/` with strict MIME type validation (`application/pdf`) and size limit (up to 20 MB).

Available route prefixes: `/api/notes`.

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/notes` | `GET` | Public / Student / Admin | List course study notes (supports `?page=`, `?limit=`, and `?course_id=`). Students see notes for enrolled courses; Public/Admin sees all. |
| `/api/notes/{id}` | `GET` | Student (enrolled) / Admin | Get single note details with joined course information and `notes_pdf` path |
| `/api/notes` | `POST` | Admin | Create study note with PDF file upload (`multipart/form-data`) or relative path string (`application/json`) |
| `/api/notes/{id}` | `PUT` | Admin | Fully update note metadata and optionally replace the physical PDF file |
| `/api/notes/{id}` | `PATCH` | Admin | Partially update supplied note fields (supports `_method=PATCH` for multipart) |
| `/api/notes/{id}` | `DELETE` | Admin | Delete note record from `bi_notes` and clean up the associated physical PDF file |

#### 1. List Study Notes (`GET /api/notes`)
- **Method**: `GET`
- **Path**: `/api/notes`
- **Query Parameters (Optional)**:
  - `page`: Page number (default `1`).
  - `limit`: Number of items per page (default `50`, max `100`).
  - `course_id`: Filter notes by specific course ID (e.g. `?course_id=1`).
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "notes": [
      {
        "notes_id": 10,
        "notes_title": "Database Management & SQL Queries Mastery",
        "notes_description": "Relational database design, normalization, ACID properties, indexing, and complex SQL joins.",
        "notes_pdf": "uploads/images/notes/course-1-database-management-sql-queries-mastery-a62984ce.pdf",
        "notes_course_id": 1,
        "created_at": "2026-10-10 19:35:57",
        "updated_at": "2026-10-10 19:35:57",
        "course_code": "ADCA",
        "course_name": "Advanced Diploma in Computer Applications"
      },
      {
        "notes_id": 9,
        "notes_title": "Network Security and Ethical Hacking",
        "notes_description": "TCP/IP protocol security, firewalls, network packet analysis, Wireshark, and penetration testing.",
        "notes_pdf": "uploads/images/notes/course-5-network-security-ethical-hacking-186122ed.pdf",
        "notes_course_id": 5,
        "created_at": "2026-10-10 19:35:57",
        "updated_at": "2026-10-10 19:35:57",
        "course_code": "CYBER",
        "course_name": "Cyber Security Fundamentals"
      }
    ],
    "page": 1,
    "limit": 50,
    "count": 10
  }
}
```

#### 2. Get Single Note (`GET /api/notes/{id}`)
- **Method**: `GET`
- **Path**: `/api/notes/1`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "notes_id": 1,
    "notes_title": "Computer Fundamentals",
    "notes_description": "ADCA basic computer notes.",
    "notes_pdf": "notes/adca/computer-fundamentals.pdf",
    "notes_course_id": 1,
    "created_at": "2026-09-26 14:03:43",
    "updated_at": "2026-09-26 14:03:43",
    "course_code": "ADCA",
    "course_name": "Advanced Diploma in Computer Applications"
  }
}
```

#### 3. Create Note with PDF Upload (`POST /api/notes`)
- **Content-Type**: `multipart/form-data` or `application/json`
- **Headers**: `X-User-Id: 53`, `X-User-Role: admin`
- **Form Fields (Multipart)**:
  - `notes_title`: Required string, max 255 chars.
  - `notes_description`: Optional description text.
  - `notes_course_id`: Required course ID (must exist in `bi_courses`).
  - `notes_pdf`: Binary PDF file upload (max 20 MB).
- **PDF Stored Location**: `uploads/images/notes/course-{id}-{slug}-{unique}.pdf`
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Note created successfully.",
  "data": {
    "notes_id": 11,
    "notes_title": "React Server Components",
    "notes_description": "Deep dive into RSC and Next.js App Router.",
    "notes_pdf": "uploads/images/notes/course-3-react-server-components-7k8l9m0n.pdf",
    "notes_course_id": 3,
    "course_code": "MERN",
    "course_name": "MERN Stack Development"
  }
}
```

#### 4. Update Note (`PUT` / `PATCH /api/notes/{id}`)
- **Headers**: `X-User-Id: 53`, `X-User-Role: admin`
- Updates metadata (title, description, course) and/or replaces the existing PDF file. When a new PDF is uploaded, the old file is safely unlinked.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Note updated successfully.",
  "data": {
    "notes_id": 11,
    "notes_title": "React Server Components & Actions",
    "notes_description": "Updated deep dive into RSC and Server Actions.",
    "notes_pdf": "uploads/images/notes/course-3-react-server-components-actions-9x8y7z6w.pdf",
    "notes_course_id": 3,
    "course_code": "MERN",
    "course_name": "MERN Stack Development"
  }
}
```

#### 5. Delete Note (`DELETE /api/notes/{id}`)
- **Headers**: `X-User-Id: 53`, `X-User-Role: admin`
- Deletes the record from `bi_notes` and removes the physical PDF file from the server.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Note deleted successfully.",
  "data": null
}
```

#### 6. Available Seeded Dummy Notes & Direct PDF Access
The following 10 verified dummy study notes with physical PDF files are available for testing:

| Note ID | Course | Title | Relative PDF Path | Direct Browser / Download URL |
| :---: | :--- | :--- | :--- | :--- |
| **#1** | **ADCA** (1) | Computer Fundamentals | `notes/adca/computer-fundamentals.pdf` | `http://localhost/student.brainzima.com/notes/adca/computer-fundamentals.pdf` |
| **#2** | **DWD** (2) | HTML and CSS | `notes/dwd/html-css.pdf` | `http://localhost/student.brainzima.com/notes/dwd/html-css.pdf` |
| **#3** | **MERN** (3) | React Fundamentals | `notes/mern/react-fundamentals.pdf` | `http://localhost/student.brainzima.com/notes/mern/react-fundamentals.pdf` |
| **#4** | **JAVA** (4) | Java OOP | `notes/java/java-oop.pdf` | `http://localhost/student.brainzima.com/notes/java/java-oop.pdf` |
| **#5** | **CYBER** (5) | OWASP Basics | `notes/cyber/owasp-basics.pdf` | `http://localhost/student.brainzima.com/notes/cyber/owasp-basics.pdf` |
| **#6** | **DWD** (2) | Advanced JavaScript & TypeScript | `uploads/images/notes/course-2-advanced-javascript-typescript-guide-*.pdf` | `http://localhost/student.brainzima.com/api/uploads/images/notes/course-2-advanced-javascript-typescript-guide-*.pdf` |
| **#7** | **MERN** (3) | Node.js & Express REST API | `uploads/images/notes/course-3-nodejs-express-rest-api-architecture-*.pdf` | `http://localhost/student.brainzima.com/api/uploads/images/notes/course-3-nodejs-express-rest-api-architecture-*.pdf` |
| **#8** | **JAVA** (4) | Spring Boot Microservices | `uploads/images/notes/course-4-spring-boot-microservices-architecture-*.pdf` | `http://localhost/student.brainzima.com/api/uploads/images/notes/course-4-spring-boot-microservices-architecture-*.pdf` |
| **#9** | **CYBER** (5) | Network Security & Ethical Hacking | `uploads/images/notes/course-5-network-security-ethical-hacking-*.pdf` | `http://localhost/student.brainzima.com/api/uploads/images/notes/course-5-network-security-ethical-hacking-*.pdf` |
| **#10** | **ADCA** (1) | Database Management & SQL Queries | `uploads/images/notes/course-1-database-management-sql-queries-mastery-*.pdf` | `http://localhost/student.brainzima.com/api/uploads/images/notes/course-1-database-management-sql-queries-mastery-*.pdf` |

---

### 9.6 Course Catalog (`/api/course`)

Complete CRUD endpoints for managing offline courses (`bi_courses`). Supports course image uploads saved into `course/images/` or string paths in `course_img_path`.

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/course` | `GET` | Public | List courses (supports `?status=active\|inactive` and `?search={term}`) |
| `/api/course/{id}` | `GET` | Public | Fetch a single course by ID |
| `/api/course` | `POST` | Admin | Create a new course (supports `course_image` file upload or `course_img_path`) |
| `/api/course/{id}` | `PUT` | Admin | Fully update an existing course (supports `course_image` file upload or `course_img_path`) |
| `/api/course/{id}` | `PATCH` | Admin | Partially update only the supplied fields |
| `/api/course/{id}` | `DELETE` | Admin | Delete a course by ID (safely handles database constraints & unlinks image) |
| `/api/course/{id}/image` | `POST` | Admin | Dedicated image upload/update endpoint (`course_image` multipart file) |
| `/api/course/{id}/image` | `DELETE` | Admin | Remove course image (unlinks physical file & clears DB column) |

#### 1. List Courses (`GET /api/course`)
- **Method**: `GET`
- **Path**: `/api/course`
- **Query Parameters (Optional)**:
  - `status`: Filter by status (`active` or `inactive`). Defaults to `active` for non-admin callers.
  - `search` / `q`: Case-insensitive substring search matching `course_code` or `course_name`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Courses retrieved successfully.",
  "data": [
    {
      "course_id": 1,
      "course_code": "ADCA",
      "course_name": "Advanced Diploma in Computer Applications",
      "course_img_path": "course/images/course-1-adca-1728123456abcd.jpg",
      "course_description": "Complete computer applications program.",
      "course_modules": "Computer Basics, MS Office, Internet, Tally, DTP, Typing",
      "course_duration": "12 Months",
      "course_fee": "8000.00",
      "course_status": "active",
      "created_at": "2026-09-26 14:03:43",
      "updated_at": "2026-09-26 14:03:43"
    }
  ]
}
```

#### 2. Get Single Course (`GET /api/course/{id}`)
- **Method**: `GET`
- **Path**: `/api/course/1`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Course retrieved successfully.",
  "data": {
    "course_id": 1,
    "course_code": "ADCA",
    "course_name": "Advanced Diploma in Computer Applications",
    "course_img_path": "course/images/course-1-adca-1728123456abcd.jpg",
    "course_description": "Complete computer applications program.",
    "course_modules": "Computer Basics, MS Office, Internet, Tally, DTP, Typing",
    "course_duration": "12 Months",
    "course_fee": "8000.00",
    "course_status": "active",
    "created_at": "2026-09-26 14:03:43",
    "updated_at": "2026-09-26 14:03:43"
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: If `{id}` is not a positive integer (`Invalid id parameter.`).
  - `404 Not Found`: If course `{id}` does not exist (`Course not found.`).

#### 3. Create Course (`POST /api/course`)
- **Method**: `POST`
- **Path**: `/api/course`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Content-Type**: `application/json` OR `multipart/form-data`
- **Request Body (JSON or multipart)**:
```json
{
  "course_code": "FLUTTER",
  "course_name": "Flutter & Dart Mobile App Development",
  "course_img_path": "course/images/course-flutter-custom.jpg",
  "course_description": "Cross-platform mobile applications for iOS & Android.",
  "course_modules": "Dart basics, Flutter widgets, State Management, Firebase, REST APIs",
  "course_duration": "6 Months",
  "course_fee": 32000.00,
  "course_status": "active"
}
```
- **File Upload (`multipart/form-data`)**: Send file in field `course_image`, `course_img`, `image`, or `file`. Files are validated (JPG, PNG, WebP, GIF, SVG, up to 10 MB) and saved to `api/course/images/`. The relative path `course/images/{filename}` is automatically stored in `course_img_path`.
- **Server-side Validation**:
  - `course_code`: Required, string, max 50 chars. Automatically converted to uppercase. Must be unique in `bi_courses`.
  - `course_name`: Required, string, max 150 chars.
  - `course_img_path`: Optional string or uploaded file (`course_image`).
  - `course_fee`: Required, numeric, >= 0.
  - `course_status`: Optional (defaults to `active`). Allowed: `active`, `inactive`.
  - `course_duration`: Optional string, max 100 chars.
  - `course_description`: Optional text.
  - `course_modules`: Optional text.
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Course created successfully.",
  "data": {
    "course_id": 6,
    "course_code": "FLUTTER",
    "course_name": "Flutter & Dart Mobile App Development",
    "course_img_path": "course/images/course-6-flutter-1728123456abcd.jpg",
    "course_description": "Cross-platform mobile applications for iOS & Android.",
    "course_modules": "Dart basics, Flutter widgets, State Management, Firebase, REST APIs",
    "course_duration": "6 Months",
    "course_fee": "32000.00",
    "course_status": "active",
    "created_at": "2026-10-09 20:25:00",
    "updated_at": "2026-10-09 20:25:00"
  }
}
```

#### 4. Upload Course Image (`POST /api/course/{id}/image`)
- **Method**: `POST`
- **Path**: `/api/course/1/image`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `course_image` (file: JPG, PNG, WebP, GIF, SVG up to 10 MB)
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Course image updated successfully.",
  "data": {
    "course_id": 1,
    "course_code": "ADCA",
    "course_name": "Advanced Diploma in Computer Applications",
    "course_img_path": "course/images/course-1-adca-1728123456abcd.png",
    "course_status": "active"
  }
}
```

#### 5. Remove Course Image (`DELETE /api/course/{id}/image`)
- **Method**: `DELETE`
- **Path**: `/api/course/1/image`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Course image removed successfully.",
  "data": {
    "course_id": 1,
    "course_code": "ADCA",
    "course_name": "Advanced Diploma in Computer Applications",
    "course_img_path": null,
    "course_status": "active"
  }
}
```
- **Error Responses**:
  - `409 Conflict`: If `course_code` is already registered (`Course code already exists.`).
  - `422 Unprocessable Entity`: If validation fails (`Validation failed`).

#### 4. Full Update (`PUT /api/course/{id}`)
- **Method**: `PUT`
- **Path**: `/api/course/6`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Requirement**: Full entity replacement. All mandatory fields (`course_code`, `course_name`, `course_fee`, `course_status`) must be provided.
- **Request Body (JSON)**:
```json
{
  "course_code": "FLUTTER-PRO",
  "course_name": "Advanced Flutter & Dart Masterclass",
  "course_description": "Enterprise mobile architecture with Bloc and Clean Architecture.",
  "course_modules": "Dart Advanced, Bloc, Clean Architecture, CI/CD, App Store Deployment",
  "course_duration": "8 Months",
  "course_fee": 38000.00,
  "course_status": "active"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Course updated successfully.",
  "data": {
    "course_id": 6,
    "course_code": "FLUTTER-PRO",
    "course_name": "Advanced Flutter & Dart Masterclass",
    "course_description": "Enterprise mobile architecture with Bloc and Clean Architecture.",
    "course_modules": "Dart Advanced, Bloc, Clean Architecture, CI/CD, App Store Deployment",
    "course_duration": "8 Months",
    "course_fee": "38000.00",
    "course_status": "active",
    "created_at": "2026-10-09 20:25:00",
    "updated_at": "2026-10-09 20:28:00"
  }
}
```

#### 5. Partial Update (`PATCH /api/course/{id}`)
- **Method**: `PATCH`
- **Path**: `/api/course/6`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Requirement**: Only updates the provided fields. Unspecified fields remain completely unchanged.
- **Request Body (JSON)**:
```json
{
  "course_fee": 35000.00,
  "course_status": "inactive"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Course updated successfully.",
  "data": {
    "course_id": 6,
    "course_code": "FLUTTER-PRO",
    "course_name": "Advanced Flutter & Dart Masterclass",
    "course_description": "Enterprise mobile architecture with Bloc and Clean Architecture.",
    "course_modules": "Dart Advanced, Bloc, Clean Architecture, CI/CD, App Store Deployment",
    "course_duration": "8 Months",
    "course_fee": "35000.00",
    "course_status": "inactive",
    "created_at": "2026-10-09 20:25:00",
    "updated_at": "2026-10-09 20:30:00"
  }
}
```

#### 6. Delete Course (`DELETE /api/course/{id}`)
- **Method**: `DELETE`
- **Path**: `/api/course/6`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Safe Relational Integrity Handling**:
  - The API proactively checks if the course is referenced by student enrollments in `bi_st_course` or online coupons in `bi_coupons_online`.
  - If linked enrollments or coupons exist, the deletion is safely blocked with `409 Conflict`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Course deleted successfully.",
  "data": null
}
```
- **Constraint Conflict Response (409 Conflict)**:
```json
{
  "success": false,
  "message": "Cannot delete course: 5 student enrollment(s) reference this course in bi_st_course.",
  "errors": {
    "course_id": "Course has linked student enrollments."
  }
}
```

---

### 9.7 Course Enrollment (`/api/enrollment`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/enrollment` | `POST` | Student / Admin | Enroll in a course (auto-creates `bi_student` on first enrollment) |
| `/api/enrollment` | `GET` | Student (own) / Admin | List enrollments with fees, dues, and batch info |
| `/api/enrollment/{id}` | `GET` | Student (own) / Admin | View a specific enrollment record |
| `/api/enrollment/{id}` | `PATCH`, `PUT` | **Admin only** | Update `stc_initial_payment`, `stc_discount`, and/or `stc_batch_id`. `stc_dues` atomically recalculated. |
| `/api/enrollment/{id}` | `DELETE` | **Admin only** | Cancel and delete an enrollment record from `bi_st_course` |

#### Enroll in a Course (`POST /api/enrollment`)
- **Method**: `POST`
- **Path**: `/api/enrollment`
- **Headers**: `X-User-Id: 12`, `X-User-Role: student`
- **Request Body (JSON)**:
```json
{
  "course_id": 3,
  "centre_id": 1,
  "batch_id": 2,
  "discount": 500,
  "initial_payment": 3000,
  "mode": "upi",
  "payref": "UPI12345",
  "remark": "Admission payment"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Enrollment successful.",
  "data": {
    "stc_id": 7,
    "student_id": 5,
    "registration_number": "BISR0005",
    "course_id": 3,
    "batch_id": 2,
    "total_fee": 8000,
    "discount": 500,
    "initial_payment": 3000,
    "dues": 4500
  }
}
```

#### Update Enrollment — Initial Payment / Discount / Batch (`PATCH /api/enrollment/{id}`)

> **Admin only.** Atomically updates `stc_initial_payment`, `stc_discount`, and/or `stc_batch_id` in `bi_st_course`.  
> `stc_dues` is **automatically recalculated** inside a locked transaction:
> ```
> remaining_dues = stc_total_fee − stc_discount − SUM(bi_fee_transactions.tr_amount)
> ```

- **Method**: `PATCH` (or `PUT`)
- **Request Body (JSON)** — send any or all:
```json
{
  "initial_payment": 5000,
  "discount": 1000,
  "batch_id": 3
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Enrollment updated successfully.",
  "data": {
    "stc_id": 7,
    "stc_dues": "1500.00"
  }
}
```

---

### 9.8 Fee Payments & Installments (`/api/fee`)

Unified fee payment and transaction ledger supporting **both offline center enrollments** (`bi_st_course`) and **online LMS course purchases** (`bi_st_course_online`). All financial ledger records are stored in `bi_fee_transactions` with strict concurrency protection, duplicate callback idempotency, and automatic dues reconciliation.

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/fee` | `POST` | Student / Admin | Record payment installment (atomic dues decrement on `bi_st_course` or `bi_st_course_online`) |
| `/api/fee` | `GET` | Student (own) / Admin | List fee payment receipts and financial balance summaries (supports `?course_format=offline\|online`) |
| `/api/fee/{id}` | `GET` | Student (own) / Admin | Get specific payment receipt with full student & course details |
| `/api/fee/{id}` | `PUT`, `PATCH` | Admin | Update transaction metadata (`payref`, `remark`, `mode`) without mutating financial amounts |

#### Database Schema (`bi_fee_transactions`)

The `bi_fee_transactions` table acts as the unified ledger for all course fees across offline study centers and online LMS portals:

| Column | Type | Nullable | Description |
| :--- | :--- | :--- | :--- |
| `tr_id` | `int(10) unsigned` | `NO` | Primary Key, Auto Increment |
| `tr_stc_id` | `int(10) unsigned` | `YES` | Offline enrollment ID (`bi_st_course.stc_id`) or enrollment reference |
| `tr_stco_id` | `int(10) unsigned` | `YES` | Online enrollment ID (`bi_st_course_online.stco_id`) |
| `tr_course_type` | `enum('offline','online')` | `NO` | Identifies course format (Default: `'offline'`) |
| `tr_amount` | `decimal(10,2)` | `NO` | Transaction amount paid |
| `tr_mode` | `enum(...)` | `NO` | Payment method: `'cash'`, `'upi'`, `'card'`, `'bank_transfer'`, `'razorpay'` |
| `tr_payref` | `varchar(255)` | `YES` | Payment reference token / Razorpay Payment ID / Bank UTR |
| `tr_remark` | `text` | `YES` | Audit remark / receipt narration |
| `tr_date` | `datetime` | `NO` | Payment timestamp (Default: `CURRENT_TIMESTAMP`) |
| `created_at` / `updated_at` | `timestamp` | `NO` | Timestamps |

> **Referential Integrity**: Unlike early single-purpose tables, `bi_fee_transactions` avoids hard single-table foreign keys, allowing `tr_course_type` to cleanly partition between offline enrollments (`bi_st_course`) and online LMS enrollments (`bi_st_course_online`) with **zero cross-table ID collisions**.

---

#### 1. Record Fee Installment (`POST /api/fee`)

- **Method**: `POST`
- **Path**: `/api/fee`
- **Access**: Student (can pay only for own enrollments) or Admin (can record for any enrollment)
- **Request Body (JSON)**:
```json
{
  "stc_id": 2,
  "amount": 2500.00,
  "mode": "razorpay",
  "payref": "pay_TkDM49etqfD7wY",
  "remark": "Second term installment",
  "is_online": false
}
```
> **Flexible Identifiers**: The API accepts `stc_id`, `stco_id`, or `enrollment_id`. If `is_online` is omitted, the model automatically detects whether the ID belongs to an offline or online course enrollment.

- **Atomic Lifecycle**:
  1. Acquires a pessimistic row lock (`FOR UPDATE`) on the target enrollment row.
  2. Reads authoritative dues (`stc_dues` or `stco_dues`).
  3. Verifies `amount > 0` and `amount <= dues` (negative dues are rejected).
  4. Checks `tr_payref` for idempotency (guards against duplicate webhooks or network retries).
  5. Inserts into `bi_fee_transactions` with appropriate `tr_course_type`.
  6. Atomically decrements remaining dues: `new_dues = max(0, dues - amount)`.
  7. If online enrollment dues reach zero, automatically updates `stco_payment_status = 'paid'`.
  8. Commits database transaction.

- **Success Response (201 Created)**:
```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "tr_id": 49,
    "stc_id": 2,
    "stco_id": null,
    "enrollment_id": 2,
    "course_format": "offline",
    "is_online": false,
    "student_id": 5,
    "amount_paid": 2500.0,
    "mode": "razorpay",
    "payref": "pay_TkDM49etqfD7wY",
    "remark": "Second term installment",
    "total_fee": 8000.0,
    "discount": 500.0,
    "initial_payment": 3000.0,
    "previous_dues": 4500.0,
    "remaining_dues": 2000.0
  }
}
```

- **Idempotent Duplicate Callback (200 OK)**:
When the same `payref` is submitted (e.g., Razorpay webhook + browser redirect race condition), the endpoint safely returns HTTP 200 without throwing an error or double-charging dues:
```json
{
  "success": true,
  "message": "Payment already recorded successfully.",
  "data": {
    "tr_id": 49,
    "transaction_id": 49,
    "stc_id": 2,
    "enrollment_id": 2,
    "amount_paid": 2500.0,
    "mode": "razorpay",
    "payref": "pay_TkDM49etqfD7wY",
    "remark": "Second term installment",
    "remaining_dues": 2000.0,
    "course_format": "offline",
    "is_online": false,
    "duplicate": true
  }
}
```

---

#### 2. List Fee Transactions (`GET /api/fee`)

- **Method**: `GET`
- **Path**: `/api/fee`
- **Access**: Authenticated Student (scoped to own records) or Admin (can view all or filter)
- **Query Parameters (Optional)**:
  - `page`: Page number (Default: `1`)
  - `limit`: Records per page (Default: `50`, Max: `100`)
  - `stc_id` / `stco_id` / `enrollment_id`: Filter by specific enrollment ID
  - `student_id`: Filter by student ID (Admin only)
  - `course_format`: Filter by `'offline'` or `'online'`
  - `date_from`: Filter transactions on or after `YYYY-MM-DD`
  - `date_to`: Filter transactions on or before `YYYY-MM-DD`

- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "transactions": [
      {
        "transaction_id": 50,
        "enrollment_id": 2,
        "stc_id": 2,
        "stco_id": 2,
        "student_id": 30,
        "registration_no": "BISR0009",
        "student_name": "Ajit Kumar",
        "course_name": "Advanced Diploma in Computer Applications",
        "amount": 1899.0,
        "mode": "razorpay",
        "payment_reference": "pay_TkDM49etqfD7wY",
        "remark": "Online Course Enrollment: Advanced Diploma in Computer Applications (₹100 discount applied)",
        "date": "2026-10-20 19:05:19",
        "course_format": "online",
        "is_online": true,
        "summary": {
          "total_fee": 8000.0,
          "discount": 100.0,
          "initial_payment": 1899.0,
          "total_paid": 1899.0,
          "dues": 6001.0,
          "stc_total_fee": 8000.0,
          "stc_discount": 100.0,
          "stc_initial_payment": 1899.0,
          "stc_dues": 6001.0
        },
        "tr_id": 50,
        "tr_stc_id": 2,
        "tr_stco_id": 2,
        "tr_course_type": "online",
        "tr_amount": 1899.0,
        "tr_mode": "razorpay",
        "tr_payref": "pay_TkDM49etqfD7wY",
        "tr_remark": "Online Course Enrollment: Advanced Diploma in Computer Applications (₹100 discount applied)",
        "tr_date": "2026-10-20 19:05:19"
      }
    ],
    "page": 1,
    "limit": 50,
    "count": 1
  }
}
```

---

#### 3. Get Single Transaction Receipt (`GET /api/fee/{id}`)

- **Method**: `GET`
- **Path**: `/api/fee/50`
- **Access**: Student (own record) or Admin
- **Response (200 OK)**: Returns the formatted transaction record with full student, enrollment, and balance summary.

---

#### 4. Update Transaction Metadata (`PUT` / `PATCH /api/fee/{id}`)

- **Method**: `PUT` or `PATCH`
- **Path**: `/api/fee/50`
- **Access**: Admin only
- **Request Body (JSON)**:
```json
{
  "mode": "bank_transfer",
  "payref": "NEFT12345678",
  "remark": "Updated bank UTR reference verified"
}
```
> **Audit Integrity**: Financial amounts (`tr_amount`) cannot be altered via this endpoint. Financial dues modifications must be done via enrollment adjustment workflows.

---

### 9.9 Attendance Tracking (`/api/attendance`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/attendance/in` | `POST` | Student / Admin | Check-in (`timein` logged for today) |
| `/api/attendance/out` | `POST` | Student / Admin | Check-out (`timeout` logged for today) |
| `/api/attendance/student/{regno}` | `GET` | Student / Admin | Get attendance history for registration number |
| `/api/attendance` | `GET` | Admin | List attendance records with date and centre filters |

---

### 9.10 Franchisee Centres (`/api/franchisee`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/franchisee` | `GET` | Public | List study centres |
| `/api/franchisee/{id}` | `GET` | Public | Get single study centre details |
| `/api/franchisee` | `POST` | Admin | Register new franchisee centre |
| `/api/franchisee/{id}` | `PUT`, `PATCH` | Admin | Update franchisee centre info |

---

### 9.11 Online Courses & Syllabus (`/api/onlinecoures`)

Comprehensive REST API for online courses and nested topic syllabus records.

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/onlinecoures` | `GET` | Public | List online courses (supports `?status=active\|inactive` and `?type=basic\|normal`) |
| `/api/onlinecoures` | `POST` | Admin | Create a new online course (supports `course_image` upload or `course_img_path`) |
| `/api/onlinecoures/{id}` | `GET` | Public | Get single online course with nested `syllabus` array |
| `/api/onlinecoures/{id}` | `PUT` | Admin | Full update of online course (supports `course_image` upload) |
| `/api/onlinecoures/{id}` | `PATCH` | Admin | Partial update of online course (preserves unspecified fields) |
| `/api/onlinecoures/{id}` | `DELETE` | Admin | Delete online course (cascades to syllabus & unlinks image) |
| `/api/onlinecoures/{id}/image` | `POST` | Admin | Dedicated online course image upload endpoint (`course_image` multipart file) |
| `/api/onlinecoures/{id}/image` | `DELETE` | Admin | Remove online course image (unlinks physical file & clears DB column) |
| `/api/onlinecoures/{id}/syllabus` | `GET` | Public | List all syllabus records for course (ordered by `topic_order ASC`) |
| `/api/onlinecoures/{id}/syllabus` | `POST` | Admin | Create syllabus item for course |
| `/api/onlinecoures/{id}/syllabus/{syllabus_id}` | `GET` | Public | Get single syllabus item (verifies course ownership) |
| `/api/onlinecoures/{id}/syllabus/{syllabus_id}` | `PUT` | Admin | Full update of syllabus item |
| `/api/onlinecoures/{id}/syllabus/{syllabus_id}` | `PATCH` | Admin | Partial update of syllabus item |
| `/api/onlinecoures/{id}/syllabus/{syllabus_id}` | `DELETE` | Admin | Delete syllabus item |

#### List Online Courses (`GET /api/onlinecoures`)
- **Query Params (Optional)**: `?status=active` (default for non-admin), `?type=basic` or `?course_type=normal`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "course_id": 1,
      "course_code": "ADCA",
      "course_name": "Advanced Diploma in Computer Applications",
      "course_img_path": "onlinecoures/images/online-course-1-adca-1728123456abcd.png",
      "course_description": "Basic to advanced computer applications course.",
      "course_type": "basic",
      "course_validity": "Lifetime",
      "course_duration": "12 Months",
      "course_fee": "8000.00",
      "course_status": "active",
      "created_at": "2026-10-06 18:51:50",
      "updated_at": "2026-10-06 18:51:50"
    }
  ]
}
```

#### Get Course Details with Nested Syllabus (`GET /api/onlinecoures/{id}`)
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "course_id": 1,
    "course_code": "ADCA",
    "course_name": "Advanced Diploma in Computer Applications",
    "course_img_path": "onlinecoures/images/online-course-1-adca-1728123456abcd.png",
    "course_description": "Basic to advanced computer applications course.",
    "course_type": "basic",
    "course_validity": "Lifetime",
    "course_duration": "12 Months",
    "course_fee": "8000.00",
    "course_status": "active",
    "created_at": "2026-10-06 18:51:50",
    "updated_at": "2026-10-06 18:51:50",
    "syllabus": [
      {
        "syllabus_id": 1,
        "course_id": 1,
        "syllabus_title": "1. Introduction",
        "syllabus_topic": "Introduction to Computer",
        "syllabus_topic_url": "https://www.youtube.com/results?search_query=computer+introduction",
        "topic_order": 1,
        "syllabus_status": "active",
        "created_at": "2026-10-06 18:51:50",
        "updated_at": "2026-10-06 18:51:50"
      }
    ]
  }
}
```

#### Create Online Course (`POST /api/onlinecoures`)
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Content-Type**: `application/json` OR `multipart/form-data`
- **File Upload (`multipart/form-data`)**: Send file in field `course_image`, `course_img`, `image`, or `file`. Validated and saved directly to `api/onlinecoures/images/` and the relative path `onlinecoures/images/{filename}` is stored in `course_img_path`.
- **Request Body (JSON or multipart)**:
```json
{
  "course_code": "FULLSTACK",
  "course_name": "Full Stack Web Development Online",
  "course_img_path": "onlinecoures/images/online-course-custom.jpg",
  "course_description": "Comprehensive full stack JavaScript & PHP course.",
  "course_type": "normal",
  "course_validity": "2 Years",
  "course_duration": "10 Months",
  "course_fee": 15000.00,
  "course_status": "active"
}
```

#### Upload Online Course Image (`POST /api/onlinecoures/{id}/image`)
- **Method**: `POST`
- **Path**: `/api/onlinecoures/1/image`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Content-Type**: `multipart/form-data`
- **Form Field**: `course_image` (file: JPG, PNG, WebP, GIF, SVG up to 10 MB)
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Online course image updated successfully.",
  "data": {
    "course_id": 1,
    "course_code": "ADCA",
    "course_name": "Advanced Diploma in Computer Applications",
    "course_img_path": "onlinecoures/images/online-course-1-adca-1728123456abcd.png",
    "course_status": "active"
  }
}
```

#### Remove Online Course Image (`DELETE /api/onlinecoures/{id}/image`)
- **Method**: `DELETE`
- **Path**: `/api/onlinecoures/1/image`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Online course image removed successfully.",
  "data": {
    "course_id": 1,
    "course_code": "ADCA",
    "course_name": "Advanced Diploma in Computer Applications",
    "course_img_path": null,
    "course_status": "active"
  }
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Online course created successfully.",
  "data": {
    "course_id": 5,
    "course_code": "FULLSTACK",
    "course_name": "Full Stack Web Development Online",
    "course_description": "Comprehensive full stack JavaScript & PHP course.",
    "course_type": "normal",
    "course_validity": "2 Years",
    "course_duration": "10 Months",
    "course_fee": "15000.00",
    "course_status": "active",
    "created_at": "2026-10-06 19:20:00",
    "updated_at": "2026-10-06 19:20:00"
  }
}
```

#### Update Online Course (`PUT` / `PATCH /api/onlinecoures/{id}`)
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Request Body (JSON)**:
```json
{
  "course_name": "Full Stack Web Development Masterclass",
  "course_fee": 16500.00
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Online course updated successfully.",
  "data": {
    "course_id": 5,
    "course_code": "FULLSTACK",
    "course_name": "Full Stack Web Development Masterclass",
    "course_description": "Comprehensive full stack JavaScript & PHP course.",
    "course_type": "normal",
    "course_validity": "2 Years",
    "course_duration": "10 Months",
    "course_fee": "16500.00",
    "course_status": "active",
    "created_at": "2026-10-06 19:20:00",
    "updated_at": "2026-10-06 19:25:00"
  }
}
```

#### Delete Online Course (`DELETE /api/onlinecoures/{id}`)
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Online course deleted successfully.",
  "data": null
}
```

#### Add Syllabus Item (`POST /api/onlinecoures/{id}/syllabus`)
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Request Body (JSON)**:
```json
{
  "syllabus_title": "Module 1: React Fundamentals",
  "syllabus_topic": "Components, JSX, State & Props",
  "syllabus_topic_url": "https://www.youtube.com/watch?v=example",
  "topic_order": 1,
  "syllabus_status": "active"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Syllabus created successfully.",
  "data": {
    "syllabus_id": 40,
    "course_id": 5,
    "syllabus_title": "Module 1: React Fundamentals",
    "syllabus_topic": "Components, JSX, State & Props",
    "syllabus_topic_url": "https://www.youtube.com/watch?v=example",
    "topic_order": 1,
    "syllabus_status": "active",
    "created_at": "2026-10-06 19:22:00",
    "updated_at": "2026-10-06 19:22:00"
  }
}
```

#### Update Syllabus Item (`PUT` / `PATCH /api/onlinecoures/{id}/syllabus/{syllabus_id}`)
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Request Body (JSON)**:
```json
{
  "syllabus_topic": "Components, JSX, State, Props & Custom Hooks",
  "topic_order": 2
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Syllabus updated successfully.",
  "data": {
    "syllabus_id": 40,
    "course_id": 5,
    "syllabus_title": "Module 1: React Fundamentals",
    "syllabus_topic": "Components, JSX, State, Props & Custom Hooks",
    "syllabus_topic_url": "https://www.youtube.com/watch?v=example",
    "topic_order": 2,
    "syllabus_status": "active",
    "created_at": "2026-10-06 19:22:00",
    "updated_at": "2026-10-06 19:24:00"
  }
}
```

#### Delete Syllabus Item (`DELETE /api/onlinecoures/{id}/syllabus/{syllabus_id}`)
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Syllabus deleted successfully.",
  "data": null
}
```

---

### 9.12 Online Coupons (`/api/coupon-online`)

Full CRUD API for online coupons in database table `bi_coupons_online`. Supports user restrictions, course restrictions, mobile/email constraints, percentage vs fixed amount discounts, validity periods, expiry status, usage limits, and server-side discount calculations.

Available route prefixes: `/api/coupon-online`, `/api/online-coupon`.

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/coupon-online` | `GET` | Public / Admin | List coupons (supports `?status=active\|expired`, `?discount_type=percentage\|amount`, `?course_id=`, `?user_id=`, `?search=`) |
| `/api/coupon-online/{id}` | `GET` | Public / Admin | Get single coupon by ID |
| `/api/coupon-online` | `POST` | Admin | Create new online coupon with server-side validation |
| `/api/coupon-online/{id}` | `PUT` | Admin | Fully update an existing coupon (all core fields mandatory) |
| `/api/coupon-online/{id}` | `PATCH` | Admin | Partially update only the supplied fields |
| `/api/coupon-online/{id}` | `DELETE` | Admin | Delete coupon by ID (handles relational constraints safely) |
| `/api/coupon-online/validate` | `POST` | Public / Student | Validate coupon applicability & calculate server-side discount |
| `/api/coupon-online/calculate` | `POST` | Public / Student | Alias for coupon discount calculation |

#### Database Schema (`bi_coupons_online`)
- `coupon_id`: `bigint(20) unsigned` PRIMARY KEY AUTO_INCREMENT
- `coupon_code`: `varchar(50)` UNIQUE NOT NULL
- `coupon_for`: `enum('all','user_id')` NOT NULL DEFAULT `'all'`
- `coupon_for_user_id`: `int(10) unsigned` NULL (checked against `bi_users.user_id`)
- `coupon_discount_type`: `enum('percentage','amount')` NOT NULL
- `coupon_discount`: `decimal(10,2)` NOT NULL (> 0; <= 100 if percentage)
- `coupon_for_course`: `enum('all','specific')` NOT NULL DEFAULT `'all'`
- `coupon_for_course_id`: `int(10) unsigned` NULL (foreign key referencing `bi_courses.course_id`)
- `coupon_for_mobile`: `varchar(20)` NULL
- `coupon_for_email`: `varchar(191)` NULL
- `coupon_validity`: `datetime` NOT NULL
- `coupon_expired`: `tinyint(1)` NOT NULL DEFAULT `0`
- `coupon_limit`: `int(10) unsigned` NULL (usage limit)
- `created_at` / `updated_at`: timestamps

#### 1. List Online Coupons (`GET /api/coupon-online`)
- **Method**: `GET`
- **Path**: `/api/coupon-online`
- **Query Parameters (Optional)**:
  - `status`: `active` (not expired and validity >= NOW) or `expired`.
  - `discount_type` / `type`: `percentage` or `amount`.
  - `course_id`: Filter by course ID.
  - `user_id`: Filter by targeted user ID.
  - `search` / `q`: Substring match on coupon code, email, or mobile.
- **Access Rule**:
  - **Admin**: Can view all coupons including expired and inactive.
  - **Non-admin / Student**: Returns only currently active, non-expired coupons available for general use.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Coupons retrieved successfully.",
  "data": [
    {
      "coupon_id": 1,
      "coupon_code": "ONLINE5",
      "coupon_for": "all",
      "coupon_for_user_id": null,
      "coupon_discount_type": "percentage",
      "coupon_discount": "5.00",
      "coupon_for_course": "all",
      "coupon_for_course_id": null,
      "coupon_for_mobile": null,
      "coupon_for_email": null,
      "coupon_validity": "2026-11-08 17:13:00",
      "coupon_expired": 0,
      "coupon_limit": 100,
      "created_at": "2026-10-09 17:13:00",
      "updated_at": "2026-10-09 17:13:00",
      "target_course_code": null,
      "target_course_name": null,
      "target_user_name": null,
      "target_user_email": null
    }
  ]
}
```

#### 2. Get Single Coupon (`GET /api/coupon-online/{id}`)
- **Method**: `GET`
- **Path**: `/api/coupon-online/1`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Coupon retrieved successfully.",
  "data": {
    "coupon_id": 1,
    "coupon_code": "ONLINE5",
    "coupon_for": "all",
    "coupon_for_user_id": null,
    "coupon_discount_type": "percentage",
    "coupon_discount": "5.00",
    "coupon_for_course": "all",
    "coupon_for_course_id": null,
    "coupon_for_mobile": null,
    "coupon_for_email": null,
    "coupon_validity": "2026-11-08 17:13:00",
    "coupon_expired": 0,
    "coupon_limit": 100,
    "created_at": "2026-10-09 17:13:00",
    "updated_at": "2026-10-09 17:13:00"
  }
}
```

#### 3. Create Online Coupon (`POST /api/coupon-online`)
- **Method**: `POST`
- **Path**: `/api/coupon-online`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Request Body (JSON - Percentage Coupon)**:
```json
{
  "coupon_code": "FESTIVE25",
  "coupon_for": "all",
  "coupon_discount_type": "percentage",
  "coupon_discount": 25.00,
  "coupon_for_course": "all",
  "coupon_validity": "2026-12-31 23:59:59",
  "coupon_limit": 200
}
```
- **Request Body (JSON - User & Course Restricted Amount Coupon)**:
```json
{
  "coupon_code": "VIP1000",
  "coupon_for": "user_id",
  "coupon_for_user_id": 55,
  "coupon_discount_type": "amount",
  "coupon_discount": 1000.00,
  "coupon_for_course": "specific",
  "coupon_for_course_id": 1,
  "coupon_for_email": "student@example.com",
  "coupon_for_mobile": "9876543210",
  "coupon_validity": "2026-11-30 23:59:59",
  "coupon_limit": 1
}
```
- **Server-side Validation Rules**:
  - `coupon_code`: Required, string, max 50 chars, unique in `bi_coupons_online`.
  - `coupon_discount_type`: Required, enum: `'percentage'` or `'amount'`.
  - `coupon_discount`: Required, numeric.
    - If percentage: Must be `> 0` and `<= 100`.
    - If amount: Must be `> 0`.
  - `coupon_for`: Optional, default `'all'`, enum: `'all'` or `'user_id'`.
    - If `'user_id'`: `coupon_for_user_id` is required, must be integer, and must exist in `bi_users`.
    - If `'all'`: `coupon_for_user_id` is automatically set to `null`.
  - `coupon_for_course`: Optional, default `'all'`, enum: `'all'` or `'specific'`.
    - If `'specific'`: `coupon_for_course_id` is required, must be integer, and must exist in `bi_courses`.
    - If `'all'`: `coupon_for_course_id` is automatically set to `null`.
  - `coupon_validity`: Required, valid datetime string (normalized to `YYYY-MM-DD HH:MM:SS`).
  - `coupon_expired`: Optional boolean/integer (0 = active, 1 = expired).
  - `coupon_limit`: Optional positive integer or null (unlimited).
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Online coupon created successfully.",
  "data": {
    "coupon_id": 7,
    "coupon_code": "FESTIVE25",
    "coupon_for": "all",
    "coupon_for_user_id": null,
    "coupon_discount_type": "percentage",
    "coupon_discount": "25.00",
    "coupon_for_course": "all",
    "coupon_for_course_id": null,
    "coupon_for_mobile": null,
    "coupon_for_email": null,
    "coupon_validity": "2026-12-31 23:59:59",
    "coupon_expired": 0,
    "coupon_limit": 200,
    "created_at": "2026-10-09 20:30:00",
    "updated_at": "2026-10-09 20:30:00"
  }
}
```
- **Error Responses**:
  - `409 Conflict`: If `coupon_code` is already used (`Coupon code already exists.`).
  - `422 Unprocessable Entity`: If validation fails (`Validation failed`).

#### 4. Full Update (`PUT /api/coupon-online/{id}`)
- **Method**: `PUT`
- **Path**: `/api/coupon-online/7`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Requirement**: Full update. All core fields (`coupon_code`, `coupon_discount_type`, `coupon_discount`, `coupon_validity`) must be provided.
- **Request Body (JSON)**:
```json
{
  "coupon_code": "FESTIVE30",
  "coupon_for": "all",
  "coupon_discount_type": "percentage",
  "coupon_discount": 30.00,
  "coupon_for_course": "all",
  "coupon_validity": "2027-01-31 23:59:59",
  "coupon_expired": 0,
  "coupon_limit": 300
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Online coupon fully updated successfully.",
  "data": {
    "coupon_id": 7,
    "coupon_code": "FESTIVE30",
    "coupon_for": "all",
    "coupon_discount_type": "percentage",
    "coupon_discount": "30.00",
    "coupon_for_course": "all",
    "coupon_validity": "2027-01-31 23:59:59",
    "coupon_expired": 0,
    "coupon_limit": 300,
    "created_at": "2026-10-09 20:30:00",
    "updated_at": "2026-10-09 20:32:00"
  }
}
```

#### 5. Partial Update (`PATCH /api/coupon-online/{id}`)
- **Method**: `PATCH`
- **Path**: `/api/coupon-online/7`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Requirement**: Updates only supplied fields. Merges with existing record to ensure MySQL check constraints are never violated.
- **Request Body (JSON)**:
```json
{
  "coupon_discount": 35.00,
  "coupon_limit": 500
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Online coupon partially updated successfully.",
  "data": {
    "coupon_id": 7,
    "coupon_code": "FESTIVE30",
    "coupon_for": "all",
    "coupon_discount_type": "percentage",
    "coupon_discount": "35.00",
    "coupon_for_course": "all",
    "coupon_validity": "2027-01-31 23:59:59",
    "coupon_expired": 0,
    "coupon_limit": 500,
    "created_at": "2026-10-09 20:30:00",
    "updated_at": "2026-10-09 20:34:00"
  }
}
```

#### 6. Delete Online Coupon (`DELETE /api/coupon-online/{id}`)
- **Method**: `DELETE`
- **Path**: `/api/coupon-online/7`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Online coupon deleted successfully.",
  "data": null
}
```

#### 7. Server-Side Validate & Calculate Discount (`POST /api/coupon-online/validate`)
> **Crucial Invariant**: The backend NEVER trusts frontend-supplied discount calculations. This endpoint evaluates validity against database constraints and computes the discount purely on the server.

- **Method**: `POST`
- **Path**: `/api/coupon-online/validate` (also `/api/coupon-online/calculate`)
- **Request Body (JSON)**:
```json
{
  "coupon_code": "ONLINE5",
  "course_id": 1,
  "user_id": 55,
  "email": "student@example.com"
}
```
- **Server Execution**:
  1. Verifies coupon exists and is not marked expired (`coupon_expired == 0`).
  2. Verifies coupon validity timestamp (`coupon_validity >= NOW()`).
  3. Validates user restriction (if `coupon_for === 'user_id'`).
  4. Validates course restriction (if `coupon_for_course === 'specific'`).
  5. Validates email & mobile restrictions if defined.
  6. Fetches true `course_fee` directly from `bi_courses` database record.
  7. Calculates discount:
     - Percentage: `round((base_fee * rate) / 100, 2)`
     - Amount: `min(base_fee, fixed_amount)`
  8. Computes net payable: `max(0, base_fee - discount)`.
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Coupon is valid.",
  "data": {
    "coupon_id": 1,
    "coupon_code": "ONLINE5",
    "is_valid": true,
    "discount_type": "percentage",
    "discount_value": 5.0,
    "base_amount": 8000.0,
    "discount_amount": 400.0,
    "net_payable": 7600.0
  }
}
```
- **Error Responses**:
  - `404 Not Found`: If coupon code does not exist (`Invalid coupon code.`).
  - `400 Bad Request`: If coupon has expired or does not apply to the selected course.
  - `403 Forbidden`: If coupon is restricted to a different account or email.

---

### 9.13 Offline Coupons (`/api/coupon`)

Full CRUD API for offline course coupons in database table `bi_coupons`. Canonical endpoint for offline coupon management and validation.

Available route prefixes: `/api/coupon`.

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/coupon` | `GET` | Public / Admin | List offline coupons (supports `?status=active\|expired`, `?discount_type=percentage\|amount`, `?course_id=`, `?user_id=`, `?search=`) |
| `/api/coupon/{id}` | `GET` | Public / Admin | Get single offline coupon by ID |
| `/api/coupon` | `POST` | Admin | Create new offline coupon with server-side validation |
| `/api/coupon/{id}` | `PUT` | Admin | Fully update an existing offline coupon |
| `/api/coupon/{id}` | `PATCH` | Admin | Partially update supplied fields |
| `/api/coupon/{id}` | `DELETE` | Admin | Delete offline coupon by ID |
| `/api/coupon/validate` | `POST` | Public / Student | Validate offline coupon applicability & calculate server-side discount against `bi_courses` |
| `/api/coupon/calculate` | `POST` | Public / Student | Alias for offline coupon discount calculation |

#### Database Schema (`bi_coupons`)
- `coupon_id`: `bigint(20) unsigned` PRIMARY KEY AUTO_INCREMENT
- `coupon_code`: `varchar(50)` UNIQUE NOT NULL
- `coupon_for`: `enum('all','user_id')` NOT NULL DEFAULT `'all'`
- `coupon_for_user_id`: `bigint(20) unsigned` NULL (checked against `bi_users.user_id`)
- `coupon_discount_type`: `enum('percentage','amount')` NOT NULL
- `coupon_discount`: `decimal(10,2)` NOT NULL (> 0; <= 100 if percentage)
- `coupon_for_course`: `enum('all','specific')` NOT NULL DEFAULT `'all'`
- `coupon_for_course_id`: `bigint(20) unsigned` NULL (checked against `bi_courses.course_id`)
- `coupon_for_mobile`: `varchar(20)` NULL
- `coupon_for_email`: `varchar(191)` NULL
- `coupon_validity`: `datetime` NOT NULL
- `coupon_expired`: `tinyint(1)` NOT NULL DEFAULT `0`
- `coupon_limit`: `int(10) unsigned` NULL (usage limit)
- `created_at` / `updated_at`: timestamps

---

## 10. Frontend Integration Guide (Next.js 14 / TypeScript)

### 10.1 Uploading a File with `FormData`

The frontend sends files via `FormData` — the PHP API handles storage, validation, and path generation.

```typescript
// lib/upload.ts

export const API_BASE = process.env.NEXT_PUBLIC_API_URL
  || 'https://api.brainzima.com/student/api';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string>;
}

/**
 * Upload a profile image and (optionally) update other fields via PATCH.
 * The PHP API receives the file, validates it, stores it in:
 *   uploads/images/users/user-{id}-profile-{unique}.{ext}
 * and returns the stored path.
 */
export async function updateUserProfile(
  userId: number,
  userRole: string,
  fields: { name?: string; mobile?: string },
  imageFile?: File
): Promise<ApiResponse> {
  const formData = new FormData();

  if (fields.name)   formData.append('name', fields.name);
  if (fields.mobile) formData.append('mobile', fields.mobile);
  if (imageFile)     formData.append('user_image', imageFile);

  // Use POST with _method=PATCH for multipart PATCH support
  formData.append('_method', 'PATCH');

  const res = await fetch(`${API_BASE}/api/user/profile`, {
    method: 'POST',
    headers: {
      'X-User-Id':   String(userId),
      'X-User-Role': userRole,
    },
    body: formData,
    // ⚠️ Do NOT set Content-Type manually — browser sets it with boundary
  });

  return await res.json();
}
```

### 10.2 Uploading Student Documents

```typescript
export async function uploadStudentDocuments(
  studentId: number,
  userId: number,
  files: {
    docs_st_image?: File;
    docs_st_aadhaar_front?: File;
    docs_st_aadhaar_back?: File;
    docs_st_qualification?: File;
  }
): Promise<ApiResponse> {
  const formData = new FormData();

  if (files.docs_st_image)         formData.append('docs_st_image', files.docs_st_image);
  if (files.docs_st_aadhaar_front) formData.append('docs_st_aadhaar_front', files.docs_st_aadhaar_front);
  if (files.docs_st_aadhaar_back)  formData.append('docs_st_aadhaar_back', files.docs_st_aadhaar_back);
  if (files.docs_st_qualification) formData.append('docs_st_qualification', files.docs_st_qualification);

  const res = await fetch(`${API_BASE}/api/document/student/${studentId}`, {
    method: 'POST',
    headers: {
      'X-User-Id':   String(userId),
      'X-User-Role': 'student',
    },
    body: formData,
  });

  return await res.json();
}
```

### 10.3 Uploading a Notes PDF (Admin)

```typescript
export async function createNote(
  adminId: number,
  fields: { notes_title: string; notes_course_id: number; notes_description?: string },
  pdfFile: File
): Promise<ApiResponse> {
  const formData = new FormData();

  formData.append('notes_title',       fields.notes_title);
  formData.append('notes_course_id',   String(fields.notes_course_id));
  if (fields.notes_description) {
    formData.append('notes_description', fields.notes_description);
  }
  formData.append('notes_pdf', pdfFile);

  const res = await fetch(`${API_BASE}/api/notes`, {
    method: 'POST',
    headers: {
      'X-User-Id':   String(adminId),
      'X-User-Role': 'admin',
    },
    body: formData,
  });

  return await res.json();
}
```

### 10.4 Rendering Stored Image Paths

The API returns a relative path string. Prefix it with your API base URL to get the full image URL:

```typescript
const API_BASE = 'https://api.brainzima.com/student/api';

function getImageUrl(path: string | null): string {
  if (!path) return '/default-avatar.png';
  // path is already relative: "uploads/images/users/user-12-profile-xxx.jpg"
  return `${API_BASE}/${path}`;
}

// Usage:
<img src={getImageUrl(user.user_image)} alt="Profile" />
// Renders: https://api.brainzima.com/student/api/uploads/images/users/user-12-profile-xxx.jpg
```

### 10.5 Method Overriding for multipart/form-data PATCH

Browsers cannot send native `PATCH` with `multipart/form-data`. Use `POST` with `_method=PATCH`:

```typescript
formData.append('_method', 'PATCH');

const res = await fetch(`${API_BASE}/api/user/profile`, {
  method: 'POST',   // browser-compatible
  headers: {
    'X-User-Id':   String(userId),
    'X-User-Role': userRole,
    // Do NOT set Content-Type — browser auto-sets it with multipart boundary
  },
  body: formData,
});
```

---

## 11. Database Schema: File Path Columns

The following columns store **only the relative path string** — never binary data or absolute paths.

| Table | Column | Example Stored Value |
| :--- | :--- | :--- |
| `bi_users` | `user_image` | `uploads/images/users/user-12-profile-xxx.jpg` |
| `bi_student` | `user_image` | `uploads/images/students/student-5-profile-xxx.webp` |
| `bi_st_docs` | `docs_st_image` | `uploads/images/students/student-5-profile-xxx.webp` |
| `bi_st_docs` | `docs_st_aadhaar_front` | `uploads/images/adharfront/student-5-aadhaar-front-xxx.webp` |
| `bi_st_docs` | `docs_st_aadhaar_back` | `uploads/images/adharback/student-5-aadhaar-back-xxx.webp` |
| `bi_st_docs` | `docs_st_qualification` | `uploads/images/qualification/student-5-qualification-xxx.pdf` |
| `bi_notes` | `notes_pdf` | `uploads/images/notes/course-3-react-fundamentals-xxx.pdf` |

---

## 12. Database Patch & Migration

To apply the `user_image` upgrades and indexes to an existing database, run the bundled migration script:

```bash
# Path: api/config/patch.sql
mysql -u root -p mjkfwenv_brainzima_student < api/config/patch.sql
```

The script automatically:
1. Adds `user_image varchar(500) DEFAULT NULL` to `bi_users` if missing.
2. Adds `docs_st_image varchar(500) DEFAULT NULL` to `bi_st_docs` if missing.
3. Synchronizes existing student photos to user records and vice versa.

---

## 13. Security Notes

| Threat | Mitigation |
| :--- | :--- |
| PHP file execution via upload | `uploads/.htaccess` denies all `.php`, `.phtml`, `.phar`, `.sh`, `.js`, `.html`, etc. |
| MIME type spoofing | `finfo` validates real file content — not client-provided Content-Type |
| Extension mismatch | MIME ↔ extension cross-validation — rejects `image.php` renamed to `image.jpg` |
| Path traversal on delete | `realpath()` enforced; path must stay inside `API_ROOT/uploads/images/` |
| Client-controlled directory | Directory always resolved from backend whitelist — never from request input |
| Orphaned uploads on DB fail | New file deleted if DB update fails; old file preserved |
| Executable upload | Blocked extensions list covers `php phtml phar exe sh bat cmd ps1 cgi jsp asp` |

---

## 14. Verification & Quality Checklist

- [x] **Flat Upload Structure**: All files stored directly in `uploads/images/{type}/` — no entity subdirectories.
- [x] **FileUploadHelper**: Single reusable OOP upload service — no duplicated upload code in controllers.
- [x] **MIME Validation**: `finfo`-based real content check on every upload.
- [x] **Extension Whitelist**: Images: `jpg jpeg png webp`. Documents: `pdf jpg jpeg png webp`.
- [x] **Blocked Extensions**: `php phtml phar exe sh js html htm` and others rejected.
- [x] **Configurable Size Limits**: Profile images 5 MB, documents 10 MB, notes PDFs 20 MB.
- [x] **Safe Filename Generation**: `entity-id-type-timestamp-rand.ext` — never uses original filename.
- [x] **Safe File Replacement**: Upload new → update DB → delete old. Orphan prevention on DB failure.
- [x] **Safe File Deletion**: Path traversal protection, `realpath()` boundary check, `uploads/images/` root enforced.
- [x] **DB Stores Path String Only**: Never BLOB, base64, or absolute filesystem path.
- [x] **Multipart/form-data Support**: All upload endpoints accept `$_FILES` alongside `$_POST`.
- [x] **Backward Compatible**: String path still accepted when no file is uploaded.
- [x] **Full PATCH Support**: Registered and operational on user, student, course, onlinecoures, fee, notes, document, and franchisee modules.
- [x] **Online Courses & Syllabus System**: Complete CRUD for `bi_online_courese` and nested `bi_online_coures_syllabus` under `/api/onlinecoures`.
- [x] **Foreign-Key Cascades**: Safe cascading deletion from courses to syllabus records.
- [x] **Method Overriding**: Supports `X-HTTP-Method-Override` and `_method` parameter (including for multipart PATCH).
- [x] **Upload Security Header**: `uploads/.htaccess` blocks script execution inside upload directories.
- [x] **Immutable Financial Trail**: Course fees, dues, and transaction histories protected with pessimistic locking.
- [x] **Pure OOP PHP & MySQLi**: Zero framework dependencies, zero PDO, prepared statements everywhere.
- [x] **Online Enrollment Separation**: `bi_st_course_online` exclusively for online enrollments — zero collision with `bi_st_course`.
- [x] **Lesson-Level Access Gate**: Free introductory lessons (`topic_order = 1`) accessible publicly; paid lessons locked to active enrollments.
- [x] **Triple Dashboard Views**: Automatically exposes `enrolled_courses`, `offline_courses`, and `online_courses` to student dashboard.

---

## 15. Online Course & Enrollment API (`bi_st_course_online`)

### 15.1 Dual-Enrollment Architecture

To prevent ID collisions and maintain clean separation of concerns, the system maintains two completely segregated enrollment ledgers:

| Course Format | Catalog Table | Enrollment Ledger Table | Relationship | Fee Transaction Ledger (`bi_fee_transactions`) |
| :--- | :--- | :--- | :--- | :--- |
| **Offline** | `bi_courses` | `bi_st_course` | `stc_st_id` → `bi_student.st_id`, `stc_course_id` → `bi_courses.course_id` | `tr_stc_id` = `stc_id`, `tr_stco_id` = `NULL`, `tr_course_type` = `'offline'` |
| **Online** | `bi_online_courese` | `bi_st_course_online` | `stco_st_id` → `bi_student.st_id`, `stco_course_id` → `bi_online_courese.course_id` | `tr_stc_id` = `stco_id`, `tr_stco_id` = `stco_id`, `tr_course_type` = `'online'` |

> **Crucial Data Rule**: `bi_st_course` is strictly for offline center courses. `bi_st_course_online` is strictly for online LMS courses. An online course enrollment is **never** inserted into `bi_st_course`. Both formats record transactions into `bi_fee_transactions` tagged by `tr_course_type` without foreign key constraint conflicts or ID collisions.

### 15.2 Online Course & Enrollment Endpoints Summary

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/onlinecoures` | Public | List active online courses (or all for admin). |
| `POST` | `/api/onlinecoures` | Admin | Create a new online course. |
| `GET` | `/api/onlinecoures/{id}` | Public/Auth | Get course details + syllabus. Video URLs masked for locked lessons. |
| `PUT / PATCH` | `/api/onlinecoures/{id}` | Admin | Full or partial update of an online course. |
| `DELETE` | `/api/onlinecoures/{id}` | Admin | Delete course (cascades to syllabus and online enrollments). |
| `GET` | `/api/onlinecoures/{id}/syllabus` | Public/Auth | List course syllabus ordered by `topic_order ASC`. Paid URLs masked if not enrolled. |
| `POST` | `/api/onlinecoures/{id}/syllabus` | Admin | Create syllabus lesson for course. |
| `GET` | `/api/onlinecoures/{id}/syllabus/{syllabus_id}` | Public/Auth | Get single lesson. `topic_order = 1` is free. `topic_order > 1` requires active enrollment. |
| `PUT / PATCH` | `/api/onlinecoures/{id}/syllabus/{syllabus_id}` | Admin | Update syllabus lesson. |
| `DELETE` | `/api/onlinecoures/{id}/syllabus/{syllabus_id}` | Admin | Delete syllabus lesson. |
| `GET` | `/api/onlinecoures/{id}/access` | Public/Auth | Check if current user has course access (`enrolled`, `payment_status`, `course_access`). |
| `GET` | `/api/onlinecoures/{id}/enroll` | Student/Admin | Get current student's enrollment record for this course. |
| `POST` | `/api/onlinecoures/{id}/enroll` | Auth | Enroll student in online course after backend payment verification + record in `bi_fee_transactions`. |
| `POST` | `/api/onlinecoures/{id}/order` | Auth | Create a Razorpay order for purchasing this online course. |
| `GET` | `/api/onlinecoures/enrollment` | Auth | List online enrollments (Student: own; Admin: all). Same format as `/api/enrollment`. |
| `GET` | `/api/onlinecoures/enrollment/{id}` | Auth | Get single online enrollment by `stco_id`. |
| `PUT / PATCH` | `/api/onlinecoures/enrollment/{id}` | Admin | Update online enrollment fields. |
| `DELETE` | `/api/onlinecoures/enrollment/{id}` | Admin | Delete online enrollment. |
| `GET / POST` | `/api/onlinecoures/sync-transactions` | Public / Admin | Self-healing sync ensuring all active/paid online course enrollments are recorded in `bi_fee_transactions`. |

### 15.3 Automated Student Conversion & Enrollment Flow

When a user completes payment for an online course via `POST /api/onlinecoures/{id}/enroll`:

```
User (Logged In)
       │
       ▼
HMAC-SHA256 Signature Verification (RazorpayHelper)
       │
       ▼
Check bi_student by st_user_id (Pessimistic Row Lock)
   ├── Student Exists      ──▶ Reuse existing student (st_id)
   └── Student Not Found   ──▶ Create bi_student:
                                 - st_referredby = 'online'
                                 - RegNoHelper::generate() (BISR...)
                                 - Upgrade bi_users.user_role to 'student'
       │
       ▼
Duplicate Protection Check (stco_st_id + stco_course_id)
   ├── Already Enrolled    ──▶ Return 409 Conflict with existing enrollment info
   └── Not Enrolled        ──▶ 1. INSERT into bi_st_course_online:
                                 - stco_payment_status = 'paid'
                                 - stco_dues = 0.00
                                 - stco_enrollment_status = 'active'
                               2. INSERT into bi_fee_transactions:
                                 - tr_stc_id = stco_id
                                 - tr_stco_id = stco_id
                                 - tr_course_type = 'online'
                                 - tr_amount = initial_payment
                                 - tr_mode = 'razorpay'
                                 - tr_payref = razorpay_payment_id
       │
       ▼
Send Branded Confirmation Email (EmailHelper::sendOnlineCourseEnrollmentEmail)
       │
       ▼
Return 201 Created with full enrollment + fee_transaction_id (Redirect user to /student/dashboard)
```

### 15.4 Student Dashboard Course Views

The student profile endpoints (`GET /api/student/me` and `GET /api/student/{id}`) automatically provide three distinct course views:

```json
{
  "success": true,
  "data": {
    "st_id": 10,
    "st_name": "Ajit Kumar",
    "st_regno": "BISR0010",
    "offline_courses": [
      {
        "stc_id": 1,
        "course_id": 1,
        "course_name": "ADCA",
        "course_format": "offline"
      }
    ],
    "online_courses": [
      {
        "stco_id": 1,
        "course_id": 2,
        "course_name": "ADCA+",
        "payment_status": "paid",
        "enrollment_status": "active",
        "course_format": "online"
      }
    ],
    "enrolled_courses": [
      { "course_name": "ADCA", "course_format": "offline" },
      { "course_name": "ADCA+", "course_format": "online" }
    ],
    "courses": [ ... ]
  }
}
```

### 15.5 Lesson Access Gate Rules

1. **Free Introduction**: Any syllabus topic with `topic_order = 1` is public and accessible without authentication or enrollment.
2. **Paid Lessons**: Any syllabus topic with `topic_order > 1` requires:
   - Authenticated user
   - Existing student profile
   - Record in `bi_st_course_online` with `stco_payment_status = 'paid'` and `stco_enrollment_status = 'active'` (or `role = 'admin'`).
   - If unverified, `syllabus_topic_url` is returned as `null` and `is_locked = true`. Direct `GET /api/onlinecoures/{id}/syllabus/{syllabus_id}` returns `403 Forbidden`.

---

## 16. Online Quiz Questions API (`/api/online-quiz-questions`)

Base endpoint: `/api/online-quiz-questions`  
Database Table: `bi_online_quiz_questions`

### 16.1 Table Schema

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `quiz_id` | INT UNSIGNED AUTO_INCREMENT | No | Primary Key | Question identifier |
| `course_id` | INT UNSIGNED | Yes | NULL | Linked course identifier (`bi_courses` / `bi_online_courese`) |
| `quiz_questions` | TEXT | No | — | The question statement |
| `quiz_option_1` | VARCHAR(500) | No | — | Option 1 |
| `quiz_option_2` | VARCHAR(500) | No | — | Option 2 |
| `quiz_option_3` | VARCHAR(500) | No | — | Option 3 |
| `quiz_option_4` | VARCHAR(500) | No | — | Option 4 |
| `quiz_correct_answer` | TINYINT UNSIGNED | No | — | Correct option index (1, 2, 3, or 4) |
| `created_at` | TIMESTAMP | No | CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | No | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last modification timestamp |
| `extra` | JSON | Yes | NULL | Optional JSON metadata (category, tags, etc.) |

### 16.2 Endpoints Reference

| Method | Endpoint | Access | Purpose | Success Code |
|---|---|---|---|---|
| `GET` | `/api/online-quiz-questions/random/{count}` | Public / Auth | Fetch random questions (1–100). Supports `?course_id={id}`, `?fallback=false`, `?hide_answer=true`, `?format=flat`. | `200 OK` |
| `GET` | `/api/online-quiz-questions/course/{course_id}/random/{count}` | Public / Auth | Course-specific random questions (1–100). Supports `?fallback=false`, `?hide_answer=true`, `?format=flat`. | `200 OK` |
| `GET` | `/api/online-quiz-questions/random/{count}/course/{course_id}` | Public / Auth | Alias for course-specific random questions. | `200 OK` |
| `GET` | `/api/online-quiz-questions` | Public / Auth | List questions (paginated). Supports `?course_id={id}`, `?difficulty={d}`, `?search={term}`. Hides `quiz_correct_answer` for non-admins. | `200 OK` |
| `GET` | `/api/online-quiz-questions/{id}` | Public / Auth | Fetch single question. | `200 OK` |
| `POST` | `/api/online-quiz-questions` | Admin Only | Create new quiz question (accepts `course_id`). | `201 Created` |
| `PUT` | `/api/online-quiz-questions/{id}` | Admin Only | Fully replace all editable fields of a question. | `200 OK` |
| `PATCH` | `/api/online-quiz-questions/{id}` | Admin Only | Partially update only supplied fields (including `course_id`). | `200 OK` |
| `DELETE` | `/api/online-quiz-questions/{id}` | Admin Only | Delete a quiz question by ID. | `204 No Content` |

### 16.3 Security & Role-Based Response

- **Student Protection**: In accordance with academic integrity requirements, whenever a non-admin client (student or anonymous quiz-taker) accesses `GET /api/online-quiz-questions` or `GET /api/online-quiz-questions/{id}`, the backend automatically suppresses the `quiz_correct_answer` field from the JSON response.
- **Admin Full View**: When `X-User-Role: admin` and a verified admin `X-User-Id` are sent, the full question record including `quiz_correct_answer` is returned.
- **Course-Specific Filtering**: Random questions can be pulled for a specific course using `?course_id={id}` or route path `/api/online-quiz-questions/course/{course_id}/random/{count}`. If fewer questions exist for that course than requested, the system falls back to other questions unless `?fallback=false` or `?strict=true` is specified.
- **Immutability of Keys**: Clients cannot alter `quiz_id`, `created_at`, or `updated_at`.

### 16.4 Request & Response Examples

#### 1. Fetch All Questions (Student View)
```http
GET /api/online-quiz-questions?page=1&limit=20 HTTP/1.1
Host: student.brainzima.com
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Quiz questions retrieved successfully.",
  "data": {
    "questions": [
      {
        "quiz_id": 1,
        "course_id": 1,
        "quiz_questions": "What does HTML stand for?",
        "quiz_option_1": "Hyper Text Markup Language",
        "quiz_option_2": "High Text Machine Language",
        "quiz_option_3": "Hyper Transfer Markup Language",
        "quiz_option_4": "Home Tool Markup Language",
        "created_at": "2026-10-26 12:00:00",
        "updated_at": "2026-10-26 12:00:00",
        "extra": {
          "difficulty": "easy",
          "subject": "Web Development"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "total_pages": 1
    }
  }
}
```

#### 2. Create Question (Admin View)
```http
POST /api/online-quiz-questions HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 1
X-User-Role: admin

{
  "course_id": 1,
  "quiz_questions": "What does HTML stand for?",
  "quiz_option_1": "Hyper Text Markup Language",
  "quiz_option_2": "High Text Machine Language",
  "quiz_option_3": "Hyper Transfer Markup Language",
  "quiz_option_4": "Home Tool Markup Language",
  "quiz_correct_answer": 1,
  "extra": {
    "difficulty": "easy"
  }
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Quiz question created successfully.",
  "data": {
    "quiz_id": 1,
    "course_id": 1,
    "quiz_questions": "What does HTML stand for?",
    "quiz_option_1": "Hyper Text Markup Language",
    "quiz_option_2": "High Text Machine Language",
    "quiz_option_3": "Hyper Transfer Markup Language",
    "quiz_option_4": "Home Tool Markup Language",
    "quiz_correct_answer": 1,
    "created_at": "2026-10-26 19:30:00",
    "updated_at": "2026-10-26 19:30:00",
    "extra": {
      "difficulty": "easy"
    }
  }
}
```

#### 3. Partially Update Question (PATCH)
```http
PATCH /api/online-quiz-questions/1 HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 1
X-User-Role: admin

{
  "course_id": 2,
  "quiz_option_4": "Hyperlink Text Markup Language"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Quiz question updated successfully.",
  "data": {
    "quiz_id": 1,
    "course_id": 2,
    "quiz_questions": "What does HTML stand for?",
    "quiz_option_1": "Hyper Text Markup Language",
    "quiz_option_2": "High Text Machine Language",
    "quiz_option_3": "Hyper Transfer Markup Language",
    "quiz_option_4": "Hyperlink Text Markup Language",
    "quiz_correct_answer": 1,
    "created_at": "2026-10-26 19:30:00",
    "updated_at": "2026-10-26 19:35:00",
    "extra": {
      "difficulty": "easy"
    }
  }
}
```

#### 4. Fetch Course-Specific Random Questions
```http
GET /api/online-quiz-questions/random/10?course_id=1 HTTP/1.1
Host: student.brainzima.com
```
*(Also accessible via `GET /api/online-quiz-questions/course/1/random/10`)*

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "10 random quiz questions retrieved successfully.",
  "data": [
    {
      "quiz_id": 1,
      "course_id": 1,
      "quiz_questions": "What does HTML stand for?",
      "quiz_option_1": "Hyper Text Markup Language",
      "quiz_option_2": "High Text Machine Language",
      "quiz_option_3": "Hyper Transfer Markup Language",
      "quiz_option_4": "Home Tool Markup Language",
      "quiz_correct_answer": 1,
      "created_at": "2026-10-26 12:00:00",
      "updated_at": "2026-10-26 12:00:00",
      "extra": {
        "difficulty": "easy"
      }
    }
  ]
}
```

#### 5. Delete Question (DELETE)
```http
DELETE /api/online-quiz-questions/1 HTTP/1.1
Host: student.brainzima.com
X-User-Id: 1
X-User-Role: admin
```

**Response (`204 No Content`)** *(Empty body)*

---

## 17. Online Results API (`/api/online-results`)

Base endpoint: `/api/online-results`  
Database Table: `bi_online_result`

### 17.1 Table Schema

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `result_id` | INT UNSIGNED AUTO_INCREMENT | No | Primary Key | Result identifier |
| `std_id` | INT UNSIGNED | No | — | Foreign key referencing `bi_student.st_id` |
| `course_id` | INT UNSIGNED | No | — | Foreign key referencing `bi_courses.course_id` or `bi_online_courese.course_id` |
| `marks` | DECIMAL(8,2) | No | 0.00 | Marks scored (>= 0.00) |
| `created_at` | TIMESTAMP | No | CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | No | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last modification timestamp |
| `extra` | JSON | Yes | NULL | Optional JSON metadata (breakdown, timing, etc.) |

### 17.2 Endpoints Reference

| Method | Endpoint | Access | Purpose | Success Code |
|---|---|---|---|---|
| `GET` | `/api/online-results` | Student / Admin | List results (Paginated). Students strictly see only their own results; Admins see all. | `200 OK` |
| `GET` | `/api/online-results/{id}` | Student / Admin | Get result by ID. Students may only view their own result (403 on other students). | `200 OK` |
| `POST` | `/api/online-results` | Student / Admin | Create quiz result. Students submit their own result; Admins can submit for any student. | `201 Created` |
| `PUT` | `/api/online-results/{id}` | Admin Only | Replace all editable fields of a result record. | `200 OK` |
| `PATCH` | `/api/online-results/{id}` | Admin Only | Partially update supplied fields (`marks`, `extra`, etc.). | `200 OK` |
| `DELETE` | `/api/online-results/{id}` | Admin Only | Delete an online result record by ID. | `204 No Content` |

### 17.3 Foreign Key Validation & Security Rules

1. **Foreign Key Integrity**:
   - `std_id` is validated against `bi_student` (`st_id`). If the student does not exist, returns `422 Unprocessable Entity`.
   - `course_id` is validated against existing course catalogs (`bi_courses` or `bi_online_courese`). If invalid, returns `422 Unprocessable Entity`.
2. **Student Isolation**:
   - When a student calls `GET /api/online-results`, the query is automatically constrained to `r.std_id = student.st_id`.
   - If a student specifies `?std_id=X` where `X` is not their own student ID, the API rejects the request with `403 Forbidden`.
   - When a student submits a result via `POST /api/online-results`, the student's profile is checked; they can only save results under their own `st_id`.
3. **Admin Rights**:
   - Only administrators may alter existing marks via `PUT` / `PATCH` or remove results via `DELETE`.

### 17.4 Request & Response Examples

#### 1. Fetch Student Results (Student Calling)
```http
GET /api/online-results?page=1&limit=20 HTTP/1.1
Host: student.brainzima.com
X-User-Id: 5
X-User-Role: student
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Online results retrieved successfully.",
  "data": {
    "results": [
      {
        "result_id": 1,
        "std_id": 5,
        "course_id": 2,
        "marks": 85.50,
        "created_at": "2026-10-26 19:40:00",
        "updated_at": "2026-10-26 19:40:00",
        "extra": {
          "total_questions": 20,
          "correct": 17,
          "duration_minutes": 15
        },
        "st_name": "Ajit Kumar",
        "st_regno": "BISR0005",
        "course_name": "Full Stack Web Development",
        "course_code": "FSWD101"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "total_pages": 1
    }
  }
}
```

#### 2. Create Result (POST)
```http
POST /api/online-results HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 5
X-User-Role: student

{
  "std_id": 5,
  "course_id": 2,
  "marks": 85.50,
  "extra": {
    "total_questions": 20,
    "correct": 17,
    "duration_minutes": 15
  }
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Online result created successfully.",
  "data": {
    "result_id": 1,
    "std_id": 5,
    "course_id": 2,
    "marks": 85.50,
    "created_at": "2026-10-26 19:40:00",
    "updated_at": "2026-10-26 19:40:00",
    "extra": {
      "total_questions": 20,
      "correct": 17,
      "duration_minutes": 15
    },
    "st_name": "Ajit Kumar",
    "st_regno": "BISR0005",
    "course_name": "Full Stack Web Development",
    "course_code": "FSWD101"
  }
}
```

#### 3. Replace Result (PUT - Admin)
```http
PUT /api/online-results/1 HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 1
X-User-Role: admin

{
  "std_id": 5,
  "course_id": 2,
  "marks": 90.00,
  "extra": {
    "total_questions": 20,
    "correct": 18,
    "re_evaluated": true
  }
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Online result updated successfully.",
  "data": {
    "result_id": 1,
    "std_id": 5,
    "course_id": 2,
    "marks": 90.00,
    "created_at": "2026-10-26 19:40:00",
    "updated_at": "2026-10-26 19:45:00",
    "extra": {
      "total_questions": 20,
      "correct": 18,
      "re_evaluated": true
    },
    "st_name": "Ajit Kumar",
    "st_regno": "BISR0005",
    "course_name": "Full Stack Web Development",
    "course_code": "FSWD101"
  }
}
```

#### 4. Delete Result (DELETE - Admin)
```http
DELETE /api/online-results/1 HTTP/1.1
Host: student.brainzima.com
X-User-Id: 1
X-User-Role: admin
```

**Response (`204 No Content`)** *(Empty body)*

---

## 18. Online Course Feedback API (`/api/online-course-feedback`)

Base endpoint: `/api/online-course-feedback`  
Aliases: `/online-course-feedback`  
Database Table: `bi_online_courese_feedbak`

### 18.1 Table Schema

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `feedback_id` | INT UNSIGNED AUTO_INCREMENT | No | Primary Key | Feedback identifier |
| `coures_id` | INT UNSIGNED | No | — | Foreign key referencing `bi_online_courese.course_id` |
| `user_id` | INT UNSIGNED | Yes | NULL | Foreign key referencing `bi_users.user_id` (ownership verification) |
| `student_name` | VARCHAR(255) | No | — | Student's name (derived from authenticated session) |
| `comment` | TEXT | No | — | Feedback comment / review |
| `created_at` | TIMESTAMP | No | CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | No | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last modification timestamp |
| `extra` | JSON / LONGTEXT | Yes | NULL | Optional JSON metadata (rating, tags, etc.) |

### 18.2 Endpoints Reference

| Method | Endpoint | Access | Purpose | Success Code |
|---|---|---|---|---|
| `GET` | `/api/online-course-feedback` | Public / Auth | List all feedback (paginated). Supports `?page=`, `?limit=`, `?coures_id=`. | `200 OK` |
| `GET` | `/api/online-course-feedback/{id}` | Public / Auth | Get single feedback by `feedback_id`. | `200 OK` |
| `POST` | `/api/online-course-feedback` | Student / Admin | Create new course feedback. `student_name` is derived from auth session. | `201 Created` |
| `PUT` | `/api/online-course-feedback/{id}` | Student (own) / Admin | Fully replace all editable fields of feedback. | `200 OK` |
| `PATCH` | `/api/online-course-feedback/{id}` | Student (own) / Admin | Partially update supplied fields (`comment`, `coures_id`, `extra`). | `200 OK` |
| `DELETE` | `/api/online-course-feedback/{id}` | Student (own) / Admin | Delete feedback by ID. | `200 OK` |

### 18.3 Role-Based Access & Security Rules

1. **Identity Protection**: `student_name` is **never trusted from client input**. It is automatically resolved from the authenticated user's record (`bi_users.user_name` or `bi_student.st_name`).
2. **Ownership Enforcement**:
   - Students may create feedback and manage (PUT, PATCH, DELETE) **only their own records** (verified by `user_id`).
   - If a student attempts to update or delete another user's feedback, the API responds with `403 Forbidden`.
   - Admins can manage all records across the system.
3. **Course Existence Verification**:
   - Every `coures_id` is validated against the actual online course catalog (`bi_online_courese.course_id`).
   - If the course does not exist, the API responds with `422 Unprocessable Entity`.
4. **Input Sanitization & Constraints**:
   - Uses parameterized MySQLi prepared statements to prevent SQL injection.
   - Rejects empty bodies and unknown fields on `PATCH`.

### 18.4 Request & Response Examples

#### 1. List Feedback (Paginated with Course Filter)
```http
GET /api/online-course-feedback?page=1&limit=20&coures_id=1 HTTP/1.1
Host: student.brainzima.com
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Feedback retrieved successfully.",
  "data": [
    {
      "feedback_id": 1,
      "coures_id": 1,
      "user_id": 2,
      "student_name": "Rahul Kumar",
      "comment": "The course content is very helpful and easy to follow.",
      "created_at": "2026-10-27 19:50:00",
      "updated_at": "2026-10-27 19:50:00",
      "extra": {
        "rating": 5,
        "recommend": true
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

#### 2. Get Feedback by ID
```http
GET /api/online-course-feedback/1 HTTP/1.1
Host: student.brainzima.com
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Feedback retrieved successfully.",
  "data": {
    "feedback_id": 1,
    "coures_id": 1,
    "user_id": 2,
    "student_name": "Rahul Kumar",
    "comment": "The course content is very helpful and easy to follow.",
    "created_at": "2026-10-27 19:50:00",
    "updated_at": "2026-10-27 19:50:00",
    "extra": null
  }
}
```

#### 3. Create Feedback (POST)
```http
POST /api/online-course-feedback HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 2
X-User-Role: student

{
  "coures_id": 1,
  "comment": "The course content is helpful.",
  "extra": {
    "rating": 5
  }
}
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "Feedback created successfully.",
  "data": {
    "feedback_id": 2,
    "coures_id": 1,
    "user_id": 2,
    "student_name": "Rahul Kumar",
    "comment": "The course content is helpful.",
    "created_at": "2026-10-27 20:00:00",
    "updated_at": "2026-10-27 20:00:00",
    "extra": {
      "rating": 5
    }
  }
}
```

#### 4. Replace Feedback (PUT)
```http
PUT /api/online-course-feedback/2 HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 2
X-User-Role: student

{
  "coures_id": 1,
  "comment": "Updated: The course content is exceptionally thorough and helpful."
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Feedback updated successfully.",
  "data": {
    "feedback_id": 2,
    "coures_id": 1,
    "user_id": 2,
    "student_name": "Rahul Kumar",
    "comment": "Updated: The course content is exceptionally thorough and helpful.",
    "created_at": "2026-10-27 20:00:00",
    "updated_at": "2026-10-27 20:05:00",
    "extra": null
  }
}
```

#### 5. Partially Update Feedback (PATCH)
```http
PATCH /api/online-course-feedback/2 HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 2
X-User-Role: student

{
  "comment": "Updated feedback about the course."
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Feedback updated successfully.",
  "data": {
    "feedback_id": 2,
    "coures_id": 1,
    "user_id": 2,
    "student_name": "Rahul Kumar",
    "comment": "Updated feedback about the course.",
    "created_at": "2026-10-27 20:00:00",
    "updated_at": "2026-10-27 20:10:00",
    "extra": null
  }
}
```

#### 6. Delete Feedback (DELETE)
```http
DELETE /api/online-course-feedback/2 HTTP/1.1
Host: student.brainzima.com
X-User-Id: 2
X-User-Role: student
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Feedback deleted successfully.",
  "data": null
}
```

### 18.5 Seeded Dummy Feedback & SQL Seed Script

A complete SQL seed script is available at [`api/config/feedback_dummy.sql`](file:///c:/xampp/htdocs/student.brainzima.com/api/config/feedback_dummy.sql) (also mirrored at `api/feedback/feedback_dummy.sql`).

To insert/seed the dummy feedback into MySQL:
```bash
mysql -u root -p mjkfwenv_brainzima_student < api/config/feedback_dummy.sql
```

The following 5 dummy reviews have been seeded into `bi_online_courese_feedbak`:

| ID | Course ID | Student Name | Rating | Comment |
| :---: | :---: | :--- | :---: | :--- |
| **#1** | **1** (ADCA) | Rahul Kumar | ⭐ 5 | The ADCA online course covers everything from computer basics to advanced office tools. Extremely well organized! |
| **#2** | **2** (DWD) | Aman Kumar | ⭐ 5 | Web Development course structure is fantastic. HTML, CSS, JavaScript, and React modules are clearly explained with practical coding examples. |
| **#3** | **3** (MERN) | Priya Singh | ⭐ 5 | MERN Stack course is very comprehensive. The live project sessions and REST API integration tutorials helped me build my portfolio. |
| **#4** | **4** (JAVA) | Neha Kumari | ⭐ 4 | Java Full Stack modules with Spring Boot and database connections are explained step-by-step. Highly recommended! |
| **#5** | **5** (CYBER) | Rahul Kumar | ⭐ 5 | Cyber Security fundamentals course gives great hands-on insights on network security, Linux administration, and OWASP best practices. |

---

## 19. E-Books Library API (`/api/ebooks-lib`)

Base endpoint: `/api/ebooks-lib`  
Aliases: `/ebooks-lib`, `/api/ebooks`, `/ebooks`  
Database Table: `bi_ebook_library`  
PDF Storage Directory: `api/ebooks-lib/pdfs/`

### 19.1 Table Schema

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `ebook_id` | INT UNSIGNED AUTO_INCREMENT | No | Primary Key | E-book identifier |
| `ebook_pdf_link` | VARCHAR(1000) | No | — | Relative path to uploaded PDF in `ebooks-lib/pdfs/` (e.g. `ebooks-lib/pdfs/ebook-...pdf`) or external URL |
| `ebook_title` | VARCHAR(255) | No | — | Book title |
| `ebook_description` | TEXT | Yes | NULL | Book synopsis / summary |
| `ebook_author` | VARCHAR(255) | No | — | Author name(s) |
| `ebook_edition` | VARCHAR(100) | Yes | NULL | Edition (e.g. `4th Edition`) |
| `ebook_publication` | VARCHAR(255) | Yes | NULL | Publisher / publication house |
| `created_at` | TIMESTAMP | No | CURRENT_TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | No | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | Last modification timestamp |
| `extra` | JSON / LONGTEXT | Yes | NULL | Optional JSON metadata (ISBN, category, page count, tags) |

### 19.2 Storage & File Upload Architecture

```
api/
└── ebooks-lib/
    ├── EbookLibraryController.php
    ├── EbookLibraryModel.php
    ├── index.php
    ├── test_ebooks_api.php
    └── pdfs/              ← E-Book PDF upload destination (contains .htaccess)
        ├── .htaccess      ← Denies PHP/script execution; serves inline PDF
        └── ebook-{id}-{slug}-{rand}.pdf
```

- **Uploaded PDF Destination**: Whenever an e-book is inserted or updated with a file (`ebook_pdf`, `pdf`, or `file`), the PDF is automatically stored directly into the `ebooks-lib/pdfs/` folder.
- **Multipart Upload Support**: Accepts `multipart/form-data` with PDF binary in `ebook_pdf`, `pdf`, or `file`.
- **Validation**:
  - MIME check via `finfo`: Must strictly be `application/pdf`.
  - Extension check: Must be `.pdf` (executables like `.php`, `.exe`, `.sh` blocked).
  - Maximum upload size: Up to 50 MB.
- **Physical Lifecycle Management**:
  - When replacing a PDF via `PUT` or `PATCH`, the previous physical file in `ebooks-lib/pdfs/` is unlinked.
  - When an ebook is deleted via `DELETE`, its associated physical PDF is unlinked.
  - Path traversal checks prevent deleting any file outside `ebooks-lib/` or `uploads/`.

### 19.3 Endpoints Reference

| Method | Endpoint | Access | Purpose | Success Code |
|---|---|---|---|---|
| `GET` | `/api/ebooks-lib` | Public | List e-books (paginated). Supports `?page=`, `?limit=`, `?search=`, `?author=`, `?publication=`. | `200 OK` |
| `GET` | `/api/ebooks-lib/{id}` | Public | Get single e-book by `ebook_id`. | `200 OK` |
| `POST` | `/api/ebooks-lib` | Student / Admin | Create new e-book with PDF file upload (`multipart/form-data`) saved to `ebooks-lib/pdfs/` or `ebook_pdf_link` string. | `201 Created` |
| `PUT` | `/api/ebooks-lib/{id}` | Admin Only | Fully replace all editable fields of an e-book and optionally replace PDF file. | `200 OK` |
| `PATCH` | `/api/ebooks-lib/{id}` | Admin Only | Partially update supplied fields (supports `_method=PATCH` for multipart). | `200 OK` |
| `DELETE` | `/api/ebooks-lib/{id}` | Admin Only | Delete e-book record and clean up associated physical PDF file from `ebooks-lib/pdfs/`. | `200 OK` |

### 19.4 Request & Response Examples

#### 1. List E-Books (with Search / Filter)
```http
GET /api/ebooks-lib?page=1&limit=20&search=Algorithms HTTP/1.1
Host: student.brainzima.com
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "E-books retrieved successfully.",
  "data": [
    {
      "ebook_id": 1,
      "ebook_pdf_link": "ebooks-lib/pdfs/ebook-algorithms-intro-1730041200abc123.pdf",
      "ebook_title": "Introduction to Algorithms",
      "ebook_description": "Comprehensive guide to algorithms and data structures.",
      "ebook_author": "Thomas H. Cormen",
      "ebook_edition": "4th Edition",
      "ebook_publication": "MIT Press",
      "created_at": "2026-10-27 20:15:00",
      "updated_at": "2026-10-27 20:15:00",
      "extra": {
        "pages": 1312,
        "category": "Computer Science"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

#### 2. Get E-Book by ID
```http
GET /api/ebooks-lib/1 HTTP/1.1
Host: student.brainzima.com
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "E-book retrieved successfully.",
  "data": {
    "ebook_id": 1,
    "ebook_pdf_link": "ebooks-lib/pdfs/ebook-algorithms-intro-1730041200abc123.pdf",
    "ebook_title": "Introduction to Algorithms",
    "ebook_description": "Comprehensive guide to algorithms and data structures.",
    "ebook_author": "Thomas H. Cormen",
    "ebook_edition": "4th Edition",
    "ebook_publication": "MIT Press",
    "created_at": "2026-10-27 20:15:00",
    "updated_at": "2026-10-27 20:15:00",
    "extra": {
      "pages": 1312,
      "category": "Computer Science"
    }
  }
}
```

#### 3. Create E-Book with PDF Upload (`multipart/form-data`)
```http
POST /api/ebooks-lib HTTP/1.1
Host: student.brainzima.com
Content-Type: multipart/form-data
X-User-Id: 1
X-User-Role: admin

ebook_title       = Introduction to Algorithms
ebook_author      = Thomas H. Cormen
ebook_description = Comprehensive guide to algorithms and data structures.
ebook_edition     = 4th Edition
ebook_publication = MIT Press
ebook_pdf         = <binary PDF data>
```

**Response (`201 Created`):**
```json
{
  "success": true,
  "message": "E-book created successfully.",
  "data": {
    "ebook_id": 1,
    "ebook_pdf_link": "ebooks-lib/pdfs/ebook-introduction-to-algorithms-1730041200abc123.pdf",
    "ebook_title": "Introduction to Algorithms",
    "ebook_description": "Comprehensive guide to algorithms and data structures.",
    "ebook_author": "Thomas H. Cormen",
    "ebook_edition": "4th Edition",
    "ebook_publication": "MIT Press",
    "created_at": "2026-10-27 20:15:00",
    "updated_at": "2026-10-27 20:15:00",
    "extra": null
  }
}
```

#### 4. Replace E-Book (PUT)
```http
PUT /api/ebooks-lib/1 HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 1
X-User-Role: admin

{
  "ebook_title": "Introduction to Algorithms (Revised)",
  "ebook_author": "Thomas H. Cormen, Charles E. Leiserson",
  "ebook_description": "Updated edition with modern algorithm paradigms.",
  "ebook_edition": "4th Edition Revised",
  "ebook_publication": "MIT Press",
  "ebook_pdf_link": "ebooks-lib/pdfs/ebook-algorithms-intro-revised.pdf"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "E-book updated successfully.",
  "data": {
    "ebook_id": 1,
    "ebook_pdf_link": "ebooks-lib/pdfs/ebook-algorithms-intro-revised.pdf",
    "ebook_title": "Introduction to Algorithms (Revised)",
    "ebook_description": "Updated edition with modern algorithm paradigms.",
    "ebook_author": "Thomas H. Cormen, Charles E. Leiserson",
    "ebook_edition": "4th Edition Revised",
    "ebook_publication": "MIT Press",
    "created_at": "2026-10-27 20:15:00",
    "updated_at": "2026-10-27 20:20:00",
    "extra": null
  }
}
```

#### 5. Partially Update E-Book (PATCH)
```http
PATCH /api/ebooks-lib/1 HTTP/1.1
Host: student.brainzima.com
Content-Type: application/json
X-User-Id: 1
X-User-Role: admin

{
  "ebook_edition": "5th International Edition"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "E-book updated successfully.",
  "data": {
    "ebook_id": 1,
    "ebook_pdf_link": "ebooks-lib/pdfs/ebook-algorithms-intro-revised.pdf",
    "ebook_title": "Introduction to Algorithms (Revised)",
    "ebook_description": "Updated edition with modern algorithm paradigms.",
    "ebook_author": "Thomas H. Cormen, Charles E. Leiserson",
    "ebook_edition": "5th International Edition",
    "ebook_publication": "MIT Press",
    "created_at": "2026-10-27 20:15:00",
    "updated_at": "2026-10-27 20:25:00",
    "extra": null
  }
}
```

#### 6. Delete E-Book (DELETE)
```http
DELETE /api/ebooks-lib/1 HTTP/1.1
Host: student.brainzima.com
X-User-Id: 1
X-User-Role: admin
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "E-book deleted successfully.",
  "data": null
}
```

### 19.5 Available Seeded Dummy E-Books & Physical PDFs

The following 5 verified dummy e-books with **actual physical PDF files** stored in `api/ebooks-lib/pdfs/` are seeded and ready to use.

A complete SQL seed script is available at [`api/config/ebooks_dummy.sql`](file:///c:/xampp/htdocs/student.brainzima.com/api/config/ebooks_dummy.sql) (also mirrored at `api/ebooks-lib/ebooks_dummy.sql`).

To insert/seed the dummy e-books into MySQL:
```bash
mysql -u root -p mjkfwenv_brainzima_student < api/config/ebooks_dummy.sql
```

#### Seeded E-Books Table:

| ID | Title | Author | Edition | Publication | Stored Physical PDF (`ebook_pdf_link`) |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **#1** | **HTML5 & Modern CSS3: The Complete Responsive Design Guide** | Jon Duckett | 2nd Edition | Wiley Publishing | `ebooks-lib/pdfs/ebook-1-html5-modern-css3-guide.pdf` |
| **#2** | **JavaScript: The Definitive Guide to Modern ES6+ & Beyond** | David Flanagan | 7th Edition | O'Reilly Media | `ebooks-lib/pdfs/ebook-2-javascript-definitive-guide-es6.pdf` |
| **#3** | **React.js Design Patterns and Best Practices** | Carlos Santana Roldan | 3rd Edition | Packt Publishing | `ebooks-lib/pdfs/ebook-3-reactjs-design-patterns-best-practices.pdf` |
| **#4** | **Full Stack Web Development with Node.js, Express & MySQL** | Robin Wieruch | 2nd Edition | Road to FullStack | `ebooks-lib/pdfs/ebook-4-full-stack-web-development-node-mysql.pdf` |
| **#5** | **Python Data Science Handbook: Essential Tools for Working with Data** | Jake VanderPlas | 2nd Edition | O'Reilly Media | `ebooks-lib/pdfs/ebook-5-python-data-science-handbook.pdf` |

---

## 20. Testing & Postman Collection

### 20.1 Built-in Automated Test Suites

Dedicated automated test suites are provided to test the APIs from the command line:

```bash
# 1. Test Online Course Feedback API (23 tests)
php api/feedback/test_feedback_api.php

# 2. Test E-Books Library API & PDF uploads (13 tests)
php api/ebooks-lib/test_ebooks_api.php

# 3. Test Quiz Questions & Results Suite
php api/test_runner.php
```

### 20.2 Postman Collection JSON

Import the following snippet directly into Postman to test the new endpoints:

```json
{
  "info": {
    "name": "Brainzima Online Quiz & Result API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Quiz Questions",
      "item": [
        {
          "name": "1. Fetch Random Quiz Questions (with Answers)",
          "request": {
            "method": "GET",
            "header": [],
            "url": "{{base_url}}/api/online-quiz-questions/random/5"
          }
        },
        {
          "name": "2. List Quiz Questions (Paginated)",
          "request": {
            "method": "GET",
            "header": [],
            "url": "{{base_url}}/api/online-quiz-questions?page=1&limit=20"
          }
        },
        {
          "name": "3. Get Quiz Question by ID",
          "request": {
            "method": "GET",
            "header": [],
            "url": "{{base_url}}/api/online-quiz-questions/1"
          }
        },
        {
          "name": "3. Create Quiz Question (Admin)",
          "request": {
            "method": "POST",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"quiz_questions\": \"What does HTML stand for?\",\n  \"quiz_option_1\": \"Hyper Text Markup Language\",\n  \"quiz_option_2\": \"High Text Machine Language\",\n  \"quiz_option_3\": \"Hyper Transfer Markup Language\",\n  \"quiz_option_4\": \"Home Tool Markup Language\",\n  \"quiz_correct_answer\": 1,\n  \"extra\": null\n}"
            },
            "url": "{{base_url}}/api/online-quiz-questions"
          }
        },
        {
          "name": "4. Replace Quiz Question (PUT)",
          "request": {
            "method": "PUT",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"quiz_questions\": \"What does HTML stand for?\",\n  \"quiz_option_1\": \"Hyper Text Markup Language\",\n  \"quiz_option_2\": \"High Text Machine Language\",\n  \"quiz_option_3\": \"Hyper Transfer Markup Language\",\n  \"quiz_option_4\": \"Home Tool Markup Language\",\n  \"quiz_correct_answer\": 1,\n  \"extra\": null\n}"
            },
            "url": "{{base_url}}/api/online-quiz-questions/1"
          }
        },
        {
          "name": "5. Update Quiz Question (PATCH)",
          "request": {
            "method": "PATCH",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"quiz_option_4\": \"Hyperlink Tool Markup Language\"\n}"
            },
            "url": "{{base_url}}/api/online-quiz-questions/1"
          }
        },
        {
          "name": "6. Delete Quiz Question (DELETE)",
          "request": {
            "method": "DELETE",
            "header": [
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "url": "{{base_url}}/api/online-quiz-questions/1"
          }
        }
      ]
    },
    {
      "name": "Online Results",
      "item": [
        {
          "name": "1. List Results (Student/Admin)",
          "request": {
            "method": "GET",
            "header": [
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "url": "{{base_url}}/api/online-results?page=1&limit=20"
          }
        },
        {
          "name": "2. Get Result by ID",
          "request": {
            "method": "GET",
            "header": [
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "url": "{{base_url}}/api/online-results/1"
          }
        },
        {
          "name": "3. Create Result (POST)",
          "request": {
            "method": "POST",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"std_id\": 1,\n  \"course_id\": 1,\n  \"marks\": 85.50,\n  \"extra\": null\n}"
            },
            "url": "{{base_url}}/api/online-results"
          }
        },
        {
          "name": "4. Replace Result (PUT)",
          "request": {
            "method": "PUT",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"std_id\": 1,\n  \"course_id\": 1,\n  \"marks\": 90.00,\n  \"extra\": null\n}"
            },
            "url": "{{base_url}}/api/online-results/1"
          }
        },
        {
          "name": "5. Update Result (PATCH)",
          "request": {
            "method": "PATCH",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"marks\": 95.00\n}"
            },
            "url": "{{base_url}}/api/online-results/1"
          }
        },
        {
          "name": "6. Delete Result (DELETE)",
          "request": {
            "method": "DELETE",
            "header": [
              { "key": "X-User-Id", "value": "1" },
              { "key": "X-User-Role", "value": "admin" }
            ],
            "url": "{{base_url}}/api/online-results/1"
          }
        }
      ]
    }
  ]
}
```


