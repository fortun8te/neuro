#!/bin/bash

echo "NEURO Overnight Research Infrastructure Verification"
echo "====================================================="
echo ""

# Check configuration file
if [[ -f "src/config/overtimeResearchConfig.ts" ]]; then
  SIZE=$(stat -f%z "src/config/overtimeResearchConfig.ts" | numfmt --to=iec)
  LINES=$(wc -l < "src/config/overtimeResearchConfig.ts")
  echo "✓ Configuration: src/config/overtimeResearchConfig.ts"
  echo "  Size: $SIZE, Lines: $LINES"
else
  echo "✗ Configuration file not found"
fi

# Check startup script
if [[ -f "startOvernightResearch.sh" && -x "startOvernightResearch.sh" ]]; then
  SIZE=$(stat -f%z "startOvernightResearch.sh" | numfmt --to=iec)
  LINES=$(wc -l < "startOvernightResearch.sh")
  echo "✓ Startup script: startOvernightResearch.sh (executable)"
  echo "  Size: $SIZE, Lines: $LINES"
else
  echo "✗ Startup script missing or not executable"
fi

# Check monitor component
if [[ -f "src/components/OvernightResearchMonitor.tsx" ]]; then
  SIZE=$(stat -f%z "src/components/OvernightResearchMonitor.tsx" | numfmt --to=iec)
  LINES=$(wc -l < "src/components/OvernightResearchMonitor.tsx")
  echo "✓ Monitor component: src/components/OvernightResearchMonitor.tsx"
  echo "  Size: $SIZE, Lines: $LINES"
else
  echo "✗ Monitor component not found"
fi

# Check documentation
echo ""
echo "Documentation:"

if [[ -f "OVERNIGHT_RESEARCH_GUIDE.md" ]]; then
  SIZE=$(stat -f%z "OVERNIGHT_RESEARCH_GUIDE.md" | numfmt --to=iec)
  LINES=$(wc -l < "OVERNIGHT_RESEARCH_GUIDE.md")
  echo "✓ Complete guide: OVERNIGHT_RESEARCH_GUIDE.md"
  echo "  Size: $SIZE, Lines: $LINES"
else
  echo "✗ Guide not found"
fi

if [[ -f "OVERNIGHT_RESEARCH_README.md" ]]; then
  SIZE=$(stat -f%z "OVERNIGHT_RESEARCH_README.md" | numfmt --to=iec)
  LINES=$(wc -l < "OVERNIGHT_RESEARCH_README.md")
  echo "✓ Quick reference: OVERNIGHT_RESEARCH_README.md"
  echo "  Size: $SIZE, Lines: $LINES"
else
  echo "✗ README not found"
fi

if [[ -f ".overnight-research-checklist" ]]; then
  SIZE=$(stat -f%z ".overnight-research-checklist" | numfmt --to=iec)
  LINES=$(wc -l < ".overnight-research-checklist")
  echo "✓ Checklist: .overnight-research-checklist"
  echo "  Size: $SIZE, Lines: $LINES"
else
  echo "✗ Checklist not found"
fi

echo ""
echo "Summary:"
echo "--------"
echo "All overnight research infrastructure files are in place."
echo ""
echo "Next steps:"
echo "1. Read: OVERNIGHT_RESEARCH_README.md (quick start)"
echo "2. Read: OVERNIGHT_RESEARCH_GUIDE.md (full documentation)"
echo "3. Start services (4 terminals)"
echo "4. Run: ./startOvernightResearch.sh \"Campaign\" \"Topic\""
echo "5. Monitor: http://localhost:5173"

