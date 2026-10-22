// Site-wide search index and functionality
const siteSearchIndex = [
  // Primary individual and family paths
  {
    title: "Health Insurance Broker in Lakeland, FL",
    url: "/health-insurance-broker-lakeland-fl/",
    excerpt: "How to choose a licensed Lakeland agent. “Best” means a multi-carrier review of doctors, prescriptions, cost, and timing—not a ranking.",
    tags: ["Broker", "Agent", "Lakeland", "Polk County", "How to Choose", "ACA", "Medicare", "Local"]
  },
  {
    title: "Polk County ACA Health Insurance Agent",
    url: "/aca-health-insurance-agent-polk-county-fl/",
    excerpt: "Licensed Polk County ACA agent in Lakeland. Review eligibility, doctors, prescriptions, cost, and timing. You authorize HealthCare.gov. No separate agent fee.",
    tags: ["ACA Agent", "Polk County ACA Agent", "Polk County", "Lakeland", "Marketplace", "Doctors", "Prescriptions"]
  },
  {
    title: "Individual and Family Health Insurance in Florida",
    url: "/aca-health-insurance-lakeland-fl/",
    excerpt: "Review ACA Marketplace eligibility, doctors, prescriptions, and individual and family coverage paths for Lakeland and Polk County. You authorize HealthCare.gov.",
    tags: ["Under 65", "ACA", "Marketplace", "Individual", "Family", "Individual and Family", "Florida", "Polk County", "Agent"]
  },
  {
    title: "Florida Individual and Family Coverage Guidance",
    url: "/",
    excerpt: "Licensed Florida health agent David Huff reviews Lakeland ACA and Medicare around doctors, prescriptions, and yearly cost. Start a plan review in the Coverage Center.",
    tags: ["Under 65", "Pre-Medicare", "ACA", "Individual", "Family", "Individual and Family", "Home", "Florida"]
  },
  {
    title: "Losing Health Coverage in Florida",
    url: "/losing-coverage/",
    excerpt: "Who can help after a job loss in Lakeland: a licensed local agent compares COBRA, Marketplace, and SEP deadlines.",
    tags: ["Under 65", "Job Loss", "Losing Coverage", "COBRA", "Special Enrollment"]
  },
  {
    title: "Self-Employed Health Insurance in Florida",
    url: "/self-employed-health-insurance/",
    excerpt: "Florida self-employed options with a local Lakeland agent. Start with projected household income, then compare networks and enrollment windows.",
    tags: ["Under 65", "Self-Employed", "1099", "Small Business", "ACA"]
  },
  {
    title: "Retiring Before 65 in Florida",
    url: "/retiring-before-65-florida/",
    excerpt: "Review the transition from employer coverage before Medicare eligibility, including the date current coverage ends, projected household income, doctors, prescriptions, and yearly cost.",
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
    title: "States I'm Licensed In",
    url: "/states/",
    excerpt: "David Huff is licensed in 23 states. Choose your state for Marketplace names, 2027 open enrollment dates, and a remote ACA plan review.",
    tags: ["States", "License", "Marketplace", "ACA", "Multi-state", "Kansas"]
  },
  {
    title: "Texas ACA Health Insurance Agent",
    url: "/health-insurance-texas/",
    excerpt: "Licensed in Texas. A 2027 HealthCare.gov plan review around doctors, prescriptions, and income. No separate agent fee.",
    tags: ["Texas", "ACA", "Marketplace", "HealthCare.gov"]
  },
  {
    title: "North Carolina ACA Health Insurance Agent",
    url: "/health-insurance-north-carolina/",
    excerpt: "Licensed in North Carolina. A 2027 HealthCare.gov plan review around doctors, prescriptions, and income. No separate agent fee.",
    tags: ["North Carolina", "ACA", "Marketplace", "HealthCare.gov"]
  },
  {
    title: "South Carolina ACA Health Insurance Agent",
    url: "/health-insurance-south-carolina/",
    excerpt: "Licensed in South Carolina. A 2027 HealthCare.gov plan review around doctors, prescriptions, and income. No separate agent fee.",
    tags: ["South Carolina", "ACA", "Marketplace", "HealthCare.gov"]
  },
  {
    title: "Tennessee ACA Health Insurance Agent",
    url: "/health-insurance-tennessee/",
    excerpt: "Licensed in Tennessee. A 2027 HealthCare.gov plan review around doctors, prescriptions, and income. No separate agent fee.",
    tags: ["Tennessee", "ACA", "Marketplace", "HealthCare.gov"]
  },
  {
    title: "Alabama ACA Health Insurance Agent",
    url: "/health-insurance-alabama/",
    excerpt: "Licensed in Alabama. A 2027 HealthCare.gov plan review around doctors, prescriptions, and income. No separate agent fee.",
    tags: ["Alabama", "ACA", "Marketplace", "HealthCare.gov"]
  },
  {
    title: "CMS Marketplace Agent Crackdown: Lakeland FL Guide (2026)",
    url: "/marketplace-agent-fraud-cms-crackdown-florida/",
    excerpt: "CMS canceled unauthorized Marketplace enrollments and sent agent termination notices. What Lakeland and Polk shoppers should check before Open Enrollment.",
    tags: ["ACA", "Marketplace", "CMS", "Agent", "Authorization", "Florida", "Lakeland", "Polk County", "Consumer Protection"]
  },
  {
    title: "Florida Coverage Paths | ACA & Plan Review",
    url: "/plans/",
    excerpt: "Pick a Florida starting point—ACA Marketplace, Medicare, coverage loss, or extra coverage—then continue to a licensed Lakeland plan review.",
    tags: ["Plans", "Comparison", "Coverage", "Under 65", "Medicare"]
  },
  {
    title: "Private Medical Insurance in Florida",
    url: "/private-medical-insurance/",
    excerpt: "Compare ACA Marketplace, plans purchased directly from insurance companies, short-term medical, and supplemental coverage in Florida.",
    tags: ["Products", "Coverage", "Private Health Insurance", "Private Medical Insurance", "ACA", "Short-Term", "Florida"]
  },

  // Medicare guidance
  {
    title: "Medicare Help in Lakeland, FL | Doctors, Rx & 2027 AEP",
    url: "/medicare/",
    excerpt: "Local Medicare review for Lakeland and Polk County. Compare 2027 Advantage, Medigap, and Part D around doctors, prescriptions, and timing.",
    tags: ["Medicare", "Medicare Advantage", "Original Medicare", "Medicare Supplement", "Medigap", "Part D", "Lakeland", "Polk County", "2027"]
  },
  {
    title: "Medicare Broker in Lakeland, FL | Doctors, Rx & AEP Review",
    url: "/medicare-broker-lakeland-fl/",
    excerpt: "Licensed Florida health agent compares Advantage, Medigap, and Part D around your doctors and prescriptions. No separate agent fee.",
    tags: ["Medicare", "Broker", "Agent", "Lakeland", "Polk County", "AEP", "Doctors", "Prescriptions"]
  },
  {
    title: "Working Past 65 in Lakeland: Medicare vs Employer Coverage",
    url: "/working-past-65-medicare-lakeland-fl/",
    excerpt: "When to start Medicare Parts A and B if you still have current-employer group coverage, and how COBRA, retiree, HSA, and Part D rules differ.",
    tags: ["Medicare", "Working Past 65", "Part B", "Employer Coverage", "Special Enrollment", "Lakeland", "Polk County"]
  },
  {
    title: "Retiring in Lakeland and Need Medicare: What to Do, Step by Step",
    url: "/retiring-and-medicare-lakeland-fl/",
    excerpt: "Turning 65 as you retire or leaving employer coverage after 65 in Polk County: IEP and SEP timing, Part B start dates, Advantage vs Medigap, and doctor checks.",
    tags: ["Medicare", "Retiring", "Part B", "Initial Enrollment", "Special Enrollment", "Lakeland", "Polk County"]
  },
  {
    title: "East Polk Medicare Help: Doctors, Drugs & Plan Costs",
    url: "/medicare/east-polk/",
    excerpt: "Medicare plan review for Lake Alfred, Haines City, Davenport, and Winter Haven residents.",
    tags: ["Medicare", "Lake Alfred", "Haines City", "Davenport", "Winter Haven", "East Polk"]
  },
  {
    title: "When Can I Switch Medicare Plans in Florida? Every Window",
    url: "/blog/when-can-i-switch-medicare-plans-florida.html",
    excerpt: "Annual Enrollment runs Oct 15 to Dec 7 and Medicare Advantage Open Enrollment runs Jan 1 to Mar 31, plus the special periods that allow mid-year changes.",
    tags: ["Medicare", "AEP", "Enrollment", "Switching Plans", "Florida"]
  },
  {
    title: "Turning 65 in Florida: 2026 Medicare Checklist",
    url: "/blog/turning-65-medicare-checklist-florida.html",
    excerpt: "A practical checklist for Florida residents turning 65 and comparing Medicare Advantage, Supplement, and Part D.",
    tags: ["Medicare", "Turning 65", "Initial Enrollment", "Part B", "Part D"]
  },
  {
    title: "Medicare Open Enrollment Checklist for Polk County",
    url: "/blog/aep-2026-polk-county-checklist.html",
    excerpt: "Annual Enrollment runs Oct 15 to Dec 7. Check your doctors, prescriptions, and total yearly costs before you switch Medicare plans in Polk County.",
    tags: ["Medicare", "AEP", "Polk County", "Checklist", "Prescriptions"]
  },
  {
    title: "How Much Does a Medicare Supplement Cost in Lakeland? (2026)",
    url: "/blog/medicare-supplement-cost-lakeland.html",
    excerpt: "Typical Medigap Plan G, Plan N, and high-deductible Plan G cost ranges in Lakeland and what drives rates.",
    tags: ["Medicare", "Medicare Supplement", "Medigap", "Plan G", "Lakeland"]
  },
  {
    title: "Lakeland City Retiree Spouse on Medicare: What to Check",
    url: "/blog/city-of-lakeland-retiree-medicare-spouse-premium.html",
    excerpt: "Before moving a Medicare spouse off the City of Lakeland plan, check Part A and B, Medigap approval, Part D timing, and the city's re-entry rules.",
    tags: ["Medicare", "Medicare Supplement", "Part D", "Lakeland", "City of Lakeland", "Retiree", "Medigap"]
  },
  {
    title: "Medigap Plan G vs Plan N Comparison in Lakeland, FL",
    url: "/blog/medigap-plan-g-vs-plan-n.html",
    excerpt: "Compare standardized Plan G and Plan N for Lakeland and Polk County: cost sharing, Part B excess charges, Part D, and Florida underwriting.",
    tags: ["Medicare", "Medicare Supplement", "Medigap", "Plan G", "Plan N", "Lakeland", "Polk County"]
  },
  // Blog Posts - extracted from blog/index.html
  {
    title: "Florida Medicaid Renewal Check: What to Do in August 2026",
    url: "/losing-medicaid-florida/",
    excerpt: "A MyACCESS-first checklist for Florida Medicaid renewal notices, requested documents, case-specific deadlines, and coverage transitions.",
    tags: ["Medicaid", "Florida", "Renewal", "Redetermination", "MyACCESS", "Losing Coverage", "Polk County"]
  },
  {
    title: "Family Marketplace Coverage When Your Job Offers a Plan",
    url: "/blog/employer-coverage-family-marketplace-affordability-florida.html",
    excerpt: "Your family may qualify for Marketplace savings even when your own work plan counts as affordable. How the family affordability test works in Florida.",
    tags: ["ACA", "Marketplace", "Employer Coverage", "Family", "Dependents", "Affordability", "Polk County"]
  },
  {
    title: "Lost Job Health Insurance in Florida? Your 60-Day Options",
    url: "/blog/lost-job-coverage-aca-insurance-florida.html",
    excerpt: "When job-based coverage ends, you have 60 days to pick a Marketplace plan. Compare COBRA, ACA coverage, and Medicaid in Lakeland and Polk County.",
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
    excerpt: "Doctor networks, plan IDs, hospitals, prescriptions, pharmacies, referrals, and plan-change deadlines before switching Medicare plans.",
    tags: ["Medicare", "Florida", "Provider Networks", "Doctors", "Plan Review"]
  },
  {
    title: "How to Change a Florida Blue myBlue PCP",
    url: "/blog/change-florida-blue-myblue-pcp-watson-clinic.html",
    excerpt: "Verify a Watson Clinic physician, submit the PCP change in the Florida Blue app, and confirm the effective date before scheduling care.",
    tags: ["ACA", "Florida", "Provider Networks", "Doctors", "Watson Clinic", "myBlue", "Lakeland", "PCP"]
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
    excerpt: "Review whether divorce, job loss, turning 26, a birth, or a move may create a Special Enrollment Period and confirm the applicable deadline and documentation.",
    tags: ["ACA", "Florida", "Special Enrollment", "Life Changes"]
  },
  {
    title: "Emergency Room Costs and Uninsured Risk in Lakeland",
    url: "/blog/er-visit-cost-lakeland-without-insurance-2026.html",
    excerpt: "Understand why emergency care can create substantial financial exposure without coverage and which plan details affect out-of-pocket risk.",
    tags: ["Florida", "Lakeland", "Uninsured", "ER Costs"]
  },

  {
    title: "ACA Subsidy Reconciliation and Incorrect Income",
    url: "/blog/aca-subsidy-tax-return-clawback.html",
    excerpt: "Understand premium-tax-credit reconciliation, Form 8962, income updates, and steps to take if application information appears incorrect.",
    tags: ["ACA", "Consumer Protection", "Tax Planning"]
  },
  {
    title: "Non-Income Based Health Insurance Options in Florida (2027 Guide)",
    url: "/blog/non-income-based-health-insurance-florida.html",
    excerpt: "Explore health insurance options in Florida that don't depend on your income. Fixed indemnity, health sharing ministries, short-term plans, DPC, and more alternatives to ACA coverage.",
    tags: ["Florida", "Coverage", "Alternatives"]
  },
  {
    title: "Why Florida ACA Premiums Rose 34.1% on Average in 2026",
    url: "/blog/why-florida-health-insurance-premiums-increased-2026.html",
    excerpt: "Many Floridians are seeing higher 2026 premiums. Here are the key reasons: subsidy changes, rising healthcare costs, and Marketplace enrollment dynamics.",
    tags: ["Florida", "ACA", "Premiums"]
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
    title: "Florida ACA Enrollment and Benefits Guide (2027)",
    url: "/blog/florida-aca-enrollment-and-benefits-2026.html",
    excerpt: "The statewide master guide for HealthCare.gov enrollment, first-30-day setup, and carrier-specific benefit optimization. Includes direct links to 2026 Polk-relevant carrier playbooks.",
    tags: ["ACA", "Florida", "Open Enrollment"]
  },
  {
    title: "Lakeland Medicare Advantage: 2027 Plan Review",
    url: "/blog/medicare-advantage-lakeland-2026.html",
    excerpt: "Compare 2027 Lakeland Medicare Advantage plans by network, prescriptions, and out-of-pocket risk before you enroll.",
    tags: ["Medicare", "Lakeland", "Local"]
  },
  {
    title: "Orlando Health and Watson Clinic Insurance Guide",
    url: "/blog/orlando-health-watson-clinic-insurance-2026.html",
    excerpt: "Review Orlando Health and Watson Clinic network questions for Lakeland-area ACA and Medicare plan selection before you enroll.",
    tags: ["Lakeland", "Local", "Networks", "Orlando Health", "Watson Clinic"]
  },
  {
    title: "Health Insurance for Self-Employed Workers in Lakeland and Polk County",
    url: "/blog/health-insurance-self-employed-lakeland-polk-county-2026.html",
    excerpt: "ACA Marketplace coverage, income estimates, premium tax-credit basics, and local plan checks for contractors and small-business owners.",
    tags: ["Self-Employed", "Lakeland", "ACA"]
  },
  {
    title: "Insurance Claim Denied? A Step-by-Step Review Process",
    url: "/blog/what-to-do-if-health-plan-denies-a-claim.html",
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
    title: "HMO vs EPO vs PPO: Referrals and Out-of-Network Rules",
    url: "/blog/hmo-vs-ppo-vs-epo-explained.html",
    excerpt: "HMO, EPO, or PPO? See which plan types need referrals, which pay for out-of-network care, and how to check your Lakeland doctors before you enroll.",
    tags: ["Plan Types", "Coverage", "Comparison"]
  },
  {
    title: "How the Out-of-Pocket Maximum Works",
    url: "/blog/deductible-vs-out-of-pocket-maximum.html",
    excerpt: "Learn which eligible in-network costs count toward the annual limit and which expenses remain outside it.",
    tags: ["Coverage", "Financial", "Basics"]
  },
  {
    title: "Self-Employed Health Insurance Deduction: Form 7206 Guide",
    url: "/blog/health-insurance-self-employed-tax-deductions.html",
    excerpt: "Who can deduct health insurance premiums when self-employed, how Form 7206 works, the earned-income limit, and how it interacts with Marketplace tax credits.",
    tags: ["Self-Employed", "Tax Deductions", "Financial"]
  },
  {
    title: "How to Budget for Health Insurance and Medical Costs",
    url: "/blog/planning-healthcare-budget-2026.html",
    excerpt: "Build a plan-specific budget using annual premiums, expected medical and prescription costs, and a reserve tied to your coverage.",
    tags: ["Financial", "Budgeting", "Tips"]
  },
  {
    title: "Fixed Indemnity, STM & TriTerm Medical Strategy for 2027",
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
    title: "2027 ACA Open Enrollment: Florida Dates and Checklist",
    url: "/blog/aca-open-enrollment-deadline.html",
    excerpt: "Prepare for 2027 ACA Open Enrollment in Florida. Confirm current HealthCare.gov dates, then review income, doctors, and prescriptions.",
    tags: ["ACA", "Open Enrollment", "Subsidies"]
  },
  {
    title: "The $500 HealthCare.gov Refund Checks: Who Gets One in Florida",
    url: "/blog/healthcare-gov-500-refund-checks-florida.html",
    excerpt: "Treasury started sending a one-time $500 refund on September 30, 2026 to some people who paid full price on HealthCare.gov. CNBC reported about 127,900 Floridians. You do not apply.",
    tags: ["ACA", "Marketplace", "Florida", "Open Enrollment"]
  },
  {
    title: "My Marketplace Plan Is Ending in 2027. What Now?",
    url: "/blog/marketplace-plan-ending-2027-what-now.html",
    excerpt: "Your 2026 Marketplace plan still runs through December 31. If it will not be offered in 2027, HealthCare.gov can match you with a different plan. December 15 is the last day to choose your own for January 1.",
    tags: ["ACA", "Marketplace", "Open Enrollment", "Doctors", "Prescriptions"]
  },
  {
    title: "Medicare Advantage vs Medicare Supplement: What to Compare",
    url: "/blog/medicare-advantage-vs-medicare-supplement.html",
    excerpt: "Compare Medicare Advantage and Medicare Supplement costs, provider access, prescription coverage, enrollment rules, and plan limitations.",
    tags: ["Medicare", "Comparison", "Seniors"]
  },
  {
    title: "5 Health Insurance Mistakes to Avoid",
    url: "/blog/5-critical-health-insurance-mistakes.html",
    excerpt: "Review deductible affordability, provider networks, prescriptions, the applicable enrollment period and deadline, and uninsured exposure before choosing coverage.",
    tags: ["ACA", "Mistakes", "Financial"]
  },
  {
    title: "The Pre-Existing Condition Guide",
    url: "/blog/preexisting-condition-guide.html",
    excerpt: "Compare ACA protections with underwriting, exclusions, and waiting periods that may apply to non-ACA coverage.",
    tags: ["Pre-Existing", "Coverage", "ACA"]
  },

  {
    title: "Short-Term Health Insurance in Florida: Costs, Limits, Risks",
    url: "/blog/short-term-medical-guide.html",
    excerpt: "What short-term health insurance covers in Florida, what it excludes, how health questions affect approval, and when an ACA plan or COBRA is safer.",
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
    excerpt: "Review Florida enrollment periods and deadlines, coverage availability, provider networks, prescriptions, and plan-year changes.",
    tags: ["Florida", "State-Specific", "ACA"]
  },
  {
    title: "Dental Insurance: Costs, Limits, and When It May Fit",
    url: "/blog/dental-insurance-guide.html",
    excerpt: "Compare premiums, annual maximums, waiting periods, networks, exclusions, and expected dental costs.",
    tags: ["Dental", "Coverage", "Tips"]
  },

  {
    title: "Medicare Basics for 2027",
    url: "/blog/medicare-for-dummies.html",
    excerpt: "Understand Parts A, B, C and D, current costs, Medicare enrollment periods, and the tradeoffs between Original Medicare and Medicare Advantage.",
    tags: ["Medicare", "Seniors", "Tips"]
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
    title: "Health Insurance in Brandon FL — 2026 Family Premium Guide",
    url: "/blog/health-insurance-brandon-2026.html",
    excerpt: "Brandon ACA premium changes, family SEP eligibility, and HSA-eligible Bronze plans.",
    tags: ["ACA", "Florida", "Brandon", "Hillsborough County"]
  },
  {
    title: "Health Insurance in Clearwater FL — 2026 Premium Increases & SEPs",
    url: "/blog/health-insurance-clearwater-2026.html",
    excerpt: "Clearwater ACA premium changes, Special Enrollment Period eligibility, and Bronze + HSA strategy.",
    tags: ["ACA", "Florida", "Clearwater", "Pinellas County"]
  },
  {
    title: "Health Insurance in Largo FL — 2026 Premium Increases & Affordable Coverage",
    url: "/blog/health-insurance-largo-2026.html",
    excerpt: "Largo ACA premium changes, Pinellas County SEP eligibility, and Bronze + HSA plans.",
    tags: ["ACA", "Florida", "Largo", "Pinellas County"]
  },
  {
    title: "Health Insurance in New Port Richey FL — 2026 Premium Hikes & Pasco County Options",
    url: "/blog/health-insurance-new-port-richey-2026.html",
    excerpt: "New Port Richey ACA premium changes, Pasco County SEPs, and Bronze + HSA options.",
    tags: ["ACA", "Florida", "New Port Richey", "Pasco County"]
  },
  {
    title: "Health Insurance in Riverview FL — 2026 Family Premium Changes",
    url: "/blog/health-insurance-riverview-2026.html",
    excerpt: "Riverview ACA premium changes, new-mover SEPs, Family Glitch Fix, and Bronze + HSA strategy.",
    tags: ["ACA", "Florida", "Riverview", "Hillsborough County"]
  },
  {
    title: "Health Insurance in St. Petersburg FL — 2026 Premium Changes & Self-Employed Guide",
    url: "/blog/health-insurance-st-petersburg-2026.html",
    excerpt: "St. Petersburg ACA premium changes, self-employed SEPs, and HSA-eligible Bronze plans.",
    tags: ["ACA", "Florida", "St Petersburg", "Pinellas County"]
  },
  {
    title: "Health Insurance in Tampa FL — 2026 Premium Changes & SEP Guide",
    url: "/blog/health-insurance-tampa-2026.html",
    excerpt: "Tampa ACA premium changes, Special Enrollment Period eligibility, and HSA-eligible Bronze plans.",
    tags: ["ACA", "Florida", "Tampa", "Hillsborough County"]
  },
  {
    title: "Health Insurance in Wesley Chapel FL — 2026 Premium Changes Guide",
    url: "/blog/health-insurance-wesley-chapel-2026.html",
    excerpt: "Wesley Chapel ACA premium changes, new-mover SEPs, and Bronze + HSA options.",
    tags: ["ACA", "Florida", "Wesley Chapel", "Pasco County"]
  },
  {
    title: "How to Read Your Health Insurance Card: Every Field Explained",
    url: "/blog/how-to-read-health-insurance-card-guide.html",
    excerpt: "Find your member ID, group number, contract number, and Rx BIN/PCN on any health insurance card, plus what to check the day your card arrives.",
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
    excerpt: "Turning 65 in Central Florida? Learn how Medicare changes ACA coverage, enrollment periods, when Marketplace subsidies end, and coverage-gap risk.",
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
    title: "Orlando Health Lakeland Highlands Hospital: Check Your Plan",
    url: "/blog/orlando-health-polk-county-expansion-2026.html",
    excerpt: "How to confirm your ACA or Medicare plan covers Orlando Health's South Lakeland hospital and its doctors before you need care there.",
    tags: ["Lakeland", "Networks", "Hospital Expansion", "ACA", "Medicare"]
  },
  {
    title: "Orlando Health Watson Clinic Hospital Is Now Open",
    url: "/blog/orlando-health-watson-clinic-doctors-network-2026.html",
    excerpt: "The South Lakeland hospital is open, but doctor, facility, referral, and exact plan-ID participation still require verification.",
    tags: ["Lakeland", "Networks", "Watson Clinic", "Orlando Health"]
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
    title: "Health ProtectorGuard",
    url: "/health-protector-guard/",
    excerpt: "Learn about Health ProtectorGuard fixed-indemnity coverage.",
    tags: ["Products", "Coverage", "Fixed Indemnity"]
  },
  {
    title: "AdvantageGuard Hospital Indemnity",
    url: "/advantage-guard/",
    excerpt: "Florida review of AdvantageGuard hospital indemnity. It is not Medigap, Medicare Advantage, or major medical.",
    tags: ["Products", "Coverage", "Hospital Indemnity", "Supplemental", "Florida"]
  },
  {
    title: "AccidentWise Accident Insurance",
    url: "/accident-wise/",
    excerpt: "Florida review of AccidentWise accident insurance. It is not major medical, Medicare replacement, or MEC.",
    tags: ["Products", "Coverage", "Accident", "Supplemental", "Florida"]
  },
  {
    title: "CriticalGuard Critical Illness",
    url: "/critical-guard/",
    excerpt: "Florida review of CriticalGuard critical illness. It is not major medical, Medicare replacement, or MEC.",
    tags: ["Products", "Coverage", "Critical Illness", "Supplemental", "Florida"]
  },
  {
    title: "HospitalWise Hospital Indemnity",
    url: "/hospital-wise/",
    excerpt: "Florida review of HospitalWise hospital indemnity for ages 18-64. It is not major medical, Medigap, or Medicare Advantage.",
    tags: ["Products", "Coverage", "Hospital Indemnity", "Supplemental", "Florida"]
  },
  {
    title: "Hospital SafeGuard GI Fixed Indemnity",
    url: "/hospital-safeguard-gi/",
    excerpt: "Florida review of Hospital SafeGuard GI. It is not major medical, Medigap, or MEC. Fixed hospital cash benefits with no medical underwriting.",
    tags: ["Products", "Coverage", "Hospital Indemnity", "Supplemental", "Florida"]
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
    title: "Coverage Center: Medicare and Under-65 Plan Review",
    url: "/coverage-center/",
    excerpt: "Choose a 2027 Medicare or individual and family plan review. AEP, turning 65, ACA Marketplace, job change, and coverage-gap starting points.",
    tags: ["Coverage Center", "Plan Review", "2027 Enrollment", "Lakeland", "Polk County"]
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
    excerpt: "Licensed-agent guides, calculators, official government resources, and plan-review tools for ACA, Medicare, supplemental, and life coverage.",
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
,
  // Additional Sitemap & 2027 Local Network Guides
  {
    title: "Brandon, FL Health Insurance | 2027 ACA Help",
    url: "/brandon-health-insurance/",
    excerpt: "Compare 2027 ACA and Medicare options for Brandon families in Hillsborough County around doctors, prescriptions, and cost.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "Clearwater, FL Health Insurance | 2027 ACA Help",
    url: "/clearwater-health-insurance/",
    excerpt: "Compare 2027 ACA and Medicare options in Clearwater and Pinellas County around doctors, prescriptions, and timing.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "Largo, FL Health Insurance | 2027 ACA Help",
    url: "/largo-health-insurance/",
    excerpt: "Compare 2027 ACA and Medicare options in Largo and Pinellas County around doctors, prescriptions, and yearly cost.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "New Port Richey, FL | 2027 ACA & Medicare Help",
    url: "/new-port-richey-health-insurance/",
    excerpt: "Compare 2027 ACA and Medicare options in New Port Richey and Pasco County around doctors, prescriptions, and timing.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","ACA","Marketplace"]
  },
  {
    title: "Riverview, FL Health Insurance | 2027 ACA Help",
    url: "/riverview-health-insurance/",
    excerpt: "Compare 2027 ACA and Medicare options for Riverview households around doctors, prescriptions, and enrollment timing.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "St. Petersburg, FL | 2027 ACA & Medicare Help",
    url: "/st-petersburg-health-insurance/",
    excerpt: "Compare 2027 ACA and Medicare options in St. Petersburg and Pinellas County around doctors, prescriptions, and income.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","ACA","Marketplace"]
  },
  {
    title: "Wesley Chapel, FL | 2027 ACA & Medicare Help",
    url: "/wesley-chapel-health-insurance/",
    excerpt: "Compare 2027 ACA and Medicare options in Wesley Chapel and Pasco County around doctors, prescriptions, and cost.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","ACA","Marketplace"]
  },
  {
    title: "Florida Health Quotes: 2027 Plan Review",
    url: "/quote/",
    excerpt: "Compare 2027 ACA Marketplace plans online, start a Medicare review, or ask David Huff to review Florida coverage. A review is not enrollment.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Which Immigrants Still Qualify for Marketplace Subsidies in Florida?",
    url: "/blog/marketplace-subsidy-immigrant-eligibility-florida.html",
    excerpt: "For 2027 coverage, Marketplace premium tax credits are limited to lawful permanent residents, Cuban-Haitian entrants, and COFA migrants. This is not legal advice.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "Can I Buy a Catastrophic Health Plan in Florida If I'm Over 30?",
    url: "/blog/catastrophic-health-plan-florida-over-30.html",
    excerpt: "For 2027, catastrophic plans are open to people under 30 or age 30 and older with a hardship or affordability exemption. The 2026 expansion was paused in July.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Medicare Sent $90: Did I Get It, Who Qualifies, and Is That Call Real?",
    url: "/blog/medicare-improvement-fund-90-rebate-florida.html",
    excerpt: "CMS says eligible Original Medicare Part B members get a one-time $90 Medicare Improvement Fund premium rebate in October 2026. How to check eligibility, timing, and scam calls.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Can I Get Help Paying Medicare Costs in Polk County?",
    url: "/blog/medicare-extra-help-savings-programs-polk-county.html",
    excerpt: "Extra Help through Social Security lowers Part D costs. Florida Medicare Savings Programs, applied through DCF, can pay the Part B premium and unlock Extra Help automatically.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Is a Medicare Part B Giveback Plan Worth It in Polk County?",
    url: "/blog/medicare-part-b-giveback-polk-county.html",
    excerpt: "A Part B giveback lowers the Part B premium some Medicare Advantage members pay. It is not cash, and it is not worth a plan that blocks your doctors or drugs.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "How Should Lakeland Residents Compare Medicare Part D Drug Plans?",
    url: "/medicare-part-d-lakeland-fl/",
    excerpt: "Florida has 11 stand-alone Part D plans for 2027, none at $0 without Extra Help. Check every drug, dose, and pharmacy on Plan Finder before December 7.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "BayCare Medicare Advantage Plans 2027 in Polk County",
    url: "/blog/baycare-medicare-advantage-plans-2027-polk-county.html",
    excerpt: "For 2027 in Polk County, CMS and BayCare list BayCarePlus Complete (H2235-001) and BayCarePlus Rewards (H2235-002). BayCarePlus Premier members should read their Annual Notice of Change and confirm on Medicare Plan Finder.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "My Medicare Advantage Plan Is Ending. What Do I Do Now?",
    url: "/blog/medicare-advantage-plan-ending-what-now.html",
    excerpt: "A non-renewal letter ends that Medicare Advantage plan on December 31, not your Medicare. Use October 15–December 7, then the Special Enrollment Period through the last day of February.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Privacy Policy",
    url: "/privacy-policy.html",
    excerpt: "See how Lakeland Health Insurance collects, uses, protects, and shares personal data, plus your choices for calls, texts, email, cookies, and privacy requests.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Terms of Service",
    url: "/terms/",
    excerpt: "Terms of Service for LakelandHealthInsurance.com, including who we are, website use, communications, and how to contact Lakeland Health Insurance.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Data Deletion",
    url: "/data-deletion/",
    excerpt: "How to ask Lakeland Health Insurance to delete personal data collected through Facebook Messenger, Facebook or Instagram lead ads, or website forms.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "SMS Terms",
    url: "/sms-policy.html",
    excerpt: "SMS consent, message frequency, opt-out, privacy, security, and contact terms for Lakeland Health Insurance text communications.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Individual and Family Health Insurance Answers | Florida",
    url: "/blog/",
    excerpt: "Florida guidance for ACA Marketplace coverage, job loss, self-employment, early retirement, doctors, prescriptions, costs, deadlines, and Medicare.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Watson Clinic, Orlando Health & Your 2027 Medicare Plan | David Huff",
    url: "/blog/orlando-health-watson-clinic-2027-plan.html",
    excerpt: "Lakeland Medicare help for Watson Clinic and Orlando Health patients: verify 2027 doctors and prescriptions during AEP. Text or call David Huff at (863) 640-3102.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does Watson Clinic Accept Humana in 2027? | Lakeland Medicare Guide",
    url: "/blog/watson-clinic-humana-2027.html",
    excerpt: "Watson Clinic announced it will not accept Humana starting January 1, 2027. Review Medicare options and network rules before Open Enrollment ends Dec 7.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","Doctors and Networks","Provider Check"]
  },
  {
    title: "Ever Wanted Medigap Plan G? If Your Plan Is Ending, You Have Guaranteed Issue",
    url: "/blog/switch-to-medigap-plan-g-non-renewal.html",
    excerpt: "If your Medicare Advantage plan is non-renewing for 2027 in Polk County, federal rules grant a 63-day Guaranteed Issue right to buy Medicare Supplement Plan G without health questions.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","Medigap","Plan G","Guaranteed Issue"]
  },
  {
    title: "Health ProtectorGuard Reviews: What Select 2000 Pays (and Doesn't) | FL",
    url: "/health-protector-guard/review/",
    excerpt: "An honest Florida look at Health ProtectorGuard Select 2000 and Core vs Guard schedules: what fixed-indemnity pays, what it does not, and who it may fit—without star ratings or price quotes.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Health ProtectorGuard Select 2000 | Florida Review",
    url: "/health-protector-guard/select-2000/",
    excerpt: "Looking up Health ProtectorGuard Select 2000? See how this Core option differs from major medical, and compare options with a licensed Lakeland agent.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Health ProtectorGuard Preferred 4000 | Florida Review",
    url: "/health-protector-guard/preferred-4000/",
    excerpt: "Health ProtectorGuard Preferred 4000 mid Core schedule in Florida—set hospital benefits, not ACA coverage. Local agent review of limits and underwriting.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Health ProtectorGuard Premier 5000 | Florida Review",
    url: "/health-protector-guard/premier-5000/",
    excerpt: "Health ProtectorGuard Premier 5000 highest Core schedule in Florida—scheduled benefits only, not MEC. Local agent review before you apply.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Health ProtectorGuard Guard 4000: Florida Review",
    url: "/health-protector-guard/guard-4000/",
    excerpt: "Guard 4000 is the lean HPG Guard series option. Scheduled benefits, limited extras—not major medical. Compare with STM or TriTerm in Florida.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Health ProtectorGuard Guard 5000: Florida Review",
    url: "/health-protector-guard/guard-5000/",
    excerpt: "Guard 5000 adds richer scheduled benefits than Guard 4000. Still not major medical. Compare Rx/imaging rules before you apply in Florida.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Health ProtectorGuard Guard 6000: Florida Review",
    url: "/health-protector-guard/guard-6000/",
    excerpt: "Guard 6000 is the top Guard series schedule. Set benefits for covered care—not ACA coverage. Confirm Florida underwriting and exclusions.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Dental & Vision Insurance — Standalone Plans",
    url: "/dental-vision/",
    excerpt: "Standalone dental and vision insurance self-quote options for NCD and UnitedHealthcare. Enroll yourself online with David Huff available for customer support.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "The Coverage Insider Newsletter",
    url: "/newsletter/",
    excerpt: "Join The Coverage Insider for clear monthly health insurance updates from David Huff: ACA subsidies, Medicare deadlines, tax forms, and carrier changes.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "/downloads/Florida-Health-Insurance-Survival-Guide.pdf",
    url: "/downloads/Florida-Health-Insurance-Survival-Guide.pdf",
    excerpt: "/downloads/Florida-Health-Insurance-Survival-Guide.pdf",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Tampa, FL Health Insurance | 2027 ACA Help",
    url: "/tampa-health-insurance/",
    excerpt: "Compare 2027 ACA, Medicare, and family coverage in Tampa and Hillsborough County around your doctors and prescriptions.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "Lake Alfred, FL Health Insurance | 2027 ACA Help",
    url: "/lake-alfred-health-insurance/",
    excerpt: "2027 coverage help in Lake Alfred around Bond Clinic, Winter Haven Hospital, Watson Clinic, and ZIP 33850.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "Haines City, FL Health Insurance | 2027 ACA Help",
    url: "/haines-city-health-insurance/",
    excerpt: "2027 coverage help in Haines City around AdventHealth Heart of Florida, BayCare Urgent Care, and ZIP 33844 / 33845.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace","Doctors and Networks","Provider Check"]
  },
  {
    title: "Davenport, FL Health Insurance | 2027 ACA Help",
    url: "/davenport-health-insurance/",
    excerpt: "2027 coverage help in Davenport around AdventHealth Heart of Florida on US-27, nearby BayCare, and ZIP 33837 / 33896.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace","Doctors and Networks","Provider Check"]
  },
  {
    title: "Winter Haven, FL Health Insurance | 2027 ACA Help",
    url: "/winter-haven-health-insurance/",
    excerpt: "2027 coverage help in Winter Haven around Bond Clinic, AdventHealth, BayCare, Winter Haven Hospital, and ZIP 33880–33884.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace","Doctors and Networks","Provider Check"]
  },
  {
    title: "Supplemental Insurance Options",
    url: "/supplemental-insurance/",
    excerpt: "Compare supplemental and add-on insurance options including dental, vision, life, accident, critical illness, hospital indemnity, and fixed-benefit coverage.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Current Client Annual Plan Review",
    url: "/current-client-review/",
    excerpt: "Existing clients can request an annual plan review or service help for renewals, doctor changes, prescriptions, billing, ID cards, and household changes.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Employer Coverage Referral Resource | Lakeland Insurance",
    url: "/employer-referral/",
    excerpt: "Privacy-conscious coverage-transition resource for employers, HR consultants, payroll companies, PEOs, attorneys, and referral partners.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Local Health Insurance Answers | Lakeland, FL",
    url: "/local-health-insurance-answers/",
    excerpt: "Direct Lakeland and Polk County health insurance answers for ACA, Medicare, self-employed coverage, coverage loss, and local provider networks.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Who Helps Compare Health Insurance in Lakeland, FL?",
    url: "/local-health-insurance-answers/health-insurance-broker-lakeland-fl/",
    excerpt: "David Huff is a licensed Florida health agent in Lakeland helping people compare ACA, Medicare, supplemental, dental, vision, and life coverage.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Who Helps Self-Employed People Compare Polk County Coverage?",
    url: "/local-health-insurance-answers/self-employed-health-insurance-polk-county/",
    excerpt: "Health insurance review for Polk County contractors, freelancers, 1099 workers, and business owners comparing ACA, private, and supplemental coverage paths.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Who Helps With Medicare Plans in Lakeland, FL?",
    url: "/local-health-insurance-answers/medicare-plan-help-lakeland/",
    excerpt: "Local Medicare review in Lakeland based on doctors, prescriptions, pharmacies, current coverage, and the applicable Medicare enrollment period.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Losing Group Health Coverage in Florida | Next Steps",
    url: "/local-health-insurance-answers/employee-losing-group-coverage/",
    excerpt: "Coverage handoff help for Florida employees comparing an ACA Special Enrollment Period, COBRA, Medicare eligibility, and other next steps.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Watson Clinic Insurance Network Help | Lakeland",
    url: "/local-health-insurance-answers/watson-clinic-insurance-network-help/",
    excerpt: "How to check Watson Clinic doctors, urgent care, and cancer care in a 2027 ACA or Medicare plan before you enroll, with AEP and Open Enrollment dates.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Lakeland Regional & UnitedHealthcare 2027: How to Check",
    url: "/local-health-insurance-answers/lakeland-regional-unitedhealthcare-2027/",
    excerpt: "Polk County UnitedHealthcare members: how to verify Lakeland Regional Health doctors and the hospital in your 2027 Medicare Advantage or employer plan before AEP ends Dec 7.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Post-Enrollment Coverage Review",
    url: "/post-enrollment-review/",
    excerpt: "Recently enrolled clients can request help with ID cards, first premium, providers, prescriptions, effective dates, Marketplace documents, and plan use.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "The Health Insurance Checkup Every Household Should Do",
    url: "/blog/health-insurance-checkup-every-age.html",
    excerpt: "Use this practical health insurance checklist to review doctors, prescriptions, deductibles, life changes, Medicare timing, and coverage gaps.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Moving to or from Florida with Medicare | Checklist",
    url: "/moving-florida-medicare/",
    excerpt: "A Medicare move checklist for Florida: service area, Special Enrollment Period, doctors, prescriptions, pharmacy, and plan-year verification.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "What Happens to Your Health Insurance If You Quit?",
    url: "/blog/what-happens-health-insurance-if-i-quit-job.html",
    excerpt: "Quitting ends job-based coverage on a set date. Compare COBRA and a Marketplace Special Enrollment Period using doctors, drugs, and start dates.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Is COBRA Worth It vs a Marketplace Plan?",
    url: "/blog/cobra-vs-marketplace-florida.html",
    excerpt: "Compare COBRA and Marketplace coverage after a job plan ends. Review networks, drugs, deductibles, start dates, and enrollment rules side by side.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "Can I Get Coverage Outside Open Enrollment?",
    url: "/blog/health-insurance-outside-open-enrollment.html",
    excerpt: "Outside Open Enrollment, Marketplace plans generally need a qualifying event. See what counts, what does not, and what to do with no event listed.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "How Much Income Qualifies for an ACA Subsidy in Florida?",
    url: "/blog/how-much-income-qualify-subsidy-florida.html",
    excerpt: "How household income and MAGI affect ACA subsidy eligibility in Florida, and what to confirm on HealthCare.gov.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "What If My Income Changes After I Enroll?",
    url: "/blog/what-happens-if-income-changes-after-enroll.html",
    excerpt: "If income changes after Marketplace enrollment, update HealthCare.gov. Advance credits are reconciled on your federal return with Form 8962.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Do I Have to Pay Back the Premium Tax Credit?",
    url: "/blog/do-i-have-to-pay-back-premium-tax-credit.html",
    excerpt: "Advance premium tax credits are reconciled on your federal return. You may repay extra credit or receive more after Form 8962 is filed with IRS.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "What Counts as Income for Marketplace Plans?",
    url: "/blog/what-counts-as-income-marketplace-health-insurance.html",
    excerpt: "Marketplace savings use MAGI: adjusted gross income plus certain untaxed amounts. See what HealthCare.gov counts and whose income is included.",
    tags: ["Lakeland","Polk County","Florida","ACA","Marketplace"]
  },
  {
    title: "Can I Use an Agent for HealthCare.gov?",
    url: "/blog/can-i-use-agent-for-healthcare-gov.html",
    excerpt: "Yes. A licensed agent can help you apply on HealthCare.gov. Insurers pay appointed agents, and using an agent does not change your premium amount.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Bronze vs Silver vs Gold: Which Plan to Pick?",
    url: "/blog/bronze-vs-silver-vs-gold-which-plan.html",
    excerpt: "Metal levels describe cost sharing, not care quality. Silver is the metal for income-based extra savings. Compare doctors and drugs as well.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "How Self-Employed People Get Coverage in Florida",
    url: "/blog/how-self-employed-get-health-insurance-florida.html",
    excerpt: "Self-employed Floridians generally use the Marketplace, a spouse plan, or small-group coverage. Project MAGI and confirm doctors before enrolling.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "How Do I Keep My Doctor When I Change Plans?",
    url: "/blog/how-to-keep-doctor-when-changing-health-plans.html",
    excerpt: "Keeping a doctor depends on the exact plan ID and location. Confirm with the billing office before you enroll, not only with a directory listing.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "How Do I Get Health Insurance If I Retire Before 65?",
    url: "/blog/how-to-get-health-insurance-retire-before-65.html",
    excerpt: "Retiring before 65 means bridging to Medicare with COBRA, retiree coverage or a Marketplace plan. How retirement income affects savings, and the 400% cliff.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "When to Sign Up for Medicare If Still Working",
    url: "/blog/when-to-sign-up-for-medicare-if-still-working.html",
    excerpt: "With current-employer group coverage at 65, you may delay Part B. COBRA and retiree plans do not extend that Medicare Special Enrollment Period.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "What Is the Penalty for Late Medicare Sign-Up?",
    url: "/blog/penalty-for-signing-up-for-medicare-late.html",
    excerpt: "Part B late enrollment adds 10 percent for each 12-month period you could have enrolled. Part D uses a monthly percentage after a 63-day gap.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Do I Need Part B With Employer Insurance?",
    url: "/blog/do-i-need-part-b-with-employer-insurance.html",
    excerpt: "Part B can wait only with qualifying current-employer group coverage. Ask whether the employer plan requires Part B before you delay enrollment.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "How Does Medicare Work With an HSA?",
    url: "/blog/how-does-medicare-work-with-an-hsa.html",
    excerpt: "Medicare enrollment generally ends HSA eligibility to contribute. Medicare.gov says to stop deposits six months before Social Security filing.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Can I Leave Advantage for Original Medicare?",
    url: "/blog/switch-medicare-advantage-back-to-original-medicare.html",
    excerpt: "You can return to Original Medicare in Annual Enrollment or Advantage Open Enrollment. Medigap is separate and may involve medical underwriting.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Does Medicare Cover Dental, Vision, Hearing?",
    url: "/blog/does-medicare-cover-dental-vision-hearing.html",
    excerpt: "Original Medicare generally does not cover routine dental, vision, or hearing. Some Advantage plans may offer extras, and those extras vary by plan.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "What Short-Term Health Insurance Does Not Cover",
    url: "/blog/what-short-term-health-insurance-does-not-cover.html",
    excerpt: "Short-term plans are not ACA-compliant major medical coverage. They can exclude pre-existing conditions and essential benefits. Read the policy.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Is Fixed Indemnity the Same as Health Insurance?",
    url: "/blog/is-fixed-indemnity-the-same-as-health-insurance.html",
    excerpt: "Fixed indemnity pays scheduled cash amounts for covered events. It is supplemental coverage, not comprehensive major medical health insurance.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "How to Check If Prescriptions Are Covered",
    url: "/blog/check-prescriptions-covered-before-you-enroll.html",
    excerpt: "Before you enroll, search each drug on the plan formulary by name, dose, and pharmacy. Check prior authorization and quantity limits as well.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Does Lakeland Regional Health Take My Insurance?",
    url: "/blog/lakeland-regional-health-insurance-accepted.html",
    excerpt: "Lakeland Regional Health is the main hospital campus in Lakeland. Search the hospital and each doctor, then call billing with your plan ID.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "What Is the Income Limit for the Polk HealthCare Plan?",
    url: "/blog/polk-healthcare-plan-eligibility.html",
    excerpt: "Polk County raised the Polk HealthCare Plan income limit to 300% FPL. Who qualifies, what it covers, and how it compares with a 2027 Marketplace plan.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Which Medicare Plans Work at Dedicated Senior in Lakeland?",
    url: "/blog/dedicated-senior-medical-center-lakeland.html",
    excerpt: "Dedicated Senior Medical Center in Lakeland focuses on Medicare patients. Check which Advantage plans list the center before AEP.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Is Winter Haven Hospital in My Plan's Network?",
    url: "/blog/winter-haven-hospital-insurance.html",
    excerpt: "Winter Haven Hospital is a BayCare hospital at (863) 293-1121. Look up the hospital by name, not only BayCare, before you enroll.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does AdventHealth Heart of Florida Take My Insurance?",
    url: "/blog/adventhealth-heart-of-florida-insurance.html",
    excerpt: "AdventHealth Heart of Florida is the Davenport hospital on US-27. Look up the hospital by plan ID, then call 863-422-4971 before you enroll.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is My Lakeland Regional Health Doctor in My Plan?",
    url: "/blog/lrh-physician-group-insurance.html",
    excerpt: "LRH Physician Group lists more than 400 physicians and providers in Polk County. Check your doctor by name; the hospital listing is not enough.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is the LRH S. Florida Ave ER an Urgent Care?",
    url: "/blog/lakeland-regional-freestanding-emergency-department.html",
    excerpt: "The LRH S. Florida Ave site is a freestanding emergency department, not urgent care. It bills like a hospital ER, so confirm ER cost-sharing.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does Central Florida Health Care Have a Sliding Fee Scale?",
    url: "/blog/central-florida-health-care-polk-county.html",
    excerpt: "Central Florida Health Care is a sliding-fee FQHC with Polk County clinics. Ask about income-based fees and look up your site by year.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Is LRH Urgent Care Billed Differently From the ER?",
    url: "/blog/lakeland-regional-urgent-care.html",
    excerpt: "LRH Urgent Care in Lakeland is a walk-in clinic with separate cost-sharing from the hospital ER. Check urgent-care copays before you go.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does Bartow Regional Medical Center Take My Insurance?",
    url: "/blog/bartow-regional-medical-center-insurance.html",
    excerpt: "Bartow Regional Medical Center is a BayCare hospital in Bartow. Check the hospital by name, not only BayCare, before you enroll.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is My AdventHealth Bond Clinic Doctor in My Plan?",
    url: "/blog/bond-clinic-winter-haven-insurance.html",
    excerpt: "AdventHealth Bond Clinic is a Winter Haven physician group. Check each doctor by name; clinic and hospital networks can differ.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is My Gessler Clinic Doctor Still in My Plan?",
    url: "/blog/gessler-clinic-insurance.html",
    excerpt: "Gessler Clinic is now BayCare Medical Group in Winter Haven. Recheck your doctor under the new group name before you change plans.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does AdventHealth Lake Wales Take My Insurance?",
    url: "/blog/adventhealth-lake-wales-insurance.html",
    excerpt: "AdventHealth Lake Wales is a hospital in Lake Wales. Search it by name in next year",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does My Plan Cover Carol Jenkins Barnett Pavilion?",
    url: "/blog/carol-jenkins-barnett-pavilion-insurance.html",
    excerpt: "Carol Jenkins Barnett Pavilion in Lakeland handles pediatric ER and maternity care. Confirm the pavilion and doctors before you go.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "What Should I Check Before LRH Hollis Cancer Center?",
    url: "/blog/hollis-cancer-center-lakeland-insurance.html",
    excerpt: "LRH Hollis Cancer Center is Lakeland Regional",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Does My Plan Cover the Harrell Family Center in Lakeland?",
    url: "/blog/harrell-family-center-for-behavioral-wellness-lakeland.html",
    excerpt: "The Harrell Family Center in Lakeland is LRH",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Does HCA Florida Lakeland Emergency Bill as an ER?",
    url: "/blog/hca-florida-lakeland-emergency.html",
    excerpt: "HCA Florida Lakeland Emergency on S. Florida Ave is a freestanding ER tied to Brandon Hospital. Expect ER billing, not urgent-care copays.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Is HCA North Lakeland a Freestanding ER?",
    url: "/blog/hca-florida-north-lakeland-emergency.html",
    excerpt: "HCA Florida North Lakeland Emergency is a 24-hour freestanding ER linked to Brandon Hospital. Check ER cost-sharing before you go.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Does Watson Clinic Urgent Care Take My Insurance?",
    url: "/blog/watson-clinic-urgent-care.html",
    excerpt: "Watson Clinic Urgent Care and XpressCare are walk-in options in the Watson Clinic network. Confirm the walk-in site on your plan ID.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does AdventHealth Centra Care Lakeland Take My Insurance?",
    url: "/blog/centra-care-lakeland.html",
    excerpt: "AdventHealth Centra Care has North and South Lakeland urgent-care sites. Look up the exact address and compare urgent-care versus ER copays.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Do Polk County Veterans With VA Care Need Medicare Part B?",
    url: "/blog/lakeland-va-clinic-medicare.html",
    excerpt: "The Lakeland VA Clinic serves Polk County veterans. Review whether VA care replaces or sits beside Medicare Part B before you delay Part B.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does Medicare Cover Rehab at Encompass Health Lakeland?",
    url: "/blog/encompass-health-lakeland-insurance.html",
    excerpt: "Encompass Health Rehab Hospital of Lakeland is an inpatient rehab hospital. Check Medicare or Marketplace rehab-day coverage first.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Does My Plan Cover Johns Hopkins All Children's Lakeland?",
    url: "/blog/johns-hopkins-all-childrens-lakeland-insurance.html",
    excerpt: "Johns Hopkins All Children",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Who Qualifies for Lakeland Volunteers in Medicine?",
    url: "/blog/lakeland-volunteers-in-medicine.html",
    excerpt: "Lakeland Volunteers in Medicine is a clinic for people who meet its eligibility rules. Compare those rules with a Marketplace plan.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Which Medicare Plans Work With Palm Medical Centers?",
    url: "/blog/palm-medical-centers-lakeland.html",
    excerpt: "Palm Medical Centers South Lakeland is a Medicare-focused clinic. Check which Medicare plans list this South Lakeland office first.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "How Does Medicare Cover Good Shepherd Hospice in Polk?",
    url: "/blog/good-shepherd-hospice-lakeland-medicare.html",
    excerpt: "Good Shepherd Hospice serves Polk County under the Medicare hospice benefit. Confirm Medicare hospice rules before an election.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027"]
  },
  {
    title: "Does My Plan Cover Peace River Center Crisis Care?",
    url: "/blog/peace-river-center-bartow.html",
    excerpt: "Peace River Center runs crisis units in Bartow and Lakeland. Confirm mental-health coverage on your Florida plan before a walk-in visit.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is Winter Haven Women's Hospital in My Plan's Network?",
    url: "/blog/winter-haven-womens-hospital-insurance.html",
    excerpt: "Winter Haven Women",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "What Should I Verify Before Cassidy Cancer Center?",
    url: "/blog/cassidy-cancer-center-winter-haven.html",
    excerpt: "Cassidy Cancer Center is the Winter Haven Hospital cancer clinic. Check the center, each doctor, and drug coverage before treatment.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "How Does HCA Auburndale Emergency Bill Visits?",
    url: "/blog/hca-florida-auburndale-emergency.html",
    excerpt: "HCA Florida Auburndale Emergency is a freestanding ER tied to Poinciana Hospital. It bills as an ER, so check copays before you go.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Is HCA Haines City Emergency Tied to Poinciana Hospital?",
    url: "/blog/hca-florida-haines-city-emergency.html",
    excerpt: "HCA Florida Haines City Emergency is a 24-hour freestanding ER tied to Poinciana Hospital. Confirm ER cost-sharing on your plan.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is the New Centra Care Haines City in My Plan?",
    url: "/blog/adventhealth-haines-city.html",
    excerpt: "AdventHealth Centra Care Haines City is a new urgent-care clinic. Check this Haines City site in your plan and compare urgent-care versus ER copays.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "What to Check Before Florida Cancer Specialists Davenport?",
    url: "/blog/florida-cancer-specialists-davenport.html",
    excerpt: "Florida Cancer Specialists in Davenport is an outpatient cancer clinic. Verify the office, each doctor, and drug coverage before treatment.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does BayCare Urgent Care South Lakeland Take My Insurance?",
    url: "/blog/baycare-urgent-care-lakeland.html",
    excerpt: "BayCare Urgent Care South Lakeland is a walk-in clinic. Verify the south Lakeland site and compare urgent-care copays with ER rules.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","Doctors and Networks","Provider Check"]
  },
  {
    title: "What Should I Check Before MD Now Urgent Care Lakeland?",
    url: "/blog/md-now-lakeland.html",
    excerpt: "MD Now Urgent Care Lakeland is a walk-in clinic. Look up the Lakeland site in your directory and compare urgent-care copays with ER costs.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is Owl Now Urgent Care in My Lakeland Plan?",
    url: "/blog/owl-now-urgent-care.html",
    excerpt: "Owl Now Urgent Care has walk-in clinics in Lakeland and Winter Haven. Confirm the exact Owl Now address in your plan.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does Concentra Lakeland Bill Insurance or Workers' Comp?",
    url: "/blog/concentra-lakeland.html",
    excerpt: "Concentra Urgent Care in Lakeland treats walk-in illness and work injuries. Ask whether the visit bills insurance or workers",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Is Sunshine Urgent Care on US 98 in My Network?",
    url: "/blog/sunshine-urgent-care-lakeland.html",
    excerpt: "Sunshine Urgent Care sits on US 98 S in Lakeland. Check this walk-in clinic and review urgent-care versus ER copays.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does My Plan Cover Tri-County Human Services in Lakeland?",
    url: "/blog/tri-county-human-services-lakeland.html",
    excerpt: "Tri-County Human Services in Lakeland offers behavioral-health and substance-use services. Confirm behavioral-health benefits before admission.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "What Does the Polk County Health Department Clinic Offer?",
    url: "/blog/polk-county-health-department-clinic.html",
    excerpt: "Florida Department of Health in Polk County clinics offer public-health services. See how they fit beside a Marketplace or Medicare plan.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does My Plan Cover BayCare Behavioral Health Winter Haven?",
    url: "/blog/baycare-behavioral-health-winter-haven.html",
    excerpt: "BayCare Behavioral Health in Winter Haven is a mental-health clinic with a sliding-fee option. Confirm network status before a visit.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does BayCare Urgent Care Winter Haven Bill as Urgent Care?",
    url: "/blog/baycare-urgent-care-winter-haven.html",
    excerpt: "BayCare Urgent Care Winter Haven is a walk-in clinic, not the hospital ER. Confirm urgent-care billing on your plan before you go.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is AdventHealth Centra Care Winter Haven in My Plan?",
    url: "/blog/centra-care-winter-haven.html",
    excerpt: "AdventHealth Centra Care Winter Haven is a walk-in urgent-care clinic. Check this Winter Haven address, not only the brand, before you go.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is CFHC Winter Haven a Sliding-Fee Clinic?",
    url: "/blog/central-florida-health-care-winter-haven.html",
    excerpt: "Central Florida Health Care Winter Haven is an FQHC with a sliding fee scale. Confirm fees and whether your plan lists this site.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Is LRH Lake Wales Urgent Care in My Plan?",
    url: "/blog/lakeland-regional-lake-wales.html",
    excerpt: "Lakeland Regional Health Lake Wales is a local urgent-care and primary-care site. Confirm this Lake Wales clinic, not only the hospital.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does BayCare Urgent Care Haines City Take My Insurance?",
    url: "/blog/baycare-urgent-care-haines-city.html",
    excerpt: "BayCare Urgent Care Haines City is a walk-in clinic on US-27. Check urgent-care copays separately from ER cost-sharing before you go.",
    tags: ["Lakeland","Polk County","Florida","Medicare","2027","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does Centra Care Four Corners Take My Insurance?",
    url: "/blog/centra-care-four-corners.html",
    excerpt: "AdventHealth Centra Care Four Corners is an urgent-care clinic near Davenport. Confirm this site; a Lakeland listing is not the same.",
    tags: ["Lakeland","Polk County","Florida"]
  },
  {
    title: "Does Elon Health Urgent Care Davenport Take My Insurance?",
    url: "/blog/elon-health-urgent-care-davenport.html",
    excerpt: "Elon Health Urgent Care in Davenport is a local walk-in clinic. Confirm the Davenport site and review urgent-care copays before you go.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does the Mulberry Clinic Offer Sliding-Fee Care?",
    url: "/blog/doctor-mulberry-fl.html",
    excerpt: "Mulberry",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Does Frostproof Have a Sliding-Fee Clinic Nearby?",
    url: "/blog/doctor-frostproof-fl.html",
    excerpt: "Frostproof patients can use Central Florida Health Care, an FQHC with a sliding fee scale. Compare clinic fees with a health plan.",
    tags: ["Lakeland","Polk County","Florida","Doctors and Networks","Provider Check"]
  },
  {
    title: "Watson Clinic 2027 ACA Marketplace Insurance Guide",
    url: "/blog/watson-clinic-aca-marketplace-insurance-2027.html",
    excerpt: "Which 2027 Florida HealthCare.gov Marketplace plans cover Watson Clinic doctors and Orlando Health Lakeland Highlands Hospital.",
    tags: ["ACA","Marketplace","Watson Clinic","Lakeland","Polk County","2027","Doctors and Networks"]
  },
  {
    title: "Lakeland Regional Health vs. Orlando Health 2027 ACA Comparison",
    url: "/blog/lakeland-regional-vs-orlando-health-aca-2027.html",
    excerpt: "Side-by-side 2027 Polk County Marketplace network comparison for Lakeland Regional Health Medical Center and Orlando Health Lakeland Highlands Hospital.",
    tags: ["ACA","Marketplace","Lakeland Regional Health","Orlando Health","Lakeland","Polk County","2027"]
  },
  {
    title: "Cigna & Molina Exiting Florida ACA Marketplace for 2027: Action Guide",
    url: "/blog/cigna-molina-exiting-florida-marketplace-2027.html",
    excerpt: "How Cigna and Molina policyholders in Lakeland and Polk County can avoid unwanted auto-reenrollment and choose a 2027 replacement plan.",
    tags: ["ACA","Marketplace","Cigna","Molina","Polk County","Florida","2027"]
  },
  {
    title: "Davenport & Haines City 2027 ACA Health Insurance Guide",
    url: "/blog/davenport-haines-city-aca-health-insurance-2027.html",
    excerpt: "Four Corners and US-27 cross-county network guide for AdventHealth Heart of Florida, HCA Poinciana, and Orlando Health Horizon West.",
    tags: ["ACA","Marketplace","Davenport","Haines City","Four Corners","Polk County","2027"]
  },
  {
    title: "Polk County Self-Employed & 1099 ACA Health Insurance 2027 Guide",
    url: "/blog/self-employed-1099-aca-polk-county-2027.html",
    excerpt: "MAGI calculation, Schedule C deductions, Silver CSR tiers, and Bronze HSA rules for Lakeland and Winter Haven freelancers and small business owners.",
    tags: ["ACA","Marketplace","1099","Lakeland","Winter Haven","Polk County","2027"]
  },
  {
    title: "Bond Clinic & Winter Haven Hospital 2027: ACA & Medicare Guide",
    url: "/blog/bond-clinic-winter-haven-aca-medicare-2027.html",
    excerpt: "How Winter Haven, Auburndale, and Lake Alfred residents can align AdventHealth Bond Clinic, Gessler Clinic, and BayCare Winter Haven Hospital for 2027.",
    tags: ["ACA","Medicare","Bond Clinic","Winter Haven Hospital","Winter Haven","Polk County","2027"]
  },
  {
    title: "BayCare vs. Tampa General 2027: ACA & Medicare Network Guide",
    url: "/blog/baycare-tampa-general-aca-medicare-2027.html",
    excerpt: "Compare St. Joseph's, Morton Plant, Winter Haven Hospital, and Tampa General Hospital (TGH / USF Health) network participation for 2027.",
    tags: ["ACA","Medicare","BayCare","Tampa General","Tampa Bay","Florida","2027"]
  },
  {
    title: "Moffitt Cancer Center 2027 Insurance Accepted: ACA & Medicare Guide",
    url: "/blog/moffitt-cancer-center-insurance-accepted-2027.html",
    excerpt: "Which 2027 Florida ACA Marketplace, Original Medicare + Medigap, and Medicare Advantage plans cover Moffitt Cancer Center in Tampa.",
    tags: ["ACA","Medicare","Moffitt Cancer Center","Oncology","Tampa","Florida","2027"]
  },
  {
    title: "Lee Health Dropping UnitedHealthcare in 2027: SWFL Patient Guide",
    url: "/blog/lee-health-unitedhealthcare-2027-drop.html",
    excerpt: "What Fort Myers, Cape Coral, and Lee County patients need to know about the Lee Health and UnitedHealthcare split and 2027 replacement plans.",
    tags: ["ACA","Medicare","Lee Health","UnitedHealthcare","Fort Myers","Cape Coral","2027"]
  },
  {
    title: "Broward Health & Memorial Healthcare 2027: South Florida Network Guide",
    url: "/blog/broward-health-memorial-florida-blue-out-of-network.html",
    excerpt: "How Fort Lauderdale, Hollywood, and Broward County patients can navigate 2027 hospital network tiers and protect access to Broward Health and Memorial.",
    tags: ["ACA","Medicare","Broward Health","Memorial Healthcare","Fort Lauderdale","South Florida","2027"]
  },
  {
    title: "Baptist Health Jacksonville & Florida Blue 2027: Patient Network Guide",
    url: "/blog/baptist-health-jacksonville-florida-blue-2027.html",
    excerpt: "How Jacksonville, Duval, Clay, and St. Johns County residents can verify Baptist Medical Center, Wolfson Children's, and Baptist MD Anderson for 2027.",
    tags: ["ACA","Medicare","Baptist Health Jacksonville","Wolfson Childrens","Jacksonville","Florida","2027"]
  },
  {
    title: "Health First & UnitedHealthcare Brevard 2027: Space Coast Guide",
    url: "/blog/health-first-unitedhealthcare-brevard-2027.html",
    excerpt: "Melbourne, Viera, Cocoa Beach, and Palm Bay guide to verifying Holmes Regional, Viera Hospital, and Health First Medical Group for 2027.",
    tags: ["ACA","Medicare","Health First","Holmes Regional","Brevard County","Space Coast","2027"]
  },
  {
    title: "Baylor Scott & White vs. Humana 2027: Texas Network Guide",
    url: "/blog/baylor-scott-white-humana-texas-2027.html",
    excerpt: "How Dallas-Fort Worth, Austin, Temple, and Waco patients can verify Baylor Scott & White Health Medicare Advantage and ACA Marketplace access for 2027.",
    tags: ["ACA","Medicare","Baylor Scott and White","Humana","Texas","Dallas","Austin","2027"]
  },
  {
    title: "Houston Methodist & Memorial Hermann 2027: ACA & Medicare Guide",
    url: "/blog/houston-methodist-memorial-hermann-aca-medicare-2027.html",
    excerpt: "Compare Texas Medical Center, Houston Methodist, Memorial Hermann, and MD Anderson network participation across Harris, Fort Bend, and Montgomery counties.",
    tags: ["ACA","Medicare","Houston Methodist","Memorial Hermann","MD Anderson","Houston","Texas","2027"]
  },
  {
    title: "BJC HealthCare & WashU St. Louis 2027 Network: Patient Guide",
    url: "/blog/bjc-healthcare-washu-aetna-anthem-st-louis-2027.html",
    excerpt: "How St. Louis and St. Charles County residents can verify Barnes-Jewish Hospital, St. Louis Children's Hospital, and WashU Medicine network access for 2027.",
    tags: ["ACA","Medicare","BJC HealthCare","Barnes-Jewish","WashU","St. Louis","Missouri","2027"]
  },
  {
    title: "OhioHealth & Kettering Health 2027 Network: Ohio Patient Guide",
    url: "/blog/ohiohealth-kettering-health-anthem-humana-ohio-2027.html",
    excerpt: "Columbus, Franklin County, Dayton, and Miami Valley guide to OhioHealth, OSU Wexner Medical Center, and Kettering Health network contracts for 2027.",
    tags: ["ACA","Medicare","OhioHealth","Kettering Health","OSU Wexner","Columbus","Dayton","Ohio","2027"]
  },
  {
    title: "Atrium Health & Novant Health 2027: North Carolina ACA & Medicare Guide",
    url: "/blog/atrium-health-novant-health-aca-north-carolina-2027.html",
    excerpt: "How Charlotte, Mecklenburg County, Winston-Salem, and Triad residents can compare Atrium Health, Wake Forest Baptist, and Novant Health networks for 2027.",
    tags: ["ACA","Medicare","Atrium Health","Novant Health","Charlotte","North Carolina","2027"]
  },
  {
    title: "Vanderbilt Health & TriStar 2027: Tennessee ACA & Medicare Guide",
    url: "/blog/vanderbilt-health-tristar-aca-tennessee-2027.html",
    excerpt: "Nashville, Williamson, Rutherford, and Sumner County guide to Vanderbilt University Medical Center (VUMC) and HCA TriStar Health networks for 2027.",
    tags: ["ACA","Medicare","Vanderbilt Health","VUMC","TriStar","Nashville","Tennessee","2027"]
  },
  {
    title: "Sentara Health & Inova 2027: Virginia Marketplace & Medicare Guide",
    url: "/blog/sentara-health-inova-virginia-marketplace-2027.html",
    excerpt: "How Hampton Roads, Northern Virginia, and Richmond residents can verify Sentara Norfolk General, Inova Fairfax, and VCU Health networks for 2027.",
    tags: ["ACA","Medicare","Sentara Health","Inova","Virginia","Northern Virginia","Hampton Roads","2027"]
  }
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
    const query = (dropdown && dropdown.dataset && dropdown.dataset.searchQuery) || '';
    const html = results.map(result => `
      <a href="${result.url}" class="search-result" data-search-result="${result.url}">
        <div class="search-result-title">${this.highlightQuery(result.title, query)}</div>
        <div class="search-result-excerpt">${this.highlightQuery(result.excerpt, query)}</div>
      </a>
    `).join('');

    dropdown.innerHTML = html || '<div class="search-no-results" role="status">No matching articles found. Try a broader search.</div>';
  }

  highlightQuery(text, query) {
    if (!query || typeof text !== 'string') return text;
    const tokens = query.trim().split(/\s+/).filter(t => t.length >= 2).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!tokens.length) return text;
    const pattern = new RegExp('(' + tokens.join('|') + ')', 'gi');
    return text.replace(pattern, '<mark>$1</mark>');
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
