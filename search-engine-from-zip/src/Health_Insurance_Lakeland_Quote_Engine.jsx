import React, { useEffect, useMemo, useRef, useState } from "react";

const METAL_ORDER = ["Catastrophic", "Bronze", "Expanded Bronze", "Silver", "Gold", "Platinum"];

const CURRENCY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const AGE_ANCHORS = [
  { age: 0, key: "child014" },
  { age: 14, key: "child014" },
  { age: 18, key: "age18" },
  { age: 21, key: "age21" },
  { age: 27, key: "age27" },
  { age: 30, key: "age30" },
  { age: 40, key: "age40" },
  { age: 50, key: "age50" },
  { age: 60, key: "age60" },
  { age: 64, key: "age60" },
];

function parseDollar(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const numeric = parseFloat(String(value).replace(/[$,]/g, ""));
  return Number.isNaN(numeric) ? Number.POSITIVE_INFINITY : numeric;
}

function getBenefits(plan, csrLevel) {
  if (csrLevel && plan.metal === "Silver") {
    const key = `csr${csrLevel}`;
    if (plan[key]) return { ...plan.standard, ...plan[key] };
  }
  return plan.standard || {};
}

function getPremium(plan, county, ageInput) {
  const premiums = plan?.premiumsByCounty?.[county];
  if (!premiums) return null;

  const age = Math.max(0, Math.min(64, Number(ageInput) || 0));
  const anchors = AGE_ANCHORS
    .map((a) => ({ age: a.age, value: premiums[a.key] }))
    .filter((a) => a.value != null);

  if (!anchors.length) return null;
  if (age <= anchors[0].age) return anchors[0].value;
  if (age >= anchors[anchors.length - 1].age) return anchors[anchors.length - 1].value;

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const left = anchors[i];
    const right = anchors[i + 1];
    if (age >= left.age && age <= right.age) {
      if (right.age === left.age) return left.value;
      const ratio = (age - left.age) / (right.age - left.age);
      return left.value + (right.value - left.value) * ratio;
    }
  }
  return null;
}

function getFpl2026(householdSize) {
  const base = 15600;
  const increment = 5460;
  const size = Number(householdSize) || 1;
  if (size <= 1) return base;
  return base + (size - 1) * increment;
}

function getExpectedContributionRate(fplPercent) {
  if (fplPercent <= 150) return 0;
  if (fplPercent <= 200) return ((fplPercent - 150) / 50) * 0.02;
  if (fplPercent <= 250) return 0.02 + ((fplPercent - 200) / 50) * 0.02;
  if (fplPercent <= 300) return 0.04 + ((fplPercent - 250) / 50) * 0.02;
  if (fplPercent <= 400) return 0.06 + ((fplPercent - 300) / 100) * 0.025;
  return 0.085;
}

function getProjectedCsrLevel(fplPercent) {
  if (fplPercent >= 100 && fplPercent < 150) return "94";
  if (fplPercent >= 150 && fplPercent < 200) return "87";
  if (fplPercent >= 200 && fplPercent <= 250) return "73";
  return "";
}

function adjustPremium(premium, subsidyMonthly, applySubsidy) {
  if (premium == null) return null;
  if (!applySubsidy) return premium;
  return Math.max(0, premium - (subsidyMonthly || 0));
}

