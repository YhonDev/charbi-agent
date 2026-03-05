from .base_skill import BaseSkill

class WebSearchSkill(BaseSkill):
    @property
    def name(self):
        return "web_search"

    @property
    def description(self):
        return "Search the web for information."

    def execute(self, query):
        print(f"[*] Searching for: {query}")
        return f"Results for '{query}': Found 3 relevant links (Simulation)."
