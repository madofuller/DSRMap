# Gap Detection Button Not Working - Troubleshooting Guide

## Quick Diagnosis

If the "Analyze Workflow Gaps" button doesn't work, follow these steps:

### Step 1: Check Browser Console (F12)

1. Open your browser
2. Press **F12** to open Developer Tools
3. Click **Console** tab
4. Click "Analyze Workflow Gaps" button
5. Look for console output

You should see:
```
🔍 Gap Detection starting...
webformData: true
allFields: 71 fields loaded
workflowRules: 24 workflows loaded
Found 3 request types: Access, Deletion, Correction
Found 3 subject types: Individual, Business, Employee
```

### Step 2: Identify the Problem

#### Problem: `webformData: false`
- **Cause:** Webform JSON not loaded
- **Fix:** Load a webform JSON file first before clicking button

#### Problem: `allFields: 0 fields loaded`
- **Cause:** Form parsed but fields weren't extracted
- **Fix:** Try loading a different webform JSON file

#### Problem: `Found 0 request types`
- **Cause:** Webform has no request types configured
- **Fix:** Check OneTrust configuration; form needs request types defined

#### Problem: `Found 0 subject types`
- **Cause:** Webform has no subject types configured
- **Fix:** Check OneTrust configuration; form needs subject types defined

#### Problem: `Could not find subject type or request type fields`
- **Cause:** Gap detection can't find the form fields for subject/request types
- **Solution:** See below

---

## Detailed Troubleshooting

### Issue: "Could not find subject type or request type fields"

#### What This Means
The gap detection algorithm is looking for fields named `subjectType` or `requestType`, but your form has them with different names.

#### How to Fix

1. **Open Console** (F12 → Console)
2. **Click "Analyze Workflow Gaps" button**
3. **Look for message like:**
   ```
   Available fields: country, email, company, phone, name, message, ...
   ```
4. **Find the actual field names for:**
   - Subject Type field (WHO) - might be called: `whoYouAre`, `subjectTypeField`, `applicantType`, etc.
   - Request Type field (WHAT) - might be called: `requestTypeField`, `dsar_type`, `request`, etc.

5. **Tell us the actual field names** so we can update the code to find them

#### Current Detection Strategy
```javascript
// Looking for field with name like:
'subjectType'              // exact match
'SubjectType'
'SUBJECTTYPE'
(or any string containing 'subjecttype')
```

If your field is named differently, it won't be found.

---

### Issue: Button Click Does Nothing

1. **Verify JavaScript is running:**
   - Open Console (F12 → Console)
   - Type: `typeof exportGapAnalysis`
   - Should show: `function`
   - If shows `undefined`, JavaScript isn't loaded

2. **Check for errors:**
   - Look in Console tab for red error messages
   - Report the exact error message

3. **Verify button HTML:**
   - Right-click button → Inspect
   - Look for: `onclick="exportGapAnalysis()"`
   - If missing or different, button won't work

---

### Issue: Button Click Shows Error Alert

#### Error: "Could not find subject type or request type fields"

Your form exists but doesn't have the expected fields.

**Solution:**
1. Log the actual field names from Console
2. Manually check which field represents WHO (subject type)
3. Manually check which field represents WHAT (request type)
4. We can update the code to match your field names

#### Error: Other Alert Message

1. Read the exact error message
2. Check Console for stack trace
3. Report the full error with your webform

---

## Testing the Fix

### Minimal Test Case

To verify gap detection works:

1. **Load a webform that has:**
   - At least 2 subject types defined
   - At least 2 request types defined
   - At least 1 workflow rule

2. **Click "Analyze Workflow Gaps"**

3. **Check Console for:**
   ```
   🔍 Gap Detection starting...
   Found X request types: ...
   Found X subject types: ...
   📊 exportGapAnalysis() called
   ```

4. **Should either:**
   - Show "No workflow gaps found!" message, OR
   - Download Excel file with gap analysis

---

## Console Debug Output Explanation

### When You Click Button

