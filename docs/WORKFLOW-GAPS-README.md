# Workflow Gap Detection System

## Overview

The **Workflow Gap Detection System** identifies situations where valid combinations of **WHO YOU ARE** (subject type) and **WHAT YOU'RE REQUESTING** (request type) exist but have **no assigned workflow** to handle them.

Instead of checking every form field, this system focuses on the most important dimensions:
- **Subject Type** (WHO) - Individual, Business, Employee, etc.
- **Request Type** (WHAT) - Access, Deletion, Correction, etc.

---

## Why This Matters

When a data subject submits a DSAR request, OneTrust needs to route it to the correct workflow based on:
1. **Who is making the request?** (subject type)
2. **What are they asking for?** (request type)

If a valid combination has no assigned workflow, the request has nowhere to go—creating a critical gap.

### Example: The Gap

```
┌─────────────┬──────────────┬──────────────┐
│ Subject     │ Request      │ Workflow     │
│ (WHO)       │ (WHAT)       │ Assigned?    │
├─────────────┼──────────────┼──────────────┤
│ Individual  │ Access       │ ✅ YES       │
│ Individual  │ Deletion     │ ✅ YES       │
│ Business    │ Access       │ ✅ YES       │
│ Business    │ Deletion     │ ❌ GAP!      │  ← Problem!
│ Employee    │ Access       │ ✅ YES       │
│ Employee    │ Correction   │ ❌ GAP!      │  ← Problem!
└─────────────┴──────────────┴──────────────┘
```

---

## How It Works

### 1. Extract All Combinations

```javascript
// Get all subject types (WHO)
const subjectTypes = webformData.webFormDto.subjectTypes;
// Example: ["Individual", "Business", "Employee", "Consumer"]

// Get all request types (WHAT)
const requestTypes = webformData.webFormDto.requestTypes;
// Example: ["Access", "Deletion", "Correction"]

// Create all combinations
// Result: 4 × 3 = 12 possible combinations
```

### 2. Test Each Combination

For each WHO + WHAT combination:

```javascript
// Simulate user selections
currentSelections = {
    subjectType: "Business",
    requestType: "Deletion"
};

// Evaluate: Do any workflows trigger for this combination?
const triggeredWorkflows = workflowRules.filter(wf =>
    evaluateWorkflowRule(wf).triggered
);

// If 0 workflows triggered → this is a GAP
if (triggeredWorkflows.length === 0) {
    gaps.push({
        subjectType: "Business",
        requestType: "Deletion",
        issue: "NO_WORKFLOW_TRIGGERED"
    });
}
```

### 3. Generate Report

The system produces three output sheets:

1. **Gap Summary** - Overview statistics
2. **Identified Gaps** - Each gap with details
3. **Coverage Matrix** - Full WHO × WHAT matrix showing workflow assignments

---

## Running the Analysis

### From the Simulator UI

1. Load a webform JSON file into the simulator
2. Click **"Analyze Workflow Gaps"** button (red button in controls)
3. Excel file is automatically downloaded with results

### Programmatically

```javascript
// Run gap detection
const gapAnalysis = detectWorkflowGaps();

// Results structure:
{
    gaps: [
        {
            subjectType: "Business",
            requestType: "Deletion",
            issue: "NO_WORKFLOW_TRIGGERED",
            severity: "HIGH",
            message: "User type 'Business' requesting 'Deletion' has no assigned workflow"
        }
    ],
    coverage: {
        "Business|Deletion": {
            subjectType: "Business",
            requestType: "Deletion",
            workflowCount: 0,
            workflows: []
        }
    },
    total: 12,           // Total combinations tested
    gapCount: 2,         // Number of gaps found
    coverage_percentage: "83.3"  // Coverage %
}
```

---

## Output: Excel Report

### Sheet 1: Gap Summary

| Metric | Value |
|--------|-------|
| Total Combinations | 12 |
| Covered Combinations | 10 |
| Gaps (No Workflow) | 2 |
| Coverage Percentage | 83.3% |

### Sheet 2: Identified Gaps

