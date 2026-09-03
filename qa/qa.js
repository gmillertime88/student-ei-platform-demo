const { chromium } = require("playwright");
const path = require("path");

// Target file: qa/../index.html by default; override with DEMO_FILE=/path/to/index.html
// Chromium: playwright's own install by default; override with CHROME_PATH=/path/to/chrome
const DEMO_FILE = process.env.DEMO_FILE || path.join(__dirname, "..", "index.html");

const FAIL = [];
function check(name, cond) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (!cond) FAIL.push(name);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("ERR_CONNECTION")) errors.push(m.text()); });

  const url = "file://" + path.resolve(DEMO_FILE);
  await page.goto(url);
  await page.waitForTimeout(300);

  const shot = async n => page.screenshot({ path: path.join(__dirname, "shots", `${n}.png`) });
  require("fs").mkdirSync(path.join(__dirname, "shots"), { recursive: true });

  // 1. sign-on visible
  check("signon visible on load", await page.isVisible("#signon"));
  await shot("00-signon");

  // 2. registration flow
  await page.click("#createAcctLink");
  await page.waitForTimeout(200);
  check("registration overlay shown", await page.isVisible("#studentReg"));
  check("reg step0 Getting Started", (await page.textContent("#regBody")).includes("Getting Started"));
  await shot("01-reg-getting-started");
  await page.click("#regContinue"); await page.waitForTimeout(100);
  check("reg step1 Almost Complete", (await page.textContent("#regBody")).includes("Almost Complete"));
  await shot("02-reg-verify-email");
  await page.click("#regVerify"); await page.waitForTimeout(100);
  check("reg step2 Create Password", (await page.textContent("#regBody")).includes("Create Password"));
  await page.click("#regFill"); await page.waitForTimeout(100);
  const finishReady = await page.$eval("#regFinish", el => el.style.pointerEvents === "auto");
  check("password checklist enables finish", finishReady);
  await shot("03-reg-password");
  await page.click("#regFinish");
  await page.waitForTimeout(400);

  // 3. welcome
  check("landed on student-welcome", page.url().includes("student-welcome"));
  check("welcome content", (await page.textContent("#view")).includes("Welcome to Student EI"));
  check("student nav visible (4 items)", (await page.$$eval(".stu-nav", els => els.filter(e => !e.hidden).length)) === 4);
  check("staff nav hidden for student", await page.$eval("#navHome", el => el.style.display === "none"));
  check("MAV panel visible for student (R1 J2)", await page.$eval("#mavPanel", el => el.style.display !== "none"));
  await shot("04-welcome");

  // 4. assessment fresh start (registration reset state)
  await page.click("#swNext"); await page.waitForTimeout(200);
  check("assessment route", page.url().includes("student-assessment"));
  let vtext = await page.textContent("#view");
  check("likert question shown", vtext.includes("Thinking about myself"));
  check("no back button in assessment", (await page.$$eval("#view button, #view .sa-opt", els => els.filter(e => e.textContent.trim() === "Back").length)) === 0);
  check("next disabled before answering", await page.$eval("#saNext", el => el.style.pointerEvents === "none"));
  await page.click('[data-sa-opt="3"]'); await page.waitForTimeout(100);
  check("next enabled after answer", await page.$eval("#saNext", el => el.style.pointerEvents !== "none"));
  await shot("05-assess-likert");
  // advance through section 1 (4 samples)
  for (let i = 0; i < 4; i++) {
    if (await page.$('[data-sa-opt="2"]')) await page.click('[data-sa-opt="2"]');
    await page.waitForTimeout(60);
    if (await page.$("#saNext")) await page.click("#saNext");
    await page.waitForTimeout(80);
  }
  vtext = await page.textContent("#view");
  check("stop screen after section 1", vtext.includes("Ask your teacher"));
  await shot("06-assess-stop");
  await page.click("#saContinue"); await page.waitForTimeout(150);
  vtext = await page.textContent("#view");
  check("triad section 2 shown", vtext.includes("MOST"));
  await page.click('[data-sa-most="0"]');
  await page.click('[data-sa-least="2"]'); await page.waitForTimeout(100);
  check("triad answered enables next", await page.$eval("#saNext", el => el.style.pointerEvents !== "none"));
  await shot("07-assess-triad");
  await page.click("#saClear"); await page.waitForTimeout(80);
  check("clear resets triad", await page.$eval("#saNext", el => el.style.pointerEvents === "none"));
  // demo jump to section 3, then congrats
  await page.click('[data-sa-jump="2"]'); await page.waitForTimeout(120);
  vtext = await page.textContent("#view");
  check("sj section shown", vtext.includes("How would you respond"));
  await page.click('[data-sa-opt="3"]'); await page.waitForTimeout(80);
  await shot("08-assess-sj");
  await page.click('[data-sa-jump="done"]'); await page.waitForTimeout(120);
  vtext = await page.textContent("#view");
  check("congratulations screen", vtext.includes("Congratulations"));
  await shot("09-assess-congrats");
  await page.click("#saDone"); await page.waitForTimeout(200);
  check("congrats lands on My Durable Skills", page.url().includes("my-durable-skills"));

  // 5. durable skills + cycle dropdown
  vtext = await page.textContent("#view");
  check("durable skills page", vtext.includes("My Durable Skills") && !vtext.includes("You are Emerging"));
  const sdLabels = await page.$$eval("#view .trend-endlab", els => els.map(e => e.textContent.trim()));
  check("durable skills: proficiency label at line end (R2)", sdLabels.length === 5 && sdLabels.every(l => ["Developing","Emerging","Advancing","Excelling","Mastering"].includes(l)));
  check("cycle dropdown present", await page.isVisible("#sdCycle"));
  await shot("10-durable-skills");
  await page.selectOption("#sdCycle", "October 2025"); await page.waitForTimeout(150);
  check("cycle switch renders", (await page.textContent("#view")).includes("My Durable Skills"));

  // 6. dashboard hub
  await page.click('a[data-route="my-dashboard"]'); await page.waitForTimeout(150);
  vtext = await page.textContent("#view");
  check("hub cards present", vtext.includes("My Credentials") && vtext.includes("My Feedback") && !vtext.includes("My Interests"));
  check("hub shows completed CTA after finish", vtext.includes("summary is complete"));
  await shot("11-dashboard-hub");

  // 7. credentials + dual Skills Builder queue (R1 J4 · R2)
  await page.click('a[data-route="my-credentials"]'); await page.waitForTimeout(150);
  check("credential badge shows 2 queued (R2)", (await page.$eval("#credBadge", el => el.hidden ? "" : el.textContent.trim())) === "2");
  vtext = await page.textContent("#view");
  check("dual queue banners (R2)", vtext.includes("English 10 Public Speaking Presentation") && vtext.includes("Chemistry Lab") && vtext.includes("Ms. Jones"));
  check("Sofia tallies shown", vtext.includes("240") && vtext.includes("325"));
  check("how credentials work explainer", vtext.includes("How credentials work"));
  check("skills builder history + queue rows", vtext.includes("Skills Builder History") && (vtext.match(/In queue/g) || []).length === 2);
  await shot("12-credentials");
  await page.click("#sbqStart"); await page.waitForTimeout(150);
  for (let i = 0; i < 5; i++) {
    await page.click('[data-sbq-opt="0"]');
    await page.waitForTimeout(120);
  }
  vtext = await page.textContent("#view");
  check("skills builder complete banner", vtext.includes("Skills Builder Science complete") && vtext.includes("+20"));
  check("tallies bumped in real time", vtext.includes("248 of 500") || vtext.includes("248"));
  check("badge drops to 1 after chemistry (R2)", (await page.$eval("#credBadge", el => el.hidden ? "" : el.textContent.trim())) === "1");
  check("history gains chemistry row", vtext.includes("Chemistry — Group Lab"));
  await page.click("#ebqStart"); await page.waitForTimeout(150);
  vtext = await page.textContent("#view");
  check("english MCQ shows lettered choices (R2)", vtext.includes("A. ") && vtext.includes("D. "));
  for (let i = 0; i < 5; i++) {
    await page.click('[data-ebq-opt="0"]');
    await page.waitForTimeout(120);
  }
  vtext = await page.textContent("#view");
  check("english complete banner (R2)", vtext.includes("Skills Builder English complete"));
  check("badge cleared after both builders (R2)", await page.$eval("#credBadge", el => el.hidden));
  await shot("13-credentials-done");

  // 7b. CP1 foundation checks
  await page.evaluate(() => { location.hash = "#/signon"; });
  await page.waitForTimeout(120);
  await page.evaluate(() => applyRole("superintendent"));
  await page.waitForTimeout(150);
  for (const r of ["home", "students", "credentials", "benchmarks", "sis"]) {
    await page.evaluate(rr => { location.hash = "#/" + rr; }, r); await page.waitForTimeout(140);
    const body = (await page.textContent("body")).toLowerCase();
    check("no banned terms on " + r, !body.includes("at risk") && !body.includes("at-risk") && !body.includes("needs review") && !body.includes("absentee") && !body.includes("check-in"));
  }
  await page.evaluate(() => { location.hash = "#/home"; }); await page.waitForTimeout(140);
  vtext = await page.textContent("#view");
  check("home tile: verified count", vtext.includes("1,168 Verified"));
  check("home tile: credential points", vtext.includes("Credential Points Awarded") && vtext.includes("318,540"));
  check("home: October 2026 live cycle", vtext.includes("October 2026"));
  check("home: recent skills builders removed (R2)", !vtext.includes("Recent Skills Builders"));
  // R2 home: language select, Clear all, GP cohort chips, clickable i-icons
  check("home: language selector in header (R2)", (await page.$$eval("#langSel option", els => els.map(o => o.textContent).join(","))) === "English,Español" && (await page.$$eval("#view select option", els => els.filter(o => /Espa/.test(o.textContent)).length)) === 0);
  check("home: trend Clear all chip (R2)", !!(await page.$("#trendClear")));
  check("home: GP cohort chips (R2)", (await page.$$eval("[data-gpyear]", els => els.length)) === 8);
  await page.click('[data-gpyear="2029"]'); await page.waitForTimeout(150);
  check("home: GP module filters by cohort (R2)", (await page.textContent("#view")).includes("Graduate Profile — Class of 2029"));
  await page.click('[data-gpyear="All"]'); await page.waitForTimeout(120);
  await page.click(".trend-row .info-btn"); await page.waitForTimeout(150);
  check("home: i-icon opens definition panel (R2)", !!(await page.$(".comp-info-panel")));
  await page.click(".trend-row .info-btn"); await page.waitForTimeout(120);
  const pastGoal = await page.evaluate(() => STUDENTS.filter(s => Math.max(...COMPS.map(c => credTally(s, c))) >= CRED_GOAL).length);
  check("exactly 4 students past credential goal", pastGoal === 4);
  const sofiaGP = await page.evaluate(() => COMPS.concat(GP_EXTRA).map(c => gpOf(getStudent(4), c)).join(","));
  check("Sofia GP matches Tyler numbers", sofiaGP === "48,26,65,18,44,60,88,48");
  const gpSpread = await page.evaluate(() => { const v = STUDENTS.map(s => gpOverall(s)); return Math.min(...v) >= 18 && Math.max(...v) <= 88; });
  check("GP percentages within 18-88 spread", gpSpread);

  // CP2: IA restructure
  vtext = await page.textContent("#view");
  check("home: competency trend module", vtext.includes("Competency Trend"));
  check("home: GP module with district-added comps", vtext.includes("Critical Thinking") && vtext.includes("Empowered Learner") && vtext.includes("Global Citizen"));
  const navRoutes = await page.evaluate(() => [...document.querySelectorAll(".nav-item")].map(a => a.dataset.route));
  check("sidebar: deleted tabs gone", !navRoutes.includes("assessments") && !navRoutes.includes("surveys") && !navRoutes.includes("frameworks") && !navRoutes.includes("graduate-profile") && !navRoutes.includes("my-interests"));
  check("sidebar: new menu present", ["students","credentials","benchmarks","console"].every(r => navRoutes.includes(r)));
  for (const dead of ["surveys","frameworks","graduate-profile","assessments"]) {
    await page.evaluate(d => { location.hash = "#/" + d; }, dead); await page.waitForTimeout(160);
    check("deleted route redirects: " + dead, (await page.evaluate(() => location.hash)) === "#/home");
  }
  await page.evaluate(() => { location.hash = "#/new-chat"; }); await page.waitForTimeout(160);
  vtext = await page.textContent("#view");
  check("new chat: Tyler cards", vtext.includes("rostered but haven't verified") && vtext.includes("sub-skills for Self-Management") && vtext.includes("district admin permissions"));
  await page.evaluate(() => { location.hash = "#/console/assessments"; }); await page.waitForTimeout(160);
  vtext = await page.textContent("#view");
  check("console: assessment management", vtext.includes("Assessment Management") && vtext.includes("Assessment library"));
  await page.evaluate(() => { location.hash = "#/students"; }); await page.waitForTimeout(160);
  vtext = await page.textContent("#view");
  check("students: new columns", vtext.includes("Graduate Profile") && vtext.includes("/500") && !vtext.includes("Career Vertical"));
  const uiLow = ((await page.textContent("#view")) + (await page.textContent(".sidebar")) + (await page.textContent(".topbar"))).toLowerCase();
  check("no career/survey/framework content on students", !uiLow.includes("career") && !uiLow.includes("vertical") && !uiLow.includes("framework") && !uiLow.includes("interest"));

  // CP3: Students filter bar + staff student header
  vtext = await page.textContent("#view");
  check("students: Active default filter", (await page.$eval("#fStatus", el => el.value)) === "Active");
  check("students: new filter selects present", !!(await page.$("#fAssess")) && !!(await page.$("#fCred")) && !!(await page.$("#fGP")));
  check("students: create benchmark button", !!(await page.$("#cbOpenBtn")));
  await page.selectOption("#fGP", "Empowered Learner"); await page.waitForTimeout(150);
  vtext = await page.textContent("#view");
  check("students: GP column switches to competency view", vtext.includes("Graduate Profile — Empowered Learner"));
  await page.selectOption("#fGP", ""); await page.waitForTimeout(120);
  await page.click("#cbOpenBtn"); await page.waitForTimeout(150);
  check("create benchmark dialog opens", !!(await page.$("#cbSave")));
  const nBench = await page.evaluate(() => BENCHMARKS.length);
  await page.click("#cbSave"); await page.waitForTimeout(150);
  check("create benchmark saves session row", (await page.evaluate(() => BENCHMARKS.length)) === nBench + 1);
  await page.evaluate(() => { BENCHMARKS.pop(); }); // leave state clean for later benchmark checks
  await page.evaluate(() => { location.hash = "#/student/4"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("student header: GPA + credential progress + GP alignment (R6 rename)", vtext.includes("GPA") && vtext.includes("Credential Progress") && vtext.includes("Graduate Profile Alignment") && !vtext.includes("Tallies"));
  check("student header: Sofia printed numbers", vtext.includes("Algebra") && vtext.includes("240 of 500") && vtext.includes("Empowered Learner"));
  check("student view: cycle dropdown mirrors the student view (R3)", (await page.$$eval("#stuCycleSel option", els => els.length)) === 4);
  const scoreBefore = await page.evaluate(() => scoresFor(getStudent(4), "Oct 2026")["Communication"]);
  await page.selectOption("#stuCycleSel", "May 2025"); await page.waitForTimeout(200);
  const scoreAfter = await page.evaluate(() => scoresFor(getStudent(4), stuCycle)["Communication"]);
  check("student view: past cycle shifts scores", scoreAfter < scoreBefore);
  await page.selectOption("#stuCycleSel", "Oct 2026"); await page.waitForTimeout(150);
  const staffLabs = await page.$$eval("#view .trend-endlab", els => els.map(e => e.textContent.trim()));
  check("staff student view mirrors durable skills presentation (R2)", staffLabs.length === 5 && staffLabs.every(l => ["Developing","Emerging","Advancing","Excelling","Mastering"].includes(l)));

  // CP4: Credentials Skills Builder library
  await page.evaluate(() => { location.hash = "#/credentials"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("credentials: library card + tabs", vtext.includes("Skills Builder Library") && vtext.includes("Social Studies") && vtext.includes("My Library"));
  check("credentials: student table removed", !vtext.includes("Student Credential Points"));
  check("R6: library opens on My Library, not English", await page.evaluate(() => sbTab === "My Library"));
  await page.click('[data-sbtab="English"]'); await page.waitForTimeout(200);   // R6: English is no longer the default tab
  await page.click('[data-sb="English:0"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: English entry expands with doc content", vtext.includes("Teacher Cliff Notes") && vtext.includes("Know your message") && vtext.includes("How did curiosity help you prepare"));
  await page.click('[data-sbtab="Sciences"]'); await page.waitForTimeout(180);
  await page.click('[data-sb="Sciences:0"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: Chemistry entry from doc", vtext.includes("Chemistry — Group Lab") && vtext.includes("Divide the work"));
  await page.click('[data-sbtab="Math"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: Math is Tyler's Linear Equations activity (R2C)", vtext.includes("Algebra I — Linear Equations Problem-Solving") && !vtext.includes("Draft — for Student EI review"));
  await page.click('[data-sb="Math:0"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: Math entry doc content (R2C)", vtext.includes("Understand the problem first") && vtext.includes("Average the two answers so the group can keep moving."));
  await page.click('[data-sbtab="Social Studies"]'); await page.waitForTimeout(180);
  await page.click('[data-sb="Social Studies:0"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: Social Studies is Global Issues Debate (R2C)", vtext.includes("Global 10 — Global Issues Debate") && vtext.includes("Listen before responding"));
  await page.click('[data-sbtab="CTE"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: CTE is Nursing Patient Care Simulation (R2C)", vtext.includes("Nursing Pathway — Patient Care Simulation"));
  check("credentials: CTE standards list 33 rows / 11 areas (R2C)", (await page.$$eval(".std-table tbody tr", els => els.length)) === 33 && vtext.includes("Agricultural Science") && vtext.includes("Cosmetology & Barbering"));
  await page.click('[data-sbtab="Other"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: Other is Community Volunteering (R2C)", vtext.includes("Other — Community Volunteering Project"));
  // R2C: learning-standards lists with live Create rows
  await page.click('[data-sbtab="English"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: English standards list (R2C)", vtext.includes("Speaking / Presentation") && vtext.includes("Writing / Revision & Editing") && (await page.$$eval(".std-table tbody tr", els => els.length)) === 10);
  await page.click('[data-stdcreate="English:0"]'); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("credentials: English Create opens the English 10 entry (R2C)", (await page.evaluate(() => sbOpen)) === "English:0" && vtext.includes("Know your message"));
  await page.click('[data-sbtab="Sciences"]'); await page.waitForTimeout(180);
  await page.click('[data-stdcreate="Sciences:0"]'); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("credentials: Science Create opens the Chemistry entry (R2C)", (await page.evaluate(() => sbOpen)) === "Sciences:0" && vtext.includes("Divide the work"));
  await page.click('[data-sbtab="My Library"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: my library subject rows (R2)", ["English","Math","Social Studies","Sciences","CTE","Other"].every(s => vtext.includes(s)) && !vtext.includes("Shared"));
  await page.click('#view .assess-row[data-sbtab="Sciences"]'); await page.waitForTimeout(180);
  check("my library row click-through (R2)", await page.evaluate(() => sbTab === "Sciences"));

  // R2: Credential Progress Percentage module (renamed R6b)
  vtext = await page.textContent("#view");
  check("credentials: PDG module replaces points cards (R2)", vtext.includes("Credential Progress Percentage") && !vtext.includes("Percentage of District Goal") && !vtext.includes("Points by Competency") && !vtext.includes("Points Awarded per Cycle") && !vtext.includes("Recent Skills Builders"));
  check("credentials: PDG chips incl months (R2)", (await page.$$eval("[data-pdg]", els => els.length)) === 20 && !!(await page.$("#pdgClear")));
  await page.click('[data-pdg="2028"]'); await page.waitForTimeout(120);
  await page.click('[data-pdg="Oct"]'); await page.waitForTimeout(120);
  await page.click('[data-pdg="Feb"]'); await page.waitForTimeout(150);
  let pdgLabs = await page.$$eval(".trend-cycle-lab", els => els.map(e => e.textContent.trim()));
  check("PDG: cohort + month compare draws two lines (R2)", pdgLabs[0] === "Class of 2028 · Oct" && pdgLabs[1] === "Class of 2028 · Feb");
  check("PDG: percentages at line ends (R2)", (await page.$$eval("#view .trend-endlab", els => els.length)) === 10);
  await page.click("#pdgClear"); await page.waitForTimeout(150);
  check("PDG: clear all resets to All Students (R2)", await page.evaluate(() => pdgSel.length === 1 && pdgSel[0] === "All Students"));

  // R2: Create a Skills Builder rebuilt to Tyler's mock
  await page.evaluate(() => { location.hash = "#/credentials/checkin"; }); await page.waitForTimeout(220);
  vtext = await page.textContent("#view");
  check("create page: Tyler mock layout (R2)", vtext.includes("Create a Skills Builder") && vtext.includes("Activity Information") && !vtext.includes("Bridge design") && !vtext.includes("Farm-to-table"));
  const ckVals = await page.$$eval("#view input", els => els.map(e => e.value));
  check("create page: activity info values (R2)", ckVals.includes("Ms. Jones") && ckVals.includes("Public Speaking Presentation"));
  await page.click("#ckGenNotes"); await page.waitForTimeout(150);
  await page.click("#ckGenQs"); await page.waitForTimeout(150);
  vtext = await page.textContent("#view");
  check("create page: generates notes + questions (R2)", vtext.includes("Know your message") && vtext.includes("A. "));
  await page.selectOption("#ckSubjSel", "Sciences"); await page.waitForTimeout(180);
  check("create page: subject switch to Chemistry (R2)", (await page.$$eval("#view input", els => els.map(e => e.value))).includes("Chemistry — Group Lab"));
  await page.click("#ckSave"); await page.waitForTimeout(250);
  check("create page: save opens library entry (R2)", (await page.evaluate(() => location.hash)) === "#/credentials" && (await page.evaluate(() => sbOpen)) === "Sciences:0");
  await page.evaluate(() => { sbTab = "English"; sbOpen = null; });

  // R2: MAV thread — fresh conversation per card, newest on top, no page scroll
  await page.evaluate(() => { location.hash = "#/new-chat"; }); await page.waitForTimeout(200);
  await page.click("#view [data-mav]"); await page.waitForTimeout(600);
  check("MAV: card click yields one exchange (R2)", (await page.evaluate(() => mavThread.children.length)) === 2);
  await page.evaluate(() => { location.hash = "#/new-chat"; }); await page.waitForTimeout(200);
  await page.click("#view [data-mav]"); await page.waitForTimeout(600);
  check("MAV: repeat click does not duplicate (R2)", (await page.evaluate(() => mavThread.children.length)) === 2);
  check("MAV: click-through lands at top of page (R2)", (await page.evaluate(() => window.scrollY)) === 0);
  check("MAV: prompt above answer, newest first (R2)", (await page.evaluate(() => mavThread.children[0].className)).includes("user"));

  // R2: students skills dropdown drives the skills column
  await page.evaluate(() => { location.hash = "#/students"; studentFilters = { status: "Active" }; studentFiltersFromMav = false; render(); }); await page.waitForTimeout(200);
  await page.selectOption("#fComp", "Teamwork"); await page.waitForTimeout(200);
  check("students: skills filter fills column (R2)", await page.$$eval("#view tbody tr", trs => trs.length > 0 && trs.every(tr => tr.textContent.includes("Teamwork"))));
  await page.evaluate(() => { studentFilters = { status: "Active" }; render(); }); await page.waitForTimeout(150);

  // R2: MAV filtered list shows the prompted skill per student
  await page.evaluate(() => mavNavStudents({ gradYear: 2028, competency: "Communication", proficiency: "Emerging" })); await page.waitForTimeout(250);
  check("students: MAV filter matches skills column (R2)", await page.$$eval("#view tbody tr", trs => trs.length === 3 && trs.every(tr => tr.textContent.includes("Communication"))));
  await page.evaluate(() => { studentFilters = { status: "Active" }; studentFiltersFromMav = false; });

  // R2: console — whitepaper link, back links, template form
  await page.evaluate(() => { location.hash = "#/console/resources"; }); await page.waitForTimeout(200);
  check("console resources: whitepaper linked (R2)", (await page.$$eval("#view a", els => els.some(a => a.href.includes("filesusr.com") && a.target === "_blank"))));
  check("console resources: back to console (R2)", (await page.textContent("#view")).includes("Console"));
  await page.evaluate(() => { location.hash = "#/console/assessments"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("console assessments: template form + no 92-item note (R2)", vtext.includes("Assessment name") && !vtext.includes("92-item"));

  // CP5: Benchmarks rebuild
  await page.evaluate(() => { sbTab = "English"; location.hash = "#/benchmarks"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("benchmarks: Tyler's six listed", vtext.includes("PofG-Self-management") && !vtext.includes("Self-management-Advancing") && vtext.includes("CTE-Health Services") && vtext.includes("813"));
  await page.evaluate(() => { location.hash = "#/benchmarks/0"; }); await page.waitForTimeout(200);
  check("benchmark detail: skill column matches competency (R2)", await page.$$eval("#view tbody tr", trs => trs.length > 0 && trs.every(tr => tr.textContent.includes("Self-Management"))));
  await page.evaluate(() => { location.hash = "#/benchmarks"; }); await page.waitForTimeout(150);
  check("benchmarks: intro line", vtext.includes("Create and save student groups"));
  await page.evaluate(() => { location.hash = "#/benchmarks/5"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("benchmark detail: CTE Health Services doc text", vtext.includes("Nursing/RN-related courses"));
  check("benchmark detail: students-tab columns", vtext.includes("Graduate Profile") && vtext.includes("/500"));
  const rows5 = await page.$$eval("#view table tbody tr[data-nav]", els => els.length);
  check("benchmark detail: CTE sample has members", rows5 >= 3);
  const mavText0 = await page.textContent("#mavInsights");
  check("benchmark detail: MAV explains benchmark", mavText0.includes("created by James Petrillo"));
  // all six open
  let allOpen = true;
  for (let bi = 0; bi < 6; bi++) {
    await page.evaluate(i2 => { location.hash = "#/benchmarks/" + i2; }, bi); await page.waitForTimeout(150);
    const t2 = await page.textContent("#view");
    if (!t2.includes("About this benchmark")) allOpen = false;
  }
  check("benchmarks: all six clickable", allOpen);
  await page.evaluate(() => { location.hash = "#/home"; }); await page.waitForTimeout(140);
  // back to Sofia for the remaining student checks
  await page.evaluate(() => { location.hash = "#/signon"; }); await page.waitForTimeout(120);
  await page.evaluate(() => applyRole("student")); await page.waitForTimeout(150);
  await page.evaluate(() => { location.hash = "#/my-dashboard"; }); await page.waitForTimeout(140);

  // 8. my-interests removed (R1): route redirects to the hub
  await page.evaluate(() => { location.hash = "#/my-interests"; }); await page.waitForTimeout(200);
  check("my-interests redirects to hub", page.url().includes("my-dashboard") || (await page.evaluate(() => location.hash)).includes("my-dashboard"));

  // 9. feedback (R1 J5 conversational rebuild)
  await page.click('a[data-route="my-feedback"]'); await page.waitForTimeout(150);
  vtext = await page.textContent("#view");
  check("feedback page", vtext.includes("Share feedback that helps you grow"));
  check("feedback: conversation demo (R5 ice cream stand)", vtext.includes("local ice cream stand") && vtext.includes("cones, shakes, and sundaes") && vtext.includes("communication skills, teamwork and adaptability"));
  check("R5: lifeguard copy fully removed", !vtext.toLowerCase().includes("lifeguard"));
  check("feedback: mic removed", !vtext.toLowerCase().includes("record with your voice"));
  await shot("17-feedback");

  // 9b. student MAV + chat tabs (R1 J2)
  const stuChips = await page.textContent("#mavChips");
  check("student MAV chips present", stuChips.length > 10);
  await page.evaluate(() => { location.hash = "#/new-chat"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("student new chat cards", vtext.includes("What can I help you with, Sofia?") && vtext.includes("What do I need to do next?"));
  await page.evaluate(() => { location.hash = "#/chats"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("student chats list (R5 ice cream stand)", vtext.includes("My summer job — ice cream stand") && !vtext.toLowerCase().includes("lifeguard"));
  const navVis = await page.evaluate(() => ({ nc: document.getElementById("navNewChat").style.display, ch: document.getElementById("navChats").style.display }));
  check("student sees New Chat + Chats tabs", navVis.nc !== "none" && navVis.ch !== "none");
  await page.evaluate(() => { location.hash = "#/my-dashboard"; }); await page.waitForTimeout(160);

  // 10. leak check across all student routes
  const hidden = await page.evaluate(() =>
    STUDENTS.filter(s => s.id !== STUDENT_SELF_ID).map(s => s.first + " " + s.last));
  const stuRoutes = ["my-dashboard","my-durable-skills","my-credentials","my-feedback","student-welcome","student-assessment"];
  let leak = null;
  for (const r of stuRoutes) {
    await page.evaluate(rr => { location.hash = "#/" + rr; }, r);
    await page.waitForTimeout(150);
    const body = await page.evaluate(() => document.getElementById("view").innerHTML);
    for (const n of hidden) if (body.includes(n)) leak = r + ":" + n;
  }
  check("no hidden-student leak on student routes", leak === null);
  if (leak) console.log("  LEAK:", leak);

  // 11. student blocked from staff routes
  await page.evaluate(() => { location.hash = "#/home"; });
  await page.waitForTimeout(200);
  check("student blocked from #/home", page.url().includes("my-dashboard"));

  // 12. sign out, staff regression
  await page.evaluate(() => document.getElementById("signOutBtn").click());
  await page.waitForTimeout(200);
  check("sign out returns to signon", await page.isVisible("#signon"));
  await page.selectOption("#signonRole", "superintendent");
  await page.click("#signinBtn"); await page.waitForTimeout(300);
  check("superintendent lands on home", page.url().includes("home"));
  vtext = await page.textContent("#view");
  check("district dashboard renders", vtext.includes("District") || vtext.length > 500);
  check("staff sees no student nav", (await page.$$eval(".stu-nav", els => els.filter(e => !e.hidden).length)) === 0);
  await page.evaluate(() => { location.hash = "#/my-durable-skills"; });
  await page.waitForTimeout(200);
  check("staff blocked from student routes", !page.url().includes("my-durable-skills"));
  for (const r of ["students","credentials","benchmarks","console","console/users","console/assessments","console/resources","console/tutorials","sis"]) {
    await page.evaluate(rr => { location.hash = "#/" + rr; }, r);
    await page.waitForTimeout(120);
    const ok = (await page.evaluate(() => document.getElementById("view").innerHTML.length)) > 300;
    check("staff route renders: " + r, ok);
  }

  // 13. Sofia sign-in via sign-on select (existing path) → hub with in-progress CTA (fresh page)
  const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page2.on("pageerror", e => errors.push("p2:" + String(e)));
  await page2.goto(url); await page2.waitForTimeout(300);
  await page2.selectOption("#signonRole", "student");
  await page2.click("#signinBtn"); await page2.waitForTimeout(300);
  check("Sofia sign-in lands on my-dashboard", page2.url().includes("my-dashboard"));
  const v2 = await page2.textContent("#view");
  check("hub shows continue CTA (in-progress cycle)", v2.includes("continue creating your durable skills summary"));
  await page2.click(".sdh-cta"); await page2.waitForTimeout(200);
  check("CTA resumes assessment", page2.url().includes("student-assessment"));
  const v3 = await page2.textContent("#view");
  check("resume mid-section 1 (likert)", v3.includes("Thinking about myself"));
  const fill = await page2.$$eval(".sa-seg-fill", els => els.map(e => e.style.width));
  check("progress bar shows partial section 1: " + fill.join(","), fill[0] !== "0%" && fill[0] !== "100%" && fill[1] === "0%");

  // UX pass: scroll retention + app-shell layout
  const page3 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page3.on("pageerror", e => errors.push("p3:" + String(e)));
  await page3.goto(url); await page3.waitForTimeout(300);
  await page3.click("#signinBtn"); await page3.waitForTimeout(400);
  const lay = await page3.evaluate(() => {
    const g = s => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const ins = document.getElementById("mavInsights").getBoundingClientRect();
    const ch = document.getElementById("mavChips").getBoundingClientRect();
    return { topbar: g(".topbar").h, logo: g(".topbar-logo").h, mavH: g(".mav-panel").h, content: g("#view").w,
             gap: Math.round(ch.top - ins.bottom), collapsed: document.querySelector(".sidebar").classList.contains("collapsed") };
  });
  check("UX: header 106px tall", lay.topbar === 106);
  check("UX: logo scaled up (>=58px)", lay.logo >= 58);
  check("UX: MAV panel is viewport height, not page height", lay.mavH <= 800);
  check("UX: MAV prompts sit near the insights (gap < 200px)", lay.gap < 200);
  check("UX: sidebar auto-collapses below 1440", lay.collapsed === true);
  check("UX: content column wider than 800px at 1280", lay.content > 800);
  const held = async (sel, y) => {
    await page3.evaluate(yy => window.scrollTo(0, yy), y); await page3.waitForTimeout(150);
    const before = await page3.evaluate(() => window.scrollY);
    await page3.evaluate(s => document.querySelector(s).click(), sel); await page3.waitForTimeout(300);
    return (await page3.evaluate(() => window.scrollY)) === before && before > 0;
  };
  check("UX: info icon holds scroll position", await held(".trend-row .info-btn", 500));
  check("UX: cycle chip holds scroll position", await held('[data-period="May 2026"]', 400));
  check("UX: class chip holds scroll position", await held('[data-gy="2029"]', 400));
  check("UX: graduate profile chip holds scroll position", await held('[data-gpyear="2030"]', 1100));
  await page3.evaluate(() => { location.hash = "#/students"; }); await page3.waitForTimeout(350);
  await page3.evaluate(() => window.scrollTo(0, 500)); await page3.waitForTimeout(150);
  const sy = await page3.evaluate(() => window.scrollY);
  await page3.evaluate(() => { const s = document.getElementById("fComp"); s.value = "Teamwork"; s.dispatchEvent(new Event("change")); });
  await page3.waitForTimeout(300);
  check("UX: student filter holds scroll position", (await page3.evaluate(() => window.scrollY)) === sy);
  await page3.evaluate(() => { location.hash = "#/credentials"; }); await page3.waitForTimeout(350);
  check("UX: route change still resets scroll", (await page3.evaluate(() => window.scrollY)) === 0);
  await page3.evaluate(() => { location.hash = "#/new-chat"; }); await page3.waitForTimeout(300);
  check("UX: New Chat hides the duplicate panel prompts", await page3.evaluate(() => document.getElementById("mavChipsWrap").hidden));
  await page3.evaluate(() => window.scrollTo(0, 400)); await page3.waitForTimeout(150);
  await page3.evaluate(() => document.querySelector("#view [data-mav]").click()); await page3.waitForTimeout(900);
  check("UX: MAV click-through still lands at the top", (await page3.evaluate(() => window.scrollY)) === 0);
  await page3.evaluate(() => { location.hash = "#/home"; }); await page3.waitForTimeout(300);
  check("UX: prompts return on other screens", await page3.evaluate(() => !document.getElementById("mavChipsWrap").hidden));

  // Spanish (demo scope: student experience only)
  const page4 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page4.on("pageerror", e => errors.push("p4:" + String(e)));
  await page4.goto(url); await page4.waitForTimeout(300);
  await page4.click("#signinBtn"); await page4.waitForTimeout(400);
  await page4.selectOption("#langSel", "es"); await page4.waitForTimeout(400);
  let s4 = await page4.textContent("#view");
  check("ES: staff sees Coming Soon, not Spanish", (await page4.textContent("#langSoon")).trim() === "Coming Soon" && s4.includes("District Overview") && s4.includes("Competency Trend"));
  check("ES: only one language control on screen", (await page4.$$eval("select", els => els.filter(e => /Espa/.test(e.textContent)).length)) === 1);
  check("ES: staff sidebar stays English", (await page4.textContent(".sidebar")).includes("Students"));
  check("ES: Coming Soon pill in header", !(await page4.$eval("#langSoon", el => el.hidden)));
  await page4.evaluate(() => document.getElementById("signOutBtn").click()); await page4.waitForTimeout(400);
  await page4.selectOption("#signonRole", "student");
  await page4.click("#signinBtn"); await page4.waitForTimeout(400);
  check("ES: language resets to English on role change", (await page4.$eval("#langSel", el => el.value)) === "en");
  await page4.selectOption("#langSel", "es"); await page4.waitForTimeout(450);
  s4 = await page4.textContent("#view");
  check("ES: student hub translated", s4.includes("Mi Panel") && s4.includes("\u00a1Hola Sofia!"));
  check("ES: student sidebar translated", (await page4.textContent(".sidebar")).includes("Mis Habilidades Duraderas"));
  check("ES: breadcrumb translated", (await page4.textContent("#crumbScreen")).includes("Mi Panel"));
  check("ES: MAV panel translated", (await page4.textContent("#mavPanel")).includes("Vista del estudiante"));
  check("ES: no Coming Soon for students", await page4.$eval("#langSoon", el => el.hidden));
  await page4.evaluate(() => { location.hash = "#/my-durable-skills"; }); await page4.waitForTimeout(400);
  s4 = await page4.textContent("#view");
  const esRanges = await page4.$$eval(".trend-ranges span", els => els.map(e => e.textContent.trim()));
  check("ES: competencies and ranges translated", s4.includes("Autogesti\u00f3n") && esRanges.join(",") === "En Desarrollo,Emergente,Avanzando,Destacado,Dominando");
  await page4.evaluate(() => { location.hash = "#/my-credentials"; }); await page4.waitForTimeout(400);
  s4 = await page4.textContent("#view");
  check("ES: credentials page translated", s4.includes("C\u00f3mo funcionan las credenciales") && s4.includes("Tienes un nuevo Skills Builder"));
  check("ES: credential cards use 'meta' not 'goal'", s4.includes("meta 375") && !s4.includes("goal 375"));
  await page4.evaluate(() => { location.hash = "#/my-dashboard"; }); await page4.waitForTimeout(350);
  check("ES: tallies use 'de' not 'of'", (await page4.textContent("#view")).includes("240 de 500"));
  await page4.evaluate(() => { location.hash = "#/my-credentials"; }); await page4.waitForTimeout(350);
  await page4.click("#ebqStart"); await page4.waitForTimeout(350);
  s4 = await page4.textContent("#view");
  check("ES: Skills Builder questions translated", s4.includes("Mirando atr\u00e1s a las dos semanas"));
  check("ES: question counter interpolates", s4.includes("pregunta 1 de 5"));
  await page4.click('[data-ebq-opt="0"]'); await page4.waitForTimeout(300);
  check("ES: point toast translated", (await page4.textContent("#toast")).includes("\u00a1Buen trabajo! +4 puntos"));
  await page4.evaluate(() => { location.hash = "#/student-assessment"; }); await page4.waitForTimeout(450);
  s4 = await page4.textContent("#view");
  check("ES: assessment translated", s4.includes("Pensando en m\u00ed mismo") && s4.includes("Nunca"));
  await page4.evaluate(() => { location.hash = "#/new-chat"; }); await page4.waitForTimeout(350);
  await page4.evaluate(() => mavAsk("What do I need to do next?")); await page4.waitForTimeout(800);
  check("ES: MAV reply translated", (await page4.textContent("#mavPanel")).includes("Algunas cosas, Sofia"));
  await page4.selectOption("#langSel", "en"); await page4.waitForTimeout(450);
  check("ES: switching back restores English", (await page4.textContent(".sidebar")).includes("My Durable Skills") && (await page4.textContent("#view")).includes("Thinking about myself"));

  // student experience must never surface district aggregates
  for (const r of ["student-welcome", "student-assessment", "my-dashboard", "my-durable-skills", "my-credentials", "my-feedback"]) {
    await page4.evaluate(rr => { location.hash = "#/" + rr; }, r); await page4.waitForTimeout(250);
    const ins = await page4.textContent("#mavInsights");
    check("student MAV shows no district aggregates: " + r, !/1,284|classes of 20|district goal \(81/.test(ins));
  }

  // R3: one proficiency scale — the report label always equals rangeOf(score)
  const scaleBad = await page.evaluate(() => {
    const bad = [];
    STUDENTS.forEach(s => COMPS.forEach(c => {
      if (s.id === STUDENT_SELF_ID) return;
      const sc = scoresFor(s, "Oct 2026")[c];
      if (sdBucket(bandWidth(sc)) !== rangeOf(sc)) bad.push(s.first + " " + c);
    }));
    return bad;
  });
  check("R3: report label matches roster range for every student", scaleBad.length === 0);
  const devonOK = await page.evaluate(() => {
    const d = STUDENTS.find(x => x.first === "Devon");
    const sc = scoresFor(d, "Oct 2026")["Adaptability"];
    return rangeOf(sc) === "Developing" && sdBucket(bandWidth(sc)) === "Developing";
  });
  check("R3: Devon reads Developing on benchmark and on his report", devonOK);
  const contained = await page.evaluate(() => {
    let bad = 0;
    document.querySelectorAll("#view .trend-row").forEach(row => {
      const line = row.querySelector(".trend-line"), lab = row.querySelector(".trend-endlab");
      if (!line || !lab) return;
      const tr = row.querySelector(".trend-track").getBoundingClientRect();
      const col = tr.width / 5, lr = line.getBoundingClientRect(), br = lab.getBoundingClientRect();
      const lc = Math.floor((lr.right - tr.left) / col);
      const s0 = Math.floor((br.left - tr.left) / col), e0 = Math.floor((br.right - tr.left - 1) / col);
      if (!(lc === s0 && s0 === e0)) bad++;
    });
    return bad;
  });
  check("R3: line end and label sit in the same proficiency column", contained === 0);
  check("R3: benchmarks re-evaluate sentence removed", !(await page.evaluate(() => document.body.innerHTML.includes("re-evaluate against current data"))));
  for (const r of ["console/users", "console/assessments", "console/resources", "console/tutorials", "sis"]) {
    await page.evaluate(rr => { location.hash = "#/" + rr; }, r); await page.waitForTimeout(180);
    const inTitle = await page.evaluate(() => {
      const a = [...document.querySelectorAll("#view a")].find(x => x.textContent.includes("Console"));
      return !!(a && a.closest(".page-title"));
    });
    check("R3: back arrow consistent on " + r, inTitle);
  }

  // R3b: caret expand/collapse replaces the "Show all 4" text link
  await page.evaluate(() => { location.hash = "#/home"; }); await page.waitForTimeout(300);
  const homeTxt = await page.textContent("#view");
  check("R3b: text link replaced by caret control", !homeTxt.includes("Show all 4") && !homeTxt.includes("Show current") && (await page.$$eval(".caret-btn", els => els.length)) === 5);
  check("R3b: caret sits beside the info icon", await page.evaluate(() => {
    const row = document.querySelector("#view .trend-row");
    const i = row.querySelector(".info-btn").getBoundingClientRect();
    const c = row.querySelector(".caret-btn").getBoundingClientRect();
    return c.left - i.right < 12 && c.left > i.left && Math.abs(c.top - i.top) < 3;
  }));
  const lineCount = () => page.evaluate(() => document.querySelectorAll("#view .trend-row")[0].querySelectorAll(".trend-line").length);
  check("R3b: collapsed shows one cycle", (await lineCount()) === 1);
  await page.evaluate(() => document.querySelector("#view .caret-btn").click()); await page.waitForTimeout(300);
  check("R3b: caret expands to all four cycles", (await lineCount()) === 4);
  check("R3b: expanded caret points up", await page.evaluate(() => {
    const c = document.querySelector("#view .caret-btn");
    return c.getAttribute("aria-expanded") === "true" && c.innerHTML.includes("M18 15l-6-6-6 6");
  }));
  await page.evaluate(() => document.querySelector("#view .caret-btn").click()); await page.waitForTimeout(300);
  check("R3b: caret collapses and points down", (await lineCount()) === 1 && await page.evaluate(() => document.querySelector("#view .caret-btn").innerHTML.includes("M6 9l6 6 6-6")));

  // R4 (GM 2026-08-26)
  await page.evaluate(() => { location.hash = "#/home"; }); await page.waitForTimeout(300);
  check("R4: home tile values are not blue", await page.evaluate(() =>
    [...document.querySelectorAll("#view .metric-card .metric-value")].every(e => getComputedStyle(e).color === "rgb(26, 26, 46)")));
  const gpByClass = await page.evaluate(() => {
    const before = gpTrendYear;
    const out = ["2027","2028","2029","2030","2031","2032","2033"].map(y => {
      gpTrendYear = y;
      return Math.round(GP_DIST.reduce((t, _, i) => t + gpDistVal(i), 0) / GP_DIST.length);
    });
    gpTrendYear = before;
    return out;
  });
  check("R4: graduate profile declines every class year (" + gpByClass.join(">") + ")",
    gpByClass.every((v, i) => i === 0 || v < gpByClass[i - 1]));
  check("R4: each class is 5-10% below the one before", await page.evaluate(() => {
    const ys = ["2027","2028","2029","2030","2031","2032","2033"];
    return ys.slice(1).every((y, i) => {
      const d = 1 - gpClassFactor(y) / gpClassFactor(ys[i]);
      return d >= 0.045 && d <= 0.10;
    });
  }));
  check("R4: lowest-class callout follows the curve", await page.evaluate(() => GP_CLASS_LOW[0] === "Class of 2033"));
  check("R4: insight copy names the lowest classes", await page.evaluate(() => DEFAULT_INSIGHTS[0].includes("2032 and 2033")));
  await page.evaluate(() => { location.hash = "#/credentials"; }); await page.waitForTimeout(300);
  check("R4: credentials tile values are not blue", await page.evaluate(() =>
    [...document.querySelectorAll("#view .metric-card .metric-value")].every(e => getComputedStyle(e).color === "rgb(26, 26, 46)")));
  const pdgByClass = await page.evaluate(() => ["2027","2028","2029","2030","2031","2032","2033"].map(y =>
    Math.round(COMPS.reduce((t, c) => t + pdgVal(c, { label: "", year: y, month: null }), 0) / COMPS.length)));
  check("R4: credentials module uses the same class curve", pdgByClass.every((v, i) => i === 0 || v < pdgByClass[i - 1]));
  await page.evaluate(() => { location.hash = "#/student/4"; }); await page.waitForTimeout(350);
  check("R4: range labels centred over their columns", await page.evaluate(() => {
    const sp = [...document.querySelectorAll("#view .trend-ranges span")];
    const wrap = document.querySelector("#view .trend-ranges").getBoundingClientRect();
    const col = wrap.width / 5;
    return sp.every((e, i) => {
      const r = e.getBoundingClientRect();
      return Math.abs((r.left + r.width / 2 - wrap.left) - (col * i + col / 2)) < 2;
    });
  }));
  check("R4: home tile labels never wrap", await page.evaluate(() => {
    location.hash = "#/home";
    return true;
  }) && await (async () => { await page.waitForTimeout(300); return page.evaluate(() =>
    [...document.querySelectorAll("#view .metric-card .metric-label")].every(e => getComputedStyle(e).whiteSpace === "nowrap")); })());
  // Spanish must restore English on every switch back, including static panel labels
  await page4.evaluate(() => { location.hash = "#/my-durable-skills"; }); await page4.waitForTimeout(300);
  await page4.selectOption("#langSel", "es"); await page4.waitForTimeout(400);
  const esSnap = await page4.evaluate(() => ({ ask: document.querySelector("#mavChipsWrap .mav-label").textContent.trim(), ph: document.getElementById("mavInput").placeholder }));
  check("R4: panel labels and placeholder translate", esSnap.ask !== "Ask MAV" && esSnap.ph !== "Ask MAV about your skills...");
  await page4.selectOption("#langSel", "en"); await page4.waitForTimeout(400);
  let enSnap = await page4.evaluate(() => ({ ask: document.querySelector("#mavChipsWrap .mav-label").textContent.trim(), ctx: document.querySelector(".mav-context-label").textContent.trim(), ph: document.getElementById("mavInput").placeholder }));
  check("R4: panel labels and placeholder revert to English", enSnap.ask === "Ask MAV" && enSnap.ctx === "Current View" && enSnap.ph === "Ask MAV about your skills...");
  for (let i = 0; i < 3; i++) { await page4.selectOption("#langSel", "es"); await page4.waitForTimeout(160); await page4.selectOption("#langSel", "en"); await page4.waitForTimeout(160); }
  enSnap = await page4.evaluate(() => ({ ask: document.querySelector("#mavChipsWrap .mav-label").textContent.trim(), ph: document.getElementById("mavInput").placeholder }));
  check("R4: repeated switching still ends in English", enSnap.ask === "Ask MAV" && enSnap.ph === "Ask MAV about your skills...");

  /* ---------------- R5 (Tyler, edits post 8/26 meeting) ---------------- */
  await page.evaluate(() => { location.hash = "#/home"; }); await page.waitForTimeout(350);
  vtext = await page.textContent("#view");
  check("R5: Current Assessment Cycle box removed", !vtext.includes("Current Assessment Cycle") && !vtext.includes("Cycle Completion"));
  /* R5b · the home queue was REMOVED in R6 at Tyler's request (his superintendent wants
     durable skills, Portrait and credentials on the landing page). The module and its data
     helpers are kept intact so it can be restored with one call, so the logic stays under
     test even though nothing renders it on Home today. */
  check("R5b/R6: home queue no longer renders on Home", !(await page.isVisible("#view table.av-home").catch(() => false)));
  check("R5b: queue helper still returns six distinct students", await page.evaluate(() => {
    const q = avDistrictQueue(6);
    return q.length === 6 && new Set(q.map(x => x.s.id)).size === 6;
  }));
  check("R5b: no activity repeats", await page.evaluate(() => {
    const q = avDistrictQueue(6);
    return new Set(q.map(x => x.r.act)).size === q.length;
  }));
  check("R5b: no duplicate timestamps", await page.evaluate(() => {
    const q = avDistrictQueue(6);
    return new Set(q.map(x => avWhen(x.s, x.r, x.i))).size === q.length;
  }));
  check("R5b: queue is newest first", await page.evaluate(() => {
    const q = avDistrictQueue(6).map(x => avTime(x.s, x.r, x.i).getTime());
    return q.every((t, i) => i === 0 || t <= q[i - 1]);
  }));
  check("R5b: only students with pending items appear", await page.evaluate(() =>
    avDistrictQueue(6).every(x => avCount(x.s) > 0 && canSee(x.s))));
  check("R5b: a parent submitter carries the student's surname", await page.evaluate(() => {
    const s = STUDENTS.find(x => avPendingFor(x).some(y => y.r.src === "Parent Entry"));
    const row = avPendingFor(s).find(y => y.r.src === "Parent Entry");
    return avBy(s, row.r).endsWith(" " + s.last);
  }));
  check("R5b: Sofia still matches Tyler's printed mock", await page.evaluate(() => {
    const s = getStudent(4), rows = avPendingFor(s);
    return rows.length === 4
      && rows.map(x => x.r.act).join("|") === "Summer Job|Club|Student Council|Volunteer"
      && avWhen(s, rows[0].r, rows[0].i) === "May 22, 2025 2:14 PM"
      && avWhen(s, rows[3].r, rows[3].i) === "May 17, 2025 11:52 AM";
  }));
  check("R5b: Tyler Brooks (the record his doc names) shows the full mock", await page.evaluate(() => {
    const s = STUDENTS.find(x => x.first === "Tyler" && x.last === "Brooks");
    return s && avCount(s) === 4
      && avPendingFor(s).map(x => x.r.act).join("|") === "Summer Job|Club|Student Council|Volunteer";
  }));
  check("R5b: every roster student is reachable without an empty queue surprise", await page.evaluate(() =>
    STUDENTS.filter(canSee).filter(s => avCount(s) > 0).length >= 12));
  await page.evaluate(() => { studentFilters = { status: "Active" }; location.hash = "#/home"; }); await page.waitForTimeout(300);
  vtext = await page.textContent("#view");
  check("R5: competency trend still on home", vtext.includes("Competency Trend"));
  const cyc = async () => page.evaluate(() => ({ ...trendCycles }));
  const chip = async p => page.evaluate(v => document.querySelector('#view [data-period="' + v + '"]').click(), p);
  let cs = await cyc();
  check("R5: Current starts checked, others off", cs["Oct 2026"] && !cs["May 2026"] && !cs["Oct 2025"] && !cs["May 2025"]);
  await chip("Oct 2026"); await page.waitForTimeout(200); cs = await cyc();
  check("R5: Current cannot be unchecked when it is the only cycle", cs["Oct 2026"] === true);
  await chip("May 2026"); await page.waitForTimeout(200);
  await chip("Oct 2026"); await page.waitForTimeout(200); cs = await cyc();
  check("R5: Current can be unchecked once another cycle is checked", cs["Oct 2026"] === false && cs["May 2026"] === true);
  await chip("May 2026"); await page.waitForTimeout(200); cs = await cyc();
  check("R5: unchecking the last cycle re-checks Current", cs["Oct 2026"] === true && !cs["May 2026"]);
  await page.evaluate(() => { document.getElementById("trendClear").click(); }); await page.waitForTimeout(250);

  // R5-3 · Awaiting Verification filter on Students
  await page.evaluate(() => { location.hash = "#/students"; }); await page.waitForTimeout(320);
  const credOpts = await page.$$eval("#fCred option", els => els.map(e => e.textContent.trim()));
  check("R5: Awaiting Verification is the top Credentials option", credOpts[1] === "Awaiting Verification");
  const beforeN = await page.$$eval("#view table.data tbody tr", r => r.length);
  await page.selectOption("#fCred", "Awaiting Verification"); await page.waitForTimeout(320);
  const afterRows = await page.$$eval("#view table.data tbody tr td:nth-child(5)", r => r.map(e => e.textContent.trim()));
  check("R5: filter narrows the list", afterRows.length > 0 && afterRows.length < beforeN);
  check("R5: Credentials column reads Awaiting Verification", afterRows.every(t => t.startsWith("Awaiting Verification")));
  check("R5: filter chip shows Awaiting Verification", (await page.textContent("#view")).includes("Awaiting Verification"));
  check("R5: only students with pending items are listed", await page.evaluate(() =>
    filteredStudents().filter(canSee).every(s => avCount(s) > 0)));
  await shot("30-r5-awaiting-filter");
  await page.evaluate(() => { document.querySelector('#view [data-clear="all"]').click(); }); await page.waitForTimeout(250);

  // R5-4 · Awaiting Verification module on the staff student record (Sofia, id 4)
  await page.evaluate(() => { location.hash = "#/student/4"; }); await page.waitForTimeout(380);
  vtext = await page.textContent("#view");
  check("R5: Credential Progress card removed from staff student view", await page.evaluate(() =>
    ![...document.querySelectorAll("#view .section-title")].some(e => e.textContent.trim() === "Credential Progress")));
  check("R5: Awaiting Verification module present", vtext.includes("Awaiting Verification (4)") && vtext.includes("Accepted (1)") && vtext.includes("Add Feedback"));
  check("R5: module rows match the mock", vtext.includes("Ice Cream Shop") && vtext.includes("Student Council") && vtext.includes("Animal Shelter") && vtext.includes("Student Entry") && vtext.includes("Parent Entry"));
  check("R5: module pagination", vtext.includes("1 – 4 of 4"));
  check("R5: module rows are not clickable", await page.evaluate(() =>
    getComputedStyle(document.querySelector("#view table.data.av tbody tr")).cursor === "default"));
  await shot("31-r5-awaiting-module");
  await page.evaluate(() => { document.querySelector('#view [data-avtab="Accepted"]').click(); }); await page.waitForTimeout(280);
  vtext = await page.textContent("#view");
  check("R5: Accepted tab shows the coach entry", vtext.includes("Football") && vtext.includes("Coach Entry") && vtext.includes("1 – 1 of 1") && !vtext.includes("Ice Cream Shop"));
  await page.evaluate(() => { document.querySelector('#view [data-avtab="Add Feedback"]').click(); }); await page.waitForTimeout(280);
  vtext = await page.textContent("#view");
  check("R5: Add Feedback tab", vtext.includes("Add Feedback for This Student") && ["Faculty","Classmate","Parent","Other"].every(b => vtext.includes(b)));
  await page.evaluate(() => { document.querySelector('#view [data-avtab="Awaiting Verification"]').click(); }); await page.waitForTimeout(250);
  check("R5: student with no pending items gets an empty queue", await page.evaluate(async () => {
    location.hash = "#/student/3"; return true;
  }) && await (async () => { await page.waitForTimeout(320); const t = await page.textContent("#view");
    return t.includes("Awaiting Verification (0)") && t.includes("Nothing in this queue"); })());

  // R5-5 · student dashboard cycle dropdown lives in the Skills Summary card
  await page2.evaluate(() => { location.hash = "#/my-durable-skills"; }); await page2.waitForTimeout(350);
  check("R5: cycle dropdown sits in the Skills Summary card header", await page2.evaluate(() => {
    const sel = document.getElementById("sdCycle");
    if (!sel) return false;
    const head = sel.closest(".section-head");
    return !!head && !sel.closest(".page-head") && /Skills Summary/.test(head.textContent);
  }));
  check("R5: cycle dropdown still switches cycles", await (async () => {
    await page2.selectOption("#sdCycle", "October 2025"); await page2.waitForTimeout(250);
    return (await page2.textContent("#view")).includes("Skills Summary — October 2025");
  })());
  await page2.selectOption("#sdCycle", "May 2026"); await page2.waitForTimeout(200);
  await page2.screenshot({ path: path.join(__dirname, "shots", "32-r5-sd-cycle.png") });

  /* ---------------- R6 (Tyler, post-BOCES superintendent meeting) ---------------- */
  // R6-1 · library opens on My Library
  await page.evaluate(() => { resetToDefaults && resetToDefaults(); location.hash = "#/credentials"; }); await page.waitForTimeout(400);
  check("R6: Skills Builder library defaults to My Library", await page.evaluate(() => sbTab === "My Library"));

  // R6-2 · Tallies retired everywhere on screen
  check("R6: the word Tallies is gone from the credentials page", !(await page.textContent("#view")).includes("Tallies"));

  // R6-3/4 · Educator Input tab and the 2/1/0 grid
  check("R6: Educator Input tab present beside My Library", await page.evaluate(() =>
    SB_TABS[SB_TABS.length - 1] === "Educator Input" && !!document.querySelector('#view [data-sbtab="Educator Input"]')));
  await page.evaluate(() => document.querySelector('#view [data-sbtab="Educator Input"]').click()); await page.waitForTimeout(350);
  vtext = await page.textContent("#view");
  check("R6: grid renders with the five competencies", await page.evaluate(() => {
    const th = [...document.querySelectorAll("#view table.edu thead th")].map(e => e.textContent.trim().replace(/\s+/g, " "));
    return th.length === 7 && COMPS.every(c => th.some(t => t.startsWith(c)));
  }));
  check("R6: ten student rows", await page.$$eval("#view table.edu tbody tr", r => r.length === 10));
  check("R6: grid fits without horizontal overflow at 1440", await page.evaluate(() => {
    const t = document.querySelector("#view table.edu");
    return t.scrollWidth <= t.parentElement.clientWidth + 1;
  }));
  // scoring is one value per student per skill, and clicking again clears it
  const firstBox = '#view table.edu tbody tr:first-child [data-edu$="::Self-Management::2"]';
  await page.evaluate(sel => document.querySelector(sel).click(), firstBox); await page.waitForTimeout(220);
  check("R6: a box scores the student", await page.evaluate(() => Object.values(eduScores).filter(v => v === 2).length >= 1));
  await page.evaluate(sel => document.querySelector(sel.replace("::2", "::1")).click(), firstBox); await page.waitForTimeout(220);
  check("R6: only one value per student per skill", await page.evaluate(() => {
    const s = eduStudents()[0];
    return eduScores[eduKey(s, "Self-Management")] === 1
      && document.querySelectorAll('#view table.edu tbody tr:first-child [data-edu$="::Self-Management::"] .on').length === 0;
  }));
  await page.evaluate(sel => document.querySelector(sel.replace("::2", "::1")).click(), firstBox); await page.waitForTimeout(220);
  check("R6: clicking a checked box clears it", await page.evaluate(() => {
    const s = eduStudents()[0];
    return eduScores[eduKey(s, "Self-Management")] === undefined;
  }));
  // set-all for a row
  await page.evaluate(() => document.querySelector('#view table.edu tbody tr:first-child [data-eduall$="::2"]').click()); await page.waitForTimeout(250);
  check("R6: set all scores every competency in the row", await page.evaluate(() => {
    const s = eduStudents()[0];
    return COMPS.every(c => eduScores[eduKey(s, c)] === 2) && eduScored(s) === 5;
  }));
  await page.evaluate(() => document.querySelector('#view table.edu tbody tr:first-child [data-eduall$="::x"]').click()); await page.waitForTimeout(250);
  check("R6: clear empties the row", await page.evaluate(() => eduScored(eduStudents()[0]) === 0));
  await shot("34-r6-educator-input");
  // the caret drill-down Greg approved in place of a wider grid
  await page.evaluate(() => document.querySelector('#view table.edu thead [data-eduopen="Self-Management"]').click()); await page.waitForTimeout(320);
  check("R6: caret drills into that competency's sub-skills", await page.evaluate(() => {
    const th = [...document.querySelectorAll("#view table.edu thead th")].map(e => e.textContent.trim());
    return eduOpen === "Self-Management" && EDU_SUB["Self-Management"].every(k => th.includes(k)) && th.length === 6;
  }));
  check("R6: every sub-skill comes from COMP_INFO, none invented", await page.evaluate(() =>
    COMPS.every(c => EDU_SUB[c].every(k => COMP_INFO[c].subskills.includes(k)))));
  check("R6: Attention to Detail maps to Self-Management as Tyler specified", await page.evaluate(() =>
    eduParentOf("Attention to Detail") === "Self-Management"));
  check("R6: drill-down also fits without overflow", await page.evaluate(() => {
    const t = document.querySelector("#view table.edu");
    return t.scrollWidth <= t.parentElement.clientWidth + 1;
  }));
  await page.evaluate(() => document.querySelector('#view table.edu tbody tr:first-child [data-edu$="::Time Management::2"]').click()); await page.waitForTimeout(250);
  check("R6: a sub-skill rating rolls up to its parent competency", await page.evaluate(() => {
    const s = eduStudents()[0];
    return eduScores[eduKey(s, "Time Management")] === 2 && eduScored(s) === 1;
  }));
  await shot("35-r6-subskill-drilldown");
  await page.evaluate(() => document.querySelector('#view [data-eduopen=""]').click()); await page.waitForTimeout(300);
  check("R6: back to all five", await page.evaluate(() => eduOpen === null));

  // R6-5 · credential points by contributor, district view of a student only
  await page.evaluate(() => { location.hash = "#/student/4"; }); await page.waitForTimeout(400);
  vtext = await page.textContent("#view");
  check("R6: contributor breakdown on the staff student record", vtext.includes("Credential Points by Contributor"));
  check("R6: the three contributors always sum to the existing total", await page.evaluate(() =>
    STUDENTS.every(s => COMPS.every(c => {
      const v = credSplit(s, c);
      return v.student + v.educator + v.other === credTally(s, c) && v.student >= 0 && v.educator >= 0 && v.other >= 0;
    }))));
  check("R6: Sofia's published totals are untouched", await page.evaluate(() => {
    const s = getStudent(4);
    return credTally(s, "Self-Management") === 240 && credTally(s, "Creativity") === 325 && credTally(s, "Communication") === 220;
  }));
  await shot("36-r6-contributor-split");
  await page2.evaluate(() => { location.hash = "#/my-dashboard"; }); await page2.waitForTimeout(350);
  check("R6: breakdown stays off the student's own dashboard", !(await page2.textContent("#view")).includes("by Contributor"));

  // R6-6/7/8 · home page composition
  await page.evaluate(() => { location.hash = "#/home"; }); await page.waitForTimeout(400);
  vtext = await page.textContent("#view");
  check("R6: Awaiting Verification removed from Home", !vtext.includes("awaiting sign-off") && !(await page.isVisible("#view table.av-home").catch(() => false)));
  check("R6: Credential Progress Percentage now on Home", vtext.includes("Credential Progress Percentage"));
  check("R6: home order is Trend, Percentage of Goal, Graduate Profile", await page.evaluate(() => {
    const t = [...document.querySelectorAll("#view .section-title")].map(e => e.textContent.trim());
    const i = t.findIndex(x => x.startsWith("Competency Trend"));
    const j = t.indexOf("Credential Progress Percentage");
    const k = t.indexOf("Graduate Profile");
    return i > -1 && j > i && k > j;
  }));
  check("R6: Awaiting Verification still lives in the Students filter", await page.evaluate(async () => {
    location.hash = "#/students"; return true;
  }) && await (async () => { await page.waitForTimeout(350);
    const o = await page.$$eval("#fCred option", e => e.map(x => x.textContent.trim()));
    return o[1] === "Awaiting Verification"; })());
  await shot("37-r6-home");

  /* ---------------- R6b (Tyler, 9/2 follow-ups) ---------------- */
  await page.evaluate(() => { location.hash = "#/credentials"; }); await page.waitForTimeout(400);
  vtext = await page.textContent("#view");
  check("R6b: module renamed on Credentials", vtext.includes("Credential Progress Percentage") && !vtext.includes("Percentage of District Goal"));
  await page.evaluate(() => { location.hash = "#/home"; }); await page.waitForTimeout(400);
  vtext = await page.textContent("#view");
  check("R6b: module renamed on Home", vtext.includes("Credential Progress Percentage") && !vtext.includes("Percentage of District Goal"));
  check("R6b: the district-goal phrase never wraps", await page.evaluate(() => {
    const parts = [...document.querySelectorAll("#view .nb, #view .metric-note.nb")];
    return parts.length > 0 && parts.every(e => {
      const lh = parseFloat(getComputedStyle(e).lineHeight) || 20;
      return e.getBoundingClientRect().height < lh * 1.6;
    });
  }));
  // the phrase must also hold on a narrower laptop, which is where Tyler saw it break
  await page3.evaluate(() => { location.hash = "#/student/4"; }); await page3.waitForTimeout(450);
  check("R6b: goal phrase holds one line at 1280 on the student record", await page3.evaluate(() => {
    const parts = [...document.querySelectorAll("#view .sd-sec-title .nb")];
    return parts.length === 2 && parts.every(e => {
      const lh = parseFloat(getComputedStyle(e).lineHeight) || 18;
      return e.getBoundingClientRect().height < lh * 1.6;
    });
  }));
  await page3.evaluate(() => { location.hash = "#/home"; }); await page3.waitForTimeout(400);
  check("R6b: renamed module reads correctly at 1280", (await page3.textContent("#view")).includes("Credential Progress Percentage"));

  check("no page errors", errors.length === 0);
  if (errors.length) console.log("ERRORS:", errors.slice(0, 5));

  await browser.close();
  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nALL CHECKS PASSED");
  process.exit(FAIL.length ? 1 : 0);
})();
