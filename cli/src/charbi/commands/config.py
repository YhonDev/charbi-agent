"""
⚙️ charbi config — Configuración del sistema
- charbi config (sin args) → abre wizard completo (onboard)
- charbi config get <key> → lee un valor
- charbi config set <key> <value> → escribe un valor
- charbi config show → muestra config completa
"""

import sys
from rich.console import Console
from rich.panel import Panel
from rich import print as rprint
import yaml

from charbi.config.manager import ConfigManager
from charbi.wizard.wizard import run_wizard_sync

console = Console()


def cmd_get(key: str):
    """Lee un valor de la config usando notación de punto"""
    config = ConfigManager()
    keys = key.split('.')
    ref = config.config
    for k in keys:
        if isinstance(ref, dict):
            ref = ref.get(k, {})
        else:
            ref = {}
            break
    if ref:
        if isinstance(ref, dict):
            console.print(yaml.dump(ref, default_flow_style=False))
        else:
            console.print(f"[cyan]{key}[/cyan] = [green]{ref}[/green]")
    else:
        console.print(f"[yellow]⚠ Clave '{key}' no encontrada[/yellow]")


def cmd_set(key: str, value: str):
    """Escribe un valor en la config usando notación de punto"""
    config = ConfigManager()
    # Intentar parsear el valor como bool/int/float
    parsed = value
    if value.lower() == 'true':
        parsed = True
    elif value.lower() == 'false':
        parsed = False
    elif value.isdigit():
        parsed = int(value)
    else:
        try:
            parsed = float(value)
        except ValueError:
            pass

    keys = key.split('.')
    ref = config.config
    for k in keys[:-1]:
        ref = ref.setdefault(k, {})
    ref[keys[-1]] = parsed
    config.save_config()
    console.print(f"[green]✔ {key} = {parsed}[/green]")


def cmd_unset(key: str):
    """Elimina un valor de la config"""
    config = ConfigManager()
    keys = key.split('.')
    ref = config.config
    for k in keys[:-1]:
        ref = ref.get(k, {})
    removed = ref.pop(keys[-1], None)
    if removed is not None:
        config.save_config()
        console.print(f"[green]✔ '{key}' eliminado[/green]")
    else:
        console.print(f"[yellow]⚠ '{key}' no existía[/yellow]")


def cmd_show():
    """Muestra toda la configuración actual"""
    config = ConfigManager()
    console.print(Panel(
        yaml.dump(config.config, default_flow_style=False, allow_unicode=True),
        title="[bold cyan]⚙️ Configuración Actual[/bold cyan]",
        border_style="cyan"
    ))


def main():
    args = sys.argv[1:]

    if not args:
        # Sin argumentos → wizard completo
        run_wizard_sync()
        return

    cmd = args[0].lower()

    if cmd == 'get' and len(args) >= 2:
        cmd_get(args[1])
    elif cmd == 'set' and len(args) >= 3:
        cmd_set(args[1], args[2])
    elif cmd == 'unset' and len(args) >= 2:
        cmd_unset(args[1])
    elif cmd == 'show':
        cmd_show()
    elif cmd == 'onboard':
        # Opciones para onboard
        options = {}
        for i in range(1, len(args)):
            if args[i] == '--skip-channels':
                options['skip_channels'] = True
            elif args[i] == '--provider' and i + 1 < len(args):
                options['provider'] = args[i + 1]
        run_wizard_sync(options)
    else:
        console.print(f"[red]Comando desconocido: {cmd}[/red]")
        console.print("[dim]Uso: charbi config [get|set|unset|show|onboard][/dim]")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[yellow]� Cancelled[/yellow]")
        sys.exit(0)
