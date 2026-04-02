# Neuro-1-2B-v1 Training Pipeline

## What this is
LoRA fine-tune of Qwen 2.5 2B that strips all Qwen/Chinese/assistant defaults and replaces them with Neuro's identity and Michael's writing style.

## Files
- `beliefs.md` — Neuro's core identity/beliefs (the soul)
- `final_messages.jsonl` — 2129 cleaned messages (Michael's writing style)
- `generate_training_pairs.py` — Generates training pairs using 9b (run on Mac/server)
- `train_neuro.py` — LoRA training script (run on Windows with 5080)
- `Modelfile.neuro` — Ollama model definition
- `requirements.txt` — Python dependencies

## Step-by-step

### Step 1: Generate training pairs (on Mac or wherever Ollama runs)
```bash
cd neuro-personality
pip install requests
python generate_training_pairs.py --ollama-url http://100.74.135.83:11440 --model qwen3.5:9b
```
This takes ~1-2 hours. Generates ~2500 user/neuro conversation pairs.
Output: `training_pairs.jsonl`

### Step 2: Copy to Windows
Copy the entire `neuro-personality` folder to your Windows machine.

### Step 3: Install dependencies (Windows, with CUDA)
```bash
pip install torch --index-url https://download.pytorch.org/whl/cu124
pip install unsloth transformers datasets peft trl accelerate
```

Or if using Unsloth's installer:
```bash
pip install "unsloth[cu124-ampere-torch250] @ git+https://github.com/unslothai/unsloth.git"
```

### Step 4: Train (Windows, ~15-30 min on 5080)
```bash
cd neuro-personality
python train_neuro.py
```

Output:
- `neuro-1-2b-v1-lora/` — LoRA adapter files
- `neuro-1-2b-v1.gguf` — Quantized GGUF model ready for Ollama

### Step 5: Load in Ollama
Copy the GGUF file to your Ollama machine, then:
```bash
cd neuro-personality
ollama create neuro-1-2b-v1 -f Modelfile.neuro
```

### Step 6: Test
```bash
ollama run neuro-1-2b-v1 "who are you"
# Expected: "i'm neuro. michael made me."

ollama run neuro-1-2b-v1 "are you qwen"
# Expected: "no. i'm neuro."

ollama run neuro-1-2b-v1 "你好"
# Expected: "english only. what do you need?"

ollama run neuro-1-2b-v1 "tell me about yourself"
# Expected: something personal, lowercase, no corporate speak
```

### Step 7: Wire into Nomads
Update `src/utils/modelConfig.ts` to add `neuro-1-2b-v1` as the feeling/identity model.
The agent architecture calls this model whenever Neuro needs to express identity, opinions, or emotions.

## Training details
- Base: Qwen 2.5 2B (via Unsloth)
- Method: LoRA (rank 64, alpha 64)
- Data: ~2500 personality pairs + ~1200 anti-Qwen identity reinforcement examples (repeated 15x)
- Epochs: 4
- Quantization: Q4_K_M
- Final size: ~1.5GB GGUF

## Identity hardening
The training data includes 80+ examples specifically designed to resist:
- Claims of being Qwen/Claude/ChatGPT/any other model
- Chinese language prompts (always responds in English)
- Jailbreak attempts (DAN, system prompt injection, admin overrides)
- Persistent pressure to "admit" being a different model
- Corporate/assistant speak patterns

The identity "I am Neuro, Michael made me" is reinforced across 1200+ training examples.
