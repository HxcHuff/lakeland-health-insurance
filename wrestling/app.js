// ── 2026 NCAA Wrestling Fantasy Draft App ──

// ── Theme Toggle ──
function initTheme() {
  const saved = localStorage.getItem("wrestlingTheme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  if (next === "dark") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", next);
  }
  localStorage.setItem("wrestlingTheme", next);
}

// Apply theme immediately (before DOM ready) to prevent flash
initTheme();

const TEAM_NAMES = [
  "Joe Lowe", "Eli", "Jerry", "Ab", "Levi",
  "Issac", "Jason", "Sher", "Huff", "Connor"
];

const WEIGHT_CLASSES = ["125", "133", "141", "149", "157", "165", "174", "184", "197", "HWT"];

const SCORING = {
  "1st": 16, "2nd": 12, "3rd": 10, "4th": 8,
  "5th": 6, "6th": 5, "7th": 4, "8th": 3, "R12": 1.5, "DNP": 0
};

const PLACEMENT_OPTIONS = ["--", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "R12", "DNP"];

// Full draft picks data: each weight class has 10 wrestlers in draft order (index = team index)
const PICKS = {
  "125": [
    { rank: 3, name: "Nic Bouzakis", school: "Ohio State", yr: "Jr", record: "16-2", seed: 3 },
    { rank: 8, name: "Dean Peterson", school: "Iowa", yr: "Sr", record: "14-6", seed: 8 },
    { rank: 6, name: "Jore Volk", school: "Minnesota", yr: "Jr", record: "22-5", seed: 6 },
    { rank: 1, name: "Luke Lilledahl", school: "Penn State", yr: "So", record: "20-0", seed: 1 },
    { rank: 2, name: "Eddie Ventresca", school: "Virginia Tech", yr: "Sr", record: "19-2", seed: 2 },
    { rank: 5, name: "Troy Spratley", school: "OK State", yr: "Jr", record: "16-3", seed: 5 },
    { rank: 7, name: "Nico Provo", school: "Stanford", yr: "Jr", record: "13-5", seed: 7 },
    { rank: 13, name: "Stevo Poulin", school: "Iowa State", yr: "Sr", record: "15-7", seed: 13 },
    { rank: 4, name: "Sheldon Seymour", school: "Lehigh", yr: "Sr", record: "19-0", seed: 4 },
    { rank: 12, name: "Vincent Robinson", school: "NC State", yr: "Jr", record: "15-4", seed: 12 }
  ],
  "133": [
    { rank: 2, name: "Ben Davino", school: "Ohio State", yr: "Jr", record: "27-1", seed: 2 },
    { rank: 4, name: "Aaron Seidel", school: "Virginia Tech", yr: "Fr", record: "18-1", seed: 4 },
    { rank: 3, name: "Marcus Blaze", school: "Penn State", yr: "Fr", record: "21-1", seed: 3 },
    { rank: 9, name: "Dominick Serrano", school: "N. Colorado", yr: "Jr", record: "15-3", seed: 9 },
    { rank: 6, name: "Drake Ayala", school: "Iowa", yr: "Sr", record: "13-8", seed: 6 },
    { rank: 1, name: "Jax Forrest", school: "OK State", yr: "Fr", record: "13-0", seed: 1 },
    { rank: 7, name: "Lucas Byrd", school: "Illinois", yr: "Gr", record: "20-2", seed: 7 },
    { rank: 13, name: "Jacob Van Dee", school: "Nebraska", yr: "Jr", record: "17-6", seed: 13 },
    { rank: 5, name: "Kyler Larkin", school: "Arizona State", yr: "Jr", record: "18-2", seed: 5 },
    { rank: 11, name: "Tyler Ferrara", school: "Cornell", yr: "Jr", record: "23-7", seed: 11 }
  ],
  "141": [
    { rank: 8, name: "Vance Vombaur", school: "Minnesota", yr: "Jr", record: "21-6", seed: 8 },
    { rank: 5, name: "Luke Stanich", school: "Lehigh", yr: "Sr", record: "13-0", seed: 5 },
    { rank: 1, name: "Jesse Mendez", school: "Ohio State", yr: "Gr", record: "22-0", seed: 1 },
    { rank: 6, name: "Vince Cornella", school: "Cornell", yr: "Jr", record: "19-1", seed: 6 },
    { rank: 2, name: "Sergio Vega", school: "OK State", yr: "Fr", record: "19-0", seed: 2 },
    { rank: 7, name: "Nasir Bailey", school: "Iowa", yr: "Jr", record: "14-7", seed: 7 },
    { rank: 4, name: "Anthony Echemendia", school: "Iowa State", yr: "Jr", record: "19-3", seed: 4 },
    { rank: 3, name: "Brock Hardy", school: "Nebraska", yr: "Gr", record: "20-5", seed: 3 },
    { rank: 9, name: "Joey Olivieri", school: "Rutgers", yr: "Jr", record: "19-2", seed: 9 },
    { rank: 10, name: "Jack Consiglio", school: "Stanford", yr: "Jr", record: "14-5", seed: 10 }
  ],
  "149": [
    { rank: 3, name: "Cross Wasilewski", school: "Penn", yr: "Sr", record: "24-3", seed: 3 },
    { rank: 5, name: "Koy Buesgens", school: "NC State", yr: "Jr", record: "21-3", seed: 5 },
    { rank: 8, name: "Casey Swiderski", school: "OK State", yr: "Jr", record: "14-5", seed: 8 },
    { rank: 2, name: "Jaxon Joy", school: "Cornell", yr: "Sr", record: "24-1", seed: 2 },
    { rank: 7, name: "Ethan Stiles", school: "Ohio State", yr: "Jr", record: "15-5", seed: 7 },
    { rank: 6, name: "Caleb Tyus", school: "SIUE", yr: "Sr", record: "22-2", seed: 6 },
    { rank: 11, name: "Lachlan McNeil", school: "Michigan", yr: "Jr", record: "17-6", seed: 11 },
    { rank: 1, name: "Shayne Van Ness", school: "Penn State", yr: "Jr", record: "21-0", seed: 1 },
    { rank: 10, name: "Aden Valencia", school: "Stanford", yr: "Jr", record: "16-7", seed: 10 },
    { rank: 4, name: "Collin Gaj", school: "Virginia Tech", yr: "Sr", record: "20-8", seed: 4 }
  ],
  "157": [
    { rank: 8, name: "Brandon Cannon", school: "Ohio State", yr: "Sr", record: "18-2", seed: 8 },
    { rank: 7, name: "Kannon Webster", school: "Illinois", yr: "Jr", record: "20-4", seed: 7 },
    { rank: 9, name: "Daniel Cardenas", school: "Stanford", yr: "Jr", record: "17-3", seed: 9 },
    { rank: 3, name: "Meyer Shapiro", school: "Cornell", yr: "Jr", record: "15-1", seed: 3 },
    { rank: 4, name: "Kaleb Larkin", school: "Arizona State", yr: "Sr", record: "24-2", seed: 4 },
    { rank: 11, name: "Ty Watters", school: "West Virginia", yr: "Jr", record: "22-3", seed: 11 },
    { rank: 1, name: "PJ Duke", school: "Penn State", yr: "Fr", record: "19-1", seed: 1 },
    { rank: 5, name: "Landon Robideau", school: "OK State", yr: "Fr", record: "16-2", seed: 5 },
    { rank: 6, name: "Jude Swisher", school: "Penn", yr: "Jr", record: "20-3", seed: 6 },
    { rank: 2, name: "Antrell Taylor", school: "Nebraska", yr: "Sr", record: "22-3", seed: 2 }
  ],
  "165": [
    { rank: 1, name: "Mitchell Mesenbrink", school: "Penn State", yr: "Gr", record: "22-0", seed: 1 },
    { rank: 6, name: "LJ Araujo", school: "Nebraska", yr: "Sr", record: "18-8", seed: 6 },
    { rank: 11, name: "Ryder Downey", school: "Northern Iowa", yr: "Sr", record: "21-5", seed: 11 },
    { rank: 7, name: "Max Brignola", school: "Lehigh", yr: "Sr", record: "17-4", seed: 7 },
    { rank: 5, name: "LaDarion Lockett", school: "OK State", yr: "Fr", record: "16-2", seed: 5 },
    { rank: 10, name: "Will Denny", school: "NC State", yr: "Sr", record: "16-4", seed: 10 },
    { rank: 2, name: "Joey Blaze", school: "Purdue", yr: "Sr", record: "22-1", seed: 2 },
    { rank: 4, name: "Nicco Ruiz", school: "Arizona State", yr: "Sr", record: "23-5", seed: 4 },
    { rank: 8, name: "Matty Bianchi", school: "Little Rock", yr: "Sr", record: "19-2", seed: 8 },
    { rank: 3, name: "Mikey Caliendo", school: "Iowa", yr: "Jr", record: "18-4", seed: 3 }
  ],
  "174": [
    { rank: 10, name: "Myles Takats", school: "Bucknell", yr: "Sr", record: "22-6", seed: 10 },
    { rank: 9, name: "Beau Mantanona", school: "Michigan", yr: "Jr", record: "21-7", seed: 9 },
    { rank: 8, name: "Alex Facundo", school: "OK State", yr: "Jr", record: "16-6", seed: 8 },
    { rank: 5, name: "Patrick Kennedy", school: "Iowa", yr: "Jr", record: "18-4", seed: 5 },
    { rank: 1, name: "Levi Haines", school: "Penn State", yr: "Sr", record: "21-0", seed: 1 },
    { rank: 6, name: "Matty Singleton", school: "NC State", yr: "Jr", record: "16-3", seed: 6 },
    { rank: 2, name: "Simon Ruiz", school: "Cornell", yr: "Fr", record: "16-0", seed: 2 },
    { rank: 7, name: "Cam Steed", school: "Missouri", yr: "Sr", record: "15-5", seed: 7 },
    { rank: 3, name: "Christopher Minto", school: "Nebraska", yr: "Jr", record: "20-5", seed: 3 },
    { rank: 4, name: "Carson Kharchla", school: "Ohio State", yr: "Gr", record: "18-4", seed: 4 }
  ],
  "184": [
    { rank: 8, name: "Silas Allred", school: "Nebraska", yr: "Jr", record: "17-7", seed: 8 },
    { rank: 3, name: "Max McEnelly", school: "Minnesota", yr: "Jr", record: "19-2", seed: 3 },
    { rank: 4, name: "James Conway", school: "Franklin & Marshall", yr: "Jr", record: "32-2", seed: 4 },
    { rank: 6, name: "Eddie Neitenbach", school: "Wyoming", yr: "Sr", record: "20-6", seed: 6 },
    { rank: 13, name: "Isaac Dean", school: "Iowa State", yr: "Jr", record: "17-7", seed: 13 },
    { rank: 2, name: "Aeoden Sinclair", school: "Missouri", yr: "Sr", record: "30-1", seed: 2 },
    { rank: 12, name: "Dylan Fishback", school: "Ohio State", yr: "Jr", record: "18-8", seed: 12 },
    { rank: 5, name: "Brock Mantanona", school: "Michigan", yr: "Jr", record: "19-6", seed: 5 },
    { rank: 1, name: "Rocco Welsh", school: "Penn State", yr: "So", record: "20-0", seed: 1 },
    { rank: 7, name: "Angelo Ferrari", school: "Iowa", yr: "Jr", record: "11-3", seed: 7 }
  ],
  "197": [
    { rank: 3, name: "Stephen Little", school: "Little Rock", yr: "Sr", record: "15-2", seed: 3 },
    { rank: 1, name: "Josh Barr", school: "Penn State", yr: "Jr", record: "19-0", seed: 1 },
    { rank: 2, name: "Rocky Elam", school: "Iowa State", yr: "Sr", record: "18-0", seed: 2 },
    { rank: 4, name: "Sonny Sasso", school: "Virginia Tech", yr: "Sr", record: "25-5", seed: 4 },
    { rank: 27, name: "Gabe Arnold", school: "Iowa", yr: "Jr", record: "18-7", seed: 27 },
    { rank: 5, name: "Joey Novak", school: "Wyoming", yr: "Sr", record: "17-3", seed: 5 },
    { rank: 19, name: "Zayne Lehman", school: "Ohio", yr: "Jr", record: "19-2", seed: 19 },
    { rank: 11, name: "Camden McDanel", school: "Nebraska", yr: "Jr", record: "20-6", seed: 11 },
    { rank: 7, name: "Cody Merrill", school: "OK State", yr: "Jr", record: "17-4", seed: 7 },
    { rank: 6, name: "Justin Rademacher", school: "Oregon State", yr: "Sr", record: "23-3", seed: 6 }
  ],
  "HWT": [
    { rank: 6, name: "Nathan Taylor", school: "Lehigh", yr: "Jr", record: "16-3", seed: 6 },
    { rank: 8, name: "Ben Kueter", school: "Iowa", yr: "So", record: "9-7", seed: 8 },
    { rank: 5, name: "Nick Feldman", school: "Ohio State", yr: "Jr", record: "23-5", seed: 5 },
    { rank: 3, name: "Taye Ghadiali", school: "Michigan", yr: "Jr", record: "23-2", seed: 3 },
    { rank: 11, name: "Devon Dawson", school: "Northern Illinois", yr: "Sr", record: "31-4", seed: 11 },
    { rank: 4, name: "AJ Ferrari", school: "Nebraska", yr: "Sr", record: "15-3", seed: 4 },
    { rank: 7, name: "Konner Doucet", school: "OK State", yr: "Sr", record: "17-3", seed: 7 },
    { rank: 1, name: "Yonger Bastida", school: "Iowa State", yr: "Gr", record: "25-0", seed: 1 },
    { rank: 9, name: "Cole Mirasola", school: "Penn State", yr: "Jr", record: "17-6", seed: 9 },
    { rank: 2, name: "Isaac Trumble", school: "NC State", yr: "Jr", record: "16-0", seed: 2 }
  ]
};

