from .vector_store import VectorStore
from .knowledge_graph import KnowledgeGraph

class HybridStore:
    def __init__(self):
        self.vector_store = VectorStore()
        self.graph = KnowledgeGraph()

    def store_event(self, text, vector, metadata=None):
        """Guarda un evento en la memoria vectorial"""
        self.vector_store.add(text, vector, metadata)

    def store_relation(self, subject, relation, obj, metadata=None):
        """Guarda una relación en el grafo de conocimiento"""
        self.graph.add_relation(subject, relation, obj, metadata)

    def search(self, query_vector, query_text=None, k=5):
        """Búsqueda híbrida: semántica + estructural"""
        # 1. Búsqueda semántica
        semantic_results = self.vector_store.search(query_vector, k=k)
        
        # 2. Búsqueda en grafo (si hay texto de consulta)
        graph_results = []
        if query_text:
            # Intentar buscar entidades mencionadas en el query_text
            # Por ahora búsqueda simple de coincidencias exactas en el texto
            words = query_text.split()
            for word in words:
                if len(word) > 3: # Solo palabras significativas
                    graph_results.extend(self.graph.query(entity=word))
        
        return {
            "semantic": semantic_results,
            "structural": graph_results
        }

    def get_recent(self, k=10):
        """Retorna los últimos k eventos (historico)"""
        return self.vector_store.get_recent(k)
