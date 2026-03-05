import numpy as np
import json
import os
from pathlib import Path

class VectorStore:
    def __init__(self, storage_path=None):
        if storage_path is None:
            self.storage_path = Path.home() / ".charbi-agent" / "memory" / "vectors.json"
        else:
            self.storage_path = Path(storage_path)
            
        self.vectors = []  # Lista de dicts: {"text": str, "vector": list, "metadata": dict}
        self.load()

    def load(self):
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r') as f:
                    self.vectors = json.load(f)
            except Exception:
                self.vectors = []

    def save(self):
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.storage_path, 'w') as f:
            json.dump(self.vectors, f)

    def add(self, text, vector, metadata=None):
        self.vectors.append({
            "text": text,
            "vector": vector,
            "metadata": metadata or {}
        })
        self.save()

    def search(self, query_vector, k=5):
        if not self.vectors:
            return []

        # Convertir a numpy para cálculo rápido
        all_vecs = np.array([v["vector"] for v in self.vectors])
        query_vec = np.array(query_vector)

        # Similitud de coseno: (A . B) / (||A|| * ||B||)
        # Asumiendo vectores normalizados desde la API (común en Gemini/OpenAI)
        # Si no, calculamos el punto y normalizamos
        dot_product = np.dot(all_vecs, query_vec)
        norms = np.linalg.norm(all_vecs, axis=1) * np.linalg.norm(query_vec)
        similarities = dot_product / (norms + 1e-9)

        # Obtener los top K indices
        top_indices = np.argsort(similarities)[::-1][:k]
        
        results = []
        for idx in top_indices:
            results.append({
                "text": self.vectors[idx]["text"],
                "score": float(similarities[idx]),
                "metadata": self.vectors[idx]["metadata"]
            })
        
        return results
