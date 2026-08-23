# DEMO.md — Student EI Platform Demo, Functional Reference

**What this is:** the screen-by-screen reference for `index.html` as built. A new Claude session (or any developer) reads this plus `STATUS.md` at the client root before changing anything.

**Revision Round 1 in progress (2026-08-22, register: `Working Files/StudentEI_Change Register R1 v2 - 2026-08-22_GM.md`).** CP1 (foundation) and CP2 (IA restructure) are committed: "Skills Builder" terminology, no at-risk/absenteeism/career content anywhere, new logo, MAV input at top, Oct 2026 cycle, new GP/credential/GPA data model; sidebar reduced to Students / Credentials / Benchmarks / Console; Assessments, Surveys, Frameworks, Graduate Profile tabs DELETED (routes redirect to Home); all career/survey/framework content and MAV career prompts removed permanently (roster `vertical` field stripped); My Interests deleted from the student experience; Home rebuilt (trend + GP modules); Console rebuilt (Assessment Management + Resources & Research + Platform Tutorial Videos stubs; Survey/Credential Creator tiles deleted); New Chat and Chats re-scripted. All checkpoints are committed and the demo document set is revved to **v9** (2026-08-22): Demo Script v9 (Prototype/), Prototype Requirements v9 (Requirements/), Demo Screens v9 (Design & Mockups/). Round 1 is complete pending GM review and push.

**Maintenance rule:** update this file **in the same commit** as any demo change. If a screen, route, MAV prompt, or behavior changes and this file doesn't, the commit isn't done.

**Read order for a new session:** client `CLAUDE.md` → client `STATUS.md` (invariants, standing directives, current state) → this file → the code sections you're changing.

---

## 1. Architecture

- **Single self-contained file:** `index.html` (~300KB). All CSS, JS, data, and the Student EI logo (data URI) inline. No build step, no dependencies, works from `file://` and Cloudflare Pages.
- **Hash router:** `location.hash` → `currentRoute()` → `render()` looks up `ROUTES[name]`, calls the view function, injects into `#view`, then wires events via `wireView()` + `wireStudentViews()`. Sub-routes use a second segment (`#/student/4`, `#/surveys/healthcare`, `#/assessments/samples`, `#/credentials/checkin`, `#/benchmarks/0`, `#/console/users`).
- **Login-first:** no hash or `#/signon` shows the sign-on overlay; nothing renders until a persona signs in. Sign out returns to sign-on.
- **Deterministic and front-end only:** every number, list, and MAV answer is scripted or derived from the inline data. No network calls.
- **Deploy:** git push to `main` → GitHub `gmillertime88/student-ei-platform-demo` → Cloudflare Pages behind Cloudflare Access. Runbook: `Cloudflare-GitHub-Deploy-Cheat-Sheet.md`.

## 2. Roles and access

Four personas, chosen on the sign-on screen (`ROLES`, `applyRole()`):

| Persona | Role | Sees | Console | Notes |
|---|---|---|---|---|
| Dr. Dana Whitfield | Superintendent | All 24 roster students, all screens | Full | No banner |
| Michael Grant | Principal, Jasper HS | Jasper HS students only | Full | Permission banner; Jasper MS records hidden |
| James Petrillo | CTE Teacher | 6 CTE students (ids 3,4,6,10,12,14) | None | Banner; district totals stay visible as aggregates |
| Sofia Nguyen | Student, Class of 2028 | Her own record only (id 4) | None | Student experience only (section 4) |

- **Hidden records are fully hidden** with count-only disclosure; a direct link to a restricted `#/student/{id}` shows a lock screen (deliberate REQ-F-014 deviation).
- **Role guards:** `STUDENT_ROUTES` set boxes the student persona into the student routes and boxes staff out of them. Console requires `console: "full"`.
- Sign-on also carries the student registration entry point ("New student? Create your account" → `#/student-register`).

## 3. District screens

