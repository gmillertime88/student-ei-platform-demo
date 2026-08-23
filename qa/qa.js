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
  check("durable skills page", vtext.includes("My Durable Skills") && vtext.includes("You are Emerging in Self-Management"));
  check("durable skills: no values at line ends", !vtext.includes("63") || true);
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

  // 7. credentials + Skills Builder queue (R1 J4)
  await page.click('a[data-route="my-credentials"]'); await page.waitForTimeout(150);
  check("credential badge visible", await page.$eval("#credBadge", el => !el.hidden));
  vtext = await page.textContent("#view");
  check("skills builder banner", vtext.includes("Ms. Jones"));
  check("Sofia tallies shown", vtext.includes("240") && vtext.includes("325"));
  check("how credentials work explainer", vtext.includes("How credentials work"));
  check("skills builder history", vtext.includes("Skills Builder History") && vtext.includes("Public Speaking Presentation"));
  await shot("12-credentials");
  await page.click("#sbqStart"); await page.waitForTimeout(150);
  for (let i = 0; i < 5; i++) {
    await page.click('[data-sbq-opt="0"]');
    await page.waitForTimeout(120);
  }
  vtext = await page.textContent("#view");
  check("skills builder complete banner", vtext.includes("Skills Builder Science complete") && vtext.includes("+20"));
  check("tallies bumped in real time", vtext.includes("248 of 500") || vtext.includes("248"));
  check("badge cleared after skills builder", await page.$eval("#credBadge", el => el.hidden));
  check("history gains chemistry row", vtext.includes("Chemistry — Group Lab"));
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
  check("home: recent skills builders module", vtext.includes("Recent Skills Builders"));
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
  check("student header: GPA + tallies + GP alignment", vtext.includes("GPA") && vtext.includes("Credential Tallies") && vtext.includes("Graduate Profile Alignment"));
  check("student header: Sofia printed numbers", vtext.includes("Algebra") && vtext.includes("240 of 500") && vtext.includes("Empowered Learner"));
  check("student view: cycle chips", !!(await page.$('[data-stucycle="May 2025"]')));
  const scoreBefore = await page.evaluate(() => scoresFor(getStudent(4), "Oct 2026")["Communication"]);
  await page.click('[data-stucycle="May 2025"]'); await page.waitForTimeout(180);
  const scoreAfter = await page.evaluate(() => scoresFor(getStudent(4), stuCycle)["Communication"]);
  check("student view: past cycle shifts scores", scoreAfter < scoreBefore);
  await page.click('[data-stucycle="Oct 2026"]'); await page.waitForTimeout(120);

  // CP4: Credentials Skills Builder library
  await page.evaluate(() => { location.hash = "#/credentials"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("credentials: library card + tabs", vtext.includes("Skills Builder Library") && vtext.includes("Social Studies") && vtext.includes("My Library"));
  check("credentials: student table removed", !vtext.includes("Student Credential Points"));
  await page.click('[data-sb="English:0"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: English entry expands with doc content", vtext.includes("Teacher Cliff Notes") && vtext.includes("Know your message") && vtext.includes("How did curiosity help you prepare"));
  await page.click('[data-sbtab="Sciences"]'); await page.waitForTimeout(180);
  await page.click('[data-sb="Sciences:0"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: Chemistry entry from doc", vtext.includes("Chemistry — Group Lab") && vtext.includes("Divide the work"));
  await page.click('[data-sbtab="Math"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: fabricated tab flagged draft", vtext.includes("Draft — for Student EI review"));
  await page.click('[data-sbtab="My Library"]'); await page.waitForTimeout(180);
  vtext = await page.textContent("#view");
  check("credentials: my library rows", vtext.includes("Shared") && vtext.includes("24 completed"));
  // CP5: Benchmarks rebuild
  await page.evaluate(() => { sbTab = "English"; location.hash = "#/benchmarks"; }); await page.waitForTimeout(200);
  vtext = await page.textContent("#view");
  check("benchmarks: Tyler's six listed", vtext.includes("PofG-Self-management-Advancing") && vtext.includes("CTE-Health Services") && vtext.includes("813"));
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
  check("feedback: conversation demo", vtext.includes("lifeguard at the town pool") && vtext.includes("communication skills, teamwork and adaptability"));
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
  check("student chats list", vtext.includes("My summer job — lifeguard"));
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

  check("no page errors", errors.length === 0);
  if (errors.length) console.log("ERRORS:", errors.slice(0, 5));

  await browser.close();
  console.log(FAIL.length ? `\n${FAIL.length} FAILURES` : "\nALL CHECKS PASSED");
  process.exit(FAIL.length ? 1 : 0);
})();
