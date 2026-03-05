"""
Hub Central de Agentes y Skills
"""

from typing import Dict, List, Callable
from config.manager import ConfigManager

class AgentHub:
    """Gestiona el registro y ejecución de agentes"""
    
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
        self.agents: Dict[str, Callable] = {}
        self.skills: Dict[str, Callable] = {}
    
    def register_agent(self, name: str, agent_func: Callable):
        """Registra un agente en el hub"""
        self.agents[name] = agent_func
    
    def register_skill(self, name: str, skill_func: Callable):
        """Registra una skill en el hub"""
        self.skills[name] = skill_func
    
    def get_active_agents(self) -> List[str]:
        """Obtiene lista de agentes activos"""
        return self.config.get_active_agents()
    
    def get_enabled_skills(self) -> List[str]:
        """Obtiene lista de skills habilitadas"""
        return self.config.get_enabled_skills()
    
    def execute_agent(self, agent_name: str, **kwargs):
        """Ejecuta un agente registrado"""
        if agent_name in self.agents:
            return self.agents[agent_name](**kwargs)
        raise ValueError(f"Agente {agent_name} no registrado")
    
    def execute_skill(self, skill_name: str, **kwargs):
        """Ejecuta una skill registrada"""
        if skill_name in self.skills:
            return self.skills[skill_name](**kwargs)
        raise ValueError(f"Skill {skill_name} no habilitada")


# Ejemplo de Skill
def web_search_skill(query: str) -> str:
    """Skill de búsqueda web"""
    # Implementar lógica de búsqueda
    return f"Resultados para: {query}"

def code_executor_skill(code: str, language: str = "python") -> str:
    """Skill de ejecución de código"""
    # Implementar ejecución segura de código
    return f"Código ejecutado: {language}"