function CompareModal({ ids, plans, county, age, csrLevel, onClose, onRemove, subsidyMonthly, applySubsidy }) {
  if (ids.length < 2) return null;

  const rows = [
    ["Monthly Premium", (p) => {
      const premium = adjustPremium(getPremium(p, county, age), subsidyMonthly, applySubsidy);
      return premium == null ? "-" : `$${premium.toFixed(2)}`;
    }],
    ["Deductible (Ind)", (p) => getBenefits(p, csrLevel).medDeductInd || "-"],
    ["Max OOP (Ind)", (p) => getBenefits(p, csrLevel).medMoopInd || "-"],
    ["Primary Care", (p) => getBenefits(p, csrLevel).pcp || "-"],
    ["Specialist", (p) => getBenefits(p, csrLevel).specialist || "-"],
    ["ER", (p) => getBenefits(p, csrLevel).er || "-"],
    ["Generic Rx", (p) => getBenefits(p, csrLevel).genericRx || "-"],
  ];

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <div className="compare-modal">
        <div className="compare-header">
          <h2>Plan Comparison</h2>
          <button type="button" className="ghost-btn" onClick={onClose}>Close</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                {ids.map((id) => {
                  const p = plans[id];
                  return (
                    <th key={id}>
                      <div>{p.name}</div>
                      <div className="muted small">{p.issuer}</div>
                      <button type="button" className="ghost-btn" onClick={() => onRemove(id)}>Remove</button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, getter]) => (
                <tr key={label}>
                  <td><strong>{label}</strong></td>
                  {ids.map((id) => {
                    const plan = plans[id];
                    return <td key={id}>{getter(plan)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GetHelpPage() {
  const formStartedAt = useRef(Date.now());
  const challengeValue = useRef(String(Math.floor(100000 + Math.random() * 900000)));
  const [formError, setFormError] = useState("");

  function handleLeadSubmit(event) {
    const formData = new FormData(event.currentTarget);
    const elapsedMs = Date.now() - formStartedAt.current;
    const trapsFilled = ["bot-field", "website", "company"].some((name) => String(formData.get(name) || "").trim());
    const challengeFailed = formData.get("human_check") !== challengeValue.current;

    if (trapsFilled || challengeFailed || elapsedMs < 5000) {
      event.preventDefault();
      setFormError("Please wait a moment, then submit the form again.");
    }
  }

  return (
    <div style={{ fontFamily: "DM Sans, sans-serif", background: "#F8FAFC", minHeight: "100vh", color: "#1e293b" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 20px 40px" }}>
        <h1 style={{ margin: "0 0 8px", color: "#1B2A4A" }}>Get Plan-Specific Help</h1>
        <p style={{ margin: 0, color: "#64748B" }}>Three quick steps. No fluff. David follows up personally.</p>

        <form
          name="plan-help-lead"
          method="POST"
          action="/thanks.html"
          data-netlify="true"
          data-netlify-honeypot="bot-field"
          onSubmit={handleLeadSubmit}
          style={{
            marginTop: 18,
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 14,
            padding: 16,
            boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
            display: "grid",
            gap: 12,
          }}
        >
          <input type="hidden" name="form-name" value="plan-help-lead" />
          <input type="hidden" name="human_check" value={challengeValue.current} />
          <p style={{ display: "none" }}>
            <label>Don't fill this out: <input name="bot-field" /></label>
          </p>
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label>
              Company
              <input name="company" tabIndex={-1} autoComplete="off" />
            </label>
          </div>

          <input name="zip_code" placeholder="ZIP Code" required />
          <input name="coverage_type" placeholder="Coverage Type (ACA, Medicare, etc.)" required />
          <input name="household_size" placeholder="Household Size" required />
          <input name="current_coverage_status" placeholder="Current Coverage Status" required />
          <input name="renewal_timing" placeholder="Renewal / Effective Timing" required />
          <input name="main_concern" placeholder="Main Concern" required />
          <textarea name="notes" placeholder="Anything else David should know?" style={{ minHeight: 90 }} />
          <input name="full_name" placeholder="Full Name" required />
          <input name="phone" type="tel" placeholder="Phone" required />
          <input name="email" type="email" placeholder="Email" required />

          <label style={{ fontSize: 14 }}>
            <input name="consent" type="checkbox" required style={{ marginRight: 8 }} />
            I agree to be contacted about plan options.
          </label>

          <button
            type="submit"
            style={{
              border: 0,
              borderRadius: 10,
              padding: "12px 16px",
              fontWeight: 700,
              cursor: "pointer",
              background: "#D4A843",
              color: "#111827",
            }}
          >
            Send My Request
          </button>
          {formError && (
            <p role="alert" style={{ margin: 0, color: "#b91c1c", fontSize: 13 }}>
              {formError}
            </p>
          )}

          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
            Prefer direct contact? Email <a href="mailto:dhuff@healthmarkets.com">dhuff@healthmarkets.com</a> or call{" "}
            <a href="tel:+18636403102">(863) 640-3102</a>.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function FLPlanComparison() {
  if (typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "/get-help") {
    return <GetHelpPage />;
  }

  const [dataset, setDataset] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [county, setCounty] = useState("Polk");
  const [zipCode, setZipCode] = useState("33805");
  const [zipLookupState, setZipLookupState] = useState("idle");
  const [zipLookupMessage, setZipLookupMessage] = useState("");
  const [age, setAge] = useState("40");
  const [householdSize, setHouseholdSize] = useState("1");
  const [annualIncome, setAnnualIncome] = useState("");
  const [subsidyApplied, setSubsidyApplied] = useState(false);
  const [metalFilter, setMetalFilter] = useState("All");
  const [carrierQuery, setCarrierQuery] = useState("");
  const [dentalOnly, setDentalOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("premium");

  const [selectedPlans, setSelectedPlans] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const res = await fetch("/fl_qhp_2026_data.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setDataset(json);
        const countyList = json?.counties || [];
        if (countyList.includes("Polk")) setCounty("Polk");
        else if (countyList[0]) setCounty(countyList[0]);
      } catch (err) {
        setLoadError(`Failed to load dataset: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const plans = dataset?.plans || {};
  const counties = dataset?.counties || [];
  const countyPlanIds = dataset?.countyPlans?.[county] || [];

  useEffect(() => {
    function normalizeCounty(input) {
      return String(input || "")
        .toLowerCase()
        .replace(/\bsaint\b/g, "st")
        .replace(/\bst\.\b/g, "st")
        .replace(/\bcounty\b/g, "")
        .replace(/[^a-z]/g, "");
    }

    const zip = zipCode.replace(/\D/g, "");
    if (zip.length !== 5) {
      setZipLookupState("idle");
      setZipLookupMessage("Enter a valid 5-digit Florida ZIP.");
      return;
    }

    let cancelled = false;
    async function resolveCountyFromZip() {
      try {
        setZipLookupState("loading");
        setZipLookupMessage("Resolving county from ZIP...");

        const zipRes = await fetch(`https://api.zippopotam.us/us/${zip}`);
        if (!zipRes.ok) throw new Error("ZIP not found");
        const zipJson = await zipRes.json();
        const place = zipJson?.places?.[0];
        const stateAbbrev = place?.["state abbreviation"];
        if (stateAbbrev !== "FL") {
          throw new Error("Please enter a Florida ZIP");
        }

        const lat = place?.latitude;
        const lon = place?.longitude;
        if (!lat || !lon) throw new Error("Unable to resolve coordinates");

        const fccRes = await fetch(`https://geo.fcc.gov/api/census/block/find?format=json&latitude=${lat}&longitude=${lon}`);
        if (!fccRes.ok) throw new Error("County lookup failed");
        const fccJson = await fccRes.json();
        const countyNameRaw = fccJson?.County?.name || "";
        const countyName = countyNameRaw.replace(/\s+County$/i, "");

        const target = normalizeCounty(countyName);
        const match = counties.find((c) => normalizeCounty(c) === target);
        if (!match) throw new Error(`County "${countyName}" not available in plan dataset`);

        if (!cancelled) {
          setCounty(match);
          setZipLookupState("ready");
          setZipLookupMessage(`ZIP ${zip} mapped to ${match} County`);
        }
      } catch (err) {
        if (!cancelled) {
          setZipLookupState("error");
          setZipLookupMessage(err.message || "Could not map ZIP to county");
        }
      }
    }

    if (counties.length > 0) resolveCountyFromZip();
    return () => {
      cancelled = true;
    };
  }, [zipCode, counties]);

  const subsidyProjection = useMemo(() => {
    const income = Number(annualIncome);
    if (!income || income <= 0) return null;

    const silverPremiums = countyPlanIds
      .map((id) => plans[id])
      .filter((p) => p?.metal === "Silver")
      .map((p) => getPremium(p, county, age))
      .filter((p) => p != null)
      .sort((a, b) => a - b);

    if (!silverPremiums.length) return null;

    const benchmark = silverPremiums[Math.min(1, silverPremiums.length - 1)];
    const fpl = getFpl2026(householdSize);
    const fplPercent = (income / fpl) * 100;
    const rate = getExpectedContributionRate(fplPercent);
    const expectedMonthlyContribution = (income * rate) / 12;
    const monthlySubsidy = Math.max(0, benchmark - expectedMonthlyContribution);

    return {
      monthlySubsidy,
      annualSubsidy: monthlySubsidy * 12,
      fplPercent,
      csrLevel: getProjectedCsrLevel(fplPercent),
    };
  }, [annualIncome, householdSize, countyPlanIds, plans, county, age]);

  const effectiveCsrLevel = subsidyProjection?.csrLevel || "";

  const filtered = useMemo(() => {
    let entries = countyPlanIds.map((id) => [id, plans[id]]).filter(([, p]) => !!p);

    if (metalFilter !== "All") entries = entries.filter(([, p]) => p.metal === metalFilter);
    if (carrierQuery.trim()) {
      const cq = carrierQuery.trim().toLowerCase();
      entries = entries.filter(([, p]) => String(p.issuer || "").toLowerCase().includes(cq));
    }
    if (dentalOnly) entries = entries.filter(([, p]) => !!p.adultDental);

    const q = search.trim().toLowerCase();
    if (q) {
      entries = entries.filter(([, p]) => {
        const text = `${p.name} ${p.issuer} ${p.metal} ${p.planType}`.toLowerCase();
        return text.includes(q);
      });
    }

    entries.sort((a, b) => {
      const pa = a[1];
      const pb = b[1];
      if (sortBy === "premium") {
        const ap = adjustPremium(getPremium(pa, county, age), subsidyProjection?.monthlySubsidy, subsidyApplied) ?? Number.POSITIVE_INFINITY;
        const bp = adjustPremium(getPremium(pb, county, age), subsidyProjection?.monthlySubsidy, subsidyApplied) ?? Number.POSITIVE_INFINITY;
        return ap - bp;
      }
      if (sortBy === "deductible") {
        return parseDollar(getBenefits(pa, effectiveCsrLevel).medDeductInd) - parseDollar(getBenefits(pb, effectiveCsrLevel).medDeductInd);
      }
      if (sortBy === "moop") {
        return parseDollar(getBenefits(pa, effectiveCsrLevel).medMoopInd) - parseDollar(getBenefits(pb, effectiveCsrLevel).medMoopInd);
      }
      return METAL_ORDER.indexOf(pa.metal) - METAL_ORDER.indexOf(pb.metal);
    });

    return entries;
  }, [countyPlanIds, plans, metalFilter, carrierQuery, dentalOnly, search, sortBy, county, age, effectiveCsrLevel, subsidyProjection, subsidyApplied]);

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setSelectedPlans((prev) => prev.filter((id) => countyPlanIds.includes(id)));
  }, [county, countyPlanIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [county, metalFilter, carrierQuery, dentalOnly, search, sortBy, age, annualIncome, householdSize, zipCode, subsidyApplied]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    function onDocClick(event) {
      const menu = document.getElementById("dropdownMenu");
      const button = document.getElementById("menuButton");
      if (!menu || !button) return;
      if (!menu.contains(event.target) && !button.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function togglePlan(id) {
    setSelectedPlans((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  return (
    <>
      <style>{`
        :root {
          --navy: #1B2A4A;
          --navy-deep: #0F1A2E;
          --blue: #2563EB;
          --gold: #D4A843;
          --white: #FFFFFF;
          --gray-100: #F1F5F9;
          --gray-200: #E2E8F0;
          --gray-500: #64748B;
          --gray-700: #334155;
          --gray-800: #1E293B;
          --radius: 12px;
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'DM Sans', sans-serif; color: var(--gray-800); background: #F8FAFC; }
        a { color: var(--blue); }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .muted { color: var(--gray-500); }
        .small { font-size: 12px; }

        .compliance-banner { background: var(--navy-deep); color: rgba(255,255,255,0.85); text-align: center; padding: 10px 20px; font-size: 12px; }
        .compliance-banner strong { color: var(--gold); }

        header { background: rgba(255,255,255,0.96); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 30; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 0; gap: 12px; }
        .logo-container { display: flex; align-items: center; gap: 15px; position: relative; }
        .brand-name { font-family: 'Instrument Serif', serif; font-size: 20px; color: var(--navy); line-height: 1.2; }
        .license-tag { display: block; font-size: 11px; color: var(--gold); font-weight: 600; font-family: 'DM Sans', sans-serif; }
        .menu-button { background: none; border: none; cursor: pointer; padding: 8px; border-radius: 4px; }
        .menu-button:hover { background-color: var(--gray-100); }
        .ellipses { display: flex; flex-direction: column; gap: 3px; }
        .dot { width: 4px; height: 4px; background-color: var(--gray-500); border-radius: 50%; }
        .dropdown-menu {
          position: absolute; top: calc(100% + 8px); left: 0; background: #fff; border: 1px solid var(--gray-200);
          border-radius: var(--radius); min-width: 220px; box-shadow: 0 12px 30px rgba(0,0,0,0.12);
          opacity: 0; visibility: hidden; transform: translateY(-8px); transition: all .18s ease;
        }
        .dropdown-menu.show { opacity: 1; visibility: visible; transform: translateY(0); }
        .menu-item { padding: 12px 14px; border-bottom: 1px solid var(--gray-100); }
        .menu-item:last-child { border-bottom: none; }
        .menu-item a { text-decoration: none; color: var(--gray-800); font-weight: 500; display: block; }
        .nav-links { display: flex; gap: 20px; list-style: none; padding: 0; margin: 0; }
        .nav-links a { text-decoration: none; color: var(--gray-700); font-weight: 500; }
        .cta-group { display: flex; align-items: center; }
        .cta-button { background: var(--gold); color: var(--navy-deep); padding: 10px 18px; border-radius: 999px; text-decoration: none; font-weight: 700; }

        .hero { background: linear-gradient(165deg, var(--navy-deep) 0%, var(--navy) 55%, #1E3A5F 100%); color: #fff; padding: 72px 0 52px; }
        .hero h1 { font-family: 'Instrument Serif', serif; font-size: 48px; margin: 0 0 10px; font-weight: 400; }
        .hero p { margin: 0; font-size: 18px; opacity: 0.9; max-width: 760px; }

        .engine-wrap { margin-top: -24px; padding-bottom: 40px; }
        .panel { background: #fff; border: 1px solid var(--gray-200); border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); padding: 16px; }
        .controls { display: grid; grid-template-columns: repeat(4, minmax(180px, 1fr)); gap: 10px; }
        .controls input { width: 100%; border: 1px solid var(--gray-200); border-radius: 10px; padding: 10px; font-family: inherit; }
        .chip-row { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .inline-controls { margin-top: 10px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .solid-btn, .ghost-btn { border-radius: 999px; padding: 8px 14px; font-weight: 700; cursor: pointer; border: 1px solid var(--gray-200); }
        .solid-btn { background: var(--navy); color: #fff; border-color: var(--navy); }
        .ghost-btn { background: #fff; color: var(--gray-700); }
        .enroll-banner {
          margin-top: 14px;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #d9e6fb;
          background: linear-gradient(180deg, #f5f9ff 0%, #edf4ff 100%);
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          justify-content: space-between;
        }
        .enroll-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .enroll-btn {
          text-decoration: none;
          border-radius: 999px;
          padding: 9px 14px;
          font-weight: 700;
          font-size: 13px;
          border: 1px solid transparent;
        }
        .enroll-btn.primary { background: var(--gold); color: #0F1A2E; }
        .enroll-btn.secondary { background: #1B2A4A; color: #fff; }

        .cards { margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 22px; }
        .card {
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          border: 1px solid #dbe6f7;
          border-radius: 16px;
          padding: 22px;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(15, 26, 46, 0.12), inset 0 1px 0 rgba(255,255,255,0.8);
          transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(15, 26, 46, 0.18), inset 0 1px 0 rgba(255,255,255,0.9);
          border-color: #b9ccef;
        }
        .card.selected {
          border: 2px solid var(--blue);
          background: linear-gradient(180deg, #f3f8ff 0%, #eef5ff 100%);
          box-shadow: 0 18px 40px rgba(37, 99, 235, 0.24);
        }
        .card-top { display: flex; justify-content: space-between; gap: 10px; }
        .premium { font-size: 34px; font-weight: 800; color: var(--navy); margin-top: 10px; letter-spacing: -0.4px; }
        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 14px;
          margin-top: 12px;
          padding: 12px;
          border: 1px solid #e3ebf8;
          border-radius: 12px;
          background: #ffffff;
        }
        .detail-grid div { font-size: 12px; line-height: 1.45; color: #243449; }
        .pill-row { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
        .pill {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 9px;
          border-radius: 999px;
          border: 1px solid #d9e6fb;
          background: #f4f8ff;
          color: #244a86;
        }
        .card-actions {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .card-cta {
          text-decoration: none;
          border-radius: 999px;
          padding: 8px 12px;
          font-weight: 700;
          font-size: 12px;
          border: 1px solid #d6e2f7;
        }
        .card-cta.call { background: #fff; color: #1B2A4A; }
        .card-cta.form { background: #1B2A4A; color: #fff; border-color: #1B2A4A; }

        footer { background: var(--navy-deep); color: rgba(255,255,255,0.85); padding: 56px 0 28px; margin-top: 26px; }
        .footer-grid { display: grid; grid-template-columns: repeat(3, minmax(200px, 1fr)); gap: 24px; text-align: left; }
        .footer-column h3 { color: #fff; font-family: 'Instrument Serif', serif; font-weight: 400; margin-bottom: 12px; }
        .footer-column ul { list-style: none; padding: 0; margin: 0; }
        .footer-column li { margin-bottom: 10px; }
        .footer-column a { color: var(--gold); text-decoration: none; }
        .footer-column a:hover { text-decoration: underline; }
        .footer-bottom { text-align: center; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.14); padding-top: 18px; font-size: 13px; }

        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 50; padding: 24px; overflow: auto; }
        .compare-modal { max-width: 1120px; margin: 20px auto; background: #fff; border-radius: 16px; padding: 16px; }
        .compare-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .table-wrap { overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border-bottom: 1px solid var(--gray-200); padding: 10px; text-align: left; vertical-align: top; }

        @media (max-width: 900px) {
          .hero h1 { font-size: 34px; }
          .controls { grid-template-columns: 1fr 1fr; }
          .nav-links { display: none; }
          .cta-group { display: none; }
        }
        @media (max-width: 640px) {
          .controls { grid-template-columns: 1fr; }
          .footer-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="compliance-banner"><strong>Important:</strong> Summary data only. Final pricing and eligibility are confirmed by Marketplace and carrier documents.</div>

      <header>
        <nav className="container">
          <div className="logo-container">
            <div className="brand-name">Lakeland Health Insurance<span className="license-tag">Licensed FL Broker #W371813</span></div>
            <button id="menuButton" type="button" className="menu-button" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle navigation menu">
              <div className="ellipses">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </button>
            <div id="dropdownMenu" className={`dropdown-menu${menuOpen ? " show" : ""}`}>
              <div className="menu-item"><a href="/">Home</a></div>
              <div className="menu-item"><a href="/plans/">Health Plans</a></div>
              <div className="menu-item"><a href="/blog/">Blog</a></div>
              <div className="menu-item"><a href="/about">About</a></div>
              <div className="menu-item"><a href="/links/">Links</a></div>
              <div className="menu-item"><a href="/contact/">Contact</a></div>
              <div className="menu-item"><a href="tel:+18636403102">Call Now</a></div>
            </div>
          </div>
          <ul className="nav-links">
            <li><a href="/">Home</a></li>
            <li><a href="/plans/">Health Plans</a></li>
            <li><a href="/blog/">Blog</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/links/">Links</a></li>
            <li><a href="/contact/">Contact</a></li>
          </ul>
          <div className="cta-group">
            <a className="cta-button" href="/get-help/">Talk to David</a>
          </div>
        </nav>
      </header>

      <section className="hero">
        <div className="container">
          <h1>Health Insurance Plans That Work</h1>
          <p>Full Florida comparison engine across all counties with a quick subsidy estimate based on household size and income.</p>
        </div>
      </section>

      <main className="engine-wrap container">
        <section className="panel">
          {loading && <p>Loading plan data...</p>}
          {loadError && <p style={{ color: "#b91c1c" }}>{loadError}</p>}

          {!loading && !loadError && (
            <>
              <div className="controls">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={5}
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="ZIP Code"
                />
                <input
                  type="number"
                  min="0"
                  max="64"
                  step="1"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Age"
                />
                <input
                  type="number"
                  min="1"
                  max="12"
                  step="1"
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(e.target.value)}
                  placeholder="Household Size"
                />
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={annualIncome}
                  onChange={(e) => {
                    setAnnualIncome(e.target.value);
                    setSubsidyApplied(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (Number(annualIncome) > 0) setSubsidyApplied(true);
                    }
                  }}
                  placeholder="Annual Household Income"
                />
                <input value={carrierQuery} onChange={(e) => setCarrierQuery(e.target.value)} placeholder="Carrier contains (e.g. Blue, UHC)" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search plan name or carrier" />
                <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={dentalOnly} onChange={(e) => setDentalOnly(e.target.checked)} /> Adult dental only
                </label>
              </div>

              <div className="chip-row">
                <span className="muted small">Metal:</span>
                {["All", ...METAL_ORDER].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={m === metalFilter ? "solid-btn" : "ghost-btn"}
                    onClick={() => setMetalFilter(m)}
                  >
                    {m}
                  </button>
                ))}
                <span className="muted small" style={{ marginLeft: 12 }}>Sort:</span>
                {[
                  ["premium", "Premium"],
                  ["deductible", "Deductible"],
                  ["moop", "Max OOP"],
                  ["metal", "Metal"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={sortBy === key ? "solid-btn" : "ghost-btn"}
                    onClick={() => setSortBy(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="enroll-banner">
                <div>
                  <strong>Ready to enroll?</strong>
                  <div className="muted small">Call David now or complete the enrollment form and get matched fast.</div>
                </div>
                <div className="enroll-actions">
                  <a className="enroll-btn primary" href="tel:+18636403102">Call David: (863) 640-3102</a>
                  <a className="enroll-btn secondary" href="/get-help/">Start Enrollment Form</a>
                </div>
              </div>

              <div className="inline-controls">
                <span className="muted">
                  {filtered.length} plans in {county} County
                  {filtered.length > 0 && ` | Showing ${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, filtered.length)}`}
                </span>
                <span className="muted small">
                  {zipLookupState === "loading" ? "ZIP lookup in progress..." : zipLookupMessage}
                </span>
                {subsidyProjection && (
                  <span className="muted">
                    Projected subsidy: <strong>{CURRENCY.format(subsidyProjection.monthlySubsidy)}/mo</strong> ({CURRENCY.format(subsidyProjection.annualSubsidy)}/yr)
                    {effectiveCsrLevel && ` | Projected CSR: ${effectiveCsrLevel}`}
                  </span>
                )}
                {Number(annualIncome) > 0 && (
                  <span className="muted small">
                    {subsidyApplied ? "Subsidy pricing applied" : "Press Enter in income field to apply subsidy to all displayed prices"}
                  </span>
                )}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <button type="button" className="ghost-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    Prev
                  </button>
                  <span className="muted small">Page {currentPage} of {totalPages}</span>
                  <button type="button" className="ghost-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next
                  </button>
                </div>
                {selectedPlans.length >= 2 && <button type="button" className="solid-btn" onClick={() => setShowCompare(true)}>Compare {selectedPlans.length}</button>}
                {selectedPlans.length > 0 && <button type="button" className="ghost-btn" onClick={() => setSelectedPlans([])}>Clear Selection</button>}
              </div>

              <div className="cards">
                {paged.map(([id, p]) => {
                  const basePremium = getPremium(p, county, age);
                  const premium = adjustPremium(basePremium, subsidyProjection?.monthlySubsidy, subsidyApplied);
                  const benefits = getBenefits(p, effectiveCsrLevel);
                  const selected = selectedPlans.includes(id);
                  return (
                    <article key={id} className={`card${selected ? " selected" : ""}`} onClick={() => togglePlan(id)}>
                      <div className="card-top">
                        <strong>{p.metal}</strong>
                        <span className="muted small">{p.planType || "-"}</span>
                      </div>
                      <div className="muted small" style={{ marginTop: 6 }}>{p.issuer}</div>
                      <div style={{ fontWeight: 700, marginTop: 8 }}>{p.name}</div>
                      <div className="pill-row">
                        {p.adultDental ? <span className="pill">Adult Dental</span> : null}
                        {effectiveCsrLevel && p.metal === "Silver" ? <span className="pill">CSR {effectiveCsrLevel}%</span> : null}
                        <span className="pill">{county} County</span>
                      </div>

                      <div className="premium">{premium == null ? "-" : `$${premium.toFixed(2)}`}</div>
                      <div className="muted small">
                        {subsidyApplied ? `Estimated monthly after subsidy (age ${age || "?"})` : `Monthly premium before subsidy (age ${age || "?"})`}
                      </div>
                      {subsidyApplied && basePremium != null && premium != null && (
                        <div className="muted small" style={{ marginTop: 4 }}>
                          Base premium: {CURRENCY.format(basePremium)}
                        </div>
                      )}
                      {!subsidyApplied && basePremium != null && subsidyProjection && (
                        <div className="muted small" style={{ marginTop: 4 }}>
                          Est. after subsidy: {CURRENCY.format(Math.max(0, basePremium - subsidyProjection.monthlySubsidy))}
                        </div>
                      )}

                      <div className="detail-grid">
                        <div><strong>Deductible (Ind):</strong> {benefits.medDeductInd || "-"}</div>
                        <div><strong>Deductible (Fam):</strong> {benefits.medDeductFam || "-"}</div>
                        <div><strong>Max OOP (Ind):</strong> {benefits.medMoopInd || "-"}</div>
                        <div><strong>Max OOP (Fam):</strong> {benefits.medMoopFam || "-"}</div>
                        <div><strong>PCP:</strong> {benefits.pcp || "-"}</div>
                        <div><strong>Specialist:</strong> {benefits.specialist || "-"}</div>
                        <div><strong>ER:</strong> {benefits.er || "-"}</div>
                        <div><strong>Inpatient:</strong> {benefits.inpatient || "-"}</div>
                        <div><strong>Generic Rx:</strong> {benefits.genericRx || "-"}</div>
                        <div><strong>Pref Brand Rx:</strong> {benefits.prefBrandRx || "-"}</div>
                      </div>

                      <div className="small" style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {p.sbcUrl ? <a href={p.sbcUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>SBC</a> : null}
                        {p.formularyUrl ? <a href={p.formularyUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Formulary</a> : null}
                        {p.brochureUrl ? <a href={p.brochureUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Brochure</a> : null}
                      </div>
                      <div className="card-actions">
                        <a className="card-cta call" href="tel:+18636403102" onClick={(e) => e.stopPropagation()}>
                          Enroll Now - Call
                        </a>
                        <a className="card-cta form" href="/get-help/" onClick={(e) => e.stopPropagation()}>
                          Enroll Now - Form
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>

              {filtered.length === 0 && <p className="muted" style={{ marginTop: 16 }}>No plans match current filters.</p>}
            </>
          )}
        </section>
      </main>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div className="footer-column">
              <h3>Contact David</h3>
              <ul>
                <li><a href="tel:+18636403102">(863) 640-3102</a></li>
                <li><a href="mailto:dhuff@healthmarkets.com">dhuff@healthmarkets.com</a></li>
                <li><a href="https://m.me/2330958066941437" target="_blank" rel="noopener noreferrer">David the Insurance Dude</a></li>
                <li>Central Florida Headquarters</li>
                <li>Mon-Fri 8AM-8PM EST</li>
                <li>Sat 9AM-5PM EST</li>
              </ul>
            </div>
            <div className="footer-column">
              <h3>Service Areas</h3>
              <ul>
                <li>Florida Residents</li>
                <li>Coverage Across the Nation</li>
                <li>Small Business Groups</li>
                <li>Individual and Family Coverage</li>
                <li>Medicare Specialists</li>
              </ul>
            </div>
            <div className="footer-column">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/plans/">Insurance Plans</a></li>
                <li><a href="/health-protector-guard/">Health Protector Guard</a></li>
                <li><a href="/blog/">Blog</a></li>
                <li><a href="/our-approach.html">Our Approach</a></li>
                <li><a href="/blog/florida-insurance-guide.html">Florida Health Insurance Guide</a></li>
                <li><a href="/contact/">Get Quote</a></li>
                <li><a href="/privacy-policy.html">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 Lakeland Health Insurance. Licensed insurance agency serving families and businesses across the nation.</p>
            <p>FL License #W371813 | Serving most of the United States with honest insurance advice</p>
            <p style={{ marginTop: "1rem" }}>
              <a href="https://www.facebook.com/HealthMarkets.David.Huff" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)", textDecoration: "none", fontWeight: 500 }}>
                Powered by David the Insurance Dude
              </a>
            </p>
          </div>
        </div>
      </footer>

      {showCompare && (
        <CompareModal
          ids={selectedPlans}
          plans={plans}
          county={county}
          age={age}
          csrLevel={effectiveCsrLevel}
          subsidyMonthly={subsidyProjection?.monthlySubsidy || 0}
          applySubsidy={subsidyApplied}
          onClose={() => setShowCompare(false)}
          onRemove={(id) => setSelectedPlans((prev) => prev.filter((x) => x !== id))}
        />
      )}
    </>
  );
}
