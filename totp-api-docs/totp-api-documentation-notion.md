# 📑 OTP Service - Stateless TOTP API Spec

| Property | Value |
| :--- | :--- |
| **Document Type** | API Specification & Flow Reference |
| **Service** | Stateless TOTP Engine |
| **System** | NSDLMA / OXYMONEY Authentication Platform |
| **Last Updated** | 2026-06-03 |
| **Status** | 🟢 Production Active |

---

# ⚙️ Architecture & Logic Overview

> ℹ️ **Design Philosophy**
> The service is designed to be **fully stateless** to support horizontal scaling across multi-container clusters. Rather than maintaining active OTP codes in database records, all parameters and timestamps are encrypted/signed in client-side tokens.
> 
> * **Master Key Deterministic Secrets**: Secrets are compiled as `HMAC(TOTP_MASTER_KEY, identityKey + params)`.
> * **Multi-Channel Delivery**: Generates a unified `identityKey` combining `mobileNumber` and/or `email`. 
> * **Redis Locking & Fallbacks**: Locks transaction channels dynamically. If Redis is down, it uses local `node-cache` cache storage and syncs back once Redis connectivity is restored.
> * **Blocking Notification Checks**: Halts token generation if any channel in the notification dashboard fails.
> * **Session-Level Replay Prevention**: When an OTP is validated, the logical session (`identityKey:params`) is marked as consumed — blocking ALL tokens for that session, not just the specific one used.
> * **Email Injection Prevention**: The `/resend-otp` endpoint strictly uses contact channels embedded in the HMAC-signed token. Any email/mobile provided in the resend body is ignored.

---

# 📌 Base URL Reference

| Environment | Base URL |
|---|---|
| **Local** | `http://localhost:8080` |
| **Staging** | *(To be provided)* |
| **UAT** | *(To be provided)* |
| **Production** | *(To be provided)* |

---

# 🏁 API Status Code Meanings
* **`0`**: Successful execution
* **`-1`**: Input Validation or System Execution Error

---

# 1️⃣ Heartbeat Check

> ℹ️ **API Overview**
> Checks if the microservice is running and returns basic system details.

* **Method:** `GET`
* **Full URL:** `{{baseUrl}}/NSDLMA/otp-service/HbtChk`

#### 📤 Success Response (HTTP 200)
```json
{
  "status": "UP",
  "timestamp": "2026-06-03T10:00:00.000Z",
  "service": "totp-service",
  "version": "2.0.0"
}
```

---

# 2️⃣ Request OTP

> ℹ️ **API Overview**
> Generates a stateless OTP for the given identity (mobile and/or email) and sends the verification notification.

* **Method:** `POST`
* **Full URL:** `{{baseUrl}}/NSDLMA/otp-service/sms/request-otp`
* **Content-Type:** `application/json`

### 📥 Request Body

<details>
<summary><b>▶ Click to view Request JSON Schema</b></summary>

```json
{
  "user_name": "john_doe",
  "mobileNumber": "9876543210",
  "email": "john_doe@example.com",
  "params": "txn123456abcd",
  "bankCode": "IDBI",
  "feature": "LOGIN",
  "operationPerformed": "OTP_VERIFICATION",
  "messageData": {
    "template": "otp_sms"
  },
  "status": "SUCCESS"
}
```
</details>

### 📌 Validation Rules

| Field | Requirement | Description |
| :--- | :--- | :--- |
| `user_name` | String (Required) | Triggering operator username |
| `mobileNumber` | String (Optional) | Must match `^[6-9]\d{9}$`. |
| `email` | String (Optional) | Valid email format string. |
| **Identity Check** | Validation Constraint | **Either `mobileNumber` or `email` must be provided.** |
| `params` | String (Required) | Custom payload identifier (10 to 150 chars). |
| `bankCode` | String (Optional) | Bank ID (sets expiry: `IDBI` = 5min, `SBI` = 3min, Default = 2min). |
| `messageData` | Object (Required) | Message payload structure. |

### 📤 Responses

#### Success (HTTP 200)
<details>
<summary><b>▶ Click to view Success JSON</b></summary>

