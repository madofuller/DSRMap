# Smart Coverage Analysis - Implementation Plan

## Current Understanding

You have webform templates that contain:
1. **Workflow rules** with criteria
2. **Form fields** with visibility rules
3. **Subject types and request types** metadata

## The Smart Approach

Instead of forcing a WHO/WHAT matrix, we should:

### Phase 1: Analyze Workflow Rules
```javascript
function analyzeWorkflowDimensions() {
    // For each workflow rule, extract its criteria
    const criteriaMap = {};

    workflowRules.forEach(workflow => {
        workflow.ruleCriteria.forEach(criterion => {
            const field = criterion.field;
            if (!criteriaMap[field]) {
                criteriaMap[field] = {
                    field: field,
                    workflows: [],
                    values: new Set()
                };
            }
            criteriaMap[field].workflows.push(workflow.ruleName);
            criterion.values.forEach(v => criteriaMap[field].values.add(v));
        });
    });

    return criteriaMap;
}
```

Output:
```
criteriaMap = {
    "country": {
        field: "country",
        workflows: ["CCPA Rule", "GDPR Rule", "LGPD Rule"],
        values: Set { "US", "FR", "DE", "BR", ... }
    },
    "requestType": {
        field: "requestType",
        workflows: ["CCPA Rule", "GDPR Rule", "Employee Access", ...],
        values: Set { "Access", "Deletion", "Correction" }
    },
    "subjectType": {
        field: "subjectType",
        workflows: ["Employee Access", "Business Rule"],
        values: Set { "Employee", "Business" }
    }
}
```

### Phase 2: Rank Dimensions by Coverage
```javascript
function rankDimensions(criteriaMap) {
    // Sort by number of workflows using this field
    return Object.values(criteriaMap)
        .sort((a, b) => b.workflows.length - a.workflows.length)
        .slice(0, 3); // Top 3 dimensions
}
```

Output (for example):
```
1. requestType (appears in 8 workflows) ← Primary
2. country (appears in 3 workflows) ← Secondary
3. subjectType (appears in 2 workflows) ← Tertiary
```

### Phase 3: Build Dynamic Matrix
```javascript
function buildDynamicCoverageMatrix() {
    const topDimensions = rankDimensions(analyzeWorkflowDimensions());

    // Generate matrix based on top 2 dimensions
    const dim1 = topDimensions[0]; // e.g., requestType
    const dim2 = topDimensions[1]; // e.g., country

    // Create matrix
    const matrix = {};

    for (const val1 of dim1.values) {
        matrix[val1] = {};
        for (const val2 of dim2.values) {
            // Test which workflows trigger for this combo
            const triggeredWorkflows = findWorkflows(dim1.field, val1, dim2.field, val2);
            matrix[val1][val2] = {
                covered: triggeredWorkflows.length > 0,
                workflows: triggeredWorkflows
            };
        }
    }

    return {
        matrix,
        dimensions: [dim1, dim2],
        totalCombos: dim1.values.size * dim2.values.size,
        coveredCombos: countCovered(matrix)
    };
}
```

### Phase 4: Show Gaps
```javascript
function identifyGaps(coverageMatrix) {
    const gaps = [];

    coverageMatrix.matrix.forEach((row1, val1) => {
        row1.forEach((cell, val2) => {
            if (!cell.covered) {
                gaps.push({
                    dimension1: val1,
                    dimension2: val2,
                    workflows: [],
                    issue: "No workflow configured"
                });
            }
        });
    });

    return gaps;
}
```

---

## Visual Output Example

For a webform with workflows using **requestType** and **country**:

```
┌──────────────────┬──────────┬──────────┬──────────┐
│ REQUEST / COUNTRY│    US    │    FR    │    BR    │
├──────────────────┼──────────┼──────────┼──────────┤
│ Access           │ ✅ CCPA  │ ✅ GDPR  │ ✅ LGPD  │
├──────────────────┼──────────┼──────────┼──────────┤
│ Deletion         │ ✅ CCPA  │ ✅ GDPR  │ ✅ LGPD  │
├──────────────────┼──────────┼──────────┼──────────┤
│ Correction       │ ❌ NONE  │ ✅ GDPR  │ ❌ NONE  │
└──────────────────┴──────────┴──────────┴──────────┘

Coverage: 7/9 = 77.8%
Gaps:
  - Access + Correction for US
  - Correction for BR
```

---

## Key Advantages

✅ **Not hardcoded** - Works with any webform
✅ **Workflow-driven** - Analyzes what matters
✅ **Automatic** - Finds dimensions on its own
✅ **Accurate** - Based on real criteria
✅ **Scalable** - Works with N workflows
✅ **Visual** - Easy to discuss with customers
✅ **Actionable** - Shows exactly what's missing

---

## Implementation Checklist

- [ ] Create `analyzeWorkflowDimensions()` function
- [ ] Create `rankDimensions()` function
- [ ] Create `buildDynamicCoverageMatrix()` function
- [ ] Create `identifyGaps()` function
- [ ] Create visual diagram generator (dynamic)
- [ ] Add "Generate Smart Coverage Diagram" button
- [ ] Test with actual webform data

---

## Next: Smart Analysis Function

Ready to implement this smarter approach?

