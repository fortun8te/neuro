#!/bin/bash
# CLI Canvas Example Workflows
# Demonstrates the full document generation, editing, and versioning lifecycle

set -e

echo "
  CLI Canvas — Example Workflows
  ==============================
"

# Color codes
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RESET='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────
# Example 1: Quick Blog Post Generation
# ─────────────────────────────────────────────────────────────────────────────

example_1() {
  echo -e "\n${CYAN}Example 1: Generate a Blog Post${RESET}\n"
  echo "  This example generates a 500-word blog post with streaming."
  echo "  The CLI shows real-time progress, word count, and elapsed time."
  echo ""
  echo -e "  ${YELLOW}Command:${RESET}"
  echo "    /doc write a 500-word blog post about AI trends in 2026"
  echo ""
  echo -e "  ${YELLOW}Expected Output:${RESET}"
  echo "    Generating document..."
  echo "    Title: blog post about AI trends in 2026"
  echo ""
  echo "    [████████████████████░░░░░░░░] 65%  (325/500 words)  18s"
  echo ""
  echo "    Options: [E]dit / [S]how / [D]ownload / [S]ave / [V]ersions / [Q]uit"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Example 2: Edit a Section
# ─────────────────────────────────────────────────────────────────────────────

example_2() {
  echo -e "\n${CYAN}Example 2: Edit the 'Challenges' Section${RESET}\n"
  echo "  After generating a document, you can edit specific sections."
  echo "  The EDIT agent refines the content based on your instruction."
  echo ""
  echo -e "  ${YELLOW}Commands:${RESET}"
  echo "    [E]dit"
  echo "    Section: Challenges"
  echo "    Edit instruction: Add more technical depth about transformer architectures"
  echo ""
  echo -e "  ${YELLOW}Expected Output:${RESET}"
  echo "    Editing: Challenges"
  echo "    Instruction: Add more technical depth..."
  echo "    Generating refined version..."
  echo ""
  echo "    --- Diff ---"
  echo ""
  echo "    - Challenges are complex to understand."
  echo "    + Challenges include understanding transformer attention mechanisms,"
  echo "      which require knowledge of matrix operations and gradient flow."
  echo "      Modern architectures like LLaMA and Qwen address these through..."
  echo ""
  echo "    Accept this edit? (y/n) > y"
  echo "    Updated."
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Example 3: View and Save Document
# ─────────────────────────────────────────────────────────────────────────────

example_3() {
  echo -e "\n${CYAN}Example 3: View and Save the Document${RESET}\n"
  echo "  Pretty-print the document and save it for later use."
  echo ""
  echo -e "  ${YELLOW}Commands:${RESET}"
  echo "    /show"
  echo "    /save"
  echo ""
  echo -e "  ${YELLOW}Expected Output:${RESET}"
  echo ""
  echo "  AI Trends in 2026"
  echo "  ================="
  echo ""
  echo "  [1m[36mIntroduction[0m"
  echo "  Artificial intelligence continues to evolve at a rapid pace..."
  echo ""
  echo "  [1m[36m## Key Developments[0m"
  echo "  - [33m●[0m Multimodal models becoming standard"
  echo "  - [33m●[0m Open-source alternatives to proprietary models"
  echo "  - [33m●[0m Edge AI and on-device inference"
  echo ""
  echo "  [saved] /Users/mk/Downloads/documents/AI-Trends-in-2026-1711234567.md"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Example 4: Manage Versions
# ─────────────────────────────────────────────────────────────────────────────

example_4() {
  echo -e "\n${CYAN}Example 4: Manage Document Versions${RESET}\n"
  echo "  View all saved versions and download one."
  echo ""
  echo -e "  ${YELLOW}Command:${RESET}"
  echo "    /versions"
  echo ""
  echo -e "  ${YELLOW}Expected Output:${RESET}"
  echo ""
  echo "    Saved versions:"
  echo ""
  echo "    1. AI Trends in 2026 (2345 words, 4/2/2026 2:34 PM)"
  echo "    2. Marketing Copy - Productivity (1200 words, 4/2/2026 1:15 PM)"
  echo "    3. Technical Blog Post (890 words, 4/1/2026 11:22 PM)"
  echo ""
  echo "    Download version #? (enter number or q to cancel) > 1"
  echo "    [download] /Users/mk/Downloads/document-AI-Trends-in-2026-1711234567.md"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Example 5: Batch Document Generation (CLI piped)
# ─────────────────────────────────────────────────────────────────────────────

example_5() {
  echo -e "\n${CYAN}Example 5: Batch Generation (Piped Input)${RESET}\n"
  echo "  Generate multiple documents in batch mode (headless)."
  echo ""
  echo -e "  ${YELLOW}Command:${RESET}"
  echo "    printf \"/doc write product marketing copy for SaaS tool\n\" | npx tsx src/cli.ts"
  echo ""
  echo -e "  ${YELLOW}Expected Output:${RESET}"
  echo "    [model: qwen3.5:9b]"
  echo ""
  echo "    Generating document..."
  echo "    Title: product marketing copy for SaaS tool"
  echo ""
  echo "    [████████████████████████████] 100%  (487/500 words)  24s"
  echo ""
  echo "    Generated: 487 words in ~2 min"
  echo "    [saved] /Users/mk/Downloads/documents/product-marketing-copy-for-SaaS-tool-1711234567.md"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Example 6: Edit by Line Range
# ─────────────────────────────────────────────────────────────────────────────

example_6() {
  echo -e "\n${CYAN}Example 6: Edit Specific Line Range${RESET}\n"
  echo "  Edit a document by line numbers instead of section heading."
  echo ""
  echo -e "  ${YELLOW}Commands:${RESET}"
  echo "    /edit line 15-20"
  echo "    Edit instruction: Expand this paragraph with more examples"
  echo ""
  echo -e "  ${YELLOW}Expected Output:${RESET}"
  echo "    Editing: Lines 15-20"
  echo "    Instruction: Expand this paragraph..."
  echo "    Generating refined version..."
  echo ""
  echo "    --- Diff ---"
  echo ""
  echo "    - Original paragraph text."
  echo "    + Original paragraph text with expanded examples:"
  echo "      Example 1: First use case in production..."
  echo "      Example 2: How customers benefited..."
  echo ""
  echo "    Accept this edit? (y/n) > y"
  echo "    Updated."
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Example 7: Full Workflow
# ─────────────────────────────────────────────────────────────────────────────

example_7() {
  echo -e "\n${CYAN}Example 7: Complete Workflow (Generate → Edit → Save)${RESET}\n"
  echo "  Full end-to-end example of the canvas lifecycle."
  echo ""
  echo -e "  ${YELLOW}Steps:${RESET}"
  echo "    1. Start CLI: ${GREEN}npm run cli${RESET}"
  echo "    2. Generate:  ${GREEN}/doc write a 300-word product announcement${RESET}"
  echo "    3. Show:      ${GREEN}/show${RESET}"
  echo "    4. Edit:      ${GREEN}/edit \"Features\"${RESET}"
  echo "       Instruction: Make the features more compelling to CTOs"
  echo "    5. Accept:    ${GREEN}y${RESET}"
  echo "    6. Save:      ${GREEN}/save${RESET}"
  echo "    7. Versions:  ${GREEN}/versions${RESET}"
  echo "    8. Download:  ${GREEN}1${RESET}"
  echo ""
  echo -e "  ${YELLOW}Timeline:${RESET}"
  echo "    Step 1: 2 seconds (CLI startup)"
  echo "    Step 2: 15 seconds (generation + streaming)"
  echo "    Step 3: 1 second (display)"
  echo "    Step 4: Immediate (prompts for instruction)"
  echo "    Step 5: 8 seconds (EDIT agent refines section)"
  echo "    Step 6: 1 second (saved to disk)"
  echo "    Step 7: 1 second (shows version list)"
  echo "    Step 8: 1 second (download complete)"
  echo ""
  echo "    Total: ~30 seconds for complete workflow"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# Main menu
# ─────────────────────────────────────────────────────────────────────────────

show_menu() {
  echo -e "\n${YELLOW}Available Examples:${RESET}\n"
  echo "  1. Generate a Blog Post"
  echo "  2. Edit a Section"
  echo "  3. View and Save Document"
  echo "  4. Manage Versions"
  echo "  5. Batch Generation (Piped)"
  echo "  6. Edit by Line Range"
  echo "  7. Complete Workflow"
  echo "  all - Show all examples"
  echo "  q   - Quit"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────

if [[ "$1" == "all" ]]; then
  example_1
  example_2
  example_3
  example_4
  example_5
  example_6
  example_7
elif [[ "$1" == "1" ]]; then
  example_1
elif [[ "$1" == "2" ]]; then
  example_2
elif [[ "$1" == "3" ]]; then
  example_3
elif [[ "$1" == "4" ]]; then
  example_4
elif [[ "$1" == "5" ]]; then
  example_5
elif [[ "$1" == "6" ]]; then
  example_6
elif [[ "$1" == "7" ]]; then
  example_7
else
  show_menu
  echo -e "${YELLOW}Usage:${RESET} bash examples-cli-canvas.sh [1-7|all|q]"
  echo ""
  echo "Examples:"
  echo "  bash examples-cli-canvas.sh 1          # Show Example 1"
  echo "  bash examples-cli-canvas.sh all        # Show all examples"
  echo ""
fi
