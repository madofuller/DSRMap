#!/usr/bin/env python3
"""
Automatic Translation Sync Script
Syncs field_translations.json with labels from webform template formTranslations (en-us).
Labels from formTranslations ALWAYS supersede manual translations.

Usage:
    python sync_translations.py <webform_template.json> <field_translations.json>
"""

import json
import sys
from pathlib import Path


def sync_translations(webform_path, translations_path):
    """
    Syncs translations with labels from webform template.
    Uses formTranslations (en-us language) as the source of truth.
    """
    # Load files
    print(f"Loading webform template: {webform_path}")
    with open(webform_path, 'r', encoding='utf-8') as f:
        webform = json.load(f)

    print(f"Loading translations: {translations_path}")
    with open(translations_path, 'r', encoding='utf-8') as f:
        translations = json.load(f)

    # Extract labels from formTranslations (en-us language)
    form_translations = webform.get('formTranslations', {})
    en_us_translations = form_translations.get('en-us', {})

    if not en_us_translations:
        print("ERROR: Could not find en-us translations in webform")
        return -1

    print(f"\nFound {len(en_us_translations)} labels in en-us translations")

    # Sync translations
    updates = []
    for field_key, label_value in en_us_translations.items():
        # Only sync fields section (not options, requestTypes, etc.)
        if field_key not in translations.get('fields', {}):
            continue

        current_value = translations['fields'].get(field_key)

        if current_value != label_value:
            updates.append({
                'field': field_key,
                'old': current_value,
                'new': label_value
            })
            translations['fields'][field_key] = label_value

    # Report changes
    if updates:
        print(f"\n{'='*80}")
        print(f"UPDATING {len(updates)} FIELD(S):")
        print(f"{'='*80}")
        for update in updates:
            print(f"\n{update['field']}:")
            print(f"  OLD: {update['old']}")
            print(f"  NEW: {update['new']}")

        # Backup original
        backup_path = translations_path.parent / f"{translations_path.stem}.backup{translations_path.suffix}"
        print(f"\n{'='*80}")
        print(f"Creating backup: {backup_path}")
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(json.load(open(translations_path, 'r', encoding='utf-8')), f, indent=2, ensure_ascii=False)

        # Write updated translations
        print(f"Writing updates to: {translations_path}")
        with open(translations_path, 'w', encoding='utf-8') as f:
            json.dump(translations, f, indent=2, ensure_ascii=False)

        print(f"\n{'='*80}")
        print(f"[OK] Successfully updated {len(updates)} field(s)")
        print(f"{'='*80}")
    else:
        print(f"\n{'='*80}")
        print("[OK] All translations are already in sync with webform labels")
        print(f"{'='*80}")

    return len(updates)


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        print("\nExample:")
        print("  python sync_translations.py webform-template-123.json field_translations.json")
        sys.exit(1)

    webform_path = Path(sys.argv[1])
    translations_path = Path(sys.argv[2])

    # Validate files exist
    if not webform_path.exists():
        print(f"Error: Webform template not found: {webform_path}")
        sys.exit(1)

    if not translations_path.exists():
        print(f"Error: Translations file not found: {translations_path}")
        sys.exit(1)

    # Run sync
    try:
        updates = sync_translations(webform_path, translations_path)
        sys.exit(0 if updates >= 0 else 1)
    except Exception as e:
        print(f"\n{'='*80}")
        print(f"ERROR: {e}")
        print(f"{'='*80}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
