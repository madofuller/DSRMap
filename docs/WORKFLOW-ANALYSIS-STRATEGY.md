# Smart Workflow Analysis Strategy

## The Problem

Current approach:
- ❌ Assumes WHO = "subjectType" field
- ❌ Assumes WHAT = "requestType" field
- ❌ Ignores what workflows actually need
- ❌ Doesn't analyze workflow trigger criteria first

## The Solution

Reverse the logic:

```
1. ANALYZE WORKFLOWS FIRST
   ├─ What criteria do they check?
   ├─ What fields are in the conditions?
   └─ What values do they expect?

2. IDENTIFY TRIGGER DIMENSIONS
   ├─ Which fields appear most frequently in workflow rules?
   ├─ Which fields are "decision points"?
   └─ Which combinations matter for routing?

3. EXTRACT AVAILABLE VALUES
   ├─ What options exist for each field?
   ├─ What are the actual choices users make?
   └─ What's the visibility rule logic?

4. BUILD INTELLIGENT MATRIX
   ├─ Use actual workflow dimensions, not hardcoded ones
   ├─ Show what workflows need to make decisions
   └─ Display coverage for real-world scenarios

5. IDENTIFY GAPS
   ├─ Which dimension combinations have no workflow?
   ├─ Which trigger paths are missing?
   └─ What needs to be configured?
```

---

## Example: Analyzing Real Workflows

### Step 1: Examine Workflows
```javascript
// Workflow 1: CCPA Rule
{
  ruleName: "CCPA Rule",
  criteria: {
    "country": ["US"],
    "requestType": ["Access", "Deletion"]
  }
}

// Workflow 2: GDPR Rule
{
  ruleName: "GDPR Rule",
  criteria: {
    "country": ["FR", "DE", "IT"],
    "requestType": ["Access", "Deletion", "Correction"]
  }
}

// Workflow 3: Employee Rule
{
  ruleName: "Employee Access",
  criteria: {
    "subjectType": ["Employee"],
    "requestType": ["Access"]
  }
}
```

### Step 2: Identify Dimensions
From the workflows above, we see they use:
- **country** (appears in CCPA, GDPR)
- **requestType** (appears in all)
- **subjectType** (appears in Employee)

Frequency analysis:
- **requestType** = 3 workflows (critical)
- **country** = 2 workflows (important)
- **subjectType** = 1 workflow (contextual)

### Step 3: Build Smart Matrix

Instead of forcing WHO/WHAT, create **relevant matrices**:

**Matrix 1: By Country + Request Type** (most workflows need this)
```
           Access    Deletion   Correction
US         CCPA      CCPA       ❌
FR         GDPR      GDPR       GDPR
DE         GDPR      GDPR       GDPR
IT         GDPR      GDPR       GDPR
```

**Matrix 2: By Subject Type + Request Type** (secondary)
```
           Access      Deletion    Correction
Individual ✅ Std      ✅ Std       ❌
Business   ✅ Std      ❌ GAP       ❌ GAP
Employee   ✅ Employee ❌ GAP       ❌ GAP
```

---

## Smart Analysis Algorithm

```javascript
function analyzeWorkflowDimensions() {
    // Step 1: Extract all criteria from all workflows
    const dimensionFrequency = {};

    workflowRules.forEach(workflow => {
        workflow.ruleCriteria.forEach(criterion => {
            const field = criterion.field;
            dimensionFrequency[field] = (dimensionFrequency[field] || 0) + 1;
        });
    });

    // Step 2: Rank by frequency (most common = most important)
    const sortedDimensions = Object.entries(dimensionFrequency)
        .sort((a, b) => b[1] - a[1])
        .map(([field, count]) => ({ field, count }));

    // Step 3: Extract possible values for top dimensions
    const dimensions = {};
    sortedDimensions.slice(0, 2).forEach(({ field }) => {
        dimensions[field] = extractFieldValues(field);
    });

    // Step 4: Build matrix with these dimensions
    return buildDynamicMatrix(dimensions);
}
```

---

## Key Insights

### 1. Workflows Define the Matrix
Don't assume dimensions. **Derive them from workflows.**

### 2. Frequency = Importance
Fields that appear in more workflows are more important for coverage.

### 3. Multiple Matrices May Be Needed
Different sets of workflows might use different criteria.

### 4. Visibility Rules Matter
A field might be in workflows but hidden by visibility rules - need to account for that.

### 5. Field Values Are Limited
Options are defined in the form, not arbitrary.

---

## Implementation Steps

1. **Analyze Workflow Rules**
   - Extract all criteria
   - Count field frequency
   - Identify patterns

2. **Identify Trigger Dimensions**
   - Top 2-3 most common fields = primary dimensions
   - Group workflows by criteria similarity

3. **Extract Valid Values**
   - Get field options from form definition
   - Filter by visibility rules
   - Only show realistic combinations

4. **Build Dynamic Matrix**
   - Use identified dimensions
   - Generate matrix on-the-fly
   - Evaluate workflows for each combo

5. **Identify Gaps**
   - Which combos have 0 workflows?
   - Which are intentionally uncovered?
   - What needs configuration?

---

## Questions to Answer

For the workflows in the current webforms:

1. **What fields do workflows actually use?**
   - Search ruleCriteria for field names
   - Count frequency
   - Identify patterns

2. **What are the "decision points" for routing?**
   - The fields workflows depend on
   - Not our assumptions about what matters

3. **What combinations make sense?**
   - Are all field combinations valid?
   - Do visibility rules eliminate some?
   - What should customers see?

4. **Where are the gaps?**
   - Once matrix is built from real criteria
   - Identify missing workflows
   - Suggest remediation

---

## Benefits of Smart Approach

✅ **Adapts to any webform** - works with custom fields
✅ **Based on reality** - workflows define the matrix, not assumptions
✅ **Identifies true gaps** - missing workflows for needed combos
✅ **Shows relationships** - which workflows cover which scenarios
✅ **Scalable** - works for 2 dimensions or 10

---

## Next Steps

1. Load a real webform JSON
2. Examine the workflow rules deeply
3. Extract the actual criteria fields
4. Build matrix based on what we find
5. Show coverage based on real triggers

This is the smart way to do it.

