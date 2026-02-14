# Jackson Huff — Folkstyle Wrestling Stats Dashboard

## Google Sheets Build Guide

A complete, copy-paste-ready blueprint for building a folkstyle wrestling stats dashboard in Google Sheets. Designed for fast data entry by coaches and detailed stat tracking for one athlete.

---

## Quick Start

1. Open a **new Google Sheet**
2. Rename it: `Jackson Huff — Wrestling Stats`
3. Create **4 tabs** (rename the default tab + add 3 more):
   - `MATCH_LOG`
   - `SEASON_STATS`
   - `TOURNAMENTS`
   - `DASHBOARD`
4. Follow each section below to build out headers, dropdowns, formulas, and charts

---

## TAB 1: MATCH_LOG

This is the primary data-entry sheet. One row per match.

### Column Headers (Row 1)

Enter these exactly in cells **A1 through O1**:

| Column | Header              |
|--------|---------------------|
| A      | Date                |
| B      | Event               |
| C      | Opponent            |
| D      | Opponent School     |
| E      | Weight Class        |
| F      | Result              |
| G      | Win Type            |
| H      | Final Score         |
| I      | Takedowns           |
| J      | Escapes             |
| K      | Reversals           |
| L      | Nearfall Points     |
| M      | Penalty Points      |
| N      | Match Duration (min)|
| O      | Team Points Earned  |

### Column Formatting

| Column | Format               | How to Set                                      |
|--------|----------------------|-------------------------------------------------|
| A      | Date                 | Select column A → Format → Number → Date        |
| E      | Plain text           | Manually type weight class (e.g. `138`)          |
| H      | Plain text           | Enter as text like `7-3`                         |
| I–M    | Number (0 decimals)  | Select columns I–M → Format → Number → Number   |
| N      | Number (1 decimal)   | Select column N → Format → Number → Number       |
| O      | Number (0 decimals)  | Auto-calculated — do not type in this column     |

### Data Validation — Dropdowns

#### Column F: Result

1. Select **F2:F200**
2. Go to **Data → Data validation → Add rule**
3. Criteria: **Dropdown (from a list of items)**
4. Enter these values exactly:

```
Win, Loss
```

5. Click **Done**

#### Column G: Win Type

1. Select **G2:G200**
2. Go to **Data → Data validation → Add rule**
3. Criteria: **Dropdown (from a list of items)**
4. Enter these values exactly:

```
Decision, Major, Tech, Pin, Forfeit
```

5. Click **Done**

### Formula — Team Points Earned (Column O)

In cell **O2**, paste this formula:

```
=IF(F2="","",IF(F2="Loss",0,IF(G2="Decision",3,IF(G2="Major",4,IF(G2="Tech",5,IF(OR(G2="Pin",G2="Forfeit"),6,0))))))
```

Then **copy O2 down through O200** (select O2 → drag the fill handle down, or copy → select O3:O200 → paste).

### Recommended: Header Row Formatting

1. Select **Row 1** (click the row number `1`)
2. **Bold** the text
3. Set background color to **dark blue** (`#1a237e` or similar)
4. Set font color to **white**
5. Freeze Row 1: **View → Freeze → 1 row**

### Sample Data (Optional — for testing)

Enter 2–3 sample rows to verify formulas work:

| A          | B                  | C            | D           | E   | F   | G        | H   | I | J | K | L | M | N   | O (auto) |
|------------|--------------------|--------------|-------------|-----|-----|----------|-----|---|---|---|---|---|-----|----------|
| 01/10/2026 | Lakeland Duals     | Smith, Tyler | Rival High  | 138 | Win | Decision | 7-3 | 3 | 1 | 0 | 2 | 0 | 6.0 | 3        |
| 01/10/2026 | Lakeland Duals     | Jones, Mike  | East Valley | 138 | Win | Pin      | —   | 2 | 0 | 1 | 3 | 0 | 2.5 | 6        |
| 01/17/2026 | Conference Tourney | Davis, Alex  | Westfield   | 138 | Loss| Decision | 3-5 | 1 | 2 | 0 | 0 | 1 | 6.0 | 0        |

---

## TAB 2: SEASON_STATS

This is a formula-driven summary sheet. **No manual data entry** — everything pulls from MATCH_LOG.

### Layout

Use a **label + value** layout in two columns:

