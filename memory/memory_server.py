import sys
import json
import traceback
from .hybrid_store import HybridStore

# Singleton de la memoria
hybrid_store = HybridStore()

def handle_request(request):
    method = request.get("method")
    params = request.get("params", {})
    id = request.get("id")

    try:
        if method == "memory.store":
            hybrid_store.store_event(
                params["text"], 
                params["vector"], 
                params.get("metadata")
            )
            return {"id": id, "result": {"success": True}}
            
        elif method == "graph.add_relation":
            hybrid_store.store_relation(
                params["subject"], 
                params["relation"], 
                params["object"], 
                params.get("metadata")
            )
            return {"id": id, "result": {"success": True}}
            
        elif method == "memory.search":
            results = hybrid_store.search(
                params["vector"], 
                params.get("text"), 
                params.get("k", 5)
            )
            return {"id": id, "result": results}
            
        elif method == "graph.query":
            results = hybrid_store.graph.query(
                params.get("entity"), 
                params.get("relation")
            )
            return {"id": id, "result": results}
            
        elif method == "system.status":
            return {
                "id": id, 
                "result": {
                    "vectors": len(hybrid_store.vector_store.vectors),
                    "edges": hybrid_store.graph.graph.number_of_edges(),
                    "nodes": hybrid_store.graph.graph.number_of_nodes()
                }
            }
        else:
            return {"id": id, "error": f"Metodo no soportado: {method}"}

    except Exception as e:
        return {"id": id, "error": str(e), "trace": traceback.format_exc()}

def main():
    """Bucle principal de escucha JSON-RPC sobre Stdio"""
    for line in sys.stdin:
        if not line.strip(): continue
        try:
            request = json.loads(line)
            response = handle_request(request)
            print(json.dumps(response), flush=True)
        except Exception as e:
            print(json.dumps({"error": f"Invalid JSON: {str(e)}"}), flush=True)

if __name__ == "__main__":
    main()