| Subject Type (WHO) | Request Type (WHAT) | Issue | Severity | Message |
|-------------------|-------------------|-------|----------|---------|
| Business | Deletion | NO_WORKFLOW_TRIGGERED | HIGH | User type "Business" requesting "Deletion" has no assigned workflow |
| Employee | Correction | NO_WORKFLOW_TRIGGERED | HIGH | User type "Employee" requesting "Correction" has no assigned workflow |

### Sheet 3: Coverage Matrix

| Subject Type (WHO) | Request Type (WHAT) | Assigned Workflows | Workflow Count |
|-------------------|--------------------|-------------------|----------------|
| Individual | Access | GDPR Access Request; Standard Access | 2 |
| Individual | Deletion | GDPR Deletion Request; Standard Deletion | 2 |
| Business | Access | Business Access Workflow | 1 |
| Business | Deletion | **NONE (GAP)** | 0 |
| Employee | Access | Employee Access Workflow | 1 |
| Employee | Correction | **NONE (GAP)** | 0 |

---

## Interpreting Results

### ✅ Good: 100% Coverage

All WHO+WHAT combinations have assigned workflows:

```
4 Subject Types × 5 Request Types = 20 combinations
20 combinations covered = 100% coverage ✅
```

### ⚠️ Warning: Partial Coverage

Some WHO+WHAT combinations lack workflows:

```
4 Subject Types × 5 Request Types = 20 combinations
18 combinations covered = 90% coverage
2 gaps: Business|Deletion, Employee|Correction
```

### ❌ Critical: Major Gaps

Multiple combinations have no workflow path:

```
4 Subject Types × 5 Request Types = 20 combinations
12 combinations covered = 60% coverage
8 gaps: Multiple subject/request combinations unhandled
```

---

## Types of Gaps

### 1. **Subject Type Gap**

A specific user type has no workflow for ANY request type:

```
Employee:
  - Access      ✅ Has workflow
  - Deletion    ❌ GAP
  - Correction  ❌ GAP
```

### 2. **Request Type Gap**

A specific request type has no workflow for ANY user type:

```
Correction:
  - Individual  ✅ Has workflow
  - Business    ❌ GAP
  - Employee    ❌ GAP
```

### 3. **Specific Combination Gap**

One particular WHO+WHAT combination lacks a workflow:

```
Business + Deletion = ❌ GAP
(Business + Access and Individual + Deletion both work fine)
```

---

## How This Differs From Field-by-Field Analysis

### ❌ Bad Approach: Field-by-Field

Looking at every field individually:
- "Is the 'email' field shown?"
- "Is the 'company' field shown?"
- "Is the 'message' field shown?"
- ...checking 50+ fields per page

**Problems:**
- Doesn't tell you if requests get handled
- Finds "missing" fields that aren't actually important
- Creates too many false positives

### ✅ Good Approach: WHO+WHAT Combinations

Focus on meaningful combinations:
- "Does [Subject Type] + [Request Type] have a workflow?"
- Only checks 2 critical dimensions
- Results directly answer: "Can this request be handled?"

---

## Example: Real-World Webform

### Scenario 1: Small Form

```
Subject Types: Individual, Business
Request Types: Access, Deletion

Combinations: 2 × 2 = 4
┌──────────────┬──────────┐
│ Individual   │ Access  ✅│
│ Individual   │ Delete  ✅│
│ Business     │ Access  ✅│
│ Business     │ Delete  ❌│ ← GAP!
└──────────────┴──────────┘

Coverage: 75% (1 gap)
```

**Action:** Add workflow to handle Business Deletion requests

---

### Scenario 2: Enterprise Form

```
Subject Types: Consumer, Business, Partner, Employee
Request Types: Access, Deletion, Correction, Restriction, Portability

Combinations: 4 × 5 = 20

Gaps found:
  - Partner + Correction
  - Employee + Portability

Coverage: 90% (2 gaps)
```

**Action:** Investigate why Partner correction and Employee portability requests aren't handled

---

## Configuration & Filtering

The system only analyzes **active** subject and request types:

```javascript
// Only includes types where:
// - isSelected !== false
// - status !== 20 (active in OneTrust)

const activeSubjectTypes = subjectTypes.filter(st =>
    st.isSelected !== false && st.status !== 20
);
```

If a subject or request type is marked **inactive** in OneTrust, it's excluded from the gap analysis.