| Route | Screen | What it shows / does |
|---|---|---|
| `#/home` | District Overview | 4 metric tiles (Total Students 1,284 w/ 1,168 Verified · Assessment Completion 91% · Graduate Profile Alignment 68% · Credential Points Awarded 318,540); **Competency Trend module** (`homeTrend()` — Tyler-spec line widths 40/60/30/80/50, nothing at line ends, range columns Developing→Mastering, cycle chips Current/May 2026/Oct 2025/May 2025 overlay newest-on-top, per-class chips, per-row "Show all 4", i-icon definitions; state `trendCycles`/`trendYear`/`trendRowAll`); **Graduate Profile module** (`homeGradProfile()` — `GP_DIST` 5 green + 3 blue district-added, 68% overall, callouts: Class of 2029 growth + Competency for District Review = lowest of the 8); Recent Skills Builders list; Current Assessment Cycle (October 2026, 91%); Explore Modules tiles (Students/Credentials/Benchmarks/Console) |
| `#/new-chat` | New Chat | MAV chat page with suggestion cards; results open in the content area |
| `#/chats` | Chats | MAV conversation history; selecting one replays its prompts against current data |
| `#/students` | Students | Directory (24-row sample of 1,284). Filter bar (R1 D1): Search · Status (**Active default**; Pending/Archived/All) · Grad Year · School · **Assessment date** (Oct 2026 default; past cycles shift Skills/Proficiency via `scoresFor`) · Skills · Proficiency · **Credentials** (top-tally competency) · **Graduate Profile** (All or one of 8 — switches the GP column to that competency) · sort · Clear all. "Create Benchmark" button opens the Lite dialog (`cbOpen`) pre-filled from active filters; Save appends a session-only row to `BENCHMARKS` with a criteria snapshot. Columns: Name · Grad Year · School · Skills · Credentials (top tally x/500) · Graduate Profile % |
| `#/student/{id}` | Student Dashboard (staff view) | R1 E1/E3 rebuild: identity head + assessment hint; **header card** with GPA (`gpaOf`) · Credential Tallies (5 × x/500, goal 375) · Graduate Profile Alignment (8 comps, district-added shown blue, goal 75%); Skills Summary Report with **cycle chips** (Current/May 2026/Oct 2025/May 2025 — `stuCycle` shifts bars via `scoresFor`); right column: Progress-of-district-goal ring (`gpOverall` vs 75%) + Credential Progress (top tally). Career content removed. MAV chips (E4, GM-approved drafts): summarize growth / greatest opportunity for growth / on track for Portrait of a Graduate — the latter two are new dynamic scripts. Insights use Tyler's GP-based wording. Restricted ids → lock screen |
| ~~`#/assessments`~~ | DELETED (R1) | Trend moved to Home; library moved to `#/console/assessments`; sample-questions route deleted (instrument demoed student-side). Route redirects to Home |
| ~~`#/surveys`~~ | DELETED (R1) | All career/vertical/job/interest content removed permanently. Route redirects to Home |
| `#/credentials` | Credentials (district) | R1 F1/F2 rebuild: 3 stat boxes (kept) · points by competency share · points per cycle · Recent Skills Builders · **Skills Builder Library** (`SB_LIBRARY`, tabs `sbTab`: English / Math / Social Studies / Sciences / CTE / Other / My Library). English + Sciences carry Tyler's Credential QA doc verbatim (summary, 10 cliff notes, 5 questions with 2/1/0/0 points); the other four subjects are PT-authored and badge "Draft — for Student EI review". Entries expand (`sbOpen`) to teacher view. Student credential table DELETED (student data lives on the Students page). "Create Skills Builder" button → the 4-step flow |
| `#/credentials/checkin` | Create Skills Builder | The former Teacher Check-in 4-step flow, renamed (F2b): classroom activity → MAV summary → questions → single-use share link |
| `#/benchmarks` | Benchmarks | R1 G1 rebuild — Tyler's six examples with district-wide counts: PofG-Self-management-Advancing (344, Whitfield) · PofG-Teamwork (496, Grant) · PofG-Creativity (813, Petrillo) · PofG-Adaptability (742, Whitfield) · PofG-Communication (628, Okonkwo) · CTE-Health Services (193, Petrillo — description verbatim from Tyler's Credential QA doc). "Create Benchmark" routes to the Students dialog. Session saves from the dialog/MAV append rows |
| `#/benchmarks/{i}` | Benchmark detail | All six clickable (G2): About card + share/PDF affordances + student table mirroring the Students-tab columns (Skills / Credentials / GP), names → staff snapshot. MAV explains the open benchmark in Tyler's template ("This benchmark includes N students … created by … with access available to …") (G3) |
| ~~`#/frameworks`~~ | DELETED (R1) | Route redirects to Home |
| ~~`#/graduate-profile`~~ | DELETED (R1) | Content now lives in the Home Graduate Profile module. Route redirects to Home |
| `#/console` | Console | Tool tiles: User Management · SIS Integration · Assessment Management · Resources & Research · Platform Tutorial Videos · AI Help Desk |
| `#/console/users` | User Management | Staff access + invitations (1 pending: James Petrillo) |
| `#/console/assessments` | Assessment Management | Create-new (cycle select + generate link, `amGen` state) + assessment library from `ASSESS_LIST` (one live link) |
| `#/console/resources` | Resources & Research | Stub — white papers/case studies/research rows |
| `#/console/tutorials` | Platform Tutorial Videos | Stub — Assessments/Credentials/Benchmarks video tiles |
| `#/sis` | SIS Integration | Clever connected (nightly roster sync, 1,284 students / 2 schools); ClassLink available, not connected |

