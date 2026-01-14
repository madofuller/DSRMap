# Workflow Gap Detection - Visual Guide

## The Core Idea in 30 Seconds

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Every DSAR Request Needs:                                 │
│                                                             │
│  1. WHO? (Subject Type)                                    │
│     ├─ Individual                                          │
│     ├─ Business                                            │
│     └─ Employee                                            │
│                                                             │
│  2. WHAT? (Request Type)                                   │
│     ├─ Access                                              │
│     ├─ Deletion                                            │
│     └─ Correction                                          │
│                                                             │
│  3. Does a workflow exist for this combo?                  │
│     ├─ ✅ Yes → Request gets handled                      │
│     └─ ❌ No → GAP!                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## The Gap Detection Process

### Step 1: Extract Subject Types (WHO)
```
┌─────────────────────────────────┐
│   webformData.webFormDto        │
│   .subjectTypes = [             │
│     { fieldName: "Individual" }, │
│     { fieldName: "Business" },   │
│     { fieldName: "Employee" }    │
│   ]                             │
└─────────────────────────────────┘
       ↓
   3 Subject Types (WHO)
```

### Step 2: Extract Request Types (WHAT)
```
┌─────────────────────────────────┐
│   webformData.webFormDto        │
│   .requestTypes = [             │
│     { fieldName: "Access" },    │
│     { fieldName: "Deletion" },  │
│     { fieldName: "Correction" } │
│   ]                             │
└─────────────────────────────────┘
       ↓
   3 Request Types (WHAT)
```

### Step 3: Create All Combinations
```
WHO × WHAT Matrix:

            Access    Deletion   Correction
Individual    1          2          3
Business      4          5          6
Employee      7          8          9

Total: 3 × 3 = 9 combinations
```

### Step 4: Test Each Combination
```
For each combination:
  1. Set userSelections = {subjectType, requestType}
  2. Evaluate all workflows
  3. Count how many trigger
  4. If 0 trigger → It's a GAP ❌
  5. If ≥1 trigger → It's COVERED ✅
```

### Step 5: Report Results
```
┌─────────────────────────────────────────┐
│          GAP ANALYSIS REPORT            │
├─────────────────────────────────────────┤
│ Total Combinations      │ 9              │
│ Covered                 │ 7              │
│ Gaps (No Workflow)      │ 2              │
│ Coverage Percentage     │ 77.8%          │
├─────────────────────────────────────────┤
│ GAPS:                                   │
│  - Business + Deletion ❌                │
│  - Employee + Correction ❌              │
└─────────────────────────────────────────┘
```

---

## Real-World Example

### Your Webform Setup

**Subject Types (WHO):**
```
□ Individual      (isSelected: true, status: 10)
□ Business        (isSelected: true, status: 10)
□ Employee        (isSelected: true, status: 10)
```

**Request Types (WHAT):**
```
□ Access          (isSelected: true, status: 10)
□ Deletion        (isSelected: true, status: 10)
□ Correction      (isSelected: true, status: 10)
```

**Total Combinations:** 3 × 3 = **9**

---

### Your Workflows

**Workflow 1: GDPR Access**
```
Triggers when: (subjectType = Individual OR Business)
               AND (requestType = Access)

Covers: ✅ Individual + Access
        ✅ Business + Access
        ❌ Employee + Access (no subject match)
```

**Workflow 2: Standard Deletion**
```
Triggers when: (subjectType = Individual OR Employee)
               AND (requestType = Deletion)

Covers: ✅ Individual + Deletion
        ❌ Business + Deletion (no subject match)
        ✅ Employee + Deletion
```

**Workflow 3: Employee Correction**
```
Triggers when: (subjectType = Employee)
               AND (requestType = Correction)

Covers: ❌ Individual + Correction
        ❌ Business + Correction
        ✅ Employee + Correction
```

---

### Coverage Matrix

