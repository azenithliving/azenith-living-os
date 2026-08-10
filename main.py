import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

app = FastAPI()

# Load tokenizer and base model (4‑bit quantized)
MODEL_ID = os.getenv("HF_MODEL_ID", "noura/azenith-llama7b-4bit")
HF_TOKEN = os.getenv("HF_TOKEN")

if not HF_TOKEN:
    raise RuntimeError("HF_TOKEN env variable not set")

print(f"Loading model {MODEL_ID} ...")
base_model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    token=HF_TOKEN,
    device_map="auto",
    load_in_4bit=True,
    torch_dtype=torch.float16,
)
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=True)

# Load LoRA adapter if exists
ADAPTER_PATH = os.getenv("HF_ADAPTER_PATH")
if ADAPTER_PATH:
    print(f"Loading LoRA adapter from {ADAPTER_PATH}")
    base_model = PeftModel.from_pretrained(base_model, ADAPTER_PATH)

# Embedding model for RAG (FAISS) – using a lightweight sentence‑transformer
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# Load FAISS index and documents (assume stored in ./faiss_index)
INDEX_PATH = "./faiss_index"
if not os.path.isdir(INDEX_PATH):
    raise RuntimeError("FAISS index directory not found")

index = faiss.read_index(os.path.join(INDEX_PATH, "index.faiss"))
with open(os.path.join(INDEX_PATH, "docs.txt"), "r", encoding="utf-8") as f:
    docs = [line.strip() for line in f.readlines()]

class QueryRequest(BaseModel):
    query: str
    top_k: int = 3

def retrieve_docs(query: str, top_k: int = 3):
    q_vec = embedder.encode([query], normalize_embeddings=True)
    distances, indices = index.search(np.array(q_vec).astype('float32'), top_k)
    retrieved = [docs[i] for i in indices[0]]
    return retrieved

def build_prompt(query: str, retrieved: list):
    context = "\n".join(retrieved)
    prompt = f"You are Azenith, an expert consultant. Use the following retrieved context to answer the user's question.\n\nContext:\n{context}\n\nQuestion: {query}\n\nAnswer:"""
    return prompt

@app.post("/consult")
async def consult(request: QueryRequest):
    # Retrieve documents
    retrieved = retrieve_docs(request.query, request.top_k)
    prompt = build_prompt(request.query, retrieved)
    inputs = tokenizer(prompt, return_tensors="pt").to(base_model.device)
    with torch.no_grad():
        output = base_model.generate(**inputs, max_new_tokens=256, do_sample=True, temperature=0.7)
    answer = tokenizer.decode(output[0], skip_special_tokens=True)
    # Remove the prompt part from the answer
    answer = answer.split("Answer:")[‑1].strip()
    return {"answer": answer, "retrieved": retrieved}

@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    # Simple placeholder – real implementation would use CLIP to embed image and search FAISS
    raise HTTPException(status_code=501, detail="Image support not implemented yet")

@app.post("/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    # Placeholder for Whisper audio transcription
    raise HTTPException(status_code=501, detail="Audio support not implemented yet")
