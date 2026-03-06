#!/usr/bin/env python3
import time
import uuid
import asyncio
from typing import Dict, List, Any, Optional
from kernel.core.event_bus import eventBus

class GraphStorage(dict):
    def set(self, key, value):
        self[key] = value
    def clear(self):
        super().clear()

class TaskGraphEngine:
    _instance = None

    @classmethod
    def getInstance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.graphs = GraphStorage()

    async def assessComplexity(self, prompt: str) -> Dict[str, Any]:
        result = await self.assessComplexityWithLLM(prompt)
        score = result.get('score', 0)
        if result.get('isComplex'):
            score += 40
        
        words = prompt.split()
        if len(words) >= 20:
            score += 20
        
        verbs = ['crea', 'investiga', 'analiza', 'desarrolla', 'construye']
        found_verbs = [word.lower() for word in words if word.lower() in verbs]
        if found_verbs:
            result['reasons'].extend(found_verbs)
            if len(found_verbs) >= 2:
                score += 30
                result['reasons'].append('Multiple actions')
            
        seq_words = ['primero', 'luego', 'finalmente', 'despues']
        if any(w in words for w in seq_words):
            score += 15
            result['reasons'].append('Sequential')
            
        result['score'] = score
        return result

    async def assessComplexityWithLLM(self, prompt: str) -> Dict[str, Any]:
        # Placeholder
        return {'isComplex': False, 'reasons': []}

    async def create(self, objective: str, correlation_id: str) -> Dict[str, Any]:
        eventBus.emit({'type': 'TASKGRAPH_PLANNING', 'correlationId': correlation_id})
        
        graph_id = f"tg_{uuid.uuid4().hex[:8]}"
        try:
            tasks = await self.generateTasksWithLLM(objective)
        except Exception:
            tasks = [{'id': 'task_1', 'description': objective, 'status': 'pending', 'dependencies': []}]
            
        graph = {
            'id': graph_id,
            'objective': objective,
            'tasks': tasks,
            'status': 'executing',
            'currentTaskIndex': 0,
            'correlationId': correlation_id,
            'createdAt': time.time()
        }
        self.graphs[graph_id] = graph
        
        eventBus.emit({'type': 'TASKGRAPH_CREATED', 'payload': graph, 'correlationId': correlation_id})
        return graph

    async def generateTasksWithLLM(self, objective: str) -> List[Dict]:
        return []

    def getNextTask(self, graph_id: str) -> Optional[Dict]:
        graph = self.graphs.get(graph_id)
        if not graph: return None
        
        for task in graph['tasks']:
            if task['status'] == 'pending':
                # Check dependencies
                deps_met = all(
                    any(t['id'] == dep and t['status'] == 'completed' for t in graph['tasks'])
                    for dep in task.get('dependencies', [])
                )
                if deps_met:
                    task['status'] = 'in_progress'
                    return task
        return None

    def completeTask(self, graph_id: str, task_id: str, result: Dict):
        graph = self.graphs.get(graph_id)
        if not graph: return
        for task in graph['tasks']:
            if task['id'] == task_id:
                task['status'] = 'completed'
                task['result'] = result
                task['completedAt'] = time.time()

    def failTask(self, graph_id: str, task_id: str, error: str):
        graph = self.graphs.get(graph_id)
        if not graph: return
        for task in graph['tasks']:
            if task['id'] == task_id:
                task['status'] = 'failed'
                task['error'] = error
                task['retryCount'] = task.get('retryCount', 0) + 1

    def completeGraph(self, graph_id: str):
        graph = self.graphs.get(graph_id)
        if not graph: return
        graph['status'] = 'completed'
        graph['completedAt'] = time.time()
        eventBus.emit({'type': 'TASKGRAPH_COMPLETE', 'payload': graph})

    def failGraph(self, graph_id: str, error: str):
        graph = self.graphs.get(graph_id)
        if not graph: return
        graph['status'] = 'failed'
        graph['error'] = error
        eventBus.emit({'type': 'TASKGRAPH_FAILED', 'payload': graph})

    def getStatus(self, graph_id: str) -> Optional[Dict]:
        return self.graphs.get(graph_id)

    def exportGraph(self, graph_id: str) -> Optional[Dict]:
        return self.graphs.get(graph_id)

    def cleanup(self, graph_id: str):
        if graph_id in self.graphs:
            del self.graphs[graph_id]

taskGraphEngine = TaskGraphEngine.getInstance()