```
                Access              Deletion            Correction
Individual    ✅ GDPR Access      ✅ Std Deletion     ❌ NONE (GAP!)
Business      ✅ GDPR Access      ❌ NONE (GAP!)     ❌ NONE (GAP!)
Employee      ❌ NONE (GAP!)      ✅ Std Deletion     ✅ Emp Correction
```

---

### Gap Analysis Results

```
┌────────────────────────────────────────────┐
│           SUMMARY                          │
├────────────────────────────────────────────┤
│ Total Combinations          │ 9             │
│ Covered Combinations        │ 6             │
│ Gaps (No Workflow)          │ 3             │
│ Coverage Percentage         │ 66.7%         │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│           IDENTIFIED GAPS                  │
├────────────────────────────────────────────┤
│ 1. Individual + Correction ❌              │
│    No workflow assigned                    │
│                                            │
│ 2. Business + Deletion ❌                  │
│    No workflow assigned                    │
│                                            │
│ 3. Business + Correction ❌                │
│    No workflow assigned                    │
│                                            │
│ 4. Employee + Access ❌                    │
│    No workflow assigned                    │
└────────────────────────────────────────────┘
```

---

### Your Action Plan

```
GAP #1: Individual + Correction
├─ Solution: Create or extend workflow
├─ Action: Add rule for "Correction" requests
└─ Test: Re-run gap analysis

GAP #2: Business + Deletion
├─ Solution: Extend Standard Deletion workflow
├─ Action: Change criteria to include Business
└─ Test: Re-run gap analysis

GAP #3: Business + Correction
├─ Solution: Create new Business correction workflow
├─ Action: Create rule for Business + Correction
└─ Test: Re-run gap analysis

GAP #4: Employee + Access
├─ Solution: Create or extend Access workflow
├─ Action: Add rule for Employee Access
└─ Test: Re-run gap analysis

AFTER FIXES:
Re-run gap analysis → Target: 0 gaps, 100% coverage ✅
```

---

## Common Gap Patterns

### Pattern 1: Missing Subject Type Coverage

```
Workflow only covers Individual:

        Access    Deletion
Individual  ✅       ✅
Business    ❌       ❌      ← Entire row missing!
Employee    ✅       ✅
```

**Root Cause:** Workflow criteria doesn't include Business

**Fix:** Extend workflow to include Business

---

### Pattern 2: Missing Request Type Coverage

```
Only Access request is supported:

             Access   Deletion   Correction
Individual     ✅       ❌          ❌       ← Only 1 column!
Business       ✅       ❌          ❌
Employee       ✅       ❌          ❌
```

**Root Cause:** No deletion or correction workflows exist

**Fix:** Create deletion and correction workflows

---

### Pattern 3: Isolated Gap

```
One specific combo missing:

             Access   Deletion   Correction
Individual     ✅       ✅          ✅
Business       ✅       ❌          ✅       ← Just this one!
Employee       ✅       ✅          ✅
```

**Root Cause:** Deletion workflow doesn't include Business

**Fix:** Edit deletion workflow to include Business

---

## How Gap Detection Works (Step by Step)

### Execution Timeline

```
Timeline →
│
├─ 1. Click "Analyze Workflow Gaps" button
│
├─ 2. System extracts subject types
│     (From webformData.webFormDto.subjectTypes)
│
├─ 3. System extracts request types
│     (From webformData.webFormDto.requestTypes)
│
├─ 4. System creates combination matrix
│     (3 × 3 = 9 combinations)
│
├─ 5. For each combination:
│     ├─ Save current selections
│     ├─ Set test selections (subject type + request type)
│     ├─ Test all workflows
│     ├─ Count triggered workflows
│     ├─ Restore original selections
│     └─ Record result (covered or gap)
│
├─ 6. Analyze results
│     ├─ Calculate coverage percentage
│     ├─ Generate summary statistics
│     └─ Create detailed gap list
│
├─ 7. Build Excel workbook
│     ├─ Sheet 1: Summary
│     ├─ Sheet 2: Gaps List
│     └─ Sheet 3: Coverage Matrix
│
└─ 8. Download Excel file
```

