#!/usr/bin/env python3
"""
📱 Comando: charbi channels
Gestión de canales de comunicación
"""

import click
import requests
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from pathlib import Path
from charbi.config.manager import ConfigManager

console = Console()

def verify_telegram_token(bot_token: str) -> bool:
    """Verifica que el token de Telegram sea válido"""
    try:
        url = f"https://api.telegram.org/bot{bot_token}/getMe"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                bot_info = data.get("result", {})
                console.print(f"[dim]🤖 Bot encontrado: @{bot_info.get('username', 'N/A')}[/dim]")
                return True
        return False
    except Exception as e:
        console.print(f"[dim]⚠️  No se pudo verificar: {str(e)}[/dim]")
        return False

@click.group()
def main():
    """📱 Gestión de canales de comunicación"""
    pass

@main.command()
def telegram():
    """📱 Configurar canal de Telegram"""
    config_mgr = ConfigManager()
    
    console.print(Panel("[bold cyan]📱 CONFIGURACIÓN DE TELEGRAM[/bold cyan]"))
    
    existing = config_mgr.get_channels().get("telegram", {})
    
    if existing.get("enabled") and existing.get("bot_token") or existing.get("token_env"):
        console.print("[yellow]⚠️  Telegram ya está configurado[/yellow]")
        action = click.prompt(
            "¿Qué deseas hacer?",
            type=click.Choice(["update", "revoke", "cancel"]),
            default="cancel"
        )
        if action == "cancel":
            console.print("[green]✅ Sin cambios[/green]")
            return
        elif action == "revoke":
            if Confirm.ask("¿Seguro que deseas eliminar la configuración de Telegram?"):
                config_mgr.set_channel_status("telegram", False)
                console.print("[green]✅ Telegram desactivado[/green]")
                return
    
    console.print("\n[yellow]🔑 Token de Bot de Telegram[/yellow]")
    console.print("[dim]Obténlo en: https://t.me/BotFather[/dim]\n")
    
    bot_token = Prompt.ask("Introduce tu Bot Token", password=True)
    if not bot_token:
        console.print("[red]✗ Token requerido[/red]")
        return
    
    console.print("[dim]🔍 Verificando token...[/dim]")
    if verify_telegram_token(bot_token):
        console.print("[green]✓ Token válido[/green]")
    else:
        console.print("[yellow]⚠️  Token no verificado (continuando de todas formas)[/yellow]")
    
    chat_id = Prompt.ask("Chat ID (deja vacío para todos)", default="", show_default=False)
    
    config_mgr.update_channel_config("telegram", {
        "enabled": True,
        "token_env": bot_token,  # Using token_env directly as requested by older yaml format, or overriding it
        "bot_token": bot_token,
        "chat_id": chat_id if chat_id else None
    })
    
    console.print("\n[green]✅ Telegram configurado correctamente[/green]")

@main.command()
def list():
    """📋 Listar canales configurados"""
    config_mgr = ConfigManager()
    channels = config_mgr.get_channels()
    
    console.print(Panel("[bold cyan]📱 CANALES CONFIGURADOS[/bold cyan]"))
    
    if not channels:
        console.print("[dim]No hay canales configurados[/dim]")
        return
    
    for channel_name, channel_config in channels.items():
        status = "[green]✓ Activo[/green]" if channel_config.get("enabled") else "[red]✗ Inactivo[/red]"
        console.print(f"\n{channel_name.title()}: {status}")
        for key, value in channel_config.items():
            if key not in ["enabled", "bot_token", "token_env"]:
                console.print(f"  • {key}: {value}")
            elif key in ["bot_token", "token_env"] and value:
                # Mask token
                masked = value[:4] + "•" * (len(value) - 8) + value[-4:] if len(value) > 8 else "••••"
                console.print(f"  • {key}: {masked}")

if __name__ == "__main__":
    main()
