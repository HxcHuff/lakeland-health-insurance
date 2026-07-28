// Site-wide search index and functionality
const siteSearchIndex = [
  // Medicare season highlights
  {
    title: "Medicare Plan Review — Lakeland, FL",
    url: "/lp/medicare/",
    excerpt: "Get a no-pressure review of your Medicare options with licensed Florida coverage guidance.",
    tags: ["Medicare", "Lakeland", "Review", "Broker", "Appointment"]
  },
  {
    title: "Compare 2026 Medicare Plans in Lakeland, FL",
    url: "/medicare/",
    excerpt: "Compare 2026 Medicare Advantage, Medicare Supplement, and Part D prescription plans in Lakeland and Polk County.",
    tags: ["Medicare", "Medicare Advantage", "Medicare Supplement", "Part D", "Lakeland"]
  },
  {
    title: "East Polk Medicare Help",
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
    title: "Turning 65 in Florida? Medicare Checklist",
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
    title: "The Coverage Gap Nobody Talks About: High Deductibles and Hospital Bills",
    url: "/blog/high-deductible-hospital-bills-coverage-gap-florida.html",
    excerpt: "Why people with real health insurance can still panic over high deductibles, hospital bills, and cash-flow risk - and when supplemental coverage may fit.",
    tags: ["Deductibles", "Hospital Bills", "Supplemental", "Fixed Indemnity", "Florida"]
  },
  {
    title: "Florida ACA Too Expensive in 2026? Compare Your Options",
    url: "/blog/health-insurance-too-expensive-florida-2026-short-term-options.html",
    excerpt: "A decision framework for Floridians hit by 2026 premium increases: update subsidies, compare ACA plans, check COBRA, and only then review short-term medical or supplemental options.",
    tags: ["ACA", "Florida", "Premiums", "Short-Term", "Strategy"]
  },
  {
    title: "$0 Premium Health Insurance in Florida: How Silver CSR Plans Give You Better Coverage Than Gold",
    url: "/blog/zero-premium-health-insurance-florida-2026.html",
    excerpt: "Most Florida families qualify for a $0 premium Silver plan with better coverage than Gold — thanks to Cost Sharing Reductions most people don't know exist.",
    tags: ["ACA", "Florida", "Subsidies", "Silver CSR"]
  },
  {
    title: "Life Change? You Have 60 Days to Get Health Insurance in Florida",
    url: "/blog/life-change-health-insurance-60-day-window-florida.html",
    excerpt: "Divorced, lost your job, turning 26, having a baby, or just moved? You qualify for a Special Enrollment Period — but the 60-day clock is already ticking.",
    tags: ["ACA", "Florida", "Special Enrollment", "Life Changes"]
  },
  {
    title: "What an ER Visit Actually Costs in Lakeland Without Insurance (2026)",
    url: "/blog/er-visit-cost-lakeland-without-insurance-2026.html",
    excerpt: "A broken arm runs $2,500–$7,500. A chest pain workup hits $5,000–$15,000. An appendectomy? $25,000–$45,000. One ER visit could cost more than a year of coverage.",
    tags: ["Florida", "Lakeland", "Uninsured", "ER Costs"]
  },
  {
    title: "Lost Your Job in Lakeland? Here's What to Do About Health Insurance (You Have 60 Days)",
    url: "/blog/lost-job-health-insurance-lakeland.html",
    excerpt: "Just lost your job in Lakeland or Polk County? You have 60 days to get health insurance. Here's exactly what to do — COBRA vs. ACA Marketplace, subsidies, Medicaid, and why you probably qualify for $0 or low-cost coverage.",
    tags: ["Job Loss", "ACA", "COBRA", "SEP", "Lakeland"]
  },
  {
    title: "ACA Subsidy Clawback: What Happens When Your Agent Lied About Your Income",
    url: "/blog/aca-subsidy-tax-return-clawback.html",
    excerpt: "Learn what happens when an insurance agent falsifies your income for maximum ACA subsidies. Understand Form 8962 reconciliation, potential $2K-$8K+ clawbacks, and how to protect yourself.",
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
    title: "My Take: Trump's 2026 State of the Union on Healthcare and HSAs",
    url: "/blog/trump-state-of-the-union-healthcare-hsa-2026.html",
    excerpt: "An opinion column on what was said, what was not said about HSAs, and what Florida families should actually do with their coverage decisions.",
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
    title: "The Freelancer's Guide to Health Insurance in Lakeland & Polk County (2026)",
    url: "/blog/freelancer-health-insurance-lakeland-2026.html",
    excerpt: "Expert guide for self-employed freelancers in Lakeland, FL. Discover ACA marketplace plans, subsidy strategies, and Polk County healthcare options for 2026.",
    tags: ["Self-Employed", "Lakeland", "ACA"]
  },
  {
    title: "Insurance Denied Your Claim? Fight Back.",
    url: "/blog/what-to-do-when-insurance-denies-claim.html",
    excerpt: "Don't accept a denied insurance claim without a fight. Here's exactly how to appeal and overturn denials — step by step, with actual success strategies.",
    tags: ["Claims", "Appeals", "Tips"]
  },
  {
    title: "How to Negotiate Hospital Bills",
    url: "/blog/how-to-negotiate-hospital-bills.html",
    excerpt: "Hospital bills are negotiable. Here's exactly how to negotiate medical debt, request itemized bills, spot errors, and cut your costs by 50% or more.",
    tags: ["Medical Bills", "Financial", "Tips"]
  },
  {
    title: "HMO vs PPO vs EPO: Decoded",
    url: "/blog/hmo-vs-ppo-vs-epo-explained.html",
    excerpt: "Confused about HMO, PPO, and EPO health plans? Here's exactly how they differ, which costs more, and which gives you the most freedom to choose doctors.",
    tags: ["Plan Types", "Coverage", "Comparison"]
  },
  {
    title: "Out-of-Pocket Maximum: Your Financial Safety Net",
    url: "/blog/understanding-out-of-pocket-maximum.html",
    excerpt: "The out-of-pocket maximum is the most important number in your health insurance policy. Here's exactly how it works and why it could save you from financial disaster.",
    tags: ["Coverage", "Financial", "Basics"]
  },
  {
    title: "Self-Employed? Deduct Your Health Insurance",
    url: "/blog/health-insurance-self-employed-tax-deductions.html",
    excerpt: "If you're self-employed, you can deduct 100% of your health insurance premiums. Here's exactly how to claim this deduction and save thousands on taxes.",
    tags: ["Self-Employed", "Tax Deductions", "Financial"]
  },
  {
    title: "How to Budget for Healthcare in 2026",
    url: "/blog/planning-healthcare-budget-2026.html",
    excerpt: "Learn how to accurately budget for healthcare costs including premiums, deductibles, and out-of-pocket expenses. Real strategies for planning your medical spending in 2026.",
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
    excerpt: "Expert analysis of the 400% FPL subsidy threshold, Inflation Reduction Act changes through 2025, and strategic income management to minimize tax-time repayments.",
    tags: ["ACA", "Subsidies", "Tax Planning"]
  },
  {
    title: "Why Your Insurance Agent Probably Hates You (And How to Fix That)",
    url: "/blog/no-your-agent-doesnt-hate-you.html",
    excerpt: "Let's be honest — if your insurance agent could block your number without losing commission, they probably would. Here's how to become the client they actually want to help.",
    tags: ["Tips", "Insurance Agents", "Humor"]
  },
  {
    title: "ACA Open Enrollment 2025: How to Get Ready for the Best Coverage",
    url: "/blog/aca-open-enrollment-deadline.html",
    excerpt: "Get ready for ACA open enrollment with expert tips. Learn how to maximize subsidies and avoid costly mistakes during the enrollment window.",
    tags: ["ACA", "Open Enrollment", "Subsidies"]
  },
  {
    title: "Medicare Advantage vs Medicare Supplement: The Ultimate Showdown",
    url: "/blog/medicare-advantage-vs-supplement.html",
    excerpt: "The real differences between Medicare Advantage and Medicare Supplement plans. No BS analysis of which option won't leave you broke when you need care most.",
    tags: ["Medicare", "Comparison", "Seniors"]
  },
  {
    title: "5 Critical Health Insurance Mistakes That Could Cost You Thousands",
    url: "/blog/5-critical-health-insurance-mistakes.html",
    excerpt: "Don't let these common health insurance blunders drain your bank account. From choosing the wrong deductible to missing enrollment deadlines, we break down the mistakes that could leave you financially vulnerable.",
    tags: ["ACA", "Mistakes", "Financial"]
  },
  {
    title: "The Pre-Existing Condition Guide",
    url: "/blog/preexisting-condition-guide.html",
    excerpt: "Navigate the complex world of pre-existing conditions with confidence. Learn how to find coverage, understand waiting periods, and avoid the traps that leave you unprotected.",
    tags: ["Pre-Existing", "Coverage", "ACA"]
  },
  {
    title: "ACA vs Short-Term Plans: Which is Actually Right for You?",
    url: "/blog/aca-vs-short-term-plans.html",
    excerpt: "The eternal debate. We'll cut through the marketing fluff and give you the real pros and cons of each option, because your health (and wallet) deserve the truth.",
    tags: ["ACA", "Short-Term", "Comparison"]
  },
  {
    title: "Short-Term Medical Insurance: The Good, Bad, and Ugly Truth",
    url: "/blog/short-term-medical-guide.html",
    excerpt: "When short-term medical insurance makes sense and when it doesn't. Get the real truth about short-term medical coverage from a licensed insurance professional.",
    tags: ["Short-Term", "Coverage", "Comparison"]
  },
  {
    title: "How to Actually Use Your Health Insurance (Without Going Broke)",
    url: "/blog/how-to-use-health-insurance-without-going-broke.html",
    excerpt: "Having insurance is step one. Using it without triggering financial ruin is step two. Here's your guide to deductibles, copays, and other fun surprises.",
    tags: ["Tips", "Coverage", "Financial"]
  },
  {
    title: "The Real Cost of Going Without Health Insurance",
    url: "/blog/real-cost-going-without-health-insurance.html",
    excerpt: "Think you're saving money by skipping insurance? We've crunched the numbers on what happens when life decides to throw you a curveball.",
    tags: ["Financial", "Uninsured", "Tips"]
  },
  {
    title: "Florida Health Insurance: Navigating the Sunshine State's Challenges",
    url: "/blog/florida-insurance-guide.html",
    excerpt: "From hurricanes to humidity-induced existential crises, Florida has its own special insurance considerations. Here's what you need to know.",
    tags: ["Florida", "State-Specific", "ACA"]
  },
  {
    title: "Dental Insurance: Worth It or Just Another Way to Fund Your Dentist's Yacht?",
    url: "/blog/dental-insurance-guide.html",
    excerpt: "The tooth about dental coverage. When it makes sense, when it doesn't, and how to avoid getting drilled on costs.",
    tags: ["Dental", "Coverage", "Tips"]
  },
  {
    title: "Short-Term Health Insurance: Lifesaver or Financial Trap?",
    url: "/blog/short-term-health-insurance-guide.html",
    excerpt: "When short-term plans make sense and when they're basically expensive tissue paper for your medical bills.",
    tags: ["Short-Term", "Coverage", "Comparison"]
  },
  {
    title: "Medicare for Dummies (No Offense)",
    url: "/blog/medicare-for-dummies.html",
    excerpt: "A practical Medicare basics guide covering enrollment, plan types, coverage tradeoffs, and the questions to ask before choosing a plan.",
    tags: ["Medicare", "Seniors", "Tips"]
  },
  {
    title: "How to Read Your Insurance Card Without Having a Panic Attack",
    url: "/blog/how-to-read-insurance-card.html",
    excerpt: "Decode all those mysterious numbers and acronyms so you can actually use your insurance like a pro.",
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
    title: "Don't Overlook Prescription Costs for 2027",
    url: "/blog/dont-overlook-rx-costs-2027.html",
    excerpt: "Plan ahead for 2027 by checking prescriptions, pharmacies, and medication changes before choosing coverage.",
    tags: ["Prescriptions", "RX", "ACA", "Medicare", "Planning"]
  },
  {
    title: "Florida Health Insurance Premiums Are Up 31% in 2026",
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
    title: "Orlando Health Expansion and Watson Clinic Doctors: The Network Issue",
    url: "/blog/orlando-health-watson-clinic-doctors-network-2026.html",
    excerpt: "Why hospital expansion does not automatically solve the doctor-network question for Watson Clinic patients.",
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
    title: "Health Insurance Broker in Lakeland, FL — ACA, Medicare & More",
    url: "/",
    excerpt: "Licensed Lakeland health insurance guidance for Polk County families comparing 2026 ACA, Medicare, and Guard plans.",
    tags: ["Home", "ACA", "Medicare", "Lakeland"]
  },
  {
    title: "ACA Subsidy Estimator",
    url: "/aca-subsidy-estimator/",
    excerpt: "Calculate your estimated ACA subsidies and see what you might qualify for.",
    tags: ["Tools", "ACA", "Subsidies", "Calculator"]
  },
  {
    title: "Health Plans Comparison",
    url: "/plans/",
    excerpt: "Compare health insurance plans and find the right coverage for your needs.",
    tags: ["Plans", "Comparison", "Coverage"]
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
    title: "ACA Health Insurance for Lakeland, FL",
    url: "/aca-health-insurance-lakeland-fl/",
    excerpt: "ACA marketplace health insurance options for Lakeland and Polk County residents.",
    tags: ["ACA", "Lakeland", "Florida"]
  },
  {
    title: "Our Approach",
    url: "/our-approach.html",
    excerpt: "Learn about our approach to helping families find the right health insurance.",
    tags: ["About", "Philosophy"]
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
          button.addEventListener('click', () => {
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

    if (query.length < 2) {
      dropdown.style.display = 'none';
      return;
    }

    const results = this.search(query);
    this.renderResults(results, dropdown);

    if (results.length > 0) {
      dropdown.style.display = 'block';
    } else {
      dropdown.style.display = 'none';
    }
  }

  handleFocus(event, dropdown) {
    const query = event.target.value.trim().toLowerCase();
    if (query.length >= 2) {
      dropdown.style.display = 'block';
    }
  }

  handleKeyboard(event, dropdown, input) {
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
        event.preventDefault();
        if (this.currentFocusIndex >= 0 && resultItems[this.currentFocusIndex]) {
          const url = resultItems[this.currentFocusIndex].getAttribute('data-search-result');
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
    return siteSearchIndex.filter(page => {
      const titleMatch = page.title.toLowerCase().includes(query);
      const excerptMatch = page.excerpt.toLowerCase().includes(query);
      const tagsMatch = page.tags.some(tag => tag.toLowerCase().includes(query));
      return titleMatch || excerptMatch || tagsMatch;
    }).slice(0, 8);
  }

  renderResults(results, dropdown) {
    const html = results.map(result => `
      <a href="${result.url}" class="search-result" data-search-result="${result.url}">
        <div class="search-result-title">${this.highlightQuery(result.title)}</div>
        <div class="search-result-excerpt">${this.highlightQuery(result.excerpt)}</div>
      </a>
    `).join('');

    dropdown.innerHTML = html || '<div class="search-no-results">No results found</div>';
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