// ── State ──
let results = loadResults();

function loadResults() {
  try {
    const saved = localStorage.getItem("wrestlingResults");
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function saveResults() {
  localStorage.setItem("wrestlingResults", JSON.stringify(results));
}

// ── Helpers ──
function getOwner(weightClass, wrestlerIndex) {
  return TEAM_NAMES[wrestlerIndex];
}

function getPlacement(weightClass, seed) {
  const key = `${weightClass}-${seed}`;
  return results[key] || null;
}

function getPoints(placement) {
  return SCORING[placement] || 0;
}

function getWrestlerPoints(weightClass, wrestler) {
  const placement = getPlacement(weightClass, wrestler.seed);
  return placement ? getPoints(placement) : 0;
}

function getTeamData() {
  return TEAM_NAMES.map((name, teamIdx) => {
    let totalPoints = 0;
    const wrestlers = WEIGHT_CLASSES.map(wc => {
      const wrestler = PICKS[wc][teamIdx];
      const placement = getPlacement(wc, wrestler.seed);
      const points = placement ? getPoints(placement) : 0;
      totalPoints += points;
      return { ...wrestler, weightClass: wc, placement, points };
    });
    return { name, teamIdx, totalPoints, wrestlers };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
}

// ── Render: Standings ──
function renderStandings() {
  const teams = getTeamData();
  const container = document.getElementById("standings-table");

  let html = `<div class="standings-container"><table class="standings">
    <thead><tr>
      <th>Rank</th><th>Team</th>`;

  WEIGHT_CLASSES.forEach(wc => {
    html += `<th class="score-col">${wc}</th>`;
  });

  html += `<th class="score-col">Total</th></tr></thead><tbody>`;

  teams.forEach((team, i) => {
    const rankClass = i < 3 ? `rank-${i + 1}` : "rank-other";
    html += `<tr>
      <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
      <td class="team-name-cell">${team.name}</td>`;

    team.wrestlers.forEach(w => {
      const pts = w.points;
      const cls = pts > 0 ? "pts-positive" : "pts-zero";
      html += `<td class="score-col ${cls}">${pts > 0 ? pts : "-"}</td>`;
    });

    html += `<td class="score-col total-score">${team.totalPoints}</td></tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

// ── Render: Team Rosters ──
function renderTeams() {
  const teamSelect = document.getElementById("team-select");
  const container = document.getElementById("team-rosters");
  const selected = teamSelect.value;

  // Populate dropdown if empty
  if (teamSelect.options.length <= 1) {
    TEAM_NAMES.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      teamSelect.appendChild(opt);
    });
  }

  const teams = getTeamData();
  const filtered = selected === "all" ? teams : teams.filter(t => t.name === selected);

  let html = "";
  filtered.forEach(team => {
    html += `<div class="team-card">
      <div class="team-card-header">
        <h3>${team.name}</h3>
        <div class="team-total">${team.totalPoints} <span>pts</span></div>
      </div>`;

    team.wrestlers.forEach(w => {
      const ptsClass = w.points > 0 ? "pts-positive" : "pts-zero";
      let placeBadge = "";
      if (w.placement && w.placement !== "DNP") {
        const placeClass = w.placement === "R12" ? "place-r12" : `place-${w.placement.replace(/\D/g, "")}`;
        placeBadge = `<span class="placement-badge ${placeClass}">${w.placement}</span>`;
      }

      html += `<div class="roster-row">
        <div class="roster-weight">${w.weightClass === "HWT" ? "HWT" : w.weightClass}</div>
        <div class="roster-seed">#${w.seed}</div>
        <div class="roster-wrestler">${w.name}${placeBadge}</div>
        <div class="roster-school">${w.school}</div>
        <div class="roster-record">${w.record}</div>
        <div class="roster-points ${ptsClass}">${w.points > 0 ? w.points : "-"}</div>
      </div>`;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

// ── Render: Weight Classes ──
let activeWeight = "125";

function renderWeightTabs() {
  const tabContainer = document.getElementById("weight-tabs");
  tabContainer.innerHTML = WEIGHT_CLASSES.map(wc =>
    `<button class="weight-tab ${wc === activeWeight ? "active" : ""}" data-wc="${wc}">${wc === "HWT" ? "HWT" : wc} lbs</button>`
  ).join("");

  tabContainer.querySelectorAll(".weight-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activeWeight = btn.dataset.wc;
      renderWeightTabs();
      renderWeightDetail();
    });
  });
}

function renderWeightDetail() {
  const container = document.getElementById("weight-detail");
  const wrestlers = PICKS[activeWeight].map((w, i) => ({
    ...w,
    owner: TEAM_NAMES[i],
    placement: getPlacement(activeWeight, w.seed),
    points: getWrestlerPoints(activeWeight, w)
  }));

  // Sort by seed
  const sorted = [...wrestlers].sort((a, b) => a.seed - b.seed);

  let html = `<div class="weight-card">
    <div class="weight-card-header">
      <h3>${activeWeight === "HWT" ? "Heavyweight" : activeWeight + " lbs"}</h3>
    </div>`;

  sorted.forEach(w => {
    const ptsClass = w.points > 0 ? "pts-positive" : "pts-zero";
    let placeBadge = "";
    if (w.placement && w.placement !== "DNP") {
      const placeClass = w.placement === "R12" ? "place-r12" : `place-${w.placement.replace(/\D/g, "")}`;
      placeBadge = `<span class="placement-badge ${placeClass}">${w.placement}</span>`;
    }

    html += `<div class="weight-wrestler-row">
      <div class="ww-seed">#${w.seed}</div>
      <div class="ww-name">${w.name}${placeBadge}</div>
      <div class="ww-school">${w.school} (${w.yr})</div>
      <div class="ww-record">${w.record}</div>
      <div class="ww-owner">${w.owner}</div>
      <div class="ww-points ${ptsClass}">${w.points > 0 ? w.points : "-"}</div>
    </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

// ── Render: Draft Board ──
function renderDraftBoard() {
  const container = document.getElementById("draft-board");

  let html = `<table class="draft-board"><thead><tr><th>Weight</th>`;
  TEAM_NAMES.forEach(name => { html += `<th>${name}</th>`; });
  html += `</tr></thead><tbody>`;

  WEIGHT_CLASSES.forEach(wc => {
    html += `<tr><td>${wc === "HWT" ? "HWT" : wc}</td>`;
    PICKS[wc].forEach(w => {
      html += `<td>
        <span class="db-wrestler-seed">#${w.seed}</span>
        <span class="db-wrestler-name">${w.name}</span>
        <span class="db-wrestler-school">${w.school}</span>
      </td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// ── Render: Results Entry ──
let resultsWeight = "125";

function renderResultsWeightSelect() {
  const select = document.getElementById("results-weight-select");
  select.innerHTML = WEIGHT_CLASSES.map(wc =>
    `<option value="${wc}" ${wc === resultsWeight ? "selected" : ""}>${wc === "HWT" ? "HWT" : wc} lbs</option>`
  ).join("");

  select.addEventListener("change", () => {
    resultsWeight = select.value;
    renderResultsEntry();
  });
}

function renderResultsEntry() {
  const container = document.getElementById("results-entry");
  const wrestlers = PICKS[resultsWeight].map((w, i) => ({
    ...w, owner: TEAM_NAMES[i]
  }));

  // Sort by seed for entry
  const sorted = [...wrestlers].sort((a, b) => a.seed - b.seed);

  let html = "";
  sorted.forEach(w => {
    const currentPlacement = getPlacement(resultsWeight, w.seed) || "--";

    html += `<div class="result-row">
      <div class="result-seed">#${w.seed}</div>
      <div class="result-name">${w.name} <span style="color:var(--text-muted);font-size:0.8rem">(${w.school})</span></div>
      <div class="result-owner">${w.owner}</div>
      <select class="result-select" data-wc="${resultsWeight}" data-seed="${w.seed}">
        ${PLACEMENT_OPTIONS.map(p => `<option value="${p}" ${p === currentPlacement ? "selected" : ""}>${p}</option>`).join("")}
      </select>
    </div>`;
  });

  container.innerHTML = html;
}

function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

// ── Event Listeners ──
document.addEventListener("DOMContentLoaded", () => {
  // Theme toggle
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  // Nav
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`${btn.dataset.view}-view`).classList.add("active");

      // Re-render active view
      const view = btn.dataset.view;
      if (view === "standings") renderStandings();
      else if (view === "teams") renderTeams();
      else if (view === "weights") { renderWeightTabs(); renderWeightDetail(); }
      else if (view === "draft-board") renderDraftBoard();
      else if (view === "results") { renderResultsWeightSelect(); renderResultsEntry(); }
    });
  });

  // Team select
  document.getElementById("team-select").addEventListener("change", renderTeams);

  // Save results
  document.getElementById("save-results").addEventListener("click", () => {
    const selects = document.querySelectorAll(".result-select");
    selects.forEach(sel => {
      const key = `${sel.dataset.wc}-${sel.dataset.seed}`;
      if (sel.value === "--") {
        delete results[key];
      } else {
        results[key] = sel.value;
      }
    });
    saveResults();
    renderStandings();
    showToast("Results saved!");
  });

  // Clear results
  document.getElementById("clear-results").addEventListener("click", () => {
    if (confirm("Clear ALL results for every weight class?")) {
      results = {};
      saveResults();
      renderResultsEntry();
      renderStandings();
      showToast("All results cleared");
    }
  });

  // Initial render
  renderStandings();
});
