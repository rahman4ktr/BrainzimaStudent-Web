# Brainzima Student Management System — REST API Backend

> Production REST API backend for the Brainzima Student Management System, deployed at:  
> **Production Base URL**: `https://try.ajitdev.com/brainzima/student/api` *(also supports alias `.../studnet/api`)*  
> Built strictly with Pure OOP PHP 8.2+ and MySQLi OOP to power the Next.js 14+ frontend.

[![PHP Version](https://img.shields.io/badge/PHP-8.2%2B-777BB4?logo=php&logoColor=white)](#)
[![Database](https://img.shields.io/badge/Database-MySQL%20%2F%20MariaDB-4479A1?logo=mysql&logoColor=white)](#)
[![Driver](https://img.shields.io/badge/Driver-MySQLi%20OOP-005C84)](#)
[![Methods](https://img.shields.io/badge/Methods-GET%20%7C%20POST%20%7C%20PUT%20%7C%20PATCH%20%7C%20DELETE-brightgreen)](#)
[![Architecture](https://img.shields.io/badge/Architecture-Clean%20OOP%20REST%20API-green)](#)
[![Storage](https://img.shields.io/badge/File%20Handling-Pure%20String%20Path%20Storage-blue)](#)

---

## Production API Base URLs

- **Primary Production URL**:  
  `https://try.ajitdev.com/brainzima/student/api`
- **Fallback / Alias URL (supports common typo)**:  
  `https://try.ajitdev.com/brainzima/studnet/api`
- **Local Development URL**:  
  `http://localhost/student.brainzima.com/api`

---

## 1. Architecture: Zero Server-Side File Uploads & Pure String Path Storage

### 1.1 Strict Separation of Concerns
To maximize scalability, security, and performance, **all file/image management logic has been completely removed from PHP**.

| Responsibility | Frontend (Next.js 14+ / Storage Provider) | Backend (PHP 8.2+ REST API) |
| :--- | :--- | :--- |
| **File / Image Selection** | Handled in browser UI | Zero involvement |
| **File Uploading** | Uploads directly to CDN / Object Storage / Host Directory | Zero involvement (no `$_FILES`, no `move_uploaded_file`) |
| **Folder Creation** | Creates dynamic directories (e.g. `students/student-1/`) | Zero involvement (no `mkdir`) |
| **File Cleanup / Replacement** | Deletes old file / replaces assets in storage | Zero involvement |
| **Data Persistence** | Sends generated file/image **path as a string** via JSON | Validates string and saves path directly into MySQL |
| **Data Retrieval** | Consumes stored path string and renders URL | Returns stored path string exactly as saved in DB |
| **Record Deletion** | Deletes physical file in storage | Deletes **only database record/data** (never touches physical files) |

### 1.2 Zero PHP Upload Code Policy
The PHP backend contains **no**:
- `$_FILES` access
- `move_uploaded_file()` calls
- File upload or MIME-type validation
- File size validation
- Image processing or thumbnail generation
- File or image unlinking/deletion (`unlink`)
- File copying or moving
- Upload directory creation (`mkdir`)
- Old image/file cleanup routines
- Backend upload helpers or services

---

## 2. API Contract for Image & File Paths

### 2.1 Request Payload Format (POST / PUT / PATCH)
Frontend uploads the file directly, then sends standard JSON with the path string:

```json
{
  "user_image": "student.brainzima.com/public/uploads/students/student-1/profile.jpg",
  "name": "Ajit Kumar",
  "email": "ajit@example.com"
}
```

Or for student documents:
```json
{
  "docs_st_image": "student.brainzima.com/public/uploads/students/student-1/profile.jpg",
  "docs_st_aadhaar_front": "student.brainzima.com/public/uploads/students/student-1/aadhaar-front.webp",
  "docs_st_aadhaar_back": "student.brainzima.com/public/uploads/students/student-1/aadhaar-back.webp",
  "docs_st_qualification": "student.brainzima.com/public/uploads/students/student-1/qualification.pdf"
}
```

Or for study notes:
```json
{
  "notes_title": "React Fundamentals",
  "notes_description": "Complete beginner study notes",
  "notes_pdf": "public/uploads/notes/react/react-fundamentals.pdf",
  "notes_course_id": 3
}
```

### 2.2 GET Responses
GET endpoints return the exact path string stored in MySQL:

```json
{
  "success": true,
  "data": {
    "user_id": 12,
    "user_name": "Ajit Kumar",
    "user_email": "ajit@example.com",
    "user_image": "student.brainzima.com/public/uploads/students/student-1/profile.jpg"
  }
}
```

### 2.3 DELETE Requests
When `DELETE /api/user/image` or any `DELETE` endpoint is invoked:
- PHP updates `user_image = NULL` or removes the corresponding database record.
- **PHP never touches or deletes any physical file on the disk**.
- Physical asset cleanup is managed entirely by the frontend / storage provider.

---

## 3. Full PATCH & Method Overriding Support

The API natively supports the `PATCH` HTTP verb across **all resource update endpoints**:
- **Native Direct PATCH**: Clients send `PATCH` directly to `/api/user/profile`, `/api/user/{id}`, `/api/student/me`, `/api/student/{id}`, `/api/course/{id}`, `/api/fee/{id}`, `/api/notes/{id}`, etc.
- **HTTP Method Overriding**: Supported for clients or proxies unable to send native PATCH:
  - Header: `X-HTTP-Method-Override: PATCH` (or `PUT`)
  - Body parameter: `_method=PATCH`
  - Query parameter: `?_method=PATCH`
- **JSON Input Stream**: The `Request` core class parses `application/json` automatically for `POST`, `PUT`, and `PATCH`.

---

## 4. Architecture Overview

```
Next.js Frontend / Client
        │
        ├── Direct Client-Side / Cloud Storage Upload
        │     └── Obtains string path (e.g. "student.brainzima.com/public/uploads/students/student-1/profile.jpg")
        │
        ├── Sends JSON Payload with Path Strings
        ├── Auth Headers (X-User-Id, X-User-Role)
        └── Native HTTP Verbs (GET, POST, PUT, PATCH, DELETE)
                │
                ▼
             PHP API (core/Router.php)
                │
        ┌───────┼──────────────────────────┐
        │       │                          │
        ▼       ▼                          ▼
     Request   CORS                     Response
     (JSON     (GET,POST,PUT,          (Uniform
     Parser)    PATCH,DELETE)            Envelopes)
        │
        ▼
   Controllers ──────► Models (MySQLi Prepared Stmts)
        │                     │
        ├── AuthController    ├── AuthModel
        ├── UserController    ├── UserModel  (bi_users)
        ├── StudentController ├── StudentModel (bi_student)
        ├── CourseController  ├── CourseModel (bi_courses)
        ├── EnrollmentController ├── EnrollmentModel (bi_st_course)
        ├── FeeController     ├── FeeModel (bi_fee_transactions)
        ├── AttendanceController ├── AttendanceModel (bi_attendance)
        ├── NotesController   ├── NotesModel (bi_notes)
        ├── DocumentController├── DocumentModel (bi_st_docs)
        └── FranchiseeController └── FranchiseeModel (bi_franchisee)
```

---

## 5. Technology Stack & Invariants

### Strictly Followed
- **PHP 8.2+** with `declare(strict_types=1);` and typed properties.
- **Pure OOP PHP**: Dedicated controllers, models, helpers, and middleware.
- **MySQLi Prepared Statements**: Complete parameterized binding (`bind_param`) everywhere.
- **Zero Framework Bloat**: No external frameworks, micro-frameworks, or PDO.
- **Stateless Authentication**: Next.js passes `X-User-Id` and `X-User-Role` headers.
- **Bcrypt Password Security**: Passwords hashed with `PASSWORD_DEFAULT` and verified with `password_verify()`.
- **String Path Storage**: Zero upload handling, zero filesystem unlinking.

---

## 6. API Directory Structure

```
/api
├── attendance/
│   ├── AttendanceController.php
│   ├── AttendanceModel.php
│   └── index.php
├── auth/
│   ├── AuthController.php
│   ├── AuthModel.php
│   └── index.php
├── config/
│   ├── Config.php
│   ├── Cors.php
│   ├── Database.php
│   ├── patch.sql          <-- Migration script for user_image & sync
│   └── sql.sql            <-- Complete DB dump
├── core/
│   ├── Request.php        <-- JSON parser & HTTP method override handler
│   ├── Response.php       <-- Predictable JSON Envelopes
│   ├── Router.php         <-- Full PATCH, PUT, POST, GET, DELETE routing
│   └── Validator.php
├── course/
│   ├── CourseController.php
│   ├── CourseModel.php
│   └── index.php
├── enrollment/
│   ├── EnrollmentController.php
│   ├── EnrollmentModel.php
│   └── document/
│       ├── DocumentController.php
│       ├── DocumentModel.php
│       └── index.php
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
│   ├── PasswordHelper.php
│   └── RegNoHelper.php
├── middleware/
│   ├── RequestMiddleware.php
│   ├── RoleMiddleware.php
│   └── ValidationMiddleware.php
├── notes/
│   ├── NotesController.php
│   ├── NotesModel.php
│   └── index.php
├── student/
│   ├── StudentController.php
│   ├── StudentModel.php
│   └── index.php
├── user/
│   ├── UserController.php
│   ├── UserModel.php
│   └── index.php
├── .env
├── .htaccess
├── index.php
└── README.md
```

---

## 7. Standard JSON Response Envelopes

### Success Envelope (HTTP 200 / 201)
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```

### Error Envelope (HTTP 400 / 401 / 403 / 404 / 405 / 500)
```json
{
  "success": false,
  "message": "Error description."
}
```

### Validation Failure Envelope (HTTP 422 / 400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "email": "Email is already registered."
  }
}
```

---

## 8. Complete API Reference

### 8.1 Authentication (`/auth`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/auth/register` | `POST` | Public | Register new user account in `bi_users`. Accepts `user_image` path string. |
| `/auth/login` | `POST` | Public | Unified login (email, mobile, or student regno). Returns user & student details + `user_image` path string. |
| `/auth/student-login` | `POST` | Public | Dedicated student login using `regno` + `password`. |
| `/auth/forgot-password` | `POST` | Public | Password reset initiation. |
| `/auth/reset-password` | `POST` | Public | Reset password with new bcrypt hash. |

#### Register User
- **Method**: `POST`
- **Path**: `/auth/register`
- **Request Body (JSON)**:
```json
{
  "name": "Ajit Kumar",
  "email": "ajit@example.com",
  "mobile": "9876543210",
  "password": "Password@123",
  "user_image": "student.brainzima.com/public/uploads/students/student-12/profile.jpg"
}
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
    "user_image": "student.brainzima.com/public/uploads/students/student-12/profile.jpg"
  }
}
```

#### Unified Login
- **Method**: `POST`
- **Path**: `/auth/login`
- **Request Body (JSON)**:
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
    "user_image": "student.brainzima.com/public/uploads/students/student-12/profile.jpg"
  }
}
```

---

### 8.2 User Profile & Account (`/api/user`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/user/me` | `GET` | Authenticated | Retrieve current user profile with stored `user_image` path |
| `/api/user/profile` | `PATCH`, `PUT`, `POST` | Authenticated | Partial update: name, email, mobile, and/or `user_image` path string |
| `/api/user/image` | `POST`, `PUT`, `PATCH` | Authenticated | Dedicated endpoint to update `user_image` path string |
| `/api/user/image` | `DELETE` | Authenticated | Sets `user_image = NULL` in database (never deletes physical files) |
| `/api/user/password` | `PUT`, `PATCH` | Authenticated | Change user account password |
| `/api/user/{id}` | `GET` | Self / Admin | Get account details by `user_id` |
| `/api/user/{id}` | `PATCH`, `PUT` | Self / Admin | Update user (Admin can update role, verified, etc.) |
| `/api/user` | `GET` | Admin (Self if non-admin) | List all registered users with pagination & search |
| `/api/user/{id}` | `DELETE` | Admin | Delete user account from database |

#### Update Profile (Partial Update via PATCH)
- **Method**: `PATCH` (or `PUT` / `POST`)
- **Path**: `/api/user/profile`
- **Headers**:
  - `X-User-Id: 12`
  - `X-User-Role: student`
- **Request (JSON)**:
```json
{
  "name": "Ajit Kumar Singh",
  "mobile": "9876543219",
  "user_image": "student.brainzima.com/public/uploads/students/student-12/avatar.jpg"
}
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
    "user_image": "student.brainzima.com/public/uploads/students/student-12/avatar.jpg",
    "is_student": true,
    "student_id": 5,
    "registration_number": "BISR0005"
  }
}
```

#### Dedicated Avatar Path Update (`POST` / `PUT` / `PATCH /api/user/image`)
- **Method**: `POST` | `PUT` | `PATCH`
- **Path**: `/api/user/image`
- **Headers**: `X-User-Id: 12`
- **Request Body (JSON)**:
```json
{
  "user_image": "student.brainzima.com/public/uploads/students/student-12/profile.jpg"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Profile image path updated successfully",
  "data": {
    "user_id": 12,
    "user_image": "student.brainzima.com/public/uploads/students/student-12/profile.jpg"
  }
}
```

#### Remove Profile Image (`DELETE /api/user/image`)
- **Method**: `DELETE`
- **Path**: `/api/user/image`
- **Headers**: `X-User-Id: 12`
- **Description**: Sets `user_image = NULL` in `bi_users` and linked tables. **Does not touch or delete any files on the filesystem.**
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

### 8.3 Student Profiles (`/api/student`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/student/me` | `GET` | Authenticated | Get current authenticated student's profile + image path |
| `/api/student/me` | `PATCH`, `PUT` | Authenticated | Student self-update (mobile, parent mobile, address, `user_image` path) |
| `/api/student/{id}` | `GET` | Student (own) / Admin | Get student details by `st_id` |
| `/api/student/{id}` | `PATCH`, `PUT` | Student (own) / Admin | Update student profile and syncs path strings |
| `/api/student/password`| `PUT`, `PATCH` | Student / Admin | Change student password |
| `/api/student` | `GET` | Admin / Student | List students (students see own; admin can search/filter) |
| `/api/student` | `POST` | Admin | Create student record directly |
| `/api/student/{id}` | `DELETE` | Admin | Delete student database record |

#### Update Current Student Profile (`PATCH /api/student/me`)
- **Method**: `PATCH` (or `PUT`)
- **Path**: `/api/student/me`
- **Headers**: `X-User-Id: 12`, `X-User-Role: student`
- **Request Body (JSON)**:
```json
{
  "st_mobile_parent": "9001000009",
  "st_address": "Line Bazar, Purnea",
  "st_qualification": "Graduation",
  "user_image": "student.brainzima.com/public/uploads/students/student-12/profile.jpg"
}
```
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
    "st_email": "ajit@example.com",
    "st_mobile": "9876543210",
    "st_mobile_parent": "9001000009",
    "st_address": "Line Bazar, Purnea",
    "st_qualification": "Graduation",
    "user_image": "student.brainzima.com/public/uploads/students/student-12/profile.jpg",
    "courses": []
  }
}
```

---

### 8.4 Student Documents (`/api/document`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/document/student/{id}` | `GET` | Student / Admin | Get stored document paths (photo, aadhaar, qualification) |
| `/api/document/student/{id}` | `POST` | Student / Admin | Store / sync document path strings |
| `/api/document/{id}` | `PUT`, `PATCH` | Student / Admin | Update stored document path strings |
| `/api/document/{id}` | `DELETE` | Admin | Delete document record from database (does not delete physical files) |

#### Store Document Paths (`POST /api/document/student/{id}`)
- **Method**: `POST`
- **Path**: `/api/document/student/5`
- **Headers**: `X-User-Id: 12`, `X-User-Role: student`
- **Request Body (JSON)**:
```json
{
  "docs_st_image": "public/uploads/students/BISR0005/profile.webp",
  "docs_st_aadhaar_front": "public/uploads/students/BISR0005/aadhaar-front.webp",
  "docs_st_aadhaar_back": "public/uploads/students/BISR0005/aadhaar-back.webp",
  "docs_st_qualification": "public/uploads/students/BISR0005/qualification.pdf"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "message": "Documents saved successfully.",
  "data": {
    "docs_id": 3,
    "docs_st_id": 5,
    "docs_st_image": "public/uploads/students/BISR0005/profile.webp",
    "docs_st_aadhaar_front": "public/uploads/students/BISR0005/aadhaar-front.webp",
    "docs_st_aadhaar_back": "public/uploads/students/BISR0005/aadhaar-back.webp",
    "docs_st_qualification": "public/uploads/students/BISR0005/qualification.pdf",
    "st_regno": "BISR0005",
    "st_name": "Ajit Kumar"
  }
}
```

---

### 8.5 Study Notes (`/api/notes`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/notes` | `GET` | Student / Admin | List study notes for enrolled courses (includes `notes_pdf` path string) |
| `/api/notes/{id}` | `GET` | Student / Admin | Get note details and `notes_pdf` path string |
| `/api/notes` | `POST` | Admin | Save note metadata and `notes_pdf` path string |
| `/api/notes/{id}` | `PUT`, `PATCH` | Admin | Update note title, description, or `notes_pdf` path string |
| `/api/notes/{id}` | `DELETE` | Admin | Delete note database record (does not delete physical file) |

#### Create Note with PDF Path (`POST /api/notes`)
- **Method**: `POST`
- **Path**: `/api/notes`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Request Body (JSON)**:
```json
{
  "notes_title": "React Fundamentals",
  "notes_description": "Comprehensive notes covering Hooks and State",
  "notes_pdf": "public/uploads/notes/react/react-fundamentals.pdf",
  "notes_course_id": 3
}
```

---

### 8.6 Course Catalog (`/api/course`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/course` | `GET` | Public | List active courses |
| `/api/course/{id}` | `GET` | Public | Get single course details |
| `/api/course` | `POST` | Admin | Create new course |
| `/api/course/{id}` | `PUT`, `PATCH` | Admin | Update course code, name, modules, fee, or status |
| `/api/course/{id}` | `DELETE` | Admin | Deactivate / remove course record |

---

### 8.7 Course Enrollment (`/api/enrollment`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/enrollment` | `POST` | Student / Admin | Enroll in a course (auto-creates `bi_student` on first enrollment) |
| `/api/enrollment` | `GET` | Student (own) / Admin | List enrollments with fees, dues, and batch info. Returns `total` count. |
| `/api/enrollment/{id}` | `GET` | Student (own) / Admin | View a specific enrollment record |
| `/api/enrollment/{id}` | `PATCH`, `PUT` | **Admin only** | Update `stc_initial_payment`, `stc_discount`, and/or `stc_batch_id`. **`stc_dues` is atomically recalculated.** |
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
> `stc_dues` is **automatically recalculated** inside a locked transaction using the canonical single source of truth:
> ```
> total_successful_paid = SUM(bi_fee_transactions.tr_amount)
> stc_dues = stc_total_fee − stc_discount − total_successful_paid
> ```
> **Canonical Invariant**: All payments, including the initial admission payment, are represented in `bi_fee_transactions`. `stc_initial_payment` is **never subtracted a second time**.

- **Method**: `PATCH` (or `PUT`)
- **Path**: `/api/enrollment/{id}`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
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
    "stc_st_id": 5,
    "stc_course_id": 3,
    "stc_batch_id": 3,
    "stc_total_fee": "8000.00",
    "stc_discount": "1000.00",
    "stc_initial_payment": "5000.00",
    "stc_dues": "1500.00",
    "st_regno": "BISR0005",
    "st_name": "Ajit Kumar",
    "_recalculated": {
      "stc_id": 7,
      "total_fee": 8000,
      "discount": 1000,
      "initial_payment": 5000,
      "total_paid": 6500,
      "dues": 500
    }
  }
}
```

> **Business rules enforced:**
> - `initial_payment` ≥ 0
> - `discount` ≥ 0 and ≤ `stc_total_fee`
> - `initial_payment` ≤ (`stc_total_fee` − `discount`)
> - When `initial_payment` is modified, the corresponding initial admission payment in `bi_fee_transactions` is synchronized in the same atomic transaction.
> - Result `dues` is recalculated as `stc_total_fee − stc_discount − SUM(bi_fee_transactions.tr_amount)` and never negative (floored at 0).
> - Entire operation is wrapped in `BEGIN TRANSACTION … COMMIT` with `FOR UPDATE` row lock.

#### Cancel Enrollment (`DELETE /api/enrollment/{id}`)
- **Method**: `DELETE`
- **Path**: `/api/enrollment/{id}`
- **Headers**: `X-User-Id: 1`, `X-User-Role: admin`
- **Response (200 OK)**:
```json
{
  "success": true,
  "message": "Enrollment cancelled and deleted successfully.",
  "data": null
}
```

> **Warning:** This permanently removes the `bi_st_course` row. Fee transactions linked via `tr_stc_id` may cascade-delete if the foreign key is `ON DELETE CASCADE`.

---

### 8.8 Fee Payments & Installments (`/api/fee`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/fee` | `POST` | Student / Admin | Record installment payment (atomic update to `stc_dues`) |
| `/api/fee` | `GET` | Student (own) / Admin | List fee payment receipts and balances |
| `/api/fee/{id}` | `GET` | Student (own) / Admin | Get specific payment receipt |
| `/api/fee/{id}` | `PUT`, `PATCH` | Admin | Update payment metadata (`payref`, `remark`, `mode`) |

---

### 8.9 Attendance Tracking (`/api/attendance`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/attendance/in` | `POST` | Student / Admin | Check-in (`timein` logged for today) |
| `/api/attendance/out` | `POST` | Student / Admin | Check-out (`timeout` logged for today) |
| `/api/attendance/student/{regno}` | `GET` | Student / Admin | Get attendance history for registration number |
| `/api/attendance` | `GET` | Admin | List attendance records with date and centre filters |

---

### 8.10 Franchisee Centres (`/api/franchisee`)

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/franchisee` | `GET` | Public | List study centres |
| `/api/franchisee/{id}` | `GET` | Public | Get single study centre details |
| `/api/franchisee` | `POST` | Admin | Register new franchisee centre |
| `/api/franchisee/{id}` | `PUT`, `PATCH` | Admin | Update franchisee centre info |

---

## 9. Frontend Integration Guide (Next.js 14 / TypeScript)

### 9.1 Unified API Client Helper

```typescript
// lib/api.ts

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://try.ajitdev.com/brainzima/student/api';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string>;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    userId?: number;
    userRole?: 'student' | 'admin' | 'user';
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, userId, userRole } = options;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  if (userId) headers['X-User-Id'] = String(userId);
  if (userRole) headers['X-User-Role'] = userRole;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return await res.json();
}
```

### 9.2 Client-Side Upload Flow: Frontend Uploads First, Sends String Path to PHP

```typescript
// components/ProfileForm.tsx
import { useState } from 'react';
import { apiRequest } from '@/lib/api';

export function ProfileForm({ user }: { user: any }) {
  const [name, setName] = useState(user.name);
  const [mobile, setMobile] = useState(user.mobile);
  const [imagePath, setImagePath] = useState(user.user_image || '');
  const [uploading, setUploading] = useState(false);

  // 1. Frontend handles file selection & uploading to cloud/storage
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Direct frontend upload to your CDN, S3, or Next.js public upload handler:
      const uploadedPath = await uploadToStorage(file, `students/student-${user.user_id}`);
      
      // Store returned path string (e.g. "student.brainzima.com/public/uploads/students/student-12/profile.jpg")
      setImagePath(uploadedPath);
    } catch (err) {
      alert('Upload failed: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // 2. PHP receives ONLY the string path in JSON
  const handleSave = async () => {
    const res = await apiRequest('/api/user/profile', {
      method: 'PATCH',
      userId: user.user_id,
      userRole: user.role,
      body: {
        name,
        mobile,
        user_image: imagePath, // Path string only!
      },
    });

    if (res.success) {
      alert('Profile updated successfully!');
    } else {
      alert(res.message || 'Update failed');
    }
  };

  return (
    <div className="profile-container">
      <div className="avatar-preview">
        <img
          src={imagePath || '/default-avatar.png'}
          alt="Profile Avatar"
          className="w-24 h-24 rounded-full object-cover"
        />
        <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
        {uploading && <span>Uploading to storage...</span>}
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full Name"
      />
      <input
        type="tel"
        value={mobile}
        onChange={(e) => setMobile(e.target.value)}
        placeholder="Mobile Number"
      />

      <button onClick={handleSave} disabled={uploading}>
        Save Changes (PATCH)
      </button>
    </div>
  );
}

// Dummy storage uploader example
async function uploadToStorage(file: File, folder: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  return data.path; // e.g. "student.brainzima.com/public/uploads/students/student-12/profile.jpg"
}
```

### 9.3 Method Overriding Example (for restricted proxy environments)

If your environment or corporate firewall blocks native `PATCH` or `PUT` requests, use standard `POST` with the override header:

```typescript
const res = await fetch(`${API_BASE}/api/user/profile`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-HTTP-Method-Override': 'PATCH', // Overrides to PATCH!
    'X-User-Id': String(userId),
  },
  body: JSON.stringify({
    name: 'New Name',
    user_image: 'student.brainzima.com/public/uploads/students/student-12/profile.jpg',
  }),
});
```

---

## 10. Database Patch & Migration

To apply the `user_image` upgrades and indexes to an existing database, run the bundled migration script:

```bash
# Path: api/config/patch.sql
mysql -u root -p mjkfwenv_brainzima_student < api/config/patch.sql
```

The script automatically:
1. Adds `user_image varchar(500) DEFAULT NULL` to `bi_users` if missing.
2. Adds `docs_st_image varchar(500) DEFAULT NULL` to `bi_st_docs` if missing.
3. Automatically syncs existing student photos to user records and vice versa.

---

## 11. Verification & Quality Checklist

- [x] **Zero Server-Side Uploads**: Zero `$_FILES`, `move_uploaded_file()`, MIME checks, size validation, or image processing in PHP.
- [x] **Pure String Path Handling**: All image/file fields (`user_image`, `docs_st_image`, `notes_pdf`, etc.) receive and store plain strings.
- [x] **Zero File Deletion in PHP**: `DELETE` requests delete only database rows. Physical files are never touched or unlinked by PHP.
- [x] **Full PATCH Support**: Registered and operational on user, student, course, fee, notes, document, and franchisee modules.
- [x] **Method Overriding**: Supports `X-HTTP-Method-Override` and `_method` parameter.
- [x] **Pure JSON Communication**: All POST, PUT, and PATCH endpoints consume standard JSON request bodies.
- [x] **Bi-directional Sync**: Changes to user image path update student documents and vice-versa.
- [x] **Immutable Financial Trail**: Course fees, dues, and transaction histories protected with pessimistic locking.
- [x] **Pure OOP PHP & MySQLi**: Zero framework dependencies, zero PDO, prepared statements everywhere.
