import networkx as nx
import json
import os
from pathlib import Path

class KnowledgeGraph:
    def __init__(self, storage_path=None):
        if storage_path is None:
            self.storage_path = Path.home() / ".charbi-agent" / "memory" / "graph.json"
        else:
            self.storage_path = Path(storage_path)
            
        self.graph = nx.DiGraph()
        self.load()

    def load(self):
        if self.storage_path.exists():
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    for edge in data.get("edges", []):
                        self.graph.add_edge(
                            edge["subject"], 
                            edge["object"], 
                            relation=edge["relation"],
                            metadata=edge.get("metadata", {})
                        )
            except Exception:
                self.graph = nx.DiGraph()

    def save(self):
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        edges = []
        for s, o, data in self.graph.edges(data=True):
            edges.append({
                "subject": s,
                "object": o,
                "relation": data.get("relation", "related_to"),
                "metadata": data.get("metadata", {})
            })
        
        with open(self.storage_path, 'w') as f:
            json.dump({"edges": edges}, f, indent=2)

    def add_relation(self, subject, relation, obj, metadata=None):
        self.graph.add_edge(subject, obj, relation=relation, metadata=metadata or {})
        self.save()

    def query(self, entity=None, relation=None):
        """Consulta el grafo buscando coincidencias por entidad o relación"""
        results = []
        for s, o, data in self.graph.edges(data=True):
            match_entity = (entity is None) or (s == entity or o == entity)
            match_relation = (relation is None) or (data.get("relation") == relation)
            
            if match_entity and match_relation:
                results.append({
                    "subject": s,
                    "relation": data.get("relation"),
                    "object": o,
                    "metadata": data.get("metadata")
                })
        return results

    def get_neighbors(self, entity):
        """Obtiene todas las conexiones directas de una entidad"""
        if entity not in self.graph:
            return []
        
        results = []
        # Salientes
        for neighbor in self.graph.successors(entity):
            data = self.graph.get_edge_data(entity, neighbor)
            results.append({"from": entity, "to": neighbor, "relation": data["relation"]})
        # Entrantes
        for neighbor in self.graph.predecessors(entity):
            data = self.graph.get_edge_data(neighbor, entity)
            results.append({"from": neighbor, "to": entity, "relation": data["relation"]})
            
        return results
