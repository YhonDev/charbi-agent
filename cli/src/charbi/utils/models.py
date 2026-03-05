#!/usr/bin/env python3
"""
Utilidades para obtener listas de modelos
Incluye Ollama con detección automática
"""

import os
import subprocess
from typing import List, Dict, Optional
from rich.console import Console

console = Console()

class ModelFetcher:
    """Obtiene listas de modelos de diferentes proveedores"""
    
    @staticmethod
    def get_openai_models(api_key: Optional[str] = None) -> List[Dict]:
        """Modelos de OpenAI"""
        import requests
        
        public_models = [
            {"id": "gpt-4o", "name": "GPT-4o", "owned_by": "openai"},
            {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "owned_by": "openai"},
            {"id": "gpt-4", "name": "GPT-4", "owned_by": "openai"},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "owned_by": "openai"},
        ]
        
        if api_key:
            try:
                headers = {"Authorization": f"Bearer {api_key}"}
                response = requests.get(
                    "https://api.openai.com/v1/models",
                    headers=headers,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    models = [
                        {"id": m["id"], "name": m["id"], "owned_by": m.get("owned_by", "openai")}
                        for m in data.get("data", [])
                        if "gpt" in m["id"].lower()
                    ]
                    if models:
                        return models
            except Exception as e:
                console.print(f"[dim]Warning: Could not fetch OpenAI models: {e}[/dim]")
        
        return public_models
    
    @staticmethod
    def get_anthropic_models(api_key: Optional[str] = None) -> List[Dict]:
        """Modelos de Anthropic"""
        return [
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet", "owned_by": "anthropic"},
            {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "owned_by": "anthropic"},
            {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet", "owned_by": "anthropic"},
            {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku", "owned_by": "anthropic"},
        ]
    
    @staticmethod
    def get_google_models(api_key: Optional[str] = None) -> List[Dict]:
        """Modelos de Google Gemini"""
        import requests
        
        public_models = [
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "owned_by": "google"},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "owned_by": "google"},
            {"id": "gemini-1.0-pro", "name": "Gemini 1.0 Pro", "owned_by": "google"},
        ]
        
        if api_key:
            try:
                response = requests.get(
                    f"https://generativelanguage.googleapis.com/v1/models?key={api_key}",
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    models = [
                        {"id": m["name"].replace("models/", ""), "name": m["name"], "owned_by": "google"}
                        for m in data.get("models", [])
                        if "gemini" in m["name"].lower()
                    ]
                    if models:
                        return models
            except Exception as e:
                console.print(f"[dim]Warning: Could not fetch Google models: {e}[/dim]")
        
        return public_models
    
    @staticmethod
    def get_ollama_models() -> List[Dict]:
        """
        Detecta automáticamente modelos de Ollama instalados localmente
        Ejecuta: ollama list
        """
        models = []
        
        try:
            # Ejecutar comando ollama list
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                
                # Saltar header (primera línea)
                for line in lines[1:]:
                    if line.strip():
                        parts = line.split()
                        if len(parts) >= 2:
                            model_name = parts[0]
                            size = parts[1]
                            
                            models.append({
                                "id": model_name,
                                "name": model_name,
                                "owned_by": "ollama",
                                "size": size
                            })
                
                if models:
                    console.print(f"[dim]✓ Found {len(models)} Ollama models installed[/dim]\n")
                    return models
            else:
                console.print("[dim]Ollama not running or not installed[/dim]\n")
                
        except FileNotFoundError:
            console.print("[dim]Ollama not found in PATH[/dim]\n")
        except subprocess.TimeoutExpired:
            console.print("[dim]Ollama command timed out[/dim]\n")
        except Exception as e:
            console.print(f"[dim]Error detecting Ollama models: {e}[/dim]\n")
        
        # Modelos comunes por si no se puede conectar
        fallback_models = [
            {"id": "llama3.2", "name": "Llama 3.2", "owned_by": "ollama"},
            {"id": "llama3.1", "name": "Llama 3.1", "owned_by": "ollama"},
            {"id": "llama3", "name": "Llama 3", "owned_by": "ollama"},
            {"id": "mistral", "name": "Mistral", "owned_by": "ollama"},
            {"id": "codellama", "name": "Code Llama", "owned_by": "ollama"},
            {"id": "gemma2", "name": "Gemma 2", "owned_by": "ollama"},
        ]
        
        return fallback_models
    
    @staticmethod
    def get_qwen_models() -> List[Dict]:
        """Modelos de Qwen"""
        return [
            {"id": "qwen-max", "name": "Qwen Max", "owned_by": "qwen"},
            {"id": "qwen-plus", "name": "Qwen Plus", "owned_by": "qwen"},
            {"id": "qwen-turbo", "name": "Qwen Turbo", "owned_by": "qwen"},
        ]
    
    @staticmethod
    def fetch_models(provider: str, api_key: Optional[str] = None) -> List[Dict]:
        """Factory method para obtener modelos según proveedor"""
        fetchers = {
            "openai": ModelFetcher.get_openai_models,
            "anthropic": ModelFetcher.get_anthropic_models,
            "google": ModelFetcher.get_google_models,
            "ollama": ModelFetcher.get_ollama_models,
            "qwen": ModelFetcher.get_qwen_models,
        }
        
        fetcher = fetchers.get(provider)
        if not fetcher:
            return []
        
        if provider == "ollama":
            return fetcher()  # Ollama no necesita API key
        elif provider == "qwen":
            return fetcher()
        else:
            return fetcher(api_key)
