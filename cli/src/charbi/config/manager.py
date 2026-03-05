"""
Gestor de Configuración Centralizado con Soporte para YAML y Backups
Sincronizado con el Kernel de Charbi
"""

import json
import os
import shutil
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

class ConfigManager:
    """Gestiona la configuración global de Charbi con backups automáticos"""
    
    def __init__(self, config_dir: Optional[Path] = None):
        self.base_dir = config_dir or Path.home() / ".charbi-agent"
        self.config_path = self.base_dir / "config" / "charbi-agent.yaml"
        self.backup_dir = self.base_dir / "config" / "backups"
        
        # Crear directorios necesarios
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        self.config = self.load_config()
    
    def load_config(self) -> Dict[str, Any]:
        """Carga la configuración desde el archivo YAML del kernel"""
        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    return yaml.safe_load(f) or {}
            except Exception as e:
                print(f"Error cargando YAML: {e}")
                return {}
        return {}

    def save_config(self, config: Optional[Dict] = None):
        """Guarda la configuración y genera un backup automáticamente"""
        if config:
            self.config = config
            
        # 1. Generar Backup antes de guardar
        if self.config_path.exists():
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = self.backup_dir / f"charbi-agent_{timestamp}.yaml.bak"
            shutil.copy2(self.config_path, backup_path)
            
            # Limpiar backups antiguos (mantener los últimos 10)
            self._cleanup_backups()

        # 2. Guardar nueva configuración
        with open(self.config_path, 'w', encoding='utf-8') as f:
            yaml.dump(self.config, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
            
    def _cleanup_backups(self, limit: int = 10):
        """Mantiene solo los backups más recientes"""
        backups = sorted(self.backup_dir.glob("*.bak"), key=os.path.getmtime, reverse=True)
        for old_backup in backups[limit:]:
            try:
                old_backup.unlink()
            except Exception:
                pass

    # Métodos de utilidad para acceder a la config del kernel
    def get_system(self) -> Dict:
        return self.config.get("system", {})

    def get_models(self) -> Dict:
        return self.config.get("models", {})

    def update_model(self, role: str, model_name: str):
        if "models" not in self.config:
            self.config["models"] = {}
        self.config["models"][role] = model_name
        self.save_config()

    def get_provider(self) -> Dict:
        return self.config.get("provider", {})

    def update_provider_config(self, provider_config: Dict):
        self.config["provider"] = provider_config
        # Ensure the model is also synced to models.router
        if "models" not in self.config:
            self.config["models"] = {}
        if provider_config.get("model"):
            self.config["models"]["router"] = provider_config["model"]
        self.save_config()

    def get_channels(self) -> Dict:
        return self.config.get("channels", {})

    def set_channel_status(self, channel: str, enabled: bool):
        if "channels" not in self.config:
            self.config["channels"] = {}
        if channel not in self.config["channels"]:
            self.config["channels"][channel] = {}
        self.config["channels"][channel]["enabled"] = enabled
        self.save_config()
        
    def update_channel_config(self, channel: str, updates: Dict):
        if "channels" not in self.config:
            self.config["channels"] = {}
        if channel not in self.config["channels"]:
            self.config["channels"][channel] = {"enabled": False}
        self.config["channels"][channel].update(updates)
        self.save_config()
        
    def get_skills(self) -> Dict:
        return self.config.get("skills", {})
    
    def toggle_skill(self, skill_name: str, enabled: bool):
        # La estructura en el yaml parece ser plana o bajo 'skills'
        if "skills" not in self.config:
            self.config["skills"] = {}
        self.config["skills"][skill_name] = enabled
        self.save_config()