| Cell | Content (type this)       | Cell | Formula (paste this)                                                                 |
|------|---------------------------|------|--------------------------------------------------------------------------------------|
| A1   | **SEASON STATS**          |      | *(merge A1:B1, bold, larger font)*                                                   |
| A2   | Athlete                   | B2   | `Jackson Huff`                                                                       |
| A3   | Weight Class              | B3   | *(type current weight class, e.g. `138`)*                                            |
| A4   |                           | B4   |                                                                                      |
| A5   | Total Matches             | B5   | `=COUNTA(MATCH_LOG!F2:F200)`                                                        |
| A6   | Wins                      | B6   | `=COUNTIF(MATCH_LOG!F2:F200,"Win")`                                                 |
| A7   | Losses                    | B7   | `=COUNTIF(MATCH_LOG!F2:F200,"Loss")`                                                |
| A8   | Win %                     | B8   | `=IF(B5=0,"—",B6/B5)`                                                               |
| A9   |                           | B9   |                                                                                      |
| A10  | Total Takedowns           | B10  | `=SUM(MATCH_LOG!I2:I200)`                                                           |
| A11  | Total Escapes             | B11  | `=SUM(MATCH_LOG!J2:J200)`                                                           |
| A12  | Total Reversals           | B12  | `=SUM(MATCH_LOG!K2:K200)`                                                           |
| A13  | Total Nearfall Points     | B13  | `=SUM(MATCH_LOG!L2:L200)`                                                           |
| A14  | Total Penalty Points      | B14  | `=SUM(MATCH_LOG!M2:M200)`                                                           |
| A15  |                           | B15  |                                                                                      |
| A16  | Total Team Points         | B16  | `=SUM(MATCH_LOG!O2:O200)`                                                           |
| A17  | Bonus Wins                | B17  | `=COUNTIFS(MATCH_LOG!F2:F200,"Win",MATCH_LOG!G2:G200,"<>Decision")`                 |
| A18  | Bonus %                   | B18  | `=IF(B6=0,"—",B17/B6)`                                                              |
| A19  |                           | B19  |                                                                                      |
| A20  | Avg Match Duration (min)  | B20  | `=IF(B5=0,"—",AVERAGE(MATCH_LOG!N2:N200))`                                          |
| A21  | Avg Takedowns per Match   | B21  | `=IF(B5=0,"—",B10/B5)`                                                              |
| A22  | Pin Rate                  | B22  | `=IF(B6=0,"—",COUNTIF(MATCH_LOG!G2:G200,"Pin")/B6)`                                 |

### Formatting

| Cell(s) | Format                                              |
|---------|-----------------------------------------------------|
| B8      | Format → Number → Percent (0 or 1 decimal)          |
| B18     | Format → Number → Percent (0 or 1 decimal)          |
| B20     | Format → Number → Number (1 decimal)                |
| B21     | Format → Number → Number (1 decimal)                |
| B22     | Format → Number → Percent (0 or 1 decimal)          |
| A1:B1   | Merge cells, 16pt bold                              |
| A5:A22  | Bold                                                |

---

## TAB 3: TOURNAMENTS

Track tournament-level results. One row per tournament/event.

### Column Headers (Row 1)

Enter these exactly in cells **A1 through I1**:

| Column | Header                |
|--------|-----------------------|
| A      | Date                  |
| B      | Tournament Name       |
| C      | Weight Class          |
| D      | Matches Wrestled      |
| E      | Wins                  |
| F      | Losses                |
| G      | Placement             |
| H      | Team Points Scored    |
| I      | Notes                 |

### Column Formatting

| Column | Format     |
|--------|------------|
| A      | Date       |
| C      | Plain text |
| D–F    | Number     |
| G      | Plain text (e.g. `1st`, `3rd`, `DNP`) |
| H      | Number     |
| I      | Plain text |

### Data Validation — Placement (Column G)

1. Select **G2:G100**
2. Go to **Data → Data validation → Add rule**
3. Criteria: **Dropdown (from a list of items)**
4. Enter these values:

```
1st, 2nd, 3rd, 4th, 5th, 6th, 7th, 8th, DNP
```

5. Click **Done**

### Summary Formulas (Optional — place below data, e.g. row 50)

