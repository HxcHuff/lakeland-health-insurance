// Site-wide search index and functionality
const siteSearchIndex = [
  // Primary individual and family paths
  {
    title: "Individual and Family Health Insurance in Florida",
    url: "/aca-health-insurance-lakeland-fl/",
    excerpt: "Review ACA Marketplace and other individual and family coverage paths around household details, doctors, prescriptions, yearly cost, and timing.",
    tags: ["Under 65", "ACA", "Marketplace", "Individual", "Family", "Individual and Family", "Florida"]
  },
  {
    title: "Florida Individual and Family Coverage Guidance",
    url: "/",
    excerpt: "Start with the right Florida coverage path for individuals and families, including job loss, self-employment, early retirement, household changes, and ACA Marketplace coverage.",
    tags: ["Under 65", "Pre-Medicare", "ACA", "Individual", "Family", "Individual and Family", "Home", "Florida"]
  },
  {
    title: "Losing Health Coverage in Florida",
    url: "/losing-coverage/",
    excerpt: "Review coverage-loss timing and compare COBRA, ACA Marketplace coverage, and other available paths based on your situation.",
    tags: ["Under 65", "Job Loss", "Losing Coverage", "COBRA", "Special Enrollment"]
  },
  {
    title: "Self-Employed Health Insurance in Florida",
    url: "/self-employed-health-insurance/",
    excerpt: "Coverage guidance for business owners, contractors, freelancers, and gig workers using household, income, provider, prescription, and timing details.",
    tags: ["Under 65", "Self-Employed", "1099", "Small Business", "ACA"]
  },
  {
    title: "Retiring Before 65 in Florida",
    url: "/retiring-before-65-florida/",
    excerpt: "Review the transition from employer coverage before Medicare eligibility, including timing, projected household income, doctors, prescriptions, and yearly cost.",
    tags: ["Under 65", "Retiring Before 65", "Early Retirement", "Pre-Medicare", "ACA"]
  },
  {
    title: "Turning 26 Health Insurance Options",
    url: "/turning-26/",
    excerpt: "Review when current coverage ends and how employer, Marketplace, household, and enrollment rules may apply.",
    tags: ["Under 65", "Turning 26", "Coverage Loss", "ACA", "Special Enrollment"]
  },
  {
    title: "Provider and Prescription Check",
    url: "/provider-prescription-check/",
    excerpt: "Prepare the exact plan, provider, facility, prescription, pharmacy, and plan-year details needed for a focused coverage review.",
    tags: ["Under 65", "Doctors", "Provider Networks", "Prescriptions", "Pharmacy"]
  },
  {
    title: "Health Plan Types",
    url: "/plans/",
    excerpt: "Compare major-medical, short-term, supplemental, dental, vision, life, and Medicare paths and the limitations to verify.",
    tags: ["Plans", "Comparison", "Coverage", "Under 65", "Medicare"]
  },

  // Medicare season highlights
  {
    title: "Medicare Plan Review — Lakeland, FL",
    url: "/lp/medicare/",
    excerpt: "Review Medicare options around enrollment timing, doctors, prescriptions, plan rules, and expected costs.",
    tags: ["Medicare", "Lakeland", "Review", "Broker", "Appointment"]
  },
  {
    title: "Compare 2026 Medicare Plans in Lakeland, FL",
    url: "/medicare/",
    excerpt: "Compare 2026 Medicare Advantage, Medicare Supplement, and Part D prescription plans in Lakeland and Polk County.",
    tags: ["Medicare", "Medicare Advantage", "Medicare Supplement", "Part D", "Lakeland"]
  },
  {
    title: "East Polk Medicare Help: Doctors, Drugs & Plan Costs",
    url: "/medicare/east-polk/",
    excerpt: "Medicare plan review for Lake Alfred, Haines City, Davenport, and Winter Haven residents.",
    tags: ["Medicare", "Lake Alfred", "Haines City", "Davenport", "Winter Haven", "East Polk"]
  },
  {
    title: "When Can I Switch Medicare Plans in Florida? (2026 Guide)",
    url: "/blog/when-can-i-switch-medicare-plans-florida.html",
    excerpt: "AEP, MA-OEP, Initial Enrollment, and Special Enrollment Periods explained for Florida and Polk County Medicare clients.",
    tags: ["Medicare", "AEP", "Enrollment", "Switching Plans", "Florida"]
  },
  {
    title: "Turning 65 in Florida: 2026 Medicare Checklist",
    url: "/blog/turning-65-medicare-checklist-florida.html",
    excerpt: "A practical checklist for Florida residents turning 65 and comparing Medicare Advantage, Supplement, and Part D.",
    tags: ["Medicare", "Turning 65", "Initial Enrollment", "Part B", "Part D"]
  },
  {
    title: "Medicare AEP 2026 Polk County Checklist",
    url: "/blog/aep-2026-polk-county-checklist.html",
    excerpt: "A practical Annual Enrollment checklist for doctors, prescriptions, pharmacies, MOOP, and plan changes.",
    tags: ["Medicare", "AEP", "Polk County", "Checklist", "Prescriptions"]
  },
  {
    title: "How Much Does a Medicare Supplement Cost in Lakeland? (2026)",
    url: "/blog/medicare-supplement-cost-lakeland.html",
    excerpt: "Typical Medigap Plan G, Plan N, and high-deductible Plan G cost ranges in Lakeland and what drives rates.",
    tags: ["Medicare", "Medicare Supplement", "Medigap", "Plan G", "Lakeland"]
  },
  // Blog Posts - extracted from blog/index.html
  {
    title: "Can I Take COBRA Instead of Medicare?",
    url: "/blog/cobra-instead-of-medicare-florida.html",
    excerpt: "COBRA may help temporarily, but it generally does not extend the Medicare Part B enrollment window after active employer coverage ends.",
    tags: ["Medicare", "COBRA", "Part B", "Part D", "Employer Coverage", "Florida"]
  },
  {
    title: "Florida Medicaid Renewal Check: What to Do in August 2026",
    url: "/losing-medicaid-florida/",
    excerpt: "A MyACCESS-first checklist for Florida Medicaid renewal notices, requested documents, case-specific deadlines, and coverage transitions.",
    tags: ["Medicaid", "Florida", "Renewal", "Redetermination", "MyACCESS", "Losing Coverage", "Polk County"]
  },
  {
    title: "Can My Family Get Marketplace Coverage Through My Job?",
    url: "/blog/employer-coverage-family-marketplace-affordability-florida.html",
    excerpt: "How 2026 affordability is reviewed separately for employees and offered tax-family members when employer dependent coverage is expensive.",
    tags: ["ACA", "Marketplace", "Employer Coverage", "Family", "Dependents", "Affordability", "Polk County"]
  },
  {
    title: "Can I Get ACA Insurance If I Lost Job Coverage in Florida?",
    url: "/blog/lost-job-coverage-aca-insurance-florida.html",
    excerpt: "ACA Special Enrollment timing, COBRA comparison, subsidy estimates, and what to check after employer coverage ends.",
    tags: ["ACA", "Florida", "Special Enrollment", "Job Loss", "COBRA"]
  },
  {
    title: "What Happens If My ACA Subsidy Is Wrong?",
    url: "/blog/aca-subsidy-wrong-income-florida.html",
    excerpt: "How ACA premium tax credit reconciliation works when income is wrong and when to update HealthCare.gov before tax time.",
    tags: ["ACA", "Florida", "Subsidies", "Tax Credits", "Income"]
  },
  {
    title: "Can I Keep My Doctor If I Switch Medicare Plans?",
    url: "/blog/keep-doctor-switch-medicare-plans-florida.html",
    excerpt: "Doctor networks, plan IDs, hospitals, prescriptions, pharmacies, referrals, and timing checks before switching Medicare plans.",
    tags: ["Medicare", "Florida", "Provider Networks", "Doctors", "Plan Review"]
  },
  {
    title: "What If I Make Too Much for ACA Subsidies in Florida?",
    url: "/blog/health-insurance-too-much-income-aca-subsidy-florida.html",
    excerpt: "Coverage options when premium tax credits do not fit: full-price Marketplace, off-Marketplace major medical, employer coverage, and limited alternatives.",
    tags: ["ACA", "Florida", "Subsidies", "High Income", "Short-Term"]
  },
  {
    title: "High Deductibles, Hospital Bills, and Cash-Flow Risk",
    url: "/blog/high-deductible-hospital-bills-coverage-gap-florida.html",
    excerpt: "How deductibles and hospital cost sharing can create cash-flow risk, and which coverage limitations to verify.",
    tags: ["Deductibles", "Hospital Bills", "Supplemental", "Fixed Indemnity", "Florida"]
  },
  {
    title: "Florida ACA Too Expensive in 2026? Compare Your Options",
    url: "/blog/health-insurance-too-expensive-florida-2026-short-term-options.html",
    excerpt: "A decision framework for Floridians hit by 2026 premium increases: update subsidies, compare ACA plans, check COBRA, and only then review short-term medical or supplemental options.",
    tags: ["ACA", "Florida", "Premiums", "Short-Term", "Strategy"]
  },
  {
    title: "ACA Silver Plans and Cost-Sharing Reductions in Florida",
    url: "/blog/zero-premium-health-insurance-florida-2026.html",
    excerpt: "Review how premium tax credits and cost-sharing reductions may affect Marketplace premiums and Silver-plan cost sharing. The Marketplace determines eligibility.",
    tags: ["ACA", "Florida", "Subsidies", "Silver CSR"]
  },
  {
    title: "Health Insurance After a Life Change in Florida",
    url: "/blog/life-change-health-insurance-60-day-window-florida.html",
    excerpt: "Review whether divorce, job loss, turning 26, a birth, or a move may create a Special Enrollment Period and confirm the applicable timing and documentation.",
    tags: ["ACA", "Florida", "Special Enrollment", "Life Changes"]
  },
  {
    title: "Emergency Room Costs and Uninsured Risk in Lakeland",
    url: "/blog/er-visit-cost-lakeland-without-insurance-2026.html",
    excerpt: "Understand why emergency care can create substantial financial exposure without coverage and which plan details affect out-of-pocket risk.",
    tags: ["Florida", "Lakeland", "Uninsured", "ER Costs"]
  },
  {
    title: "Health Insurance After Job Loss in Lakeland",
    url: "/blog/lost-job-health-insurance-lakeland.html",
    excerpt: "Compare COBRA, ACA Marketplace coverage, Medicaid, and other available paths after job loss, then confirm eligibility, timing, and documentation.",
    tags: ["Job Loss", "ACA", "COBRA", "SEP", "Lakeland"]
  },
  {
    title: "ACA Subsidy Reconciliation and Incorrect Income",
    url: "/blog/aca-subsidy-tax-return-clawback.html",
    excerpt: "Understand premium-tax-credit reconciliation, Form 8962, income updates, and steps to take if application information appears incorrect.",
    tags: ["ACA", "Consumer Protection", "Tax Planning"]
  },
  {
    title: "Non-Income Based Health Insurance Options in Florida (2026 Guide)",
    url: "/blog/non-income-based-health-insurance-florida.html",
    excerpt: "Explore health insurance options in Florida that don't depend on your income. Fixed indemnity, health sharing ministries, short-term plans, DPC, and more alternatives to ACA coverage.",
    tags: ["Florida", "Coverage", "Alternatives"]
  },
  {
    title: "Why Florida Health Insurance Premiums Increased in 2026",
    url: "/blog/why-florida-health-insurance-premiums-increased-2026.html",
    excerpt: "Many Floridians are seeing higher 2026 premiums. Here are the key reasons: subsidy changes, rising healthcare costs, and Marketplace enrollment dynamics.",
    tags: ["Florida", "ACA", "Premiums"]
  },
  {
    title: "Self-Employment Tax Deductions and ICHRA: What Business Owners Need to Know",
    url: "/blog/self-employed-tax-deductions-ichra-guide.html",
    excerpt: "A practical guide to self-employed health insurance deductions and ICHRA strategy in 2026. Learn where each option fits and what to review with your CPA.",
    tags: ["Self-Employed", "Tax Planning", "ICHRA"]
  },
  {
    title: "2026 State of the Union: Healthcare and HSA Takeaways",
    url: "/blog/trump-state-of-the-union-healthcare-hsa-2026.html",
    excerpt: "A source-based review of the address, the HSA rules already in effect, and the details Florida insurance shoppers should verify.",
    tags: ["Opinion", "Healthcare Policy", "HSA"]
  },
  {
    title: "What Is Supplemental Coverage?",
    url: "/blog/what-is-supplemental-coverage.html",
    excerpt: "A clear breakdown of supplemental plans, what they actually cover, and where they fit with ACA or major medical coverage.",
    tags: ["Supplemental", "Coverage", "Plan Types"]
  },
  {
    title: "Florida ACA Enrollment and Benefits Guide (2026)",
    url: "/blog/florida-aca-enrollment-and-benefits-2026.html",
    excerpt: "The statewide master guide for HealthCare.gov enrollment, first-30-day setup, and carrier-specific benefit optimization. Includes direct links to 2026 Polk-relevant carrier playbooks.",
    tags: ["ACA", "Florida", "Open Enrollment"]
  },
  {
    title: "Lakeland Medicare Advantage Plans for 2026: Doctors, Drugs & Costs",
    url: "/blog/medicare-advantage-lakeland-2026.html",
    excerpt: "Compare 2026 Lakeland Medicare Advantage plans by premium, MOOP, prescriptions, and Orlando Health or Watson Clinic access before you enroll.",
    tags: ["Medicare", "Lakeland", "Local"]
  },
  {
    title: "Orlando Health and Watson Clinic Insurance Guide for 2026",
    url: "/blog/orlando-health-watson-clinic-insurance-2026.html",
    excerpt: "Review Orlando Health and Watson Clinic network questions for Lakeland-area ACA and Medicare plan selection before you enroll.",
    tags: ["Lakeland", "Local", "Networks", "Orlando Health", "Watson Clinic"]
  },
  {
    title: "Freelancer Health Insurance in Lakeland: 2026 Guide",
    url: "/blog/freelancer-health-insurance-lakeland-2026.html",
    excerpt: "Compare ACA options, subsidy planning, providers, prescriptions, and total annual exposure for self-employed Lakeland residents.",
    tags: ["Self-Employed", "Lakeland", "ACA"]
  },
  {
    title: "Insurance Claim Denied? A Step-by-Step Review Process",
    url: "/blog/what-to-do-when-insurance-denies-claim.html",
    excerpt: "Review the denial reason, plan documents, provider records, internal appeal process, and external-review options.",
    tags: ["Claims", "Appeals", "Tips"]
  },
  {
    title: "How to Negotiate Hospital Bills",
    url: "/blog/how-to-negotiate-hospital-bills.html",
    excerpt: "Review itemized hospital bills, compare them with the EOB, correct errors, and ask about current financial-assistance or payment options.",
    tags: ["Medical Bills", "Financial", "Tips"]
  },
  {
    title: "HMO vs PPO vs EPO: Health Plan Networks Explained",
    url: "/blog/hmo-vs-ppo-vs-epo-explained.html",
    excerpt: "Compare common network structures, referral rules, out-of-network benefits, and the plan documents to verify before enrolling.",
    tags: ["Plan Types", "Coverage", "Comparison"]
  },
  {
    title: "How the Out-of-Pocket Maximum Works",
    url: "/blog/understanding-out-of-pocket-maximum.html",
    excerpt: "Learn which eligible in-network costs count toward the annual limit and which expenses remain outside it.",
    tags: ["Coverage", "Financial", "Basics"]
  },
  {
    title: "Self-Employed Health Insurance Deduction",
    url: "/blog/health-insurance-self-employed-tax-deductions.html",
    excerpt: "Review eligibility limits, employer-plan restrictions, Form 7206, Schedule 1 reporting, and Marketplace premium tax credit coordination.",
    tags: ["Self-Employed", "Tax Deductions", "Financial"]
  },
  {
    title: "How to Budget for Health Insurance and Medical Costs in 2026",
    url: "/blog/planning-healthcare-budget-2026.html",
    excerpt: "Build a plan-specific budget using annual premiums, expected medical and prescription costs, and a reserve tied to your coverage.",
    tags: ["Financial", "Budgeting", "Tips"]
  },
  {
    title: "Fixed Indemnity, STM & TriTerm Medical Strategy for 2026",
    url: "/blog/fixed-indemnity-analysis.html",
    excerpt: "Review Health ProtectorGuard, short-term medical, TriTerm Medical, ACA, and Medicare together with underwriting, exclusions, and replacement risks in view.",
    tags: ["Products", "Coverage", "Gap Insurance", "Short-Term", "TriTerm"]
  },
  {
    title: "The ACA Subsidy Cliff: Strategic MAGI Management for Tax Optimization",
    url: "/blog/aca-subsidy-cliff.html",
    excerpt: "How household income affects Marketplace premium tax credits, eligibility, and tax-time reconciliation, with current guidance to verify.",
    tags: ["ACA", "Subsidies", "Tax Planning"]
  },
  {
    title: "How to Get Better Help From Your Insurance Agent",
    url: "/blog/no-your-agent-doesnt-hate-you.html",
    excerpt: "Share life changes, plan documents, providers, and prescriptions early so coverage questions can be handled accurately.",
    tags: ["Tips", "Insurance Agents", "Humor"]
  },
  {
    title: "ACA Open Enrollment Preparation Checklist",
    url: "/blog/aca-open-enrollment-deadline.html",
    excerpt: "Prepare household information, projected income, doctors, prescriptions, and plan-comparison criteria before the enrollment window.",
    tags: ["ACA", "Open Enrollment", "Subsidies"]
  },
  {
    title: "Medicare Advantage vs Medicare Supplement: What to Compare",
    url: "/blog/medicare-advantage-vs-supplement.html",
    excerpt: "Compare Medicare Advantage and Medicare Supplement costs, provider access, prescription coverage, enrollment rules, and plan limitations.",
    tags: ["Medicare", "Comparison", "Seniors"]
  },
  {
    title: "5 Health Insurance Mistakes to Avoid",
    url: "/blog/5-critical-health-insurance-mistakes.html",
    excerpt: "Review deductible affordability, provider networks, prescriptions, enrollment timing, and uninsured exposure before choosing coverage.",
    tags: ["ACA", "Mistakes", "Financial"]
  },
  {
    title: "The Pre-Existing Condition Guide",
    url: "/blog/preexisting-condition-guide.html",
    excerpt: "Compare ACA protections with underwriting, exclusions, and waiting periods that may apply to non-ACA coverage.",
    tags: ["Pre-Existing", "Coverage", "ACA"]
  },
  {
    title: "ACA vs Short-Term Coverage: Benefits and Limitations",
    url: "/blog/aca-vs-short-term-plans.html",
    excerpt: "Compare eligibility, underwriting, pre-existing-condition rules, duration, networks, benefits, and exclusions.",
    tags: ["ACA", "Short-Term", "Comparison"]
  },
  {
    title: "Short-Term Medical Insurance in Florida: Uses and Limits",
    url: "/blog/short-term-medical-guide.html",
    excerpt: "Review federal duration limits, underwriting, exclusions, and when short-term coverage may or may not fit a temporary gap.",
    tags: ["Short-Term", "Coverage", "Comparison"]
  },
  {
    title: "How to Use Your Health Insurance and Manage Yearly Costs",
    url: "/blog/how-to-use-health-insurance-without-going-broke.html",
    excerpt: "Review networks, deductibles, copays, coinsurance, prescriptions, authorization rules, claims, and yearly costs.",
    tags: ["Tips", "Coverage", "Financial"]
  },
  {
    title: "The Real Cost of Going Without Health Insurance",
    url: "/blog/real-cost-going-without-health-insurance.html",
    excerpt: "Review the financial exposure associated with emergency, hospital, prescription, and ongoing care without comprehensive coverage.",
    tags: ["Financial", "Uninsured", "Tips"]
  },
  {
    title: "Florida Health Insurance: Coverage and Network Considerations",
    url: "/blog/florida-insurance-guide.html",
    excerpt: "Review Florida enrollment timing, coverage availability, provider networks, prescriptions, and plan-year changes.",
    tags: ["Florida", "State-Specific", "ACA"]
  },
  {
    title: "Dental Insurance: Costs, Limits, and When It May Fit",
    url: "/blog/dental-insurance-guide.html",
    excerpt: "Compare premiums, annual maximums, waiting periods, networks, exclusions, and expected dental costs.",
    tags: ["Dental", "Coverage", "Tips"]
  },
  {
    title: "Short-Term Health Insurance: Uses and Limitations",
    url: "/blog/short-term-health-insurance-guide.html",
    excerpt: "Review duration, underwriting, exclusions, benefit limits, and where short-term coverage may fit a temporary gap.",
    tags: ["Short-Term", "Coverage", "Comparison"]
  },
  {
    title: "Medicare Enrollment Guide",
    url: "/blog/medicare-for-dummies.html",
    excerpt: "A practical Medicare basics guide covering enrollment, plan types, coverage tradeoffs, and the questions to ask before choosing a plan.",
    tags: ["Medicare", "Seniors", "Tips"]
  },
  {
    title: "How to Read Your Health Insurance Card",
    url: "/blog/how-to-read-insurance-card.html",
    excerpt: "Identify member IDs, plan details, prescription fields, service numbers, and effective dates.",
    tags: ["Tips", "Coverage", "Basics"]
  },
  {
    title: "3 Things Changing Florida Health Insurance Right Now",
    url: "/blog/3-things-changing-florida-health-insurance-may-2026.html",
    excerpt: "Three shifts hitting Polk County health insurance in May 2026: subsidy cliff, carrier exits, and Bronze plans now HSA-eligible.",
    tags: ["ACA", "Florida", "Subsidies", "HSA", "Premiums"]
  },
  {
    title: "ACA Subsidy Changes in 2026: What Florida Families Should Review Now",
    url: "/blog/aca-2026-subsidy-expiration-florida-impact.html",
    excerpt: "Review the returned income cliff, subsidy estimates, plan networks, prescriptions, and renewal options before changing ACA coverage.",
    tags: ["ACA", "Florida", "Subsidies", "Premiums"]
  },
  {
    title: "ACA Premiums Are Up in 2026 — Lakeland FL Health Insurance Guide",
    url: "/blog/aca-premiums-2026-lakeland.html",
    excerpt: "Why ACA premiums changed in Lakeland for 2026, who qualifies for an SEP, and how Bronze + HSA plans changed.",
    tags: ["ACA", "Lakeland", "Premiums", "Florida"]
  },
  {
    title: "Why Central Florida Health Insurance Is So Competitive",
    url: "/blog/central-florida-health-insurance-competition.html",
    excerpt: "Central Florida ACA market competition, carrier choices, and what local shoppers should compare before enrolling.",
    tags: ["ACA", "Central Florida", "Competition", "Premiums"]
  },
  {
    title: "Cigna Is Leaving the ACA Marketplace",
    url: "/blog/cigna-exiting-aca-marketplace-polk-county-2026.html",
    excerpt: "What Lakeland and Polk County ACA members should know when a carrier exits the individual market.",
    tags: ["ACA", "Carrier Exit", "Polk County", "Florida"]
  },
  {
    title: "Health Insurance for College Students in Lakeland & Polk County",
    url: "/blog/college-student-health-insurance-lakeland.html",
    excerpt: "Health insurance options for Florida Southern, Polk State, USF, and UCF students living in or commuting from Polk County.",
    tags: ["College", "Lakeland", "ACA", "Florida"]
  },
  {
    title: "2027 Prescription Costs: Health Plan Review Checklist",
    url: "/blog/dont-overlook-rx-costs-2027.html",
    excerpt: "Plan ahead for 2027 by checking prescriptions, pharmacies, and medication changes before choosing coverage.",
    tags: ["Prescriptions", "RX", "ACA", "Medicare", "Planning"]
  },
  {
    title: "Florida ACA Premiums Up 34.1% in 2026",
    url: "/blog/florida-aca-premiums-up-31-percent-2026.html",
    excerpt: "What higher 2026 Florida ACA premiums mean for Lakeland residents and how subsidies affect the real cost.",
    tags: ["ACA", "Florida", "Premiums", "Lakeland"]
  },
  {
    title: "Health Insurance in Brandon FL — 2026 Family Premium Guide",
    url: "/blog/health-insurance-brandon-2026.html",
    excerpt: "Brandon ACA premium changes, family SEP triggers, HSA-eligible Bronze plans, and Medicare GLP-1 bridge considerations.",
    tags: ["ACA", "Florida", "Brandon", "Hillsborough County"]
  },
  {
    title: "Health Insurance in Clearwater FL — 2026 Premium Increases & SEPs",
    url: "/blog/health-insurance-clearwater-2026.html",
    excerpt: "Clearwater ACA premium changes, Special Enrollment Period eligibility, Bronze + HSA strategy, and Medicare GLP-1 bridge considerations.",
    tags: ["ACA", "Florida", "Clearwater", "Pinellas County"]
  },
  {
    title: "Health Insurance in Largo FL — 2026 Premium Increases & Affordable Coverage",
    url: "/blog/health-insurance-largo-2026.html",
    excerpt: "Largo ACA premium changes, Pinellas County SEP eligibility, Bronze + HSA plans, and Medicare GLP-1 bridge considerations.",
    tags: ["ACA", "Florida", "Largo", "Pinellas County"]
  },
  {
    title: "Health Insurance in New Port Richey FL — 2026 Premium Hikes & Pasco County Options",
    url: "/blog/health-insurance-new-port-richey-2026.html",
    excerpt: "New Port Richey ACA premium changes, Pasco County SEPs, Bronze + HSA options, and Medicare GLP-1 bridge considerations.",
    tags: ["ACA", "Florida", "New Port Richey", "Pasco County"]
  },
  {
    title: "Health Insurance in Riverview FL — 2026 Family Premium Changes",
    url: "/blog/health-insurance-riverview-2026.html",
    excerpt: "Riverview ACA premium changes, new-mover SEPs, Family Glitch Fix, Bronze + HSA strategy, and Medicare GLP-1 bridge considerations.",
    tags: ["ACA", "Florida", "Riverview", "Hillsborough County"]
  },
  {
    title: "Health Insurance in St. Petersburg FL — 2026 Premium Changes & Self-Employed Guide",
    url: "/blog/health-insurance-st-petersburg-2026.html",
    excerpt: "St. Petersburg ACA premium changes, self-employed SEPs, HSA-eligible Bronze plans, and Medicare GLP-1 bridge considerations.",
    tags: ["ACA", "Florida", "St Petersburg", "Pinellas County"]
  },
  {
    title: "Health Insurance in Tampa FL — 2026 Premium Changes & SEP Guide",
    url: "/blog/health-insurance-tampa-2026.html",
    excerpt: "Tampa ACA premium changes, Special Enrollment Period eligibility, HSA-eligible Bronze plans, and Medicare GLP-1 bridge considerations.",
    tags: ["ACA", "Florida", "Tampa", "Hillsborough County"]
  },
  {
    title: "Health Insurance in Wesley Chapel FL — 2026 Premium Changes Guide",
    url: "/blog/health-insurance-wesley-chapel-2026.html",
    excerpt: "Wesley Chapel ACA premium changes, new-mover SEPs, Bronze + HSA options, and Medicare GLP-1 bridge considerations.",
    tags: ["ACA", "Florida", "Wesley Chapel", "Pasco County"]
  },
  {
    title: "How to Read Your Health Insurance Card: 2026 Field-by-Field Guide",
    url: "/blog/how-to-read-health-insurance-card-guide.html",
    excerpt: "A field-by-field guide to member ID, group number, BIN, PCN, RxGroup, copays, and plan contact details.",
    tags: ["Tips", "Coverage", "Insurance Card", "Basics"]
  },
  {
    title: "How Lakeland's Growth Is Reshaping Your Health Insurance",
    url: "/blog/lakeland-growth-health-insurance-impact.html",
    excerpt: "How new hospitals, urgent care centers, and population growth affect networks and plan decisions in Polk County.",
    tags: ["Lakeland", "Networks", "Local", "Growth"]
  },
  {
    title: "Medicaid Work Requirements 2026: What Florida Residents Need to Know",
    url: "/blog/medicaid-work-requirements-florida-coverage-2026.html",
    excerpt: "What Medicaid work requirement news means for Florida residents comparing Medicaid, ACA, SEP, and Medicare options.",
    tags: ["Medicaid", "Florida", "ACA", "SEP"]
  },
  {
    title: "Medicare vs. ACA Coverage in Central Florida: What Changes at Age 65",
    url: "/blog/medicare-vs-aca-central-florida-age-65.html",
    excerpt: "Turning 65 in Central Florida? Learn how Medicare changes ACA coverage, enrollment windows, subsidy timing, and coverage-gap risk.",
    tags: ["Medicare", "ACA", "Turning 65", "Central Florida"]
  },
  {
    title: "Mental Health Awareness Month: How to Check Your Therapy Benefits in Lakeland",
    url: "/blog/mental-health-awareness-month-therapy-benefit-lakeland-2026.html",
    excerpt: "How Polk County residents can check therapy benefits, telehealth options, costs, and availability before using coverage.",
    tags: ["Mental Health", "Therapy", "Telehealth", "Lakeland"]
  },
  {
    title: "Orlando Health Lakeland: Early Approval and Quality Signals",
    url: "/blog/orlando-health-lakeland-quality-approval-2026.html",
    excerpt: "What public reporting, social media, licensing, and early quality signals show about the new Lakeland hospital.",
    tags: ["Lakeland", "Networks", "Orlando Health", "Watson Clinic"]
  },
  {
    title: "Orlando Health Lakeland Hospital 2026: What It Means for Your Plan",
    url: "/blog/orlando-health-polk-county-expansion-2026.html",
    excerpt: "How Orlando Health's South Lakeland hospital expansion may affect ACA and Medicare provider network checks.",
    tags: ["Lakeland", "Networks", "Hospital Expansion", "ACA", "Medicare"]
  },
  {
    title: "Now Open: Orlando Health Watson Clinic Network Guide",
    url: "/blog/orlando-health-watson-clinic-doctors-network-2026.html",
    excerpt: "The South Lakeland hospital is open, but doctor, facility, referral, and exact plan-ID participation still require verification.",
    tags: ["Lakeland", "Networks", "Watson Clinic", "Orlando Health"]
  },
  {
    title: "Short-Term Medical vs TriTerm Medical in Florida",
    url: "/blog/short-term-vs-triterm-medical.html",
    excerpt: "Compare Short-Term Medical and TriTerm Medical in Florida, including when ACA may be safer and what to verify before applying.",
    tags: ["Short-Term", "TriTerm", "ACA", "Florida"]
  },
  {
    title: "Why You're Overpaying for Health Insurance in Polk County",
    url: "/blog/why-overpaying-health-insurance-central-florida.html",
    excerpt: "Seven reasons Polk County residents overpay for health insurance and the practical fix for each.",
    tags: ["ACA", "Florida", "Polk County", "Premiums"]
  },
  {
    title: "How Your ZIP Code Affects Health Insurance Pricing in Florida",
    url: "/blog/zip-code-health-insurance-pricing-florida.html",
    excerpt: "Where ZIP code matters for Florida ACA pricing, Medicare options, and provider networks.",
    tags: ["ACA", "Florida", "ZIP Code", "Networks"]
  },

  // Main Pages
  {
    title: "ACA Subsidy Estimator",
    url: "/aca-subsidy-estimator/",
    excerpt: "Estimate how household size and projected income may affect Marketplace premium-tax-credit calculations. The Marketplace determines eligibility.",
    tags: ["Tools", "ACA", "Subsidies", "Calculator"]
  },
  {
    title: "Health Protector Guard",
    url: "/health-protector-guard/",
    excerpt: "Learn about Health Protector Guard fixed-indemnity coverage.",
    tags: ["Products", "Coverage", "Fixed Indemnity"]
  },
  {
    title: "Short-Term Medical and TriTerm Medical",
    url: "/short-term-medical/",
    excerpt: "Review whether Short-Term Medical or TriTerm Medical fits your coverage gap, including underwriting, pre-existing condition limits, networks, deductibles, and supplemental pairings.",
    tags: ["Products", "Coverage", "Short-Term", "TriTerm"]
  },
  {
    title: "About Lakeland Health Insurance",
    url: "/about/",
    excerpt: "Learn about Lakeland Health Insurance and local Florida health coverage guidance.",
    tags: ["About", "Team"]
  },
  {
    title: "Get Personalized Help",
    url: "/get-help/",
    excerpt: "Get a personalized health insurance review and consultation.",
    tags: ["Contact", "Help", "Consultation"]
  },
  {
    title: "Contact Lakeland Health Insurance",
    url: "/contact/",
    excerpt: "Contact Lakeland Health Insurance for health insurance questions and plan review help.",
    tags: ["Contact", "Support"]
  },
  {
    title: "DIME Life Insurance Calculator",
    url: "/life-insurance-dime-method/",
    excerpt: "Calculate your life insurance needs using the DIME method.",
    tags: ["Tools", "Life Insurance", "Calculator"]
  },
  {
    title: "Health Insurance Learning Center",
    url: "/learning/",
    excerpt: "Licensed-broker guides, calculators, official government resources, and plan-review tools for ACA, Medicare, supplemental, and life coverage.",
    tags: ["Learning", "Tools", "ACA", "Medicare", "Florida"]
  },
  {
    title: "Our Approach",
    url: "/our-approach.html",
    excerpt: "See how Lakeland Health Insurance reviews eligibility, providers, prescriptions, plan documents, and total financial exposure.",
    tags: ["About", "Process", "Plan Review"]
  },

  // Carrier Pages
  {
    title: "Health Insurance Carriers",
    url: "/carriers/",
    excerpt: "The insurance carriers we work with and comprehensive guides for each.",
    tags: ["Carriers", "Insurance Companies"]
  },
  {
    title: "UnitedHealthcare ACA 2026 Playbook",
    url: "/carriers/unitedhealthcare-aca-2026/",
    excerpt: "HealthCare.gov enrollment flow, MyUHC setup, and practical benefit-use strategy.",
    tags: ["Carriers", "ACA", "UnitedHealthcare"]
  },
  {
    title: "Oscar ACA 2026 Playbook",
    url: "/carriers/oscar-aca-2026/",
    excerpt: "App-first setup, network verification, and incentive-tracking workflow for 2026.",
    tags: ["Carriers", "ACA", "Oscar"]
  },
  {
    title: "Molina ACA 2026 Playbook",
    url: "/carriers/molina-aca-2026/",
    excerpt: "Portal setup, formulary checks, prior auth workflow, and renewal readiness.",
    tags: ["Carriers", "ACA", "Molina"]
  },
  {
    title: "Ambetter ACA 2026 Playbook",
    url: "/carriers/ambetter-aca-2026/",
    excerpt: "Enrollment steps, referral checks, and preventive-first strategy for maximum value.",
    tags: ["Carriers", "ACA", "Ambetter"]
  },
  {
    title: "Wellpoint ACA 2026 Playbook",
    url: "/carriers/wellpoint-aca-2026/",
    excerpt: "Virtual-first optimization, incentives workflow, and annual plan-change checklist.",
    tags: ["Carriers", "ACA", "Wellpoint"]
  },
];