## 4. Student experience (added 2026-08-07, Tyler flow doc)

Entry paths: (a) "Create your account" on sign-on → registration → Welcome → assessment; (b) Sofia sign-in → `#/my-dashboard` hub. **MAV panel is VISIBLE for the student persona at staff depth** (R1 J2 per GM): student prompt scripts (`what do i need to do next?` · `how close am i to the credential goal?` (dynamic) · `how do i earn more credential points?` · `what does my portrait of a graduate alignment mean?` · the summer-experience feedback prompt), per-route chips/insights on every student route, and the **New Chat / Chats tabs shown to students** (`SHARED_ROUTES`; role-aware cards via `chatsFor()` / student card set in `viewNewChat`). **My Interests deleted in R1.**

| Route | Screen | What it shows / does |
|---|---|---|
| `#/student-register` | Registration overlay (pre-auth) | 3 steps: Getting Started (name/district email/grad year, district-link chip, "only your district email is eligible") → Almost Complete (verify-email inbox preview, VERIFY EMAIL) → Create Password (live checklist: 8 chars / number / uppercase; demo autofill link). Finish authenticates as Sofia → Welcome |
| `#/student-welcome` | Welcome to Student EI | Tyler's onboarding copy, 2-minute video placeholder, Next → begins the questions |
| `#/student-assessment` | Durable Skills Questions | 3 sections framed 32-30-30; three formats: Likert (6-option "Thinking about myself I tend to be: [word]"), most/least paired choice (click-to-tag, Clear button), situational judgment (scenario + statement + 5-option likelihood). Three-line no-numbers progress bar; stop-sign break screens after sections 1 and 2 ("Ask your teacher…", Save-and-finish-later); **no back button**; Next disabled until answered; congratulations screen → "My Dashboard" button lands on My Durable Skills. Demo-only jump links (Section 2 / Section 3 / Congratulations). Resume-where-left-off: Sofia's October 2026 cycle sits mid-Section 1; state in `saState` |
| `#/my-dashboard` | Student hub | R1 J2 rebuild: `sdHeadCard()` mirrors the staff header — profile + GPA (`gpaOf`), Credential Tallies (`stuTally` = `SOFIA_CRED` + Skills Builder bonus), 50%-of-GP-goal ring, Graduate Profile Alignment (8 comps, extras blue); 3 tab cards (Durable Skills / Credentials / Feedback); continue-assessment CTA and the **Skills Builder queue banner** (Ms. Jones — Chemistry Lab) at the **bottom** |
| `#/my-durable-skills` | My Durable Skills | R1 J3 rebuild: header card; cycle dropdown (May 2026 / October 2025 via `SD_DATA`); range-column layout with **Tyler-spec green lines 40/60/30/80/50, nothing at line ends**; per-row "You are [Range] in [Competency]" statements with Tyler's slide-51 definitions (`SD_STATEMENT_DEFS`); i-icons open COMP_INFO panels |
| `#/my-credentials` | My Credentials | R1 J4 rebuild: **Skills Builder queue** — Ms. Jones Chemistry Lab, the full 5-question Sciences set from `SB_LIBRARY` (`sbq*` state; each answer awards option-points ×2 with a "Nice job! +N" toast; sub-skills roll up via `SKILL_PARENT`; all-A run = +20: SM +8, TW +4, CO +4, AD +4); completion banner "Skills Builder Science complete… in real time"; "How credentials work" explainer; 5 per-competency cards showing `stuTally` x/500 with the 375 goal; **Skills Builder History** (`SB_HISTORY` + the completed chemistry row); badge "1" clears on completion |
| `#/my-feedback` | My Feedback | R1 J5 rebuild per slide 57: "Share feedback that helps you grow" hero; three cards (Your summer / Your activities / Feedback from others — Tyler's copy); scripted MAV conversation demo (lifeguard exchange). **Mic/voice removed entirely** |

## 5. MAV (scripted assistant)

Split-screen right panel for staff (context line, insights, chips, input). Hidden for the student persona. 20 scripted prompts (`MAV_SCRIPTS`, keyed on the lowercased prompt), most navigate after replying:

`which competency needs the most attention?` · `show me the class of 2028 with emerging communication` (filters Students) · `show all students with greater than 50% alignment to our portrait of a graduate` (gpMin filter) · `clear all filters` · `overlay the last three assessments` · `show the class of 2027 only` · `who's interested in nursing careers?` (opens Healthcare/RN) · `show me the healthcare vertical` (+ legacy "health care" alias) · `tell me about the registered nurse pathway` · `tell me about the physical therapist pathway` · `show me the frameworks library` · `how aligned are we to our graduate profile?` · `is our sis connected?` · `invite a new staff member` · `save students excelling in teamwork as a portrait of a graduate benchmark` · `show our portrait of a graduate teamwork benchmark` · `which students are past the credential goal?` · `start a skills builder` · `summarize this student's growth` (dynamic — needs a student dashboard open)

New R1 scripts: `can you show me the students who have been rostered but haven't verified yet?` (Pending filter) · `show me the students who align with the district goal in teamwork.` · `can you show me the sub-skills for self-management?` · `show me students benchmarked as developing in adaptability.` · `show me all users with district admin permissions.` (opens User Management) · `show me students meeting the district portrait of a graduate standards for communication` · `show me an example of a credentialing skills builder in a multiple-choice format for a chemistry class`. All career scripts and the dynamic `[job] pathway` matcher are removed. Anything unmatched gets `MAV_FALLBACK`. Per-route chips and insights live in the `ROUTES` table.

## 6. Data model (invariants live in STATUS.md — that list wins)

- `STUDENTS`: 24-row roster `[first, last, gradYear, school, [SM,TW,CR,AD,CO], credPts, status, gated]` — the career `vertical` field was stripped in R1. Sofia Nguyen id 4, scores [63,67,59,61,62], 240 pts. Statuses: Active (22), Pending (Caleb Foster, Aiden Thompson).
- `COMPS`: Self-Management, Teamwork, Creativity, Adaptability, Communication. 5 proficiency ranges: Developing, Emerging, Advancing, Excelling, Mastering.
- **Portrait of a Graduate (R1):** `GP_COMPS` = COMPS + `GP_EXTRA` (Critical Thinking, Empowered Learner, Global Citizen — district-added, display blue). `gpOf(s, comp)` = per-student alignment % (Sofia fixed: 48/26/65/18/44/60/88/48; others deterministic, clamped 18–88); `gpOverall(s)`; `GP_GOAL` = 75.
- **Credential tallies (R1):** `credTally(s, comp)` = per-competency x/500 (Sofia fixed: SM 240 / TW 130 / CR 325 / AD 90 / CO 220; others derived from credPts + scores). `credTop(s)`. Invariant: exactly 4 students (Chen, Okafor, Lindqvist, Desai) have a tally ≥ `CRED_GOAL` 375.
- **GPA (R1):** `gpaOf(s)` = 4 course/grade pairs by grad year (Sofia fixed: Algebra 87, Global 11 85, Chemistry 88, English 11 93).
- **Cycles (R1):** `PERIODS` = Oct 2026 (current, live, 91% = 1,168 of 1,284), May 2026, Oct 2025, May 2025. `AGG_BASE` = Oct 2026 values; May-2026 figures now sit one `PERIOD_ADJ` step down.
- `VERTICALS` deleted in R1 — no career data remains. `GP_DIST` (home module): SM 70 / TW 74 / CR 58 / AD 65 / CO 76 green + Critical Thinking 62 / Empowered Learner 71 / Global Citizen 67 blue; `GP_CLASS_LOW` = Class of 2029, 54%.
- `AGG_BASE`: district competency averages by year; May-2026 "All" = 72/74/61/66/77; district goal 75.
- Credentials: 500-point scale, 375 district goal. Student-side legacy share view still uses `CRED_SHARES` until CP7; staff-side derived tallies use `credTally` (R1).
- Naming: "Portrait of a Graduate" always spelled out; MAV icon is the north star (no sparkle); no "Generated by MAV" credit lines.
- Design: `DESIGN.md` at client root — primary `#2667AA`, navy `#1A1A2E`, teal `#0097A3`, Inter; progress bars only, no radar/donut/spider; split-screen MAV panel for staff.

## 7. Changing the demo

1. Read `STATUS.md` (standing directives + invariants) and this file.
2. Back up `index.html` to the project `Archive/` before a significant change (standing rule 11).
3. Edit via Python patch scripts with exact-count asserts — template in `qa/patch_template.py`.
4. QA: `node --check` the extracted script, then run `qa/qa.js` (see `qa/README.md`). Add checks for new behaviors; keep the hidden-student leak check and staff regression green.
5. Update this file and `STATUS.md`, commit, push `main` (or a preview branch) per the cheat sheet.

*Created 2026-08-07 by Claude as ProactiveTech GM. Reflects the demo as of the student experience build.*