---

## Before & After

### BEFORE: Manual Gap Checking

```
Manager: "Do we handle all request types?"
Developer: "Let me check... umm... I need to test each one"
(2+ hours of manual testing)
Results: Inconsistent, error-prone
```

### AFTER: Automated Gap Detection

```
Manager: "Do we handle all request types?"
Developer: Clicks "Analyze Workflow Gaps"
(Excel file downloads instantly)
Results: Complete, accurate, actionable
```

---

## The Gap Detection Algorithm (Visual)

```
START
  │
  ├─ Get all subject types (WHO)
  │  └─ [Individual, Business, Employee]
  │
  ├─ Get all request types (WHAT)
  │  └─ [Access, Deletion, Correction]
  │
  ├─ Create matrix (3×3 = 9 combos)
  │
  ├─ For each combo:
  │  │
  │  ├─ Test combo in workflow evaluator
  │  │
  │  ├─ If workflows trigger
  │  │  └─ Mark as COVERED ✅
  │  │
  │  └─ If no workflows trigger
  │     └─ Mark as GAP ❌
  │
  ├─ Tally results
  │  ├─ Total combos
  │  ├─ Covered combos
  │  ├─ Gap count
  │  └─ Coverage %
  │
  └─ Generate report → Excel export
```

---

## Key Metrics Explained

### Coverage Percentage
```
Coverage % = (Covered Combos / Total Combos) × 100

Example: 7 covered out of 9 total
Coverage % = (7 / 9) × 100 = 77.8%
```

### Interpretation
```
100% → Perfect coverage, no gaps ✅
90-99% → Good coverage, minor gaps
75-89% → Acceptable, some gaps ⚠️
50-74% → Poor coverage, many gaps ⚠️⚠️
<50% → Critical gaps, needs work ⚠️⚠️⚠️
```

---

## Gap Severity

All gaps are marked as **HIGH severity** because:
```
Any WHO+WHAT combo with no workflow means
a valid request type has nowhere to go.

That's always a problem worth fixing.
```

---

## Quick Reference: Common Questions

### Q: Why only WHO + WHAT?
```
Because every DSAR needs:
✅ WHO? (subject type)
✅ WHAT? (request type)
These 2 dimensions define the complete picture.

Other fields (country, email, etc.) are:
- Conditional (depend on visible field rules)
- Specific to implementation
- Not universally required
```

### Q: Why test with only these two fields selected?
```
Because in real-world scenarios:
1. User fills subject type
2. User fills request type
3. Form evaluates workflows
4. If no workflow matches, request is lost

We're testing the most basic scenario
where ONLY WHO+WHAT are known.

If a workflow needs more criteria (country, etc.),
it won't trigger just from WHO+WHAT.
```

### Q: Why is this better than field-level analysis?
```
Field-level: "Is field X visible?"
Problem: Doesn't tell if request gets handled

WHO+WHAT analysis: "Can this request be processed?"
Solution: Directly answers the important question
```

---

## Using the Output

### Excel Report Usage

```
┌─ Open Excel report
│
├─ Sheet 1: "Gap Summary"
│  └─ Quick glance at coverage %
│
├─ Sheet 2: "Identified Gaps"
│  └─ See exactly which combos have problems
│
├─ Sheet 3: "Coverage Matrix"
│  └─ Understand full picture
│
├─ Identify patterns
│  ├─ Missing subject types?
│  ├─ Missing request types?
│  └─ Isolated gaps?
│
└─ Plan fixes
   ├─ Which workflows to modify?
   ├─ Which to create?
   └─ How to test?
```

---

## One-Minute Summary

1. **What it does:** Finds WHO+WHAT combinations with no workflow
2. **Why it matters:** Incomplete coverage = lost requests
3. **How to use it:** Click button → download Excel
4. **How to fix gaps:** Add/extend workflows to cover all combos
5. **Success:** 100% coverage, 0 gaps ✅

---

