# Product Requirements Document (PRD)

## Admin-Governed Content System

---

## 1. Overview

### Objective

Build a platform where:

- Any user can contribute content
- No content becomes public without admin approval

### Core Principles

- Open contribution (low friction)
- Strict publication control (high quality)
- Centralized admin management

---

## 2. Key Principles

### 2.1 Course Creation Control

- Users cannot create courses directly
- Users must submit a **course request**
- Only admin can approve and create courses

### 2.2 Version Publishing Control

- All versions start as `Draft`
- Only admin can publish versions

### 2.3 Admin Authority

Admin controls all public-facing content:

- Course creation
- Version publishing
- Content moderation

### 2.4 Open Contribution Model

Any logged-in user can:

- Request a course
- Create draft versions
- Submit versions for review

---

## 3. User Capabilities

### 3.1 Request New Course

- Button: **"Request New Course"**
- Opens submission form

### 3.2 Create New Version

For existing courses:

- Create version
- Edit content
- Save as draft
- Submit for review

### 3.3 Manage Contributions

User dashboard includes:

- Drafts
- Under Review
- Published
- Changes Requested
- Rejected
- Course Requests

---

## 4. Course Request Flow

### Step 1 — Submission

Form fields:

- Course name
- Description
- University
- Additional notes

### Step 2 — System Handling

- Stored in system
- Appears in admin panel
- Email sent to admin
- Confirmation sent to user

### Step 3 — Admin Review

Admin can:

- Approve
- Reject
- Request clarification
- Mark as duplicate
- Reply to user

### Step 4 — User Notification

- Approval → course created
- Rejection → reason sent

---

## 5. Version Flow

### Step 1 — Draft Creation

- User clicks **"New Version"**
- Version starts as `Draft`

### Step 2 — Editing

- User builds content

### Step 3 — Submission

- Click **"Submit for Review"**
- Status → `Submitted`
- Admin notified via email

### Step 4 — Admin Review

Admin can:

- View full content
- Add comments
- Request changes
- Approve (Publish)
- Reject

### Step 5 — Outcome

- Approved → Published
- Changes requested → editable again
- Rejected → closed with reason

---

## 6. Status System

### Course Requests

- Pending
- Approved
- Rejected
- Needs clarification
- Merged
- Closed

### Versions

- Draft
- Submitted
- Changes requested
- Published
- Rejected
- Archived

---

## 7. User Experience

### Course Page

- If missing → show “Request Course”
- If exists:
  - Show public versions
  - Allow new version creation

### User Dashboard

Sections:

- My Drafts
- Under Review
- Published
- Rejected
- Course Requests

### Version Page (Non-Public)

Displays:

- Status
- Submission date
- Admin feedback

---

## 8. Admin Panel (Restricted)

### Purpose

Central hub for:

- Reviewing
- Approving
- Communicating
- Tracking

---

### 8.1 Dashboard

- Pending course requests count
- Pending versions count
- Items needing changes
- Open reports
- Recent activity

---

### 8.2 Course Requests Tab

Displays:

- List of requests
- Status, date

Actions:

- Approve
- Reject
- Reply
- Mark duplicate
- Request clarification

---

### 8.3 Version Review Queue

Displays:

- Course name
- Version name
- Creator
- Submission date
- Status

Actions:

- Publish
- Request changes
- Reject
- Reply

---

### 8.4 Communication Center

- All admin-user conversations
- Open requests tracking
- Full history

---

### 8.5 Search & Filters

- By course / user / version
- By status
- By date
- By type
- Sort by priority / recency

---

### 8.6 Detailed View

Includes:

- Full content
- Status history
- Comments
- Actions

---

## 9. Admin Communication System

Features:

- Threaded comments per request/version
- Admin can:
  - Ask for info
  - Explain decisions
  - Request changes

User:

- Sees messages in dashboard
- Receives email notifications
- Can reply

---

## 10. Email System

### Admin Notifications

- New course requests
- New version submissions
- Reports

### User Notifications

- Status updates
- Admin feedback

### Email Content

- What happened
- Relevant item (course/version)
- Status
- Admin message
- Link back to platform

---

## 11. Revision Workflow

### Flow

1. Admin selects **Request Changes**
2. Adds comments
3. User receives notification
4. Version becomes editable
5. User resubmits

### Requirements

- Clear feedback section
- Resubmission flow
- History of iterations

---

## 12. Updating Published Versions

Rule:

- Published versions cannot be edited directly

Instead:

- Create new draft update
- Submit for review
- Replace only after approval

---

## 13. Additional Admin Features

### 13.1 History Tracking

For every item:

- Submission date
- Status changes
- Admin actions
- Comments

### 13.2 Internal Notes

- Admin-only comments
- Separate from user-facing messages

---

## 14. Reporting System

Users can report:

- Incorrect content
- Spam
- Offensive content
- Copyright issues

### Admin Actions

- Keep public
- Hide temporarily
- Remove
- Contact creator

---

## 15. UX Principles

### For Users

Avoid blocking messages like:

- “No permission”

Instead show:

- “Request a course”
- “Submit version for review”
- “Waiting for approval”
- “Changes requested”

### For Admin

- Fast review flow
- Clear priorities
- Centralized control
- Minimal navigation

---

## 16. System Summary

- Courses are created only via admin approval
- Versions must be approved before publishing
- All contributions are allowed as drafts
- Admin panel centralizes all operations
- Communication + email integrated
- Full tracking and moderation support
