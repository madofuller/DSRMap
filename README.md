# DSAR Webform Simulator & Workflow Analyzer

Interactive tool for analyzing OneTrust DSAR webforms, simulating user interactions, and understanding workflow triggers.

## Features

- **Interactive Form Simulation**: Test how the webform behaves with different selections
- **Real-time Workflow Evaluation**: See which workflows trigger based on your selections
- **Form Action Tracking**: Monitor submit button and attachment field visibility
- **Comprehensive Excel Export**: Export complete webform configuration to Excel with 10 detailed sheets
- **Translation Support**: Automatically syncs field labels from webform JSON

## Getting Started

1. Open the application in your browser
2. Upload your OneTrust webform JSON file
3. Start making selections to see:
   - Which fields become visible
   - Which workflows will trigger
   - When the submit button is enabled/disabled
   - When attachment uploads are required

## Excel Export

Click "Export to Excel" to generate a comprehensive workbook with:

1. **All Fields** - Complete field configuration
2. **Field Options** - All available options for each field
3. **Visibility Rules** - Conditional field display logic
4. **All Workflows** - Workflow configurations
5. **Workflow Criteria** - Trigger conditions in one row per workflow
6. **Workflow Walkthrough** - Step-by-step trigger instructions
7. **Submit Button Rules** - When submission is blocked
8. **Attachment Rules** - When file uploads appear
9. **Request Types** - All configured request types
10. **Subject Types** - All configured subject types

## Translation Sync Utility

Use `sync_translations.py` to automatically sync field labels from your webform JSON to the translation file:

```bash
python sync_translations.py
```

This ensures all field labels match the source webform configuration.

## Technology

- Pure JavaScript (no framework dependencies)
- SheetJS for Excel export
- OneTrust DSAR webform JSON format

## Deployment

Ready to deploy on Vercel - just push to a repository and connect to Vercel.

## License

MIT