---

## Limitations

### What This Checks
✅ Whether WHO+WHAT combinations trigger workflows
✅ Coverage percentage across all combinations
✅ Which specific gaps exist
✅ Which workflows are assigned to each combination

### What This Doesn't Check
❌ Individual field visibility (for that, use field-by-field export)
❌ Submit button enable/disable logic
❌ Attachment field visibility
❌ Whether workflows are correctly configured
❌ Data quality of individual fields

For field-level analysis, use the **"Export to Excel"** button to see field-level details.

---

## Best Practices

### 1. Run After Configuration Changes
After modifying workflows, subject types, or request types, run gap analysis to ensure coverage.

### 2. Aim for 100% Coverage
Every valid WHO+WHAT combination should have an assigned workflow.

### 3. Document Exceptions
If gaps are intentional (e.g., Partner type only supports certain requests), document this in your organization's runbook.

### 4. Regular Audits
Run gap analysis quarterly to catch new gaps from configuration changes.

### 5. Correlate with Business Requirements
Gaps often reveal missing business logic. Example:
- "Why don't Employees have Deletion workflow?"
- "Should Business users be able to request Correction?"

---

## Troubleshooting

### "Gap detection: Missing request or subject type fields"

**Cause:** The form doesn't have `requestType` or `subjectType` fields

**Solution:**
1. Check that your webform has subject types defined in OneTrust
2. Ensure request types are defined
3. Verify field names match `requestType` / `subjectType`

### No gaps found, but I know there are gaps

**Possible causes:**
1. The form uses different field names (not `requestType`/`subjectType`)
2. Workflows are defined for the gaps but don't match the field values
3. Field values have whitespace or case-sensitivity issues

**Solution:**
- Check console logs from `detectWorkflowGaps()` function
- Verify workflow criteria match exact subject/request type values
- Use field-by-field export to debug field matching

### Gap analysis takes a long time

**Cause:** Testing every combination × every workflow is O(n×m) operations

**Solution:**
- This is normal for forms with many subject types or request types
- Optimization: Early exit when workflow is found (current implementation)
- For very large forms (50+ types), consider pagination

---

## Use Cases

### 1. Configuration Validation
Run gap analysis before deploying a new webform template.

### 2. Coverage Metrics
Track coverage % over time to ensure workflows are added as new request types are supported.

### 3. Business Requirements Alignment
Use gaps to identify missing requirements:
- "What should happen for [Subject] + [Request]?"
- "Is this gap intentional?"

### 4. Documentation
Export gap reports for stakeholder reviews.

### 5. Compliance Audits
Demonstrate that your DSAR handling covers all relevant combinations.

---

## Technical Details

### Algorithm

```
For each (subject_type, request_type) combination:
  1. Save current form selections
  2. Set selections to: {subjectType, requestType}
  3. For each workflow rule:
     - Evaluate if criteria match current selections
     - If criteria match → workflow triggers
  4. Restore original selections
  5. If 0 workflows triggered → record as gap
```

### Time Complexity

- **O(c × w)** where c = combinations, w = workflow rules
- Example: 4 subject types × 5 request types × 10 workflows = 200 evaluations
- Typical execution: <1 second for most forms

### Space Complexity

- **O(c)** for gap storage
- Minimal memory overhead

---

## Future Enhancements

Possible improvements to gap detection:

1. **Multi-dimensional gaps**
   - Add geographic dimension (country)
   - Add regulatory dimension (GDPR, CCPA, LGPD)
   - More complex combinations

2. **Gap severity scoring**
   - High-volume gaps vs. rare combinations
   - Business-critical vs. low-priority gaps

3. **Suggestions engine**
   - Recommend which workflows should handle gaps
   - Suggest missing workflow rules

4. **Historical tracking**
   - Track gap count over time
   - Alert on new gaps introduced
   - Trend analysis

5. **Integration**
   - Export results to compliance systems
   - API endpoint for CI/CD pipelines
   - Webhook notifications

---

## Questions?

For issues with gap detection:
1. Check console logs (`F12` → Console tab)
2. Verify subject type and request type fields are in your webform
3. Export full Excel report to see all field details
4. Review workflow criteria to ensure they match field values

