# Gap Detection - Quick Start Guide

## What It Does

Finds valid **WHO (subject type) + WHAT (request type)** combinations that **don't trigger any workflow**.

## How to Use

### Step 1: Load Webform
Load your webform JSON file into the simulator.

### Step 2: Click "Analyze Workflow Gaps"
Click the red button in the controls panel.

```
┌─────────────────────────────────────────────────────┐
│ [Reset Form]  [Export to Excel]  [Analyze Gaps] ←  │
└─────────────────────────────────────────────────────┘
```

### Step 3: Review Results
Get instant Excel report with:
- Summary statistics
- List of all gaps
- Complete coverage matrix

---

## Understanding the Results

### Gap Summary Sheet
Shows overall coverage:

```
Total Combinations:        20
Covered Combinations:      18
Gaps (No Workflow):        2
Coverage Percentage:       90%
```

### Identified Gaps Sheet
Lists each gap:

| Subject Type | Request Type | Severity | Message |
|---|---|---|---|
| Business | Deletion | HIGH | No assigned workflow |
| Employee | Correction | HIGH | No assigned workflow |

### Coverage Matrix Sheet
Shows every combination and assigned workflows:

| Subject | Request | Workflows | Count |
|---|---|---|---|
| Individual | Access | GDPR Access Request; Standard Access | 2 |
| Individual | Deletion | Standard Deletion | 1 |
| Business | Access | Business Access Workflow | 1 |
| **Business** | **Deletion** | **NONE (GAP)** | **0** |
| Employee | Access | Employee Access Workflow | 1 |
| **Employee** | **Correction** | **NONE (GAP)** | **0** |

---

## What Counts as a Gap?

### ✅ NOT a Gap
- Subject type is inactive (not selected in OneTrust)
- Request type is inactive (marked status=20)
- Workflow exists but has additional criteria (country, state, etc.)

### ❌ IS a Gap
- Valid subject type + request type combination
- NO workflows trigger for any field values
- The form should handle this combo but doesn't

---

## Common Patterns

### Pattern 1: Complete Coverage
```
All combinations covered ✅
Coverage: 100%
→ Your workflows are well-structured
```

### Pattern 2: Missing Subject Type
```
Business: Access ✅, Deletion ❌, Correction ❌
→ Add workflows for Business requests
```

### Pattern 3: Missing Request Type
```
Correction: Individual ❌, Business ❌, Employee ✅
→ Add workflows to handle Correction requests from other types
```

### Pattern 4: Specific Combination Gap
```
Only 1 gap: Business + Deletion
→ Add/fix workflow rule for this specific case
```

---

## What to Do With Gaps

### Option 1: Add Workflows
Create new workflows to handle the gap:
1. In OneTrust, create new workflow rule
2. Set criteria for missing subject+request combo
3. Run gap analysis again to verify

### Option 2: Adjust Workflow Criteria
Expand existing workflow criteria:
1. Find most similar existing workflow
2. Extend criteria to include the gap combo
3. Test and re-run analysis

### Option 3: Mark as Intentional
If gap is intentional (not all combos should be supported):
1. Document the business reason
2. Note in compliance records
3. Track in your runbook

### Option 4: Disable Subject/Request Type
If some combos aren't needed:
1. Disable subject or request type in OneTrust
2. Re-run analysis (it will exclude them)
3. Gaps should decrease

---

## Tips

### Tip 1: Run Regularly
After any workflow or type changes:
```
Modify workflow → Run gap analysis → Check coverage
```

### Tip 2: Aim for 100%
Every valid combination should have a path:
```
Target: 0 gaps, 100% coverage
```

### Tip 3: Review Matrix First
Before fixing gaps:
```
1. Export report
2. Review Coverage Matrix sheet
3. Identify patterns in gaps
4. Plan fixes systematically
```

### Tip 4: Use Console Logs
Check browser console for debug info:
```
F12 → Console → Look for gap detection output
```

---

## Example Workflow

### Scenario
You have a form with:
- **Subject Types**: Individual, Business, Employee (3 types)
- **Request Types**: Access, Deletion, Correction (3 types)
- **Total Combos**: 3 × 3 = 9

### Current Coverage
```
Individual: Access ✅, Deletion ✅, Correction ✅
Business:   Access ✅, Deletion ❌, Correction ❌
Employee:   Access ✅, Deletion ✅, Correction ❌
```

### Gaps Found
- Business + Deletion
- Business + Correction
- Employee + Correction

**Coverage: 6/9 = 66.7%**

### Action Plan
```
1. Add workflow rule for Business deletions
2. Add workflow rule for Business corrections
3. Extend Employee correction handling
4. Re-run analysis → Target: 100% coverage
```

---

## When Gap Detection Might Fail

### If You Get Warnings
```
"Gap detection: Missing request or subject type fields"
```

**Why:** Your form doesn't have requestType or subjectType fields

**Fix:**
- Verify OneTrust has subject types configured
- Verify OneTrust has request types configured
- Check field names match (case-sensitive)

### If Analysis Takes Too Long
```
(Takes more than 5 seconds)
```

**Why:** Large number of combos × many workflows

**What's happening:** System is testing every combo against every workflow

**Normal for:**
- 10+ subject types with 10+ request types
- 50+ workflow rules

---

## FAQ

**Q: Does gap detection check every field?**
A: No. It only checks subject type + request type combinations (the 2 key dimensions).

**Q: What about conditional workflows?**
A: Gaps are reported even if workflows exist with additional criteria (country, state, etc.). A workflow counts as covering a combo only if it triggers with JUST subject+request type selected.

**Q: Can I export just the gaps?**
A: Yes. Excel file has separate "Identified Gaps" sheet with just the problems.

**Q: How long does analysis take?**
A: Usually <1 second. Can be 1-5 seconds for large forms.

**Q: Does it modify my form?**
A: No. It's read-only. All testing is simulated.

**Q: How does it decide if a workflow "covers" a combination?**
A: A workflow covers a combo if calling `evaluateWorkflowRule(workflow)` returns `triggered: true` when only subject type and request type are selected.

---

## Key Takeaway

**Gap detection = Coverage validation**

Instead of checking 50+ fields individually, focus on:
- **WHO is asking?** (subject type)
- **WHAT do they want?** (request type)
- **Do we have a workflow for this?**

That's it. Simple, actionable, meaningful.

