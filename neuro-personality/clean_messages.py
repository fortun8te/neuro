#!/usr/bin/env python3
"""Clean Michael's raw message export for personality training."""
import json
import re

input_file = "/Users/mk/Downloads/qwen_2b_neuro_clean.jsonl"
output_file = "/Users/mk/Downloads/nomads/neuro-personality/cleaned_messages.jsonl"
stats_file = "/Users/mk/Downloads/nomads/neuro-personality/cleaning_stats.json"

# Patterns to strip out
JUNK_PATTERNS = [
    r"\{'content_type': 'audio_asset_pointer'.*?\}",
    r"\{'content_type': 'real_time_user_audio_video_asset_pointer'.*?\}",
    r"\{'content_type': 'image_asset_pointer'.*?\}",
    r"\{'expiry_datetime':.*?\}",
    r"\{'content_type': 'audio_transcription', 'text': '(.*?)', 'direction': 'in'.*?\}",
    r"'video_container_asset_pointer':.*?\}",
    r"'audio_asset_pointer':.*?\}",
    r"'frame_attributes':.*?\]",
]

def extract_audio_transcription(text):
    """Pull actual spoken text from audio transcription metadata."""
    match = re.search(r"'content_type': 'audio_transcription', 'text': ['\"](.+?)['\"]", text)
    if match:
        return match.group(1).strip()
    return None

def clean_message(text):
    """Strip metadata, keep actual content."""
    original = text

    # Check if it's primarily audio metadata with a transcription
    transcription = extract_audio_transcription(text)

    # Strip all metadata blobs
    for pattern in JUNK_PATTERNS:
        text = re.sub(pattern, '', text, flags=re.DOTALL)

    # Clean up leftover artifacts
    text = re.sub(r'\{[^}]*content_type[^}]*\}', '', text)  # any remaining metadata dicts
    text = re.sub(r'\{[^}]*asset_pointer[^}]*\}', '', text)
    text = re.sub(r'\{[^}]*expiry_datetime[^}]*\}', '', text)
    text = re.sub(r'\{[^}]*sediment://[^}]*\}', '', text)
    text = re.sub(r"'[a-z_]+': (None|True|False|\d+\.?\d*),?\s*", '', text)
    text = re.sub(r'\{\s*\}', '', text)  # empty dicts
    text = re.sub(r'\[\s*\]', '', text)  # empty lists
    text = re.sub(r'\s{3,}', ' ', text)  # excessive whitespace
    text = text.strip()

    # If after cleaning there's nothing left but we had a transcription, use that
    if len(text) < 5 and transcription and len(transcription) > 5:
        text = transcription
    # If there's both cleaned text AND transcription, prepend transcription if text is mostly metadata
    elif transcription and len(text) < len(original) * 0.3:
        text = transcription

    return text

def categorize_message(text):
    """Quick categorization for stats."""
    text_lower = text.lower()

    if len(text) < 10:
        return "too_short"

    # Check if it's a system prompt / SOUL.md
    if "```markdown" in text or text.count("##") > 2:
        return "system_prompt"
    if len(text) > 1500:
        return "long_form"

    # Dutch
    dutch_words = ['ik', 'heb', 'het', 'een', 'voor', 'niet', 'maar', 'ook', 'wel', 'dat', 'dit', 'nog', 'wat']
    dutch_count = sum(1 for w in dutch_words if f' {w} ' in f' {text_lower} ')
    if dutch_count >= 3:
        return "dutch"

    # Technical / 3D specific
    if any(w in text_lower for w in ['geo nodes', 'geonodes', 'geometry nodes', 'blender', 'shader', 'octane', 'c4d']):
        return "technical_3d"

    # Code blocks
    if '```' in text:
        return "code_or_prompt"

    # Chat / casual
    if len(text) < 100:
        return "short_casual"

    return "general"

# Process
kept = []
skipped = []
stats = {"total": 0, "kept": 0, "skipped": 0, "categories": {}}

with open(input_file, 'r') as f:
    for line in f:
        stats["total"] += 1
        try:
            data = json.loads(line.strip())
            text = data.get("text", "")
        except json.JSONDecodeError:
            skipped.append({"reason": "invalid_json", "line": stats["total"]})
            stats["skipped"] += 1
            continue

        # Clean the message
        cleaned = clean_message(text)

        # Skip if too short after cleaning
        if len(cleaned) < 8:
            skipped.append({"reason": "too_short", "text": cleaned[:50]})
            stats["skipped"] += 1
            continue

        # Skip if it's just metadata garbage that survived cleaning
        if cleaned.startswith("{'") or cleaned.startswith('{"content_type'):
            skipped.append({"reason": "metadata_only", "text": cleaned[:50]})
            stats["skipped"] += 1
            continue

        category = categorize_message(cleaned)
        stats["categories"][category] = stats["categories"].get(category, 0) + 1

        kept.append({"text": cleaned, "category": category, "original_line": stats["total"]})
        stats["kept"] += 1

# Write cleaned output
with open(output_file, 'w') as f:
    for item in kept:
        f.write(json.dumps(item) + '\n')

stats["kept"] = len(kept)
with open(stats_file, 'w') as f:
    json.dump(stats, f, indent=2)

print(f"\n=== Cleaning Results ===")
print(f"Total messages: {stats['total']}")
print(f"Kept: {stats['kept']}")
print(f"Skipped: {stats['skipped']}")
print(f"\nCategories:")
for cat, count in sorted(stats['categories'].items(), key=lambda x: -x[1]):
    print(f"  {cat}: {count}")
