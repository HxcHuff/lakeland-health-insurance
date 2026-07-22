// Site-wide search index and functionality
const siteSearchIndex = [
  // Medicare season highlights
  {
    title: "Free Medicare Review — Lakeland, FL",
    url: "/lp/medicare/",
    excerpt: "Get a free, no-pressure review of your Medicare options from licensed Florida broker David Huff.",
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
    title: "Lakeland Medicare Advantage Plans for 2026: Compare 91 Local Options",
    url: "/blog/medicare-advantage-lakeland-2026.html",
    excerpt: "Compare 2026 Lakeland Medicare Advantage plans by premium, MOOP, and Watson Clinic or Lakeland Regional access before you enroll.",
    tags: ["Medicare", "Lakeland", "Local"]
  },
  {
    title: "Watson Clinic and Lakeland Regional Insurance Guide for 2026",
    url: "/blog/lakeland-regional-watson-clinic-insurance-2026.html",
    excerpt: "Check which 2026 Medicare Advantage and ACA plans work at Watson Clinic and Lakeland Regional Health, including specialty-only and referral traps.",
    tags: ["Lakeland", "Local", "Networks"]
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
    title: "UnitedHealthcare Health Protector Guard: Technical Breakdown & Gap Coverage Strategy",
    url: "/blog/fixed-indemnity-analysis.html",
    excerpt: "In-depth technical analysis of fixed-indemnity insurance. Compare fixed-indemnity vs major medical plans, understand how to use it as HDHP deductible protection, and learn strategic integration with high-deductible plans.",
    tags: ["Products", "Coverage", "Gap Insurance"]
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

  // Main Pages
  {
    title: "Health Insurance Broker in Lakeland, FL — ACA, Medicare & More",
    url: "/",
    excerpt: "Licensed Lakeland broker David Huff helps Polk County families compare 2026 ACA, Medicare, and Guard plans — free, no pressure.",
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
    title: "About David Huff",
    url: "/about/",
    excerpt: "Meet David Huff, licensed Florida health insurance broker in Lakeland.",
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
    excerpt: "Contact David Huff for health insurance questions and free consultation.",
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