| Cell | Label                     | Cell | Formula                               |
|------|---------------------------|------|---------------------------------------|
| A50  | Total Tournaments         | B50  | `=COUNTA(B2:B49)`                     |
| A51  | Total Tournament Wins     | B51  | `=SUM(E2:E49)`                        |
| A52  | Total Tournament Losses   | B52  | `=SUM(F2:F49)`                        |
| A53  | Championships (1st place) | B53  | `=COUNTIF(G2:G49,"1st")`              |
| A54  | Total Team Points          | B54  | `=SUM(H2:H49)`                        |

### Header Formatting

Same as MATCH_LOG: bold, dark blue background, white text, freeze Row 1.

---

## TAB 4: DASHBOARD

This is the visual overview — a mix of key stats and charts. All data is pulled from SEASON_STATS and MATCH_LOG via formulas.

### Section 1: Title Block (Rows 1–3)

| Cell | Content                                          |
|------|--------------------------------------------------|
| A1   | `JACKSON HUFF — WRESTLING DASHBOARD`             |
| A2   | `Folkstyle · 2025–26 Season`                     |

- Merge **A1:H1**, set font to **20pt bold**
- Merge **A2:H2**, set font to **12pt**, color gray

### Section 2: Key Metrics (Rows 4–7)

Create a row of stat "cards." Use merged cells and large fonts.

| Cells (merge) | Label (small, above) | Value (large, below) | Formula for value cell                             |
|---------------|----------------------|----------------------|----------------------------------------------------|
| A4:B4         | RECORD               |                      |                                                    |
| A5:B5         |                      | *(big number)*       | `=SEASON_STATS!B6&"-"&SEASON_STATS!B7`             |
| C4:D4         | WIN %                |                      |                                                    |
| C5:D5         |                      | *(big number)*       | `=SEASON_STATS!B8`                                 |
| E4:F4         | BONUS %              |                      |                                                    |
| E5:F5         |                      | *(big number)*       | `=SEASON_STATS!B18`                                |
| G4:H4         | TEAM PTS             |                      |                                                    |
| G5:H5         |                      | *(big number)*       | `=SEASON_STATS!B16`                                |

**Formatting for value cells (Row 5):**
- Font size: **28pt bold**
- Horizontal alignment: **Center**
- C5:D5 and E5:F5: Format → Number → Percent (0 decimals)

**Formatting for label cells (Row 4):**
- Font size: **10pt bold**
- Color: gray
- Horizontal alignment: **Center**

### Section 3: Charts (Rows 8–30+)

Create 4 charts and position them in the DASHBOARD tab.

---

#### Chart 1: Win/Loss Pie Chart

| Setting       | Value                                                        |
|---------------|--------------------------------------------------------------|
| **Chart type** | Pie chart                                                   |
| **Data**       | Create a small helper range on this tab:                    |
|               | Cell J4: `Wins`    Cell K4: `=SEASON_STATS!B6`              |
|               | Cell J5: `Losses`  Cell K5: `=SEASON_STATS!B7`              |
| **Data range** | `DASHBOARD!J4:K5`                                           |
| **Position**   | Place over cells **A8:D20**                                 |
| **Title**      | `Win/Loss Record`                                           |
| **Colors**     | Wins = green (`#2e7d32`), Losses = red (`#c62828`)          |

**Steps:**
1. Type the helper data in J4:K5 as shown above
2. Select J4:K5
3. **Insert → Chart**
4. Chart type: **Pie chart**
5. In chart editor → Customize → Chart style → set colors
6. Add title: `Win/Loss Record`
7. Drag/resize chart over cells A8:D20

---

#### Chart 2: Win Type Breakdown (Bar Chart)

| Setting        | Value                                                       |
|----------------|-------------------------------------------------------------|
| **Chart type** | Column chart (vertical bar)                                  |
| **Data**       | Create helper range:                                         |
|                | Cell J7: `Decision`   Cell K7: `=COUNTIFS(MATCH_LOG!F2:F200,"Win",MATCH_LOG!G2:G200,"Decision")` |
|                | Cell J8: `Major`      Cell K8: `=COUNTIFS(MATCH_LOG!F2:F200,"Win",MATCH_LOG!G2:G200,"Major")`    |
|                | Cell J9: `Tech`       Cell K9: `=COUNTIFS(MATCH_LOG!F2:F200,"Win",MATCH_LOG!G2:G200,"Tech")`     |
|                | Cell J10: `Pin`       Cell K10: `=COUNTIFS(MATCH_LOG!F2:F200,"Win",MATCH_LOG!G2:G200,"Pin")`     |
|                | Cell J11: `Forfeit`   Cell K11: `=COUNTIFS(MATCH_LOG!F2:F200,"Win",MATCH_LOG!G2:G200,"Forfeit")` |
| **Data range** | `DASHBOARD!J7:K11`                                          |
| **Position**   | Place over cells **E8:H20**                                  |
| **Title**      | `Wins by Type`                                               |
| **Colors**     | Single color: blue (`#1565c0`)                               |

