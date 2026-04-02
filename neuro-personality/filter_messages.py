#!/usr/bin/env python3
"""Filter cleaned messages — remove Dutch, system prompts, too-short, and metadata junk."""
import json

input_file = "/Users/mk/Downloads/nomads/neuro-personality/cleaned_messages.jsonl"
output_file = "/Users/mk/Downloads/nomads/neuro-personality/filtered_messages.jsonl"

REMOVE_CATEGORIES = {"dutch", "system_prompt", "too_short"}

kept = []
removed = 0

with open(input_file, 'r') as f:
    for line in f:
        item = json.loads(line.strip())
        text = item["text"]
        cat = item["category"]

        # Remove bad categories
        if cat in REMOVE_CATEGORIES:
            removed += 1
            continue

        # Remove any leftover metadata blobs
        if "asset_pointer" in text or "sediment://" in text or "content_type" in text:
            removed += 1
            continue

        # Remove messages that are just "nah" / "yes" / "ok" — no style signal
        if len(text.strip()) < 12 and text.strip().lower() in [
            "yes", "no", "nah", "ok", "yep", "nope", "yeah", "sure", "lol",
            "true", "facts", "bet", "yo", "hmm", "idk", "damn", "nice",
            "got it", "makes sense", "ok cool", "aight", "yoo", "word"
        ]:
            removed += 1
            continue

        kept.append(item)

with open(output_file, 'w') as f:
    for item in kept:
        f.write(json.dumps(item) + '\n')

print(f"Kept: {len(kept)}")
print(f"Removed: {removed}")
print(f"\nRemaining categories:")
cats = {}
for item in kept:
    cats[item["category"]] = cats.get(item["category"], 0) + 1
for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
    print(f"  {cat}: {count}")