// Search functionality
class SiteSearch {
  constructor() {
    this.searchInput = null;
    this.resultsDropdown = null;
    this.currentFocusIndex = -1;
  }

  init() {
    const searchBars = document.querySelectorAll('[data-site-search="bar"]');

    searchBars.forEach(bar => {
      const input = bar.querySelector('input');
      const dropdown = bar.querySelector('[data-site-search="results"]');

      if (input && dropdown) {
        input.addEventListener('input', (e) => this.handleSearch(e, dropdown));
        input.addEventListener('keydown', (e) => this.handleKeyboard(e, dropdown, input));
        input.addEventListener('focus', (e) => this.handleFocus(e, dropdown));

        bar.parentElement.querySelectorAll('[data-search-suggestion]').forEach(button => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            input.value = button.getAttribute('data-search-suggestion') || '';
            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
          });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
          if (!bar.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        });
      }
    });
  }

  handleSearch(event, dropdown) {
    const query = event.target.value.trim().toLowerCase();
    this.currentFocusIndex = -1;
    dropdown.dataset.searchQuery = query;

    if (query.length < 2) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    const results = this.search(query);
    this.renderResults(results, dropdown);
    dropdown.style.display = 'block';
  }

  handleFocus(event, dropdown) {
    const query = event.target.value.trim().toLowerCase();
    if (query.length >= 2) {
      dropdown.style.display = 'block';
    }
  }

  handleKeyboard(event, dropdown, input) {
    const query = input.value.trim().toLowerCase();

    // Keep the keyboard action tied to the text currently in the input. This
    // prevents a previously highlighted result from opening after the query
    // changes, including when a browser restores an input value.
    if (query.length >= 2 && dropdown.dataset.searchQuery !== query) {
      this.currentFocusIndex = -1;
      dropdown.dataset.searchQuery = query;
      this.renderResults(this.search(query), dropdown);
      dropdown.style.display = 'block';
    }

    const resultItems = dropdown.querySelectorAll('[data-search-result]');

    switch(event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.currentFocusIndex = Math.min(this.currentFocusIndex + 1, resultItems.length - 1);
        this.updateFocus(resultItems);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.currentFocusIndex = Math.max(this.currentFocusIndex - 1, -1);
        this.updateFocus(resultItems);
        break;
      case 'Enter':
        if (resultItems.length > 0) {
          event.preventDefault();
          const targetIndex = this.currentFocusIndex >= 0 ? this.currentFocusIndex : 0;
          const url = resultItems[targetIndex].getAttribute('data-search-result');
          window.location.href = url;
        }
        break;
      case 'Escape':
        dropdown.style.display = 'none';
        break;
    }
  }

  updateFocus(resultItems) {
    resultItems.forEach((item, index) => {
      item.classList.toggle('search-result-focused', index === this.currentFocusIndex);
    });

    if (this.currentFocusIndex >= 0 && resultItems[this.currentFocusIndex]) {
      resultItems[this.currentFocusIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  search(query) {
    return siteSearchIndex.map((page, index) => {
      const title = page.title.toLowerCase();
      const excerpt = page.excerpt.toLowerCase();
      const tags = page.tags.map(tag => tag.toLowerCase());
      const tokens = query.split(/\s+/).filter(Boolean);
      const searchable = [title, excerpt].concat(tags).join(' ');
      var score = 0;
      if (title.includes(query)) score = 4;
      else if (tags.some(tag => tag === query)) score = 3;
      else if (tags.some(tag => tag.includes(query))) score = 2;
      else if (excerpt.includes(query)) score = 1;
      else if (tokens.length > 1 && tokens.every(token => searchable.includes(token))) score = 1;
      return { page, index, score };
    }).filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 8)
      .map(result => result.page);
  }

  renderResults(results, dropdown) {
    const html = results.map(result => `
      <a href="${result.url}" class="search-result" data-search-result="${result.url}">
        <div class="search-result-title">${this.highlightQuery(result.title)}</div>
        <div class="search-result-excerpt">${this.highlightQuery(result.excerpt)}</div>
      </a>
    `).join('');

    dropdown.innerHTML = html || '<div class="search-no-results" role="status">No matching articles found. Try a broader search.</div>';
  }

  highlightQuery(text) {
    return text;
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SiteSearch().init();
  });
} else {
  new SiteSearch().init();
}