**Steps:**
1. Type labels in J7:J11 and formulas in K7:K11
2. Select J7:K11
3. **Insert → Chart**
4. Chart type: **Column chart**
5. Title: `Wins by Type`
6. Drag/resize over E8:H20

---

#### Chart 3: Takedowns Over Time (Line Chart)

| Setting        | Value                                                       |
|----------------|-------------------------------------------------------------|
| **Chart type** | Line chart                                                   |
| **Data range** | `MATCH_LOG!A1:A200` (X-axis: dates) and `MATCH_LOG!I1:I200` (Y-axis: takedowns) |
| **Position**   | Place over cells **A22:D34**                                 |
| **Title**      | `Takedowns per Match`                                        |
| **Colors**     | Line color: orange (`#e65100`)                               |

**Steps:**
1. Go to the DASHBOARD tab
2. **Insert → Chart**
3. In the chart editor, set **Data range** to: `MATCH_LOG!A1:A200,MATCH_LOG!I1:I200`
4. Chart type: **Line chart**
5. Check **Use row 1 as headers** and **Use column A as labels**
6. Title: `Takedowns per Match`
7. Drag/resize over A22:D34

---

#### Chart 4: Team Points per Match (Bar Chart)

| Setting        | Value                                                       |
|----------------|-------------------------------------------------------------|
| **Chart type** | Column chart (vertical bar)                                  |
| **Data range** | `MATCH_LOG!C1:C200` (X-axis: opponent names) and `MATCH_LOG!O1:O200` (Y-axis: team pts) |
| **Position**   | Place over cells **E22:H34**                                 |
| **Title**      | `Team Points Earned per Match`                               |
| **Colors**     | Bar color: dark green (`#2e7d32`)                            |

**Steps:**
1. **Insert → Chart**
2. Data range: `MATCH_LOG!C1:C200,MATCH_LOG!O1:O200`
3. Chart type: **Column chart**
4. Check **Use row 1 as headers** and **Use column C as labels**
5. Title: `Team Points Earned per Match`
6. Drag/resize over E22:H34

---

### Hide Helper Data

After creating all charts, you can hide the helper columns:
1. Right-click column **J** header → **Hide column J**
2. Right-click column **K** header → **Hide column K**

*(Or leave them visible — they won't print if you set a print range.)*

---

## Final Checklist

| #  | Task                                                    | Done? |
|----|---------------------------------------------------------|-------|
| 1  | MATCH_LOG tab created with all 15 columns               | ☐     |
| 2  | Result dropdown (Win/Loss) works in column F            | ☐     |
| 3  | Win Type dropdown works in column G                     | ☐     |
| 4  | Team Points Earned auto-calculates in column O          | ☐     |
| 5  | SEASON_STATS tab has all 13 stat formulas               | ☐     |
| 6  | SEASON_STATS percentages display correctly              | ☐     |
| 7  | TOURNAMENTS tab created with 9 columns                  | ☐     |
| 8  | Placement dropdown works in TOURNAMENTS column G        | ☐     |
| 9  | DASHBOARD title and 4 key metric cards display          | ☐     |
| 10 | Chart 1: Win/Loss Pie Chart created                     | ☐     |
| 11 | Chart 2: Win Type Bar Chart created                     | ☐     |
| 12 | Chart 3: Takedowns Line Chart created                   | ☐     |
| 13 | Chart 4: Team Points Bar Chart created                  | ☐     |
| 14 | Enter 3+ sample matches and verify all formulas/charts  | ☐     |

---

## Folkstyle Team Scoring Reference

| Win Type  | Team Points |
|-----------|-------------|
| Decision  | 3           |
| Major     | 4           |
| Tech Fall | 5           |
| Pin       | 6           |
| Forfeit   | 6           |
| Loss      | 0           |

---

*Built for Jackson Huff · Folkstyle Wrestling · 2025–26 Season*
