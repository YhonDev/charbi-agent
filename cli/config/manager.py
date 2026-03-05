"""
Gestor de Configuración Centralizado
"""

import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

class ConfigManager:
    """Gestiona toda la configuración del sistema"""
    
    DEFAULT_CONFIG = {
        "providers": {
            "openai": {
                "enabled": False,
                "api_key": "",
                "models": ["gpt-4", "gpt-3.5-turbo", "gpt-4-turbo"],
                "default_model": "gpt-4"
            },
            "anthropic": {
                "enabled": False,
                "api_key": "",
                "models": ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
                "default_model": "claude-3-opus"
            },
            "local": {
                "enabled": False,
                "endpoint": "http://localhost:11434",
                "models": ["llama2", "mistral", "codellama"],
                "default_model": "llama2"
            }
        },
        "parameters": {
            "temperature": 0.7,
            "top_p": 0.9,
            "max_tokens": 2048,
            "frequency_penalty": 0.0,
            "presence_penalty": 0.0
        },
        "agents": {
            "active": [],
            "skills_enabled": []
        },
        "metadata": {
            "created_at": "",
            "last_modified": "",
            "version": "1.0.0"
        }
    }
    
    def __init__(self, config_path: str = "config/settings.json"):
        # Ensure path is relative to the CLI root if needed, but here we assume CWD is cli/
        self.config_path = Path(config_path)
        self.config = self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """Carga la configuración desde archivo"""
        if self.config_path.exists():
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # Crear configuración por defecto
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            self.DEFAULT_CONFIG["metadata"]["created_at"] = datetime.now().isoformat()
            self.save_config(self.DEFAULT_CONFIG)
            return self.DEFAULT_CONFIG
    
    def save_config(self, config: Optional[Dict] = None):
        """Guarda la configuración en archivo"""
        if config:
            self.config = config
        self.config["metadata"]["last_modified"] = datetime.now().isoformat()
        
        with open(self.config_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, indent=2, ensure_ascii=False)
    
    def get_provider(self, provider_name: str) -> Dict:
        """Obtiene configuración de un proveedor"""
        return self.config["providers"].get(provider_name, {})
    
    def update_provider(self, provider_name: str, updates: Dict):
        """Actualiza configuración de un proveedor"""
        if provider_name in self.config["providers"]:
            self.config["providers"][provider_name].update(updates)
            self.save_config()
    
    def get_parameters(self) -> Dict:
        """Obtiene parámetros del modelo"""
        return self.config["parameters"]
    
    def update_parameters(self, updates: Dict):
        """Actualiza parámetros del modelo"""
        self.config["parameters"].update(updates)
        self.save_config()
    
    def get_api_key(self, provider: str) -> str:
        """Obtiene API Key (también busca en variables de entorno)"""
        key = self.config["providers"].get(provider, {}).get("api_key", "")
        if not key:
            key = os.getenv(f"{provider.upper()}_API_KEY", "")
        return key
    
    def set_api_key(self, provider: str, key: str):
        """Establece API Key de forma segura"""
        if provider in self.config["providers"]:
            self.config["providers"][provider]["api_key"] = key
            self.config["providers"][provider]["enabled"] = True
            self.save_config()
    
    def add_agent(self, agent_name: str):
        """Añade un agente a la lista activa"""
        if agent_name not in self.config["agents"]["active"]:
            self.config["agents"]["active"].append(agent_name)
            self.save_config()
    
    def remove_agent(self, agent_name: str):
        """Elimina un agente de la lista activa"""
        if agent_name in self.config["agents"]["active"]:
            self.config["agents"]["active"].remove(agent_name)
            self.save_config()
    
    def get_active_agents(self) -> list:
        """Obtiene lista de agentes activos"""
        return self.config["agents"]["active"]
    
    def enable_skill(self, skill_name: str):
        """Habilita una skill"""
        if skill_name not in self.config["agents"]["skills_enabled"]:
            self.config["agents"]["skills_enabled"].append(skill_name)
            self.save_config()
    
    def disable_skill(self, skill_name: str):
        """Deshabilita una skill"""
        if skill_name in self.config["agents"]["skills_enabled"]:
            self.config["agents"]["skills_enabled"].remove(skill_name)
            self.save_config()
    
    def get_enabled_skills(self) -> list:
        """Obtiene lista de skills habilitadas"""
        return self.config["agents"]["skills_enabled"]