```json
{
  "status": 0,
  "success": true,
  "displayMessage": "OTP sent successfully. (Dev mode: 382910 is your OTP)",
  "requestToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
</details>

#### Failure — Channel is Locked (HTTP 400)
<details>
<summary><b>▶ Click to view Error JSON</b></summary>

```json
{
  "status": -1,
  "success": false,
  "displayMessage": "OTP already sent for this mobile number with the same params. Use a unique params value or resend the existing OTP.",
  "err_type": "ValidationError"
}
```
</details>

#### Failure — Notification Failure (HTTP 500)
<details>
<summary><b>▶ Click to view Error JSON</b></summary>

```json
{
  "status": -1,
  "success": false,
  "displayMessage": "Failed to deliver OTP via: SMS. Please retry with new params.",
  "err_type": "ValidationError"
}
```
</details>

---

# 3️⃣ Resend OTP

> ℹ️ **API Overview**
> Re-triggers the OTP send operation using the existing token. Validity timer is reset and a new `requestToken` is generated. **Contact channels are strictly taken from the token — no email override is allowed.**

* **Method:** `POST`
* **Full URL:** `{{baseUrl}}/NSDLMA/otp-service/sms/resend-otp`
* **Content-Type:** `application/json`

### 📥 Request Body

<details>
<summary><b>▶ Click to view Request JSON Schema</b></summary>

```json
{
  "requestToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk4NzY1NDMyMTA...",
  "messageData": {
    "template": "otp_sms"
  }
}
```
</details>

### 📤 Success Response (HTTP 200)
<details>
<summary><b>▶ Click to view Success JSON</b></summary>

```json
{
  "status": 0,
  "success": true,
  "displayMessage": "OTP resent successfully. (Dev mode: 482910 is your OTP)",
  "requestToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk4NzY1NDMyMTA..."
}
```
</details>

---

# 4️⃣ Validate OTP

> ℹ️ **API Overview**
> Validates the OTP code against the payload embedded in the token. Marks the **session** (`identityKey:params`) as consumed upon verification success — blocking ALL tokens for this session.

* **Method:** `POST`
* **Full URL:** `{{baseUrl}}/NSDLMA/otp-service/sms/validate-otp`
* **Content-Type:** `application/json`

### 📥 Request Body

<details>
<summary><b>▶ Click to view Request JSON Schema</b></summary>

```json
{
  "requestToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijk4NzY1NDMyMTA...",
  "otp": "482910"
}
```
</details>

### 📤 Responses

#### Success (HTTP 200)
<details>
<summary><b>▶ Click to view Success JSON</b></summary>

```json
{
  "status": 0,
  "success": true,
  "displayMessage": "OTP validated successfully",
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
</details>

#### Failure — Token Expired (HTTP 400)
<details>
<summary><b>▶ Click to view Error JSON</b></summary>

```json
{
  "status": -1,
  "success": false,
  "displayMessage": "OTP has expired. Please request a new OTP.",
  "err_type": "ValidationError"
}
```
</details>

#### Failure — Replay Attempt (HTTP 400)
<details>
<summary><b>▶ Click to view Error JSON</b></summary>

```json
{
  "status": -1,
  "success": false,
  "displayMessage": "This OTP has already been validated. Please request a new OTP.",
  "err_type": "ValidationError"
}
```
</details>

---

# 5️⃣ Verify Session

> ℹ️ **API Overview**
> Verifies the validity and expiration status of a `sessionToken` returned after a successful OTP validation.

* **Method:** `POST`
* **Full URL:** `{{baseUrl}}/NSDLMA/otp-service/sms/verify-session`
* **Content-Type:** `application/json`

### 📥 Request Body

<details>
<summary><b>▶ Click to view Request JSON Schema</b></summary>

```json
{
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
</details>

### 📤 Success Response (HTTP 200)
<details>
<summary><b>▶ Click to view Success JSON</b></summary>

```json
{
  "status": 0,
  "success": true,
  "displayMessage": "Session verified successfully",
  "message": "Session verified successfully",
  "data": {
    "identityKey": "9876543210:john_doe@example.com",
    "mobileNumber": "9876543210",
    "email": "john_doe@example.com",
    "params": "txn123456abcd",
    "bankCode": "IDBI",
    "timestamp": 1718294447290
  }
}
```
</details>

---

# 🧪 Step-by-Step Testing Runbook

> 🔄 **OTP Onboarding Lifecycle Testing Flow**
> 
> Follow this sequential process to verify client state transfers:
> 
> 1. **Run Heartbeat**: Verify connectivity by issuing `GET /NSDLMA/otp-service/HbtChk`.
> 2. **Request Token Generation**: Call `POST /NSDLMA/otp-service/sms/request-otp`. Look for the `"requestToken"` and `"Dev mode: XXXXXX is your OTP"` inside the return `"displayMessage"`.
> 3. **Verify Re-Submission Lock**: Immediately repeat step 2. Confirm the server returns a `400` indicating the transaction is locked.
> 4. **Resend Token Check**: Call `POST /NSDLMA/otp-service/sms/resend-otp` using the `"requestToken"` received in Step 2. Verify you get a new `"requestToken"`.
> 5. **Successful Verification**: Submit `POST /NSDLMA/otp-service/sms/validate-otp` using the new token and OTP. Verify it returns a `"sessionToken"`.
> 6. **Replay Rejection**: Immediately call step 5 again. Confirm the server throws `This OTP has already been validated`.
> 7. **Session-Level Replay**: Try validating with the OLD token from step 2. Confirm it also fails — session-level consumption blocks all tokens.
> 8. **Decryption Check**: Submit `POST /NSDLMA/otp-service/sms/verify-session` with the `"sessionToken"`. Verify the output matches the original inputs.