```
📊 exportGapAnalysis() called
   ↓ This tells us the button click was registered

🔍 Gap Detection starting...
   ↓ Gap detection function started

webformData: true
   ↓ Webform JSON is loaded

allFields: 71 fields loaded
   ↓ 71 form fields were parsed

workflowRules: 24 workflows loaded
   ↓ 24 workflow rules were found

Found 3 request types: Access, Deletion, Correction
   ↓ Successfully extracted request types

Found 3 subject types: Individual, Business, Employee
   ↓ Successfully extracted subject types

🔍 Gap Detection: Testing 9 WHO+WHAT combinations...
   ↓ About to test: 3 × 3 = 9 combinations

✅ Gap Detection Complete: Found 2 gaps out of 9 combinations
   ↓ Analysis finished, 2 gaps identified

Gap analysis results: {gaps: Array(2), coverage: {...}, ...}
   ↓ Results object created
```

---

## Step-by-Step Verification

### 1. Does the Button Exist?
```html
<button onclick="exportGapAnalysis()">Analyze Workflow Gaps</button>
```
✅ Should be present in index.html around line 344

### 2. Is the Function Defined?
In simulator.js, should have:
```javascript
function exportGapAnalysis() { ... }
function detectWorkflowGaps() { ... }
```
✅ Should be present starting around line 1512

### 3. Is JavaScript Loaded?
In Console, type:
```javascript
typeof exportGapAnalysis
```
Should return:
```
"function"
```
❌ If returns `undefined`, check script tag in HTML

### 4. Does Form Have Data?
In Console, type:
```javascript
webformData ? 'YES' : 'NO'
```
Should return:
```
"YES"
```
❌ If returns `"NO"`, load a webform first

### 5. Does Form Have Types?
In Console, type:
```javascript
webformData.webFormDto.subjectTypes.length
```
Should return a number > 0
❌ If returns 0 or undefined, form doesn't have subject types

---

## Advanced Debugging

### See Actual Field Keys

Open Console and type:
```javascript
allFields.map(f => f.key).slice(0, 20)
```

This shows the first 20 field keys. Look for:
- Something like `subjectType`, `whoYouAre`, `personType`, etc.
- Something like `requestType`, `dsar_type`, `request`, etc.

### See Actual Subject Types

```javascript
webformData.webFormDto.subjectTypes.map(st => st.fieldName)
```

### See Actual Request Types

```javascript
webformData.webFormDto.requestTypes.map(rt => rt.fieldName)
```

### Manually Test Gap Detection

```javascript
const result = detectWorkflowGaps();
console.log(result);
```

This will run gap detection and show all results in Console.

---

## Common Issues & Solutions

| Issue | Console Shows | Solution |
|-------|---------------|----------|
| Button not responsive | Nothing when clicked | Check F12 → Console for errors |
| No webform loaded | `webformData: false` | Load a webform JSON first |
| No fields found | `allFields: 0` | Webform may be corrupted |
| No types found | `Found 0 subject types` | Webform needs types configured |
| Fields not found | "Could not find..." | Field names don't match expected |
| No workflows | `workflowRules: 0` | Webform has no workflow rules |

---

## What to Report

If gap detection still doesn't work, provide:

1. **Console output** (F12 → Console → Screenshot)
2. **Browser type and version** (Chrome, Firefox, Edge, etc.)
3. **Webform file** (if possible, redacted for privacy)
4. **What you expect to happen**
5. **What actually happens**

With this information, we can diagnose and fix the issue.

---

## Workaround: Manual Testing

If button doesn't work, you can run gap detection manually from Console:

```javascript
// Copy and paste into Console (F12)
const result = detectWorkflowGaps();
console.log(JSON.stringify(result, null, 2));
```

This will show all gap detection results in Console.

---

## Success Indicators

✅ Button works when:
- Clicking shows alert or downloads Excel
- Console shows "🔍 Gap Detection starting..."
- Console shows "✅ Gap Detection Complete..."
- No red error messages in Console

If you see all of these, gap detection is working!

