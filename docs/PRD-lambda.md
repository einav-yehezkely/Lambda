# Product Overview

Lambda is a community-driven learning platform for university students,
primarily focused on Computer Science and Mathematics courses.

The platform enables students to:

\- Study structured course material

\- Practice exam questions

\- Practice coding problems

\- Learn and review mathematical proofs

\- Track learning progress

\- Contribute content to shared course repositories

\- Create updated versions of courses for different years or
institutions

The system launches first as a web application but must be architected
to support future mobile applications (iOS and Android).

Therefore:

• Backend must expose clean APIs

• Business logic must live in the backend

• Frontend must remain decoupled

# Goals

Primary goals:

1\. Provide structured study environments for university courses.

2\. Enable students to practice proofs, exam questions, and coding
problems.

3\. Build a community-maintained repository of course material.

4\. Allow courses to evolve across academic years using versioning.

5\. Encourage student contributions.

6\. Provide a foundation that scales to a mobile application.

# Target Users

Primary users:

• Undergraduate Computer Science students

• Mathematics students

Example courses:

Calculus, Linear Algebra, Algorithms, Data Structures,

Operating Systems, Discrete mathematics, Machine Learning, C/C++.

Secondary users:

• Students contributing content

• Community maintainers improving course versions

# Core Product Concepts

Course Template

Represents the abstract course (e.g., Algorithms, Linear Algebra).

Course Version

Represents a specific version of a course:

Algorithms --- HUJI --- 2025

Algorithms --- MIT --- 2024

Versions can be based on previous versions, forming a version tree
similar to Git.

Content Types (MVP):

1\. Proof -- theorem statements and proofs

2\. Exam Question -- theoretical or mathematical problems

3\. Coding Question -- programming problems

# Key Features (MVP)

Course Discovery

Users browse courses by subject, institution, popularity, or recent
updates.

Course Page

Displays overview, versions, topics, and practice options.

Course Versions

Shows recommended version, official version, and community versions.

Version Creation

Users can fork an existing version and create a new one.

Content Management

Users can add proofs, exam questions, and coding questions.

Practice Mode

Users practice proofs, exam questions, coding questions, or mixed
practice.

Progress Tracking

Track solved, incorrect, and needs-review statuses.

# Mathematical Writing Support

The platform must support writing mathematical expressions using LaTeX syntax.

Users should be able to:

- write inline equations
- write block equations
- preview rendered math
- use a math keyboard for common symbols

Recommended implementation:

Editor:
• MathLive

Rendering:
• KaTeX

Storage:
• LaTeX strings stored in the database

# Community Contributions

Users can contribute:

• exam questions

• solutions

• proof explanations

• new course versions

• new courses

User profiles track contributions such as:

questions added

solutions added

versions created

Future features may include contributor badges and leaderboards.

# Content Moderation

Because the platform allows community contributions, mechanisms must exist
to maintain content quality.

Possible mechanisms:

• voting on answers
• reporting incorrect content
• trusted contributors
• version moderation
• community review

# Course Versioning

Users may create new versions of existing courses.

Each version references:

based_on_version_id

This allows a Git-like structure of course evolution.

Versions may represent:

• different universities
• different academic years
• improved community versions

## Fork Behavior

When a user forks an existing version, the following happens:

Topics — copied (new rows):
• Each topic from the source version gets a new row with a new ID, pointing to the new version.
• Topics are version-specific. A version owns its own topic list.

Content items — referenced (not copied):
• Content items are shared across versions. The same content_item row can appear in many versions.
• Membership is tracked via a junction table:

  version_content_items (version_id, content_item_id, topic_id)

  - version_id: the version that includes this item
  - content_item_id: the shared content item
  - topic_id: which topic (in THIS version) this item is assigned to

When forking version A into version B:
• New topic rows are created for B (copies of A's topics, with new IDs).
• Junction rows are copied: for each (version_id=A, item=X, topic=T_A),
  a new row is inserted: (version_id=B, item=X, topic=T_B)
  where T_B is the newly created copy of T_A.
• Content items themselves are not duplicated.
• Adding a new item to B creates a new content_item row + a new junction row.
• Removing an item from B deletes only the junction row — the item remains intact.

This means:
• content_items do NOT have a version_id or topic_id foreign key.
• topic_id on content_items would be ambiguous across versions.
• The junction table is the single source of truth for "what is in a version, and under which topic".

# Practice Engine

The platform should support multiple practice modes:

• random questions
• topic-based practice
• exam simulation
• spaced repetition

# Future AI Features (Optional)

AI may assist with:

• generating practice questions

• summarizing proofs

• generating proof steps

• generating flashcards

AI features should be implemented as modular backend services.

# System Architecture Requirements

Architecture must support a future mobile application.

Backend must expose REST APIs.

Frontend must not contain core business logic.

Recommended architecture:

Frontend (Web)

↓

Backend API

↓

Database

# Technology Recommendations

Frontend:

• Next.js

• React

• TypeScript

• Tailwind CSS for UI styling

• React Query / TanStack Query for data fetching and caching

Backend:

• Node.js

• Express or NestJS

Database:

• PostgreSQL (via Supabase)

Authentication:

Primary authentication method:

• Google OAuth (Sign in with Google)

Implementation options:

• Supabase Auth with Google OAuth

• OAuth 2.0 with Google Identity Services

Session handling:

• JWT-based sessions

Future support:

• Additional OAuth providers (GitHub, Apple)

• Email authentication if needed

# Database Schema (Initial)

Users
id, email, username, created_at

CourseTemplates
id, title, subject, description

CourseVersions
id, template_id, title, year, author_id, based_on_version_id, visibility

Topics
id, version_id, title, order

ContentItems
id, type, title, content, solution, difficulty, created_at, author_id
(no version_id, no topic_id — membership is tracked via the junction table)

Topics
id, version_id, title, order
(version-specific; copied as new rows on fork)

VersionContentItems  ← junction table
version_id, content_item_id, topic_id
(topic_id references the topic within THIS version; copied on fork with updated topic IDs)

UserProgress
id, user_id, content_item_id, status, last_attempt_at

Attempts
id, user_id, content_item_id, answer, is_correct, created_at

# UI Pages (MVP)

Home Page

Displays search, popular courses, and recently updated courses.

Course Page

Displays overview, versions, and topics.

Version Page

Displays proofs, exam questions, and coding questions.

Practice Page

Displays questions, solutions, and difficulty marking.

# Scalability Considerations

System should support:

• thousands of course versions

• large content libraries

• community contributions

Design principles:

• modular services

• normalized database schema

• scalable API layer

# Security Considerations

• prevent unauthorized editing of versions

• users may only edit their own versions

• sanitize and validate user input

# Metrics for Success

Key metrics:

• active users

• course versions created

• questions practiced

• contributions added

# Future Mobile Application

The system must be designed so that a mobile app can be built later
without major refactoring.

Requirements:

• API-first architecture

• stateless backend

• authentication compatible with mobile clients

Possible mobile frameworks:

• React Native

• Flutter

• Native iOS / Android
